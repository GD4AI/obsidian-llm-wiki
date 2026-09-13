// Provenance-marker normalization — repair the footnote the model meant to write.
//
// A multi-source page ends paragraphs with an inline footnote naming the
// source the facts came from: `^[<label>: [[Name]]]`, where the vault's
// config decides the label (`Quelle:`, `Source:`, …). `paragraph-provenance.ts`
// reads exactly that shape to decide which paragraph a rewrite may drop, and
// its regex needs the footnote to be well formed.
//
// The model gets the brackets wrong often enough to matter: measured over a
// rebuilt vault, about a third of the markers came back with two closing
// brackets instead of three, and one in five with the opening bracket doubled
// (155 of 791 on one run). Every one of those forms is invisible to the guard,
// so the paragraph it belongs to loses its owner and becomes droppable — and
// Obsidian reads the doubled form as a link to a page named `<label>: [[Name`,
// one ghost node per source.
//
// The semantic half — which paragraph, which source — is the model's judgement
// and is left alone. The syntactic half is machine-checkable, so the single
// write gate repairs it before the write lands. The label is carried through
// verbatim; this never renames a marker.

/** Label class: no brackets, no newline, no colon — the colon terminates it. */
const LABEL = '([^[\\]\\n:]+)';
/** Link target: alias and folder tolerated, brackets and newline are not. */
const NAME = '([^[\\]\\n]+)';

/**
 * The opener in its three written forms: correct (`^[`), with the bracket
 * doubled (`^[[`) and with the two characters swapped (`[^`). The closing
 * count is free — that is the shape most often wrong.
 */
const OPENED = new RegExp(`(?:\\^\\[\\[?|\\[\\^)${LABEL}:\\s*\\[\\[${NAME}\\]\\]\\]*`, 'g');
/** Doubled opener with the name bare inside: `^[[L: X]]` — the link swallowed by the footnote. */
const BARE = new RegExp(`\\^\\[\\[${LABEL}:\\s*([^[\\]\\n]+?)\\s*\\]\\]\\]*`, 'g');
/**
 * The caret lost from the front: `[[L: [[X]]]`, with or without carets trailing.
 * The nested `[[` is what makes this unambiguous — a wikilink to a page whose
 * name contains a colon never has one, so `[[Study: Berberin 2021]]` is left alone.
 */
const NESTED = new RegExp(`\\[\\[${LABEL}:\\s*\\[\\[([^[\\]\\n]+?)\\s*\\]\\]\\]*\\^*(?!\\[)`, 'g');
/**
 * The same loss with the name bare: `[[L: X]]^`. Nothing distinguishes this
 * from an ordinary wikilink except the trailing caret, so the caret is required.
 */
const TRAILING_CARET = new RegExp(`\\[\\[${LABEL}:\\s*([^[\\]\\n]+?)\\s*\\]\\]\\^+(?!\\[)`, 'g');

const canonical = (_m: string, label: string, name: string) => `^[${label}: [[${name}]]]`;

/**
 * Normalize every provenance footnote to `^[<label>: [[Name]]]`. Idempotent;
 * content without a wikilink is returned unchanged (same reference, so callers
 * can cheaply detect no-ops).
 */
export function normalizeProvenanceMarkers(content: string): string {
  if (!content.includes('[[')) return content;
  return content
    .replace(OPENED, canonical)
    .replace(BARE, canonical)
    .replace(NESTED, canonical)
    .replace(TRAILING_CARET, canonical);
}
