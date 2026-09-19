// Cache-stable layout of the semantic dedup prompt.
//
// A local KV prefix cache reuses computation only up to the first byte
// where consecutive prompts differ. Two properties make the dedup call
// cacheable and both are pinned here:
//
//   1. Template order: the invariant {{existing_pages}} list must render
//      BEFORE the per-call candidate block. With the candidate first,
//      consecutive calls share only ~200 chars and every call pays the
//      full prefill (measured: ~69-90 s per ~46K-token full-list call at
//      520-630 tok/s; with the list first a repeat costs ~1.7 s).
//
//   2. List order: pages created during an ingest run must join the list
//      at the END (ctime ascending). Alphabetical or vault-iteration
//      order inserts mid-list and re-pays the suffix from the insertion
//      point (measured: ~30 s for a mid-list insert vs ~1.2 s for
//      append).

import { describe, it, expect, vi } from 'vitest';
import { PROMPTS } from '../../../prompts';
import {
  resolvePagePath,
  type PathResolutionContext,
} from '../../../wiki/page-factory/path-resolution';
import type { LLMWikiSettings } from '../../../types';
import { PathResolutionLLMSchema } from '../../../llm-sdk/output-schemas';
import { mockExistingWikiPages } from '../../__support__/engine-context';
import type { WikiPageRef } from '../../../types';

describe('resolveEntityDedup template — invariant prefix first', () => {
  it('renders the existing-pages list before the per-call candidate block', () => {
    const t = PROMPTS.resolveEntityDedup;
    const listPos = t.indexOf('{{existing_pages}}');
    const namePos = t.indexOf('{{entity_name}}');
    expect(listPos).toBeGreaterThan(-1);
    expect(namePos).toBeGreaterThan(-1);
    expect(listPos).toBeLessThan(namePos);
  });
});

interface MockFile {
  path: string;
  basename: string;
  stat?: { ctime: number };
}

function makeCtx(files: MockFile[], capture: { prompt?: string }): PathResolutionContext {
  return {
    settings: { wikiFolder: 'wiki', slugCase: 'preserve' } as LLMWikiSettings,
    app: {
      vault: {
        getMarkdownFiles: () => files,
        read: async () => '',
      },
    },
    async tryReadFile(): Promise<string | null> { return null; },
    async createOrUpdateFile(): Promise<void> { /* not reached */ },
    getClient() {
      return {
        createMessage: async (...args: unknown[]) => {
          const req = args[0] as { messages: Array<{ content: string }> };
          capture.prompt = req.messages[0].content;
          return JSON.stringify({ match: false });
        },
      };
    },
    async buildSystemPrompt(): Promise<string> { return 'system'; },
    getExistingWikiPages(): Promise<WikiPageRef[]> {
      return mockExistingWikiPages(this)();
    },
  };
}

describe('resolvePagePath — append-only candidate list order (ctime ascending)', () => {
  it('renders same-type pages sorted by ctime even when the vault yields them shuffled', async () => {
    const capture: { prompt?: string } = {};
    // Vault iteration order deliberately contradicts creation order.
    const ctx = makeCtx(
      [
        { path: 'wiki/entities/newest.md', basename: 'newest', stat: { ctime: 3000 } },
        { path: 'wiki/entities/oldest.md', basename: 'oldest', stat: { ctime: 1000 } },
        { path: 'wiki/entities/middle.md', basename: 'middle', stat: { ctime: 2000 } },
      ],
      capture,
    );
    await resolvePagePath(ctx, 'BrandNewThing', 'entity', 'summary');
    const p = capture.prompt;
    expect(p).toBeDefined();
    const oldest = p!.indexOf('entities/oldest.md');
    const middle = p!.indexOf('entities/middle.md');
    const newest = p!.indexOf('entities/newest.md');
    expect(oldest).toBeGreaterThan(-1);
    expect(oldest).toBeLessThan(middle);
    expect(middle).toBeLessThan(newest);
  });

  it('keeps the vault order for pages without ctime (stable sort, no crash)', async () => {
    const capture: { prompt?: string } = {};
    const ctx = makeCtx(
      [
        { path: 'wiki/entities/first.md', basename: 'first' },
        { path: 'wiki/entities/second.md', basename: 'second' },
      ],
      capture,
    );
    await resolvePagePath(ctx, 'BrandNewThing', 'entity', 'summary');
    const p = capture.prompt;
    expect(p).toBeDefined();
    expect(p!.indexOf('entities/first.md')).toBeLessThan(p!.indexOf('entities/second.md'));
  });
});

// === typed-output migration (v1.26.3 PATCH Issue #443 expanded scope) ===
// Commit 8 — resolveEntityDedup uses createMessageWithOutput when available;
// falls back to createMessage on legacy clients.
describe('resolvePagePath — typed-output migration (#443 expanded scope)', () => {
  // The LLM dedup call only fires when same-type pages exist (sameTypePages
  // > 0) AND ConflictResolver finds no slug/alias match (cr.action is not
  // 'merge'). Name 'BrandNewThing' deliberately doesn't match any existing
  // entity, so resolvePagePath reaches the LLM call instead of short-circuiting.
  const existingEntityCtx = (client: unknown) => ({
    settings: { wikiFolder: 'wiki', slugCase: 'preserve' } as LLMWikiSettings,
    app: {
      vault: {
        getMarkdownFiles: () => [
          { path: 'wiki/entities/Alpha.md', basename: 'Alpha', stat: { ctime: 1000 } },
          { path: 'wiki/entities/Beta.md', basename: 'Beta', stat: { ctime: 2000 } },
        ],
        read: async () => '# Alpha\nExisting page.',
      },
    },
    async tryReadFile(): Promise<string | null> { return null; },
    async createOrUpdateFile(): Promise<void> {},
    getClient() { return client; },
    async buildSystemPrompt(): Promise<string> { return 'system'; },
    getExistingWikiPages(): Promise<WikiPageRef[]> {
      return mockExistingWikiPages(this)();
    },
  });

  it('passes PathResolutionLLMSchema on the wire via response_format.schema (legacy client)', async () => {
    const createMessage = vi.fn(async (..._args: unknown[]) => JSON.stringify({ match: false }));
    const ctx = existingEntityCtx({ createMessage }) as unknown as Parameters<typeof resolvePagePath>[0];
    await resolvePagePath(ctx, 'BrandNewThing', 'entity', 'A summary.');
    expect(createMessage).toHaveBeenCalled();
    const calls = createMessage.mock.calls as unknown as Array<[unknown]>;
    const args = calls[0]?.[0] as { response_format?: { schema?: unknown } };
    expect(args.response_format?.schema).toBe(PathResolutionLLMSchema);
  });

  it('uses createMessageWithOutput when the client implements it (Tier 0 path)', async () => {
    const createMessageWithOutput = vi.fn(async (_: unknown) => ({
      text: JSON.stringify({ match: false }),
      output: { match: false },
      outputMode: 'json_schema',
      finishReason: 'stop',
    }));
    const createMessage = vi.fn();
    const ctx = existingEntityCtx({ createMessage, createMessageWithOutput }) as unknown as Parameters<typeof resolvePagePath>[0];
    const result = await resolvePagePath(ctx, 'BrandNewThing', 'entity', 'A summary.');
    expect(createMessageWithOutput).toHaveBeenCalled();
    expect(createMessage).not.toHaveBeenCalled();
    const calls = createMessageWithOutput.mock.calls as unknown as Array<[unknown]>;
    const args = calls[0]?.[0] as { response_format?: { schema?: unknown } };
    expect(args.response_format?.schema).toBe(PathResolutionLLMSchema);
    expect(result.path).toBe('wiki/entities/BrandNewThing.md'); // no match → slug path (preserve case)
  });

  it('falls back to createMessage when client lacks createMessageWithOutput', async () => {
    const createMessage = vi.fn(async (..._args: unknown[]) => JSON.stringify({ match: false }));
    const ctx = existingEntityCtx({ createMessage }) as unknown as Parameters<typeof resolvePagePath>[0];
    const result = await resolvePagePath(ctx, 'BrandNewThing', 'entity', 'A summary.');
    expect(createMessage).toHaveBeenCalled();
    expect(result.path).toBe('wiki/entities/BrandNewThing.md');
  });
});
