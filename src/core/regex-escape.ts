// Escape a string so it can be embedded in a `RegExp` source.
//
// Sunk into `core/` by #931. Three `core/` modules escaped section labels for
// regex use and imported this one line from `wiki/lint/utils.ts`, which made
// `core/` depend on a layer above it. A one-line pure function has no layer:
// `wiki/` and `core/` both call it, and neither owns it.
//
// `wiki/lint/utils.ts` re-exports it, so the five `wiki/` call sites did not
// change. `core/section-extractor.ts` held a private copy of the same body;
// that copy is gone, so there is one implementation rather than three.
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
