/**
 * Inverted index for the expansion scorer.
 *
 * Why. `twoStageExpand` calls `bm25fScore` once per page per query, twice per
 * query. A page that contains none of the query's terms contributes zero to
 * the score, but the scorer still visits it. The index maps each term to the
 * pages that carry it, so the scorer visits only pages that can score.
 *
 * The contract this file pins down is that the index does not change the
 * result. A faster scorer that ranks differently is a different scorer, and
 * the expansion's measured gain would no longer describe the shipped code.
 */
import { describe, it, expect } from 'vitest';
import { buildInvertedIndex } from '../../core/term-index';
import { buildExpansionTerms, twoStageExpand, DEFAULT_EXPANSION } from '../../core/query-expansion';
import { buildCorpusTerms } from '../../core/term-index';
import { pagesWithDistinctVocabularies, pageWithRareTerm, twoPagesSharingAllTerms } from '../__support__/expansion-fixtures';

const terms = buildExpansionTerms(pagesWithDistinctVocabularies);
const corpus = buildCorpusTerms(terms);

describe('buildInvertedIndex — term to pages', () => {
  it('maps a term to every page that carries it', () => {
    const idx = buildInvertedIndex(terms);
    // The segmenter splits `alpha-one` into `alpha` and `one`, so the index
    // keys are the SEGMENTED terms, not the surface form. `alpha` lives on
    // page 0 only (the fixture's page titles are Alpha/Beta/Gamma/Delta);
    // `one` lives on every page because every page's terms end in `-one`.
    expect(idx.termToPages.get('alpha')).toEqual([0]);
    expect(idx.termToPages.get('one')?.length).toBe(4);
  });

  it('records a term once per page even when the page repeats it', () => {
    const idx = buildInvertedIndex(buildExpansionTerms(twoPagesSharingAllTerms));
    for (const pages of idx.termToPages.values()) {
      expect(new Set(pages).size).toBe(pages.length);
    }
  });

  it('is empty for an empty corpus', () => {
    const idx = buildInvertedIndex([]);
    expect(idx.termToPages.size).toBe(0);
  });

  it('indexes the rare term only on the page that carries it', () => {
    const idx = buildInvertedIndex(buildExpansionTerms(pageWithRareTerm));
    // The rare term is `rare-xyz`; the segmenter keeps `rare` and `xyz`
    // separate but the page that carries it is the one indexed for both.
    expect(idx.termToPages.get('rare')).toEqual([2]);
    expect(idx.termToPages.get('xyz')).toEqual([2]);
    // `common` is on every page.
    expect(idx.termToPages.get('common')?.length).toBe(4);
  });
});

describe('the index does not change the ranking', () => {
  it('twoStageExpand with the index produces the same words as without', () => {
    const idx = buildInvertedIndex(terms);
    const withIndex = twoStageExpand(['alpha-one'], pagesWithDistinctVocabularies, corpus, DEFAULT_EXPANSION, terms, idx);
    const without = twoStageExpand(['alpha-one'], pagesWithDistinctVocabularies, corpus, DEFAULT_EXPANSION, terms);
    expect(withIndex).toEqual(without);
  });

  it('agrees on the rare-term fixture too', () => {
    const rareTerms = buildExpansionTerms(pageWithRareTerm);
    const rareCorpus = buildCorpusTerms(rareTerms);
    const idx = buildInvertedIndex(rareTerms);
    const withIndex = twoStageExpand(['common-one'], pageWithRareTerm, rareCorpus, DEFAULT_EXPANSION, rareTerms, idx);
    const without = twoStageExpand(['common-one'], pageWithRareTerm, rareCorpus, DEFAULT_EXPANSION, rareTerms);
    expect(withIndex).toEqual(without);
  });

  it('agrees on the shared-vocabulary fixture (the no-op case)', () => {
    const sharedTerms = buildExpansionTerms(twoPagesSharingAllTerms);
    const sharedCorpus = buildCorpusTerms(sharedTerms);
    const idx = buildInvertedIndex(sharedTerms);
    const withIndex = twoStageExpand(['shared-one'], twoPagesSharingAllTerms, sharedCorpus, DEFAULT_EXPANSION, sharedTerms, idx);
    const without = twoStageExpand(['shared-one'], twoPagesSharingAllTerms, sharedCorpus, DEFAULT_EXPANSION, sharedTerms);
    expect(withIndex).toEqual(without);
  });

  it('falls back to the full scan when no index is passed', () => {
    // Back-compat: callers that do not build an index get the old behaviour.
    const out = twoStageExpand(['alpha-one'], pagesWithDistinctVocabularies, corpus, DEFAULT_EXPANSION, terms);
    expect(out.length).toBeGreaterThanOrEqual(1);
  });
});
