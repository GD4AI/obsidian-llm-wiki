/**
 * Cheap pre-filter for the expansion scorer.
 *
 * Why. `twoStageExpand` scores every page with `bm25fScore` on every query,
 * twice per query. An inverted index does not help on this workload — the
 * vocabulary is shared, so the candidate set is ninety per cent of the corpus
 * (measured, see `expansion-inverted-index.test.ts`).
 *
 * The pre-filter runs a CHEAP pass first: count how many query terms each
 * page carries, take the top N by that count, and run the full `bm25fScore`
 * only on those. The cheap pass is O(query terms) per page with no IDF, no
 * field weights and no length normalisation; the expensive pass runs on a
 * hundred pages instead of ten thousand.
 *
 * The contract this file pins down is that the top-k result is IDENTICAL to
 * the full scan on the fixtures where it can be. A pre-filter that changes
 * the ranking is a different algorithm, and the expansion's measured gain
 * would no longer describe the shipped code.
 */
import { describe, it, expect } from 'vitest';
import { buildExpansionTerms, twoStageExpand, DEFAULT_EXPANSION, prefilterIndices } from '../../core/query-expansion';
import { buildCorpusTerms, buildInvertedIndex } from '../../core/term-index';
import {
  pagesWithDistinctVocabularies,
  pageWithRareTerm,
  twoPagesSharingAllTerms,
} from '../__support__/expansion-fixtures';

const terms = buildExpansionTerms(pagesWithDistinctVocabularies);
const corpus = buildCorpusTerms(terms);

describe('prefilterIndices — count matching terms, keep the top N', () => {
  it('keeps pages that carry at least one query term', () => {
    const out = prefilterIndices(['alpha-one'], terms, 10);
    // Page 0 carries `alpha`; the others carry `beta`/`gamma`/`delta`.
    expect(out).toContain(0);
  });

  it('keeps at most N pages', () => {
    const out = prefilterIndices(['one'], terms, 2);
    expect(out.length).toBeLessThanOrEqual(2);
  });

  it('returns every page when N covers the corpus', () => {
    const out = prefilterIndices(['one'], terms, 100);
    expect(out.length).toBe(4);
  });

  it('returns every page when there is no prefilter (N <= 0)', () => {
    expect(prefilterIndices(['one'], terms, 0).length).toBe(4);
    expect(prefilterIndices(['one'], terms, -1).length).toBe(4);
  });

  it('ranks by matched-term count, so a page matching two terms beats one matching one', () => {
    // Page 0's terms are alpha/one/two/three; the query matches three of
    // them. Page 1's are beta/one/two/three; the query matches two.
    const out = prefilterIndices(['alpha', 'one', 'two'], terms, 1);
    expect(out).toEqual([0]);
  });

  it('drops pages that match nothing when N is small', () => {
    // A query of an unknown term matches nothing; the pre-filter should keep
    // nothing rather than fill the budget with pages that score zero.
    const out = prefilterIndices(['nonexistent-xyz'], terms, 2);
    expect(out).toEqual([]);
  });
});

describe('the prefilter does not change the expansion', () => {
  it('twoStageExpand with a generous prefilter equals the full scan', () => {
    // N larger than the corpus: the pre-filter keeps every page, so the
    // result must be byte-identical to the unfiltered path.
    const withPre = twoStageExpand(['alpha-one'], pagesWithDistinctVocabularies, corpus, DEFAULT_EXPANSION, terms, undefined, 1000);
    const without = twoStageExpand(['alpha-one'], pagesWithDistinctVocabularies, corpus, DEFAULT_EXPANSION, terms);
    expect(withPre).toEqual(without);
  });

  it('agrees on the rare-term fixture', () => {
    const rareTerms = buildExpansionTerms(pageWithRareTerm);
    const rareCorpus = buildCorpusTerms(rareTerms);
    const withPre = twoStageExpand(['common-one'], pageWithRareTerm, rareCorpus, DEFAULT_EXPANSION, rareTerms, undefined, 1000);
    const without = twoStageExpand(['common-one'], pageWithRareTerm, rareCorpus, DEFAULT_EXPANSION, rareTerms);
    expect(withPre).toEqual(without);
  });

  it('agrees on the shared-vocabulary fixture (the no-op case)', () => {
    const sharedTerms = buildExpansionTerms(twoPagesSharingAllTerms);
    const sharedCorpus = buildCorpusTerms(sharedTerms);
    const withPre = twoStageExpand(['shared-one'], twoPagesSharingAllTerms, sharedCorpus, DEFAULT_EXPANSION, sharedTerms, undefined, 1000);
    const without = twoStageExpand(['shared-one'], twoPagesSharingAllTerms, sharedCorpus, DEFAULT_EXPANSION, sharedTerms);
    expect(withPre).toEqual(without);
  });

  it('combines with the inverted index without changing the result', () => {
    const idx = buildInvertedIndex(terms);
    const withBoth = twoStageExpand(['alpha-one'], pagesWithDistinctVocabularies, corpus, DEFAULT_EXPANSION, terms, idx, 1000);
    const without = twoStageExpand(['alpha-one'], pagesWithDistinctVocabularies, corpus, DEFAULT_EXPANSION, terms);
    expect(withBoth).toEqual(without);
  });
});
