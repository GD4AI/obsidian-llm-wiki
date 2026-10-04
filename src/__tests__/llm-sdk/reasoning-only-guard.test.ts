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
import { assertNotReasoningOnly, normalizeUsage } from '../../llm-sdk/finish-reason';

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
  // so by the time the guard sees the text, that call has its answer. The
  // fourth argument states that fact rather than leaving it to line order.
  it('does not fire when the answer arrived through the reasoning channel', () => {
    const prepended = '<think>{"entities":[]}</think>';
    expect(() => assertNotReasoningOnly(prepended, 'length', REASONING_ONLY, true)).not.toThrow();
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

// Issue #791: a gateway can inline its reasoning into the `content` field
// instead of filling the reasoning channel. The text is then non-empty, so the
// predicate above — which needs an EMPTY content field — never fires, and the
// user gets a bodyless answer with no explanation of why.
//
// The content shape is its own evidence here. A thinking block is present and
// nothing follows it. No metadata is needed, because unlike the empty-content
// case there is something to read.
describe('assertNotReasoningOnly — reasoning inlined into the content field', () => {
  const INLINE_PLAN = '<think>Weigh the chillers, then compare the control loops.</think>';

  it('throws when the content holds only a thinking block', () => {
    expect(() => assertNotReasoningOnly(INLINE_PLAN, 'stop', undefined))
      .toThrow(/only its reasoning/);
  });

  // The reported gateway reports no reasoning breakdown and may stop normally,
  // so neither narrowing in the legacy branch can apply to it.
  it('throws with no usage and no finish reason to consult', () => {
    expect(() => assertNotReasoningOnly(INLINE_PLAN, undefined, undefined)).toThrow();
    expect(() => assertNotReasoningOnly(INLINE_PLAN, 'stop', { outputTokens: 900 })).toThrow();
  });

  // source-analyzer.ts:747 halves the batch and retries only when the message
  // mentions `truncated` or `max_tokens`. The wording is load-bearing.
  it('names max_tokens so the ingest path routes the throw', () => {
    expect(() => assertNotReasoningOnly(INLINE_PLAN, 'stop', undefined)).toThrow(/max_tokens/);
  });

  it('names the setting that turns thinking off', () => {
    expect(() => assertNotReasoningOnly(INLINE_PLAN, 'stop', undefined))
      .toThrow(/Disable thinking/);
  });

  it('matches the <thinking> spelling, attributes, and a trailing newline', () => {
    expect(() => assertNotReasoningOnly('<thinking>plan</thinking>\n', 'stop', undefined))
      .toThrow();
    expect(() => assertNotReasoningOnly('<think role="assistant">plan</think>\n\n', 'stop', undefined))
      .toThrow();
  });

  // #473: LM Studio and DeepSeek route chain-of-thought into the visible
  // channel wrapped in the bare delimiter, with no XML tags at all.
  it('matches the bare Thinking/Response form', () => {
    expect(() => assertNotReasoningOnly('Thinking\nWeigh the chillers.\nResponse\n', 'stop', undefined))
      .toThrow();
  });

  it('does not fire when an answer follows the block', () => {
    expect(() => assertNotReasoningOnly(`${INLINE_PLAN}\n\n## Answer\n\nUse two loops.`, 'stop', undefined))
      .not.toThrow();
  });

  // Recorded decision on #791: an UNCLOSED block is left in the visible text.
  // The extractor refuses to strip it, because it cannot tell a truncated
  // think from an answer that merely opens with the tag. Throwing here would
  // reject the second one.
  it('does not fire on an unclosed block, which the extractor leaves alone', () => {
    expect(() => assertNotReasoningOnly('<think>plan with no close', 'stop', undefined))
      .not.toThrow();
  });

  // The guard must stay quiet when the plugin itself turned the reasoning
  // channel into the answer. `rescued` states that, so the text shape no
  // longer has to imply it and line order no longer decides.
  it('does not fire when the plugin rescued the answer from the reasoning channel', () => {
    expect(() => assertNotReasoningOnly(INLINE_PLAN, 'stop', undefined, true)).not.toThrow();
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
