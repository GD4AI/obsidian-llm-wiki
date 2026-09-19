import { App } from 'obsidian';
import { parseFrontmatter, extractBody } from '../../core/frontmatter';
import { CANDIDATE_WINDOW_TEXT_CHARS } from '../../constants';
import { isInFolderScope } from '../../core/folder-scope';
import type { WikiPageRef } from '../../types';

/** The file shape this module reads. `TFile` satisfies it; so does a plain object. */
interface IndexableFile {
  path: string;
  basename: string;
  stat?: { ctime: number };
}

/**
 * Build one index entry from a page's file and its raw content.
 *
 * Returns null for pages that do not belong in the index — today only the
 * Welcome note. Kept separate from the vault walk so the shape is built in one
 * place, whatever produced the content.
 */
function toWikiPageEntry(
  file: IndexableFile,
  content: string,
  wikiFolder: string
): WikiPageRef | null {
  const fm = parseFrontmatter(content);

  // v1.23.0 P0-2 follow-up: skip Welcome notes. They have
  // `type: welcome` frontmatter and a localized filename
  // (e.g. "欢迎使用 Karpathy LLM Wiki.md" in Chinese), so we
  // cannot filter by filename. The frontmatter is the only
  // robust signal.
  //
  // Without this, Ingest would treat the welcome note as an
  // existing entity page and Query Wiki would surface it in
  // context — both are wrong: the welcome is onboarding
  // content, not a knowledge page.
  // Defensive: parseFrontmatter returns null for malformed
  // frontmatter. Only skip pages with a valid `type: welcome`
  // — any other shape (no frontmatter, malformed, no type) is
  // kept and treated as a regular wiki page.
  if (fm && fm.type === 'welcome') {
    return null;
  }

  const relPath = file.path.replace(wikiFolder + '/', '').replace('.md', '');
  const body = extractBody(content);

  // Issue #592: `title` (below) is the filename slug, not a display name — title-casing a slug can't recover punctuation, spacing, or subscripts a real heading has.
  // Prefer the page's actual H1; when there's no parseable heading, leave it unset so callers fall back to `title` — frontmatter aliases are unordered abbreviations/variants, not necessarily what the page is called.
  // Costs no extra read — `body` is already produced above for the candidate-window text below.
  const h1Match = body.trim().match(/^#\s+(.+?)(?:\n|$)/);
  const displayTitle = h1Match ? h1Match[1].trim() : undefined;

  return {
    path: file.path,
    title: file.basename,
    displayTitle,
    wikiLink: `[[${relPath}|${file.basename}]]`,
    aliases: Array.isArray(fm?.aliases) ? fm.aliases : undefined,
    // Issue #446: ranking signal for designators that match more than one
    // page. Read here because the frontmatter is already parsed.
    tags: Array.isArray(fm?.tags) ? fm.tags : undefined,
    ctime: file.stat?.ctime,
    // The page's prose, for the candidate window (`core/candidate-window.ts`).
    // The file is already read here to parse its frontmatter; keeping a
    // bounded, lower-cased slice of the body costs no second read and lets
    // the dedup and dead-link prompts rank pages by what they say, not only
    // by what they are called.
    text: body.toLowerCase().slice(0, CANDIDATE_WINDOW_TEXT_CHARS),
  };
}

/** True when a vault path belongs in the wiki page index. */
function isIndexableWikiPath(path: string, wikiFolder: string): boolean {
  return (
    isInFolderScope(path, wikiFolder, false) &&
    !path.includes('index.md') &&
    !path.includes('log.md') &&
    !path.includes('/schema/') &&
    !path.includes('/contradictions/')
  );
}

/**
 * One walk over the vault's wiki pages, holding nothing afterwards.
 *
 * Every production caller goes through `WikiPageIndex` now, via the accessor on
 * the context it already carries. This stays as the module's entry for a caller
 * that has nowhere to keep an index — today that is the test support, which also
 * spies on it to supply a page list. It builds a fresh index and drops it, so
 * there is one walk in this module rather than two to keep in step.
 */
export async function getExistingWikiPages(
  app: App,
  wikiFolder: string
): Promise<WikiPageRef[]> {
  return new WikiPageIndex(app, () => wikiFolder).pages();
}

/**
 * The vault's wiki pages, held across calls and refreshed per file.
 *
 * The walk reads every wiki page in full, and the callers that need it run per
 * written page — `applyRelatedLinks` alone fires on every write. The engine
 * held the result behind a 5-second TTL that every write threw away, so during
 * an ingest the walk effectively ran from scratch each time.
 *
 * This keeps the per-file result instead. Listing the vault is cheap
 * (`getMarkdownFiles` reads no file); only the bodies cost anything, so an
 * entry is reused while its file's `mtime` and `size` are unchanged and
 * re-read otherwise. Pages the plugin writes are dropped from the index by the
 * writer as well, because a filesystem `mtime` has second granularity and a
 * write followed by a read inside the same second would otherwise go unseen.
 *
 * The two halves cover different writers on purpose. The writer's own
 * invalidation only knows about writes that go through the engine, and the
 * engine does not consistently use its own front doors; the stat check is what
 * catches every other writer — the user saving a note during an ingest,
 * Obsidian's own link update after a rename, a sync client, another plugin.
 *
 * One residual, stated rather than implied: a write from OUTSIDE the engine,
 * inside the same filesystem second as the read that filled the entry AND to
 * exactly the same byte length, is invisible to both halves. The writer does
 * not know about it and the stat is unchanged. The next change to that file
 * clears it.
 *
 * Holding costs memory the 5-second TTL did not: every page's entry stays
 * resident until its file leaves the vault. An entry is aliases, tags and a
 * body slice bounded by CANDIDATE_WINDOW_TEXT_CHARS (2,000), so a 2,500-page
 * vault holds on the order of 5 MB. That is the price of not re-reading the
 * whole vault once per written page.
 *
 * Order is the vault's own, on every call: the list is rebuilt from the
 * current file list, so a page created mid-run appears exactly where a full
 * walk would have put it, and the pool order the candidate window relies on
 * is unchanged.
 */
export class WikiPageIndex {
  private entries = new Map<string, { mtime: number; size: number; entry: WikiPageRef }>();

  constructor(
    private readonly app: App,
    private readonly getWikiFolder: () => string
  ) {}

  async pages(): Promise<WikiPageRef[]> {
    const wikiFolder = this.getWikiFolder();
    const files = this.app.vault
      .getMarkdownFiles()
      .filter(f => isIndexableWikiPath(f.path, wikiFolder));

    const pages: WikiPageRef[] = [];
    const seen = new Set<string>();
    for (const f of files) {
      seen.add(f.path);
      const held = this.entries.get(f.path);
      // Read the stat BEFORE the body, and store that one. `TFile.stat` is
      // live: if the file changes while we await its content, reading the
      // stat afterwards would pair the old body with the new stat and hold
      // that pair as valid for good. Taken beforehand, a change during the
      // read leaves a stale stat behind, and the next call re-reads.
      const mtime = f.stat?.mtime ?? 0;
      const size = f.stat?.size ?? 0;
      if (held && held.mtime === mtime && held.size === size) {
        pages.push(held.entry);
        continue;
      }
      const entry = toWikiPageEntry(f, await this.app.vault.read(f), wikiFolder);
      // A page excluded from the index (the Welcome note) is not held: it has
      // no entry to reuse, and re-testing it costs one read of one file.
      if (!entry) continue;
      this.entries.set(f.path, { mtime, size, entry });
      pages.push(entry);
    }

    for (const path of this.entries.keys()) {
      if (!seen.has(path)) this.entries.delete(path);
    }
    return pages;
  }

  /** Drop one page — call after writing or deleting it. */
  invalidate(path: string): void {
    this.entries.delete(path);
  }

  /** Drop everything — call when the wiki folder itself changes. */
  clear(): void {
    this.entries.clear();
  }

  /** How many pages are held. Observability for tests. */
  get size(): number {
    return this.entries.size;
  }
}
