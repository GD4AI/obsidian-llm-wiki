// v1.23.0 P1-7: Unit tests for AnthropicSdkClient.
//
// Strategy: mock `ai.generateText` / `ai.streamText` and
// `@ai-sdk/anthropic`'s createAnthropic to verify the client forwards
// the right params and unwraps the result correctly.
//
// Critical regression coverage:
//   - #141 (Anthropic prefill): AI-SDK handles the detection
//   - #147 (Anthropic system role): system stays at top-level, NOT in messages
//   - #143 (max_tokens): AI-SDK abstracts token-key field name per model

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APICallError } from 'ai';

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return {
    ...actual,
    generateText: vi.fn(),
    streamText: vi.fn(),
  };
});

vi.mock('../../core/obsidian-fetch-bridge', async () => {
  const actual = await vi.importActual<typeof import('../../core/obsidian-fetch-bridge')>('../../core/obsidian-fetch-bridge');
  return {
    ...actual,
    obsidianFetchBridge: vi.fn(actual.obsidianFetchBridge),
  };
});

vi.mock('@ai-sdk/anthropic', async () => {
  const actual = await vi.importActual<typeof import('@ai-sdk/anthropic')>('@ai-sdk/anthropic');
  return {
    ...actual,
    createAnthropic: vi.fn(actual.createAnthropic),
  };
});

import { generateText, streamText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { AnthropicSdkClient } from '../../llm-sdk/anthropic-sdk-client';

const mockGenerateText = vi.mocked(generateText);
const mockStreamText = vi.mocked(streamText);
const mockCreateAnthropic = vi.mocked(createAnthropic);

function makeGenerateTextResult(text: string): Awaited<ReturnType<typeof generateText>> {
  return {
    text,
    content: [],
    reasoning: [],
    reasoningText: undefined,
    finalStep: { reasoning: [], reasoningText: undefined },
    files: [],
    sources: [],
    toolCalls: [],
    toolResults: [],
    finishReason: 'stop',
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30, reasoningTokens: undefined, cachedInputTokens: undefined },
    warnings: [],
    request: {},
    response: { id: 'resp_test', timestamp: new Date(), modelId: 'claude-sonnet-4-5', headers: {}, body: {} },
    providerMetadata: undefined,
    experimental_providerMetadata: undefined,
  } as unknown as Awaited<ReturnType<typeof generateText>>;
}

describe('AnthropicSdkClient', () => {
  beforeEach(() => {
    mockGenerateText.mockReset();
    mockGenerateText.mockResolvedValue(makeGenerateTextResult('hello from claude'));
  });

  describe('createMessage happy path', () => {
    it('returns text from generateText result', async () => {
      const client = new AnthropicSdkClient({ apiKey: 'sk-ant-test' });
      const text = await client.createMessage({
        model: 'claude-sonnet-4-5',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
      });
      expect(text).toBe('hello from claude');
    });

    it('forwards model + max_tokens', async () => {
      const client = new AnthropicSdkClient({ apiKey: 'sk-ant-test' });
      await client.createMessage({
        model: 'claude-sonnet-4-5',
        max_tokens: 200,
        messages: [{ role: 'user', content: 'hi' }],
      });

      const call = mockGenerateText.mock.calls[0][0] as Record<string, unknown>;
      expect(call.model).toBeDefined();
      expect(call.maxOutputTokens).toBe(200);
    });
  });

  describe('system role convention (Issue #147 regression test)', () => {
    // #147 fix: all 4 Anthropic retry paths keep system as top-level
    // field, NOT in messages array. AI-SDK preserves this invariant
    // — verify the call shape forwards system at top-level.
    it('keeps system at top-level when provided (NOT in messages[0])', async () => {
      const client = new AnthropicSdkClient({ apiKey: 'sk-ant-test' });
      await client.createMessage({
        model: 'claude-sonnet-4-5',
        max_tokens: 100,
        system: 'You are Claude, a helpful assistant.',
        messages: [{ role: 'user', content: 'hi' }],
      });

      const call = mockGenerateText.mock.calls[0][0] as Record<string, unknown>;
      expect(call.system).toBe('You are Claude, a helpful assistant.');
      // Messages must NOT contain a synthetic system role entry.
      const messages = call.messages as Array<{ role: string }>;
      for (const m of messages) {
        expect(m.role).not.toBe('system');
      }
    });

    it('omits system when not provided', async () => {
      const client = new AnthropicSdkClient({ apiKey: 'sk-ant-test' });
      await client.createMessage({
        model: 'claude-sonnet-4-5',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
      });

      const call = mockGenerateText.mock.calls[0][0] as Record<string, unknown>;
      expect('system' in call ? call.system : undefined).toBeUndefined();
    });
  });

  describe('enableThinking behavior', () => {
    it('does NOT send thinking field when enableThinking is undefined', async () => {
      const client = new AnthropicSdkClient({ apiKey: 'sk-ant-test' });
      await client.createMessage({
        model: 'claude-sonnet-4-5',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
      });

      const call = mockGenerateText.mock.calls[0][0] as Record<string, unknown>;
      expect(call.providerOptions).toEqual({});
    });

    it('sends thinking: {type:"disabled"} when enableThinking is false (Anthropic)', async () => {
      const client = new AnthropicSdkClient({ apiKey: 'sk-ant-test' });
      await client.createMessage({
        model: 'claude-sonnet-4-5',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
        enableThinking: false,
      });

      const call = mockGenerateText.mock.calls[0][0] as Record<string, unknown>;
      expect(call.providerOptions).toEqual({
        anthropic: { thinking: { type: 'disabled' } },
      });
    });
  });

  // Issue #414: Anthropic's Messages API has no `repetition_penalty`
  // (only temperature / top_p / top_k). Sending it pollutes the wire with
  // an unknown field — even though the AI SDK doesn't strip it (it's not
  // in the @ai-sdk/anthropic zod schema), Claude will silently ignore it.
  // Pre-fix, our `buildProviderOptions` placed it under
  // `anthropicOpts.repetitionPenalty`, which became `providerOptions.anthropic.repetitionPenalty`
  // on the call. Post-fix, the field is dropped entirely — matching the
  // 10-locale i18n text ("cloud providers will silently ignore it", but
  // for us the cleaner outcome is to drop rather than send-and-ignore).
  describe('Issue #414: repetitionPenalty is dropped (Anthropic does not accept it)', () => {
    it('omits repetition_penalty from providerOptions when repetitionPenalty is set', async () => {
      const client = new AnthropicSdkClient({ apiKey: 'sk-ant-test' });
      await client.createMessage({
        model: 'claude-sonnet-4-5',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
        repetition_penalty: 1.5,
      });

      const call = mockGenerateText.mock.calls[0][0] as Record<string, unknown>;
      // The whole providerOptions map must be empty (or at minimum must
      // not contain `repetitionPenalty` / `repetition_penalty`).
      const providerOptions = (call.providerOptions ?? {}) as Record<string, Record<string, unknown>>;
      const anthropicOpts = providerOptions.anthropic ?? {};
      expect(anthropicOpts).not.toHaveProperty('repetitionPenalty');
      expect(anthropicOpts).not.toHaveProperty('repetition_penalty');
    });

    it('omits repetition_penalty from stream providerOptions when repetitionPenalty is set', async () => {
      // Inline stream mock (the shared `makeStreamResult` helper is
      // scoped to the 'error mapping' describe block; this Issue #414
      // describe is a sibling and can't see it).
      mockStreamText.mockReturnValue({
        textStream: (async function* () { yield 'hi'; })(),
        fullStream: (async function* () { yield { type: 'text-delta', textDelta: 'hi' } as never; })(),
        text: 'hi',
        usage: Promise.resolve({ inputTokens: 1, outputTokens: 1, totalTokens: 2 }),
        finishReason: Promise.resolve('stop'),
        response: Promise.resolve({
          id: 'resp_test',
          timestamp: new Date(),
          modelId: 'claude-sonnet-4-5',
          headers: {},
          body: {},
        } as never),
      } as unknown as Awaited<ReturnType<typeof streamText>>);

      const client = new AnthropicSdkClient({ apiKey: 'sk-ant-test' });
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      await client.createMessageStream!({
        model: 'claude-sonnet-4-5',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
        onChunk: () => undefined,
        repetition_penalty: 1.5,
      });

      const call = mockStreamText.mock.calls[0][0] as Record<string, unknown>;
      const providerOptions = (call.providerOptions ?? {}) as Record<string, Record<string, unknown>>;
      const anthropicOpts = providerOptions.anthropic ?? {};
      expect(anthropicOpts).not.toHaveProperty('repetitionPenalty');
      expect(anthropicOpts).not.toHaveProperty('repetition_penalty');
    });
  });

  // Issue #449: cacheBreakpoint is a typed field (src/types.ts:684
  // `cacheBreakpoint?: number`) on LLMClient.createMessage and SET by
  // source-analyzer.ts:404 (`cacheBreakpoint: staticPrefix.length`).
  // The Anthropic SDK client must read it and emit
  // providerOptions.anthropic.cacheControl on the system block so the
  // user's opt-in (per-note caching) reaches the wire.
  //
  // Anthropic-side wire shape: providerOptions.anthropic.cacheControl
  // sits on a SYSTEM text block, not at top-level. The AI SDK's
  // streamText/generateText accept `system` as either a string or
  // an array of content parts; to emit cache_control we must switch
  // the system shape to a single text part carrying the cacheControl
  // providerOptions. Absent cacheBreakpoint → keep the existing
  // string-only path (no behaviour change for callers that don't opt in).
  describe('Issue #449 v1.26.4 PATCH follow-up: cacheBreakpoint → cache_control on FIRST USER MESSAGE TEXT PART', () => {
    type TextPart = { type: 'text'; text: string; providerOptions?: { anthropic?: { cacheControl?: unknown } } };
    type AnthropicMessage = { role: string; content: string | TextPart[] };
    function asMessages(call: Record<string, unknown>): AnthropicMessage[] {
      return call.messages as never;
    }

    it('splits the first user message text content at cacheBreakpoint and attaches cacheControl to the prefix part', async () => {
      const client = new AnthropicSdkClient({ apiKey: 'sk-ant-test' });
      const longContent = 'A'.repeat(42) + 'B'.repeat(20);
      await client.createMessage({
        model: 'claude-sonnet-4-5',
        max_tokens: 100,
        system: 'You are Claude, a helpful assistant.',
        messages: [{ role: 'user', content: longContent }],
        cacheBreakpoint: 42,
      });

      const call = mockGenerateText.mock.calls[0][0] as Record<string, unknown>;
      // system is still a plain string — cache marker does NOT live on system
      expect(call.system).toBe('You are Claude, a helpful assistant.');
      const messages = asMessages(call);
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('user');
      // First user message content becomes a 2-element text-part array
      const parts = messages[0].content as TextPart[];
      expect(Array.isArray(parts)).toBe(true);
      expect(parts).toHaveLength(2);
      expect(parts[0].type).toBe('text');
      expect(parts[0].text).toBe('A'.repeat(42));
      expect(parts[0].providerOptions).toEqual({
        anthropic: { cacheControl: { type: 'ephemeral' } },
      });
      expect(parts[1].type).toBe('text');
      expect(parts[1].text).toBe('B'.repeat(20));
      expect(parts[1].providerOptions).toBeUndefined();
    });

    it('keeps system as plain string AND keeps messages[0].content as a string when cacheBreakpoint is undefined (no behaviour change)', async () => {
      const client = new AnthropicSdkClient({ apiKey: 'sk-ant-test' });
      await client.createMessage({
        model: 'claude-sonnet-4-5',
        max_tokens: 100,
        system: 'You are Claude, a helpful assistant.',
        messages: [{ role: 'user', content: 'hi' }],
      });

      const call = mockGenerateText.mock.calls[0][0] as Record<string, unknown>;
      expect(call.system).toBe('You are Claude, a helpful assistant.');
      const messages = asMessages(call);
      expect(messages[0].content).toBe('hi');
    });

    it('co-emits cache_control on the user-message prefix part alongside enableThinking=false (no key collision)', async () => {
      const client = new AnthropicSdkClient({ apiKey: 'sk-ant-test' });
      const longContent = 'A'.repeat(42) + 'B'.repeat(10);
      await client.createMessage({
        model: 'claude-sonnet-4-5',
        max_tokens: 100,
        system: 'You are Claude, a helpful assistant.',
        messages: [{ role: 'user', content: longContent }],
        cacheBreakpoint: 42,
        enableThinking: false,
      });

      const call = mockGenerateText.mock.calls[0][0] as Record<string, unknown>;
      const parts = (asMessages(call)[0].content as TextPart[]);
      expect(parts[0].providerOptions).toEqual({
        anthropic: { cacheControl: { type: 'ephemeral' } },
      });
      // Thinking control travels at the call.providerOptions level (existing
      // path); cache_control travels on the user-message text part. They MUST
      // NOT collide — both must be present at their canonical locations.
      expect(call.providerOptions).toEqual({
        anthropic: { thinking: { type: 'disabled' } },
      });
    });

    it('omits system entirely when cacheBreakpoint is defined and system is empty (no stray empty block consumes a cache breakpoint)', async () => {
      const client = new AnthropicSdkClient({ apiKey: 'sk-ant-test' });
      const longContent = 'A'.repeat(42) + 'B'.repeat(10);
      await client.createMessage({
        model: 'claude-sonnet-4-5',
        max_tokens: 100,
        system: '',
        messages: [{ role: 'user', content: longContent }],
        cacheBreakpoint: 42,
      });
      const call = mockGenerateText.mock.calls[0][0] as Record<string, unknown>;
      expect('system' in call).toBe(false);
      // And the user message IS still split (cacheBreakpoint defined)
      const parts = (asMessages(call)[0].content as TextPart[]);
      expect(parts).toHaveLength(2);
      expect(parts[0].providerOptions).toEqual({
        anthropic: { cacheControl: { type: 'ephemeral' } },
      });
    });

    it('omits system entirely when cacheBreakpoint is defined and system is undefined', async () => {
      const client = new AnthropicSdkClient({ apiKey: 'sk-ant-test' });
      const longContent = 'A'.repeat(42) + 'B'.repeat(10);
      await client.createMessage({
        model: 'claude-sonnet-4-5',
        max_tokens: 100,
        messages: [{ role: 'user', content: longContent }],
        cacheBreakpoint: 42,
      });
      const call = mockGenerateText.mock.calls[0][0] as Record<string, unknown>;
      expect('system' in call).toBe(false);
      const parts = (asMessages(call)[0].content as TextPart[]);
      expect(parts).toHaveLength(2);
    });

    it('omits system entirely when cacheBreakpoint is undefined and system is empty (Branch D pre-fix semantic)', async () => {
      // DocTpoint non-blocking finding (2026-08-15): when cacheBreakpoint is
      // undefined and system is '', the post-fix call site used
      // `systemWithCacheControl !== undefined` which still spreads
      // `system: ''` to the wire. Truthy-check at the call site eliminates
      // this latent regression — `system: ''` MUST NOT consume one of
      // Anthropic's 4 cache breakpoints on an empty text block.
      const client = new AnthropicSdkClient({ apiKey: 'sk-ant-test' });
      await client.createMessage({
        model: 'claude-sonnet-4-5',
        max_tokens: 100,
        system: '',
        messages: [{ role: 'user', content: 'hi' }],
        // cacheBreakpoint: undefined (omitted)
      });
      const call = mockGenerateText.mock.calls[0][0] as Record<string, unknown>;
      expect('system' in call).toBe(false);
      // No user-message split either (cacheBreakpoint undefined)
      expect(asMessages(call)[0].content).toBe('hi');
    });

    it('co-emits cache_control on a non-English source content (locale-stable contract — UTF-16 code-unit position, not bytes and not text-content)', async () => {
      const client = new AnthropicSdkClient({ apiKey: 'sk-ant-test' });
      const longContent = 'Ü'.repeat(42) + 'ß'.repeat(10); // German source content
      await client.createMessage({
        model: 'claude-sonnet-4-5',
        max_tokens: 100,
        system: 'Du bist Claude, ein hilfreicher Assistent.',
        messages: [{ role: 'user', content: longContent }],
        cacheBreakpoint: 42,
      });
      const call = mockGenerateText.mock.calls[0][0] as Record<string, unknown>;
      // system stays as a plain string (in German — proves locale-stable
      // contract: cache marker does NOT touch the system block)
      expect(call.system).toBe('Du bist Claude, ein hilfreicher Assistent.');
      // User message split: prefix carries cacheControl
      const parts = (asMessages(call)[0].content as TextPart[]);
      expect(parts[0].text).toBe('Ü'.repeat(42));
      expect(parts[0].providerOptions).toEqual({
        anthropic: { cacheControl: { type: 'ephemeral' } },
      });
      expect(parts[1].text).toBe('ß'.repeat(10));
    });
  });

  describe('custom baseURL for Anthropic-compatible providers (Coding Plan / z.ai / GLM-Antropic)', () => {
    beforeEach(() => {
      mockCreateAnthropic.mockClear();
    });

    it('passes baseURL to createAnthropic', async () => {
      const client = new AnthropicSdkClient({
        apiKey: 'sk-ant-test',
        baseURL: 'https://api.z.ai/v1',
      });
      await client.createMessage({
        model: 'claude-sonnet-4-5',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
      });

      // Verify the last createAnthropic call received baseURL.
      const callOpts = mockCreateAnthropic.mock.calls.at(-1)![0] as Record<string, unknown>;
      expect(callOpts.baseURL).toBe('https://api.z.ai/v1');
    });

    it('omits baseURL when not provided (uses Anthropic default)', async () => {
      const client = new AnthropicSdkClient({ apiKey: 'sk-ant-test' });
      await client.createMessage({
        model: 'claude-sonnet-4-5',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
      });

      const callOpts = mockCreateAnthropic.mock.calls.at(-1)![0] as Record<string, unknown>;
      expect(callOpts.baseURL).toBeUndefined();
    });

    // v1.23.0 Day 3.5: Coding Plan verify — multiple Anthropic-compatible
    // baseURLs (z.ai, GLM, DeepSeek) all accepted by createAnthropic and
    // forwarded unchanged. Code-level only; no real HTTP call.
    it.each([
      ['z.ai', 'https://api.z.ai/v1'],
      ['GLM-Anthropic', 'https://api.glm.ai/v1/anthropic'],
      ['DeepSeek Anthropic-compat', 'https://api.deepseek.com/anthropic'],
      ['MiniMax-Anthropic', 'https://api.MiniMax.chat/anthropic'],
      // OpenRouter's Anthropic skin is /api/v1/messages, and createAnthropic
      // appends only /messages — so /api/v1 is the baseURL a user must enter.
      // /api/v1/anthropic 404s; the docs' /api (for clients that add /v1
      // themselves) returns the HTML site page, not JSON.
      ['OpenRouter Anthropic', 'https://openrouter.ai/api/v1'],
    ])('forwards %s baseURL unchanged to createAnthropic', async (_name, baseURL) => {
      const client = new AnthropicSdkClient({ apiKey: 'sk-ant-test', baseURL });
      await client.createMessage({
        model: 'claude-sonnet-4-5',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
      });
      const callOpts = mockCreateAnthropic.mock.calls.at(-1)![0] as Record<string, unknown>;
      expect(callOpts.baseURL).toBe(baseURL);
      // createAnthropic should also receive the apiKey alongside baseURL.
      expect(callOpts.apiKey).toBe('sk-ant-test');
    });

    it('forwards the obsidian-fetch-bridge to createAnthropic (so baseURL hits the right host)', async () => {
      // The fetch impl is what determines WHICH URL is hit. If
      // createAnthropic is called without our bridge, the call would go to
      // a different fetch implementation that may not respect the user's
      // baseURL override. Verify the bridge is wired in.
      const client = new AnthropicSdkClient({
        apiKey: 'sk-ant-test',
        baseURL: 'https://api.z.ai/v1',
      });
      await client.createMessage({
        model: 'claude-sonnet-4-5',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
      });
      const callOpts = mockCreateAnthropic.mock.calls.at(-1)![0] as Record<string, unknown>;
      // The fetch field should be set (not undefined) — this is the
      // bridge that carries activeDocument and respects the baseURL.
      expect(callOpts.fetch).toBeDefined();
      expect(typeof callOpts.fetch).toBe('function');
    });
  });

  describe('error mapping', () => {
    it('enriches APICallError with provider body (Issue #141/#147 preservation)', async () => {
      const apiErr = new APICallError({
        message: 'Provider returned error',
        statusCode: 400,
        responseHeaders: {},
        url: 'https://api.anthropic.com/v1',
        requestBodyValues: {},
        responseBody: JSON.stringify({
          type: 'error',
          error: { type: 'invalid_request_error', message: 'messages: first message must be from user' },
        }),
      });
      mockGenerateText.mockReset();
      mockGenerateText.mockRejectedValue(apiErr);

      const client = new AnthropicSdkClient({ apiKey: 'sk-ant-test' });
      await expect(
        client.createMessage({
          model: 'claude-sonnet-4-5',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'hi' }],
        })
      ).rejects.toThrow(/status 400.*first message must be from user/);
    });
    function makeStreamResult(chunks: string[]) {
      return {
        textStream: (async function* () {
          for (const c of chunks) yield c;
        })(),
        fullStream: (async function* () {
          for (const c of chunks) yield { type: 'text-delta', textDelta: c } as never;
        })(),
        text: chunks.join(''),
        finalStep: Promise.resolve({ reasoning: [], reasoningText: undefined }),
        usage: Promise.resolve({ inputTokens: 10, outputTokens: 20, totalTokens: 30 }),
        finishReason: Promise.resolve('stop'),
        response: Promise.resolve({
          id: 'resp_test',
          timestamp: new Date(),
          modelId: 'claude-sonnet-4-5',
          headers: {},
          body: {},
        }),
      } as unknown as Awaited<ReturnType<typeof streamText>>;
    }

    beforeEach(() => {
      mockStreamText.mockReset();
    });

    it('calls onChunk with each text delta', async () => {
      mockStreamText.mockReturnValue(makeStreamResult(['hello', ' ', 'world']));

      const client = new AnthropicSdkClient({ apiKey: 'sk-ant-test' });
      const chunks: string[] = [];
      // LLMClient interface declares createMessageStream as optional (?),
      // but AnthropicSdkClient always implements it. The non-null
      // assertion here is the canonical pattern for testing optional
      // interface methods that we know are present on this class.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      const result = await client.createMessageStream!({
        model: 'claude-sonnet-4-5',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
        onChunk: (c: string) => chunks.push(c),
      });

      expect(chunks).toEqual(['hello', ' ', 'world']);
      expect(result).toBe('hello world');
    });

    it('keeps system at top-level during streaming (Issue #147 regression test)', async () => {
      mockStreamText.mockReturnValue(makeStreamResult(['hi']));

      const client = new AnthropicSdkClient({ apiKey: 'sk-ant-test' });
      // LLMClient declares createMessageStream as optional (?). The
      // non-null assertion is the canonical pattern when the
      // implementation is known to provide it.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      await client.createMessageStream!({
        model: 'claude-sonnet-4-5',
        max_tokens: 100,
        system: 'You are helpful.',
        messages: [{ role: 'user', content: 'hi' }],
        onChunk: () => {},
      });

      const call = mockStreamText.mock.calls[0][0] as Record<string, unknown>;
      expect(call.system).toBe('You are helpful.');
      const messages = call.messages as Array<{ role: string }>;
      for (const m of messages) {
        expect(m.role).not.toBe('system');
      }
    });
  });

  describe('listModels', () => {
    it('returns empty array (placeholder)', async () => {
      const client = new AnthropicSdkClient({ apiKey: 'sk-ant-test' });
      // LLMClient declares listModels as optional (?). Non-null assertion
      // is the canonical pattern when the implementation provides it.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      expect(await client.listModels!()).toEqual([]);
    });
  });
});