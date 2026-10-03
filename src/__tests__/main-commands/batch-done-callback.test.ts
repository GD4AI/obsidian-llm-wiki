// A batch collects the reports of its ingests by replacing the engine's done
// callback. It never put the plugin's own callback back, so after the first
// batch of a session every later single or watcher ingest reported into the
// finished batch's array: no report modal, the progress Notice never
// dismissed, the query graphs never invalidated.

import { describe, it, expect, vi } from 'vitest';
import { TFile } from 'obsidian';
import { ingestCommands, type IngestHost } from '../../main-commands/ingest-commands';
import type { IngestReport } from '../../types';

const REPORT = { sourceFile: 'Notizen/A.md', createdPages: [], updatedPages: [], success: true } as unknown as IngestReport;

function host(pluginDone: (r: IngestReport) => void): { h: IngestHost; engine: { done: ((r: IngestReport) => void) | null } } {
  const engine = {
    done: pluginDone as ((r: IngestReport) => void) | null,
    wasCancelled: false,
    setDoneCallback(cb: ((r: IngestReport) => void) | null) { this.done = cb; },
    getDoneCallback() { return this.done; },
    createBatchContext: () => ({}),
    ingestSource: async () => { engine.done?.(REPORT); },
  };
  const h = {
    app: {},
    settings: { language: 'en' },
    wikiEngine: engine,
    ingestQueue: { enqueue: (fs: TFile[]) => fs.map(() => ''), start: vi.fn(), complete: vi.fn() },
    batchProgress: null,
    showProgressFor: vi.fn(),
    dismissProgress: vi.fn(),
    preparePdfCacheForBatchIngest: async () => {},
    isAlreadyIngested: async () => false,
  } as unknown as IngestHost;
  return { h, engine };
}

describe('runBatchIngest done callback', () => {
  it('gives the engine its previous done callback back', async () => {
    const pluginDone = vi.fn();
    const { h, engine } = host(pluginDone);
    const file = Object.assign(new TFile(), { path: 'Notizen/A.md', basename: 'A', extension: 'md' });

    await ingestCommands.runBatchIngest.call(h, [file], [], '1 file');
    expect(pluginDone).not.toHaveBeenCalled();

    engine.done?.(REPORT);
    expect(pluginDone).toHaveBeenCalledWith(REPORT);
  });
});
