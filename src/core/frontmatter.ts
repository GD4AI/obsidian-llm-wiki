import { VALID_ENTITY_TAGS, VALID_CONCEPT_TAGS, VALID_SOURCE_TAGS, LLMWikiSettings } from '../types';
import { getActiveEntityTags, getActiveConceptTags, getActiveSourceTags } from './tag-vocab';
import { filterRedundantAliases, resolveMinAliasLength } from './slug';
import { localDateStamp } from './format';
import { unionDomains, fold } from './domain-axis';

export interface FrontmatterData {
  reviewed?: boolean;
  type?: string;
  created?: string;
  updated?: string;
  sources?: string[];
  tags?: string[];
  aliases?: string[];
  [key: string]: unknown;
}

export function parseFrontmatter(content: string): FrontmatterData | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const result: FrontmatterData = {};
  const fmText = match[1];
  const lines = fmText.split('\n');
  let currentKey: string | null = null;
  let arrayValues: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      if (currentKey && arrayValues.length > 0) {
        result[currentKey] = arrayValues;
        arrayValues = [];
        currentKey = null;
      }
      continue;
    }

    if (trimmed.startsWith('- ') && currentKey) {
      const value = trimmed.substring(2).trim();
      arrayValues.push(value.replace(/^["']|["']$/g, ''));
      continue;
    }

    if (currentKey && arrayValues.length > 0 && !trimmed.startsWith('- ')) {
      result[currentKey] = arrayValues;
      arrayValues = [];
      currentKey = null;
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.substring(0, colonIdx).trim();
    const value = line.substring(colonIdx + 1).trim();

    const nextLine = lines[i + 1]?.trim();
    if (nextLine && nextLine.startsWith('- ')) {
      currentKey = key;
      arrayValues = [];
      continue;
    }

    if (key === 'reviewed') {
      result.reviewed = value === 'true';
    } else if (key === 'type') {
      result.type = value;
    } else if (key === 'created') {
      result.created = value;
    } else if (key === 'updated') {
      result.updated = value;
    } else if (value.startsWith('[') && value.endsWith(']')) {
      try {
        result[key] = value
          .slice(1, -1)
          .split(',')
          .map(v => v.trim().replace(/^["']|["']$/g, ''))
          .filter(v => v);
      } catch {
        result[key] = value;
      }
    } else {
      result[key] = value.replace(/^["']|["']$/g, '');
    }
  }

  if (currentKey && arrayValues.length > 0) {
    result[currentKey] = arrayValues;
  }

  const ARRAY_FIELDS = ['aliases', 'sources', 'tags'];
  for (const field of ARRAY_FIELDS) {
    const val = result[field];
    if (typeof val === 'string') {
      // A bare `tags:` key (the emitEmptyTags shape) reads as the empty
      // string; coercing it to [''] handed every downstream array writer a
      // phantom entry that yamlStringify then persisted as `- ""`.
      result[field] = val.trim() ? [val] : [];
    } else if (Array.isArray(val)) {
      result[field] = (val as unknown[]).filter(
        v => !(typeof v === 'string' && v.trim() === '')
      );
    } else {
      delete result[field];
    }
  }

  return result;
}

/**
 * The origin notes a `sources/` page was built from, normalized to vault
 * paths.
 *
 * Two fields can name them and they are not interchangeable. The scalar
 * `source_file:` is the canonical owner, stamped from the note path by
 * `createSummaryPage` (#679). The `sources:` list records the multi-source
 * merge: the other ingests that later extended this page. It holds `[[sources/X]]`
 * wikilinks by contract — the Issue #81 normalizer removes or remaps any
 * external `[[Notizen/X.md]]` entry that lands there — so a note path
 * found in it is the exception, not the rule. Read the scalar first and
 * fall back to the list, which is the resolution `scanSourceDrift` (#577)
 * already uses.
 *
 * Returns an empty array when neither field is present: a page with no
 * recorded origin proves nothing about ownership, and callers must decide
 * for themselves what absence means.
 */
export function originNoteRefs(fm: FrontmatterData): string[] {
  const raw: string[] = [];
  const sourceFile = fm.source_file;
  if (typeof sourceFile === 'string') raw.push(sourceFile);
  if (Array.isArray(fm.sources)) raw.push(...fm.sources.map(s => String(s)));

  return raw
    .map(entry => {
      const trimmed = entry.trim();
      return trimmed.startsWith('[[') && trimmed.endsWith(']]')
        ? trimmed.slice(2, -2).trim()
        : trimmed;
    })
    .filter(entry => entry.length > 0);
}

/** Serialize value to YAML format for frontmatter */
function yamlStringify(value: unknown): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return '\n' + value.map(v => `  - "${v}"`).join('\n');
  }
  if (typeof value === 'string') {
    if (/[":[\]{}\n]/.test(value)) {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value;
  }
  if (typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (value === null || value === undefined) {
    return '';
  }
  return '';
}

export function extractBody(content: string): string {
  if (!content.startsWith('---')) return content;
  const endIdx = content.indexOf('\n---', 3);
  if (endIdx === -1) return content;
  return content.substring(endIdx + 4).trim();
}

/**
 * True when a source file has no extractable body — empty, whitespace-only, or
 * frontmatter-only (e.g. a tags-only stub). Used to gate ingestion before any
 * LLM call: small/local models hallucinate entities from a blank prompt (#164).
 */
export function isBlankSource(content: string): boolean {
  return extractBody(content).trim().length === 0;
}

/**
 * Add or replace a single `key: value` line in a document's frontmatter block,
 * returning the updated content. Used to programmatically stamp fields the LLM
 * can't be trusted to emit (e.g. the #164 content hash). If the document has no
 * frontmatter, a new block is prepended. The value is written verbatim, so the
 * caller is responsible for YAML safety.
 */
export function upsertFrontmatterField(content: string, key: string, value: string): string {
  const line = `${key}: ${value}`;
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const keyRe = new RegExp(`^${escapedKey}:.*$`, 'm');

  if (content.startsWith('---')) {
    const endIdx = content.indexOf('\n---', 3);
    if (endIdx !== -1) {
      const fmBlock = content.substring(0, endIdx); // '---\n<fields>'
      const rest = content.substring(endIdx);       // '\n---<body>'
      if (keyRe.test(fmBlock)) {
        return fmBlock.replace(keyRe, line) + rest;
      }
      return `${fmBlock}\n${line}${rest}`;
    }
  }

  // No frontmatter — prepend a fresh block.
  return `---\n${line}\n---\n\n${content}`;
}

/**
 * v1.25.10 PATCH Issue #356 — extract lines of frontmatter that belong to
 * fields our canonical writer does NOT know about (e.g. user-authored
 * `redirect_to:`, `parent_org:`, `source_url:`). These are passed verbatim
 * to `serializeFrontmatter(..., { passthroughLines })` so that re-touching a
 * page never strips fields the plugin does not own.
 *
 * The line-level extraction is deliberately conservative: we walk the raw
 * frontmatter text (already bracketed by `---\n...\n---`) and keep any line
 * (and any indented continuation lines belonging to a list/sequence under
 * the unknown key) whose top-level key is not in the known set.
 *
 * Pure function, no IO. Suitable for unit testing.
 */
/**
 * Canonical frontmatter keys — single source of truth shared by
 * `extractPassthroughLines`, the `replaceOrInsertYamlListField`
 * helper, and any plugin code that needs to recognise a
 * "known vs unknown" field. Adding a new canonical key here
 * automatically excludes it from passthrough on every re-touch
 * and from splice ambiguity in append-style helpers.
 *
 * Field name list intentionally mirrors the keys emitted by
 * `serializeFrontmatter` below — drift would silently break the
 * passthrough invariant (Issue #356) if a new field is added
 * in only one of the two places.
 */
export const CANONICAL_FRONTMATTER_KEYS = new Set([
  'type', 'created', 'updated', 'sources', 'tags', 'reviewed', 'aliases',
]);

/**
 * Read the existing frontmatter block from `content` and extract the
 * passthrough lines (everything not in `CANONICAL_FRONTMATTER_KEYS`).
 * Returns `[]` when no frontmatter or no unknown fields exist.
 *
 * The early-out at `unknownKeysHint` lets us skip the per-line walk in
 * the common case (no unknown fields exist) — `extractPassthroughLines`
 * is on the page-write hot path; that path is dominated by pages whose
 * frontmatter has zero unknown fields.
 *
 * @param content Full file content (may start with `---` or not).
 */
export function extractPassthroughLines(content: string): string[] {
  if (!content.startsWith('---')) return [];
  const endIdx = content.indexOf('\n---', 3);
  if (endIdx === -1) return [];

  // fmBody = the lines between the two `---` delimiters, no trailing newline
  const fmBody = content.substring(3, endIdx).replace(/^\n/, '');
  const rawLines = fmBody.split('\n');

  const passthrough: string[] = [];
  let capturing = false;
  for (const line of rawLines) {
    if (line === '') continue;
    const isTopLevel = !/^[ \t]/.test(line);
    if (isTopLevel) {
      // Top-level line — does its key belong to the known set?
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:/);
      const key = m ? m[1] : '';
      capturing = !!(key && !CANONICAL_FRONTMATTER_KEYS.has(key));
      // Edge case: if the line continues on the same line (e.g.
      // `redirect_to: "[[X]]"`), the whole single line is the passthrough.
      if (capturing) passthrough.push(line);
      continue;
    }
    // Indented continuation line — kept only if we are currently capturing
    // a top-level unknown key (its YAML block sub-items).
    if (capturing) passthrough.push(line);
  }
  return passthrough;
}

/**
 * Replace an existing YAML block-list field (`aliases:` /
 * `sources:` / `tags:` / etc.) with the supplied `items`, or insert a
 * fresh block before the closing `---` when the field is absent.
 *
 * Shared helper for every plugin-side frontmatter list writer
 * (`appendAliases`, `appendContradictedByMarker`, ...). Centralizing
 * the splice arithmetic eliminates the copy-paste that the
 * `appendAliases` and `appendContradictedByMarker` helpers used to
 * share. The block shape mirrors what the canonical serializer
 * emits, so re-parsing after a write yields the same field shape.
 *
 * @param frontmatter Full frontmatter block, beginning with `---\n`.
 *                    Returns it unchanged when no `---` delimiter pair
 *                    is present.
 * @param field       Top-level key name (e.g. `aliases`,
 *                    `contradictions`).
 * @param items       List of items — already deduplicated by the caller
 *                    if dedup is desired.
 */
export function replaceOrInsertYamlListField(
  frontmatter: string,
  field: string,
  items: readonly string[],
): string {
  if (!frontmatter.startsWith('---')) return frontmatter;
  const fmStart = 3;
  const fmEnd = frontmatter.indexOf('\n---', fmStart);
  if (fmEnd === -1) return frontmatter;
  const fmBody = frontmatter.substring(fmStart, fmEnd);
  const block = `${field}:\n${items
    .map(s => `  - "${s.replace(/"/g, '\\"')}"`)
    .join('\n')}`;

  const listRe = new RegExp(`^${field}:[^\\n]*(?:\\n[ \\t]+[^\\n]*)*`, 'm');
  const newFmBody = listRe.test(fmBody)
    ? fmBody.replace(listRe, block)
    : `${fmBody.trimEnd()}\n${block}`;

  // Rebuild the file content outside the frontmatter block; preserve
  // the trailing newline pattern of the input.
  const tail = frontmatter.substring(fmEnd);
  return `---${newFmBody}\n${tail}`;
}

/**
 * v1.24.0: parse-aware merge helper for array-valued frontmatter fields
 * (`aliases`, `tags`, `sources`, ...). Unlike `upsertFrontmatterField` which
 * string-splices the value (and can produce duplicate `aliases:` lines if
 * the key already exists), this function:
 *
 *   1. parses the existing frontmatter via `parseFrontmatter`
 *   2. merges new items into the existing array, deduped (preserving order)
 *   3. re-serializes via `serializeFrontmatter` (canonical field order + shape)
 *   4. preserves all other frontmatter fields verbatim
 *
 * Handles every frontmatter style:
 *   - `aliases: [a, b]`  (inline)
 *   - `aliases:\n  - a\n  - b`  (block)
 *   - `aliases: []` (empty placeholder — treated as "appending")
 *   - field entirely missing — appended
 *
 * If the page has no frontmatter, prepends a fresh `---\n---\n` block.
 * Returns the original content unchanged when the merge would be a no-op.
 */
export function mergeFrontmatterArrayField(
  content: string,
  field: string,
  newItems: readonly string[],
): string {
  if (newItems.length === 0) return content;

  const fm = parseFrontmatter(content);
  const existingRaw: unknown = fm?.[field];
  const existing: string[] = Array.isArray(existingRaw) ? (existingRaw as string[]) : [];

  // Dedup new items against existing; preserve original order.
  const existingSet = new Set(existing);
  const additions: string[] = [];
  for (const item of newItems) {
    if (!existingSet.has(item)) {
      additions.push(item);
      existingSet.add(item);
    }
  }
  if (additions.length === 0) return content;
  const merged = [...existing, ...additions];

  // Build a fresh frontmatter block via the canonical writer.
  // Merge keeps everything we knew about, plus the new array.
  // v1.25.10 PATCH Issue #356: pass through unknown top-level fields
  // (`redirect_to:`, `parent_org:`, user-authored metadata) so re-touching
  // a page never silently strips them.
  const passthroughLines = extractPassthroughLines(content);
  const next: FrontmatterData = {
    ...(fm ?? {}),
    [field]: merged,
  };
  const fmBlock = serializeFrontmatter(next, { passthroughLines });

  // Splice the new block in place of the existing frontmatter.
  if (content.startsWith('---')) {
    const endIdx = content.indexOf('\n---', 3);
    if (endIdx !== -1) {
      const body = content.substring(endIdx + 4); // '\n---<body>' → skip '---'
      return `${fmBlock}\n${body}`;
    }
  }

  // No existing frontmatter — prepend a fresh block.
  return `${fmBlock}\n\n${content}`;
}

/**
 * v1.24.0: replace (overwrite) the array-valued frontmatter field with
 * a brand-new array. Unlike `mergeFrontmatterArrayField` which appends,
 * this is the "full replacement" semantic used by `runRetagViolations`:
 * the LLM returns the full new tag set (already filtered to vocab),
 * and we replace whatever was on disk.
 *
 * Same handling for inline/block/missing/empty cases as the merge helper.
 */
export function replaceFrontmatterArrayField(
  content: string,
  field: string,
  newItems: readonly string[],
): string {
  const fm = parseFrontmatter(content);

  // Build a fresh frontmatter block. Keep everything we knew, drop the
  // array field (we'll re-emit it with new items).
  // v1.25.10 PATCH Issue #356: same passthrough semantics as the merge helper.
  const passthroughLines = extractPassthroughLines(content);
  const next: FrontmatterData = { ...(fm ?? {}) };
  if (newItems.length === 0) {
    delete next[field];
  } else {
    next[field] = [...newItems];
  }
  const fmBlock = serializeFrontmatter(next, { passthroughLines });

  if (content.startsWith('---')) {
    const endIdx = content.indexOf('\n---', 3);
    if (endIdx !== -1) {
      // Normalize the seam instead of carrying it over. `fmBlock` ends on
      // `---` with no trailing newline and the slice begins with whatever
      // followed the old closing delimiter, so pasting the two together with
      // a `\n` grew the gap by one blank line on every call. One blank line
      // is the shape `enforceFrontmatterConstraints` and the branch below
      // already produce, which also makes this idempotent.
      const body = content.substring(endIdx + 4).replace(/^\n+/, '');
      return `${fmBlock}\n\n${body}`;
    }
  }
  return `${fmBlock}\n\n${content}`;
}

export interface SerializeFrontmatterOptions {
  /**
   * Verbatim frontmatter lines for non-canonical fields (e.g. a future
   * `supersedes:` flag), emitted after `updated:` and before `sources:`.
   * Callers that intentionally drop unknown fields pass none; callers that
   * preserve them (enforceFrontmatterConstraints) pass their collected lines.
   */
  passthroughLines?: string[];
  /** `'block'` → `tags:\n  - x`; `'inline'` → `tags: [x, y]`. Default `'block'`. */
  tagStyle?: 'inline' | 'block';
  /** When there are no tags, emit a bare `tags:` line instead of omitting the field. */
  emitEmptyTags?: boolean;
}

/**
 * Canonical v6 frontmatter serializer — the single source of truth for the
 * field ORDER and YAML SHAPE of type/created/updated/sources/tags/reviewed/aliases.
 * mergeFrontmatter, enforceFrontmatterConstraints, and mergeDuplicatePages all
 * delegate here, so a new field (or a fix) is added in exactly one place rather
 * than three divergent hand-rolled writers. Returns the frontmatter block only
 * (`---\n…\n---`), without the body; the caller joins body as needed.
 *
 * The tag STYLE is parameterized rather than unified: `fix-runners.ts` rewrites
 * tags with an inline-only regex, so enforce must keep emitting inline tags while
 * merge keeps block tags. Only the duplicated ordering/serialization logic is
 * consolidated; observable output is unchanged.
 */
export function serializeFrontmatter(
  fm: FrontmatterData,
  opts: SerializeFrontmatterOptions = {}
): string {
  const { passthroughLines = [], tagStyle = 'block', emitEmptyTags = false } = opts;
  const lines: string[] = ['---'];

  if (fm.type) lines.push(`type: ${fm.type}`);
  if (fm.created) lines.push(`created: ${fm.created}`);
  if (fm.updated) lines.push(`updated: ${fm.updated}`);

  for (const line of passthroughLines) lines.push(line);

  if (Array.isArray(fm.sources) && fm.sources.length > 0) {
    lines.push(`sources:${yamlStringify(fm.sources)}`);
  }

  if (Array.isArray(fm.tags) && fm.tags.length > 0) {
    lines.push(tagStyle === 'inline'
      ? `tags: [${fm.tags.join(', ')}]`
      : `tags:${yamlStringify(fm.tags)}`);
  } else if (emitEmptyTags) {
    lines.push('tags:');
  }

  // domain axis stage 2 (#568): block style only — the domain values are
  // nested (`Gruppe/Wert`) and the inline-tag regex in fix-runners never reads them.

  if (fm.reviewed) lines.push('reviewed: true');

  if (Array.isArray(fm.aliases)) {
    // Dedup: keep first occurrence, drop empties (parity across all writers).
    const dedupedAliases = fm.aliases.filter((v, i, a) => a.indexOf(v) === i && v);
    if (dedupedAliases.length > 0) {
      lines.push(`aliases:${yamlStringify(dedupedAliases)}`);
    }
  }

  lines.push('---');
  return lines.join('\n');
}

export function mergeFrontmatter(
  existingContent: string,
  newSourcePath: string,
  incomingTags?: string[],
  /** domain axis stage 3 (#568): the incoming page's domain subset, unioned after the existing values. */
  incomingDomains?: readonly string[],
): { frontmatter: string; body: string; wasMerged: boolean } {
  const fm = parseFrontmatter(existingContent);
  const body = extractBody(existingContent);

  if (!fm) {
    return {
      frontmatter: '',
      body: existingContent,
      wasMerged: false
    };
  }

  const normalizeSourcePath = (s: string): string => {
    const trimmed = s.trim();
    if (trimmed.startsWith('[[') && trimmed.endsWith(']]')) {
      return trimmed.slice(2, -2).trim();
    }
    return trimmed;
  };
  const existingSources = Array.isArray(fm.sources) ? fm.sources : [];
  const sourceSet = new Set<string>();
  for (const s of existingSources) {
    // Skip empty entries: a bare `sources:` line parses to [''], which would
    // otherwise emit a stray `[[]]` link that the #125 normalizer has to clean
    // up downstream. (Originally found on the create path; since v1.26.0 that
    // path uses upstream's `appendSourceSlugToFrontmatter`, so merge-page.ts is
    // the remaining caller that can see a model-written bare `sources:`.)
    const n = normalizeSourcePath(String(s));
    if (n) sourceSet.add(n);
  }
  if (newSourcePath) sourceSet.add(newSourcePath);
  const mergedSources = Array.from(sourceSet).map(s => `[[${s}]]`);

  const created = fm.created || localDateStamp();
  const updated = localDateStamp();

  // Stage 4 (#568): one field — the validated belonging values merge into
  // `tags:` next to the identity value. A user-authored `domains:` field, like
  // any unknown key, rides the #356 passthrough untouched.
  const mergedTagsIncoming = [...(incomingTags ?? []), ...(incomingDomains ?? [])];

  // Always emit a `tags:` line (bare when empty) to preserve prior behavior.
  // Issue #356 follow-up: also pass through unknown top-level fields
  // (`redirect_to:`, `parent_org:`, user-authored metadata) so the full-page
  // rewrite path through `mergePage` (which re-serializes the frontmatter
  // from this helper's output) preserves user-owned keys the same way the
  // array-only helpers do. Without this, re-ingest on an existing entity
  // rewrites the frontmatter block and strips every custom field.
  const passthroughLines = extractPassthroughLines(existingContent);
  const frontmatter = serializeFrontmatter(
    {
      type: fm.type,
      created,
      updated,
      sources: mergedSources,
      // Fold-keyed union (Stufe 4): the belonging values were folded by the
      // validator, so the merge must compare the same way — raw equality
      // re-admitted case variants (the `#569` review class, B1–B3).
      tags: unionDomains(Array.isArray(fm.tags) ? fm.tags : undefined, mergedTagsIncoming),
      reviewed: fm.reviewed,
      aliases: Array.isArray(fm.aliases) ? fm.aliases : undefined,
    },
    { tagStyle: 'block', emitEmptyTags: true, passthroughLines }
  );

  return { frontmatter, body, wasMerged: true };
}

export function preserveFrontmatterReviewTag(originalContent: string, newContent: string): string {
  const origFm = parseFrontmatter(originalContent);
  if (!origFm?.reviewed) return newContent;

  if (newContent.startsWith('---')) {
    const endIdx = newContent.indexOf('\n---', 3);
    if (endIdx !== -1 && !newContent.substring(0, endIdx).includes('reviewed:')) {
      return newContent.substring(0, endIdx) + '\nreviewed: true' + newContent.substring(endIdx);
    }
  }
  return newContent;
}

/**
 * Issue #388: the creation date the caller knows to be real, read from the
 * file that already exists on disk. `created:` is documented as programmatic
 * and NEVER LLM-generated (`schema-manager.ts:190`), but this function cannot
 * see where its input string came from — on the page-creation and empty-page-
 * fill paths that string is the model's own reply, so a `created:` value
 * found in it is the model's invention, not history.
 *
 * The rule is therefore: the prior value arrives as an argument or not at all.
 * A caller that has no prior file (page creation) passes nothing and gets
 * today; a caller that does (fill, merge) passes what it read.
 */
export interface FrontmatterDateOptions {
  /** `YYYY-MM-DD` from the existing file. Anything else is ignored. */
  preserveCreated?: string;
}

export interface EnforceFrontmatterOptions extends FrontmatterDateOptions {
  /**
   * Vault path of the page the block is being written to. When given, an
   * alias that only repeats the page's own basename (case-insensitive) is
   * dropped — the same rule `appendAliases` applies via
   * `filterRedundantAliases`, so both writers of `aliases:` agree. The
   * generation paths hand this function the model's reply, and the model
   * routinely lists the page name among the aliases. Omitted by callers
   * that do not know the path; nothing changes for them.
   */
  pagePath?: string;
  /**
   * The active domain vocabulary (source-folder harvest ∪ wiki nested tags).
   * When given, ANY tag the vocabulary does not carry is STRIPPED instead of
   * retained — the retain path let values the validator had rejected survive
   * onto pages (P2: `Thema/Kardiologie`; P4: 4 cases), and with the wiki
   * harvest feeding the vocabulary such a leak would legitimize itself on the
   * next collection. Flat tags briefly kept the retain semantics as an
   * abstention fallback; measured against a live vault that fallback is not
   * an abstention marker but the training taxonomy leaking through
   * (`theory`/`method`/`term` on 52 of 128 pages, one page carrying two), so
   * flat tags now face the same test — a flat value the declared folders
   * actually carry stays offerable and stays on the page.
   * Omitted by callers outside the domain axis; nothing changes for them.
   */
  domainVocabulary?: readonly string[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function resolveCreated(options: FrontmatterDateOptions | undefined, today: string): string {
  const candidate = options?.preserveCreated?.trim();
  return candidate && ISO_DATE.test(candidate) ? candidate : today;
}

export function enforceFrontmatterConstraints(
  content: string,
  pageType: 'entity' | 'concept' | 'source',
  settings?: LLMWikiSettings,
  options?: EnforceFrontmatterOptions
): string {
  if (!content.startsWith('---')) return content;

  const fmEnd = content.indexOf('\n---\n', 3);
  if (fmEnd === -1) return content;

  const fmText = content.substring(3, fmEnd);

  if (/^reviewed:\s*true\s*$/m.test(fmText)) {
    const today = localDateStamp();
    const created = resolveCreated(options, today);
    return content
      .replace(/^created:\s*\d{4}-\d{2}-\d{2}\s*$/m, `created: ${created}`)
      .replace(/^updated:\s*\d{4}-\d{2}-\d{2}\s*$/m, `updated: ${today}`);
  }

  let body = content.substring(fmEnd + 5);
  const today = localDateStamp();

  const lines = fmText.split('\n');
  let collectedTags: string[] = [];
  let foundType = false;
  let foundTags = false;
  let foundAliases = false;
  let collectedAliases: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('created:')) {
      // Dropped on purpose — see FrontmatterDateOptions. Whatever stands here
      // is only as trustworthy as the string this function was handed, and on
      // the generation paths that string is the model's reply.
      continue;
    }
    if (line.startsWith('updated:')) {
      continue;
    }

    if (line.startsWith('type:')) {
      foundType = true;
      const currentType = line.substring(5).trim();
      if ((pageType === 'entity' || pageType === 'concept') && currentType && currentType !== 'entity' && currentType !== 'concept' && currentType !== pageType) {
        collectedTags.push(currentType);
      }
    } else if (line.startsWith('tags:')) {
      foundTags = true;
      const tagsValue = line.substring(5).trim();
      if (tagsValue.startsWith('[') && tagsValue.endsWith(']')) {
        const inner = tagsValue.slice(1, -1).trim();
        if (inner) {
          collectedTags.push(...inner.split(',').map(t => t.trim().replace(/^["']|["']$/g, '')));
        }
      }
      let j = i + 1;
      while (j < lines.length && lines[j].trim().startsWith('- ')) {
        const tagVal = lines[j].trim().substring(2).trim().replace(/^["']|["']$/g, '');
        if (tagVal) collectedTags.push(tagVal);
        j++;
      }
      if (j > i + 1) i = j - 1;
    } else if (line.startsWith('aliases:')) {
      foundAliases = true;
      const aliasesValue = line.substring(8).trim();
      if (aliasesValue.startsWith('[') && aliasesValue.endsWith(']')) {
        const inner = aliasesValue.slice(1, -1).trim();
        if (inner) {
          collectedAliases.push(...inner.split(',').map(t => t.trim().replace(/^["']|["']$/g, '')));
        }
      }
      let j = i + 1;
      while (j < lines.length && lines[j].trim().startsWith('- ')) {
        const aliasVal = lines[j].trim().substring(2).trim().replace(/^["']|["']$/g, '');
        if (aliasVal) collectedAliases.push(aliasVal);
        j++;
      }
      if (j > i + 1) i = j - 1;
    }
  }

  // Non-canonical fields (unknown keys) are passed through verbatim — the same
  // helper and the same semantics as mergeFrontmatter and the array helpers
  // (#356 follow-up). The loop above used to collect them itself, but it trims
  // every line and skips every `- ` item, so a block-form list under an unknown
  // key came back as its header alone. `sources:` is canonical and is re-emitted
  // from the parsed array below (see #438 B); `extractPassthroughLines` already
  // treats it as known.
  const passthroughLines = extractPassthroughLines(content);

  // Preserve existing provenance (block OR flow form) across the rewrite.
  // parseFrontmatter handles both and strips quoting, matching the shape
  // yamlStringify expects on the serialize side.
  //
  // Filter empty / whitespace-only entries to avoid re-emitting a
  // `sources:` key whose only entry is `\"\"` — that is the shape the
  // previous broken constraints pass leaves on disk for the recovery
  // population (this PR's fix audience). The `aliases` branch has the
  // same guard at `:452`; mirroring it here is intentional. When
  // `preservedSources` ends up empty, `serializeFrontmatter` is called
  // with `sources: undefined` so the key is omitted entirely rather
  // than emitted as `sources:\\n  - \"\"`.
  const rawSources = parseFrontmatter(content)?.sources;
  const preservedSources = Array.isArray(rawSources)
    ? rawSources.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    : undefined;


  const hasTags = foundTags || collectedTags.length > 0;
  const dedupedTags: string[] = [];
  if (hasTags) {
    const validSubtypes: readonly string[] = pageType === 'entity'
      ? (settings ? getActiveEntityTags(settings) : VALID_ENTITY_TAGS)
      : pageType === 'concept'
        ? (settings ? getActiveConceptTags(settings) : VALID_CONCEPT_TAGS)
        : pageType === 'source'
          ? (settings ? getActiveSourceTags(settings) : VALID_SOURCE_TAGS)
          : [];
    // With a vocabulary, the allow-set is the vocabulary — plus, on a source
    // page, the closed form list (`paper`, `article`, …): that page carries
    // two axes in one field, and the model's third option (`theory`, a copied
    // note tag outside the vocabulary) is legal on neither.
    const domainAllowed = options?.domainVocabulary
      ? new Set([
          ...options.domainVocabulary.map(fold),
          ...(pageType === 'source' ? validSubtypes.map(fold) : []),
        ])
      : undefined;
    const outOfVocab: string[] = [];
    const strippedTags: string[] = [];
    for (const tag of collectedTags) {
      if (!tag || tag === pageType) continue;
      if (dedupedTags.includes(tag)) continue;
      if (domainAllowed && !domainAllowed.has(fold(tag))) {
        strippedTags.push(tag);
        continue;
      }
      dedupedTags.push(tag);
      if (!domainAllowed && !validSubtypes.includes(tag)) outOfVocab.push(tag);
    }
    if (strippedTags.length > 0) {
      console.debug(
        `[enforceFrontmatterConstraints] ${pageType} page stripped ${strippedTags.length} tag(s) the active vocabulary does not carry:`,
        strippedTags
      );
    }
    if (outOfVocab.length > 0) {
      console.debug(
        `[enforceFrontmatterConstraints] ${pageType} page retained ${outOfVocab.length} tag(s) not in active vocabulary (${validSubtypes.length} entries):`,
        outOfVocab
      );
    }
  }

  // Self-pointing aliases (alias === page basename) are dropped here when the
  // caller knows the path — see EnforceFrontmatterOptions.pagePath.
  const aliases = options?.pagePath
    ? filterRedundantAliases(options.pagePath, collectedAliases, undefined, resolveMinAliasLength(settings))
    : collectedAliases;

  const frontmatter = serializeFrontmatter(
    {
      type: foundType ? pageType : undefined,
      created: resolveCreated(options, today),
      updated: today,
      sources: Array.isArray(preservedSources) && preservedSources.length > 0 ? preservedSources : undefined,
      tags: dedupedTags,
      aliases: (foundAliases || aliases.length > 0) ? aliases : undefined,
    },
    { passthroughLines, tagStyle: 'inline', emitEmptyTags: hasTags }
  );

  return frontmatter + '\n\n' + body;
}
