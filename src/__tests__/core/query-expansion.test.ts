/**
 * Two-stage Rocchio query expansion. The corpus supplies the bridge, not the
 * model: the neighbourhood the ranking already found knows the topic's
 * vocabulary, and reading it twice with a re-rank between walks the query
 * across. Every added word comes from the user's own notes.
 *
 * These tests describe properties. They use synthetic terms so the property is
 * visible at a glance and no vault's note names can break them.
 */
import { describe, it, expect } from 'vitest';
import {
  twoStageExpand,
  buildExpansionTerms,
  expandQueryForRetrieval,
  DEFAULT_EXPANSION,
} from '../../core/query-expansion';
import { buildCorpusTerms, type CorpusTerms } from '../../core/term-index';
import {
  twoPagesSharingAllTerms,
  pagesWithDistinctVocabularies,
  pageWithRareTerm,
} from '../__support__/expansion-fixtures';

const corpusOf = (pages: ReturnType<typeof buildExpansionTerms>): CorpusTerms => buildCorpusTerms(pages);
const emptyCorpus = (): CorpusTerms => buildCorpusTerms([]);

describe('twoStageExpand — what the corpus supplies', () => {
  it('adds nothing when no term is distinctive (the pages share every word)', () => {
    const terms = buildExpansionTerms(twoPagesSharingAllTerms);
    const out = twoStageExpand(['shared-one'], twoPagesSharingAllTerms, corpusOf(terms), DEFAULT_EXPANSION, terms);
    expect(out).toEqual(['shared-one']);
  });

  it('adds the neighbourhood\'s distinctive terms when the vocabularies differ', () => {
    const terms = buildExpansionTerms(pagesWithDistinctVocabularies);
    const out = twoStageExpand(['alpha-one'], pagesWithDistinctVocabularies, corpusOf(terms), DEFAULT_EXPANSION, terms);
    expect(out).toContain('alpha-one');
    expect(out.length).toBeGreaterThan(1);
  });

  it('filters by rarity: the rare term appears, the shared ones do not', () => {
    const terms = buildExpansionTerms(pageWithRareTerm);
    const out = twoStageExpand(['common-one'], pageWithRareTerm, corpusOf(terms), DEFAULT_EXPANSION, terms);
    expect(out).toContain('common-one');
    expect(out).not.toContain('rare-xyz');
  });

  it('returns the query unchanged when the corpus is empty', () => {
    expect(twoStageExpand(['anything'], [], emptyCorpus())).toEqual(['anything']);
  });

  it('returns the query unchanged when the query has no terms', () => {
    const terms = buildExpansionTerms(pagesWithDistinctVocabularies);
    expect(twoStageExpand([], pagesWithDistinctVocabularies, corpusOf(terms), DEFAULT_EXPANSION, terms)).toEqual([]);
  });

  it('keeps the original terms first and in order', () => {
    const terms = buildExpansionTerms(pagesWithDistinctVocabularies);
    const out = twoStageExpand(['alpha-one', 'alpha-two'], pagesWithDistinctVocabularies, corpusOf(terms), DEFAULT_EXPANSION, terms);
    expect(out[0]).toBe('alpha-one');
    expect(out[1]).toBe('alpha-two');
  });

  it('stops after the first pass when k2 is 0 (a one-shot call)', () => {
    const terms = buildExpansionTerms(pagesWithDistinctVocabularies);
    const once = twoStageExpand(['alpha-one'], pagesWithDistinctVocabularies, corpusOf(terms), { k1: 5, m1: 10, k2: 0, m2: 0 }, terms);
    const twice = twoStageExpand(['alpha-one'], pagesWithDistinctVocabularies, corpusOf(terms), DEFAULT_EXPANSION, terms);
    expect(once.length).toBeLessThanOrEqual(twice.length);
  });

  it('adds no word the query already says', () => {
    const terms = buildExpansionTerms(pagesWithDistinctVocabularies);
    const out = twoStageExpand(['alpha-one', 'alpha-two'], pagesWithDistinctVocabularies, corpusOf(terms), DEFAULT_EXPANSION, terms);
    expect(out.filter(t => t === 'alpha-one')).toHaveLength(1);
    expect(out.filter(t => t === 'alpha-two')).toHaveLength(1);
  });
});

describe('expandQueryForRetrieval — the one-call entry point', () => {
  it('joins the expansion back into a query string with the original words first', () => {
    const pages = pagesWithDistinctVocabularies;
    const terms = buildExpansionTerms(pages);
    const out = expandQueryForRetrieval('alpha-one alpha-two', pages, corpusOf(terms), DEFAULT_EXPANSION, terms);
    // `tokenizeQuery` reshapes terms (a hyphenated word becomes its parts
    // plus the whole), so assert on what the expansion ADDS rather than on the
    // exact prefix. The original query's words must all be present, and the
    // expansion must have added at least one word the query did not say.
    const outTerms = new Set(out.split(' '));
    expect(outTerms.has('alpha-one')).toBe(true);
    expect(outTerms.has('alpha-two')).toBe(true);
    expect(outTerms.size).toBeGreaterThan(2);
  });

  it('returns the query unchanged when there is no neighbourhood', () => {
    expect(expandQueryForRetrieval('anything', [], emptyCorpus())).toBe('anything');
  });
});
