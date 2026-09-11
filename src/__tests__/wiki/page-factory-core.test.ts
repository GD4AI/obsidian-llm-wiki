import { describe, it, expect } from 'vitest';
import { PageFactory } from '../../wiki/page-factory';
import { createMockContext, createMockFile } from '../__support__/engine-context';
import { createMockEntity } from '../__support__/factories';
import type { SourceAnalysis } from '../../types';

// Helper: create minimal valid SourceAnalysis for tests
function createMockAnalysis(
  overrides: Partial<SourceAnalysis> = {}
): SourceAnalysis {
  return {
    source_file: 'test.md',
    source_title: 'Test',
    summary: '',
    entities: [],
    concepts: [],
    related_pages: [],
    key_points: [],
    created_pages: [],
    updated_pages: [],
    ...overrides
  };
}

describe('PageFactory — Core Paths', () => {
  describe('resolvePagePath — LLM fallback', () => {
    it('uses slug path when no existing pages', async () => {
      const { ctx } = createMockContext({
        vaultFiles: {},
        llmResponses: [],
      });
      const factory = new PageFactory(ctx);

      // Use private method via type assertion
      const result = await (factory as unknown as { resolvePagePath: (n: string, t: 'entity' | 'concept', s: string) => Promise<{ path: string | null }> })
        .resolvePagePath('New Entity', 'entity', 'A new entity summary');

      expect(result.path).toBe('wiki/entities/new-entity.md');
    });

    it('detects exact slug match and returns existing path', async () => {
      const { ctx } = createMockContext({
        vaultFiles: {
          'wiki/entities/existing-entity.md': '---\ntype: entity\n---\n# Existing Entity\nContent',
        },
        llmResponses: [],
      });
      const factory = new PageFactory(ctx);

      const result = await (factory as unknown as { resolvePagePath: (n: string, t: 'entity' | 'concept', s: string) => Promise<{ path: string | null }> })
        .resolvePagePath('Existing Entity', 'entity', 'Summary');

      expect(result.path).toBe('wiki/entities/existing-entity.md');
    });

    it('calls LLM for semantic match when no slug match', async () => {
      const { ctx } = createMockContext({
        vaultFiles: {
          'wiki/entities/similar-item.md': '---\ntype: entity\ntitle: Similar Item\n---\n# Similar Item\nContent',
        },
        llmResponses: [
          JSON.stringify({ match: true, path: 'wiki/entities/similar-item.md' }),
        ],
      });
      const factory = new PageFactory(ctx);

      // Create a getter to check if LLM was called
      let llmCalled = false;
      const originalGetClient = ctx.getClient;
      ctx.getClient = () => {
        const client = originalGetClient();
        if (!client) throw new Error('Mock client not initialized');
        return {
          createMessage: async (params: {
            model: string;
            max_tokens: number;
            system?: string;
            messages: Array<{ role: 'user' | 'assistant'; content: string }>;
            response_format?: { type: 'json_object' };
            cacheBreakpoint?: number;
          }) => {
            llmCalled = true;
            return client.createMessage(params);
          },
        };
      };

      const result = await (factory as unknown as { resolvePagePath: (n: string, t: 'entity' | 'concept', s: string) => Promise<{ path: string | null }> })
        .resolvePagePath('Similar Entity', 'entity', 'A similar entity');

      expect(llmCalled).toBe(true);
      expect(result.path).toBe('wiki/entities/similar-item.md');
    });

    it('returns slug path when LLM returns no match', async () => {
      const { ctx } = createMockContext({
        vaultFiles: {
          'wiki/entities/existing.md': '---\ntype: entity\n---\n# Existing',
        },
        llmResponses: [
          JSON.stringify({ match: false, path: null }),
        ],
      });
      const factory = new PageFactory(ctx);

      const result = await (factory as unknown as { resolvePagePath: (n: string, t: 'entity' | 'concept', s: string) => Promise<{ path: string | null }> })
        .resolvePagePath('Unique Entity', 'entity', 'Totally unique summary');

      expect(result.path).toBe('wiki/entities/unique-entity.md');
    });

    // Issue #472: a concept of the same name is a different designator, so it
    // is not a target and not an obstacle — the entity gets its own page.
    it('ignores a same-name page in the opposite folder', async () => {
      const { ctx } = createMockContext({
        vaultFiles: {
          'wiki/concepts/shared-name.md': '---\ntype: concept\n---\n# Shared Name\nContent',
        },
        llmResponses: [],
      });
      const factory = new PageFactory(ctx);

      const result = await (factory as unknown as { resolvePagePath: (n: string, t: 'entity' | 'concept', s: string) => Promise<{ path: string | null }> })
        .resolvePagePath('Shared Name', 'entity', 'An entity with shared name');

      expect(result.path).toBe('wiki/entities/shared-name.md');
    });
  });

  describe('createOrUpdatePage — merge path', () => {
    it('merges content when page exists and not reviewed', async () => {
      const { ctx, vault } = createMockContext({
        vaultFiles: {
          'wiki/entities/existing.md': '---\ntype: entity\naliases: ["Old Alias"]\n---\n# Existing\nOld content',
        },
        llmResponses: [
          JSON.stringify({ strategy: 'merge', reason: 'has new info' }), // v1.24.0 #216 triage
          'Merged content here', // LLM merge response
        ],
      });
      const factory = new PageFactory(ctx);

      const entity = createMockEntity({
        name: 'Existing',
        summary: 'New summary info',
      });

      await factory.createOrUpdateEntityPage(
        entity,
        createMockAnalysis(),
        createMockFile('sources/doc.md'),
        []
      );

      const content = vault.read('wiki/entities/existing.md');
      expect(content).toContain('Merged content here');
    });

    it('appends minimally when page is reviewed', async () => {
      const { ctx, vault } = createMockContext({
        vaultFiles: {
          'wiki/entities/reviewed.md': '---\ntype: entity\nreviewed: true\n---\n# Reviewed\nContent locked',
        },
        llmResponses: [
          'New mention content', // appendToReviewedPage response
        ],
      });
      const factory = new PageFactory(ctx);

      const entity = createMockEntity({
        name: 'Reviewed',
        summary: 'Additional info',
      });

      await factory.createOrUpdateEntityPage(
        entity,
        createMockAnalysis(),
        createMockFile('sources/doc.md'),
        []
      );

      const content = vault.read('wiki/entities/reviewed.md');
      expect(content).toContain('New mention content');
    });

    it('creates new page when no existing page', async () => {
      const { ctx, vault } = createMockContext({
        vaultFiles: {},
        llmResponses: [
          '---\ntype: entity\n---\n# Brand New\nFresh content',
        ],
      });
      const factory = new PageFactory(ctx);

      const entity = createMockEntity({
        name: 'Brand New',
        summary: 'Brand new entity',
      });

      await factory.createOrUpdateEntityPage(
        entity,
        createMockAnalysis(),
        createMockFile('sources/doc.md'),
        []
      );

      const content = vault.read('wiki/entities/brand-new.md');
      expect(content).toContain('Fresh content');
    });

    it('writes its own page instead of merging into the opposite folder', async () => {
      const { ctx, vault } = createMockContext({
        vaultFiles: {
          'wiki/concepts/collision.md': '---\ntype: concept\n---\n# Collision\nConcept content',
        },
        llmResponses: [
          JSON.stringify({ strategy: 'merge', reason: 'has new info' }), // v1.24.0 #216 triage
          'Merged entity content into concept',
        ],
      });
      const factory = new PageFactory(ctx);

      const entity = createMockEntity({
        name: 'Collision',
        summary: 'Entity with same name',
      });

      await factory.createOrUpdateEntityPage(
        entity,
        createMockAnalysis(),
        createMockFile('sources/doc.md'),
        []
      );

      // Issue #472: the concept page keeps its content untouched; the entity
      // is written to its own folder.
      const concept = vault.read('wiki/concepts/collision.md');
      expect(concept).not.toContain('Merged entity content into concept');
      expect(vault.read('wiki/entities/collision.md')).toBeTruthy();
    });
  });


  describe('Edge cases', () => {
    it('skips empty entity names', async () => {
      const { ctx } = createMockContext({});
      const factory = new PageFactory(ctx);

      const entity = createMockEntity({ name: '' });

      const result = await factory.createOrUpdateEntityPage(
        entity,
        createMockAnalysis(),
        createMockFile('sources/doc.md'),
        []
      );

      expect(result.path).toBeNull();
    });

    it('handles NO_NEW_CONTENT response gracefully', async () => {
      const { ctx, vault } = createMockContext({
        vaultFiles: {
          'wiki/entities/keep.md': '---\ntype: entity\n---\n# Keep\nOriginal content',
        },
        llmResponses: [
          JSON.stringify({ strategy: 'merge', reason: 'has new info' }), // v1.24.0 #216 triage
          'NO_NEW_CONTENT',
        ],
      });
      const factory = new PageFactory(ctx);

      const entity = createMockEntity({
        name: 'Keep',
        summary: 'Duplicate info',
      });

      await factory.createOrUpdateEntityPage(
        entity,
        createMockAnalysis(),
        createMockFile('sources/doc.md'),
        []
      );

      // Content should remain unchanged
      const content = vault.read('wiki/entities/keep.md');
      expect(content).toContain('Original content');
    });
  });
});
