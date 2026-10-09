/**
 * IndexGenerator — wiki index page generator.
 *
 * Extracted from WikiEngine (2026-07-19) as part of v1.25.1 Phase C-PR1.
 *
 * Responsibility:
 *   - List vault pages under wiki/{entities,concepts,sources}
 *   - Render the flat 3-section markdown index (Entities / Concepts / Sources)
 *     with each page's summary + aliases (localized via TEXTS.indexLabels)
 *   - Write the index.md via the caller's writeFile callback
 *
 * Non-responsibility:
 *   - The wiki folder existence check + creation lives in WikiEngine.ensureWikiStructure
 *     (also called by conversation-ingest orchestrator). IndexGenerator assumes the
 *     folder exists when generate() is invoked — the caller is responsible for setup.
 *   - Indexing label translation lives in TEXTS (per-locale table), keyed off
 *     wikiLanguage setting.
 *
 * Why extracted:
 *   - generateIndexFromEngine + generateFlatIndex + getPageSummary + getPageAliases
 *     totaled ~85 LOC of pure rendering logic with no shared mutable state with
 *     WikiEngine ingest pipeline. Composing it into a class makes the boundary
 *     obvious and lets future consumers (e.g. a CLI build-mode of the wiki) reuse it.
 */

import { TFile, normalizePath } from 'obsidian';
import { TEXTS } from '../../texts';
import { parseFrontmatter } from '../../core/frontmatter';
import { isStubPage } from '../page-factory/stub-page';

export interface IndexGeneratorOptions {
  wikiFolder: string;
  wikiLanguage: string;
  /**
   * Read a vault file's content. IndexGenerator never holds the App directly —
   * the caller injects a thin read closure so the class is unit-testable.
   */
  readFile: (file: TFile) => Promise<string>;
  /**
   * Write the rendered markdown to the given vault path.
   */
  writeFile: (path: string, content: string) => Promise<void>;
}

export class IndexGenerator {
  private readonly wikiFolder: string;
  private readonly wikiLanguage: string;
  private readonly readFile: IndexGeneratorOptions['readFile'];
  private readonly writeFile: IndexGeneratorOptions['writeFile'];

  constructor(opts: IndexGeneratorOptions) {
    this.wikiFolder = opts.wikiFolder;
    this.wikiLanguage = opts.wikiLanguage;
    this.readFile = opts.readFile;
    this.writeFile = opts.writeFile;
  }

  /**
   * Render and write the index page. Caller is responsible for filtering the
   * TFile list to the 3 wiki content folders (entities / concepts / sources).
   *
   * v1.25.1 Phase C-PR1.8 (Simplification #5 + Efficiency #1): the three
   * section-render loops are now factored into `renderSection`, AND each
   * TFile is read at most once (cached in `contentCache`) instead of twice
   * (once for summary, once for aliases). On a 5K-page vault this drops
   * 5K redundant vault reads per index regen.
   */
  async generateFlatIndex(
    entities: TFile[],
    concepts: TFile[],
    sources: TFile[],
  ): Promise<void> {
    const lang = this.wikiLanguage || 'en';
    type LangKey = keyof typeof TEXTS.en.indexLabels;
    const langKey: LangKey = (lang in TEXTS.en.indexLabels) ? lang as LangKey : 'en';
    const labels = TEXTS.en.indexLabels[langKey];

    // One read per file, shared across summary + aliases within the same regen.
    const contentCache = new Map<string, string>();
    const readOnce = async (file: TFile): Promise<string> => {
      let c = contentCache.get(file.path);
      if (c === undefined) {
        c = await this.readFile(file);
        contentCache.set(file.path, c);
      }
      return c;
    };

    let indexContent = `# Wiki Index\n\n`;
    indexContent += `> ${labels.subtitle}\n\n`;
    indexContent += `> Note: Text in backticks after page names shows aliases — alternative names, abbreviations, or translations.\n\n`;

    indexContent += await this.renderSection(
      labels.entities, entities, 'entities', true, readOnce
    );
    indexContent += await this.renderSection(
      labels.concepts, concepts, 'concepts', true, readOnce
    );
    indexContent += await this.renderSection(
      labels.sources, sources, 'sources', false, readOnce
    );

    const indexPath = normalizePath(`${this.wikiFolder}/index.md`);
    await this.writeFile(indexPath, indexContent);
  }

  /**
   * Render one H2 section of the index. `withSummary=true` for entities and
   * concepts (first body line shown after the page link); false for sources
   * (the source pages are typically longer and the summary adds noise).
   *
   * `readContent` is the per-file read closure (caller-supplied cache).
   */
  private async renderSection(
    label: string,
    files: TFile[],
    folder: string,
    withSummary: boolean,
    readContent: (file: TFile) => Promise<string>,
  ): Promise<string> {
    let section = `\n## ${label}\n\n`;
    for (const file of files) {
      const content = await readContent(file);
      const aliases = this.parseAliases(content);
      const aliasStr = aliases.length > 0 ? ` \`aliases: ${aliases.join(', ')}\`` : '';
      const sourceSlug = this.parseSourceSlug(content);
      const sourceStr = sourceSlug ? ` \`source: ${sourceSlug}\`` : '';
      if (withSummary) {
        const summary = this.firstBodyLine(content);
        section += `- [[${folder}/${file.basename}|${file.basename}]]${aliasStr}${sourceStr} - ${summary}\n`;
      } else {
        section += `- [[${folder}/${file.basename}|${file.basename}]]${aliasStr}${sourceStr}\n`;
      }
    }
    return section;
  }

  /**
   * Helper for renderSection: returns the first non-empty, non-heading,
   * non-frontmatter body line (≤100 chars). Used as the index entry's summary.
   *
   * v1.25.1 Phase C-PR1.8 (Altitude #4): frontmatter is parsed once via
   * `parseFrontmatter` and the entire `^---\n…\n---` block is skipped as
   * a unit, so property lines like `title: T` no longer leak into the
   * summary on pages without `## Heading` openers.
   *
   * #729 Phase 1: a dissent stub's body is `# name`, then a provenance
   * blockquote ("Stub created by the ingest candidate gate …"), then the
   * extraction summary, then a quoted mention. The blockquote went into the
   * index entry, so every stub page listed the same sentence instead of the
   * summary the extraction had already paid for. The gate is the `stub: true`
   * frontmatter flag, **not** the text: a page may legitimately open with a
   * blockquote and must keep it. On a stub, quoted lines are provenance and
   * are skipped; an empty result reports `No summary` rather than inventing
   * one.
   */
  private firstBodyLine(content: string): string {
    const fm = parseFrontmatter(content);
    let body = content;
    if (fm) {
      // Frontmatter block always starts at offset 0; skip everything up to
      // and including the first `\n---\n` boundary.
      const endIdx = content.indexOf('\n---', 3);
      if (endIdx > 0) {
        body = content.substring(endIdx + 4);
      }
    }
    const isStub = isStubPage(fm);
    const lines = body.split('\n').filter(l => {
      const t = l.trim();
      if (!t || t.startsWith('#') || t.startsWith('---')) return false;
      return !(isStub && t.startsWith('>'));
    });
    return lines[0]?.substring(0, 100) || 'No summary';
  }

  /**
   * Helper for renderSection: the page's source slug from its `sources:`
   * frontmatter value. Accepts the inline `[[sources/x]]` form and the block
   * `- "[[sources/x]]"` form. Returns null when the value is missing or empty —
   * an empty key means "unknown", not "unattributed", and inventing a slug would
   * poison the coverage rule.
   */
  private parseSourceSlug(content: string): string | null {
    const fm = parseFrontmatter(content);
    const raw: unknown = fm?.sources;
    const text = Array.isArray(raw) ? raw.join(' ') : typeof raw === 'string' ? raw : '';
    const m = /\[\[sources\/([^\]|]+)(?:\|[^\]]+)?\]\]/.exec(text);
    return m ? m[1].trim() : null;
  }

  /**
   * Helper for renderSection: aliases read from the page's frontmatter
   * `aliases:` array. Non-string entries filtered out; trimmed; empties dropped.
   */
  private parseAliases(content: string): string[] {
    const fm = parseFrontmatter(content);
    if (fm?.aliases && Array.isArray(fm.aliases) && fm.aliases.length > 0) {
      return fm.aliases
        .filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
        .map(a => a.trim());
    }
    return [];
  }

  /** Render the empty-state index when the wiki has no pages yet. */
  async generateEmptyIndex(): Promise<void> {
    const indexPath = normalizePath(`${this.wikiFolder}/index.md`);
    await this.writeFile(
      indexPath,
      `# Wiki Index\n\n> No pages yet. Ingest sources to populate the Wiki.\n`
    );
  }

  /**
   * Public facade for the index entry's summary line. Public callers
   * (lint phases, history-modal) read one file at a time so the content
   * cache used by `generateFlatIndex` is unnecessary here.
   *
   * v1.25.1 Phase C-PR1.8: delegates to `firstBodyLine`, which skips
   * the YAML frontmatter block as a unit (Altitude #4 fix).
   */
  async getPageSummary(file: TFile): Promise<string> {
    const content = await this.readFile(file);
    return this.firstBodyLine(content);
  }

  /**
   * Public facade for the page's aliases array. See `getPageSummary` for
   * why the cache-free implementation is correct here.
   *
   * v1.25.1 Phase C-PR1.8: delegates to `parseAliases`.
   */
  async getPageAliases(file: TFile): Promise<string[]> {
    const content = await this.readFile(file);
    return this.parseAliases(content);
  }
}