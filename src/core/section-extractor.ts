// section-extractor.ts — Tier B redesign for v1.23.0 Graph Engine.
//
// Pure function: zero IO, zero LLM, zero graph dependency.
// Extracts the page-type-appropriate section from a wiki page body
// at query time, replacing the original "per-query LLM call to summarize
// the page" (ROADMAP Tier B). Cancelled in #198 (2026-06-23) — every
// wiki page already has a `## Description` (entity) or `## Definition`
// (concept) section written by the LLM at ingest time. We just read it.
//
// First-principles review (2026-06-27): the previous version hardcoded
// `description|definition` English labels and was therefore unusable for
// the 10-language plugin. Re-architected to receive section labels
// from the caller, who has access to getSectionLabels(settings) and
// honors user-customized wikiLanguage via useCustomWikiLanguage. The
// extractor itself is label-agnostic — it just matches whatever the
// caller hands it.
//
// Contract:
//
//   extractSummaryFromPage(
//     body: string,
//     options: {
//       descriptionLabel: string;   // entity section title (i18n-translated or custom)
//       definitionLabel: string;    // concept section title (i18n-translated or custom)
//       pageType: 'entity' | 'concept';  // kept for callers; no longer selects the label
//       maxChars: number;
//     }
//   ): string
//
// Behavior:
// - Match `## <descriptionLabel>` first (case-insensitive), for both page
//   types: the merge template writes the Description on every multi-source
//   page and that is where the substance accumulates. If not present, fall
//   back to `## <definitionLabel>` (a single-source concept page has only
//   that; a page may also have been ingested before the user changed
//   wikiLanguage).
// - Extract content up to the next ## or ### header.
// - Strip `[[wikilink]]` and `[[#^block-id]]` constructs.
// - Strip folder prefix from `[[entities/Cardiology]]` → `Cardiology`.
// - Truncate at the last sentence boundary within maxChars.
// - If no sentence boundary fits, hard-truncate at maxChars - 1 and
//   append '…' (UTF-8 1 char) to stay within maxChars.
// - If neither label is present, return '' (caller decides fallback).

export interface SectionExtractOptions {
  descriptionLabel: string;
  definitionLabel: string;
  /** Kept for callers; no longer selects the label (see extractSummaryFromPage). */
  pageType: 'entity' | 'concept';
  maxChars: number;
}

const FRONTMATTER_RE = /^---\s*\n[\s\S]*?\n---\s*\n?/;
const WIKILINK_RE = /\[\[([^\]|#]+?)(?:#[^\]]+)?(?:\|([^\]]+))?\]\]/g;
const PURE_ANCHOR_RE = /\[\[#\^[^\]]+\]\]/g;
const SENTENCE_BOUNDARY_RE = /[.!?](?=\s|$)/g;
const ELLIPSIS = '…'; // UTF-8 1 char

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripFrontmatter(body: string): string {
  return body.replace(FRONTMATTER_RE, '');
}

function stripWikilinks(text: string): string {
  let result = text.replace(WIKILINK_RE, (_match, target: string, alias?: string) => {
    // [[entities/Cardiology]] or [[sources/Foo]] → strip folder prefix.
    const bareSlug = target.includes('/') ? target.split('/').pop()! : target;
    return (alias ?? bareSlug).trim();
  });
  // Pure-anchor form: [[#^block-id]] (target slot is empty / '#' only).
  // No slug to keep — strip the whole construct.
  result = result.replace(PURE_ANCHOR_RE, '');
  return result;
}

/**
 * Find the next ## or ### header after fromPos. Returns body.length if
 * no more headers. Pure linear scan — never stateful. (Previous /g regex
 * with lastIndex reset was unsafe because module-level regexes are
 * shared across calls.)
 */
function findSectionEnd(body: string, fromPos: number): number {
  const lines = body.split('\n');
  let pos = 0;
  for (const line of lines) {
    const lineEnd = pos + line.length;
    if (lineEnd > fromPos && /^#{1,3}\s+/.test(line)) {
      return pos;
    }
    pos = lineEnd + 1; // +1 for the '\n'
  }
  return body.length;
}

/**
 * Match a section header by label (case-insensitive). Returns the byte
 * offset of the section header's start and the header's actual byte
 * length in the source (so we can skip past it).
 */
function findSectionHeader(body: string, label: string): { index: number; headerLen: number } | null {
  // Build a regex that matches `## <label>` at the start of a line
  // (with optional leading whitespace). Case-insensitive (per markdown
  // convention — and because Obsidian users type however they feel).
  const escaped = escapeRegex(label.trim());
  // Anchor to line start; the body may have leading frontmatter or
  // blank lines before the section we care about.
  const re = new RegExp(`^\\s*##\\s+${escaped}\\s*$`, 'im');
  const m = re.exec(body);
  if (!m) return null;
  return { index: m.index + m[0].indexOf('#'), headerLen: m[0].length };
}

/**
 * Truncate at the last sentence boundary that fits within maxChars.
 * If no boundary fits, hard-truncate at maxChars - 1 and append '…'
 * so the returned string never exceeds maxChars.
 */
function truncateAtSentenceBoundary(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  // Find sentence boundaries (positions right after '.', '!', or '?').
  SENTENCE_BOUNDARY_RE.lastIndex = 0;
  const candidates: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = SENTENCE_BOUNDARY_RE.exec(text)) !== null) {
    candidates.push(match.index + 1);
  }

  // Walk candidates from the end. Find the last one that fits.
  for (let i = candidates.length - 1; i >= 0; i--) {
    const end = candidates[i];
    if (end <= maxChars) {
      return text.slice(0, end);
    }
  }

  // No sentence boundary fits. Hard-truncate and append '…' (1 char)
  // so the returned string still respects maxChars.
  return text.slice(0, maxChars - 1) + ELLIPSIS;
}

export function extractSummaryFromPage(body: string, options: SectionExtractOptions): string {
  if (!body) return '';

  const { descriptionLabel, definitionLabel, maxChars } = options;

  // Step 1: strip frontmatter so it doesn't confuse header search.
  const stripped = stripFrontmatter(body);

  // Step 2: the description is the page's substance for both page types;
  // the definition is the one-sentence gloss the concept template writes
  // above it. Measured 2026-09-04 on a 3,025-page vault: of 241 concept
  // pages carrying both sections, 183 had a definition under 400 chars and
  // a description at least three times as long (median ratio 5.2). With
  // the definition primary, an osteoporosis question reached the model as
  // one sentence while the 3,100-char description — therapy, exercise,
  // dysbiosis — never did. A page that has only a definition still gets it.
  const primaryLabel = descriptionLabel;
  const secondaryLabel = definitionLabel;

  let header = findSectionHeader(stripped, primaryLabel);
  if (!header) {
    header = findSectionHeader(stripped, secondaryLabel);
  }
  if (!header) return '';

  // header.index is relative to `stripped` (regex match offset in input).
  const start = header.index + header.headerLen;

  // Step 3: locate the section end (next ## or ### header).
  const end = findSectionEnd(stripped, start);

  // Step 4: extract raw content, trim, strip wikilinks.
  const raw = stripped.slice(start, end).trim();
  const cleaned = stripWikilinks(raw);

  // Step 5: truncate at sentence boundary (or hard-truncate with …).
  return truncateAtSentenceBoundary(cleaned, maxChars);
}
/**
 * The paragraphs a query matched, outside the summary section.
 *
 * Why. The retrieval scores the full body and the display shows only the
 * Description/Definition section for entity and concept pages. A page can be
 * retrieved because of its third paragraph and the model cannot see why. This
 * returns those paragraphs so they can ride along with the summary.
 *
 * The summary section is excluded by default: it is already in the context,
 * and repeating it spends the budget twice. `summarySectionLabels` names the
 * headings whose sections count as "already shown".
 */
export function extractMatchedParagraphs(
  body: string,
  queryTerms: readonly string[],
  budgetChars: number,
  options: { summarySectionLabels?: readonly string[] } = {},
): string {
  if (!body || queryTerms.length === 0 || budgetChars <= 0) return '';

  const terms = queryTerms.map(t => t.toLowerCase()).filter(Boolean);
  if (terms.length === 0) return '';

  const stripped = stripFrontmatter(body);
  const summaryLabels = (options.summarySectionLabels ?? [])
    .map(l => l.toLowerCase());

  // Walk the body tracking which section each paragraph sits in. A paragraph
  // inside a summary section is skipped; anywhere else is fair game.
  const paragraphs = stripped.split(/\n\s*\n/);
  let currentHeading = '';
  const matched: string[] = [];
  let used = 0;

  for (const p of paragraphs) {
    const headingMatch = p.match(/^#{1,6}\s+(.+)$/m);
    if (headingMatch) currentHeading = headingMatch[1].trim().toLowerCase();

    const isSummarySection = summaryLabels.some(l => currentHeading.includes(l));
    if (isSummarySection) continue;

    const lower = p.toLowerCase();
    if (!terms.some(t => lower.includes(t))) continue;

    if (used + p.length > budgetChars) {
      const remaining = budgetChars - used;
      if (remaining > 20) matched.push(p.slice(0, remaining));
      break;
    }
    matched.push(p);
    used += p.length + 2;
  }

  return matched.join('\n\n');
}
