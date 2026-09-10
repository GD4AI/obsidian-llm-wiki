// v1.22.1: Pure helper functions for the SchemaDiffModal class lifecycle.
// Lives in its own file (no `obsidian` dep) so tests can import without
// triggering Vite's import-analysis failure on the real Modal class.
//
// The CSS selector `.modal.llm-wiki-schema-diff-modal` sizes the outer
// container; the inner class drives content-level styles
// (`min-width: 720px`). Replaces the previous CSS `:has()` selector
// (Obsidian review warning: `:has()` causes broad selector
// invalidation → significant perf cost when content changes).

export const DIFF_MODAL_CLASS = 'llm-wiki-schema-diff-modal';

export interface DiffModalLike {
  addClass: (cls: string) => void;
  removeClass: (cls: string) => void;
  empty: () => void;
}

/** Apply the modal-wide class to BOTH outer `.modal` and inner content. */
export function applyDiffModalClasses(
  modalEl: DiffModalLike,
  contentEl: DiffModalLike,
): void {
  modalEl.addClass(DIFF_MODAL_CLASS);
  contentEl.empty();
  contentEl.addClass(DIFF_MODAL_CLASS);
}

/** Remove the outer modal class on close so it doesn't leak to the next modal. */
export function removeDiffModalClasses(modalEl: DiffModalLike): void {
  modalEl.removeClass(DIFF_MODAL_CLASS);
}

/**
 * v1.22.0 #97: When the LLM reports `changes_needed=false`, the Modal
 * should show the *current* schema in BOTH panes (left and right) so
 * the user can read the schema as it stands today alongside the LLM's
 * rationale. A blank right pane is confusing because the eye has
 * nothing to anchor on.
 *
 * Implementation: the Modal constructor (or main.ts) normalizes empty-mode
 * `newBody` to `currentBody` BEFORE lineDiff runs, so the resulting diff
 * is all "eq" rows. Exported for unit testing in isolation.
 */
export function normalizeEmptyMode(opts: {
  isEmpty: boolean;
  currentBody: string;
  newBody: string;
}): string {
  return opts.isEmpty ? opts.currentBody : opts.newBody;
}

/**
 * Builds one diff-pane cell (gutter + content) as a child of `parent`. Lives here rather than on SchemaDiffModal, same as its siblings above — testable without triggering Vite's import-analysis failure on the real Modal class.
 *
 * Builds directly on `parent` rather than on `activeDocument`: Obsidian's `Node.createEl`/`createDiv`/`createSpan` create AND append the new element to `this` (per obsidian.d.ts: "Create an element and append it to this node"). A Document can only ever have one child element, so calling these on `activeDocument` throws `HierarchyRequestError` on the second cell — an ordinary Element can hold any number of children, so building on `parent` avoids that entirely, matching the file's own existing idiom elsewhere (`contentEl.createDiv(...)`, `diffContainer.createDiv(...)` above).
 *
 * Each cell uses the row-highlight color matching its side: left pane highlights (deletions) get a red tint, right pane highlights (additions) get a green tint, so a row that's red on the left is green on the right, and rows that only change on one side get a blank placeholder on the other.
 */
export function buildDiffCell(
  parent: HTMLElement,
  lineNo: number | null,
  text: string,
  highlighted: boolean,
  side: 'left' | 'right',
): HTMLElement {
  const sideClass = side === 'left' ? ' llm-wiki-schema-diff-row-del' : ' llm-wiki-schema-diff-row-add';
  const rowClass = 'llm-wiki-schema-diff-row' + (highlighted ? sideClass : '');
  const contentClass = 'llm-wiki-schema-diff-content' + (highlighted ? ' llm-wiki-schema-diff-content-highlight' : '');

  const cell = parent.createDiv({ cls: rowClass });

  const gutter = cell.createSpan({ cls: 'llm-wiki-schema-diff-gutter' });
  gutter.textContent = lineNo == null ? '' : String(lineNo);

  const content = cell.createSpan({ cls: contentClass });
  content.textContent = text;

  return cell;
}