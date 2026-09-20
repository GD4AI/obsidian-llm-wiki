// Issue #603 slice 1: the write gate's layers, wired.
//
// `page-write-guard.test.ts` covers the pure guard's semantics. These cover the
// **wiring** — that `createOrUpdateFile` actually reaches it, and that the layer
// boundary holds for paths that are not wiki content pages.
//
// The distinction matters, and #736 is the precedent: a test suite that exercises
// a unit in isolation stays green when the production code stops calling it. Each
// test here is written so that removing the corresponding call in
// `writeFileWithIntent` breaks it.

import { describe, it, expect } from 'vitest';
import { createWikiEngineHarness } from '../__support__/wiki-engine-harness';

describe('WikiEngine write gate — pageGuard layer is wired (#603)', () => {
  it('corrects display-name pollution on a page written through the gate', async () => {
    const h = createWikiEngineHarness({});

    await h.engine.createOrUpdateFile(
      'wiki/entities/Qwen.md',
      'Related: [[entities/Qwen|entities/Qwen]]'
    );

    const written = h.files.get('wiki/entities/Qwen.md') ?? '';
    // Assert the mutation, not just that something was written: the polluted form
    // must be gone and the corrected form present. A `toContain` alone would pass
    // on content that had both.
    expect(written).not.toContain('[[entities/Qwen|entities/Qwen]]');
    expect(written).toContain('[[entities/Qwen|Qwen]]');
  });

  it('corrects path-prefix pollution on a page written through the gate', async () => {
    const h = createWikiEngineHarness({});

    await h.engine.createOrUpdateFile(
      'wiki/concepts/chunking.md',
      'See [[concepts/conceptsChunking|Chunking]].'
    );

    const written = h.files.get('wiki/concepts/chunking.md') ?? '';
    expect(written).toContain('[[concepts/Chunking|Chunking]]');
  });

  it('normalizes the sources field on a page written through the gate', async () => {
    const h = createWikiEngineHarness({});

    await h.engine.createOrUpdateFile(
      'wiki/entities/Qwen.md',
      '---\ntype: entity\nsources:\n  - "[[Note.md]]"\n---\n\nBody'
    );

    const written = h.files.get('wiki/entities/Qwen.md') ?? '';
    expect(written).not.toContain('[[Note.md]]');
    expect(written).toContain('sources:');
  });

  it('applies pollution correction outside the wiki content folders too', async () => {
    // The layer boundary this pins: `guard` is *not* "wiki pages only". The
    // pollution patterns and the sources field are corrected on every write —
    // only the heading/provenance normalization is confined to the content
    // folders. Narrowing the whole layer would silently stop correcting
    // anything written outside them.
    //
    // The path is deliberately not `wiki/log.md`, which is what this test used to
    // write. The log stopped being an instance of this boundary when
    // `LogWriter` became its sole production writer with `LOG_WRITE_INTENT`
    // (`guard: false`) — so the old form asserted a behaviour that production no
    // longer reaches, and passed only because `createOrUpdateFile` still applies
    // the gate to whatever path it is handed. The boundary is the claim worth
    // keeping; the log is now its counter-example, and the describe block below
    // covers what the log actually does.
    const h = createWikiEngineHarness({});

    await h.engine.createOrUpdateFile(
      'wiki/notes/Qwen.md',
      'Appended: [[entities/Qwen|entities/Qwen]]'
    );

    const written = h.files.get('wiki/notes/Qwen.md') ?? '';
    expect(written).toContain('[[entities/Qwen|Qwen]]');
  });
});

describe('WikiEngine write gate — the log is not a wiki page (#603 slice 2)', () => {
  it('does not rewrite a log entry’s page links into dead links', async () => {
    // `LogWriter.pageLinks` builds its links from **real page paths** — it strips
    // the `wiki/` prefix because `[[wiki/concepts/X.md]]` renders dead while
    // `[[concepts/X.md]]` resolves. So a page genuinely named `concepts布局优化`
    // under `wiki/concepts/` is referenced as `[[concepts/concepts布局优化]]`,
    // which is **correct as written**.
    //
    // The gate's path-prefix pattern cannot tell that apart from LLM-emitted
    // duplication, and rewrites it to `[[concepts/布局优化]]` — a dead link. This
    // is the corruption the `guard: false` intent removes.
    const h = createWikiEngineHarness({});

    await h.engine.logLintFix('test', 'Fixed [[concepts/concepts布局优化]] and [[entities/Qwen]].');

    const written = h.files.get('wiki/log.md') ?? '';
    expect(written).toContain('[[concepts/concepts布局优化]]');
    expect(written).not.toContain('[[concepts/布局优化]]');
  });

  it('leaves h1-free log bodies untouched by heading normalization', async () => {
    // The second half of the same intent: heading/provenance normalization is
    // meaningless for a journal, and it was already excluded by
    // `isInWikiContentFolder`. Pinned so a later widening of `pageGuard` cannot
    // silently start reshaping the log.
    const h = createWikiEngineHarness({});

    await h.engine.logLintFix('test', 'Line one.\nLine two.');

    const written = h.files.get('wiki/log.md') ?? '';
    expect(written).toContain('Line one.\nLine two.');
  });

  it('still notifies the watcher when the log is written', async () => {
    // `guard: false` must not become `notify: false`. The log is a real vault
    // file the watcher and the index must hear about — only the *guard* is
    // dropped.
    const h = createWikiEngineHarness({});

    await h.engine.logLintFix('test', 'details');

    expect(h.writtenPaths).toContain('wiki/log.md');
  });
});

describe('WikiEngine write gate — notify layer is wired (#603)', () => {
  it('reports the write to onFileWrite', async () => {
    const h = createWikiEngineHarness({});

    await h.engine.createOrUpdateFile('wiki/entities/Qwen.md', 'Body');

    // `writtenPaths` is populated from the onFileWrite callback, so this asserts
    // the notification actually fired rather than that the file exists.
    expect(h.writtenPaths).toContain('wiki/entities/Qwen.md');
  });

  it('reports a created file and an updated file alike', async () => {
    const h = createWikiEngineHarness({
      files: { 'wiki/entities/Existing.md': '# Existing' },
    });

    await h.engine.createOrUpdateFile('wiki/entities/Existing.md', '# Existing v2');
    await h.engine.createOrUpdateFile('wiki/entities/BrandNew.md', '# New');

    expect(h.writtenPaths).toEqual([
      'wiki/entities/Existing.md',
      'wiki/entities/BrandNew.md',
    ]);
  });
});
