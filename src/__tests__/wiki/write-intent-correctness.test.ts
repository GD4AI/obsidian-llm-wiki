// Issue #603 slice 3 — the two correctness properties the declared write intent
// carries, one per layer.
//
// Both were found in review of the slice, by @DocTpoint, after the slice's own
// three mutations passed. That is the point of these tests: the mutations covered
// the wiring, and neither of these is a wiring question. One is "may this write
// create a file?", the other is "whose stop button governs this write?".

import { describe, it, expect } from 'vitest';
import { createWikiEngineHarness } from '../__support__/wiki-engine-harness';
import { LINT_WRITE_INTENT } from '../../types';
import type { WriteIntent } from '../../types';

describe('#603 slice 3 — a write that may not create', () => {
  it('leaves a page deleted when it disappears between the stamp read and the stamp write', async () => {
    // The probe is @DocTpoint's, kept as given, including the comment that made
    // it click: the interleaving is pinned rather than timed, so this cannot
    // become a flaky test that "usually" passes.
    //
    // Delete the page the instant the stamp reads it. On a freshly created page
    // the write itself performs no `get` (vault.create only sets), so the first
    // `get` of this path is the stamp's own `tryReadFile` — exactly the point
    // after which the cleanup's delete can land.
    const PATH = 'wiki/sources/Note.md';
    const h = createWikiEngineHarness({});

    const realGet = h.files.get.bind(h.files);
    let armed = true;
    h.files.get = ((key: string) => {
      const value = realGet(key);
      if (armed && key === PATH) {
        armed = false;
        h.files.delete(PATH);
      }
      return value;
    }) as typeof h.files.get;

    await h.engine.createOrUpdateFile(PATH, '---\ngeneration_complete: false\n---\n\nBody');

    // Let the un-awaited stamp settle.
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(h.files.has(PATH)).toBe(false);
  });

  it('still updates a page that is present', async () => {
    // The other half, so `create: false` cannot be satisfied by a write that
    // simply does nothing.
    const PATH = 'wiki/sources/Note.md';
    const h = createWikiEngineHarness({});

    await h.engine.createOrUpdateFile(PATH, '---\ngeneration_complete: false\n---\n\nBody');
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(h.files.get(PATH)).toContain('generation_complete: true');
  });
});

describe('#603 slice 3 — whose cancellation governs a write', () => {
  it('stops a lint write when the lint is cancelled', async () => {
    // Before this, the write gate read `abortController` — the ingest's — so the
    // lint's own stop button did not reach the lint's own writes: a cancelled
    // lint run kept writing pages. `runRetagViolations` re-throws AbortError
    // deliberately, so the run tore down with its earlier batches already on
    // disk and the user was not told.
    const h = createWikiEngineHarness({});
    h.engine.startLintOperation();
    h.engine.cancelLint();

    await expect(
      h.engine.writeFileWithIntent('wiki/entities/X.md', 'body', LINT_WRITE_INTENT)
    ).rejects.toThrow();
    expect(h.files.has('wiki/entities/X.md')).toBe(false);
  });

  it('lets a lint write through while the lint is running', async () => {
    // The page is pre-created: this intent is update-only (see the case below),
    // and the subject here is the cancel owner, not the create layer. Without
    // the fixture this test would have been asserting create-on-write by
    // accident, which is how it read until review pointed it out.
    const h = createWikiEngineHarness({ files: { 'wiki/entities/X.md': 'old body' } });
    h.engine.startLintOperation();

    await h.engine.writeFileWithIntent('wiki/entities/X.md', 'body', LINT_WRITE_INTENT);
    expect(h.files.get('wiki/entities/X.md')).toBe('body');
  });

  it('does not put back a summary page the cancelled ingest just deleted', async () => {
    // The second half of the same door, and the reason `create: false` belongs on
    // the lint intent. `scanTagViolations` accepts `pageType === 'source'`
    // (`lint/scanners.ts:427`), so a summary page is in retag scope, and that page
    // doubles as the completion marker the cancelled-ingest cleanup deletes
    // (`wiki-engine.ts:1592`). The retag fixer resolves and re-reads the file
    // before its LLM call, so its window is read → LLM → write — wide enough for
    // the cleanup to land in. A lint write that can create puts the marker back,
    // and every later trigger skips the source: the #582/#583 state, reached
    // through the retag path.
    const h = createWikiEngineHarness({
      files: { 'wiki/sources/Note.md': '---\ngeneration_complete: true\n---\n\nold' },
    });
    h.engine.startLintOperation();
    h.files.delete('wiki/sources/Note.md'); // the cancelled ingest's cleanup

    await h.engine.writeFileWithIntent(
      'wiki/sources/Note.md',
      '---\ngeneration_complete: true\n---\n\nnew',
      LINT_WRITE_INTENT
    );

    expect(h.files.has('wiki/sources/Note.md')).toBe(false);
  });

  it('still updates a page that is present, so update-only is not "does nothing"', async () => {
    // The control. The case above would also pass if the write were simply never
    // performed, which is the same trap the stamp's test needed a control for.
    const h = createWikiEngineHarness({
      files: { 'wiki/sources/Note.md': '---\ngeneration_complete: true\n---\n\nold' },
    });
    h.engine.startLintOperation();

    await h.engine.writeFileWithIntent('wiki/sources/Note.md', 'replaced', LINT_WRITE_INTENT);

    expect(h.files.get('wiki/sources/Note.md')).toBe('replaced');
  });
});

describe('#603 slice 3 — the layers after the write are consequences of a write', () => {
  it('does not notify or stamp for a write that did not happen', async () => {
    // `create: false` is a declared layer, so a future intent can pair it with
    // `guard` or `notify`. Both are consequences of a write and neither may run
    // for one that did not happen — otherwise `onFileWrite` fires for an
    // unwritten path and a completion stamp is spawned for a page that is not
    // there. No shipped intent has that combination, so this test declares one.
    //
    // Written after review pointed out that `writeFileWithIntent` only checked
    // `recovered`: unreachable then, and exactly where it would have bitten next.
    const h = createWikiEngineHarness({});
    const ghost: WriteIntent = { guard: true, notify: true, create: false, cancel: 'none' };

    await h.engine.writeFileWithIntent('wiki/entities/Ghost.md', 'body', ghost);

    expect(h.files.has('wiki/entities/Ghost.md')).toBe(false);
    expect(h.writtenPaths).not.toContain('wiki/entities/Ghost.md');
  });

  it('still notifies when the write did happen', async () => {
    // The control: the guard must not be satisfied by notify being broken
    // outright. Needs the page to exist, because this intent is update-only —
    // the first version of this control wrote to a missing path and asserted
    // notify, which is the same fixture mistake review caught elsewhere.
    const h = createWikiEngineHarness({ files: { 'wiki/entities/Real.md': 'old' } });
    const intent: WriteIntent = { guard: false, notify: true, create: false, cancel: 'none' };

    await h.engine.writeFileWithIntent('wiki/entities/Real.md', 'body', intent);

    expect(h.writtenPaths).toContain('wiki/entities/Real.md');
  });
});
