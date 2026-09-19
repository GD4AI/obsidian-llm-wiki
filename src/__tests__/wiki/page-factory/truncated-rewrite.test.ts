// A body rewrite that stopped at the provider's token limit is not adopted.
// Three paths hand a whole page body to the model and take its rewrite:
// mergePage (merge-body), appendToReviewedPage (reviewed-append) and
// updateRelatedPage (related-page). Each must keep the existing body when the
// client reports `finishReason: 'length'`, and behave as before when the
// client reports nothing (legacy/mock clients: 'unknown').
import { describe, it, expect } from 'vitest';
import { TFile } from 'obsidian';
import { mergePage, appendToReviewedPage, type MergeContext } from '../../../wiki/page-factory/merge-page';
import { updateRelatedPage, type RelatedPageContext } from '../../../wiki/page-factory/related-page';
import { captureFinish } from '../../../llm-sdk/finish-reason';
import { createMockEntity } from '../../__support__/factories';
import type { LLMClient, LLMFinishMeta, LLMWikiSettings, SourceAnalysis } from '../../../types';
import { mockExistingWikiPages } from '../../__support__/engine-context';
import type { WikiPageRef } from '../../../types';

type Params = { task?: string; onFinish?: (meta: LLMFinishMeta) => void };

/** Responses in order; the call whose `task` matches `truncateTask` reports 'length'. */
function makeClient(responses: string[], truncateTask?: string): LLMClient {
  let i = 0;
  return {
    createMessage: async (params: unknown) => {
      const p = params as Params;
      if (truncateTask && p.task === truncateTask) p.onFinish?.({ finishReason: 'length' });
      else if (truncateTask) p.onFinish?.({ finishReason: 'stop' });
      return responses[i++] ?? 'NO_NEW_CONTENT';
    },
  };
}

const PAGE = 'wiki/entities/caching.md';
const EXISTING = `---\ntitle: Caching\n---\n\n## Description\nOld text.\n`;
const REVIEWED = `---\ntitle: Caching\nreviewed: true\n---\n\n## Description\nOld text.\n`;

function makeMergeCtx(client: LLMClient): MergeContext & { written: Map<string, string> } {
  const written = new Map<string, string>();
  return {
    written,
    app: { vault: { getMarkdownFiles: () => [], read: async (f: { path: string }) => written.get(f.path) ?? '' } },
    settings: { wikiFolder: 'wiki', wikiLanguage: 'en', slugCase: 'preserve', disableThinking: false } as LLMWikiSettings,
    async tryReadFile(p: string) { return written.get(p) ?? null; },
    async createOrUpdateFile(p: string, c: string) { written.set(p, c); },
    getClient: () => client,
    buildSystemPrompt: async () => 'system',
    getExistingWikiPages(): Promise<WikiPageRef[]> {
      return mockExistingWikiPages(this)();
    },
  };
}

describe('captureFinish', () => {
  it('is not truncated until the client reports length', () => {
    const f = captureFinish();
    expect(f.truncated).toBe(false);
    f.onFinish({ finishReason: 'stop' });
    expect(f.truncated).toBe(false);
    f.onFinish({ finishReason: 'length' });
    expect(f.truncated).toBe(true);
  });
});

describe('mergePage — body rewrite cut off at the token limit', () => {
  const args = (ctx: MergeContext) =>
    mergePage(ctx, createMockEntity({ name: 'Caching' }), 'entity', { path: 'new.md', basename: 'new.md' }, EXISTING, [], PAGE);

  it('keeps the existing page and writes nothing', async () => {
    const ctx = makeMergeCtx(makeClient([JSON.stringify({ strategy: 'merge', reason: 'rewrite' }), 'Half a rewr'], 'merge-body'));
    expect(await args(ctx)).toBe(PAGE);
    expect(ctx.written.has(PAGE)).toBe(false);
  });

  it("adopts the rewrite when the client reports 'stop'", async () => {
    const ctx = makeMergeCtx(makeClient([JSON.stringify({ strategy: 'merge', reason: 'rewrite' }), 'Merged body.'], 'none'));
    await args(ctx);
    expect(ctx.written.get(PAGE)).toContain('Merged body.');
  });

  it('adopts the rewrite when the client reports nothing (legacy/mock)', async () => {
    const ctx = makeMergeCtx(makeClient([JSON.stringify({ strategy: 'merge', reason: 'rewrite' }), 'Merged body.']));
    await args(ctx);
    expect(ctx.written.get(PAGE)).toContain('Merged body.');
  });
});

describe('appendToReviewedPage — append cut off at the token limit', () => {
  it('preserves the reviewed page and writes nothing', async () => {
    const ctx = makeMergeCtx(makeClient(['## Description\nOld text.\n\nHalf an app'], 'reviewed-append'));
    const result = await appendToReviewedPage(ctx, createMockEntity({ name: 'Caching' }), { path: 'new.md', basename: 'new.md' }, REVIEWED, PAGE);
    expect(result).toBe(PAGE);
    expect(ctx.written.has(PAGE)).toBe(false);
  });
});

describe('updateRelatedPage — rewrite cut off at the token limit', () => {
  const PAGE_PATH = 'wiki/entities/X.md';
  const EXISTING_FM = `---\ncreated: 2026-07-10\nupdated: 2026-07-10\nsources:\n  - "[[existing]]"\ntags: []\n---\n\n## Description\nOld body.\n`;
  function makeCtx(client: LLMClient): RelatedPageContext & { written: Map<string, string> } {
    const written = new Map<string, string>([[PAGE_PATH, EXISTING_FM]]);
    return {
      written,
      app: {
        vault: {
          getMarkdownFiles: () => [{ path: PAGE_PATH, basename: 'X' }],
          getAbstractFileByPath: (p: string) => (p === PAGE_PATH ? Object.assign(new TFile(), { path: PAGE_PATH, basename: 'X' }) : null),
          read: async (f: { path: string }) => written.get(f.path) ?? '',
        },
        metadataCache: { getFileCache: () => null },
      } as RelatedPageContext['app'],
      settings: { wikiFolder: 'wiki', wikiLanguage: 'en', slugCase: 'preserve', disableThinking: false } as LLMWikiSettings,
      async tryReadFile(p: string) { return written.get(p) ?? null; },
      async createOrUpdateFile(p: string, c: string) { written.set(p, c); },
      getClient: () => client,
      buildSystemPrompt: async () => 'system',
      getExistingWikiPages(): Promise<WikiPageRef[]> {
        return mockExistingWikiPages(this)();
      },
      };
  }
  const analysis: SourceAnalysis = {
    source_file: 'src.md',
    source_title: 'src',
    summary: 's',
    entities: [{ name: 'X', type: 'other', summary: 's', mentions_in_source: [], related_entities: [], related_concepts: [] }],
    concepts: [],
  } as unknown as SourceAnalysis;

  it('records the new source in frontmatter and keeps the body verbatim', async () => {
    const ctx = makeCtx(makeClient(['## Description\nHalf a rewr'], 'related-page'));
    expect(await updateRelatedPage(ctx, 'X', analysis, { path: 'src.md', basename: 'src.md' })).toBe(PAGE_PATH);
    const written = ctx.written.get(PAGE_PATH)!;
    expect(written).toContain('Old body.');
    expect(written).not.toContain('Half a rewr');
    expect(written).toContain('src.md');
  });

  it("adopts the rewrite when the client reports 'stop'", async () => {
    const ctx = makeCtx(makeClient(['## Description\nNew body.'], 'none'));
    expect(await updateRelatedPage(ctx, 'X', analysis, { path: 'src.md', basename: 'src.md' })).toBe(PAGE_PATH);
    expect(ctx.written.get(PAGE_PATH)).toContain('New body.');
  });
});
