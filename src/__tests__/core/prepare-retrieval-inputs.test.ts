// The three query strings the retrieval produces are three DIFFERENT policies,
// and #855's second review found two of them wired to the wrong one.
//
// Point 2: `llmQuery` was `retrievalQuery` — up to five earlier user turns
// joined to the question — while `query-keywords.ts:97` labels the argument
// `User question: "${query}"`. On the first turn that is true. From the second
// turn on it is a lie, and the model is asked to extract keywords from a
// transcript.
//
// Point 3: the escalation gate read `query`, which carries the expansion. The
// expansion's words come from page BODIES, so they sit in no page's name tier,
// and `nameTierCoverage` is the name tier's share of the query's total IDF. More
// body-words, lower ratio, and a query whose own words match a title starts
// escalating to a paid LLM stage it did not need.
//
// The gate deliberately does NOT read the current question alone. History words
// are legitimate retrieval input and a follow-up ("那 MoE 呢？") carries no
// content words of its own; gating on the question alone would escalate every
// follow-up. The gate reads history plus the question, and nothing else. That
// is exactly the pre-expansion behaviour, which is what the gate was calibrated
// against.
//
// These are separate functions, not one query string, so the wiring is
// testable. Calling `buildRetrievalQuery` and checking its output would not
// have caught either defect.
import { describe, it, expect } from 'vitest';
import { prepareRetrievalInputs, RETRIEVAL_QUERY_POLICY } from '../../core/retrieval-query';
import { segment } from '../../core/term-index';

const history = [
  { role: 'user', content: 'K3 与 DeepSeek 的架构异同？' },
  { role: 'assistant', content: '两者在注意力机制上有明显差别……（长篇回答）' },
  { role: 'user', content: '那 MoE 呢？' },
  { role: 'assistant', content: 'MoE 方面……（长篇回答）' },
];

describe('prepareRetrievalInputs — three strings, three policies', () => {
  it('gives the LLM the current question and nothing else', () => {
    const out = prepareRetrievalInputs('为什么？', history, 2);

    expect(out.llmQuery).toBe('为什么？');
    // The prompt labels this "User question:". History must never appear.
    expect(out.llmQuery).not.toContain('K3 与 DeepSeek');
    expect(out.llmQuery).not.toContain('那 MoE 呢？');
  });

  it('gates on the retrieval query WITHOUT the expansion', () => {
    const out = prepareRetrievalInputs('为什么？', history, 2);

    // History counts: a follow-up carries no content words of its own.
    expect(out.gateQuery).toContain('K3 与 DeepSeek');
    expect(out.gateQuery).toContain('为什么？');
    // Expansion words count against coverage and must not be here. The gate
    // input is byte-identical to what the pre-expansion pipeline gated on.
    expect(out.gateQuery).toBe(out.retrievalQuery);
  });

  it('segments the expansion terms so a Chinese query is not one token', () => {
    const out = prepareRetrievalInputs('深度学习的训练方法', [], 5);

    expect(out.expansionTerms.map(t => t.term)).toEqual([...segment('深度学习的训练方法')]);
    expect(out.expansionTerms.length).toBeGreaterThan(1);
    expect(out.expansionTerms.map(t => t.term)).not.toContain('深度学习的训练方法');
  });

  it('weights the history below the question in the expansion terms', () => {
    const out = prepareRetrievalInputs('为什么？', history, 2);
    const weights = out.expansionTerms.map(t => t.weight);
    const pastWeights = weights.filter(w => w !== 1);

    // #855 fix 3. Concatenating four unrelated turns at full weight let the
    // history outvote the present: topic-switch MRR 1.000 -> 0.38-0.44.
    expect(weights.length).toBeGreaterThan(0);
    expect(pastWeights.length).toBeGreaterThan(0);
    expect(Math.max(...pastWeights)).toBeLessThan(1);
    // The question's own words stay at full weight.
    expect(Math.max(...weights)).toBe(1);
  });

  it('collapses to the question alone on the first turn', () => {
    const out = prepareRetrievalInputs('为什么？', [], 5);

    expect(out.llmQuery).toBe('为什么？');
    expect(out.gateQuery).toBe('为什么？');
    expect(out.retrievalQuery).toBe('为什么？');
  });

  it('keeps the assistant out of every one of the three', () => {
    const out = prepareRetrievalInputs('为什么？', history, 5);
    const joined = [out.llmQuery, out.gateQuery, out.retrievalQuery].join(' ');

    expect(joined).not.toContain('注意力机制上有明显差别');
    expect(joined).not.toContain('MoE 方面');
  });

  it('states the policy it encodes, so the next reader does not re-derive it', () => {
    // A named export rather than a comment: the values are load-bearing and a
    // reviewer should be able to assert on them.
    expect(RETRIEVAL_QUERY_POLICY.llm).toBe('current-question');
    expect(RETRIEVAL_QUERY_POLICY.gate).toBe('retrieval-query-unexpanded');
    expect(RETRIEVAL_QUERY_POLICY.retrieval).toBe('retrieval-query');
  });
});
