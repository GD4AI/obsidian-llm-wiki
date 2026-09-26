// Issue #470: the reasoning-only guard from v1.19.0 (Issue #99), restored.
//
// The failure it names is a 200: a thinking-capable model on a runtime that
// ignores the thinking-disable control spends its budget in the reasoning
// channel and returns empty visible content at `finish_reason: length`.
// Without the guard the caller sees a parse failure and goes looking for a
// bad prompt.
//
// The tests below are mostly about when it must NOT fire. A guard that throws
// on a healthy call is worse than the gap it closes — it turns a working
// setup into a broken one, and the two narrowings against the v1.19.0
// predicate (reasoning-channel payloads, silent providers) are exactly the
// cases the 2026 code base produces and the 2025 one did not.

import { describe, it, expect } from 'vitest';
import { assertNotReasoningOnly, extractResultReasoning, normalizeUsage } from '../../llm-sdk/finish-reason';

const REASONING_ONLY = { inputTokens: 100, outputTokens: 600, reasoningTokens: 600 };

describe('assertNotReasoningOnly', () => {
  it('throws on empty content at length with the budget spent on reasoning', () => {
    expect(() => assertNotReasoningOnly('', 'length', REASONING_ONLY))
      .toThrow(/empty content after spending 600 of 600 output tokens on reasoning/);
  });

  it('throws at the halfway mark, matching the v1.19.0 predicate', () => {
    expect(() => assertNotReasoningOnly('', 'length', {
      outputTokens: 600, reasoningTokens: 300,
    })).toThrow(/reasoning/);
    expect(() => assertNotReasoningOnly('', 'length', {
      outputTokens: 600, reasoningTokens: 299,
    })).not.toThrow();
  });

  it('does not fire when content came back', () => {
    expect(() => assertNotReasoningOnly('{"entities":[]}', 'length', REASONING_ONLY)).not.toThrow();
  });

  // LMStudio + Qwen3.5 routes structured output into `reasoning_content` and
  // leaves the visible field empty. The client prepends it before this runs,
  // so by the time the guard sees the text, that call has its answer.
  it('does not fire when the answer arrived through the reasoning channel', () => {
    const prepended = '<think>{"entities":[]}</think>';
    expect(() => assertNotReasoningOnly(prepended, 'length', REASONING_ONLY)).not.toThrow();
  });

  it('does not fire on a clean stop, however the tokens were spent', () => {
    expect(() => assertNotReasoningOnly('', 'stop', REASONING_ONLY)).not.toThrow();
  });

  // Truncation with no reasoning breakdown is #305's signal, not this one.
  it('does not fire when the provider never reported reasoning tokens', () => {
    expect(() => assertNotReasoningOnly('', 'length', { outputTokens: 600 })).not.toThrow();
    expect(() => assertNotReasoningOnly('', 'length', undefined)).not.toThrow();
  });

  it('does not divide by a zero or missing output count', () => {
    expect(() => assertNotReasoningOnly('', 'length', { outputTokens: 0, reasoningTokens: 0 }))
      .not.toThrow();
    expect(() => assertNotReasoningOnly('', 'length', { reasoningTokens: 600 })).not.toThrow();
  });
});

describe('normalizeUsage', () => {
  it('lifts the current SDK field onto LLMUsage', () => {
    expect(normalizeUsage({
      inputTokens: 10, outputTokens: 20, outputTokenDetails: { reasoningTokens: 7 },
    })?.reasoningTokens).toBe(7);
  });

  it('falls back to the deprecated top-level field', () => {
    expect(normalizeUsage({ outputTokens: 20, reasoningTokens: 7 })?.reasoningTokens).toBe(7);
  });

  it('prefers the current field when both are present', () => {
    expect(normalizeUsage({
      outputTokens: 20, reasoningTokens: 1, outputTokenDetails: { reasoningTokens: 7 },
    })?.reasoningTokens).toBe(7);
  });

  // Absent must stay absent: a provider that omits the field and a model that
  // did not think both read as 0 once collapsed, and only one of those says
  // anything about the model.
  it('leaves an unreported count undefined rather than zero', () => {
    const usage = normalizeUsage({ inputTokens: 10, outputTokens: 20 });
    expect(usage).toBeDefined();
    expect(usage?.reasoningTokens).toBeUndefined();
  });

  it('keeps the other fields it was given', () => {
    expect(normalizeUsage({ inputTokens: 10, outputTokens: 20, totalTokens: 30 }))
      .toMatchObject({ inputTokens: 10, outputTokens: 20, totalTokens: 30 });
  });

  it('passes through a missing usage object', () => {
    expect(normalizeUsage(undefined)).toBeUndefined();
    expect(normalizeUsage(null)).toBeUndefined();
  });
});

describe('extractResultReasoning (AI SDK v7 finalStep)', () => {
  it('prefers reasoningText when present', async () => {
    await expect(extractResultReasoning({
      finalStep: { reasoning: [{ text: 'parts' }], reasoningText: 'concatenated' },
    })).resolves.toBe('concatenated');
  });

  it('falls back to reasoning parts when reasoningText is empty', async () => {
    await expect(extractResultReasoning({
      finalStep: { reasoning: [{ text: 'a' }, { text: 'b' }], reasoningText: '' },
    })).resolves.toBe('ab');
  });

  it('awaits a PromiseLike finalStep (streamText shape)', async () => {
    await expect(extractResultReasoning({
      finalStep: Promise.resolve({ reasoning: [{ text: 'streamed' }], reasoningText: undefined }),
    })).resolves.toBe('streamed');
  });

  it('returns empty when finalStep is missing', async () => {
    await expect(extractResultReasoning({})).resolves.toBe('');
  });
});
