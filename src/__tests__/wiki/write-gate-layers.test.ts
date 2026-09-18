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
    // folders. Narrowing the whole layer would silently stop correcting a log.
    const h = createWikiEngineHarness({});

    await h.engine.createOrUpdateFile(
      'wiki/log.md',
      'Appended: [[entities/Qwen|entities/Qwen]]'
    );

    const written = h.files.get('wiki/log.md') ?? '';
    expect(written).toContain('[[entities/Qwen|Qwen]]');
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
