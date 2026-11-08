// value-survival — the instrument behind #910.
//
// "Does an exact value survive ingest?" was argued twice from prompt text
// before this file existed, and both arguments were wrong in the same way:
// nobody counted. The counting is here, and it is deliberately name-blind.
//
// The first attempt narrowed to "values in the same sentence as an entity that
// got a page". That needs a matcher from page title to the words in the note,
// and on a vault whose pages are titled in one language over notes written in
// another it matched nothing and reported n=0. A counter that must recognise a
// name before it can count has a blind spot shaped like the user's language.
//
// So this module never matches names. Pages are attributed to a source by the
// `sources:` backlink the pipeline already writes, and the note is cleaned by
// masking the regions knowledge does not live in — frontmatter, fenced code,
// markdown tables, HTML tables. Masking keeps every offset, so a value's
// position in the note survives the cleaning.

export type ValueKind = 'money' | 'percent' | 'date' | 'spec' | 'model';
export type Position = 'head' | 'middle' | 'tail';
export type Outcome = 'quoted' | 'prose' | 'absent';
export type PageType = 'source' | 'entity' | 'concept';

export interface Harvested {
  text: string;
  kind: ValueKind;
  offset: number;
  position: Position;
}

export interface Row {
  pageType: PageType;
  kind: ValueKind;
  position: Position;
  outcome: Outcome;
}

export interface Bucket {
  n: number;
  quoted: number;
  prose: number;
  absent: number;
  /** Share of this bucket that appears nowhere on the pages it should reach. */
  absentShare: number;
}

export interface Report {
  total: number;
  byPosition: Array<Bucket & { position: Position }>;
  byKind: Array<Bucket & { kind: ValueKind }>;
  byPageType: Array<Bucket & { pageType: PageType }>;
}

/** The window the source-page prose is generated from, in characters. */
export const HEAD_WINDOW = 500;

const blank = (s: string): string => s.replace(/[^\n]/g, ' ');

/**
 * Replace every region a note's knowledge does not live in with spaces,
 * keeping the string's length and its newlines.
 *
 * Length preservation is the point: `harvestValues` reports offsets, and an
 * offset that moves when a table is removed cannot be compared against the
 * 500-character window this module exists to measure.
 */
export function maskNonKnowledge(note: string): string {
  let out = note;

  // YAML frontmatter, only when it opens the file.
  const front = /^---\r?\n[\s\S]*?\r?\n---[^\n]*/u.exec(out);
  if (front) out = blank(front[0]) + out.slice(front[0].length);

  // Fenced code, including an unclosed fence (a truncated note).
  out = out.replace(/```[\s\S]*?(?:```|$)/gu, m => blank(m));

  // HTML tables: what the PDF and Office conversions leave in place of a table.
  out = out.replace(/<table[\s\S]*?(?:<\/table>|$)/giu, m => blank(m));

  // Inline LaTeX, before money is harvested: a formula's `$` delimiter sits
  // immediately before a digit often enough to be read as a currency amount,
  // and on a paper note that is most of the money bucket. Only a span that
  // carries math syntax is masked, so `$20 per hour` stays a price.
  out = out.replace(/\$(?:[^$\n]{0,200}?[\\^_{][^$\n]{0,200}?)\$/gu, m => blank(m));

  // Markdown table rows.
  out = out.replace(/^[ \t]*\|.*$/gmu, m => blank(m));

  return out;
}

interface Pattern {
  kind: ValueKind;
  re: RegExp;
}

// Order decides ties, not precedence: every pattern runs, then overlaps are
// dropped by earliest start. Money holds a bare number inside it, so a spec
// pattern and a money pattern can claim the same characters; the earlier match
// wins and the container does not double-count.
const PATTERNS: Pattern[] = [
  // A currency glyph before the amount, or a currency word after it — German
  // and Chinese notes put it after, and those are the two languages this
  // project's real vaults are written in.
  { kind: 'money', re: /[$€£¥]\s?\d[\d,]*(?:[.,]\d+)?/g },
  { kind: 'money', re: /\d[\d.,]*\s?(?:EUR|USD|CNY|RMB|GBP|JPY|CHF|美元|欧元|人民币)(?![A-Za-z])/g },
  { kind: 'date', re: /\d{4}-\d{2}-\d{2}/g },
  // A decimal comma is as real as a decimal point, and `12,5 %` must not be
  // read as `5 %`: that is a different value, and missing the integer part
  // would under-count survival for the whole German-language case.
  { kind: 'percent', re: /\d+(?:[.,]\d+)?\s?%/g },
  {
    kind: 'spec',
    re: /\d+(?:[.,]\d+)?\s?(?:kg|mg|GB|MB|TB|KB|GHz|MHz|km|mm|cm|Hz|mA|ms|g|m|s|W|V|A|Monate|Monat|Tage|Jahre|months|days|years|元|美元|欧元|公斤|克|米|度)(?![A-Za-z])/g,
  },
  { kind: 'model', re: /\b[A-Z]{2,4}-?\d{2,}[A-Z0-9-]*\b/g },
];

/** Every exact value in a masked note, in reading order, without overlaps. */
export function harvestValues(masked: string): Harvested[] {
  const total = masked.length;
  const claims: Harvested[] = [];

  for (const { kind, re } of PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(masked)) !== null) {
      if (m[0].length === 0) { re.lastIndex += 1; continue; }
      claims.push({
        text: m[0],
        kind,
        offset: m.index,
        position: classifyPosition(m.index, total),
      });
    }
  }

  claims.sort((a, b) => (a.offset - b.offset) || (b.text.length - a.text.length));

  const kept: Harvested[] = [];
  let end = -1;
  for (const claim of claims) {
    if (claim.offset < end) continue;
    kept.push(claim);
    end = claim.offset + claim.text.length;
  }
  return kept;
}

/**
 * Where a value sits, measured the way the pipeline reads the note.
 *
 * The source page's prose is generated from the first 500 characters, so a
 * value past that point is reachable only through the quote sections. A note
 * shorter than two windows has no middle.
 */
export function classifyPosition(offset: number, total: number, window = HEAD_WINDOW): Position {
  if (offset < window) return 'head';
  if (offset >= total - window) return 'tail';
  return 'middle';
}

/**
 * Fold the differences a model may introduce without changing the value.
 * Spacing inside a unit and a thousands separator are formatting, not facts.
 */
export function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '').replace(/,/g, '');
}

/** The YAML block of a page, or '' when there is none. */
export function frontmatterOf(page: string): string {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/u.exec(page);
  return m ? m[1] : '';
}

/**
 * The source slugs a page declares, as bare slugs.
 *
 * The pipeline writes these as **quoted** wikilinks — `- "[[sources/x_ab]]"` —
 * and a parser that only strips `[[` misses every one of them, which reads as
 * "no page belongs to any source" rather than as a parse failure. The first
 * run of this instrument reported exactly that: 360 values, all against the
 * source page, none against an entity or a concept.
 */
export function sourceSlugs(page: string): string[] {
  const fm = frontmatterOf(page);
  const block = /^sources:\s*\n((?:[ \t]+-[^\n]*\n?)+)/mu.exec(fm);
  if (!block) {
    const inline = /^sources:\s*\[([^\]]*)\]/mu.exec(fm);
    return inline ? inline[1].split(',').map(s => bareSlug(s)).filter(Boolean) : [];
  }
  return block[1]
    .split('\n')
    .map(line => bareSlug(line.replace(/^[ \t]+-\s*/u, '')))
    .filter(Boolean);
}

/** `"[[sources/a_b#Sec|shown]]"` → `a_b`. */
export function bareSlug(entry: string): string {
  return entry
    .trim()
    .replace(/^["']*/u, '')
    .replace(/["']*$/u, '')
    .replace(/^\[\[/u, '')
    .replace(/\]\]$/u, '')
    .split('|')[0]
    .split('#')[0]
    .split('/')
    .pop()!
    .trim();
}

/** `source_file: "[[notes/x.md]]"` → `notes/x.md`. */
export function sourceFileOf(page: string): string | null {
  const m = /^source_file:\s*["']?\[\[([^\]|#]+)/mu.exec(frontmatterOf(page));
  return m ? m[1].trim() : null;
}

/**
 * Where the value turned up: quoted verbatim, in condensed prose, or nowhere.
 * `quotedText` and `proseText` are the concatenated page text of one class, so
 * a single call per value is enough.
 */
export function survivalOf(value: string, quotedText: string, proseText: string): Outcome {
  const needle = normalizeForMatch(value);
  if (needle.length === 0) return 'absent';
  if (normalizeForMatch(quotedText).includes(needle)) return 'quoted';
  if (normalizeForMatch(proseText).includes(needle)) return 'prose';
  return 'absent';
}

function bucket(rows: Row[]): Bucket {
  const quoted = rows.filter(r => r.outcome === 'quoted').length;
  const prose = rows.filter(r => r.outcome === 'prose').length;
  const absent = rows.filter(r => r.outcome === 'absent').length;
  return {
    n: rows.length,
    quoted,
    prose,
    absent,
    absentShare: rows.length === 0 ? 0 : absent / rows.length,
  };
}

const uniq = <T>(values: T[]): T[] => [...new Set(values)];

/** Survival rates per position, per kind, and per page type. */
export function summarize(rows: Row[]): Report {
  return {
    total: rows.length,
    byPosition: uniq(rows.map(r => r.position))
      .map(position => ({ position, ...bucket(rows.filter(r => r.position === position)) }))
      .sort((a, b) => a.position.localeCompare(b.position)),
    byKind: uniq(rows.map(r => r.kind))
      .map(kind => ({ kind, ...bucket(rows.filter(r => r.kind === kind)) }))
      .sort((a, b) => a.kind.localeCompare(b.kind)),
    byPageType: uniq(rows.map(r => r.pageType))
      .map(pageType => ({ pageType, ...bucket(rows.filter(r => r.pageType === pageType)) }))
      .sort((a, b) => a.pageType.localeCompare(b.pageType)),
  };
}
