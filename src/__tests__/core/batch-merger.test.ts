import { describe, it, expect } from 'vitest';
import {
  createEmptyAccumulation,
  mergeBatchResults,
  buildSourceAnalysis,
  extractUniqueNames,
  calculateBatchStats,
} from '../../core/batch-merger';
import { EntityInfo, ConceptInfo } from '../../types';

describe('Batch Merger — Pure Functions', () => {
  describe('createEmptyAccumulation', () => {
    it('creates empty accumulation with empty arrays', () => {
      const result = createEmptyAccumulation();

      expect(result.entities).toEqual([]);
      expect(result.concepts).toEqual([]);
      expect(result.relatedPages).toEqual([]);
      expect(result.keyPoints).toEqual([]);
      expect(result.extractedNames).toEqual(new Set<string>());
    });

    it('creates independent Set instance', () => {
      const acc1 = createEmptyAccumulation();
      const acc2 = createEmptyAccumulation();

      acc1.extractedNames.add('test');
      expect(acc2.extractedNames.has('test')).toBe(false);
    });
  });

  describe('mergeBatchResults', () => {
    const createTestEntity = (name: string, aliases?: string[]): EntityInfo => ({
      name,
      aliases,
      type: 'person',
      summary: `Test entity ${name}`,
      mentions_in_source: ['test context']
    });

    const createTestConcept = (name: string, aliases?: string[]): ConceptInfo => ({
      name,
      aliases,
      type: 'theory',
      summary: `Test concept ${name}`,
      mentions_in_source: ['test context'],
      related_concepts: []
    });

    it('merges new entities and concepts without duplicates', () => {
      const current = createEmptyAccumulation();
      current.extractedNames.add('existing');

      const newBatch = {
        entities: [createTestEntity('new-entity')],
        concepts: [createTestConcept('new-concept')]
      };

      const result = mergeBatchResults(current, newBatch);

      expect(result.newEntities).toHaveLength(1);
      expect(result.newEntities[0].name).toBe('new-entity');
      expect(result.newConcepts).toHaveLength(1);
      expect(result.newConcepts[0].name).toBe('new-concept');
      expect(result.allEntities).toHaveLength(1);
      expect(result.allConcepts).toHaveLength(1);
    });

    it('filters out duplicate entities by name', () => {
      const current = createEmptyAccumulation();
      current.extractedNames.add('duplicate');

      const newBatch = {
        entities: [createTestEntity('duplicate'), createTestEntity('unique')],
        concepts: []
      };

      const result = mergeBatchResults(current, newBatch);

      expect(result.newEntities).toHaveLength(1);
      expect(result.newEntities[0].name).toBe('unique');
      expect(result.allEntities).toHaveLength(1);
    });

    it('does not filter entities by alias (alias added after passing)', () => {
      const current = createEmptyAccumulation();
      current.extractedNames.add('alias-name');

      const newBatch = {
        entities: [createTestEntity('entity-name', ['alias-name'])],
        concepts: []
      };

      const result = mergeBatchResults(current, newBatch);

      // Name is unique, passes filter. Alias will be added to extractedNames AFTER.
      expect(result.newEntities).toHaveLength(1);
      expect(result.newEntities[0].name).toBe('entity-name');
      // But alias gets added to set for future batches
      expect(result.extractedNames.has('alias-name')).toBe(true);
    });

    it('filters out duplicate concepts by name', () => {
      const current = createEmptyAccumulation();
      current.extractedNames.add('duplicate-concept');

      const newBatch = {
        entities: [],
        concepts: [createTestConcept('duplicate-concept'), createTestConcept('unique-concept')]
      };

      const result = mergeBatchResults(current, newBatch);

      expect(result.newConcepts).toHaveLength(1);
      expect(result.newConcepts[0].name).toBe('unique-concept');
    });

    it('does not filter concepts by alias (alias added after passing)', () => {
      const current = createEmptyAccumulation();
      current.extractedNames.add('concept-alias');

      const newBatch = {
        entities: [],
        concepts: [createTestConcept('concept-name', ['concept-alias'])]
      };

      const result = mergeBatchResults(current, newBatch);

      // Name is unique, passes filter. Alias will be added AFTER.
      expect(result.newConcepts).toHaveLength(1);
      expect(result.newConcepts[0].name).toBe('concept-name');
      // But alias gets added to set for future batches
      expect(result.extractedNames.has('concept-alias')).toBe(true);
    });

    it('applies custom entity cap', () => {
      const current = createEmptyAccumulation();
      current.entities.push(createTestEntity('existing1'));
      current.entities.push(createTestEntity('existing2'));

      const newBatch = {
        entities: [
          createTestEntity('new1'),
          createTestEntity('new2'),
          createTestEntity('new3')
        ],
        concepts: []
      };

      const result = mergeBatchResults(current, newBatch, { entityCap: 5 });

      // 2 existing + 3 new = 5, but cap is 5, so should add 3
      expect(result.newEntities).toHaveLength(3);
      expect(result.allEntities).toHaveLength(5);
    });

    it('applies custom concept cap', () => {
      const current = createEmptyAccumulation();
      current.concepts.push(createTestConcept('existing1'));

      const newBatch = {
        entities: [],
        concepts: [
          createTestConcept('new1'),
          createTestConcept('new2'),
          createTestConcept('new3')
        ]
      };

      const result = mergeBatchResults(current, newBatch, { conceptCap: 3 });

      // 1 existing + need 2 more to reach cap of 3
      expect(result.newConcepts).toHaveLength(2);
      expect(result.allConcepts).toHaveLength(3);
    });

    it('applies both custom caps simultaneously', () => {
      const current = createEmptyAccumulation();
      current.entities.push(createTestEntity('e1'));
      current.concepts.push(createTestConcept('c1'));

      const newBatch = {
        entities: [createTestEntity('e2'), createTestEntity('e3')],
        concepts: [createTestConcept('c2'), createTestConcept('c3')]
      };

      const result = mergeBatchResults(current, newBatch, {
        entityCap: 2,
        conceptCap: 2
      });

      expect(result.newEntities).toHaveLength(1);
      expect(result.allEntities).toHaveLength(2);
      expect(result.newConcepts).toHaveLength(1);
      expect(result.allConcepts).toHaveLength(2);
    });

    it('handles zero remaining capacity', () => {
      const current = createEmptyAccumulation();
      current.entities.push(createTestEntity('e1'));
      current.entities.push(createTestEntity('e2'));

      const newBatch = {
        entities: [createTestEntity('e3')],
        concepts: []
      };

      const result = mergeBatchResults(current, newBatch, { entityCap: 2 });

      expect(result.newEntities).toHaveLength(0);
      expect(result.allEntities).toHaveLength(2);
    });

    it('adds names and aliases to extractedNames set', () => {
      const current = createEmptyAccumulation();
      const newBatch = {
        entities: [createTestEntity('entity1', ['alias1', 'alias2'])],
        concepts: [createTestConcept('concept1', ['conceptAlias'])]
      };

      const result = mergeBatchResults(current, newBatch);

      expect(result.extractedNames.has('entity1')).toBe(true);
      expect(result.extractedNames.has('alias1')).toBe(true);
      expect(result.extractedNames.has('alias2')).toBe(true);
      expect(result.extractedNames.has('concept1')).toBe(true);
      expect(result.extractedNames.has('conceptalias')).toBe(true);
    });

    it('preserves existing extractedNames', () => {
      const current = createEmptyAccumulation();
      current.extractedNames.add('existing');

      const newBatch = {
        entities: [createTestEntity('new')],
        concepts: []
      };

      const result = mergeBatchResults(current, newBatch);

      expect(result.extractedNames.has('existing')).toBe(true);
      expect(result.extractedNames.has('new')).toBe(true);
    });

    it('normalizes names to lowercase', () => {
      const current = createEmptyAccumulation();
      const newBatch = {
        entities: [createTestEntity('TestEntity', ['TestAlias'])],
        concepts: []
      };

      const result = mergeBatchResults(current, newBatch);

      expect(result.extractedNames.has('testentity')).toBe(true);
      expect(result.extractedNames.has('testalias')).toBe(true);
    });

    it('handles empty new batch', () => {
      const current = createEmptyAccumulation();
      current.entities.push(createTestEntity('existing'));

      const result = mergeBatchResults(current, { entities: [], concepts: [] });

      expect(result.newEntities).toHaveLength(0);
      expect(result.newConcepts).toHaveLength(0);
      expect(result.allEntities).toHaveLength(1);
    });

    // ─── Issue #244: mentions_with_provenance merge on duplicate ─────────────

    it('merges mentions_with_provenance from duplicate entity into existing', () => {
      const current = createEmptyAccumulation();
      current.entities.push({
        name: 'shared-entity',
        type: 'person',
        summary: 'First source version',
        mentions_in_source: ['quote from source A'],
        mentions_with_provenance: [{
          quote: 'quote from source A',
          source_path: 'source-a.md',
          source_slug: 'source-a',
          extracted_at: '2026-07-05T00:00:00Z',
        }],
      });
      current.extractedNames.add('shared-entity');

      const newBatch = {
        entities: [{
          name: 'shared-entity',
          type: 'person' as const,
          summary: 'Different summary (dropped)',
          mentions_in_source: ['quote from source B'],
          mentions_with_provenance: [{
            quote: 'quote from source B',
            source_path: 'source-b.md',
            source_slug: 'source-b',
            extracted_at: '2026-07-05T01:00:00Z',
          }],
        }],
        concepts: [],
      };

      const result = mergeBatchResults(current, newBatch);

      // Duplicate should not appear as new
      expect(result.newEntities).toHaveLength(0);
      // Existing entity should have both quotes in mentions_with_provenance
      expect(result.allEntities).toHaveLength(1);
      expect(result.allEntities[0].mentions_with_provenance).toHaveLength(2);
      expect(result.allEntities[0].mentions_with_provenance![0].quote).toBe('quote from source A');
      expect(result.allEntities[0].mentions_with_provenance![1].quote).toBe('quote from source B');
      // Legacy mentions_in_source should also be merged
      expect(result.allEntities[0].mentions_in_source).toHaveLength(2);
    });

    it('dedups an identical quote from the same source (composite key #267)', () => {
      // Same quote AND same source_path → one mention. This is the realistic
      // batch-accumulation case (every batch of one analyzeSource run shares a
      // source_path), and the composite `(quote, source_path)` key collapses it.
      const current = createEmptyAccumulation();
      current.entities.push({
        name: 'dup-entity',
        type: 'person',
        summary: 'Existing',
        mentions_in_source: ['same quote'],
        mentions_with_provenance: [{
          quote: 'same quote',
          source_path: 'source-a.md',
          source_slug: 'source-a',
          extracted_at: '2026-07-05T00:00:00Z',
        }],
      });
      current.extractedNames.add('dup-entity');

      const newBatch = {
        entities: [{
          name: 'dup-entity',
          type: 'person' as const,
          summary: 'Dup',
          mentions_in_source: ['same quote'],
          mentions_with_provenance: [{
            quote: 'same quote',
            source_path: 'source-a.md',
            source_slug: 'source-a',
            extracted_at: '2026-07-05T01:00:00Z',
          }],
        }],
        concepts: [],
      };

      const result = mergeBatchResults(current, newBatch);

      expect(result.allEntities[0].mentions_with_provenance).toHaveLength(1);
      expect(result.allEntities[0].mentions_in_source).toHaveLength(1);
    });

    it('keeps an identical quote from a different source as distinct (composite key #267)', () => {
      // #267: quote-only dedup would collapse the same sentence appearing in two
      // different sources into one, losing a provenance fact. The composite
      // `(quote, source_path)` key keeps both.
      const current = createEmptyAccumulation();
      current.entities.push({
        name: 'dup-entity',
        type: 'person',
        summary: 'Existing',
        mentions_in_source: ['same quote'],
        mentions_with_provenance: [{
          quote: 'same quote',
          source_path: 'source-a.md',
          source_slug: 'source-a',
          extracted_at: '2026-07-05T00:00:00Z',
        }],
      });
      current.extractedNames.add('dup-entity');

      const newBatch = {
        entities: [{
          name: 'dup-entity',
          type: 'person' as const,
          summary: 'Dup',
          mentions_in_source: ['same quote'],
          mentions_with_provenance: [{
            quote: 'same quote',
            source_path: 'source-b.md',
            source_slug: 'source-b',
            extracted_at: '2026-07-05T01:00:00Z',
          }],
        }],
        concepts: [],
      };

      const result = mergeBatchResults(current, newBatch);

      const prov = result.allEntities[0].mentions_with_provenance!;
      expect(prov).toHaveLength(2);
      expect(prov.map(m => m.source_path).sort()).toEqual(['source-a.md', 'source-b.md']);
    });

    it('merges mentions_with_provenance from duplicate concept into existing', () => {
      const current = createEmptyAccumulation();
      current.concepts.push({
        name: 'shared-concept',
        type: 'theory',
        summary: 'First source',
        mentions_in_source: ['concept quote A'],
        mentions_with_provenance: [{
          quote: 'concept quote A',
          source_path: 'source-a.md',
          source_slug: 'source-a',
          extracted_at: '2026-07-05T00:00:00Z',
        }],
        related_concepts: ['Related'],
      });
      current.extractedNames.add('shared-concept');

      const newBatch = {
        entities: [],
        concepts: [{
          name: 'shared-concept',
          type: 'theory' as const,
          summary: 'Second source (dropped)',
          mentions_in_source: ['concept quote B'],
          mentions_with_provenance: [{
            quote: 'concept quote B',
            source_path: 'source-b.md',
            source_slug: 'source-b',
            extracted_at: '2026-07-05T01:00:00Z',
          }],
          related_concepts: ['Related'],
        }],
      };

      const result = mergeBatchResults(current, newBatch);

      expect(result.newConcepts).toHaveLength(0);
      expect(result.allConcepts).toHaveLength(1);
      expect(result.allConcepts[0].mentions_with_provenance).toHaveLength(2);
    });

    it('maintains original entity when duplicate has no mentions', () => {
      const current = createEmptyAccumulation();
      current.entities.push({
        name: 'no-mentions',
        type: 'person',
        summary: 'Original',
        mentions_in_source: ['original quote'],
      });
      current.extractedNames.add('no-mentions');

      const newBatch = {
        entities: [{
          name: 'no-mentions',
          type: 'person' as const,
          summary: 'No mentions',
          mentions_in_source: [],
        }],
        concepts: [],
      };

      const result = mergeBatchResults(current, newBatch);

      // Should preserve original (no new object created)
      expect(result.allEntities[0].mentions_in_source).toHaveLength(1);
      expect(result.allEntities[0].mentions_in_source[0]).toBe('original quote');
    });
  });

  describe('buildSourceAnalysis', () => {
    it('builds complete SourceAnalysis from accumulation', () => {
      const accumulation = createEmptyAccumulation();
      accumulation.entities.push({
        name: 'test-entity',
        type: 'person',
        summary: 'Test',
        mentions_in_source: ['test']
      });
      accumulation.concepts.push({
        name: 'test-concept',
        type: 'theory',
        summary: 'Test concept',
        mentions_in_source: ['test'],
        related_concepts: []
      });
      accumulation.relatedPages.push('related1', 'related2');
      accumulation.keyPoints.push('point1', 'point2');

      const result = buildSourceAnalysis(
        '/path/to/file.md',
        'file.md',
        accumulation,
        {
          sourceTitle: 'Test Source',
          summary: 'Test summary'
        }
      );

      expect(result.source_file).toBe('/path/to/file.md');
      expect(result.source_title).toBe('Test Source');
      expect(result.summary).toBe('Test summary');
      expect(result.entities).toHaveLength(1);
      expect(result.concepts).toHaveLength(1);
      expect(result.related_pages).toHaveLength(2);
      expect(result.key_points).toHaveLength(2);
      expect(result.created_pages).toEqual([]);
      expect(result.updated_pages).toEqual([]);
    });

    it('uses file basename as fallback title', () => {
      const accumulation = createEmptyAccumulation();
      const result = buildSourceAnalysis(
        '/path/to/test.md',
        'test.md',
        accumulation
      );

      expect(result.source_title).toBe('test.md');
    });

    it('uses empty string as fallback summary', () => {
      const accumulation = createEmptyAccumulation();
      const result = buildSourceAnalysis(
        '/path/to/test.md',
        'test.md',
        accumulation
      );

      expect(result.summary).toBe('');
    });

    it('handles firstBatchData with partial fields', () => {
      const accumulation = createEmptyAccumulation();
      const result = buildSourceAnalysis(
        '/path/to/test.md',
        'test.md',
        accumulation,
        {
          sourceTitle: 'Title Only'
        }
      );

      expect(result.source_title).toBe('Title Only');
      expect(result.summary).toBe('');
    });
  });

  describe('extractUniqueNames', () => {
    it('extracts entity names and aliases', () => {
      const batch = {
        entities: [
          { name: 'Entity1', aliases: ['Alias1', 'Alias2'], type: 'person' as const, summary: '', mentions_in_source: [] },
          { name: 'Entity2', aliases: [], type: 'person' as const, summary: '', mentions_in_source: [] }
        ],
        concepts: []
      };

      const names = extractUniqueNames(batch);

      expect(names.has('entity1')).toBe(true);
      expect(names.has('alias1')).toBe(true);
      expect(names.has('alias2')).toBe(true);
      expect(names.has('entity2')).toBe(true);
      expect(names.size).toBe(4);
    });

    it('extracts concept names and aliases', () => {
      const batch = {
        entities: [],
        concepts: [
          { name: 'Concept1', aliases: ['CAlias'], type: 'theory' as const, summary: '', mentions_in_source: [], related_concepts: [] }
        ]
      };

      const names = extractUniqueNames(batch);

      expect(names.has('concept1')).toBe(true);
      expect(names.has('calias')).toBe(true);
      expect(names.size).toBe(2);
    });

    it('extracts both entities and concepts', () => {
      const batch = {
        entities: [
          { name: 'E', aliases: [], type: 'person' as const, summary: '', mentions_in_source: [] }
        ],
        concepts: [
          { name: 'C', aliases: [], type: 'theory' as const, summary: '', mentions_in_source: [], related_concepts: [] }
        ]
      };

      const names = extractUniqueNames(batch);

      expect(names.has('e')).toBe(true);
      expect(names.has('c')).toBe(true);
      expect(names.size).toBe(2);
    });

    it('normalizes to lowercase', () => {
      const batch = {
        entities: [
          { name: 'TestName', aliases: ['TestAlias'], type: 'person' as const, summary: '', mentions_in_source: [] }
        ],
        concepts: []
      };

      const names = extractUniqueNames(batch);

      expect(names.has('testname')).toBe(true);
      expect(names.has('testalias')).toBe(true);
    });

    it('handles empty aliases array', () => {
      const batch = {
        entities: [
          { name: 'E', aliases: [], type: 'person' as const, summary: '', mentions_in_source: [] }
        ],
        concepts: []
      };

      const names = extractUniqueNames(batch);

      expect(names.has('e')).toBe(true);
      expect(names.size).toBe(1);
    });

    it('handles undefined aliases', () => {
      const batch = {
        entities: [
          { name: 'E', type: 'person' as const, summary: '', mentions_in_source: [] }
        ],
        concepts: []
      };

      const names = extractUniqueNames(batch);

      expect(names.has('e')).toBe(true);
      expect(names.size).toBe(1);
    });

    it('handles empty batch', () => {
      const names = extractUniqueNames({ entities: [], concepts: [] });

      expect(names.size).toBe(0);
    });
  });

  describe('calculateBatchStats', () => {
    it('formats batch statistics correctly', () => {
      const result = calculateBatchStats(
        3,
        { entities: 5, concepts: 3 },
        { entities: 15, concepts: 10 }
      );

      expect(result).toContain('[Batch 3]');
      expect(result).toContain('New: 5 entities, 3 concepts');
      expect(result).toContain('total: 8');
      expect(result).toContain('Cumulative: 15 entities, 10 concepts');
    });

    it('calculates total correctly', () => {
      const result = calculateBatchStats(
        1,
        { entities: 10, concepts: 5 },
        { entities: 10, concepts: 5 }
      );

      expect(result).toContain('total: 15');
    });

    it('handles zero new items', () => {
      const result = calculateBatchStats(
        2,
        { entities: 0, concepts: 0 },
        { entities: 20, concepts: 15 }
      );

      expect(result).toContain('New: 0 entities, 0 concepts');
      expect(result).toContain('total: 0');
    });

    it('handles high batch numbers', () => {
      const result = calculateBatchStats(
        15,
        { entities: 1, concepts: 1 },
        { entities: 100, concepts: 80 }
      );

      expect(result).toContain('[Batch 15]');
    });
  });
});
// domain axis stage 3 (#568): a later round that names the same item again
// may carry its own domain subset — the union survives the duplicate merge.
describe('mergeBatchResults — domains across rounds (domain axis stage 3, #568)', () => {
  const e = (name: string, extra: Partial<EntityInfo>): EntityInfo =>
    ({ name, type: 'other', summary: '', mentions_in_source: [], ...extra } as EntityInfo);
  const round = (acc: ReturnType<typeof createEmptyAccumulation>, entities: EntityInfo[]) => {
    const r = mergeBatchResults(acc, { entities, concepts: [] });
    return { ...acc, entities: r.allEntities, concepts: r.allConcepts, extractedNames: r.extractedNames };
  };

  it('unions domains of a duplicate into the existing item and keeps the first coverage', () => {
    let acc = round(createEmptyAccumulation(), [e('Zink', { domains: ['Sorte/Mineralstoff'], coverage: 'defined' })]);
    acc = round(acc, [e('zink', { domains: ['Thema/Ernährung', 'Sorte/Mineralstoff'], coverage: 'named' })]);
    expect(acc.entities).toHaveLength(1);
    expect(acc.entities[0].domains).toEqual(['Sorte/Mineralstoff', 'Thema/Ernährung']);
    expect(acc.entities[0].coverage).toBe('defined');
  });

  it('leaves the existing item untouched when the duplicate brings nothing new', () => {
    let acc = round(createEmptyAccumulation(), [e('Zink', { domains: ['Sorte/Mineralstoff'] })]);
    const before = acc.entities[0];
    acc = round(acc, [e('Zink', { domains: ['Sorte/Mineralstoff'] })]);
    expect(acc.entities[0]).toBe(before);
  });
});
