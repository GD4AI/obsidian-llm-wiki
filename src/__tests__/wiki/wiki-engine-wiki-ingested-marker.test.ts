// The wiki-ingested marker is the durable "this source fully landed" record:
// it is written on every successful ingest and read by the skipWikiIngested
// gate, so a later re-run of the same note is skipped instead of re-ingested.

import { describe, it, expect } from 'vitest';
import { TFile } from 'obsidian';
import { createWikiEngineHarness } from '../__support__/wiki-engine-harness';

const SOURCE_NOTE_PATH = 'Notizen/mark-note.md';

function sourceFile(): TFile {
  return Object.assign(new TFile(), {
    path: SOURCE_NOTE_PATH,
    name: 'mark-note.md',
    basename: 'mark-note',
    extension: 'md',
  });
}

const ANALYSIS_RESPONSE = JSON.stringify({
  source_title: 'Mark Note',
  summary: 'Marker test source.',
  entities: [{ name: 'Marker Entity', type: 'person', summary: 'entity', mentions_in_source: [] }],
  concepts: [{ name: 'Marker Concept', summary: 'concept', mentions_in_source: [] }],
  related_pages: [],
  key_points: [],
});

const SUMMARY_RESPONSE = 'Auto-generated source page.\n\n## Summary\n\nMarker test.';

describe('WikiEngine — wiki-ingested marker', () => {
  it('stamps the source with wiki-ingested on a successful ingest', async () => {
    const h = createWikiEngineHarness({
      files: { [SOURCE_NOTE_PATH]: '# Mark\n\nBody text.' },
      llmResponses: [ANALYSIS_RESPONSE, SUMMARY_RESPONSE],
    });
    await h.engine.ingestSource(sourceFile(), { interactive: true });

    const saved = h.files.get(SOURCE_NOTE_PATH) ?? '';
    const match = saved.match(/^wiki-ingested:[ \t]*(\d{4}-\d{2}-\d{2})$/m);
    expect(match, 'frontmatter must carry a wiki-ingested date').not.toBeNull();
    expect(h.reports.at(-1)?.success).toBe(true);
  });

  it('skips a source whose frontmatter already carries the marker', async () => {
    const marked = '---\nwiki-ingested: 2026-09-12\n---\n\n# Mark\n\nBody text.';
    const h = createWikiEngineHarness({
      files: { [SOURCE_NOTE_PATH]: marked },
      llmResponses: [],
    });
    await h.engine.ingestSource(sourceFile(), { interactive: true });

    const last = h.reports.at(-1);
    expect(last?.skipped).toBe(true);
    expect(last?.createdPages).toEqual([]);
    expect(h.stats.llmCalls).toBe(0);
  });

  it('still ingests a marked source when skipWikiIngested is false', async () => {
    const marked = '---\nwiki-ingested: 2026-09-12\n---\n\n# Mark\n\nBody text.';
    const h = createWikiEngineHarness({
      files: { [SOURCE_NOTE_PATH]: marked },
      llmResponses: [ANALYSIS_RESPONSE, SUMMARY_RESPONSE],
      settings: { skipWikiIngested: false },
    });
    await h.engine.ingestSource(sourceFile(), { interactive: true });

    const last = h.reports.at(-1);
    expect(last?.skipped).toBeUndefined();
    expect(last?.success).toBe(true);
    expect(last?.createdPages.length).toBeGreaterThan(0);
  });
});
