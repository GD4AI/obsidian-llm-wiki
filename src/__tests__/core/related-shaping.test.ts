// See core/related-shaping.ts.
import { describe, it, expect } from 'vitest';
import { shapeRelatedLists } from '../../core/related-shaping';
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

  it('links every page born from the note to its siblings, by kind, without self or duplicates', () => {
    const r = shapeRelatedLists(
      { entities: [ent('Berberin'), ent('Metformin', { related_entities: ['berberin'] })], concepts: [con('Insulinresistenz')] },
      deps,
    );
    expect(r.entities[0].related_entities).toEqual(['Metformin']);
    expect(r.entities[0].related_concepts).toEqual(['Insulinresistenz']);
    expect(r.entities[1].related_entities).toEqual(['Berberin']);
    expect(r.concepts[0].related_entities).toEqual(['Berberin', 'Metformin']);
    expect(r.concepts[0].related_concepts).toEqual([]);
    expect(r.siblings).toBe(5);
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
