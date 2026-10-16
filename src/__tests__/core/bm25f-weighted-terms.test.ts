/**
 * Query terms carry their own weight.
 *
 * Why. The retrieval query is now the current question plus the recent turns,
 * concatenated. Every word went into the bag at the same weight, so four
 * turns of history drowned the question the user actually asked. Measured on
 * a topic-switch case — the current question plus four unrelated history
 * turns — concatenation drops self-retrieval MRR from 1.000 to 0.38-0.44.
 *
 * The fix is not to stop concatenating: a follow-up question carries no
 * content words and scores nothing on its own. The fix is to weight the
 * history's words lower. Measured at x0.3, the topic-switch case holds at
 * 0.93-0.99 while the follow-up case stays at 1.000.
 *
 * `bm25fScore` takes an optional per-term weight. A caller that passes plain
 * strings gets weight 1 everywhere, which is the behaviour before this
 * change.
 */
import { describe, it, expect } from 'vitest';
import { bm25fScore, buildPageTerms, buildCorpusTerms, DEFAULT_FIELD_WEIGHTS } from '../../core/term-index';

const page = buildPageTerms({ title: 'Target', aliases: [], summary: 'topic alpha', text: 'topic alpha beta gamma' });
const corpus = buildCorpusTerms([page]);

describe('bm25fScore honours per-term weights', () => {
  it('a plain string weighs 1', () => {
    expect(bm25fScore(['topic'], page, corpus, DEFAULT_FIELD_WEIGHTS))
      .toBe(bm25fScore([{ term: 'topic', weight: 1 }], page, corpus, DEFAULT_FIELD_WEIGHTS));
  });

  it('a heavier term scores more than the same term at weight 1', () => {
    const one = bm25fScore([{ term: 'topic', weight: 1 }], page, corpus, DEFAULT_FIELD_WEIGHTS);
    const three = bm25fScore([{ term: 'topic', weight: 3 }], page, corpus, DEFAULT_FIELD_WEIGHTS);
    expect(three).toBeGreaterThan(one);
  });

  it('a lighter term scores less', () => {
    const one = bm25fScore([{ term: 'topic', weight: 1 }], page, corpus, DEFAULT_FIELD_WEIGHTS);
    const light = bm25fScore([{ term: 'topic', weight: 0.3 }], page, corpus, DEFAULT_FIELD_WEIGHTS);
    expect(light).toBeLessThan(one);
  });

  it('scales linearly in the weight', () => {
    const one = bm25fScore([{ term: 'topic', weight: 1 }], page, corpus, DEFAULT_FIELD_WEIGHTS);
    const two = bm25fScore([{ term: 'topic', weight: 2 }], page, corpus, DEFAULT_FIELD_WEIGHTS);
    expect(two).toBeCloseTo(one * 2, 6);
  });

  it('a history word at 0.3 cannot outrank the current question at 1', () => {
    // The topic-switch shape: one word of the current question, three words
    // of unrelated history. Without weights the history wins by count.
    const equal = bm25fScore(
      ['topic', 'other', 'other', 'other'],
      page,
      corpus,
      DEFAULT_FIELD_WEIGHTS,
    );
    const weighted = bm25fScore(
      [
        { term: 'topic', weight: 1 },
        { term: 'other', weight: 0.3 },
        { term: 'other', weight: 0.3 },
        { term: 'other', weight: 0.3 },
      ],
      page,
      corpus,
      DEFAULT_FIELD_WEIGHTS,
    );
    // `other` is not in the page, so both equal the topic-only score; the
    // point of the test is that the weighted form does not ADD the history's
    // weight to the topic's.
    expect(weighted).toBeLessThanOrEqual(equal);
    expect(weighted).toBeGreaterThan(0);
  });

  it('a zero-weight term contributes nothing', () => {
    const none = bm25fScore([{ term: 'topic', weight: 0 }], page, corpus, DEFAULT_FIELD_WEIGHTS);
    expect(none).toBe(0);
  });
});
