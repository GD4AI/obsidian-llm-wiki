import { describe, it, expect } from 'vitest';
import { buildSamplingArgs } from '../../llm-sdk/sampling-args';

describe('buildSamplingArgs', () => {
  it('omits every field when input is empty', () => {
    expect(buildSamplingArgs({})).toEqual({});
  });

  it('passes temperature when present', () => {
    expect(buildSamplingArgs({ temperature: 0.7 })).toEqual({ temperature: 0.7 });
  });

  it('passes top_p via the topP key (AI-SDK mapping)', () => {
    expect(buildSamplingArgs({ top_p: 0.8 })).toEqual({ topP: 0.8 });
  });

  it('passes seed by default', () => {
    expect(buildSamplingArgs({ seed: 42 })).toEqual({ seed: 42 });
  });

  it('drops seed when withSeed=false (Anthropic)', () => {
    expect(
      buildSamplingArgs({ temperature: 0.5, top_p: 0.9, seed: 42 }, { withSeed: false }),
    ).toEqual({ temperature: 0.5, topP: 0.9 });
  });

  it('passes all three when withSeed=true and all present', () => {
    expect(
      buildSamplingArgs({ temperature: 0.5, top_p: 0.9, seed: 42 }, { withSeed: true }),
    ).toEqual({ temperature: 0.5, topP: 0.9, seed: 42 });
  });

  it('treats 0 as a real value (not as falsy-drop)', () => {
    // Bug shape: `if (seed) { out.seed = seed; }` would drop a legitimate 0
    // (rare but legal: deterministic seed = 0). Helper must use `!== undefined`.
    expect(buildSamplingArgs({ temperature: 0, top_p: 0, seed: 0 })).toEqual({
      temperature: 0,
      topP: 0,
      seed: 0,
    });
  });

  it('does not emit undefined keys for absent fields', () => {
    // Wire-byte-identity check: the spread form `...buildSamplingArgs({})`
    // must not produce `{ temperature: undefined, topP: undefined, seed: undefined }`
    // because that would round-trip as a present-but-undefined field.
    const result = buildSamplingArgs({ temperature: 0.5 });
    expect(Object.keys(result)).toEqual(['temperature']);
  });
});

describe('abortSignal (#646)', () => {
  it('is emitted when given and absent otherwise', () => {
    const signal = new AbortController().signal;
    expect(buildSamplingArgs({ temperature: 0.1, abortSignal: signal })).toEqual({ temperature: 0.1, abortSignal: signal });
    expect(buildSamplingArgs({ temperature: 0.1 })).toEqual({ temperature: 0.1 });
  });
});
