// Schema Manager - Wiki Schema configuration layer (Karpathy's third layer)

import { App, TFile } from 'obsidian';
import { LLMWikiSettings, WikiSchema, SchemaSuggestion, VALID_ENTITY_TAGS, VALID_CONCEPT_TAGS, DEFAULT_ENTITY_TAG, DEFAULT_CONCEPT_TAG, LLMClient, WIKI_LANGUAGES } from '../types';
import { PROMPTS } from '../prompts';
import { parseSchemaSuggestion } from './parse-suggestion';
import { capMaxTokens } from '../core/token-cap';
import { resolveModelForTask } from '../core/model-resolver';
import { TOKENS_SCHEMA_SUGGESTION } from '../constants';
import { renderTemplate } from '../core/template-renderer';
import { SchemaSuggestionLLMSchema } from '../llm-sdk/output-schemas';
import { callLlm } from '../core/llm-dispatch';
import { localDateStamp } from '../core/format';

const SCHEMA_FILENAME = 'schema/config.md';
const SUGGESTIONS_FILENAME = 'schema/suggestions.md';

export type SchemaTask = 'analyze' | 'summary' | 'entity' | 'concept' | 'related' | 'conversation' | 'index' | 'lint' | 'merge' | 'full';

/**
 * Issue #328 Phase 1: sanitize a legacy schema body that may still carry
 * baked tag enums in 6 places (Wiki Structure × 2, Entity Page Template × 1,
 * Concept Page Template × 1, Classification Rules × 2). The on-disk file
 * is the user's data — we do not rewrite it. Instead, the LLM-facing view
 * produced by `loadSchema()` is sanitized here so the runtime injection is
 * the SOLE tag vocabulary the model encounters.
 *
 * The sanitization is **line-fingerprint, section-agnostic** — a unique
 * structural prefix on each legacy line anchors the regex, and content
 * after the colon is dropped wholesale. We do NOT match `${entityList}`
 * generically, so a user-added heading or sentence that happens to mention
 * the same words (e.g. "Entity subtypes are documented below.") is left
 * alone. Idempotent — re-running sanitize on an already-clean body is a
 * no-op (the fresh production body never matches these patterns).
 *
 * If a user hand-edited Classification Rules into a wrapped multi-line
 * sub-list (header line + child indented bullets), only the header is
 * stripped; the child bullets remain. Power-user edge case — accept the
 * partial strip, document the limitation.
 *
 * Exported for unit testing.
 */
export function stripLegacyBakedTagEnum(body: string): string {
  // Six-line fingerprint set, each anchored at the unique structural
  // prefix that produced it in v1.22.0-v1.25.1. We do NOT match
  // `${entityList}` generically — we match the literal suffix the
  // interpolations produced, so a user-added heading or sentence that
  // happens to mention the same words is left alone.
  const legacyPatterns: Array<{ pattern: RegExp; replacement: string }> = [
    // Wiki Structure (entity)
    {
      pattern: /^- Entity pages: `entities\/` \([^)]*\)$/m,
      replacement: '- Entity pages: `entities/` — entity subtype tags are runtime-injected (see Settings → Tag Vocabulary); this file holds no list',
    },
    // Wiki Structure (concept)
    {
      pattern: /^- Concept pages: `concepts\/` \([^)]*\)$/m,
      replacement: '- Concept pages: `concepts/` — concept subtype tags are runtime-injected (see Settings → Tag Vocabulary); this file holds no list',
    },
    // Entity Page Template — `tags:` field
    {
      pattern: /^- `tags:` — entity subtype, MUST be one of: .*$/m,
      replacement: '- `tags:` — entity subtype; the valid values are runtime-injected by the **Active Tag Vocabulary** section of every system prompt (driven by Settings). MUST be one of those values.',
    },
    // Concept Page Template — `tags:` field
    {
      pattern: /^- `tags:` — concept subtype, MUST be one of: .*$/m,
      replacement: '- `tags:` — concept subtype; the valid values are runtime-injected by the **Active Tag Vocabulary** section of every system prompt (driven by Settings). MUST be one of those values.',
    },
    // Classification Rules (entity)
    {
      pattern: /^- Entity subtypes \(valid tags for type=entity\): .*$/m,
      replacement: '- Entity subtypes: see the **Active Tag Vocabulary** section injected into every system prompt (driven by Settings).',
    },
    // Classification Rules (concept)
    {
      pattern: /^- Concept subtypes \(valid tags for type=concept\): .*$/m,
      replacement: '- Concept subtypes: see the **Active Tag Vocabulary** section injected into every system prompt (driven by Settings).',
    },
  ];

  // Fast path: if NONE of the six fingerprints is present, return the
  // body untouched so we don't pay the replace cost on every call
  // (this is the steady state for new-format bodies and the hot path).
  let hasAnyFingerprint = false;
  for (const { pattern } of legacyPatterns) {
    if (pattern.test(body)) {
      hasAnyFingerprint = true;
      break;
    }
  }
  if (!hasAnyFingerprint) return body;

  // Apply replacements in order. Each pattern is anchored at a unique
  // structural prefix so they cannot cross-interact.
  let sanitized = body;
  for (const { pattern, replacement } of legacyPatterns) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized;
}

// Re-export tag constants from types.ts for convenience
export { VALID_ENTITY_TAGS, VALID_CONCEPT_TAGS, DEFAULT_ENTITY_TAG, DEFAULT_CONCEPT_TAG };

// Issue #491 (oversight reading): the delivery map previously named only six
// of the eleven sections the default body writes, so five — Source Page
// Template, Date Fields, Mentions Format, Content Rules, Multi-Source Merge
// Rules — reached just the 'full' callers and never ingest, generation, or
// merge, while the file tells the user "edit it freely". #328 Phase 1 made
// this file pure user domain knowledge whose edits must take effect, so the
// map now delivers each section where it is semantically owned:
//
//   - Content Rules (the VERBATIM/grounding layer) → analyze/entity/concept
//   - Mentions Format                              → entity/concept/summary
//   - Source Page Template                         → summary (wiki-engine's
//     buildSystemPrompt('summary') is the site that writes sources/<slug>.md)
//   - Multi-Source Merge Rules + Date Fields       → merge
//
// Date Fields' programmatic-fill half is engine fact (#328 layer 3); moving
// it to runtime injection wholesale remains future work.
// `Content Rules` reaches `merge` and `full` as of 2026-10-30. It did not
// before, and that was the same defect KvikullSigurdur reported as "a merge does
// not carry the content requirements" — the settings copy of the text was
// threaded into five merge templates and four were missed. Here the fix is one
// entry per task, and the routing table is the only place that decides.
const TASK_SECTIONS: Record<SchemaTask, string[]> = {
  analyze: ['Wiki Structure', 'Classification Rules', 'Naming Conventions', 'Content Rules', 'Extraction Focus'],
  summary: ['Wiki Structure', 'Classification Rules', 'Source Page Template', 'Mentions Format'],
  entity: ['Entity Page Template', 'Naming Conventions', 'Classification Rules', 'Mentions Format', 'Content Rules'],
  concept: ['Concept Page Template', 'Naming Conventions', 'Classification Rules', 'Mentions Format', 'Content Rules'],
  related: ['Naming Conventions', 'Classification Rules'],
  conversation: ['Wiki Structure', 'Entity Page Template', 'Concept Page Template', 'Naming Conventions', 'Classification Rules'],
  // 'index' has a single caller: the semantic dedup in
  // page-factory/path-resolution.ts. Classification Rules ride along because
  // that call now re-decides the entity/concept classification on a
  // cross-folder match — the user's own definitions are the ruler for that
  // decision, and this is the only way they reach it.
  index: ['Wiki Structure', 'Classification Rules'],
  lint: ['Maintenance Policies'],
  merge: ['Entity Page Template', 'Concept Page Template', 'Naming Conventions', 'Classification Rules', 'Multi-Source Merge Rules', 'Date Fields', 'Content Rules'],
  full: ['Wiki Structure', 'Entity Page Template', 'Concept Page Template', 'Naming Conventions', 'Classification Rules', 'Maintenance Policies', 'Content Rules', 'Extraction Focus'],
};

/**
 * The body of one `## Heading` section, without the heading and without the
 * trailing blank line that separates it from the next section.
 */
export function extractSectionBody(raw: string, heading: string): string {
  const lines = raw.split('\n');
  const target = `## ${heading}`;
  const start = lines.findIndex((line) => line.trim() === target);
  if (start === -1) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^##\s/.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start + 1, end).join('\n').trim();
}

/**
 * The same file with one section's body swapped. Everything outside the section
 * — frontmatter, other sections, their order and their blank lines — is
 * preserved, because the user's schema is their document, not our template.
 */
export function replaceSectionBody(raw: string, heading: string, content: string): string {
  const lines = raw.split('\n');
  const target = `## ${heading}`;
  const body = content.trim() === '' ? [] : content.trim().split('\n');
  const start = lines.findIndex((line) => line.trim() === target);

  if (start === -1) {
    const tail = raw.endsWith('\n') ? raw : `${raw}\n`;
    return `${tail}\n${target}\n${body.length > 0 ? `${body.join('\n')}\n` : ''}`;
  }

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^##\s/.test(lines[i])) { end = i; break; }
  }

  // One blank line between the section and whatever follows it, which is how
  // every section in the default body is separated.
  const replacement = body.length > 0 ? [target, ...body, ''] : [target, ''];
  return [...lines.slice(0, start), ...replacement, ...lines.slice(end)].join('\n');
}

export function buildDefaultSchemaBody(_settings?: LLMWikiSettings): string {
  // Issue #328 Phase 1: tag vocabulary is Settings-driven and is injected
  // at runtime via buildActiveTagVocabularySection() — see
  // src/wiki/system-prompts.ts. The schema body intentionally holds no
  // baked enum. The `settings` parameter is kept so ensureSchemaExists()
  // and regenerateDefaultSchema() callers stay byte-identical; it is no
  // longer read here. Phase 2 may legitimately need it again.
  return `# Wiki Schema Configuration

This file governs how the LLM builds and maintains your Wiki. Edit it freely.

## Wiki Structure
- Entity pages: \`entities/\` — entity subtype tags are runtime-injected (see Settings → Tag Vocabulary); this file holds no list
- Concept pages: \`concepts/\` — concept subtype tags are runtime-injected (see Settings → Tag Vocabulary); this file holds no list
- Source pages: \`sources/\`
- Index: \`index.md\`
- Log: \`log.md\`

## Entity Page Template
Pages in \`entities/\` MUST follow this structure:

**Frontmatter fields:**
- \`type: entity\` — page category (MUST be exactly "entity")
- \`created:\` — ISO date of first creation
- \`sources:\` — array of source file wiki-links
- \`tags:\` — entity subtype; the valid values are runtime-injected by the **Active Tag Vocabulary** section of every system prompt (driven by Settings). MUST be one of those values.
- \`aliases:\` (optional) — alternative names (translations, abbreviations)
- \`reviewed:\` (optional) — if true, page is human-verified and protected

**Sections:**
1. **Description**: 3-6 sentences with concrete facts, bidirectional links
2. **Related Entities**: Links to related entities using [[entities/...]]
3. **Related Concepts**: Links to related concepts using [[concepts/...]]
4. **Mentions in Source**: Verbatim quotes with source attribution — see [Mentions Format](#mentions-format) below

## Concept Page Template
Pages in \`concepts/\` MUST follow this structure:

**Frontmatter fields:**
- \`type: concept\` — page category (MUST be exactly "concept")
- \`created:\` — ISO date of first creation
- \`sources:\` — array of source file wiki-links
- \`tags:\` — concept subtype; the valid values are runtime-injected by the **Active Tag Vocabulary** section of every system prompt (driven by Settings). MUST be one of those values.
- \`aliases:\` (optional) — alternative names (translations, abbreviations)
- \`reviewed:\` (optional) — if true, page is human-verified and protected

**Sections:**
1. **Definition**: Clear, concise definition
2. **Key Characteristics**: Bullet list of defining traits
3. **Applications**: Real-world usage scenarios
4. **Related Concepts**: Links using [[concepts/...]]
5. **Related Entities**: Links using [[entities/...]]
6. **Mentions in Source**: Verbatim quotes with source attribution — see [Mentions Format](#mentions-format) below

## Naming Conventions
- Filenames: lowercase-with-hyphens (slugified)
- Entity/concept names: Preserve original language from source, NEVER translate
- Wiki-links: Use full paths [[entities/page-name|Display Name]] or [[concepts/page-name|Display Name]]

## Source Page Template
Pages in \`sources/\` MUST follow this structure:

**Frontmatter fields:**
- \`type: source\` — page category (MUST be exactly "source")
- \`tags:\` — INHERITED from the source note's frontmatter (do NOT use LLM-derived concept names). The system programmatically populates this from the source file; the LLM must not overwrite it with extracted concept names. This preserves the user's existing tag vocabulary and prevents pollution from LLM hallucinations.
- \`sources:\` — array of related wiki page links created from this source
- \`created:\` / \`updated:\` — set by the system, see Date Fields below

**Sections:**
1. **Summary**: Brief description of the source content (2-4 sentences)
2. **Key Points**: Bullet list of main insights
3. **Mentioned Pages**: List of [[entities/...]] and [[concepts/...]] pages created from this source

## Date Fields
- \`created:\` and \`updated:\` are filled by the system programmatically — NEVER LLM-generated
- The LLM may produce wrong dates during extraction; the system overrides them post-write to ensure correctness
- \`created:\` is preserved on merge (older value kept); \`updated:\` is always set to the current date
- \`source_note:\` (optional) — wiki-link to the original source file

## Mentions Format
"Mentions in Source" entries use academic-footnote style with source attribution. The format is:
- "Verbatim quote in original language (optional translation)" — [[source-name|display-name]]

Rules:
- Quotes must be VERBATIM — never paraphrase, summarize, or translate away the original
- The source wiki-link is required so future page merges can trace each quote to its origin
- Multiple quotes from the same source go in the same block, separated by newlines

## Content Rules
Rules every page follows when it is written or rewritten. Add your own lines here;
the entries above are the plugin's defaults.
- mentions_in_source MUST be VERBATIM quotes — never paraphrase or translate
- Summaries/descriptions should use the wiki output language
- Entity/concept names must match the source file's original language exactly
- All pages must include bidirectional links where relevant

## Extraction Focus
Narrow which subjects become pages. Name the topics you want recognised; subjects
outside this list are less likely to be extracted. This changes what is found in your
sources, not how pages are written. Empty means extract everything a source supports.

## Classification Rules
- **type field:** entity | concept | source — the page category
- **tags field:** stores the subtype (entity_type or concept_type)
- Entity subtypes / Concept subtypes: see the **Active Tag Vocabulary** section injected into every system prompt (driven by Settings). The valid values are NOT listed here — relying on a baked list in this file would drift from your Settings whenever you change the vocabulary.
- Source types: document, conversation, note
- **Rule:** tags MUST only contain values from the Active Tag Vocabulary in the system prompt. A tag not in that list will be removed by the system.

## Multi-Source Merge Rules
- Sources array: Append new sources, never overwrite
- Aliases: Append alternative names (translations, abbreviations) without overwriting existing ones
- reviewed flag: If true, preserve all existing content, only append genuinely new info
- Contradictions: Preserve both sides with attribution, add to ## Contradictions section
- NO_NEW_CONTENT: Return this signal if source adds nothing new

## Maintenance Policies
- Stale threshold: 90 days without updates
- Contradiction severity: warning, conflict, error
- Orphan page: no inbound links from other wiki pages
- Missing page: referenced by [[link]] but does not exist
`;
}

export class SchemaManager {
  private app: App;
  private settings: LLMWikiSettings;
  private getLLMClient: () => LLMClient | null;
  private cachedBody: string | null = null;
  private cacheValid = false;
  /** The mtime the cached body was read at. Issue #317. */
  private cachedMtime: number | null = null;

  constructor(
    app: App,
    settings: LLMWikiSettings,
    getLLMClient: () => LLMClient | null
  ) {
    this.app = app;
    this.settings = settings;
    this.getLLMClient = getLLMClient;
  }

  private get client() {
    const c = this.getLLMClient();
    if (!c) throw new Error('LLM Client not initialized');
    return c;
  }

  private getSchemaPath(): string {
    return `${this.settings.wikiFolder}/${SCHEMA_FILENAME}`;
  }

  private getSuggestionsPath(): string {
    return `${this.settings.wikiFolder}/${SUGGESTIONS_FILENAME}`;
  }

  invalidateCache(): void {
    this.cacheValid = false;
    this.cachedBody = null;
    this.cachedMtime = null;
  }

  updateSettings(settings: LLMWikiSettings): void {
    this.settings = settings;
    this.invalidateCache();
  }

  async getSchemaContext(task: SchemaTask = 'full'): Promise<string> {

    const schema = await this.loadSchema();
    if (!schema || !schema.body.trim()) return '';

    const body = schema.body.trim();
    const selectedBody = this.selectSections(body, task);

    if (!selectedBody.trim()) return '';

    return `You are operating with the following Wiki Schema configuration.
Follow these rules when creating, updating, or analyzing Wiki pages.

--- BEGIN SCHEMA ---
${selectedBody}
--- END SCHEMA ---`;
  }

  private selectSections(body: string, task: SchemaTask): string {
    if (task === 'full') return body;

    const wanted = TASK_SECTIONS[task];
    const sections = this.parseSections(body);

    const selected = sections.filter(s => wanted.includes(s.heading));
    return selected.map(s => `## ${s.heading}\n${s.content}`).join('\n\n');
  }

  private parseSections(body: string): Array<{ heading: string; content: string }> {
    const result: Array<{ heading: string; content: string }> = [];
    const lines = body.split('\n');
    let currentHeading = '';
    let currentContent: string[] = [];

    for (const line of lines) {
      if (line.startsWith('## ')) {
        if (currentHeading) {
          result.push({ heading: currentHeading, content: currentContent.join('\n').trim() });
        }
        currentHeading = line.substring(3).trim();
        currentContent = [];
      } else if (currentHeading) {
        currentContent.push(line);
      }
    }
    if (currentHeading) {
      result.push({ heading: currentHeading, content: currentContent.join('\n').trim() });
    }

    return result;
  }

  /**
   * Read one `## Heading` section from the schema file, as the user wrote it.
   *
   * **This reads the raw file, not `loadSchema()`.** `loadSchema` sanitizes the
   * body before the LLM sees it (`stripLegacyBakedTagEnum`), which is right for
   * a prompt and wrong for an editor: a textarea seeded from the sanitized text
   * would silently delete a legacy baked enum the moment the user saved.
   */
  async readSection(heading: string): Promise<string> {
    const file = this.app.vault.getAbstractFileByPath(this.getSchemaPath());
    if (!(file instanceof TFile)) return '';
    let raw: string;
    try {
      raw = await this.app.vault.read(file);
    } catch {
      return '';
    }
    return extractSectionBody(raw, heading);
  }

  /**
   * Replace one `## Heading` section's body, leaving every other byte alone.
   *
   * The whole file is rewritten through `vault.process`, which is atomic, so a
   * concurrent edit elsewhere in the file is not clobbered by a stale read.
   * A heading that does not exist yet is appended, which is what lets an older
   * vault gain `## Extraction Focus` without a migration.
   */
  async writeSection(heading: string, content: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(this.getSchemaPath());
    if (!(file instanceof TFile)) return;
    await this.app.vault.process(file, (current) => replaceSectionBody(current, heading, content));
    this.invalidateCache();
  }

  async loadSchema(): Promise<WikiSchema | null> {
    const path = this.getSchemaPath();
    const file = this.app.vault.getAbstractFileByPath(path);

    if (!(file instanceof TFile)) return null;

    // Issue #317: the cache is keyed on the file's mtime, not on time. It used
    // to be invalidated from exactly one place — the plugin's own "apply
    // suggestion" flow — so a user who edited `schema/config.md` in the
    // Obsidian editor saw the old body until Obsidian was restarted. Keying
    // on the mtime needs no event wiring, and it also catches an edit made
    // outside Obsidian: a sync, a file drop, a git checkout.
    const mtime = file.stat.mtime;
    if (this.cacheValid && this.cachedBody !== null && this.cachedMtime === mtime) {
      return { version: 0, updated: '', auto_suggestion_count: 0, body: this.cachedBody };
    }

    try {
      const content = await this.app.vault.read(file);
      const parsed = this.parseConfigFile(content);
      // Issue #328 Phase 1: vault-resident schema files created under
      // v1.22.0-v1.25.1 may still carry a baked tag enum at 6 sites
      // (Wiki Structure × 2, Entity Page Template × 1, Concept Page
      // Template × 1, Classification Rules × 2). The on-disk file is the
      // user's data — we never rewrite it. Instead we sanitize the body
      // that the LLM sees in this cache layer so the runtime injection is
      // the SOLE tag vocabulary the model encounters.
      const sanitizedBody = stripLegacyBakedTagEnum(parsed.body);
      this.cachedBody = sanitizedBody;
      this.cachedMtime = mtime;
      this.cacheValid = true;

      return { ...parsed, body: sanitizedBody };
    } catch {
      console.warn('Failed to read schema file, ignoring');
      return null;
    }
  }

  async ensureSchemaExists(): Promise<void> {

    const path = this.getSchemaPath();
    const existing = this.app.vault.getAbstractFileByPath(path);

    if (existing instanceof TFile) return;

    // Ensure schema folder exists
    const schemaFolder = `${this.settings.wikiFolder}/schema`;
    try {
      await this.app.vault.createFolder(schemaFolder);
    } catch {
      // Already exists
    }

    const today = localDateStamp();
    const body = buildDefaultSchemaBody(this.settings);
    const content = `---
version: 1
updated: ${today}
auto_suggestion_count: 0
---

${body}`;

    await this.app.vault.create(path, content);
    this.cachedBody = body;
    this.cacheValid = true;

    console.debug('Created default schema at:', path);
  }

  async regenerateDefaultSchema(): Promise<void> {
    const path = this.getSchemaPath();
    const today = localDateStamp();
    const body = buildDefaultSchemaBody(this.settings);
    const content = `---
version: 1
updated: ${today}
auto_suggestion_count: 0
---

${body}`;

    // Ensure parent folders exist (handles empty vault or custom wikiFolder)
    const schemaFolder = `${this.settings.wikiFolder}/schema`;
    try {
      await this.app.vault.createFolder(schemaFolder);
    } catch {
      // Already exists or path invalid
    }

    const existing = this.app.vault.getAbstractFileByPath(path);

    if (existing instanceof TFile) {
      await this.app.vault.process(existing, () => content);
    } else {
      await this.app.vault.create(path, content);
    }

    this.cachedBody = body;
    this.cacheValid = true;

    console.debug('Regenerated default schema at:', path);
  }

  async suggestSchemaUpdate(context: string): Promise<SchemaSuggestion | null> {
    const schema = await this.loadSchema();
    const schemaContent = schema?.body || '(No schema configured yet)';

    // v1.22.0 #97: inject the user's UI language so the LLM writes the
    // "suggestions" field in the user's preferred language. WIKI_LANGUAGES
    // is the source of truth — it covers all 10 locales (en, zh, ja, ko,
    // de, fr, es, pt, it, zh-Hant) and returns the language's native name
    // (e.g. "中文" for zh, "繁體中文" for zh-Hant). Falling back to
    // 'English' keeps v1.21.x behaviour for unrecognised language codes.
    const userLanguage = WIKI_LANGUAGES[this.settings.language] ?? 'English';

    const prompt = renderTemplate(PROMPTS.suggestSchemaUpdate, {
      schema_content: schemaContent,
      analysis_context: context,
      user_language: userLanguage,
    });

    try {
      const suggestArgs = {
        task: 'schema-suggest' as const,
        model: resolveModelForTask(this.settings, 'ingest'),
        max_tokens: capMaxTokens(TOKENS_SCHEMA_SUGGESTION, this.settings),
        messages: [{ role: 'user' as const, content: prompt }],
        // v1.26.3 PATCH Issue #443 expanded scope: typed-output path.
        // Uses SchemaSuggestionLLMSchema ({changes_needed?, new_schema_body?,
        // suggestions?}) on the wire as Tier 0 json_schema. parseSchemaSuggestion
        // still applies frontmatter-stripping + body extraction post-parse.
        response_format: { type: 'json_object' as const, schema: SchemaSuggestionLLMSchema },
        // v1.22.0 #97: pass the full LLMClient interface — enableThinking
        // (user-controlled, NEVER hardcoded), maxTokensPerCall (truncation
        // retry), and temperature (custom sampling, per user settings).
        // These fields are ALL optional on LLMClient.createMessage; the
        // client wrapper decides whether to send them to the provider.
        ...(this.settings.disableThinking ? { enableThinking: false } : {}),
        maxTokensPerCall: this.settings.maxTokensPerCall || undefined,
        temperature: this.settings.extractionTemperature,
      };
      const response = await callLlm(this.client, suggestArgs);

      // v1.22.0 #97: use the dedicated parser to extract new_schema_body
      // (frontmatter-stripped, ready to splice). Legacy v1.21.x responses
      // without new_schema_body still parse correctly.
      const parsed = parseSchemaSuggestion(response);

      const suggestion: SchemaSuggestion = {
        timestamp: new Date().toISOString(),
        source: 'manual',
        changes_needed: parsed.changes_needed,
        suggestions: parsed.suggestions,
        newSchemaBody: parsed.newSchemaBody,
      };

      // Append to suggestions.md
      await this.appendSuggestion(suggestion);

      return suggestion;
    } catch (error) {
      console.error('Schema suggestion failed:', error);
      return null;
    }
  }

  private parseConfigFile(content: string): WikiSchema {
    let version = 0;
    let updated = '';
    let auto_suggestion_count = 0;
    let body = content;

    // Parse YAML frontmatter (between first two --- lines)
    if (content.startsWith('---')) {
      const end = content.indexOf('---', 3);
      if (end > 0) {
        const fmLines = content.substring(3, end).trim().split('\n');
        for (const line of fmLines) {
          const colon = line.indexOf(':');
          if (colon > 0) {
            const key = line.substring(0, colon).trim();
            const value = line.substring(colon + 1).trim();

            if (key === 'version') {
              version = parseInt(value) || 0;
            } else if (key === 'updated') {
              updated = value;
            } else if (key === 'auto_suggestion_count') {
              auto_suggestion_count = parseInt(value) || 0;
            }
          }
        }
        body = content.substring(end + 3).trim();
      }
    }

    return { version, updated, auto_suggestion_count, body };
  }

  private async appendSuggestion(suggestion: SchemaSuggestion): Promise<void> {
    const path = this.getSuggestionsPath();
    const existing = this.app.vault.getAbstractFileByPath(path);

    const entry = `## Suggestion — ${suggestion.timestamp}

**Source:** ${suggestion.source}
**Changes needed:** ${suggestion.changes_needed ? 'Yes' : 'No'}

${suggestion.suggestions}

---
`;

    if (existing instanceof TFile) {
      await this.app.vault.process(existing, (current) => current + '\n' + entry);
    } else {
      const header = `# Schema Suggestions\n\n> Suggestions for improving your Wiki Schema. Review and decide whether to apply them to \`schema/config.md\`.\n\n---\n\n`;
      await this.app.vault.create(path, header + entry);
    }
  }
}
