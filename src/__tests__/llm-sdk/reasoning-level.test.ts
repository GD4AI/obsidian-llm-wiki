// Issue #904: our four levels translated into the AI SDK's own.
//
// The point of this module is that it contains no provider names and no
// per-model table — the SDK owns those, and it owns them better than we did
// (it downgrades an unsupported level with a warning instead of sending a
// request that 400s). So the tests below pin the translation and the silence,
// nothing vendor-specific.

import { describe, it, expect } from 'vitest';
import { resolveSdkReasoning } from '../../llm-sdk/reasoning-level';

describe('resolveSdkReasoning', () => {
  it('returns undefined when nothing was asked', () => {
    // Byte-identical to the pre-#904 request: no reasoning field at all.
    expect(resolveSdkReasoning({})).toBeUndefined();
  });

  it('translates the three named levels one to one', () => {
    expect(resolveSdkReasoning({ enableThinking: true, reasoningEffort: 'low' })).toBe('low');
    expect(resolveSdkReasoning({ enableThinking: true, reasoningEffort: 'medium' })).toBe('medium');
    expect(resolveSdkReasoning({ enableThinking: true, reasoningEffort: 'high' })).toBe('high');
  });

  it('maps the off toggle to none', () => {
    expect(resolveSdkReasoning({ enableThinking: false })).toBe('none');
  });

  it('maps "thinking allowed, no level chosen" to the provider default', () => {
    // 'provider-default' is the SDK's "send no field" value, which is what a
    // bare enableThinking:true has always meant.
    expect(resolveSdkReasoning({ enableThinking: true })).toBe('provider-default');
  });

  it('reads the global level so the setting reaches the wire unchanged', () => {
    expect(resolveSdkReasoning({ thinkingEffort: 'high' })).toBe('high');
    expect(resolveSdkReasoning({ thinkingEffort: 'low' })).toBe('low');
  });

  it('treats the global default as "ask for nothing"', () => {
    expect(resolveSdkReasoning({ thinkingEffort: 'default' })).toBeUndefined();
    expect(resolveSdkReasoning({ thinkingEffort: 'default', enableThinking: false })).toBe('none');
  });

  it('lets a per-task level outrank the global level', () => {
    // The per-step policy is the more specific statement and must win.
    expect(resolveSdkReasoning({ reasoningEffort: 'high', thinkingEffort: 'low' })).toBe('high');
  });

  it('lets a named level outrank the off toggle', () => {
    // A level is only ever produced alongside enableThinking:true by the
    // policy layer, so this pairing means "the policy named a level".
    expect(resolveSdkReasoning({ enableThinking: false, reasoningEffort: 'medium' })).toBe('medium');
  });
});
