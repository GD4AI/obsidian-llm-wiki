// A note's title is its own: its H1 or its file name. The extraction prompt
// shows the model the note path, and for 21 of 105 notes without an H1 the
// model returned that path as the title (`Notizen/Carrageenan.md`). Only a PDF
// keeps the title the model read off the document.

import { describe, it, expect } from 'vitest';
import { createMockContext } from '../__support__/engine-context';
import { SourceAnalyzer } from '../../wiki/source-analyzer';
import { TFile } from 'obsidian';

const EMPTY_BATCH = JSON.stringify({ entities: [], concepts: [] });

function extraction(sourceTitle: string): string {
  return JSON.stringify({
    source_title: sourceTitle,
    summary: 'Ein Verdickungsmittel.',
    entities: [{ name: 'Carrageenan', type: 'other', summary: 'Polysaccharid.', mentions_in_source: ['a'] }],
    concepts: [],
  });
}

async function titleFor(path: string, extension: string, body: string, modelTitle: string, contentOverride?: string) {
  const { ctx } = createMockContext({
    vaultFiles: { [path]: body },
    llmResponses: [extraction(modelTitle), EMPTY_BATCH],
  });
  const file = Object.assign(new TFile(), { path, basename: 'Carrageenan', extension });
  const analysis = await new SourceAnalyzer(ctx).analyzeSource(file, contentOverride ? { contentOverride } : undefined);
  return analysis?.source_title;
}

describe('SourceAnalyzer — the source title of a note comes from the note', () => {
  it('uses the file name when the note has no H1, not the path the model copied', async () => {
    const title = await titleFor('Notizen/Carrageenan.md', 'md', 'Carrageenan ist ein Verdickungsmittel aus Rotalgen.\n', 'Notizen/Carrageenan.md');
    expect(title).toBe('Carrageenan');
  });

  it('uses the H1 on the first body line', async () => {
    const title = await titleFor(
      'Notizen/Carrageenan.md', 'md',
      '---\ntags: [x]\n---\n# Carrageenan — Übersicht\n\nEin Verdickungsmittel aus Rotalgen.\n',
      'Carrageenan in Lebensmitteln',
    );
    expect(title).toBe('Carrageenan — Übersicht');
  });

  it('keeps the model title for a PDF, whatever the case of its extension', async () => {
    for (const ext of ['pdf', 'PDF']) {
      const title = await titleFor(`Docs/scan.${ext}`, ext, '', 'Carrageenan in Lebensmitteln', 'Carrageenan ist ein Verdickungsmittel.');
      expect(title).toBe('Carrageenan in Lebensmitteln');
    }
  });
});
