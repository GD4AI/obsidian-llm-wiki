/**
 * Which layers of the write gate a caller wants, and the page reference
 * shape that `wiki/lint` shares with the engine.
 *
 * Split out of `types.ts` by #929.
 */
/**
 * Which layers of the write gate a caller wants (Issue #603).
 *
 * The gate used to offer all of its four concerns or none, and different callers
 * need different subsets — the PDF sidecar's deliberate bypass at
 * `wiki-engine.ts:845-851` is the proof, since it opts out of notification to
 * avoid auto-ingest cascades. Naming the layers makes each call site's intent
 * checkable instead of inferred from silence.
 *
 * There is no default. A default is how the ambiguity this type exists to remove
 * would come back.
 */
export interface WriteIntent {
  /**
   * Pollution correction plus heading/provenance normalization —
   * `wiki/page-write-guard.ts`. For **wiki pages**. A log or a sidecar is not a
   * page and gains nothing from it.
   */
  guard: boolean;
  /**
   * `onFileWrite` + cache invalidation. For anything the file watcher must see.
   * The sidecar opts out deliberately.
   */
  notify: boolean;
  /**
   * Whether this write may bring a file that is gone back into existence.
   *
   * `fallback false` means update-only: if the file is not there, the write does
   * nothing. `markPageComplete` needs that, and it is the one layer of the three
   * that is a correctness requirement rather than a preference — see
   * `STAMP_WRITE_INTENT`.
   */
  create: boolean;
  /**
   * Which cancellation governs this write.
   *
   * The engine holds two independent controllers — `abortController` for an
   * ingest and `lintAbortController` for a lint run — and they overlap, because
   * `lint-wiki` is registered without an `isIngesting()` guard. A write that
   * reads the ingest controller while it is a lint write is stopped by the wrong
   * button, and a lint write that reads no controller ignores its own.
   * Naming the owner here is what keeps the two from being confused, rather
   * than the current run being inferred from whatever is non-null.
   */
  cancel: 'ingest' | 'lint' | 'none';
}

/**
 * The intent every existing caller of `createOrUpdateFile` already gets, kept as
 * a named constant so the compatibility path is not a bare literal that later
 * callers copy without noticing what it means.
 */
export const FULL_WRITE_INTENT: WriteIntent = {
  guard: true,
  notify: true,
  create: true,
  cancel: 'ingest',
};

/**
 * The `generation_complete` stamp — `markPageComplete`.
 *
 * Every layer is off except the one that is a requirement: **`create: false`**.
 * The stamp is deliberately un-awaited, so it runs against whatever happens
 * next, and what happens next can be a cancelled ingest deleting the summary
 * page it is stamping (`wiki-engine.ts` cancel cleanup). Granting it `vault.create`
 * lets it write the page back with `generation_complete: true` — the completion
 * marker returns, the source is skipped from then on, and which side wins the
 * race is undetermined, so it reproduces intermittently. #582/#583 removed
 * exactly that state; this constant is what keeps it removed.
 *
 * `guard: false` and `notify: false` match the pre-split form, which was a
 * `vault.process` on a resolved `TFile` and no notification. What this intent
 * *adds* over that form is the retry and the NFC/NFD recovery in `rawWrite` —
 * which is the whole of what was intended.
 *
 * `cancel: 'none'` because nothing gates this call. `markPageComplete` reaches
 * `rawWrite` directly, and `checkCancelled` lives in `writeFileWithIntent`, so an
 * `'ingest'` here would be a field the type's own contract says is declared
 * rather than inferred, sitting unread on the one intent whose comment explains
 * it. The stamp is not a button-gated operation: `create: false` is what protects
 * it, since it runs against whatever the ingest did next.
 */
export const STAMP_WRITE_INTENT: WriteIntent = {
  guard: false,
  notify: false,
  create: false,
  cancel: 'none',
};

/**
 * The lint fixers' write.
 *
 * Identical to `RAW_WRITE_INTENT` except for two fields, and neither is a
 * preference.
 *
 * **`cancel: 'lint'`** — the engine holds two controllers and they overlap,
 * because `lint-wiki` is registered with no `isIngesting()` guard. Reading the
 * ingest controller here made the lint writes stop on the ingest's cancel button
 * and ignore their own.
 *
 * **`create: false`** — and this is the half that the cancel fix opened. Both
 * call sites take their path from a scan of pages that exist, so update-only is
 * what they already mean; `create: true` was never wanted.
 *
 * It matters because both fixers write after an LLM call, and the page can go in
 * that window. The retag fixer is the one with a summary page in scope —
 * `scanTagViolations` accepts `pageType === 'source'` (`lint/scanners.ts:427`) —
 * and that page doubles as the completion marker the cancelled-ingest cleanup
 * deletes (`wiki-engine.ts:1592`); it resolves the file and re-reads it before
 * the call, so its window is read → LLM → write. The alias fixer has the wider
 * window, writing back the content the scan captured with no existence check at
 * all, but runs on entity and concept pages only (`programmatic.ts:37`), so it
 * cannot restore the marker. With `create: true` the retag path could put the
 * marker back, and every later trigger would skip the source: the #582/#583
 * state, reached through the retag path instead of the stamp path. Before the
 * cancel fix the ingest controller made that write throw, which was wrong for
 * the cancel reason and incidentally held this door shut. Nothing replaced it.
 */
export const LINT_WRITE_INTENT: WriteIntent = {
  guard: false,
  notify: false,
  create: false,
  cancel: 'lint',
};

/**
 * The operation log is a journal, not a page (Issue #603 slice 2).
 *
 * Dropping `guard` here fixes a real corruption: `LogWriter.pageLinks` builds its
 * links from **actual page paths**, so a page legitimately named `concepts布局优化`
 * under `wiki/concepts/` is written as `[[concepts/concepts布局优化]]` — correct as
 * written. The guard's path-prefix repair cannot distinguish that from LLM-emitted
 * duplication and rewrote it to `[[concepts/布局优化]]`, a dead link.
 *
 * `notify` stays on: the log is a vault file the watcher and the index must hear
 * about. Only the guard is dropped.
 */
export const LOG_WRITE_INTENT: WriteIntent = {
  guard: false,
  notify: true,
  create: true,
  cancel: 'ingest',

  // `guard: false` also drops the display-name correction and the sources
  // normalization, not only the path-prefix repair the paragraph above justifies.
  // Neither was ever wanted here — the log has no display name, and its `sources`
  // line is a projected link list, not the note's — so the narrower edit to the
  // log is the correct outcome rather than a side effect. Stated because the
  // design record named only the path-prefix repair, and a later reader deserves
  // to know the other two were considered.
};

/**
 * The PDF sidecar wants the write itself and nothing else (Issue #603 slice 2).
 *
 * This is the bypass that `wiki-engine.ts:845-851` already documented in prose —
 * going through the full gate would fire `onFileWrite` + `invalidatePageCaches`,
 * which "could trigger auto-ingest cascades if the source folder is watched". The
 * declaration makes that intent checkable instead of inferable from silence.
 */
export const RAW_WRITE_INTENT: WriteIntent = {
  guard: false,
  notify: false,
  create: true,
  cancel: 'ingest',
};

// Shape returned by wiki/lint/get-existing-pages.ts's getExistingWikiPages, shared
// with EngineContext's and WikiEngine's own accessors so the three don't drift
// out of sync with each other or with the field the implementation actually sets.
export interface WikiPageRef {
  path: string;
  title: string;
  displayTitle?: string;
  wikiLink: string;
  aliases?: string[];
  tags?: string[];
  ctime?: number;
  text?: string;
}
