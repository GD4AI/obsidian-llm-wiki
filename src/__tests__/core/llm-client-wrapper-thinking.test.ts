// Issue #904: the level setting and the toggle must reach the request.
//
// The first version of this change read `settings.thinkingEffort` inside the
// wrapper and never passed it in from `createLLMClient`. The type check passed
// — both sides are optional — so the control would have shipped as a dropdown
// that changes nothing. Tracing the value from the settings object to the
// request is what caught it, and this test is the trace.

import { describe, it, expect } from 'vitest';
import { wrapWithAdvancedSettings } from '../../llm-client-wrapper';
import type { LLMClient } from '../../types';

/** Client that records the params the wrapper hands it. */
function capturingClient(): { client: LLMClient; calls: Array<Record<string, unknown>> } {
  const calls: Array<Record<string, unknown>> = [];
  const client = {
    createMessage: async (params: Record<string, unknown>) => {
      calls.push(params);
      return 'ok';
    },
  } as unknown as LLMClient;
  return { client, calls };
}

const BASE = {
  model: 'test-model',
  max_tokens: 1000,
  messages: [{ role: 'user' as const, content: 'hi' }],
  task: 'extract',
};

describe('wrapWithAdvancedSettings — thinking level', () => {
  it('sends the configured level as a named effort', async () => {
    const { client, calls } = capturingClient();
    const wrapped = wrapWithAdvancedSettings(client, {
      maxTokensPerCall: 0,
      thinkingEffort: 'high',
    });

    await wrapped.createMessage(BASE);
    expect(calls[0].reasoningEffort).toBe('high');
    expect(calls[0].enableThinking).toBe(true);
  });

  it('sends nothing when the level is the default', async () => {
    const { client, calls } = capturingClient();
    const wrapped = wrapWithAdvancedSettings(client, {
      maxTokensPerCall: 0,
      thinkingEffort: 'default',
    });

    await wrapped.createMessage(BASE);
    expect(calls[0].reasoningEffort).toBeUndefined();
    expect(calls[0].enableThinking).toBeUndefined();
  });

  it('lets the off toggle outrank the level', async () => {
    const { client, calls } = capturingClient();
    const wrapped = wrapWithAdvancedSettings(client, {
      maxTokensPerCall: 0,
      thinkingEffort: 'high',
      disableThinking: true,
    });

    await wrapped.createMessage(BASE);
    expect(calls[0].enableThinking).toBe(false);
    expect(calls[0].reasoningEffort).toBeUndefined();
  });

  it('lets a per-task policy outrank both', async () => {
    const { client, calls } = capturingClient();
    const wrapped = wrapWithAdvancedSettings(client, {
      maxTokensPerCall: 0,
      thinkingEffort: 'high',
      disableThinking: true,
      taskPolicies: { extract: { outputMode: 'default', thinking: 'low' } },
    });

    await wrapped.createMessage(BASE);
    expect(calls[0].reasoningEffort).toBe('low');
    expect(calls[0].enableThinking).toBe(true);
  });

  it('reaches the stream path too, which carries the same two fields', async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client = {
      createMessageStream: async (params: Record<string, unknown>) => {
        calls.push(params);
        return 'ok';
      },
    } as unknown as LLMClient;
    const wrapped = wrapWithAdvancedSettings(client, {
      maxTokensPerCall: 0,
      thinkingEffort: 'medium',
    });

    await wrapped.createMessageStream!({
      model: 'test-model',
      max_tokens: 1000,
      messages: [{ role: 'user' as const, content: 'hi' }],
      onChunk: () => {},
      task: 'query-wiki',
    });
    expect(calls[0].enableThinking).toBe(true);
  });
});
