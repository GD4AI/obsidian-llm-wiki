// domain axis stage 3 (#568): the model chooses the subset, the code
// decides what counts — validated against the vault's tag vocabulary, with a
// deterministic fold for the measured failure mode (bare value spelling).

import { describe, it, expect } from 'vitest';
import { buildDomainContext, collectDomainVocabulary, collectWikiVocabulary, collectActiveVocabulary, selectDomains, COVERAGE_VALUES } from '../../core/domain-axis';
import type { App } from 'obsidian';

const VOCAB = ['Fach/Hämatologie', 'Sorte/Protein', 'Thema/Diagnostik', 'Thema/Mikrobiom'];

describe('domain-axis — selectDomains', () => {
  it('keeps only vocabulary values, in the vocabulary\'s spelling and the model\'s order', () => {
    const r = selectDomains(['thema/diagnostik', 'Sorte/Protein', 'Thema/Erfunden'], VOCAB);
    expect(r.kept).toEqual(['Thema/Diagnostik', 'Sorte/Protein']);
    expect(r.rejected).toEqual(['Thema/Erfunden']);
  });

  it('is NFC-insensitive and deduplicates', () => {
    const decomposed = 'Fach/Hämatologie'; // ä as a + combining diaeresis
    const r = selectDomains([decomposed, 'Fach/Hämatologie', ' Sorte/Protein '], VOCAB);
    expect(r.kept).toEqual(['Fach/Hämatologie', 'Sorte/Protein']);
    expect(r.rejected).toEqual([]);
  });

  it('accepts a bare value without the group prefix when it is unique — the measured failure mode', () => {
    const r = selectDomains(['Mikrobiom', 'diagnostik'], VOCAB);
    expect(r.kept).toEqual(['Thema/Mikrobiom', 'Thema/Diagnostik']);
    expect(r.rejected).toEqual([]);
  });

  it('repairs a wrong group prefix when the value part is unique — the measured 13-of-15 class', () => {
    const r = selectDomains(['Sorte/Diagnostik', 'Fach/Mikrobiom'], VOCAB);
    expect(r.kept).toEqual(['Thema/Diagnostik', 'Thema/Mikrobiom']);
    expect(r.rejected).toEqual([]);
  });

  it('rejects a wrong-group value whose value part two vocabulary entries share', () => {
    const vocab = ['Sorte/Erkrankung', 'Thema/Erkrankung'];
    const r = selectDomains(['Fach/Erkrankung'], vocab);
    expect(r.kept).toEqual([]);
    expect(r.rejected).toEqual(['Fach/Erkrankung']);
  });

  it('rejects a bare value that two vocabulary entries share — no guessing', () => {
    const vocab = ['Sorte/Erkrankung', 'Thema/Erkrankung'];
    const r = selectDomains(['Erkrankung'], vocab);
    expect(r.kept).toEqual([]);
    expect(r.rejected).toEqual(['Erkrankung']);
  });

  it('deduplicates a bare and a full spelling of the same tag', () => {
    const r = selectDomains(['Mikrobiom', 'Thema/Mikrobiom'], VOCAB);
    expect(r.kept).toEqual(['Thema/Mikrobiom']);
    expect(r.rejected).toEqual([]);
  });

  it('treats anything that is not a string array as no choice', () => {
    expect(selectDomains(undefined, VOCAB)).toEqual({ kept: [], rejected: [] });
    expect(selectDomains('Sorte/Protein', VOCAB)).toEqual({ kept: [], rejected: [] });
    expect(selectDomains([42, '', '  ', null], VOCAB)).toEqual({ kept: [], rejected: [] });
  });

  it('rejects everything when the vocabulary is empty — the empty list is the allowed list', () => {
    const r = selectDomains(['Sorte/Protein'], []);
    expect(r.kept).toEqual([]);
    expect(r.rejected).toEqual(['Sorte/Protein']);
  });
});

describe('domain-axis — collectDomainVocabulary', () => {
  function fakeApp(files: Record<string, string[] | undefined>): App {
    return {
      vault: { getMarkdownFiles: () => Object.keys(files).map(path => ({ path })) },
      metadataCache: {
        getFileCache: (f: { path: string }) => {
          const tags = files[f.path];
          return tags === undefined ? null : { frontmatter: { tags } };
        },
      },
    } as unknown as App;
  }

  it('collects distinct tags from watched folders only, sorted, first spelling wins', () => {
    const app = fakeApp({
      'Notizen/A.md': ['Thema/Mikrobiom', 'Sorte/Erkrankung'],
      'Notizen/B.md': ['thema/mikrobiom', 'Fach/Kardiologie'],
      'Frontier/X.md': ['Kardiologie'],
      'wiki/entities/X.md': ['other'],
      'Notizen/leer.md': undefined,
    });
    expect(collectDomainVocabulary(app, ['Notizen'])).toEqual(['Fach/Kardiologie', 'Sorte/Erkrankung', 'Thema/Mikrobiom']);
  });

  it('ignores non-string and empty tag entries', () => {
    const app = fakeApp({ 'Notizen/A.md': ['', '  ', 'Thema/Schlaf'] });
    expect(collectDomainVocabulary(app, ['Notizen'])).toEqual(['Thema/Schlaf']);
  });

  it('unions multiple watched folders', () => {
    const app = fakeApp({
      'Notizen/A.md': ['Thema/Schlaf'],
      'Clippings/B.md': ['Thema/Mikrobiom'],
      'Sonst/C.md': ['Thema/Fremd'],
    });
    expect(collectDomainVocabulary(app, ['Notizen', 'Clippings'])).toEqual(['Thema/Mikrobiom', 'Thema/Schlaf']);
  });

  // No declared source folder means no vocabulary — not the vault root. A
  // blank entry is dropped before it reaches `isInFolderScope`, where the
  // empty string would mean the vault root and sweep the wiki's own pages in.
  it('is empty without watched folders, and a blank entry is not the vault root', () => {
    const app = fakeApp({
      'Notizen/A.md': ['Thema/Schlaf'],
      'wiki/entities/X.md': ['other'],
    });
    expect(collectDomainVocabulary(app, [])).toEqual([]);
    expect(collectDomainVocabulary(app, ['', '  '])).toEqual([]);
  });

  // The same anchoring the boundary primitive exists for: a sibling folder
  // sharing the name prefix is not inside the watched folder.
  it('does not include a sibling folder that merely shares the name prefix', () => {
    const app = fakeApp({
      'Notizen/A.md': ['Thema/Schlaf'],
      'Notizen-Archiv/X.md': ['Thema/Fremd'],
    });
    expect(collectDomainVocabulary(app, ['Notizen'])).toEqual(['Thema/Schlaf']);
  });
});

describe('domain-axis — collectWikiVocabulary / collectActiveVocabulary (S138)', () => {
  function fakeApp(files: Record<string, string[] | undefined>): App {
    return {
      vault: { getMarkdownFiles: () => Object.keys(files).map(path => ({ path })) },
      metadataCache: {
        getFileCache: (f: { path: string }) => {
          const tags = files[f.path];
          return tags === undefined ? null : { frontmatter: { tags } };
        },
      },
    } as unknown as App;
  }

  // The flat extraction types the plugin writes as identity fallback are an
  // abstention signal — harvesting them would turn the abstention marker
  // itself into an offerable value (the S132 rule inversion by the back door).
  it('harvests only nested tags from wiki pages — the flat fallback types stay abstention', () => {
    const app = fakeApp({
      'wiki/entities/X.md': ['other', 'Sorte/Vitalparameter'],
      'wiki/concepts/Y.md': ['phenomenon'],
      'Notizen/A.md': ['Thema/Schlaf'],
    });
    expect(collectWikiVocabulary(app, 'wiki')).toEqual(['Sorte/Vitalparameter']);
  });

  // Only the three page folders are pages. Everything else under the wiki
  // folder — schema, archives, scratch — must not mint vocabulary: on one
  // vault a term no note carried reached the offer from archived copies under
  // wiki/schema/ and then stood on 102 pages. sources/ is a page folder since
  // the summary page passes the same gate as the other two types.
  it('harvests the three page folders and nothing else under the wiki folder', () => {
    const app = fakeApp({
      'wiki/entities/X.md': ['Sorte/Vitalparameter'],
      'wiki/sources/S.md': ['Thema/Schlaf'],
      'wiki/schema/belege-s154/restore-backup/wiki__sources__Old.md': ['Sorte/Archiv'],
      'wiki/index.md': ['Thema/Index'],
    });
    expect(collectWikiVocabulary(app, 'wiki')).toEqual(['Sorte/Vitalparameter', 'Thema/Schlaf']);
  });

  it('unions folder harvest and wiki nested tags, folder spelling wins, sorted', () => {
    const app = fakeApp({
      'Notizen/A.md': ['Thema/Schlaf'],
      'wiki/entities/X.md': ['thema/schlaf', 'Sorte/Vitalparameter'],
    });
    expect(collectActiveVocabulary(app, { watchedFolders: ['Notizen'], wikiFolder: 'wiki' }))
      .toEqual(['Sorte/Vitalparameter', 'Thema/Schlaf']);
  });

  it('without watched folders the wiki side still carries manual corrections', () => {
    const app = fakeApp({
      'Notizen/A.md': ['Thema/Schlaf'],
      'wiki/entities/X.md': ['Sorte/Vitalparameter'],
    });
    expect(collectActiveVocabulary(app, { watchedFolders: [], wikiFolder: 'wiki' }))
      .toEqual(['Sorte/Vitalparameter']);
  });
});

describe('domain-axis — buildDomainContext', () => {
  it('is the empty string for a vault without note tags, so the prompt is unchanged', () => {
    expect(buildDomainContext([])).toBe('');
    expect(buildDomainContext(['', '  '])).toBe('');
  });

  it('names the vocabulary as the allowed list, demands the exact spelling, forbids additions', () => {
    const block = buildDomainContext(VOCAB);
    expect(block).toContain('**Domain tag vocabulary of this vault:** [Fach/Hämatologie, Sorte/Protein, Thema/Diagnostik, Thema/Mikrobiom]');
    expect(block).toContain('Copy the exact spelling');
    expect(block).toContain('Never add a tag that is not in this list');
    expect(block).toContain('Use [] when none applies');
  });
});

describe('domain-axis — constants', () => {
  it('names the three coverage values', () => {
    expect([...COVERAGE_VALUES].sort()).toEqual(['defined', 'discussed', 'named']);
  });
});
