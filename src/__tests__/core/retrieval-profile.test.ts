// retrieval-profile.test.ts — what a page offers the seed stage.
//
// The measured loss in #729 is at the lexical seed stage: the query says "how
// has knowledge evolved" and the page is titled "Consolidation kernel". The
// title and aliases share no word with the question, so the page scores zero
// and is never selected. The page's summary says what it is about in prose,
// which is the same register the question is written in.
//
// The summary was already in the candidate's hands — `read-index.ts` maps it
// out of the index — and the scoring ignored it. These tests pin the tier that
// fixes that, and pin that a low-weight tier can only add candidates.

import { describe, it, expect } from 'vitest';
import {
  scoreProfile,
  PROFILE_WEIGHTS,
  type PageProfile,
} from '../../../src/core/retrieval-profile';

const p = (over: Partial<PageProfile>): PageProfile => ({
  title: 'Consolidation kernel',
  aliases: [],
  ...over,
});

describe('scoreProfile — the weight tiers', () => {
  it('exposes one table for the four fields, so the stages cannot drift', () => {
    expect(PROFILE_WEIGHTS).toEqual({ title: 3, alias: 2, summary: 1, text: 1 });
  });

  it('scores a title hit above an alias hit above a summary hit', () => {
    expect(scoreProfile(p({}), ['consolidation']).score).toBe(3);
    expect(scoreProfile(p({ title: 'Other', aliases: ['consolidation'] }), ['consolidation']).score).toBe(2);
    expect(scoreProfile(p({ title: 'Other', summary: 'about the consolidation step' }), ['consolidation']).score).toBe(1);
  });

  it('scores each needle once, at the first field that carries it', () => {
    // "consolidation" is in the title and in the summary: it pays the title
    // tier once, not both.
    const r = scoreProfile(p({ summary: 'the consolidation step' }), ['consolidation']);
    expect(r.score).toBe(3);
    expect(r.tokensFound).toBe(1);
  });

  it('counts a needle found in any field as found', () => {
    const r = scoreProfile(
      p({ title: 'Other', aliases: ['kernel'], summary: 'about knowledge evolution' }),
      ['kernel', 'evolution'],
    );
    expect(r.tokensFound).toBe(2);
    expect(r.score).toBe(2 + 1);
  });
});

describe('scoreProfile — a low-weight tier only adds candidates', () => {
  it('leaves a page with no overlap out entirely', () => {
    expect(scoreProfile(p({ summary: 'unrelated text' }), ['nothing here']).score).toBe(0);
  });

  it('promotes a page the name-only rule would have dropped', () => {
    // The measured failure: no name overlap, but the summary carries the idea.
    const profile = p({ title: 'Consolidation kernel', aliases: ['kernel'], summary: 'how knowledge evolved across sources' });
    expect(scoreProfile(profile, ['knowledge', 'evolved']).score).toBe(1 + 1);
  });

  it('never lowers the score of a page the name rule already matched', () => {
    const withSummary = scoreProfile(p({ summary: 'consolidation' }), ['consolidation']);
    const without = scoreProfile(p({}), ['consolidation']);
    expect(withSummary.score).toBeGreaterThanOrEqual(without.score);
  });
});

describe('scoreProfile — the page prose, when the caller has it', () => {
  it('gives the prose the same low tier as the summary', () => {
    // The Mentions section holds 2-4 verbatim sentences from the note. It is
    // on disk and the seed stage never read it.
    const r = scoreProfile(
      p({ title: 'Other', text: 'Verbatim from the note: the consolidation kernel forms here.' }),
      ['consolidation'],
    );
    expect(r.score).toBe(1);
  });

  it('does not let a long body drown a name hit', () => {
    const r = scoreProfile(
      p({ title: 'Consolidation kernel', text: 'consolidation '.repeat(50) }),
      ['consolidation'],
    );
    expect(r.score).toBe(3);
  });
});
