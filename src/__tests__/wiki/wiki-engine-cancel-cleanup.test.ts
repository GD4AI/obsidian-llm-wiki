// Cancelled ingest must not read as a completed one.
//
// The summary page doubles as the completion marker: isAlreadyIngested
// checks its existence, and it is written in Stage 2 — before the content
// pages, the index, and the log. A cancellation after Stage 2 therefore
// used to leave a half-finished ingest that every later trigger skipped as
// "already ingested", with the log and index blind to it. The fix trashes
// the summary page in the AbortError branch so the next trigger re-ingests
// the source cleanly.

import { describe, it, expect } from 'vitest';
import { TFile } from 'obsidian';
import { createWikiEngineHarness } from '../__support__/wiki-engine-harness';

const SOURCE_NOTE_PATH = 'Notizen/act-note.md';

function sourceFile(): TFile {
  return Object.assign(new TFile(), {
    path: SOURCE_NOTE_PATH,
    name: 'act-note.md',
    basename: 'act-note',
    extension: 'md',
  });
}

const ANALYSIS_RESPONSE = JSON.stringify({
  source_title: 'ACT Note',
  summary: 'Acceptance and Commitment Therapy.',
  entities: [{ name: 'Steven Hayes', type: 'person', summary: 'founder', mentions_in_source: [] }],
  concepts: [{ name: 'Psychological Flexibility', summary: 'core construct', mentions_in_source: [] }],
  related_pages: [],
  key_points: [],
});

const SUMMARY_RESPONSE = 'Auto-generated source page.\n\n## Zusammenfassung\n\nACT.';

function summaryPageWritten(files: Map<string, string>): string | undefined {
  return [...files.keys()].find(p => /(^|\/)sources\//.test(p) && p.endsWith('.md') && p !== SOURCE_NOTE_PATH);
}

describe('WikiEngine.ingestSource — cancellation removes the completion marker', () => {
  async function cancelledRun() {
    // The real cancel is a flag: cancelIngestion() aborts the controller and
    // the next checkCancelled() checkpoint (before each Stage-3/4 batch)
    // throws the AbortError. The hook flips the flag on the first LLM call
    // after the summary page exists — i.e. mid Stage 3, exactly where a
    // user-clicked cancel lands in practice.
    let h: ReturnType<typeof createWikiEngineHarness> | null = null;
    h = createWikiEngineHarness({
      files: { [SOURCE_NOTE_PATH]: '# ACT\n\nBody text.' },
      llmResponses: [ANALYSIS_RESPONSE, SUMMARY_RESPONSE],
      beforeLLMCall: () => {
        if (h && summaryPageWritten(h.files)) h.engine.cancelIngestion();
      },
    });
    await h.engine.ingestSource(sourceFile());
    return h;
  }

  it('trashes the summary page so the source re-ingests on the next trigger', async () => {
    const h = await cancelledRun();

    expect(h.trashedPaths).toHaveLength(1);
    expect(h.trashedPaths[0]).toMatch(/(^|\/)sources\//);
    expect(summaryPageWritten(h.files)).toBeUndefined();
  });

  it('reports cancelled without listing the removed summary page as created', async () => {
    const h = await cancelledRun();

    expect(h.reports).toHaveLength(1);
    const report = h.reports[0];
    expect(report.cancelled).toBe(true);
    expect(report.success).toBe(false);
    expect(report.createdPages.some(p => /(^|\/)sources\//.test(p))).toBe(false);
  });

  it('a cancellation before Stage 2 trashes nothing', async () => {
    let h: ReturnType<typeof createWikiEngineHarness> | null = null;
    h = createWikiEngineHarness({
      files: { [SOURCE_NOTE_PATH]: '# ACT\n\nBody text.' },
      llmResponses: [ANALYSIS_RESPONSE],
      // Cancel during the very first call: the post-Stage-1 checkpoint
      // throws before any summary page exists.
      beforeLLMCall: () => { h?.engine.cancelIngestion(); },
    });
    await h.engine.ingestSource(sourceFile());

    expect(h.trashedPaths).toHaveLength(0);
    expect(h.reports[0]?.cancelled).toBe(true);
  });
});

describe('WikiEngine — a cancel is honoured at the next page write', () => {
  it('writes no content page after the cancel, even when the model call it was waiting on returns', async () => {
    // The abort signal does not reach the model call; the call returns its
    // page body after the user pressed stop. The write gate refuses it, the
    // AbortError branch trashes the summary page, and nothing half-written
    // stays behind for a later trigger to skip.
    let h: ReturnType<typeof createWikiEngineHarness> | null = null;
    h = createWikiEngineHarness({
      files: { [SOURCE_NOTE_PATH]: '# ACT\n\nBody text.' },
      llmResponses: [ANALYSIS_RESPONSE, SUMMARY_RESPONSE, '# Steven Hayes\n\nFounder of ACT.', '# Psychological Flexibility\n\nCore construct.'],
      beforeLLMCall: () => {
        if (h && summaryPageWritten(h.files)) h.engine.cancelIngestion();
      },
    });
    await h.engine.ingestSource(sourceFile());

    expect([...h.files.keys()].filter(p => /\/(entities|concepts)\//.test(p))).toEqual([]);
    expect(summaryPageWritten(h.files)).toBeUndefined();
    expect(h.reports[0]?.cancelled).toBe(true);
  });
});
