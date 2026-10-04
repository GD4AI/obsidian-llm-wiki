// Module-level unit tests for page-factory/stub-page.ts (S135).
//
// Pins: the deterministic identity resolver (match / ambiguous / none, titles
// outrank aliases, only entities/+concepts/ count), the stub content format
// (frontmatter marker set, body from the paid-for extraction), the promotion
// helpers, and the birth run (existing paths and in-run slug collisions are
// skipped, never overwritten).

import { describe, it, expect } from 'vitest';
import {
  buildStubIdentityResolver,
  buildDissentStubContent,
  createDissentStubs,
  stubPath,
  isStubPage,
  stripStubMarker,
} from '../../../wiki/page-factory/stub-page';
import { parseFrontmatter } from '../../../core/frontmatter';
import type { EntityInfo, ConceptInfo } from '../../../types';
import type { StubCandidate } from '../../../core/candidate-gate';

const PAGES = [
  { path: 'wiki/entities/Ferritin.md', title: 'Ferritin', aliases: ['Eisenspeicherprotein'] },
  { path: 'wiki/concepts/Butyrat.md', title: 'Butyrat', aliases: ['SCFA'] },
  { path: 'wiki/entities/Propionat.md', title: 'Propionat', aliases: ['SCFA'] },
  { path: 'wiki/sources/ferritin-note.md', title: 'Ferritin', aliases: [] },
  { path: 'elsewhere/entities/Ferritin.md', title: 'Zink', aliases: [] },
];

describe('buildStubIdentityResolver', () => {
  const resolve = buildStubIdentityResolver(PAGES, 'wiki');

  it('a title match is a match, case-folded', () => {
    expect(resolve('Ferritin')).toBe('match');
    expect(resolve('ferritin')).toBe('match');
  });

  it('a unique curated alias is a match', () => {
    expect(resolve('Eisenspeicherprotein')).toBe('match');
  });

  it('an alias two pages claim is ambiguous (the #446 lesson)', () => {
    expect(resolve('SCFA')).toBe('ambiguous');
  });

  it('a name the vault does not know is none', () => {
    expect(resolve('Methylphenidat')).toBe('none');
  });

  it('titles outrank aliases: a title claim beats a contested alias', () => {
    const resolveWithTitle = buildStubIdentityResolver(
      [...PAGES, { path: 'wiki/entities/SCFA.md', title: 'SCFA', aliases: [] }],
      'wiki',
    );
    expect(resolveWithTitle('SCFA')).toBe('match');
  });

  it('sources/ pages and pages outside the wiki folder never claim a name', () => {
    // 'Zink' appears only as the title of a page outside wikiFolder.
    expect(resolve('Zink')).toBe('none');
  });
});

const ITEM: EntityInfo = {
  name: 'Methylphenidat',
  type: 'other',
  summary: 'First-Line-Stimulans bei ADHS.',
  mentions_in_source: ['Medikamentös sind Stimulanzien (Methylphenidat …) die Therapie der Wahl.'],
  domains: ['Pharmakologie'],
};

describe('buildDissentStubContent', () => {
  const content = buildDissentStubContent({
    item: ITEM,
    stubType: 'entity',
    sourceSlug: 'adhs',
    cell: 'prose+named',
  });

  it('carries the stub marker, the #170 birth stamp, and the quoted sources wikilink', () => {
    expect(content).toContain('stub: true');
    expect(content).toContain('generation_complete: false');
    expect(content).toContain('- "[[sources/adhs]]"');
    // Tag-Achse Stufe 4 (S137): one field — identity value + belonging values
    // share `tags:`, no `domains:` block is born.
    expect(parseFrontmatter(content)?.tags).toEqual(['other', 'Pharmakologie']);
    expect(content).not.toContain('domains:');
  });

  // #808: the shape, not only the values — a second form of the `tags:` line
  // is what every reader of that line had to know about.
  it('writes tags as the block list every other writer emits', () => {
    expect(content).toContain('\ntags:\n  - "other"\n  - "Pharmakologie"\nstub: true\n');
  });

  it('body is the paid-for extraction: summary, one mention, the cell named', () => {
    expect(content).toContain('# Methylphenidat');
    expect(content).toContain('First-Line-Stimulans bei ADHS.');
    expect(content).toContain('prose+named');
    expect(content).toContain('"Medikamentös sind Stimulanzien (Methylphenidat …) die Therapie der Wahl." — [[sources/adhs]]');
  });

  it('parses as frontmatter the rest of the pipeline can read', () => {
    const fm = parseFrontmatter(content);
    expect(fm?.type).toBe('entity');
    expect(isStubPage(fm)).toBe(true);
  });

  it('no summary, no quote: the stub still stands on its provenance line', () => {
    const bare = buildDissentStubContent({
      item: { name: 'X', type: 'other', summary: '', mentions_in_source: [] },
      stubType: 'concept',
      sourceSlug: 's',
      cell: 'aside+covered',
    });
    expect(bare).toContain('# X');
    expect(bare).toContain('tags:\n  - "other"\n');
    expect(bare).not.toContain('" — [[sources/s]]');
  });
});

describe('isStubPage / stripStubMarker', () => {
  it('recognises the parsed string form and the boolean form', () => {
    expect(isStubPage({ stub: 'true' })).toBe(true);
    expect(isStubPage({ stub: true })).toBe(true);
    expect(isStubPage({ stub: 'false' })).toBe(false);
    expect(isStubPage({})).toBe(false);
    expect(isStubPage(null)).toBe(false);
  });

  it('stripStubMarker removes exactly the marker line', () => {
    const fm = '---\ntype: entity\nstub: true\ntags: [other]\n---';
    expect(stripStubMarker(fm)).toBe('---\ntype: entity\ntags: [other]\n---');
    expect(stripStubMarker('---\ntype: entity\n---')).toBe('---\ntype: entity\n---');
  });
});

describe('createDissentStubs', () => {
  const mkStub = (name: string): StubCandidate => ({
    kind: 'entity',
    cell: 'prose+named',
    item: { name, type: 'other', summary: '', mentions_in_source: [] },
  });
  const mkDeps = (existing: string[] = []) => {
    const written = new Map<string, string>();
    return {
      written,
      deps: {
        wikiFolder: 'wiki',
        preserveCase: false,
        normalizePath: (p: string) => p,
        fileExists: (p: string) => existing.includes(p),
        createOrUpdateFile: async (p: string, c: string) => { written.set(p, c); },
      },
    };
  };

  it('writes each stub to its slug path and reports it created', async () => {
    const { written, deps } = mkDeps();
    const r = await createDissentStubs(deps, [mkStub('Methylphenidat')], 'adhs');
    expect(r.created).toEqual(['wiki/entities/methylphenidat.md']);
    expect(written.get('wiki/entities/methylphenidat.md')).toContain('stub: true');
  });

  it('an occupied path is skipped, never overwritten (slug collision)', async () => {
    const { written, deps } = mkDeps(['wiki/entities/methylphenidat.md']);
    const r = await createDissentStubs(deps, [mkStub('Methylphenidat')], 'adhs');
    expect(r.created).toEqual([]);
    expect(r.skipped).toEqual(['wiki/entities/methylphenidat.md']);
    expect(written.size).toBe(0);
  });

  it('two stubs folding to one slug in the same run: first wins', async () => {
    const { written, deps } = mkDeps();
    const r = await createDissentStubs(deps, [mkStub('Maca'), mkStub('MACA')], 's');
    expect(r.created).toEqual(['wiki/entities/maca.md']);
    expect(r.skipped).toEqual(['wiki/entities/maca.md']);
    expect(written.size).toBe(1);
  });

  it('stubPath places entities and concepts in their folders', () => {
    const deps = { wikiFolder: 'wiki', preserveCase: false, normalizePath: (p: string) => p };
    expect(stubPath(deps, mkStub('Maca'))).toBe('wiki/entities/maca.md');
    expect(stubPath(deps, { ...mkStub('Maca'), kind: 'concept' })).toBe('wiki/concepts/maca.md');
  });
});

describe('buildDissentStubContent — identity tag faces the harvest (S142)', () => {
  const VOCAB = ['Sorte/Botenstoffe', 'Thema/Diagnostik'] as const;

  it('drops a settings-typelist identity the vocabulary does not carry', () => {
    const content = buildDissentStubContent({
      item: { name: 'Israel Brekhman', type: 'person', summary: 's', mentions_in_source: [] },
      stubType: 'entity',
      sourceSlug: 'adaptogen',
      cell: 'prose+named',
      vocabulary: VOCAB,
    });
    // An empty list is the bare key — the shape the gate writes (emitEmptyTags).
    expect(content).toContain('\ntags:\nstub: true\n');
    expect(parseFrontmatter(content)?.tags).toEqual([]);
    expect(content).not.toContain('person');
  });

  it('keeps an identity value the vocabulary carries', () => {
    const content = buildDissentStubContent({
      item: { name: 'Prostaglandin', type: 'method', summary: 's', mentions_in_source: [], domains: ['Thema/Diagnostik'] } as unknown as ConceptInfo,
      stubType: 'concept',
      sourceSlug: 'ass',
      cell: 'prose+named',
      vocabulary: [...VOCAB, 'method'],
    });
    expect(content).toContain('tags:\n  - "method"\n  - "Thema/Diagnostik"\n');
  });

  it('writes no other/term fallback under a vocabulary — empty stays empty', () => {
    const content = buildDissentStubContent({
      item: { name: 'Herzfrequenz', summary: 's', mentions_in_source: [] } as unknown as ConceptInfo,
      stubType: 'concept',
      sourceSlug: 'sechs-minuten-gehtest',
      cell: 'aside+covered',
      vocabulary: VOCAB,
    });
    // An empty list is the bare key — the shape the gate writes (emitEmptyTags).
    expect(content).toContain('\ntags:\nstub: true\n');
    expect(parseFrontmatter(content)?.tags).toEqual([]);
    expect(content).not.toContain('term');
  });
});
