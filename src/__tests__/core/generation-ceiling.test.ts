import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  callWithCeilingFallback,
  resolveGenerationCeiling,
  type GenerationCeilingInput,
} from '../../core/generation-ceiling';
import { outputCeilingCache } from '../../core/output-ceiling-cache';
import { TOKENS_GENERATION_FLOOR, TOKENS_PAGE_GENERATION } from '../../constants';

/**
 * The generation ceiling is resolved, not declared (#1019).
 *
 * The five layers exist because the answer differs by provider and by user, and
 * a constant can serve only one of them. Each test below names the layer it
 * pins, and `callWithCeilingFallback` is tested for the two ways it can be
 * wrong: halving something that is not a ceiling, and giving up before reaching
 * a value the provider accepts.
 */

function input(over: Partial<GenerationCeilingInput> = {}): GenerationCeilingInput {
  return {
    provider: 'openai-compat',
    baseUrl: 'http://127.0.0.1:8000/v1',
    modelRef: 'local-model',
    inputTokens: 2_000,
    ...over,
  };
}

beforeEach(() => {
  outputCeilingCache.invalidate();
});

describe('resolveGenerationCeiling', () => {
  it('uses the family default for a provider whose limit cannot be read', () => {
    expect(resolveGenerationCeiling(input())).toBe(TOKENS_PAGE_GENERATION);
  });

  it('lets the user lower the default', () => {
    expect(resolveGenerationCeiling(input({ maxTokensPerCall: 4_000 }))).toBe(4_000);
  });

  it('lets the user raise it, which the old cap-only path could not do', () => {
    expect(resolveGenerationCeiling(input({ maxTokensPerCall: 64_000 }))).toBe(64_000);
  });

  it('omits the ceiling for anthropic, where the SDK resolves the model limit', () => {
    expect(resolveGenerationCeiling(input({ provider: 'anthropic' }))).toBeUndefined();
  });

  it('omits the ceiling for openai, which treats an absent cap as the model limit', () => {
    expect(resolveGenerationCeiling(input({ provider: 'openai' }))).toBeUndefined();
  });

  it('prefers a ceiling the provider already accepted over the default', () => {
    outputCeilingCache.set('http://127.0.0.1:8000/v1', 'local-model', 8_000);
    expect(resolveGenerationCeiling(input())).toBe(8_000);
  });

  it('keeps a learned value below the batch floor instead of raising it', () => {
    // startCeilingFor floors at MAX_TOKENS_BATCH (16,000) for extraction, which
    // would undo the learning here and re-send a value this model rejected.
    outputCeilingCache.set('http://127.0.0.1:8000/v1', 'local-model', 4_000);
    expect(resolveGenerationCeiling(input())).toBe(4_000);
  });

  it('does not let a learned value raise what the user asked for', () => {
    outputCeilingCache.set('http://127.0.0.1:8000/v1', 'local-model', 64_000);
    expect(resolveGenerationCeiling(input({ maxTokensPerCall: 4_000 }))).toBe(4_000);
  });

  it('bounds by the declared window minus the prompt', () => {
    expect(resolveGenerationCeiling(input({ contextWindow: 8_192 }))).toBe(6_192);
  });

  it('bounds an omitted ceiling too, so a declared window is never ignored', () => {
    expect(resolveGenerationCeiling(input({ provider: 'anthropic', contextWindow: 8_192 })))
      .toBe(6_192);
  });

  it('leaves a window-bound value alone when it is already smaller', () => {
    expect(resolveGenerationCeiling(input({ contextWindow: 200_000 }))).toBe(TOKENS_PAGE_GENERATION);
  });

  it('never returns a value so small that the answer cannot fit', () => {
    // A 2,100 window with a 2,000-token prompt leaves 100. Declaring 100 would
    // produce a silently truncated page; the floor makes the provider reject the
    // request instead, which the user can see.
    expect(resolveGenerationCeiling(input({ contextWindow: 2_100 }))).toBe(TOKENS_GENERATION_FLOOR);
  });
});

describe('callWithCeilingFallback', () => {
  it('passes the resolved ceiling to the attempt', async () => {
    const attempt = vi.fn(async () => 'ok');
    await callWithCeilingFallback(input({ maxTokensPerCall: 5_000 }), attempt);
    expect(attempt).toHaveBeenCalledWith(5_000);
  });

  it('halves after a rejection, retries, and remembers the value that worked', async () => {
    const seen: number[] = [];
    const attempt = vi.fn(async (maxTokens: number | undefined) => {
      seen.push(maxTokens as number);
      if (seen.length === 1) throw new Error('max_tokens: 32000 exceeds the model limit of 8192');
      return 'ok';
    });

    await expect(callWithCeilingFallback(input(), attempt)).resolves.toBe('ok');
    expect(seen).toEqual([32_000, 16_000]);
    expect(outputCeilingCache.get('http://127.0.0.1:8000/v1', 'local-model')).toBe(16_000);
  });

  it('reaches the floor and rethrows the provider error when halving runs out', async () => {
    let calls = 0;
    const attempt = vi.fn(async () => {
      calls += 1;
      throw new Error('max_tokens: 32000 exceeds the model limit');
    });

    await expect(callWithCeilingFallback(input(), attempt)).rejects.toThrow(/exceeds the model limit/);
    // 32,000 → 16,000 → 8,000, then the two-probe budget stops the loop.
    expect(calls).toBe(3);
  });

  it('does not halve a reasoning-only failure, which halving would make worse', async () => {
    const attempt = vi.fn(async () => {
      throw new Error('The model returned empty content after spending 7999 of 8000 output '
        + 'tokens on reasoning. Disable thinking for this model, or raise the token limit '
        + '(max_tokens) so the answer fits after it.');
    });

    await expect(callWithCeilingFallback(input(), attempt)).rejects.toThrow(/on reasoning/);
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('makes one attempt when nothing was declared', async () => {
    const attempt = vi.fn(async () => {
      throw new Error('max_tokens: 128000 exceeds the model limit');
    });

    await expect(callWithCeilingFallback(input({ provider: 'anthropic' }), attempt)).rejects.toThrow();
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(attempt).toHaveBeenCalledWith(undefined);
  });

  it('starts the next call from what this one learned', async () => {
    const first = vi.fn(async (maxTokens: number | undefined) => {
      if (maxTokens === 32_000) throw new Error('max_tokens: 32000 is too large');
      return 'ok';
    });
    await callWithCeilingFallback(input(), first);

    const second = vi.fn(async () => 'ok');
    await callWithCeilingFallback(input(), second);
    expect(second).toHaveBeenCalledWith(16_000);
  });
});
