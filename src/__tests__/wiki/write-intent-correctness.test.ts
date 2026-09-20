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
    const h = createWikiEngineHarness({});
    h.engine.startLintOperation();

    await h.engine.writeFileWithIntent('wiki/entities/X.md', 'body', LINT_WRITE_INTENT);
    expect(h.files.get('wiki/entities/X.md')).toBe('body');
  });
});
