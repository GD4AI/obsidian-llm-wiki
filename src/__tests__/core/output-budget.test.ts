// Issue #904: the output budget rule and the ceiling it is built on.
//
// The numbers here are the ones the bug report was about. The 12,647-char
// clipping on MiniMax-M3.1-Flash declared 16,000 output tokens, the model
// spent all 16,000 on reasoning, and the batch returned empty. A test that
// only checked "max_tokens is bigger than 16,000" would pass while the rule
// stayed a guess, so each assertion below names the branch it pins.

import { describe, it, expect } from 'vitest';
import {
  resolveOutputCeiling,
  computeExtractionBudget,
  isReasoningPossible,
} from '../../core/output-budget';
import {
  DEFAULT_MODEL_OUTPUT_TOKENS,
  MAX_TOKENS_BATCH,
} from '../../constants';

describe('resolveOutputCeiling', () => {
  it('defaults to the wide current-generation limit when nothing is stored', () => {
    // A data.json written before this release has neither field.
    expect(resolveOutputCeiling({})).toBe(DEFAULT_MODEL_OUTPUT_TOKENS);
    expect(DEFAULT_MODEL_OUTPUT_TOKENS).toBe(128000);
  });

  it('treats 0 as Auto, not as "no output"', () => {
    // 0 is what the dropdown stores for Auto; capMaxTokens already reads it
    // as "no cap", so treating it as a literal ceiling would zero the budget.
    expect(resolveOutputCeiling({ maxTokensPerCall: 0 })).toBe(DEFAULT_MODEL_OUTPUT_TOKENS);
    expect(resolveOutputCeiling({ contextWindow: 0 })).toBe(DEFAULT_MODEL_OUTPUT_TOKENS);
  });

  it('honours an explicit user choice over the default', () => {
    expect(resolveOutputCeiling({ maxTokensPerCall: 32768 })).toBe(32768);
  });

  it('never exceeds the declared context window', () => {
    // A request cannot emit more tokens than the window holds, whatever the
    // output dropdown says.
    expect(resolveOutputCeiling({ maxTokensPerCall: 128000, contextWindow: 8192 })).toBe(8192);
    // The window alone also bounds the Auto default.
    expect(resolveOutputCeiling({ contextWindow: 65536 })).toBe(65536);
  });

  it('takes the smaller of the two when both are below the default', () => {
    expect(resolveOutputCeiling({ maxTokensPerCall: 32768, contextWindow: 16384 })).toBe(16384);
    expect(resolveOutputCeiling({ maxTokensPerCall: 16384, contextWindow: 65536 })).toBe(16384);
  });
});

describe('computeExtractionBudget', () => {
  const ceiling = DEFAULT_MODEL_OUTPUT_TOKENS;

  it('declares the whole ceiling while reasoning is possible', () => {
    // The #904 regression: 20 items x 400 = 8,000 needed, 16,000 declared,
    // 16,000 spent on reasoning, nothing left for the answer.
    expect(computeExtractionBudget({
      taskNeed: 20 * 400,
      ceiling,
      reasoningPossible: true,
    })).toBe(ceiling);
  });

  it('does not scale the declared ceiling with batch size', () => {
    // 50 items would ask for 20,000 on the old rule. Declaring 20,000 against
    // a thinking model reproduces the bug at a larger number.
    expect(computeExtractionBudget({
      taskNeed: 50 * 400,
      ceiling,
      reasoningPossible: true,
    })).toBe(ceiling);
  });

  it('narrows to the answer need once thinking is off', () => {
    expect(computeExtractionBudget({
      taskNeed: 20 * 400,
      ceiling,
      reasoningPossible: false,
    })).toBe(MAX_TOKENS_BATCH);
  });

  it('keeps a large answer need when thinking is off', () => {
    expect(computeExtractionBudget({
      taskNeed: 40_000,
      ceiling,
      reasoningPossible: false,
    })).toBe(40_000);
  });

  it('never declares more than the ceiling in either branch', () => {
    // A 4K-output model: exceeding its limit is a guaranteed 400, and the
    // floor must not push the request over it.
    expect(computeExtractionBudget({
      taskNeed: 8_000,
      ceiling: 4_096,
      reasoningPossible: true,
    })).toBe(4_096);
    expect(computeExtractionBudget({
      taskNeed: 8_000,
      ceiling: 4_096,
      reasoningPossible: false,
    })).toBe(4_096);
  });

  it('honours a user-chosen ceiling below the default', () => {
    expect(computeExtractionBudget({
      taskNeed: 8_000,
      ceiling: 32_768,
      reasoningPossible: true,
    })).toBe(32_768);
  });
});

// The budget and the wire must agree on whether reasoning may happen. If this
// said "off" while the request still permitted thinking, the wide ceiling
// would be withheld from a model about to think — #904 all over again.
describe('isReasoningPossible', () => {
  it('is true by default, which is the state every existing install is in', () => {
    expect(isReasoningPossible({}, 'extract')).toBe(true);
  });

  it('is false when the global toggle asks for silence', () => {
    expect(isReasoningPossible({ disableThinking: true }, 'extract')).toBe(false);
  });

  it('is true for every named global level', () => {
    for (const thinkingEffort of ['default', 'low', 'medium', 'high'] as const) {
      expect(isReasoningPossible({ thinkingEffort }, 'extract')).toBe(true);
    }
  });

  it('lets a per-task policy override the global toggle', () => {
    // `extract=text` with no thinking suffix resolves to the built-in
    // baseline, whose thinking is 'default' — the toggle then decides.
    const on = { taskPolicies: { extract: { outputMode: 'text_prompt' as const, thinking: 'low' as const } } };
    expect(isReasoningPossible({ ...on, disableThinking: true }, 'extract')).toBe(true);

    const off = { taskPolicies: { extract: { outputMode: 'text_prompt' as const, thinking: 'off' as const } } };
    expect(isReasoningPossible(off, 'extract')).toBe(false);
  });
});
