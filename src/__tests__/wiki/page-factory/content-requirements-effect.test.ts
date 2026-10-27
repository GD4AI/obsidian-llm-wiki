// Independent reproduction of the two findings reported on #895.
//
// The report claims:
//   1. a requested section is removed after generation;
//   2. a merge into an existing page carries no requirement.
// The claim is verified by running the report's own shape here, not by reading
// the report.
import { describe, it, expect } from 'vitest';
import { createOrUpdateEntityPage, type CreatePageContext } from '../../../wiki/page-factory/create-page';
import { createMockEntity } from '../../__support__/factories';
import type { LLMWikiSettings, WikiPageRef } from '../../../types';
import { mockExistingWikiPages } from '../../__support__/engine-context';

const REQUIREMENT = 'Cite the source episode/chapter when known; use "reportedly/inferred" for unsourced lore; keep a Risk Notes section where applicable';
const MODEL_REPLY = '---\ntype: entity\ntags: [person]\naliases: ["Ada"]\n---\n\n# Ada Lovelace\n\n## Description\nMathematician.\n\n## Risk Notes\n- Some attributions are reportedly disputed.\n\n## Related Entities\n- [[Charles Babbage]]';
const EXISTING_PAGE = '---\ntype: entity\ncreated: 2026-07-10\nupdated: 2026-07-10\nsources:\n  - "[[older-note]]"\ntags: [person]\n---\n\n# Ada Lovelace\n\n## Description\nOlder body.\n';

function makeCtx(files: Record<string, string> = {}) {
  const store = new Map(Object.entries(files));
  const prompts: string[] = [];
  const ctx = {
    app: { vault: { getMarkdownFiles: () => [], read: async (f: { path: string }) => store.get(f.path) ?? '' } },
    settings: { wikiFolder: 'wiki', wikiLanguage: 'en', slugCase: 'preserve', disableThinking: false, contentRequirements: REQUIREMENT } as LLMWikiSettings,
    async tryReadFile(p: string) { return store.get(p) ?? null; },
    async createOrUpdateFile(p: string, c: string) { store.set(p, c); },
    getClient: () => ({ createMessage: async (args: { messages: Array<{ content: unknown }> }) => {
      prompts.push(args.messages.map(m => String(m.content)).join('\n'));
      return MODEL_REPLY;
    } }),
    buildSystemPrompt: async () => 'system',
    getExistingWikiPages(): Promise<WikiPageRef[]> { return mockExistingWikiPages(this)(); },
  } as unknown as CreatePageContext;
  return { ctx, store, prompts };
}

const SOURCE = { path: 'notes/ada.md', basename: 'ada.md' };

describe('#895 contentRequirements — independent reproduction', () => {
  it('the creation prompt carries the requirement', async () => {
    const { ctx, prompts } = makeCtx();
    await createOrUpdateEntityPage(ctx, createMockEntity({ name: 'Ada Lovelace' }), undefined, SOURCE);
    expect(prompts.some(p => p.includes(REQUIREMENT))).toBe(true);
  });

  it('FINDING 1: the written page keeps the Risk Notes section the model wrote', async () => {
    const { ctx, store } = makeCtx();
    const r = await createOrUpdateEntityPage(ctx, createMockEntity({ name: 'Ada Lovelace' }), undefined, SOURCE);
    expect(store.get(r.path!)).toContain('## Description');
    expect(store.get(r.path!)).toContain('## Risk Notes');
  });

  it('FINDING 2: a merge carries the requirement', async () => {
    const { ctx, prompts } = makeCtx({ 'wiki/entities/Ada-Lovelace.md': EXISTING_PAGE });
    const r = await createOrUpdateEntityPage(ctx, createMockEntity({ name: 'Ada Lovelace' }), undefined, SOURCE);
    expect(r.created).toBe(false);
    expect(prompts.map(p => p.includes(REQUIREMENT))).toEqual([true, true]);
  });
});
