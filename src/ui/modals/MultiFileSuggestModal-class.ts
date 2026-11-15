// MultiFileSuggestModal — v1.23.0 (#130)
//
// Two-pane file picker: left column lists all non-wiki markdown files
// in the vault; right column shows the current selection queue. User
// toggles files with a checkbox, then confirms with the "Start Ingest"
// button at the bottom.
//
// Dedupe: adding the same file twice is a no-op (the second toggle
// un-checks it).
//
// Clear: a "Clear Queue" button drops all pending entries.
//
// The selected files are NOT moved (the original #130 requirement —
// in-place ingest avoids breaking the source-path provenance).
//
// Extracted from the original `src/ui/modals.ts` god file (PR split).
// No behavior change — pure code movement.

import { App, Modal, TFile } from 'obsidian';
import type { LLMWikiSettings } from '../../types';
import { getText } from '../../core/i18n';
import { buildFolderTree, type TreeNode } from '../../core/build-folder-tree';
import type { IngestQueue } from '../../core/ingest-queue';
import { COMPATIBLE_SOURCE_EXTENSIONS } from '../../constants';
import { isExcludedFromSourcePicker } from '../../core/folder-scope';
import { slugify } from '../../core/slug';
import { pageBelongsToNote, noteDriftState, type IngestDiskState } from '../../core/ingest-state';
import { resolveRowState, type RowState } from './multi-file-row-state';

export class MultiFileSuggestModal extends Modal {
  /** The shared ingest queue. Modal reads + subscribes; never owns
   * the data. */
  private ingestQueue: IngestQueue;
  /** Folder name used to filter wiki files out of the candidate set.
   * Comes from settings (the user-configurable wiki folder). */
  private wikiFolder: string;
  /** Called when the user clicks "Add to queue" with the newly
   * enqueued job ids and the corresponding files. main.ts wires
   * this to `runBatchIngest` so the worker picks them up using
   * the pre-issued ids (re-enqueueing inside runBatchIngest would
   * be a no-op — enqueue is idempotent against in-flight jobs,
   * and the worker would then have no ids to publish start/
   * complete transitions on). The ids+files arrays are aligned
   * by index. If null, the button is hidden and the user is
   * expected to drive ingest from elsewhere (e.g. for tests). */
  private onStartIngest: ((ids: string[], files: TFile[]) => void) | null;
  /** Settings (read-only). Only the `language` field is consulted
   * (for i18n of the cancel-all button). Modal does not mutate
   * settings. */
  private settings: LLMWikiSettings;
  private leftEl!: HTMLElement;
  private rightEl!: HTMLElement;
  private counterEl!: HTMLElement;
  private searchInput!: HTMLInputElement;
  private confirmBtn!: HTMLButtonElement;
  /**
   * Unsubscribe function returned by `ingestQueue.subscribe`. Called
   * in onClose to detach the listener so a re-opened modal doesn't
   * fire on a dead DOM.
   */
  private unsubscribeQueue: (() => void) | null = null;
  /**
   * Nested folder tree built once in onOpen. Recursive walk in
   * buildLeftPane produces the Obsidian-file-explorer-style
   * nested <details> UI. The left pane DOM is built ONCE per
   * onOpen; subsequent updates are in-place via
   * `refreshRowStates` so user-collapsed folders stay
   * collapsed.
   */
  private treeRoots: TreeNode[] = [];
  /**
   * Flat candidate list behind `treeRoots`, kept so the disk scan can
   * walk it without re-flattening the tree.
   */
  private candidates: TFile[] = [];
  /**
   * The user's selection, by path. #598: this used to live in the DOM
   * and be reassigned from queue membership on every queue mutation,
   * which silently discarded any selection made while a batch ran. The
   * checkbox now renders this set and means only "I picked this".
   *
   * Holding it here (rather than in the DOM) also survives the search
   * filter, which rebuilds the left pane from scratch.
   */
  private selected: Set<string> = new Set();
  /**
   * What each candidate's `sources/` page says about it, filled by
   * `scanDiskStates` after the pane is up. Empty until then — a row with
   * no entry renders as never ingested, which is what the picker showed
   * unconditionally before.
   */
  private diskStates: Map<string, IngestDiskState> = new Map();
  /**
   * Generation counter for the disk scan. Bumped on every scan start and
   * on close, so a scan that outlives its modal drops its result instead
   * of painting a dead DOM.
   */
  private diskScanToken = 0;

  constructor(
    app: App,
    settings: LLMWikiSettings,
    ingestQueue: IngestQueue,
    onStartIngest?: (ids: string[], files: TFile[]) => void,
  ) {
    super(app);
    this.settings = settings;
    this.wikiFolder = settings.wikiFolder;
    this.ingestQueue = ingestQueue;
    this.onStartIngest = onStartIngest ?? null;
  }

  onOpen(): void {
    const { contentEl, modalEl } = this;
    contentEl.empty();
    // Add the class to BOTH the outer modal container AND the inner
    // content. Obsidian's default `.modal` width caps the content;
    // sizing only `contentEl` is clipped to the parent's width and
    // the inner `width: 80vw` becomes a no-op. The `.modal.llm-wiki-…`
    // selector in styles.css targets the outer container.
    // Same trick schema-diff-modal uses (v1.22.0 #97).
    contentEl.addClass('llm-wiki-multi-file-modal');
    modalEl.addClass('llm-wiki-multi-file-modal');

    // Build the candidate list (non-wiki, non-configDir, compatible extensions)
    // and the nested folder tree ONCE. The tree is then rendered once and
    // updated in place — re-rendering on every queue change would
    // close every <details> and force the user to re-expand
    // folders (the bug v2 fixes). v1.25.0 PR2: include PDFs.
    const compatibleExts: readonly string[] = COMPATIBLE_SOURCE_EXTENSIONS;
    const available = this.app.vault.getFiles()
      .filter(f => !isExcludedFromSourcePicker(f.path, this.wikiFolder, this.app.vault.configDir))
      .filter(f => compatibleExts.includes(f.extension.toLowerCase()))
      .sort((a, b) => a.path.localeCompare(b.path));
    this.candidates = available;
    this.treeRoots = buildFolderTree(available);

    contentEl.createEl('h3', { text: getText(this.settings.language, 'multiFileModalTitle') });
    contentEl.createEl('p', {
      text: getText(this.settings.language, 'multiFileModalHint'),
      cls: 'llm-wiki-modal-hint',
    });

    this.searchInput = contentEl.createEl('input', {
      type: 'text',
      placeholder: getText(this.settings.language, 'multiFileSearchPlaceholder'),
      cls: 'llm-wiki-multi-file-search',
    });
    // Search re-runs the LEFT pane only (the tree's visible
    // set changes). The right pane is driven by the queue, not
    // the search query.
    this.searchInput.addEventListener('input', () => this.buildLeftPane());

    const panes = contentEl.createDiv({ cls: 'llm-wiki-multi-file-panes' });
    this.leftEl = panes.createDiv({ cls: 'llm-wiki-multi-file-left' });
    this.rightEl = panes.createDiv({ cls: 'llm-wiki-multi-file-right' });

    const actions = contentEl.createDiv({ cls: 'llm-wiki-multi-file-actions' });
    this.counterEl = actions.createSpan({ cls: 'llm-wiki-multi-file-count' });
    // "Cancel all" sits next to the counter. Replaces the old
    // "Clear queue" button (which was a UX dead-end — it never
    // cancelled the background worker). One click removes every
    // pending job and fires the AbortController on any running
    // job; completed/failed jobs are preserved (the user can still
    // see the result). v1.23.0 Phase 5.1.5 stage 3.
    const cancelAllBtn = actions.createEl('button', {
      text: getText(this.settings.language, 'cancelAllQueueJobs'),
      cls: 'llm-wiki-multi-file-cancel-all',
    });
    cancelAllBtn.addEventListener('click', () => {
      // Snapshot first — remove() mutates the underlying array.
      const jobs = this.ingestQueue.getSnapshot();
      for (const job of jobs) {
        if (job.status === 'pending' || job.status === 'running') {
          this.ingestQueue.remove(job.id);
        }
      }
    });
    this.confirmBtn = actions.createEl('button', {
      text: getText(this.settings.language, 'multiFileAddToQueue'),
      cls: 'mod-cta',
    });
    this.confirmBtn.addEventListener('click', () => {
      // Collect every checked file and enqueue them. enqueue is
      // idempotent against in-flight jobs, so re-clicking the
      // button is harmless.
      const checkedFiles = this.collectCheckedFiles();
      if (checkedFiles.length === 0) return;
      const newIds = this.ingestQueue.enqueue(checkedFiles);
      // Nothing new was created (everything picked is already in
      // flight): leave the marks alone, the user's intent is unspent.
      if (newIds.length === 0) return;
      // The marks are committed — the queue pane now carries them.
      // Leaving them ticked would re-submit the same set on the next
      // click, which was invisible while the checkbox WAS the queue.
      this.selected.clear();
      this.refreshRowStates();
      if (this.onStartIngest) {
        // Pass both the newly-issued ids and the corresponding
        // files. The worker uses the ids to publish start/
        // complete transitions on each job — without ids, it
        // would have no way to update the queue (enqueue is
        // idempotent and the second call would return no ids).
        this.onStartIngest(newIds, checkedFiles);
      }
      // The modal stays open — the user can watch the right pane
      // for live progress, or close it (the ingest continues in
      // the background).
    });

    // Build the left pane once. Subsequent changes to the queue
    // are reflected by refreshRowStates() in place.
    this.buildLeftPane();
    // Subscribe AFTER the initial build so we don't double-render
    // on the first notify.
    this.unsubscribeQueue = this.ingestQueue.subscribe(() => {
      this.renderRightPane();
      this.refreshRowStates();
      this.updateCounter();
    });
    this.renderRightPane();
    this.updateCounter();
    // Read the vault for what is already ingested. Async and after the
    // first paint: the pane must not wait on IO, and every row is
    // already in its correct pre-scan state.
    void this.scanDiskStates();
  }

  onClose(): void {
    this.contentEl.empty();
    // Remove the outer modal class on close so the next modal opened
    // on the same `modalEl` doesn't accidentally inherit our width.
    // Same lifecycle pattern as SchemaDiffModal (v1.22.0 #97).
    this.modalEl.removeClass('llm-wiki-multi-file-modal');
    // Detach the queue listener. Without this, a re-opened modal
    // would fire its renderRightPane on a DOM that no longer
    // exists in the visible modal.
    if (this.unsubscribeQueue) {
      this.unsubscribeQueue();
      this.unsubscribeQueue = null;
    }
    // Invalidate any scan still in flight (see `diskScanToken`).
    this.diskScanToken += 1;
  }

  private buildLeftPane(): void {
    this.leftEl.empty();
    const q = this.searchInput?.value?.trim().toLowerCase() ?? '';

    if (this.treeRoots.length === 0) {
      this.leftEl.createEl('p', {
        text: getText(this.settings.language, 'multiFileNoFilesAvailable'),
        cls: 'llm-wiki-multi-file-empty',
      });
      return;
    }

    // If the search filter excludes every file, show a single empty
    // placeholder (matches the old behavior).
    const anyVisible = this.treeRoots.some(root => this.nodeOrDescendantMatches(root, q));
    if (!anyVisible) {
      this.leftEl.createEl('p', {
        text: q
          ? getText(this.settings.language, 'multiFileNoFilesMatch', { q })
          : getText(this.settings.language, 'multiFileNoFilesAvailable'),
        cls: 'llm-wiki-multi-file-empty',
      });
      return;
    }

    // Recursively walk the tree. Each TreeNode renders as a
    // <details>/<summary> with its own "select all" (covers direct
    // children only — no recursion into subfolders, by design so a
    // "Select all" on year doesn't silently include every month).
    for (const root of this.treeRoots) {
      this.renderTreeNode(root, this.leftEl, q, /* depth */ 0);
    }
    // Sync checkbox state with the queue snapshot. The DOM was
    // rebuilt above with default unchecked state — this turns on
    // the checkboxes for files that are already pending/running/
    // completed. Called on every build (initial onOpen AND search
    // input change) so the visual stays consistent with the
    // store regardless of how the modal was last left.
    this.refreshRowStates();
  }

  /**
   * Recursively render a TreeNode as a <details> block, with its
   * direct-child files and subfolders underneath.
   *
   * The synthetic root (`path === ''`) is rendered WITHOUT its own
   * <details> wrapper — its children are rendered as direct
   * top-level entries. This avoids a "faux root" toggle that
   * confuses users (no Obsidian file explorer has a "vault root"
   * wrapper).
   */
  private renderTreeNode(
    node: TreeNode,
    container: HTMLElement,
    q: string,
    depth: number,
  ): void {
    const visibleFiles = q
      ? node.files.filter(f => f.path.toLowerCase().includes(q))
      : node.files;
    const visibleChildren = q
      ? node.children.filter(c => this.nodeOrDescendantMatches(c, q))
      : node.children;

    // The synthetic root has no real TFolder, so skip the <details>
    // wrapper for it. Just emit its children.
    if (node.path === '') {
      // Render the root's direct files inline (rare — only when
      // some file has chain.length === 0).
      for (const file of visibleFiles) {
        this.renderFileRow(file, container);
      }
      for (const child of visibleChildren) {
        this.renderTreeNode(child, container, q, depth);
      }
      return;
    }

    const details = container.createEl('details', { cls: 'llm-wiki-multi-file-folder llm-wiki-multi-file-depth-' + depth });
    // Auto-expand on search, but only at depth 0-1. Deeper nodes
    // stay collapsed so the user can scan the matches.
    if (q && depth <= 1) details.setAttr('open', '');

    const summary = details.createEl('summary', { cls: 'llm-wiki-multi-file-folder-header' });
    // Show the LAST path segment as the folder name (matches
    // Obsidian's file explorer — full path is already implied by
    // the nesting depth). The full path lives on `data-path` for
    // debugging / future features.
    const folderLabel = node.path.split('/').pop() ?? node.path;
    summary.createSpan({ text: folderLabel, cls: 'llm-wiki-multi-file-folder-name' });
    summary.setAttribute('data-path', node.path);
    summary.createSpan({
      text: getText(this.settings.language, 'multiFileFileCount', { count: String(visibleFiles.length) }),
      cls: 'llm-wiki-multi-file-folder-count',
    });
    // Inline "Select all" — ticks every visible checkbox in this
    // folder (direct children only). Does NOT enqueue — that
    // happens when the user clicks "Add to queue". The two-step
    // flow (mark → commit) keeps the ingest start under explicit
    // user control.
    const selectAllBtn = summary.createEl('button', {
      text: getText(this.settings.language, 'multiFileSelectAll'),
      cls: 'llm-wiki-multi-file-folder-bulk',
    });
    selectAllBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Tick every checkbox in THIS folder's direct file list.
      // The `:scope >` selector restricts to direct children of
      // the current <details> node so nested subfolders are NOT
      // affected — each subfolder has its own "Select all".
      const parent = summary.parentElement;
      if (!parent) return;
      const checkboxes = parent.querySelectorAll<HTMLInputElement>(
        ':scope > .llm-wiki-multi-file-folder-list input[type="checkbox"][data-file-path]'
      );
      checkboxes.forEach(cb => {
        // Skip rows locked by a completed job — assigning `.checked`
        // bypasses `disabled`, so without this the bulk button could
        // mark a row the user cannot unmark.
        if (cb.disabled) return;
        cb.checked = true;
        if (cb.dataset.filePath) this.setSelected(cb.dataset.filePath, true);
      });
    });

    // Direct-child files
    if (visibleFiles.length > 0) {
      const list = details.createDiv({ cls: 'llm-wiki-multi-file-folder-list' });
      for (const file of visibleFiles) {
        this.renderFileRow(file, list);
      }
    }

    // Recurse into subfolders. Each child renders its own
    // <details> with its own "Select all".
    for (const child of visibleChildren) {
      this.renderTreeNode(child, details, q, depth + 1);
    }
  }

  /**
   * Render a single file row. The checkbox carries a data attribute
   * so `refreshRowStates` can find it without re-walking
   * the tree structure.
   */
  private renderFileRow(file: TFile, container: HTMLElement): void {
    const row = container.createDiv({ cls: 'llm-wiki-multi-file-row' });
    const checkbox = row.createEl('input', { type: 'checkbox' });
    checkbox.dataset.filePath = file.path;
    checkbox.addEventListener('change', () => this.setSelected(file.path, checkbox.checked));
    // v1.23.0 Phase 5.1.5 stage 4: ticking a checkbox does NOT
    // enqueue. The user has to explicitly click "Add to queue" to
    // commit the selection. This matches the v1 git-style
    // two-step flow (mark → commit) and prevents the modal from
    // firing ingest on every click — which previously made the
    // "Add to queue" button a no-op (everything was already in
    // flight by the time the user found it).
    //
    // The checkbox state is purely a UI marker. The queue only
    // changes when "Add to queue" fires enqueue() (or when the
    // queue changes externally, e.g. the background worker
    // completes a job — handled by updateLeftPaneSelections).
    const basename = file.path.split('/').pop() ?? file.path;
    row.createSpan({ text: basename, cls: 'llm-wiki-multi-file-basename' });
    // Whole row toggles the checkbox (skip the checkbox itself).
    row.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).tagName !== 'INPUT') {
        // Assigning `.checked` bypasses `disabled` and fires no
        // `change` event, so the guard and the bookkeeping are both
        // ours to do here.
        if (checkbox.disabled) return;
        checkbox.checked = !checkbox.checked;
        this.setSelected(file.path, checkbox.checked);
      }
    });
  }

  /**
   * Repaint every left-pane row from the three things that describe it:
   * the user's selection, this session's queue, and what the vault says.
   * Walks the live DOM via a single `querySelectorAll`.
   *
   * Why we don't re-render the whole tree: rebuilding the tree
   * would close every <details> the user had expanded, which was
   * the v1 UX bug. In-place updates preserve the user's tree
   * state.
   *
   * Performance: O(N) in the number of file rows (~thousands max).
   * Acceptable — this fires on every queue mutation.
   */
  private refreshRowStates(): void {
    const queue = this.ingestQueue.getSnapshot();
    const queuedPaths = new Set(
      queue
        .filter(j => j.status === 'pending' || j.status === 'running')
        .map(j => j.file.path)
    );
    const completedPaths = new Set(
      queue.filter(j => j.status === 'completed').map(j => j.file.path)
    );
    const rows = this.leftEl.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-file-path]');
    rows.forEach(checkbox => {
      const path = checkbox.dataset.filePath;
      if (!path) return;
      // The decision itself lives in multi-file-row-state.ts, where it
      // can be tested — the Modal base class cannot be instantiated
      // outside Obsidian, so anything decided in here is verified by
      // reading only, which is how #598 stayed unnoticed.
      const state = resolveRowState({
        selected: this.selected.has(path),
        queued: queuedPaths.has(path),
        completed: completedPaths.has(path),
        disk: this.diskStates.get(path) ?? 'none',
      });
      checkbox.checked = state.checked;
      checkbox.disabled = state.disabled;
      const row = checkbox.closest<HTMLElement>('.llm-wiki-multi-file-row');
      if (!row) return;
      for (const [cls, on] of Object.entries(state.classes)) {
        row.classList.toggle(cls, on);
      }
      this.renderDiskLabel(row, state.labelKey);
    });
  }

  /**
   * Put (or remove) the disk-state label on one row. Idempotent — the
   * row keeps at most one label element across repaints.
   *
   * `llm-wiki-multi-file-ingested-tag` was already in styles.css, and
   * the old comment in `refreshRowStates` called it "the visual
   * 'Ingested' tag" — but no code ever rendered it, so the greyed row
   * was the only cue there had ever been. This is the element that rule
   * was written for.
   */
  private renderDiskLabel(row: HTMLElement, labelKey: RowState['labelKey']): void {
    const existing = row.querySelector<HTMLElement>('.llm-wiki-multi-file-ingested-tag');
    if (labelKey === null) {
      if (existing) existing.remove();
      return;
    }
    const el = existing ?? row.createSpan({ cls: 'llm-wiki-multi-file-ingested-tag' });
    el.setText(getText(this.settings.language, labelKey));
  }

  /**
   * Ask the vault which candidates already have a `sources/` page, and
   * whether their note has changed since. Runs once per `onOpen`.
   *
   * Direction matters: this resolves note → slug → page, the same way
   * `isAlreadyIngested` does, rather than indexing the `sources/` folder
   * and inverting it. An inverted index cannot attribute a page with no
   * recorded origin to any note, and would disagree with the skip check
   * on exactly those pages — see `pageBelongsToNote`.
   *
   * Cost is bounded by the number of `sources/` pages, not by the vault:
   * a candidate whose page is absent costs one path lookup and no read,
   * and pages are read once even when several notes slug-collide.
   */
  private async scanDiskStates(): Promise<void> {
    const token = ++this.diskScanToken;
    const preserveCase = this.settings.slugCase === 'preserve';
    const states = new Map<string, IngestDiskState>();
    const pageCache = new Map<string, string | null>();

    for (const file of this.candidates) {
      // The modal was closed, or a newer scan started: drop this one.
      if (token !== this.diskScanToken) return;
      const pagePath = `${this.wikiFolder}/sources/${slugify(file.basename, preserveCase)}.md`;
      let pageContent = pageCache.get(pagePath);
      if (pageContent === undefined) {
        pageContent = await this.readOrNull(pagePath);
        pageCache.set(pagePath, pageContent);
      }
      if (pageContent === null) continue;
      if (!pageBelongsToNote(pageContent, file.path)) continue;
      const noteContent = await this.readOrNull(file.path);
      // #677: `links-only` is not drift. A page move rewrites inbound links through
      // Obsidian, so a note nobody edited gains characters on disk; the row must keep
      // saying "ingested" rather than send the user to re-read a note that is unchanged.
      const state = noteContent === null ? 'unknown' : noteDriftState(pageContent, noteContent);
      states.set(file.path, state === 'edited' ? 'drifted' : 'ingested');
    }

    if (token !== this.diskScanToken) return;
    this.diskStates = states;
    this.refreshRowStates();
  }

  /**
   * Read a vault file by path, or null when it is absent, is a folder,
   * or cannot be read. `cachedRead` rather than `read`: this feeds a
   * display hint, not a write decision.
   */
  private async readOrNull(path: string): Promise<string | null> {
    const abstract = this.app.vault.getAbstractFileByPath(path);
    if (!(abstract instanceof TFile)) return null;
    try {
      return await this.app.vault.cachedRead(abstract);
    } catch {
      return null;
    }
  }

  /** Record (or clear) the user's mark on one row. */
  private setSelected(path: string, on: boolean): void {
    if (on) this.selected.add(path);
    else this.selected.delete(path);
  }

  /**
   * True if this node has any file matching `q`, OR any descendant
   * subtree does. Used to filter the rendered tree when a search
   * is active.
   */
  private nodeOrDescendantMatches(
    node: TreeNode,
    q: string,
  ): boolean {
    if (!q) return true;
    if (node.files.some(f => f.path.toLowerCase().includes(q))) return true;
    return node.children.some(c => this.nodeOrDescendantMatches(c, q));
  }

  // ── Right pane: live queue snapshot ─────────────────────────

  /**
   * Render the right pane from the current queue snapshot. Fires
   * on every queue mutation (via the subscription set up in
   * onOpen). The simple "list of paths + status" rendering here
   * is intentionally minimal — v1.23.0 Phase 5.1.5 stage 3 will
   * add per-row status icons + cancel buttons.
   */
  private renderRightPane(): void {
    this.rightEl.empty();
    const jobs = this.ingestQueue.getSnapshot();
    if (jobs.length === 0) {
      this.rightEl.createEl('p', {
        text: getText(this.settings.language, 'multiFileQueueEmpty'),
        cls: 'llm-wiki-multi-file-empty',
      });
      return;
    }
    for (const job of jobs) {
      const row = this.rightEl.createDiv({
        cls: `llm-wiki-multi-file-row llm-wiki-multi-file-row-${job.status}`,
      });
      // Status icon as a leading marker. The text is the user's
      // language (no i18n here — these are single-glyph markers
      // the same in every locale).
      const statusIcon =
        job.status === 'pending' ? '🟡' :
        job.status === 'running' ? '🔵' :
        job.status === 'completed' ? '✅' :
        '❌';
      row.createSpan({ text: statusIcon, cls: 'llm-wiki-multi-file-status-icon' });
      const basename = job.file.path.split('/').pop() ?? job.file.path;
      row.createSpan({ text: basename, cls: 'llm-wiki-multi-file-basename' });
      // Status text is i18n'd. The internal `job.status` enum
      // string stays English (data attribute on the row's class is
      // used for CSS styling — `llm-wiki-multi-file-row-pending`
      // etc.) so we keep the enum string in the class but use the
      // localized label for display.
      const statusTextKey =
        job.status === 'pending' ? 'multiFileStatusPending' :
        job.status === 'running' ? 'multiFileStatusRunning' :
        job.status === 'completed' ? 'multiFileStatusCompleted' :
        'multiFileStatusFailed';
      row.createSpan({ text: getText(this.settings.language, statusTextKey), cls: 'llm-wiki-multi-file-status' });
      if (job.error) {
        row.createSpan({ text: job.error, cls: 'llm-wiki-multi-file-error' });
      }
      // Per-row cancel button. Disabled for terminal-state jobs
      // (completed / failed) — remove() would drop the error
      // info on a failed job, and a completed job has nothing to
      // cancel. The visual signal is the icon next to the row.
      // Only pending and running are cancellable: pending just
      // removes from the queue; running fires the AbortController
      // so the worker can stop mid-flight.
      const cancelBtn = row.createEl('button', {
        text: '✕',
        cls: 'llm-wiki-multi-file-cancel',
        attr: { 'aria-label': getText(this.settings.language, 'multiFileCancelAria') },
      });
      const isCancellable = job.status === 'pending' || job.status === 'running';
      cancelBtn.disabled = !isCancellable;
      if (isCancellable) {
        cancelBtn.addEventListener('click', () => {
          this.ingestQueue.remove(job.id);
        });
      }
    }
  }

  /**
   * Update the bottom counter ("N pending · M done · K failed")
   * from the queue snapshot. Triggers on every queue mutation.
   */
  private updateCounter(): void {
    const jobs = this.ingestQueue.getSnapshot();
    const pending = jobs.filter(j => j.status === 'pending' || j.status === 'running').length;
    const completed = jobs.filter(j => j.status === 'completed').length;
    const failed = jobs.filter(j => j.status === 'failed').length;
    this.counterEl.setText(
      `${pending} pending · ${completed} done · ${failed} failed`
    );
  }

  // ── "Add to queue" button support ───────────────────────────

  /**
   * Collect every file the user has marked. Reads `selected` rather
   * than the DOM: the search filter rebuilds the left pane, so a
   * DOM-only selection lost every mark outside the current query.
   * Sorted by path to keep the ingest order the tree order.
   */
  private collectCheckedFiles(): TFile[] {
    const result: TFile[] = [];
    const paths = [...this.selected].sort((a, b) => a.localeCompare(b));
    for (const path of paths) {
      const file = this.findFileByPath(path);
      if (file) result.push(file);
    }
    return result;
  }

  private findFileByPath(path: string): TFile | null {
    for (const root of this.treeRoots) {
      const found = this.findFileInNode(root, path);
      if (found) return found;
    }
    return null;
  }

  private findFileInNode(
    node: TreeNode,
    path: string,
  ): TFile | null {
    for (const f of node.files) if (f.path === path) return f;
    for (const c of node.children) {
      const found = this.findFileInNode(c, path);
      if (found) return found;
    }
    return null;
  }
}