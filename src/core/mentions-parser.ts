// Issue #267 — Non-lossy Mentions re-ingest (parser)
//
// The inverse of `mentions-formatter.ts`. `injectMentionsSection` re-emits the
// `## Mentions in Source` block from the array it is handed, so on a merge the
// caller must first recover the mentions already accumulated on the page across
// prior sources and union them with the new source's mentions. This module
// parses an existing block back into `MentionWithProvenance[]`.
//
// The section-boundary logic mirrors `mentions-injector.ts` exactly so that
// parse / strip stay symmetric with inject; the round-trip test
// (`mentions-formatter-roundtrip.test.ts`) guards against the two drifting.
//
// Round-trip is lossy for `extracted_at`, `source_slug`, and `position`: none
// are rendered in the section, so a parsed mention carries only `quote`,
// optional `translation`, and `source_path` (recovered from the wikilink).
// That is sufficient for the union dedup key `(quote, source_path)`.

import type { MentionWithProvenance } from '../types';
import { escapeRegex } from '../wiki/lint/utils';
import { dedupMentionsByProvenanceKey } from './batch-merger';

/**
 * Issue #267 — pure, testable core of the non-lossy re-ingest union.
 *
 * Parses the `## <sectionLabel>` block already on the page and unions it
 * with `newMentions` by the `(quote, source_path)` composite key, preserving
 * insertion order (existing first). When the existing block cannot be
 * structurally parsed (hand-edited / linter-reflowed lines), returns
 * `preserveRaw` non-null so the caller preserves it verbatim rather than
 * risk dropping curated quotes.
 *
 * `defaultSourcePath` fills any blank `source_path` (new mentions carry the
 * note path from `normalizeBatchResponse`, #679; the fallback serves mentions
 * handed in without one) and any `.md` suffix is stripped so legacy paths match
 * the rendered on-page form — callers can hand raw mentions.
 */
export interface ReingestMentionsResult {
  /** Unioned mentions to inject (when `preserveRaw` is null). */
  mentions: MentionWithProvenance[];
  /** Non-null ⇒ the existing block was hand-edited; caller preserves it verbatim and skips the union. */
  preserveRaw: string | null;
  /** Character length of the block already on the page (0 when absent) — the floor for re-emitting it. */
  existingLength: number;
}

export function computeReingestMentions(
  existingBody: string,
  newMentions: MentionWithProvenance[],
  sectionLabel: string,
  defaultSourcePath?: string,
): ReingestMentionsResult {
  const existing = parseMentionsSection(existingBody, sectionLabel);
  const existingLength = existing.raw?.length ?? 0;
  if (existing.found && !existing.fullyParsed) {
    return { mentions: [], preserveRaw: existing.raw ?? '', existingLength };
  }
  const normalize = (m: MentionWithProvenance) => ({
    ...m,
    source_path: (m.source_path || defaultSourcePath || '').replace(/\.md$/, ''),
  });
  return {
    mentions: dedupMentionsByProvenanceKey(
      existing.mentions.map(normalize),
      newMentions.map(normalize),
    ) ?? [],
    preserveRaw: null,
    existingLength,
  };
}

/**
 * Locate the `## <sectionLabel>` block. Returns character offsets:
 *  - `start`        index of the `##` header line
 *  - `contentStart` index of the first content char after the header + one
 *                   optional blank line (matches the injector's skip)
 *  - `end`          index of the next `## ` heading, or `body.length`
 * Case-insensitive on the label (localized labels in any case must match).
 */
function findSection(
  body: string,
  sectionLabel: string,
): { start: number; contentStart: number; end: number } | null {
  const headerRe = new RegExp(`^##\\s+${escapeRegex(sectionLabel)}\\s*$`, 'mi');
  const match = body.match(headerRe);
  if (!match || match.index === undefined) return null;

  const start = match.index;
  const afterHeader = start + match[0].length;
  const rest = body.substring(afterHeader);
  const afterBlank = rest.replace(/^\s*\n/, '');
  const contentStart = afterHeader + (rest.length - afterBlank.length);
  const nextHeading = afterBlank.search(/^##\s/m);
  const end = nextHeading === -1 ? body.length : contentStart + nextHeading;
  return { start, contentStart, end };
}

// A formatter-produced bullet:
//   - "quote" — [[leftPath|display]]
//   - "quote" (translation) — [[leftPath|display]]
// Half-width parentheses, em-dash separator (U+2014). Anything that does not
// match is treated as a hand-edit and flips `fullyParsed` to false.
//
// Issue #363 — the citation is optional and its target may be empty:
//   - "quote" — [[|]]   written by builds whose `formatMentionsSection` took a
//                       blank `source_path` straight from the model
//   - "quote"           what the formatter emits now when no source path is
//                       known (an empty target is not representable, see
//                       `mentions-formatter.ts`)
// Requiring a non-empty target froze both shapes out of the parser: the line
// failed, `computeReingestMentions` returned `preserveRaw`, the #267 fail-safe
// fired, and the page never accumulated another quote — on every subsequent
// ingest, not once. Both shapes now parse with an empty `source_path`, which
// `computeReingestMentions` fills from `defaultSourcePath`, so the page repairs
// itself the next time it merges. That attribution is an inference, not a
// recovery: an empty target carries no source, so the quote is attributed to
// the source being merged. It is the same rule the legacy shape already uses
// for a quote under a group header, and strictly more than `[[|]]` conveyed.
const BULLET_RE = /^-\s+"([\s\S]+)"(?:\s+\(([^)]*)\))?(?:\s+—\s+\[\[([^\]|]*)\|[^\]]*\]\])?\s*$/;

// Issue #289 — the pre-#244 shape, grouped by source under a blockquote header:
//   > **Source: [[sources/X|X]]**
//   > - "quote"
//   > - "quote" (translation)
//
// That block was written by the MODEL, not by the formatter (the prompt showed it
// the shape and asked it to copy it), so it varies in ways a programmatic block
// never would: the bold run may or may not wrap the link, the link may or may not
// carry a display alias, and the "Source:" prefix came from an English prompt
// literal regardless of vault language. The group header is therefore matched
// structurally — a blockquote line carrying a wikilink and no quote — rather than
// by that literal, so a localized or lightly hand-edited header still parses.
const LEGACY_GROUP_RE = /^>\s*\**\s*[^"[]*\[\[([^\]]+)\]\]\s*\**\s*$/;
const LEGACY_QUOTE_RE = /^>\s*-\s+"([\s\S]+)"(?:\s+\(([^)]*)\))?\s*$/;

/** Recover the link target from a wikilink body, dropping any `|display` alias. */
function linkTarget(inner: string): string {
  return inner.split('|')[0].trim();
}

export interface ParsedMentionsSection {
  /** Whether a `## <sectionLabel>` block existed at all. */
  found: boolean;
  /**
   * True when every non-blank content line parsed as a bullet. False when the
   * block contains hand-edited or linter-reflowed lines we cannot structure —
   * the caller must then preserve `raw` verbatim rather than risk dropping it.
   */
  fullyParsed: boolean;
  /** Structured mentions recovered from the parseable bullet lines. */
  mentions: MentionWithProvenance[];
  /** The raw section text (header + body), trailing whitespace trimmed. */
  raw: string | null;
}

/**
 * Parse an existing `## <sectionLabel>` block back into structured mentions.
 * Returns `found:false` (an empty, fully-parsed result) when no block exists.
 *
 * Accepts both the flat formatter-produced shape and the pre-#244 grouped
 * blockquote shape (#289), in either order and mixed within one block. Parsing
 * the legacy shape is what gives it a migration path: the caller unions the
 * result and the formatter re-emits the whole section flat, so the page is
 * upgraded the first time it merges again, with no user action.
 */
export function parseMentionsSection(body: string, sectionLabel: string): ParsedMentionsSection {
  if (!sectionLabel || !sectionLabel.trim()) {
    return { found: false, fullyParsed: true, mentions: [], raw: null };
  }
  const sec = findSection(body, sectionLabel);
  if (!sec) return { found: false, fullyParsed: true, mentions: [], raw: null };

  const raw = body.substring(sec.start, sec.end).replace(/\s+$/, '');
  const content = body.substring(sec.contentStart, sec.end);

  const mentions: MentionWithProvenance[] = [];
  let fullyParsed = true;
  // The source most recently named by a legacy group header. Quotes in the
  // legacy shape carry no attribution of their own — they inherit it from the
  // group they sit under.
  let legacyGroupPath: string | null = null;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const flat = BULLET_RE.exec(line);
    if (flat) {
      const [, quote, translation, leftPath] = flat;
      mentions.push({
        quote,
        ...(translation && translation.trim() ? { translation: translation.trim() } : {}),
        // Absent citation (group undefined) and empty target (`[[|]]`) are the
        // same state: no source on the line. #363.
        source_path: leftPath ?? '',
        source_slug: '',
        extracted_at: '',
      });
      continue;
    }

    // Issue #289 — legacy blockquote shape. Recognized so the block can be
    // parsed and re-emitted flat by the formatter, which upgrades the page the
    // first time it is merged again. Without this the block is unparseable, the
    // #267 fail-safe fires, and the page never accumulates another quote.
    const group = LEGACY_GROUP_RE.exec(line);
    if (group) {
      legacyGroupPath = linkTarget(group[1]).replace(/\.md$/, '');
      continue;
    }
    const legacyQuote = LEGACY_QUOTE_RE.exec(line);
    if (legacyQuote && legacyGroupPath) {
      const [, quote, translation] = legacyQuote;
      mentions.push({
        quote,
        ...(translation && translation.trim() ? { translation: translation.trim() } : {}),
        source_path: legacyGroupPath,
        source_slug: '',
        extracted_at: '',
      });
      continue;
    }

    // A quote outside any group has no recoverable attribution, so it falls
    // through to the fail-safe with everything else we cannot structure.
    fullyParsed = false;
  }
  return { found: true, fullyParsed, mentions, raw };
}

/**
 * Remove the `## <sectionLabel>` block from `body` (no-op if absent), trimming
 * the surrounding blank lines so no gap accumulates. Used by the #267 fail-safe
 * to re-attach a curated block verbatim to a freshly merged body.
 */
export function stripMentionsSection(body: string, sectionLabel: string): string {
  if (!sectionLabel || !sectionLabel.trim()) return body;
  const sec = findSection(body, sectionLabel);
  if (!sec) return body;
  const before = body.substring(0, sec.start).replace(/\n+\s*$/, '');
  const after = body.substring(sec.end).replace(/^\s*\n/, '');
  if (!after) return before;
  return before ? `${before}\n\n${after}` : after;
}
