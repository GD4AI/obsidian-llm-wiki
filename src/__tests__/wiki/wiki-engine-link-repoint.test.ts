// End-of-run link pass (Stage 4.5).
//
// A page written early in an ingest links to a sibling that does not exist
// yet. The write-time corrector can only trust the extraction's folder for
// it, and the sibling may land in the other folder once dedup decides.
// Measured 2026-09-03 on a 3,025-page vault: 35 folder-wrong links sat in
// Related sections of pages whose target was born in the same run —
// `entities/Creatin` → `[[concepts/Phosphocreatin]]` among them, while
// Phosphocreatin lives under entities/. Only at the end of the run does the
// vault know; this pass asks it then.

import { describe, it, expect } from 'vitest';
import { TFile } from 'obsidian';
import { createWikiEngineHarness } from '../__support__/wiki-engine-harness';

const NOTE = 'Notizen/Creatin.md';

const ANALYSIS = JSON.stringify({
  source_title: 'Creatin',
  summary: 'Creatin und Phosphocreatin.',
  entities: [
    // The extraction calls Phosphocreatin a concept on Creatin's page …
    { name: 'Creatin', type: 'person', summary: 'x', mentions_in_source: [], related_concepts: ['Phosphocreatin'] },
    // … and extracts it as an entity of its own, written after Creatin.
    { name: 'Phosphocreatin', type: 'person', summary: 'y', mentions_in_source: [] },
  ],
  concepts: [],
  contradictions: [],
  related_pages: [],
  key_points: [],
});

const SUMMARY = [
  '---', 'type: source', '---', '# Creatin - Summary', '',
  '## Key Concepts', '- [[concepts/Phosphocreatin|Phosphocreatin]]', '',
].join('\n');

const CREATIN_PAGE = [
  '---', 'type: entity', '---', '# Creatin', '',
  '## Description', 'Regeneration über [[concepts/Phosphocreatin|Phosphocreatin]].', '',
  '## Related Concepts', '- [[concepts/Phosphocreatin|Phosphocreatin]]', '',
].join('\n');

const PHOSPHO_PAGE = ['---', 'type: entity', '---', '# Phosphocreatin', '', '## Description', 'Energiespeicher.', ''].join('\n');

function note(): TFile {
  return Object.assign(new TFile(), { path: NOTE, name: 'Creatin.md', basename: 'Creatin', extension: 'md' });
}

async function run() {
  const h = createWikiEngineHarness({
    files: { [NOTE]: '# Creatin\n\nCreatin und Phosphocreatin.' },
    // Call order observed on the harness: extract, extract, source-page,
    // page-generate (Creatin), dedup (Phosphocreatin vs. Creatin — an empty
    // object is no decision, the page is created), page-generate.
    llmResponses: [ANALYSIS, ANALYSIS, SUMMARY, CREATIN_PAGE, '{}', PHOSPHO_PAGE],
  });
  await h.engine.ingestSource(note());
  return h;
}

describe('WikiEngine.ingestSource — end-of-run link re-point', () => {
  it('a link written before its target existed points where the target landed', async () => {
    const h = await run();
    expect(h.reports[0]?.success).toBe(true);
    expect(h.files.has('wiki/entities/phosphocreatin.md')).toBe(true);

    const creatin = h.files.get('wiki/entities/creatin.md') ?? '';
    expect(creatin).not.toContain('concepts/Phosphocreatin');
    // Both the prose link and the Related-section link — the section said
    // "concept", the vault says entity.
    // Shaping routes a related name to its kind before generation, so
    // the Related-section link is born as `entities/Phosphocreatin` and only
    // the prose link is re-pointed; the two differ in case, which resolves.
    expect(creatin.match(/\[\[entities\/phosphocreatin\|Phosphocreatin\]\]/gi)).toHaveLength(2);
  });

  it('the source page gets the same pass', async () => {
    const h = await run();
    const source = [...h.files.entries()].find(([p]) => p.startsWith('wiki/sources/'))?.[1] ?? '';
    expect(source).not.toContain('concepts/Phosphocreatin');
    // Folder is what counts; a link that differs from the file name only in
    // case already resolves and is left as written.
    expect(source.toLowerCase()).toContain('[[entities/phosphocreatin|phosphocreatin]]');
  });

  it('a page with nothing to move is not rewritten', async () => {
    const h = await run();
    expect(h.writtenPaths.filter(p => p === 'wiki/entities/phosphocreatin.md')).toHaveLength(1);
    expect(h.writtenPaths.filter(p => p === 'wiki/entities/creatin.md')).toHaveLength(2);
  });
});

describe('WikiEngine.ingestSource — the pass reads only the pages of this run', () => {
  it('never scans the vault for its index', async () => {
    const h = createWikiEngineHarness({
      files: { [NOTE]: '# Creatin\n\nCreatin und Phosphocreatin.' },
      llmResponses: [ANALYSIS, ANALYSIS, SUMMARY, CREATIN_PAGE, '{}', PHOSPHO_PAGE],
    });
    const before = h.stats.vaultMarkdownScans;
    // Count scans between the last page write of Stage 3/4 and the end of the
    // run: the pass itself must add none. The write-time corrector and the
    // index generation scan on their own; the pass is measured by difference
    // against a run whose pass has nothing to do.
    await h.engine.ingestSource(note());
    const withPass = h.stats.vaultMarkdownScans - before;

    const h2 = createWikiEngineHarness({
      files: { [NOTE]: '# Creatin\n\nCreatin und Phosphocreatin.' },
      llmResponses: [ANALYSIS, ANALYSIS, SUMMARY, CREATIN_PAGE.replace(/concepts\/Phosphocreatin/g, 'entities/phosphocreatin'), '{}', PHOSPHO_PAGE],
    });
    await h2.engine.ingestSource(note());
    const withoutPass = h2.stats.vaultMarkdownScans;
    expect(withPass).toBe(withoutPass);
  });
});
