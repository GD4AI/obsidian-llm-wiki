// The answer context has no token budget (#880). `RETRIEVAL_BUDGET = 20` is a
// PAGE count, each page carries its own character cap, and `assembleWikiContext`
// joins the bodies with no total. Measured on the production vault, 27 of 30
// answers exceed an 8k window.
//
// These tests define the shape of the fix before it exists. The estimator is a
// TABLE, not a tokenizer: a tokenizer is a dependency the plugin cannot ship,
// and a per-character ratio is the honest substitute when it is deliberately
// conservative.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  CHARS_PER_TOKEN_CJK,
  CHARS_PER_TOKEN_OTHER,
  estimateTokens,
  fitPagesToBudget,
  DEFAULT_CONTEXT_BUDGET_TOKENS,
} from '../../core/context-budget';

const CHARS = (n: number) => 'x'.repeat(n);

describe('estimateTokens', () => {
  it('estimates CJK text as denser than the same character count of Latin text', () => {
    // The whole reason one global ratio is not usable: it would be wrong by
    // 1.7x between Chinese and English, which is the distance between "fits 8k"
    // and "does not".
    const cjk = estimateTokens('中'.repeat(1000));
    const latin = estimateTokens(CHARS(1000));
    expect(cjk).toBeGreaterThan(latin);
    expect(cjk).toBe(Math.ceil(1000 / CHARS_PER_TOKEN_CJK));
    expect(latin).toBe(Math.ceil(1000 / CHARS_PER_TOKEN_OTHER));
  });

  it('estimates a MIXED string per part, not by one ratio', () => {
    // The first version took one ratio from the wiki language and applied it to
    // everything, so the page-summary hint — fifty lines of ASCII paths — was
    // estimated at the CJK ratio and looked twice its real cost. That wasted a
    // third of the budget on the production vault.
    const ascii = CHARS(1000);
    const cjk = '中'.repeat(1000);
    expect(estimateTokens(ascii + cjk)).toBe(
      Math.ceil(1000 / CHARS_PER_TOKEN_OTHER + 1000 / CHARS_PER_TOKEN_CJK),
    );
  });

  it('estimates empty text as zero tokens', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('is conservative on purpose: the CJK ratio is below every measured value', () => {
    // Measured with o200k on this repo's own locales: zh 2.99, zh-Hant 2.70,
    // ja 2.77, ko 3.10, ru 3.86, it 3.88, de 4.08, pt 4.12, es 4.19, fr 4.23,
    // en 4.47 characters per token; real Chinese vault prose measured 2.64.
    // Under-estimating characters per token OVER-estimates tokens, which drops
    // a page that would have fitted. Over-estimating would mean a provider
    // error. The asymmetry is the point.
    expect(CHARS_PER_TOKEN_CJK).toBeLessThanOrEqual(2.64);
    expect(CHARS_PER_TOKEN_OTHER).toBeLessThanOrEqual(3.86);
  });
});

describe('fitPagesToBudget', () => {
  const cjk = (chars: number) => '中'.repeat(chars);

  it('keeps the ranked head and drops the tail, preserving order', () => {
    const bodies = [cjk(1000), cjk(1000), cjk(1000), cjk(1000)];
    const each = estimateTokens(bodies[0]);
    // A budget of exactly three bodies' worth fits three, and the fourth is the
    // one dropped. Derived from the estimator so the test states the rule
    // rather than a ratio that changes when the table does.
    const r = fitPagesToBudget(bodies, each * 3);
    expect(r.kept).toEqual(bodies.slice(0, 3));
    expect(r.keptCount).toBe(3);
    expect(r.totalCount).toBe(4);
    expect(r.dropped).toBe(1);
  });

  it('keeps one page even when a single body exceeds the whole budget', () => {
    // An empty context is a worse failure than an over-budget one: the answer
    // would come from general knowledge with no warning. This is the case where
    // "stop at the first overflow" is wrong.
    const bodies = [cjk(20_000), cjk(1000)];
    const r = fitPagesToBudget(bodies, 500);
    expect(r.keptCount).toBe(1);
    expect(r.kept[0]).toBe(bodies[0]);
    expect(r.overBudgetSinglePage).toBe(true);
  });

  it('keeps a body that fits exactly and drops one character more', () => {
    // 2,500 characters at 2.5 chars/token is exactly 1,000 tokens.
    const exact = cjk(2500);
    const over = cjk(2501);
    expect(fitPagesToBudget([exact], 1000).keptCount).toBe(1);
    // The over-by-one case still keeps the page, because it is the FIRST page
    // and the one-page floor applies. The boundary is therefore asserted with
    // two bodies, where the second is the one being judged.
    const two = fitPagesToBudget([exact, over], 1000);
    expect(two.keptCount).toBe(1);
    expect(two.dropped).toBe(1);
  });

  it('subtracts the reserve before admitting any page', () => {
    // The first version spent the whole budget on bodies and left 20 of 30
    // answers over the very limit it reported: the assembled context is the
    // bodies PLUS the summary hint and the instructions, so a body budget equal
    // to the whole budget is over it by construction.
    const bodies = [cjk(1000), cjk(1000), cjk(1000)];
    const each = estimateTokens(bodies[0]);
    expect(fitPagesToBudget(bodies, each * 2).keptCount).toBe(2);
    expect(fitPagesToBudget(bodies, each * 2, each).keptCount).toBe(1);
  });

  it('still keeps one page when the reserve swallows the whole budget', () => {
    // A long summary hint on a large vault can cost more than the budget. The
    // floor still applies: one page, and the flag says the limit was overrun.
    const bodies = [cjk(100), cjk(100)];
    const r = fitPagesToBudget(bodies, 100, 5000);
    expect(r.keptCount).toBe(1);
    expect(r.overBudgetSinglePage).toBe(true);
  });

  it('reports the reserve in the total, so the number is the context cost', () => {
    const body = cjk(2500);
    const r = fitPagesToBudget([body], 2000, 300);
    expect(r.estimatedTokens).toBe(estimateTokens(body) + 300);
  });

  it('returns every body when the budget is not a limit', () => {
    const bodies = [cjk(10), cjk(10), cjk(10)];
    const r = fitPagesToBudget(bodies, 0);
    expect(r.keptCount).toBe(3);
    expect(r.budgetApplied).toBe(false);
  });

  it('treats an empty list as an empty result, not as one page', () => {
    const r = fitPagesToBudget([], 1000);
    expect(r.keptCount).toBe(0);
    expect(r.estimatedTokens).toBe(0);
  });

  // Issue #880 review (DocTpoint, 2026-10-27): the retrieval label named every
  // page retrieval selected, including the ones this function dropped — an
  // answer built from 6 pages showed 20. The caller can only fix that if it
  // learns WHICH bodies were kept, and a body carries no path, so the indexes
  // have to come from here.
  describe('keptIndexes', () => {
    it('names the positions kept, not the count', () => {
      const bodies = [cjk(10), cjk(10), cjk(10)];
      // Two fit, the third does not.
      const twoThirds = Math.ceil(fitPagesToBudget(bodies, 1e9).estimatedTokens * (2 / 3));
      const r = fitPagesToBudget(bodies, twoThirds);

      expect(r.keptCount).toBe(2);
      expect(r.keptIndexes).toEqual([0, 1]);
    });

    it('is the same length as kept and in the same order', () => {
      const bodies = [cjk(5), cjk(5), cjk(5), cjk(5)];
      const r = fitPagesToBudget(bodies, 1e9);

      expect(r.keptIndexes).toHaveLength(r.kept.length);
      expect(r.keptIndexes.map((i) => bodies[i])).toEqual(r.kept);
    });

    it('covers every body when the budget is not applied', () => {
      const bodies = [cjk(5), cjk(5)];
      const r = fitPagesToBudget(bodies, 0);

      expect(r.budgetApplied).toBe(false);
      expect(r.keptIndexes).toEqual([0, 1]);
    });

    it('is empty for an empty input, so the caller cannot fabricate a page', () => {
      expect(fitPagesToBudget([], 1000).keptIndexes).toEqual([]);
    });
  });
});

describe('the default', () => {
  it('is 8192 tokens, a window every local runtime can serve', () => {
    // The maintainer chose a single default over per-provider ones on
    // 2026-10-24: 8192 is the common floor for LM Studio and Ollama, dropping
    // low-ranked pages is silent and safe, and one number needs one sentence in
    // eleven locales instead of a rule the user has to understand.
    expect(DEFAULT_CONTEXT_BUDGET_TOKENS).toBe(8192);
  });
});

describe('wiring', () => {
  const read = (p: string) => readFileSync(fileURLToPath(new URL(`../../../${p}`, import.meta.url)), 'utf8');

  it('the query view applies the budget before assembling the context', () => {
    // A fix written, unit-tested and reached by nothing has happened six times
    // in this project. The budget is only real if the one production caller of
    // `assembleWikiContext` goes through it.
    const src = read('src/wiki/query-engine/QueryView-class.ts');
    const budgetAt = src.indexOf('fitPagesToBudget');
    const assembleAt = src.indexOf('assembleWikiContext({');
    expect(budgetAt).toBeGreaterThan(-1);
    expect(assembleAt).toBeGreaterThan(-1);
    expect(budgetAt).toBeLessThan(assembleAt);
  });

  it('the setting is in the bottom advanced panel, not the LLM advanced one', () => {
    // AGENTS §"Settings panel scope rule": the LLM Advanced section is for
    // sampling and provider overrides only. A context budget is a query-surface
    // limit, so it belongs in the bottom panel with the other query toggles.
    const panel = read('src/ui/settings-sections/advanced-settings-section.ts');
    expect(panel).toContain('queryContextBudgetTokens');
    const llmPanel = read('src/ui/settings-sections/advanced-section.ts');
    expect(llmPanel).not.toContain('queryContextBudgetTokens');
  });
});
