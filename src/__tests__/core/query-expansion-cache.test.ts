/**
 * #855 review point 4. `buildPageTerms` over every page with a body is the
 * 4.4 s per query on 2,864 pages that #843 measured and removed. `twoStageExpand`
 * must accept terms built once per index file, not rebuild them per query.
 *
 * The test proves the `prebuilt` path is taken by mutating the array: if the
 * implementation rebuilt the terms it would ignore the mutation and the score
 * would not change.
 */
import { describe, it, expect } from 'vitest';
import { twoStageExpand, buildExpansionTerms, expandQueryForRetrieval, ExpansionTermsCache, DEFAULT_EXPANSION } from '../../core/query-expansion';
import { buildCorpusTerms, type PageTerms } from '../../core/term-index';

const PAGES = [
  { key: 'kimi', title: 'Kimi', summary: 'MoE 稀疏注意力', text: 'Kimi K2 用 MoE 做稀疏注意力。万亿参数。跨词汇桥接。' },
  { key: 'deepseek', title: 'DeepSeek', summary: 'MoE 门控', text: 'DeepSeek-V3 用 MoE。门控专家路由。多头潜注意力。' },
  { key: 'glm', title: 'GLM-4.5', summary: '混合专家', text: 'GLM-4.5 用混合专家架构。推理能力。' },
  { key: 'qwen', title: 'Qwen3', summary: '稠密模型', text: 'Qwen3 是稠密模型。注意力机制。位置编码。' },
];

describe('the expansion reads prebuilt terms instead of rebuilding them (#855 point 4)', () => {
  it('buildExpansionTerms produces the tables the scorer reads', () => {
    const pts = buildExpansionTerms(PAGES);
    expect(pts).toHaveLength(4);
    // `FieldTerms` is a term-frequency map, not a list. The title of
    // "Kimi" segments to `kimi` (NFKC + case-fold).
    expect(pts[0].fields.title.tf.has('kimi')).toBe(true);
  });

  it('twoStageExpand with prebuilt gives the same result as without', () => {
    const corpus = buildCorpusTerms(buildExpansionTerms(PAGES));
    const without = twoStageExpand(['kimi', '架构'], PAGES, corpus, DEFAULT_EXPANSION);
    const prebuilt = buildExpansionTerms(PAGES);
    const withPrebuilt = twoStageExpand(['kimi', '架构'], PAGES, corpus, DEFAULT_EXPANSION, prebuilt);
    expect(withPrebuilt).toEqual(without);
  });

  it('twoStageExpand uses the prebuilt array rather than rebuilding', () => {
    // Hand it a table with every field empty. A rebuild would ignore the
    // array and score from fresh terms; using `prebuilt` scores from nothing
    // and the expansion adds no words.
    const empty: PageTerms[] = PAGES.map(() => ({
      fields: {
        title: { tf: new Map(), gramTf: new Map(), length: 0 },
        alias: { tf: new Map(), gramTf: new Map(), length: 0 },
        summary: { tf: new Map(), gramTf: new Map(), length: 0 },
        text: { tf: new Map(), gramTf: new Map(), length: 0 },
      },
    }));
    const corpus = buildCorpusTerms(buildExpansionTerms(PAGES));

    const fromEmpty = twoStageExpand(['kimi', '架构'], PAGES, corpus, DEFAULT_EXPANSION, empty);
    const fromReal = twoStageExpand(['kimi', '架构'], PAGES, corpus, DEFAULT_EXPANSION, buildExpansionTerms(PAGES));

    // Empty tables score zero everywhere, so no page is in the neighbourhood
    // and no word is added.
    expect(fromEmpty).toEqual(['kimi', '架构']);
    expect(fromReal.length).toBeGreaterThan(fromEmpty.length);
  });

  it('expandQueryForRetrieval joins the expansion back into a query string', () => {
    const pts = buildExpansionTerms(PAGES);
    const corpus = buildCorpusTerms(pts);
    const out = expandQueryForRetrieval('kimi 架构', PAGES, corpus, DEFAULT_EXPANSION, pts);
    expect(out.startsWith('kimi 架构')).toBe(true);
    expect(out.split(' ').length).toBeGreaterThanOrEqual(2);
  });

  it('returns the query unchanged when there is no neighbourhood', () => {
    const corpus = buildCorpusTerms([]);
    expect(expandQueryForRetrieval('kimi', [], corpus)).toBe('kimi');
  });
});

describe('ExpansionTermsCache builds once per key (#855 point 4)', () => {
  it('builds on the first call and serves the rest from cache', () => {
    const cache = new ExpansionTermsCache();
    cache.get('idx-1', PAGES);
    cache.get('idx-1', PAGES);
    cache.get('idx-1', PAGES);
    expect(cache.buildCount).toBe(1);
  });

  it('rebuilds when the key changes (a different index file)', () => {
    const cache = new ExpansionTermsCache();
    cache.get('idx-1', PAGES);
    cache.get('idx-2', PAGES);
    expect(cache.buildCount).toBe(2);
  });

  it('rebuilds when a BODY changes and the index key does not', () => {
    // #855 review point 4, second half. The cache claimed to be "keyed on the
    // same signature the term-index cache uses" and signed only the index. A
    // prose edit leaves `index.md` untouched — that is the common edit — so the
    // expansion tables stayed stale for the rest of the session while the
    // name-tier tables beside them rebuilt correctly. `contentSignature` signs
    // the bodies, and this is the assertion that it is applied here.
    const cache = new ExpansionTermsCache();
    cache.get('idx-1', PAGES);

    const edited = PAGES.map((p, i) => (i === 0 ? { ...p, text: `${p.text} REWRITTEN` } : p));
    const after = cache.get('idx-1', edited);

    expect(cache.buildCount).toBe(2);
    // And the table handed back carries the NEW prose, not the old one.
    const tf = after.terms[0].fields.text.tf;
    expect(tf.has('rewritten')).toBe(true);
  });

  it('the cached corpus is the one the scorer reads', () => {
    const cache = new ExpansionTermsCache();
    const a = cache.get('idx-1', PAGES);
    const b = cache.get('idx-1', PAGES);
    expect(a.corpus).toBe(b.corpus);
  });
});
