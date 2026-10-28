// The terms the SHIPPED path hands to the expansion must be segmented, or the
// expansion is a no-op on a Chinese vault.
//
// Measured 2026-10-16 on a four-page fixture, calling the same functions
// `QueryView` calls. `tokenizeQuery` keeps a CJK run as ONE token;
// `bm25fScore` does not segment and the corpus `docFreq` holds bigrams. So the
// token misses every page and `twoStageExpand` returns its input verbatim:
//
//   query                     tokenizeQuery      words added   segment      words added
//   深度学习的训练方法          1 token            1 (echo)      8 bigrams    28
//   深度学习                  1 token            1 (echo)      3 bigrams    23
//   neural network training   3 words            10            3 words      10
//
// The "1 word" is the query echoed back — the expansion did nothing. test8 and
// test10 are Chinese vaults, so every expansion gain reported for them
// described an input the plugin never produces.
//
// `scorePagesByNeedles` already had this step (`needles.flatMap(n => segment(n))`)
// and is the pattern this follows.
import { describe, it, expect } from 'vitest';
import { retrievalQueryTerms } from '../../core/retrieval-query';
import { tokenizeQuery } from '../../core/ppr-cascade';
import { segment } from '../../core/term-index';

describe('retrievalQueryTerms — the shipped composition', () => {
  it('breaks a Chinese query into the bigrams the corpus actually stores', () => {
    const terms = retrievalQueryTerms('深度学习的训练方法');

    // Every term must be findable in a corpus built by `segment`.
    expect(terms).toContain('深度');
    expect(terms).toContain('学习');
    expect(terms).toContain('训练');
    expect(terms.length).toBeGreaterThan(1);
    // And none of them may still be the whole uncut run — that is the bug.
    expect(terms).not.toContain('深度学习的训练方法');
  });

  it('agrees with segment, which is what builds the corpus', () => {
    const query = '深度学习的训练方法';
    expect(retrievalQueryTerms(query)).toEqual([...segment(query)]);
  });

  it('agrees with scorePagesByNeedles\' own composition, token by token', () => {
    // That function is the one place in the codebase that was already right.
    // If the two drift, one of them stops finding Chinese pages.
    const query = '混合 query 深度学习 mixed';
    const ours = retrievalQueryTerms(query);
    const theirs = tokenizeQuery(query).flatMap(n => segment(n));
    expect(ours).toEqual(theirs);
  });

  it('leaves a Latin query as its words', () => {
    expect(retrievalQueryTerms('neural network training')).toEqual(['neural', 'network', 'training']);
  });

  it('returns nothing for an empty query rather than throwing', () => {
    expect(retrievalQueryTerms('')).toEqual([]);
  });
});
