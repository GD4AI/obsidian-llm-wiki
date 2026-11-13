import { describe, expect, it } from 'vitest';
import {
  ceilingAfterRejection,
  namesOutputCeiling,
  namesReasoningOnly,
} from '../../core/output-ceiling-probe';
import { MAX_TOKENS_BATCH } from '../../constants';

/**
 * The probe decides whether a 400 taught us something.
 *
 * It is shared now (#1019): the extraction loop and the generation call sites
 * both halve a rejected ceiling, and they need opposite floors — 16,000 for a
 * batch, 4,000 for one page. The floor is a parameter because the two families
 * disagree about it, and because a generation start of 32,000 against the old
 * 16,000 floor would reject twice and then give up.
 */

const CEILING_400 = 'max_tokens: 32000 > 8192, which is the maximum allowed for this model';

describe('namesOutputCeiling', () => {
  it('recognises a rejection that names max_tokens', () => {
    expect(namesOutputCeiling(CEILING_400)).toBe(true);
  });

  it('recognises max_completion_tokens, which some gateways answer with', () => {
    expect(namesOutputCeiling('invalid max_completion_tokens: 32000')).toBe(true);
  });

  it('recognises the phrase without an underscore', () => {
    expect(namesOutputCeiling('max output tokens must be <= 4096')).toBe(true);
  });

  it('does not count a reasoning-only failure, whose own advice says max_tokens', () => {
    const reasoningOnly = 'The model returned empty content after spending 7999 of 8000 output '
      + 'tokens on reasoning. Disable thinking for this model, or raise the token limit '
      + '(max_tokens) so the answer fits after it.';
    expect(namesReasoningOnly(reasoningOnly)).toBe(true);
    expect(namesOutputCeiling(reasoningOnly)).toBe(false);
  });

  it('does not count a context-length complaint, which is about the input', () => {
    expect(namesOutputCeiling('This model\'s maximum context length is 8192 tokens')).toBe(false);
  });
});

describe('ceilingAfterRejection', () => {
  it('halves from a generation start, and stops at the generation floor', () => {
    expect(ceilingAfterRejection(32_000, 0, CEILING_400, 4_000)).toBe(16_000);
    expect(ceilingAfterRejection(16_000, 1, CEILING_400, 4_000)).toBe(8_000);
    expect(ceilingAfterRejection(8_000, 2, CEILING_400, 4_000)).toBeNull();
    expect(ceilingAfterRejection(4_000, 0, CEILING_400, 4_000)).toBeNull();
  });

  it('spends at most two probes', () => {
    expect(ceilingAfterRejection(32_000, 2, CEILING_400, 4_000)).toBeNull();
  });

  it('never returns a ceiling below the floor', () => {
    // 5,000 halves to 2,500, which is under the generation floor.
    expect(ceilingAfterRejection(5_000, 0, CEILING_400, 4_000)).toBe(4_000);
  });

  it('defaults to the extraction floor, which is what the batch loop needs', () => {
    expect(ceilingAfterRejection(32_000, 0, CEILING_400)).toBe(MAX_TOKENS_BATCH);
    expect(ceilingAfterRejection(MAX_TOKENS_BATCH, 0, CEILING_400)).toBeNull();
  });

  it('refuses a message that does not name the ceiling', () => {
    expect(ceilingAfterRejection(32_000, 0, 'This model\'s maximum context length is 8192', 4_000))
      .toBeNull();
  });

  it('refuses to halve a reasoning-only failure', () => {
    const reasoningOnly = 'The model returned empty content after spending 7999 of 8000 output '
      + 'tokens on reasoning. Disable thinking for this model, or raise the token limit '
      + '(max_tokens) so the answer fits after it.';
    expect(ceilingAfterRejection(32_000, 0, reasoningOnly, 4_000)).toBeNull();
  });
});
