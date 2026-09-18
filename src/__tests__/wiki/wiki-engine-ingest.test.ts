import { describe, it, expect } from 'vitest';
import { TFile } from 'obsidian'; // mocked in setup.ts
import { createWikiEngineHarness, wikiPagesWritten } from '../__support__/wiki-engine-harness';
import { hashBody } from '../../core/source-requirements';

// Build a TFile-shaped source file object. The engine reads path/basename/extension.
function sourceFile(path = 'sources/empty.md'): TFile {
  const name = path.split('/').pop() || path;
  const dot = name.lastIndexOf('.');
  return Object.assign(new TFile(), {
    path,
    basename: dot > 0 ? name.slice(0, dot) : name,
    extension: dot > 0 ? name.slice(dot + 1) : 'md',
  });
}

// A fabricated analysis as a small/local model would invent from a blank prompt.
const HALLUCINATED = JSON.stringify({
  source_title: 'Untitled',
  summary: 'fabricated from nothing',
  entities: [{ name: 'Some Hallucination', type: 'person', summary: '', mentions_in_source: [] }],
  concepts: [{ name: 'Made Up Concept', type: 'term', summary: '', mentions_in_source: [], related_concepts: [] }],
});

describe('WikiEngine.ingestSource — empty source (#164)', () => {
  it('creates NO wiki pages when ingesting an empty file (the real hallucination symptom)', async () => {
    // The bug was "an empty file yields >=1 wiki page". We assert the symptom
    // directly — no entity/concept/source page may be written — independent of
    // whatever name a model invents.
    const h = createWikiEngineHarness({
      files: { 'sources/empty.md': '' },
      llmResponses: [HALLUCINATED],
    });

    // Pre-gate code paths may throw ("analysis failed"); the symptom (zero
    // pages) must hold regardless of how the ingest terminates.
    try {
      await h.engine.ingestSource(sourceFile());
    } catch { /* tolerated — we assert on what was written, not on throwing */ }

    expect(wikiPagesWritten(h.writtenPaths)).toEqual([]);
  });

  it('skips cleanly (no throw) and reports a skip, without calling the LLM', async () => {
    // Drives the Phase C gate: an empty file must be a graceful skip, not an error.
    const h = createWikiEngineHarness({
      files: { 'sources/empty.md': '' },
      llmResponses: [HALLUCINATED],
    });

    await expect(h.engine.ingestSource(sourceFile())).resolves.toBeUndefined();

    const last = h.reports.at(-1);
    expect(last?.skipped).toBe(true);
    expect(last?.createdPages).toEqual([]);
    expect(h.stats.llmCalls).toBe(0);
  });
});

describe('WikiEngine.ingestSource — requirements gate (#164)', () => {
  it('rejects an unsupported file type without creating pages', async () => {
    // v1.25.0: PDFs are now supported (their own branch in ingestSource).
    // Use a still-unsupported binary type (PNG) to exercise the rejection path.
    const h = createWikiEngineHarness({ files: { 'sources/diagram.png': 'fake png bytes' } });
    await expect(h.engine.ingestSource(sourceFile('sources/diagram.png'))).resolves.toBeUndefined();
    expect(h.reports.at(-1)?.rejectedFiles?.[0]?.reason).toBe('incompatible-type');
    expect(wikiPagesWritten(h.writtenPaths)).toEqual([]);
    expect(h.stats.llmCalls).toBe(0);
  });

  it('skips a file whose content already exists in the wiki (cross-session dedup)', async () => {
    const dupBody = 'This exact body already lives in the wiki.';
    const h = createWikiEngineHarness({
      files: {
        // an existing source page carrying the content hash of dupBody
        'wiki/sources/old_abc123.md': `---\ntype: source\ncontentHash: ${hashBody(dupBody)}\n---\n\nold`,
        'sources/new-copy.md': dupBody,
      },
    });
    await expect(h.engine.ingestSource(sourceFile('sources/new-copy.md'))).resolves.toBeUndefined();
    expect(h.reports.at(-1)?.rejectedFiles?.[0]?.reason).toBe('duplicate');
    expect(wikiPagesWritten(h.writtenPaths)).toEqual([]);
    expect(h.stats.llmCalls).toBe(0);
  });

  it('flags a second identical file in the same batch as a duplicate', async () => {
    const h = createWikiEngineHarness();
    const ctx = h.engine.createBatchContext();
    expect(await h.engine.checkRequirements(sourceFile('sources/a.md'), 'identical body', ctx)).toBeNull();
    const dup = await h.engine.checkRequirements(sourceFile('sources/b.md'), 'identical body', ctx);
    expect(dup?.reason).toBe('duplicate');
  });

  it('prompts on a duplicate for interactive ingest and skips when the user declines', async () => {
    const dupBody = 'dup body';
    const h = createWikiEngineHarness({
      files: {
        'wiki/sources/x_1.md': `---\ntype: source\ncontentHash: ${hashBody(dupBody)}\n---\n\nx`,
        'sources/copy.md': dupBody,
      },
    });
    let prompted = false;
    h.engine.onConfirmReingest = async () => { prompted = true; return false; };

    await h.engine.ingestSource(sourceFile('sources/copy.md'), { interactive: true });

    expect(prompted).toBe(true);
    expect(h.reports.at(-1)?.skipped).toBe(true);
    expect(wikiPagesWritten(h.writtenPaths)).toEqual([]);
    expect(h.stats.llmCalls).toBe(0);
  });

  it('re-ingests past the gate when the interactive prompt is confirmed', async () => {
    const dupBody = 'dup body text';
    const h = createWikiEngineHarness({
      files: {
        'wiki/sources/x_1.md': `---\ntype: source\ncontentHash: ${hashBody(dupBody)}\n---\n\nx`,
        'sources/copy.md': dupBody,
      },
      llmResponses: [JSON.stringify({ source_title: 't', summary: 's', entities: [], concepts: [] })],
    });
    h.engine.onConfirmReingest = async () => true;

    // Confirming bypasses the duplicate skip → the engine proceeds to analysis
    // (which calls the LLM). Full ingest may hit mock edges; we only assert the
    // gate was passed.
    try { await h.engine.ingestSource(sourceFile('sources/copy.md'), { interactive: true }); } catch { /* mock edge */ }

    expect(h.stats.llmCalls).toBeGreaterThan(0);
  });
});

describe('WikiEngine.buildIngestedHashes — TTL cache (#164 review)', () => {
  it('reuses one vault walk across back-to-back checks within the TTL window', () => {
    // createBatchContext() is the public entry to buildIngestedHashes(). The cache
    // should make a second call within the TTL window read the snapshot instead of
    // re-walking vault.getMarkdownFiles() — the reviewer's perf concern.
    const h = createWikiEngineHarness({
      files: { 'wiki/sources/a.md': `---\ntype: source\ncontentHash: abc\n---\n\na` },
    });

    h.engine.createBatchContext();
    h.engine.createBatchContext();

    expect(h.stats.vaultMarkdownScans).toBe(1);
  });

  it('rebuilds the snapshot after a write invalidates the cache', async () => {
    // A fresh ingest writes a source page → invalidatePageCaches() must drop the
    // hash cache so the next check sees the just-written content (correctness, not
    // just perf — a 5s-stale snapshot would miss an immediate duplicate).
    const h = createWikiEngineHarness({
      files: { 'wiki/sources/a.md': `---\ntype: source\ncontentHash: abc\n---\n\na` },
    });

    h.engine.createBatchContext();
    expect(h.stats.vaultMarkdownScans).toBe(1);

    // A write (happy path: create) invalidates the cache without scanning itself.
    await h.engine.createOrUpdateFile('wiki/sources/b.md', `---\ntype: source\ncontentHash: def\n---\n\nb`);
    expect(h.stats.vaultMarkdownScans).toBe(1);

    h.engine.createBatchContext();
    expect(h.stats.vaultMarkdownScans).toBe(2);
  });
});

describe('WikiEngine.createOrUpdateFile — NFC/NFD path resolution (#173 Symptom A)', () => {
  it('resolves an existing file via directory scan when getAbstractFileByPath returns null', async () => {
    // Simulate macOS NFC/NFD normalization: the file exists in the vault but
    // getAbstractFileByPath returns null (the resolved path uses a different
    // Unicode normalization form from the stored filename).
    const h = createWikiEngineHarness({
      files: { 'wiki/sources/existing.md': `---\ntype: source\n---\n\nexisting content` },
      nfcNfdPaths: ['wiki/sources/existing.md'],
    });

    // The file is in the vault; nfcNfdPaths makes getAbstractFileByPath return
    // null for it. createOrUpdateFile should resolve it via resolveFileInVault
    // (directory-level scan, not full getMarkdownFiles) and call process().
    await h.engine.createOrUpdateFile('wiki/sources/existing.md', `---\ntype: source\n---\n\nupdated content`);

    // Content was updated (process was called, not create).
    expect(h.files.get('wiki/sources/existing.md')).toContain('updated content');

    // resolveFileInVault does a parent-directory listing, NOT a full
    // vault.getMarkdownFiles() scan — so vaultMarkdownScans must stay 0.
    expect(h.stats.vaultMarkdownScans).toBe(0);
  });

  it('still creates a new file normally when the path genuinely does not exist', async () => {
    const h = createWikiEngineHarness({});

    await h.engine.createOrUpdateFile('wiki/sources/new.md', 'fresh content');

    const written = h.files.get('wiki/sources/new.md');
    // The content was created rather than updated...
    expect(written).toContain('fresh content');
    // ...and `markPageComplete` has stamped it by now. This second assertion is
    // new and it replaces a race rather than relaxing one. `markPageComplete` is
    // fire-and-forget (`void (async () => …)()`), so whether it landed before the
    // caller resumed depended on how many async frames the write path took — the
    // #603 layer split added one, which made the stamp land here deterministically.
    // The stamp is correct (the page is complete); pinning it means this test now
    // asserts the resolved order instead of a coin flip.
    expect(written).toContain('generation_complete: true');
    // A new file creation should not trigger vaultMarkdownScans either.
    expect(h.stats.vaultMarkdownScans).toBe(0);
  });
});
