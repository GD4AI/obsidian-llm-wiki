// v1.22.0 #97: Schema diff Modal — IDE-style dual-pane diff preview with
// "Regenerate" / "Apply" / "Cancel" buttons.
//
// Wire-up (in main.ts):
//   const modal = new SchemaDiffModal(this.app, {
//     currentBody,        // the current wiki/schema/config.md body
//     newBody,            // the LLM's proposed new body
//     onApply: async () => { await applySchemaSuggestion({...}); close(); },
//     onRegenerate: async (userHint) => { /* re-call LLM with userHint */ },
//   });
//   modal.open();
//
// Rendering: a flexbox with two columns. Each column is a `<pre>` (line
// numbers + line content). When the diff op is 'eq', both columns show
// the same line. When 'del', the left shows the line in red; the right
// shows an empty placeholder (so the rows align). When 'add', the right
// shows the line in green; the left shows an empty placeholder.
//
// The diff is computed once at construction time via lineDiff() and
// stored as a stable array. The Modal then derives the two columns by
// walking that array and pushing lines into leftColumn / rightColumn.
//
// Style: we use Obsidian's setCssProps (instead of setAttribute('style'))
// so the CSS-variable-based theming works in popout windows. We also
// reference `activeDocument` per the obsidianmd/prefer-active-doc rule
// — this is a no-disable rule and the bot WILL reject a release with
// `document.createElement`.

import { App, Modal } from 'obsidian';
import { lineDiff } from '../core/diff';
import { TEXTS } from '../texts';
import {
  applyDiffModalClasses,
  buildDiffCell,
  normalizeEmptyMode,
  removeDiffModalClasses,
} from './schema-diff-modal-classes';

export interface SchemaDiffModalOptions {
  currentBody: string;
  newBody: string;
  /** Language for i18n text. Falls back to EN if missing. */
  language?: string;
  /** v1.22.0 #97: when the LLM reports changes_needed=false, the
   *  new body may be empty (LLM didn't propose any change). The Modal
   *  shows a "no changes" banner and disables the Apply button — the
   *  user can still Regenerate (re-prompt) or Cancel. */
  isEmpty?: boolean;
  /** v1.22.0 #97: human-readable rationale (LLM's suggestions text).
   *  Shown in the empty state so the user can read why the LLM
   *  decided no changes are needed before deciding to Regenerate. */
  rationale?: string;
  /** Called when user clicks Apply. The modal closes itself after
   *  the returned promise resolves successfully. */
  onApply: () => Promise<void> | void;
  /** Called when user clicks Regenerate with the optional user hint
   *  (typed in the regenerate textbox). The modal stays open; the
   *  caller is expected to call modal.setNewBody(newBody) after the
   *  LLM returns. */
  onRegenerate: (userHint: string) => Promise<void> | void;
  /** Optional: called when user clicks Cancel. Modal also closes itself. */
  onCancel?: () => void;
  /** v1.22.0 #97: called when user clicks "Open Schema" — opens the
   *  wiki/schema/config.md file directly in Obsidian's editor and
   *  closes the Modal. The user can hand-edit the file and either
   *  re-run "Suggest Schema Updates" or re-Apply. */
  onOpenFile?: () => void;
}

interface DiffRow {
  /** Number in the left column (1-based). Null if the row is a "add" op
   *  (no corresponding line in the current body). */
  leftLineNo: number | null;
  /** Line text on the left. Empty for "add" rows (visual spacer). */
  leftText: string;
  /** Number in the right column (1-based). Null for "del" rows. */
  rightLineNo: number | null;
  /** Line text on the right. Empty for "del" rows. */
  rightText: string;
  op: 'eq' | 'add' | 'del';
}

export class SchemaDiffModal extends Modal {
  private options: SchemaDiffModalOptions;
  private currentBody: string;
  private newBody: string;
  private rows: DiffRow[] = [];
  // v1.22.0 #97: Regenerate UI hidden for v1.22 release. The field is
  // kept (commented) so the v1.23 sprint can re-enable by uncommenting
  // the textarea + button + this declaration.
  // private regenerateHint = '';
  private isBusy = false;

  constructor(app: App, options: SchemaDiffModalOptions) {
    super(app);
    this.options = options;
    this.currentBody = options.currentBody;
    // v1.22.0 #97: in empty mode, force newBody = currentBody so the
    // diff is all "eq" rows — both panes show the current schema, no
    // red/green highlight, no awkward blank right pane.
    this.newBody = normalizeEmptyMode({
      isEmpty: options.isEmpty ?? false,
      currentBody: options.currentBody,
      newBody: options.newBody,
    });
    this.recompute();
  }

  /** Public API: the caller (e.g. onRegenerate handler) updates the new
   *  body after a re-generation round and calls this to refresh the diff.
   *  Also refreshes the rationale so the LLM's reasoning stays in sync
   *  with the new body — the LLM may write a different rationale
   *  after a Regenerate round. */
  setNewBody(newBody: string, options?: { rationale?: string; isEmpty?: boolean }): void {
    this.newBody = newBody;
    if (options) {
      if (options.rationale !== undefined) this.options.rationale = options.rationale;
      if (options.isEmpty !== undefined) this.options.isEmpty = options.isEmpty;
    }
    this.recompute();
    this.refresh();
  }

  /** Public API: the caller sets the current body when it loads
   *  asynchronously after construction. We must re-run normalizeEmptyMode
   *  here too — otherwise in empty mode the newBody stays "" (set at
   *  construction when currentBody was still "") and the diff becomes
   *  "all current lines are deletions" (left pane fully red). */
  setCurrentBody(currentBody: string): void {
    this.currentBody = currentBody;
    this.newBody = normalizeEmptyMode({
      isEmpty: this.options.isEmpty ?? false,
      currentBody,
      newBody: this.newBody,
    });
    this.recompute();
    this.refresh();
  }

  private recompute() {
    const ops = lineDiff(this.currentBody, this.newBody);
    const rows: DiffRow[] = [];
    let leftLine = 0;
    let rightLine = 0;
    for (const op of ops) {
      if (op.op === 'eq') {
        leftLine++; rightLine++;
        rows.push({ leftLineNo: leftLine, leftText: op.line, rightLineNo: rightLine, rightText: op.line, op: 'eq' });
      } else if (op.op === 'del') {
        leftLine++;
        rows.push({ leftLineNo: leftLine, leftText: op.line, rightLineNo: null, rightText: '', op: 'del' });
      } else {
        rightLine++;
        rows.push({ leftLineNo: null, leftText: '', rightLineNo: rightLine, rightText: op.line, op: 'add' });
      }
    }
    this.rows = rows;
  }

  onOpen() {
    // Cast through unknown because TypeScript's inference for indexed
    // access (`TEXTS[literal]`) doesn't pick up the union nature of
    // TEXTS — using `?? TEXTS.en` triggers TS2339 because TS thinks
    // the indexed value might be the entire union and not always
    // contain en. The cast is safe: TEXTS always includes 'en' (see
    // texts.ts barrel) and we have a complete-coverage test in
    // i18n-parity.test.ts.
    const t = (TEXTS as unknown as Record<string, Record<string, string>>)[this.options.language ?? 'en']
      ?? TEXTS.en as unknown as Record<string, string>;
    const { modalEl, contentEl } = this;
    applyDiffModalClasses(modalEl, contentEl); // v1.22.1: width on outer .modal (was :has() selector)

    // Title
    contentEl.createEl('h2', { text: t.schemaDiffTitle ?? 'Schema update preview' });

    // v1.22.0 #97: always show the LLM's rationale (suggestions) so the
    // user can read the reasoning before deciding to Apply. The empty
    // banner is a special case — all schemas (including those with a
    // proposed diff) should show the "why" section.
    if (this.options.rationale) {
      const rationaleSection = contentEl.createDiv({ cls: 'llm-wiki-schema-diff-rationale' });
      rationaleSection.createEl('p', {
        text: this.options.rationale,
        cls: 'llm-wiki-schema-diff-rationale-text',
      });
    }

    // v1.22.0 #97: empty-state banner — the LLM decided no changes are
    // needed. Show the user a clear signal so they can decide whether to
    // Regenerate (re-prompt) or Cancel.
    if (this.options.isEmpty) {
      const banner = contentEl.createDiv({ cls: 'llm-wiki-schema-diff-empty-banner' });
      banner.createEl('p', {
        text: t.schemaDiffEmptyTitle ?? 'No changes recommended',
        cls: 'llm-wiki-schema-diff-empty-title',
      });
    }

    // Summary line
    const addCount = this.rows.filter(r => r.op === 'add').length;
    const delCount = this.rows.filter(r => r.op === 'del').length;
    contentEl.createEl('p', {
      text: (t.schemaDiffSummary ?? '+{add} / -{del} lines').replace('{add}', String(addCount)).replace('{del}', String(delCount)),
      cls: 'llm-wiki-schema-diff-summary',
    });

    // Dual-pane container
    const diffContainer = contentEl.createDiv({
      cls: 'llm-wiki-schema-diff-panes',
    });

    const leftPane = diffContainer.createDiv({ cls: 'llm-wiki-schema-diff-pane llm-wiki-schema-diff-pane-left' });
    const rightPane = diffContainer.createDiv({ cls: 'llm-wiki-schema-diff-pane llm-wiki-schema-diff-pane-right' });

    this.renderPane(leftPane, rightPane);

    // v1.22.0 #97: Regenerate UI (textarea + button) HIDDEN for v1.22
    // release. The code path (`onRegenerate` callback in options,
    // `setNewBody` to refresh the diff, all i18n keys, controller in
    // main.ts) is fully wired and tested — we're only hiding the UI
    // to ship a minimal v1.22 release. The textarea and button below
    // are kept as commented-out code so the v1.23 sprint can re-enable
    // them by uncommenting. See main.ts `onRegenerate` handler.
    //
    // // Regenerate input
    // const regenSection = contentEl.createDiv({ cls: 'llm-wiki-schema-diff-regen-section' });
    // regenSection.createEl('p', {
    //   text: t.schemaDiffRegenerateLabel ?? 'Refine the suggestion (optional):',
    //   cls: 'llm-wiki-schema-diff-regen-label',
    // });
    // const regenInput = regenSection.createEl('textarea', {
    //   cls: 'llm-wiki-schema-diff-regen-textarea',
    // });
    // regenInput.value = this.regenerateHint;
    // regenInput.addEventListener('input', () => {
    //   this.regenerateHint = regenInput.value;
    // });

    // Action buttons
    const btnRow = contentEl.createDiv({ cls: 'llm-wiki-schema-diff-btn-row' });

    // v1.22.0 #97: "Open file" button — opens wiki/schema/config.md
    // directly in Obsidian's editor and closes the Modal. Useful when
    // the user wants to hand-edit the schema (e.g. tweak something the
    // LLM got wrong) and then either re-run Suggest Schema or Apply
    // the file's current state via the editor's save shortcut.
    if (this.options.onOpenFile) {
      const openFileBtn = btnRow.createEl('button', {
        text: t.schemaDiffOpenFileBtn ?? 'Open file',
      });
      openFileBtn.addEventListener('click', () => {
        this.options.onOpenFile?.();
        this.close();
      });
    }

    const cancelBtn = btnRow.createEl('button', {
      text: t.cancelButton ?? 'Cancel',
    });
    cancelBtn.addEventListener('click', () => {
      this.options.onCancel?.();
      this.close();
    });

    // v1.22.0 #97: Regenerate button HIDDEN for v1.22 release. The
    // handler in main.ts is wired and tested — we only hide the button
    // to ship a minimal release. The code below stays as a reference
    // for the v1.23 sprint that will re-enable it.
    //
    // const regenBtn = btnRow.createEl('button', {
    //   text: t.schemaDiffRegenerateBtn ?? 'Regenerate',
    // });
    // regenBtn.addEventListener('click', () => {
    //   if (this.isBusy) return;
    //   this.isBusy = true;
    //   regenBtn.disabled = true;
    //   void Promise.resolve(this.options.onRegenerate(this.regenerateHint))
    //     .finally(() => {
    //       this.isBusy = false;
    //       regenBtn.disabled = false;
    //     });
    // });

    const applyBtn = btnRow.createEl('button', {
      text: t.schemaDiffApplyBtn ?? 'Apply',
      cls: 'mod-cta',
    });
    // v1.22.0 #97: in empty mode there's nothing to apply — disable
    // the button so the user understands "Cancel or Regenerate".
    if (this.options.isEmpty) {
      applyBtn.disabled = true;
    }
    applyBtn.addEventListener('click', () => {
      if (this.isBusy) return;
      this.isBusy = true;
      applyBtn.disabled = true;
      void Promise.resolve(this.options.onApply())
        .then(() => { this.close(); })
        .catch((err: unknown) => {
          this.isBusy = false;
          applyBtn.disabled = false;
          console.error('Schema apply failed:', err);
        });
    });
  }

  private renderPane(leftPane: HTMLElement, rightPane: HTMLElement) {
    leftPane.empty();
    rightPane.empty();
    for (const row of this.rows) {
      buildDiffCell(leftPane, row.leftLineNo, row.leftText, row.op === 'del', 'left');
      buildDiffCell(rightPane, row.rightLineNo, row.rightText, row.op === 'add', 'right');
    }
  }

  private refresh() {
    // Re-render the diff panes in-place. We rebuild the onOpen DOM tree
    // and replace the two pane children.
    const { contentEl } = this;
    contentEl.empty();
    this.onOpen();
  }

  onClose() {
    removeDiffModalClasses(this.modalEl);
    this.contentEl.empty();
  }
}

/**
 * In empty mode, force newBody = currentBody so the diff is all "eq"
 * rows — both panes show the current schema, no red/green highlight,
 * no awkward blank right pane. When not in empty mode, return the
 * LLM's proposed newBody verbatim.
 *
 * NOTE: Implementation lives in `schema-diff-modal-classes.ts` so it can
 * be unit-tested without triggering Vite's import-analysis on `obsidian`.
 */
export { normalizeEmptyMode } from './schema-diff-modal-classes';
