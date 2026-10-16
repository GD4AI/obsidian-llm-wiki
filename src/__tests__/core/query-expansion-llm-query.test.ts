/**
 * #855 review point 2. `twoStageExpand` adds words from page bodies that the
 * user did not write. Handing those to the LLM stages labelled as the user's
 * question would pollute the keywords the model generates and the seeds it
 * picks. The model must see the user's own words; the expanded form is for the
 * lexical scorer and the PPR seed derivation only.
 */
import { describe, it, expect } from 'vitest';
import { selectPprSeeds } from '../../wiki/query-engine/pipeline/select-seeds';
import type { PageRef } from '../../core/ppr-cascade';

const REF = (title: string, text = ''): PageRef => ({ path: `${title}.md`, title, aliases: [], text });

describe('the LLM stages see the user\'s words, not the expansion\'s (#855 point 2)', () => {
  it('passes the llmQuery through to generateQueryKeywords when one is given', async () => {
    const seen: string[] = [];
    const client = {
      async createMessage(args: { messages: { content: string }[] }): Promise<never> {
        seen.push(args.messages[0].content);
        throw new Error('stop-after-capture');
      },
    };

    const refs = [REF('kimi', 'Kimi 用 MoE 做稀疏注意力'), REF('deepseek', 'DeepSeek-V3 用 MoE')];

    // query is EXPANDED (words the user did not write); llmQuery is what the
    // user typed. The model must see llmQuery.
    await selectPprSeeds(
      'kimi 架构 MoE 注意力 门控 专家 稀疏',
      refs,
      null,
      client as never,
      {} as never,
      {} as never,
      undefined,
      undefined,
      'kimi 架构',
    ).catch(() => {});

    expect(seen.length).toBeGreaterThan(0);
    const prompt = seen[0];
    expect(prompt).toContain('kimi 架构');
    expect(prompt).not.toContain('门控');
    expect(prompt).not.toContain('稀疏注意力');
  });

  it('falls back to the query when no llmQuery is given (back-compat)', async () => {
    const seen: string[] = [];
    const client = {
      async createMessage(args: { messages: { content: string }[] }): Promise<never> {
        seen.push(args.messages[0].content);
        throw new Error('stop-after-capture');
      },
    };

    const refs = [REF('kimi', 'Kimi 用 MoE')];
    await selectPprSeeds('kimi', refs, null, client as never, {} as never, {} as never).catch(() => {});

    expect(seen.length).toBeGreaterThan(0);
    expect(seen[0]).toContain('kimi');
  });
});
