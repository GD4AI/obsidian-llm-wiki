// createSummaryPage writes the head of the sources/ page — H1 and Source
// section — from the analysis title, the note path and the ingest date, over
// whatever the model copied there. Measured: `[[Notizen/Zytokines.md]]` in the
// Source section of `sources/Zytokine`, file paths as H1 titles, and the
// English "Summary" suffix on German pages.

import { describe, it, expect } from 'vitest';
import { TFile } from 'obsidian';
import { createWikiEngineHarness } from '../__support__/wiki-engine-harness';
import type { SourceAnalysis } from '../../types';

const NOTE = 'Notizen/Zytokine.md';

const MODEL_PAGE = `---
type: source
tags: [other]
---

# Notizen/Zytokines.md - Summary

## Quelle

- Originaldatei: [[Notizen/Zytokines.md]]
- Datum der Erfassung: 2026-01-01

## Kerninhalt

Signalproteine des Immunsystems.
`;

function analysis(): SourceAnalysis {
  return {
    source_file: NOTE,
    source_title: 'Zytokine',
    summary: 'Signalproteine.',
    entities: [],
    concepts: [],
    contradictions: [],
    related_pages: [],
    key_points: [],
    created_pages: [],
    updated_pages: [],
  };
}

describe('WikiEngine.createSummaryPage — the page head comes from the code', () => {
  it('renders H1 and Source section from title, path and date, in the wiki language', async () => {
    const h = createWikiEngineHarness({
      files: { [NOTE]: 'Signalproteine des Immunsystems.\n' },
      llmResponses: [MODEL_PAGE],
      settings: { wikiLanguage: 'de' },
    });
    const file = Object.assign(new TFile(), { path: NOTE, basename: 'Zytokine', extension: 'md' });
    const written = h.files.get(await h.engine.createSummaryPage(file, analysis(), []))!;

    expect(written).toContain('# Zytokine - Zusammenfassung\n');
    expect(written).toMatch(/## Quelle\n\n- Originaldatei: \[\[Notizen\/Zytokine\.md\]\]\n- Importiert: \d{4}-\d{2}-\d{2}\n/);
    expect(written).not.toContain('Zytokines');
    expect(written).not.toContain('2026-01-01');
    expect(written).toContain('## Kerninhalt');
  });
});
