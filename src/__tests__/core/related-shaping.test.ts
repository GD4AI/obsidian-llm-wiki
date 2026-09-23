// See core/related-shaping.ts.
import { describe, it, expect } from 'vitest';
import { shapeRelatedLists } from '../../core/related-shaping';
import { RELATED_SIBLING_CAP, RELATED_BUDGET } from '../../constants';
import type { EntityInfo, ConceptInfo } from '../../types';

const ent = (name: string, rel: Partial<EntityInfo> = {}): EntityInfo =>
  ({ name, type: 'other', summary: '', mentions_in_source: [], ...rel });
const con = (name: string, rel: Partial<ConceptInfo> = {}): ConceptInfo =>
  ({ name, type: 'term', summary: '', mentions_in_source: [], related_concepts: [], ...rel });

const vault = new Map([
  ['oxidativer-stress', { title: 'Oxidativer-Stress', kind: 'concept' as const }],
  ['metformin', { title: 'Metformin', kind: 'entity' as const }],
]);
const deps = {
  resolve: (n: string) => vault.get(n.toLowerCase().replace(/\s+/g, '-')),
  willExist: ['Vitamin K2'],
};

describe('shapeRelatedLists', () => {
  it('keeps a related name nothing answers as written and counts it', () => {
    const r = shapeRelatedLists({ entities: [ent('Berberin', { related_entities: ['Secukinumab'] })], concepts: [] }, deps);
    expect(r.entities[0].related_entities).toEqual(['Secukinumab']);
    expect(r.unanswered).toEqual([{ on: 'Berberin', name: 'Secukinumab' }]);
  });

  it('keeps a vault page under its own title, routed to its own folder kind', () => {
    const r = shapeRelatedLists({ entities: [ent('Berberin', { related_entities: ['oxidativer stress', 'Metformin'] })], concepts: [] }, deps);
    expect(r.entities[0].related_entities).toEqual(['Metformin']);
    expect(r.entities[0].related_concepts).toEqual(['Oxidativer-Stress']);
    expect(r.unanswered).toEqual([]);
  });

  it('keeps a note title from the watched folders and a planned stub name as they are', () => {
    const r = shapeRelatedLists(
      { entities: [ent('Berberin', { related_entities: ['vitamin k2', 'Dissent-Stub'] })], concepts: [] },
      { ...deps, willExist: [...deps.willExist, 'Dissent-Stub'] },
    );
    expect(r.entities[0].related_entities).toEqual(['vitamin k2', 'Dissent-Stub']);
  });

  it('gives an orphan its siblings, by kind, without self or duplicates — a page with a live entry gets none', () => {
    const r = shapeRelatedLists(
      { entities: [ent('Berberin'), ent('Metformin', { related_entities: ['berberin'] })], concepts: [con('Insulinresistenz')] },
      deps,
    );
    expect(r.entities[0].related_entities).toEqual(['Metformin']); // orphan: siblings
    expect(r.entities[0].related_concepts).toEqual(['Insulinresistenz']);
    expect(r.entities[1].related_entities).toEqual(['Berberin']); // live entry of its own: no sibling added
    expect(r.entities[1].related_concepts).toBeUndefined();
    expect(r.concepts[0].related_entities).toEqual(['Berberin', 'Metformin']);
    expect(r.concepts[0].related_concepts).toEqual([]);
    expect(r.siblings).toBe(4);
  });

  it('a page whose only related name is itself is an orphan (review fix)', () => {
    const r = shapeRelatedLists({ entities: [ent('Berberin', { related_entities: ['berberin'] }), ent('Metformin')], concepts: [] }, deps);
    expect(r.entities[0].related_entities).toEqual(['Metformin']);
  });

  it('caps an orphan at RELATED_SIBLING_CAP siblings and counts an unanswered name as no way out', () => {
    const r = shapeRelatedLists(
      { entities: [ent('A1', { related_entities: ['Niemand'] }), ent('A2'), ent('A3'), ent('A4'), ent('A5')], concepts: [] },
      deps,
    );
    expect(r.entities[0].related_entities).toEqual(['Niemand', 'A2', 'A3', 'A4']); // frontier name kept, then 3 siblings
    expect(r.entities[1].related_entities).toHaveLength(RELATED_SIBLING_CAP);
    expect(r.siblings).toBe(5 * RELATED_SIBLING_CAP);
  });

  it('routes a survivor named in the wrong list to the list of its kind', () => {
    const r = shapeRelatedLists(
      { entities: [ent('Berberin', { related_entities: ['Insulinresistenz'] })], concepts: [con('Insulinresistenz')] },
      deps,
    );
    expect(r.entities[0].related_entities).toEqual([]);
    expect(r.entities[0].related_concepts).toEqual(['Insulinresistenz']);
  });

  it('drops a tag value — prefixed in any spelling, or bare when only the vocabulary knows the word', () => {
    const d = { ...deps, vocabulary: ['Thema/Therapie', 'Fach/Immunologie', 'Sorte/Erkrankung'], willExist: ['Immunologie'] };
    const r = shapeRelatedLists(
      { entities: [ent('Berberin', { related_concepts: ['Thema/Therapie', 'Th.Therapie', 'Therapie', 'Immunologie', 'Erkrankung'] })], concepts: [] },
      d,
    );
    // Immunologie is a note title as well as a tag leaf: the note wins.
    expect(r.entities[0].related_concepts).toEqual(['Immunologie']);
    expect(r.tags.map(t => t.name)).toEqual(['Thema/Therapie', 'Th.Therapie', 'Therapie', 'Erkrankung']);
    expect(r.unanswered).toEqual([]);
  });

  it('resolves a name with a parenthetical through its parts', () => {
    const r = shapeRelatedLists(
      { entities: [ent('Interleukin-6'), ent('hsCRP', { related_entities: ['Interleukin-6 (IL-6)', 'Metformin (Glucophage)'] })], concepts: [] },
      deps,
    );
    expect(r.entities[1].related_entities).toEqual(['Interleukin-6', 'Metformin']);
    expect(r.unanswered).toEqual([]);
  });

  it('is idempotent', () => {
    const once = shapeRelatedLists({ entities: [ent('A', { related_entities: ['Gone', 'Metformin'] }), ent('B')], concepts: [con('C')] }, deps);
    const twice = shapeRelatedLists(once, deps);
    expect(twice.entities).toEqual(once.entities);
    expect(twice.concepts).toEqual(once.concepts);
    expect(twice.unanswered).toEqual([{ on: 'A', name: 'Gone' }]);
    expect(twice.siblings).toBe(0);
  });
});

// Issue #729 Phase 1 — M0's cross-source entries.
//
// The projection itself is tested in co-citation.test.ts. What is asserted here is
// the contract the shaper owns: the source is optional and its absence is the old
// behaviour exactly; what it adds is bounded by the tier's `crossSource` as a
// **ceiling and not a quota**; and a candidate the vault does not answer is dropped
// rather than written, because a candidate is a discovery where a note-grounded name
// is a claim the extraction is allowed to make.
describe('shapeRelatedLists — M0 cross-source entries (#729 Phase 1)', () => {
  /** Names the projection would offer; each one resolves in `vault` unless the test says otherwise. */
  const offering = (...names: string[]) => () => names;

  it('adds nothing at all when the source is absent', () => {
    // The record's pass condition: "the existing suite green with the dep absent".
    // The 12 cases above are that suite — they call this function without the dep
    // and pin exact arrays. This one states the intent so a future reader does not
    // have to infer it from their silence.
    const r = shapeRelatedLists(
      { entities: [ent('A', { related_entities: ['Metformin'] })], concepts: [] },
      deps,
    );
    expect(r.entities[0].related_entities).toEqual(['Metformin']);
    expect(r.entities[0].related_concepts).toBeUndefined();
    expect(r.crossSource).toBe(0);
  });

  it('adds a resolving candidate the note-grounded list did not reach', () => {
    const r = shapeRelatedLists(
      { entities: [ent('A', { related_entities: ['Metformin'] })], concepts: [] },
      { ...deps, candidates: offering('Oxidativer-Stress') },
    );
    expect(r.entities[0].related_entities).toEqual(['Metformin']);
    expect(r.entities[0].related_concepts).toEqual(['Oxidativer-Stress']);
    expect(r.crossSource).toBe(1);
  });

  it('caps what it adds at the tier\'s crossSource, keeping the projection\'s order', () => {
    // Ten candidates, a `standard` tier (crossSource 3). The cap is what makes
    // Phase 1 shippable at all: there is no length limit on a Related list anywhere
    // in the write path, and the list is joined into the page-generation prompt
    // (create-page.ts:196), so an unbounded addition is a token regression.
    //
    // The item carries a live note-grounded entry, so it is not an orphan and the
    // sibling rule contributes nothing — the cap is the only thing under test.
    const names = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10'];
    const d = {
      ...deps,
      resolve: (n: string) => (/^C\d+$/.test(n) ? { title: n, kind: 'entity' as const } : vault.get(n.toLowerCase().replace(/\s+/g, '-'))),
    };
    const r = shapeRelatedLists(
      { entities: [ent('A', { related_entities: ['Metformin'] })], concepts: [] },
      { ...d, granularity: 'standard' as const, candidates: offering(...names) },
    );
    expect(RELATED_BUDGET.standard.crossSource).toBe(3);
    expect(r.siblings).toBe(0);
    expect(r.entities[0].related_entities).toEqual(['Metformin', 'C1', 'C2', 'C3']);
    expect(r.crossSource).toBe(3);
  });

  it('is a ceiling, not a quota — two candidates fill two entries and no more', () => {
    const d = { ...deps, resolve: (n: string) => (/^C\d$/.test(n) ? { title: n, kind: 'entity' as const } : vault.get(n.toLowerCase().replace(/\s+/g, '-'))) };
    const r = shapeRelatedLists(
      { entities: [ent('A')], concepts: [] },
      { ...d, granularity: 'fine' as const, candidates: offering('C1', 'C2') },
    );
    expect(RELATED_BUDGET.fine.crossSource).toBe(5);
    expect((r.entities[0].related_entities ?? []).filter((n) => /^C\d$/.test(n))).toEqual(['C1', 'C2']);
    // No filler: the three unused slots are not spent on anything else.
    expect(r.crossSource).toBe(2);
  });

  it('does not add a candidate the vault resolver rejects', () => {
    // The asymmetry that matters. A note-grounded name nothing answers is kept and
    // counted — that is the extraction's claim, and `unanswered` exists to keep the
    // gap visible. A candidate is a *discovery*: offering one the vault cannot hold
    // would manufacture exactly the dead related entry the 676-on-870 measurement
    // is about, which is the defect this file already works to reduce.
    const r = shapeRelatedLists(
      { entities: [ent('A', { related_entities: ['Metformin'] })], concepts: [] },
      { ...deps, candidates: offering('Niemand', 'Auch-Niemand') },
    );
    expect(r.entities[0].related_entities).toEqual(['Metformin']);
    expect(r.entities[0].related_concepts).toBeUndefined();
    expect(r.unanswered).toEqual([]);
    expect(r.crossSource).toBe(0);
  });

  it('gives the source what is already placed, so nothing is offered twice', () => {
    const seen = new Set<string>();
    const d = {
      ...deps,
      candidates: (_self: string, exclude: ReadonlySet<string>) => {
        seen.add([...exclude].sort().join(','));
        return ['Metformin', 'Oxidativer-Stress'];
      },
    };
    const r = shapeRelatedLists(
      { entities: [ent('A', { related_entities: ['Metformin'] })], concepts: [] },
      { ...d, granularity: 'standard' as const },
    );
    // `exclude` carries the item's own key and the name already placed for it.
    expect([...seen][0]).toContain('a');
    expect([...seen][0]).toContain('metformin');
    expect(r.entities[0].related_concepts).toEqual(['Oxidativer-Stress']);
    expect(r.crossSource).toBe(1);
  });

  it('leaves the sibling rule alone: an orphan still gets siblings first', () => {
    const r = shapeRelatedLists(
      { entities: [ent('A1'), ent('A2'), ent('A3'), ent('A4'), ent('A5')], concepts: [] },
      { ...deps, granularity: 'standard' as const, candidates: offering('Oxidativer-Stress') },
    );
    // Phase 1 defers the allocation algorithm (Phase 2 steps 3 and 5), so the
    // sibling behaviour is untouched and only the new entries are bounded.
    expect(r.siblings).toBe(5 * RELATED_SIBLING_CAP);
    expect(r.entities[1].related_entities).toHaveLength(RELATED_SIBLING_CAP);
  });

  it('reads the cap from the tier, so a narrower granularity adds less', () => {
    const d = { ...deps, resolve: (n: string) => (/^C\d$/.test(n) ? { title: n, kind: 'entity' as const } : vault.get(n.toLowerCase().replace(/\s+/g, '-'))) };
    const r = shapeRelatedLists(
      { entities: [ent('A', { related_entities: ['Metformin'] })], concepts: [] },
      { ...d, granularity: 'minimal' as const, candidates: offering('C1', 'C2', 'C3') },
    );
    expect(RELATED_BUDGET.minimal.crossSource).toBe(1);
    expect((r.entities[0].related_entities ?? []).filter((n) => /^C\d$/.test(n))).toEqual(['C1']);
    expect(r.crossSource).toBe(1);
  });

  it('stays idempotent with the source present, and does not re-add what it wrote', () => {
    const d = { ...deps, granularity: 'standard' as const, candidates: offering('Oxidativer-Stress', 'Metformin') };
    const once = shapeRelatedLists({ entities: [ent('A', { related_entities: ['Metformin'] })], concepts: [] }, d);
    const twice = shapeRelatedLists(once, d);
    expect(twice.entities).toEqual(once.entities);
    expect(twice.crossSource).toBe(0);
  });
});
