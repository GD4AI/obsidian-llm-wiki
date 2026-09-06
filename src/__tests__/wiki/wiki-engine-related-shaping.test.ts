// The related lists reach page generation shaped — vault pages under their
// title and kind, siblings linked, unanswered names kept as written.
import { describe, it, expect } from 'vitest';
import { TFile } from 'obsidian';
import { createWikiEngineHarness } from '../__support__/wiki-engine-harness';

const NOTE_PATH = 'Notizen/Berberin.md';
const NOTE = '---\ntags:\n  - Thema/Therapie\n---\n\n# Berberin\n\nBerberin senkt den Blutzucker wie Metformin und wirkt über AMPK auf die Insulinresistenz.\n';
const noteFile = () => Object.assign(new TFile(), { path: NOTE_PATH, basename: 'Berberin', extension: 'md' });

const EXTRACTION = JSON.stringify({
  source_title: 'Berberin', summary: 'Berberin.',
  entities: [
    { name: 'Berberin', type: 'other', summary: 's', mentions_in_source: ['Berberin senkt den Blutzucker'], related_entities: ['metformin', 'Secukinumab', 'Vitamin K2'] },
  ],
  concepts: [
    { name: 'Insulinresistenz', type: 'term', summary: 's', mentions_in_source: ['auf die Insulinresistenz'], related_concepts: ['Metabolisches Syndrom', 'Thema/Therapie', 'Therapie'] },
  ],
});

describe('WikiEngine.ingestSource — related shaping', () => {
  it('hands page generation the shaped lists: titles, kinds, siblings, unanswered names kept', async () => {
    const h = createWikiEngineHarness({
      files: {
        [NOTE_PATH]: NOTE,
        'Notizen/Vitamin K2.md': '# Vitamin K2\n',
        'wiki/entities/Metformin.md': '---\ntype: entity\n---\n# Metformin\n',
      },
      llmResponses: [EXTRACTION],
      settings: { wikiLanguage: 'de', watchedFolders: ['Notizen'] },
    });
    await h.engine.ingestSource(noteFile());

    const lines = h.llmRequests
      .map(r => JSON.stringify(r.messages))
      .filter(m => m.includes('Related entities:'))
      .map(m => `${(m.match(/Related entities:[^\\]*/) ?? [''])[0]} | ${(m.match(/Related concepts:[^\\]*/) ?? [''])[0]}`);
    expect(lines).toEqual([
      // Berberin: Metformin under its vault title, Secukinumab kept as written, Vitamin K2 as a note that will be a page, sibling concept added
      'Related entities: Metformin, Secukinumab, Vitamin K2 | Related concepts: Insulinresistenz',
      // Insulinresistenz: sibling entity added, the unanswered concept kept
      'Related entities: Berberin | Related concepts: Metabolisches Syndrom',
    ]);

    // The written page carries the sections rendered from the
    // same lists — Metformin on its vault path, the unanswered names on their
    // planned paths, the sibling concept — whatever the model returned.
    const berberinPage = h.files.get('wiki/entities/berberin.md') ?? '';
    expect(berberinPage).toContain('## Verwandte Entitäten\n\n- [[entities/Metformin|Metformin]]\n- [[entities/secukinumab|Secukinumab]]\n- [[entities/vitamin-k2|Vitamin K2]]\n\n## Verwandte Konzepte\n\n- [[concepts/insulinresistenz|Insulinresistenz]]\n');

    const msg = h.progressMessages.find(m => m.startsWith('Related lists:'));
    expect(msg).toBe('Related lists: 2 sibling edges, 2 unanswered names, 2 tag values dropped');
  });
});
