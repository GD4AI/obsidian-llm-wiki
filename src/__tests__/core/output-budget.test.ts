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

  it('declares the whole ceiling, whatever the batch needs', () => {
    // The #904 regression: 20 items x 400 = 8,000 needed, 16,000 declared,
    // 16,000 spent on reasoning, nothing left for the answer.
    expect(computeExtractionBudget({ taskNeed: 20 * 400, ceiling })).toBe(ceiling);
    // 50 items would ask for 20,000 on the old scaling rule.
    expect(computeExtractionBudget({ taskNeed: 50 * 400, ceiling })).toBe(ceiling);
  });

  it('stays at the ceiling when the user asked for silence (#912)', () => {
    // Asking for silence is not evidence of silence. Claude Opus 5.5 refuses
    // `thinking: disabled` and reasons anyway; a narrow budget then starves
    // the answer and the batch comes back empty. The request still carries the
    // lowest level the SDK offers, so a model that does obey spends nothing —
    // `max_tokens` is a cap, not a reservation.
    expect(computeExtractionBudget({ taskNeed: 20 * 400, ceiling })).toBe(ceiling);
    expect(computeExtractionBudget({ taskNeed: 40_000, ceiling })).toBe(ceiling);
  });

  it('never declares more than the ceiling', () => {
    // A 4K-output model: exceeding its limit is a guaranteed 400.
    expect(computeExtractionBudget({ taskNeed: 8_000, ceiling: 4_096 })).toBe(4_096);
  });

  it('honours a user-chosen ceiling below the default', () => {
    expect(computeExtractionBudget({ taskNeed: 8_000, ceiling: 32_768 })).toBe(32_768);
  });
});

