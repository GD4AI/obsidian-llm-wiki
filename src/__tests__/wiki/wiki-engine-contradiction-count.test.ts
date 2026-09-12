// The ingest log and the report counted only the extraction lane
// (`analysis.contradictions`). The merge triage records contradictions of
// its own — marker on the page, record file under contradictions/ — and
// those never reached either: a night of 163 ingests logged "no
// contradictions" while four records were written. Both lanes, one count.

import { describe, it, expect } from 'vitest';
import { TFile } from 'obsidian';
import { createWikiEngineHarness } from '../__support__/wiki-engine-harness';

const NOTE_PATH = 'Notizen/Rotlicht.md';
const NOTE = `# Rotlicht

Ein 2019-Paper argumentiert, CCO sei nicht der primäre Photoakzeptor.
`;
const PAGE = `---
type: entity
created: 2026-01-01
sources:
  - "[[sources/Alt]]"
---

# ATP

## Description
NIR detaches NO from CCO.

## Related Entities
- [[CCO]]

## Related Concepts
- [[Photobiomodulation]]
`;

function noteFile(): TFile {
  return Object.assign(new TFile(), { path: NOTE_PATH, basename: 'Rotlicht', extension: 'md' });
}

const EXTRACTION = JSON.stringify({
  source_title: 'Rotlicht',
  summary: 'Red light and mitochondria.',
  entities: [
    { name: 'ATP', type: 'other', summary: 'Energy carrier; CCO may not be the primary photoacceptor.', mentions_in_source: ['CCO sei nicht der primäre Photoakzeptor'] },
  ],
  concepts: [],
  related_pages: [],
});

const TRIAGE = JSON.stringify({
  strategy: 'complementary',
  reason: 'one conflicting claim',
  items: [
    { kind: 'contradictory', content: 'CCO is not the primary photoacceptor', target_section: 'Description', reason: 'page states NIR acts via CCO', existing_statement: 'NIR detaches NO from CCO.' },
  ],
});

describe('WikiEngine.ingestSource — triage-lane contradictions reach log and report', () => {
  it('counts the merge triage record in the report and lists it in the log entry', async () => {
    const h = createWikiEngineHarness({
      files: { [NOTE_PATH]: NOTE, 'wiki/entities/ATP.md': PAGE },
      // Call order the engine makes on this fixture: extract, extract
      // (second pass), lemma-classify, source-page, merge-triage; later calls
      // are served the harness default ('{"entities":[],"concepts":[]}').
      llmResponses: [EXTRACTION, EXTRACTION, '{"entities":[],"concepts":[]}', 'Summary.\n\n## Summary\n\nRed light.', TRIAGE],
    });

    await h.engine.ingestSource(noteFile());

    expect(h.llmRequests.map(r => r.task)).toContain('merge-triage');
    const report = h.reports.at(-1);
    expect(report?.success).toBe(true);
    expect(report?.contradictionsFound).toBe(1);

    const log = h.files.get('wiki/log.md') ?? '';
    expect(log).toContain('Contradictions found');
    expect(log).toContain('CCO is not the primary photoacceptor vs [[entities/ATP]]');

    // The record itself is written as before — this change only makes it visible.
    expect(h.writtenPaths.some(p => p.startsWith('wiki/contradictions/'))).toBe(true);
  });
});
