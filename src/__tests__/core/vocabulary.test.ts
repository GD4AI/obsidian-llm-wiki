// One tag vocabulary, three sources (vocabulary.ts).
//
// Measured before this module existed: the system prompt offered the settings
// list, the write gate stripped against the vault harvest — 69 of 903 pages on
// one rebuild were born with an empty `tags:` because their type was legal on
// one list and absent from the other. These tests pin the union and the rule
// that every reader sees the same list.

import { describe, it, expect } from 'vitest';
import type { App } from 'obsidian';
import { DEFAULT_SETTINGS } from '../../types';
import type { LLMWikiSettings } from '../../types';
import { activeVocabulary, activeVocabularyLists, domainVocabulary } from '../../core/vocabulary';

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

function settings(overrides: Partial<LLMWikiSettings> = {}): LLMWikiSettings {
  return { ...DEFAULT_SETTINGS, wikiFolder: 'wiki', watchedFolders: ['Notizen'], ...overrides };
}

describe('activeVocabulary — one list from three sources', () => {
  const custom = settings({
    tagVocabularyMode: 'custom',
    customEntityTags: 'Sorte/Organisation, Sorte/Erkrankung',
    customConceptTags: 'Sorte/Mechanismus, Sorte/Erkrankung',
  });

  it('unions the settings list, the watched-folder tags and the page tags, sorted', () => {
    const app = fakeApp({
      'Notizen/A.md': ['Thema/Schlaf'],
      'wiki/entities/X.md': ['Sorte/Vitalparameter'],
    });
    expect(activeVocabulary(app, custom, 'entity')).toEqual([
      'Sorte/Erkrankung', 'Sorte/Organisation', 'Sorte/Vitalparameter', 'Thema/Schlaf',
    ]);
    expect(activeVocabulary(app, custom, 'concept')).toEqual([
      'Sorte/Erkrankung', 'Sorte/Mechanismus', 'Sorte/Vitalparameter', 'Thema/Schlaf',
    ]);
  });

  it('a term declared in the settings but carried by no note is offered — that is what the list is for', () => {
    const app = fakeApp({ 'Notizen/A.md': ['Thema/Schlaf'] });
    expect(activeVocabulary(app, custom, 'entity')).toContain('Sorte/Organisation');
  });

  it('deduplicates on the fold, settings spelling wins', () => {
    const app = fakeApp({ 'Notizen/A.md': ['sorte/organisation', 'Thema/Schlaf'] });
    const v = activeVocabulary(app, custom, 'entity');
    expect(v).toContain('Sorte/Organisation');
    expect(v).not.toContain('sorte/organisation');
  });

  it('without a kind offers both kinds — the list a source page or a domains choice draws from', () => {
    const app = fakeApp({});
    expect(activeVocabulary(app, custom)).toEqual(['Sorte/Erkrankung', 'Sorte/Mechanismus', 'Sorte/Organisation']);
  });

  it('a user without tagged notes keeps the built-in taxonomy unchanged', () => {
    const app = fakeApp({});
    const lists = activeVocabularyLists(app, settings());
    expect(lists.entities).toContain('person');
    expect(lists.entities).toContain('organization');
    expect(lists.concepts).toContain('theory');
    expect(lists.entities).not.toContain('theory');
  });

  it('does not read archive files under the wiki folder', () => {
    const app = fakeApp({
      'wiki/schema/belege-s154/restore-backup/old.md': ['Sorte/Archiv'],
      'wiki/entities/X.md': ['Sorte/Vitalparameter'],
    });
    const v = activeVocabulary(app, custom, 'entity');
    expect(v).toContain('Sorte/Vitalparameter');
    expect(v).not.toContain('Sorte/Archiv');
  });
});

describe('domainVocabulary — the Group/Value view of the same list', () => {
  it('keeps the qualified values and drops the flat identity types', () => {
    const app = fakeApp({ 'Notizen/A.md': ['Thema/Schlaf', 'flat'] });
    const v = domainVocabulary(app, settings());
    expect(v).toContain('Thema/Schlaf');
    expect(v).not.toContain('flat');
    expect(v).not.toContain('person');
  });

  it('is empty for a vault without note tags in default mode — no domain block appears', () => {
    expect(domainVocabulary(fakeApp({}), settings())).toEqual([]);
  });
});
