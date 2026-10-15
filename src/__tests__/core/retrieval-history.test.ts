// The retrieval must see the conversation. A follow-up question carries no
// content words and retrieves nothing on its own.
//
// Measured 2026-10-15 on both vaults, 1,000 follow-up cases built from the
// layered-eval questions: scoring "为什么？" alone lands at 0.015-0.047 r@10,
// and scoring it with the recent turns lands at 0.49-0.67. Sixteen to
// thirty-three times, for the cost of a string.

import { describe, it, expect } from 'vitest';
import { buildRetrievalQuery } from '../../core/retrieval-query';
import { RETRIEVAL_HISTORY_ROUNDS } from '../../constants';

const history = [
  { role: 'user', content: 'K3 与 DeepSeek 的架构异同？' },
  { role: 'assistant', content: '两者在注意力机制上有明显差别……（长篇回答）' },
  { role: 'user', content: '那 MoE 呢？' },
  { role: 'assistant', content: 'MoE 方面……（长篇回答）' },
];

describe('buildRetrievalQuery', () => {
  it('puts the recent user turns before the current question', () => {
    const out = buildRetrievalQuery('为什么？', history, 2);
    expect(out).toContain('K3 与 DeepSeek');
    expect(out).toContain('那 MoE 呢？');
    expect(out).toContain('为什么？');
  });

  it('keeps the assistant answers out — they are prose, not intent', () => {
    const out = buildRetrievalQuery('为什么？', history, 2);
    expect(out).not.toContain('注意力机制上有明显差别');
    expect(out).not.toContain('MoE 方面');
  });

  it('honours maxRounds', () => {
    const out = buildRetrievalQuery('为什么？', history, 1);
    expect(out).not.toContain('K3 与 DeepSeek');
    expect(out).toContain('那 MoE 呢？');
    expect(out).toContain('为什么？');
  });

  it('returns the current question alone when maxRounds is 0', () => {
    expect(buildRetrievalQuery('为什么？', history, 0)).toBe('为什么？');
  });

  it('returns the current question alone when the history is empty', () => {
    expect(buildRetrievalQuery('为什么？', [], 3)).toBe('为什么？');
  });

  it('puts the current question last so a scorer weighting the head reads history first', () => {
    const out = buildRetrievalQuery('为什么？', history, 2);
    expect(out.endsWith('为什么？')).toBe(true);
  });

  it('slides over the last RETRIEVAL_HISTORY_ROUNDS turns, not the whole transcript', () => {
    // The full transcript in the query adds vocabulary the query does not
    // want. Measured on 2026-10-15: the gain saturates and the tail is noise.
    const long = Array.from({ length: 12 }, (_, i) => ({ role: 'user', content: `第 ${i + 1} 个问题` }));
    const out = buildRetrievalQuery('为什么？', long, RETRIEVAL_HISTORY_ROUNDS);
    expect(RETRIEVAL_HISTORY_ROUNDS).toBe(5);
    expect(out).toContain('第 12 个问题');
    expect(out).toContain('第 8 个问题');
    expect(out).not.toContain('第 7 个问题');
    expect(out).not.toContain('第 1 个问题');
  });

  it('exposes the round count as a shared constant, not a magic number', () => {
    expect(RETRIEVAL_HISTORY_ROUNDS).toBeGreaterThan(0);
  });
});
