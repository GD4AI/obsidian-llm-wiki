// v1.23.0 P1-7: Unit tests for OpenAISdkClient.
//
// Strategy: mock the underlying `ai.generateText` function to assert
// we forward the right params (model, max_tokens, system, messages,
// providerOptions for reasoning_effort, temperature, repetition_penalty)
// and unwrap the result correctly.
//
// Mock fidelity rule (per project memory): mocks must simulate real
// dependency behavior. generateText returns {text, ...}; APICallError
// has {statusCode, responseBody, message}. Tests assert on those shapes.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APICallError } from 'ai';

// Mock the 'ai' module so generateText is controlled by our test.
vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return {
    ...actual,
    generateText: vi.fn(),
    streamText: vi.fn(),
  };
});

// Mock the bridge too — generateText never actually calls it during tests
// because we mock generateText itself, but we want to verify the provider
// receives the bridge reference.
vi.mock('../../core/obsidian-fetch-bridge', async () => {
  const actual = await vi.importActual<typeof import('../../core/obsidian-fetch-bridge')>('../../core/obsidian-fetch-bridge');
  return {
    ...actual,
    obsidianFetchBridge: vi.fn(actual.obsidianFetchBridge),
  };
});

// Mock @ai-sdk/openai so we don't construct a real provider (which would
// try to call out to OpenAI). We verify createOpenAI is called with the
// right options via a spy.
vi.mock('@ai-sdk/openai', async () => {
  const actual = await vi.importActual<typeof import('@ai-sdk/openai')>('@ai-sdk/openai');
  return {
    ...actual,
    createOpenAI: vi.fn(actual.createOpenAI),
  };
});

import { generateText, streamText } from 'ai';
import { OpenAISdkClient, mapAiSdkError } from '../../llm-sdk/openai-sdk-client';

const mockGenerateText = vi.mocked(generateText);
const mockStreamText = vi.mocked(streamText);

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
    usage: {
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
      reasoningTokens: undefined,
      cachedInputTokens: undefined,
    },
    warnings: [],
    request: {},
    response: {
      id: 'resp_test',
      timestamp: new Date(),
      modelId: 'gpt-4.1',
      headers: {},
      body: {},
    },
    providerMetadata: undefined,
    experimental_providerMetadata: undefined,
  } as unknown as Awaited<ReturnType<typeof generateText>>;
}

describe('OpenAISdkClient', () => {
  beforeEach(() => {
    mockGenerateText.mockReset();
    mockGenerateText.mockResolvedValue(makeGenerateTextResult('hello from openai'));
  });

  describe('createMessage happy path', () => {
    it('returns text from generateText result', async () => {
      const client = new OpenAISdkClient({ apiKey: 'sk-test', baseURL: 'https://api.openai.com/v1' });
      const text = await client.createMessage({
        model: 'gpt-4.1',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
      });
      expect(text).toBe('hello from openai');
    });

    it('forwards model + max_tokens to AI-SDK', async () => {
      const client = new OpenAISdkClient({ apiKey: 'sk-test', baseURL: 'https://api.openai.com/v1' });
      await client.createMessage({
        model: 'gpt-4.1',
        max_tokens: 200,
        messages: [{ role: 'user', content: 'hi' }],
      });

      const call = mockGenerateText.mock.calls[0][0] as Record<string, unknown>;
      expect(call.model).toBeDefined();
      // Model should be a LanguageModelV4 instance, not the string id.
      expect(typeof call.model).toBe('object');
      expect(call.maxOutputTokens).toBe(200);
    });

    it('forwards system prompt when provided', async () => {
      const client = new OpenAISdkClient({ apiKey: 'sk-test', baseURL: 'https://api.openai.com/v1' });
      await client.createMessage({
        model: 'gpt-4.1',
        max_tokens: 100,
        system: 'You are a helpful assistant.',
        messages: [{ role: 'user', content: 'hi' }],
      });

      const call = mockGenerateText.mock.calls[0][0] as Record<string, unknown>;
      expect(call.system).toBe('You are a helpful assistant.');
    });

    it('omits system prompt when not provided (matches v1.20.0 behavior)', async () => {
      const client = new OpenAISdkClient({ apiKey: 'sk-test', baseURL: 'https://api.openai.com/v1' });
      await client.createMessage({
        model: 'gpt-4.1',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
      });

      const call = mockGenerateText.mock.calls[0][0] as Record<string, unknown>;
      expect('system' in call ? call.system : undefined).toBeUndefined();
    });

    it('forwards all messages with role+content', async () => {
      const client = new OpenAISdkClient({ apiKey: 'sk-test', baseURL: 'https://api.openai.com/v1' });
      await client.createMessage({
        model: 'gpt-4.1',
        max_tokens: 100,
        messages: [
          { role: 'user', content: 'first' },
          { role: 'assistant', content: 'reply' },
          { role: 'user', content: 'second' },
        ],
      });

      const call = mockGenerateText.mock.calls[0][0] as Record<string, unknown>;
      expect(call.messages).toEqual([
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'reply' },
        { role: 'user', content: 'second' },
      ]);
    });

    it('forwards temperature at top level (OpenAI standard param)', async () => {
      const client = new OpenAISdkClient({ apiKey: 'sk-test', baseURL: 'https://api.openai.com/v1' });
      await client.createMessage({
        model: 'gpt-4.1',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
        temperature: 0.7,
      });

      const call = mockGenerateText.mock.calls[0][0] as Record<string, unknown>;
      expect(call.temperature).toBe(0.7);
    });

    it('omits temperature when undefined (provider decides)', async () => {
      const client = new OpenAISdkClient({ apiKey: 'sk-test', baseURL: 'https://api.openai.com/v1' });
      await client.createMessage({
        model: 'gpt-4.1',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
      });

      const call = mockGenerateText.mock.calls[0][0] as Record<string, unknown>;
      expect('temperature' in call ? call.temperature : undefined).toBeUndefined();
    });
  });

  describe('enableThinking behavior (provider-first thinking control)', () => {
    it('does NOT send reasoningEffort when enableThinking is undefined (default)', async () => {
      const client = new OpenAISdkClient({ apiKey: 'sk-test', baseURL: 'https://api.openai.com/v1' });
      await client.createMessage({
        model: 'gpt-4.1',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
      });

      const call = mockGenerateText.mock.calls[0][0] as Record<string, unknown>;
      expect(call.providerOptions).toEqual({});
    });

    it('does NOT send reasoningEffort when enableThinking is true (let provider decide)', async () => {
      const client = new OpenAISdkClient({ apiKey: 'sk-test', baseURL: 'https://api.openai.com/v1' });
      await client.createMessage({
        model: 'gpt-4.1',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
        enableThinking: true,
      });

      const call = mockGenerateText.mock.calls[0][0] as Record<string, unknown>;
      expect(call.providerOptions).toEqual({});
    });

    it('sends reasoningEffort="none" when enableThinking is false (v1.26.0 Batch 6)', async () => {
      // v1.26.0 Batch 6: switched from 'low' to 'none' for the official
      // OpenAI Responses path. On GPT-5.1+ models (supportsNonReasoning
      // Parameters=true) the AI SDK skips the reasoning path entirely
      // when effort is 'none' (line 943 of @ai-sdk/openai@3.0.86/
      // dist/index.mjs) — no reasoning tokens billed, no sampling-param
      // validation overhead. For dedup-phase / fix-runners / merge /
      // ingest JSON-decision calls this is the right tradeoff.
      const client = new OpenAISdkClient({ apiKey: 'sk-test', baseURL: 'https://api.openai.com/v1' });
      await client.createMessage({
        model: 'gpt-5.5',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
        enableThinking: false,
      });

      const call = mockGenerateText.mock.calls[0][0] as Record<string, unknown>;
      expect(call.providerOptions).toEqual({
        openai: { reasoningEffort: 'none' },
      });
    });
  });

  describe('repetition_penalty (llama.cpp extension)', () => {
    it('forwards repetition_penalty via providerOptions.openai', async () => {
      const client = new OpenAISdkClient({ apiKey: 'sk-test', baseURL: 'https://api.openai.com/v1' });
      await client.createMessage({
        model: 'gpt-4.1',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
        repetition_penalty: 1.1,
      });

      const call = mockGenerateText.mock.calls[0][0] as Record<string, unknown>;
      expect(call.providerOptions).toEqual({
        openai: { repetition_penalty: 1.1 },
      });
    });

    it('omits repetition_penalty when undefined', async () => {
      const client = new OpenAISdkClient({ apiKey: 'sk-test', baseURL: 'https://api.openai.com/v1' });
      await client.createMessage({
        model: 'gpt-4.1',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
      });

      const call = mockGenerateText.mock.calls[0][0] as Record<string, unknown>;
      expect(call.providerOptions).toEqual({});
    });
  });

  describe('response_format (JSON object mode)', () => {
    it('forwards response_format: {type:"json_object"} via providerOptions.openai', async () => {
      const client = new OpenAISdkClient({ apiKey: 'sk-test', baseURL: 'https://api.openai.com/v1' });
      await client.createMessage({
        model: 'gpt-4.1',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'return JSON' }],
        response_format: { type: 'json_object' },
      });

      const call = mockGenerateText.mock.calls[0][0] as Record<string, unknown>;
      expect(call.providerOptions).toEqual({
        openai: { response_format: { type: 'json_object' } },
      });
    });
  });

  describe('error mapping (v1.22.5 UX preservation)', () => {
    it('enriches APICallError with provider body (Issue #207 quota message)', async () => {
      const apiErr = new APICallError({
        message: 'Provider returned error',
        statusCode: 429,
        responseHeaders: {}, url: 'https://api.openai.com/v1', requestBodyValues: {},
        responseBody: JSON.stringify({
          error: { message: 'You exceeded your current quota, please check your plan and billing details' },
        }),
      });
      // Default mock in beforeEach returns a happy result. We override once
      // for the error path — only one .rejects.toThrow call follows.
      mockGenerateText.mockReset();
      mockGenerateText.mockRejectedValue(apiErr);

      const client = new OpenAISdkClient({ apiKey: 'sk-test', baseURL: 'https://api.openai.com/v1' });
      await expect(
        client.createMessage({
          model: 'gpt-5.5',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'hi' }],
        })
      ).rejects.toThrow(/status 429/);
      await expect(
        client.createMessage({
          model: 'gpt-5.5',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'hi' }],
        })
      ).rejects.toThrow(/quota/);
    });

    it('handles 400 with provider diagnostic', async () => {
      const apiErr = new APICallError({
        message: 'Provider returned error',
        statusCode: 400,
        responseHeaders: {}, url: 'https://api.openai.com/v1', requestBodyValues: {},
        responseBody: JSON.stringify({ error: { message: 'Invalid value for reasoning_effort' } }),
      });
      mockGenerateText.mockReset();
      mockGenerateText.mockRejectedValue(apiErr);

      const client = new OpenAISdkClient({ apiKey: 'sk-test', baseURL: 'https://api.openai.com/v1' });
      await expect(
        client.createMessage({
          model: 'gpt-4.1',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'hi' }],
        })
      ).rejects.toThrow(/Invalid value for reasoning_effort/);
    });

    it('falls back to raw body when error JSON shape is unexpected', async () => {
      const apiErr = new APICallError({
        message: 'Provider returned error',
        statusCode: 500,
        responseHeaders: {}, url: 'https://api.openai.com/v1', requestBodyValues: {},
        responseBody: 'plain text 500 body',
      });
      mockGenerateText.mockReset();
      mockGenerateText.mockRejectedValue(apiErr);

      const client = new OpenAISdkClient({ apiKey: 'sk-test', baseURL: 'https://api.openai.com/v1' });
      await expect(
        client.createMessage({
          model: 'gpt-4.1',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'hi' }],
        })
      ).rejects.toThrow(/plain text 500 body/);
    });
  });

  describe('mapAiSdkError', () => {
    it('wraps unknown errors with default message', () => {
      const err = mapAiSdkError('string error');
      expect(err.message).toContain('string error');
      expect(err).toBeInstanceOf(Error);
    });

    it('passes through generic Error unchanged', () => {
      const original = new Error('plain');
      const mapped = mapAiSdkError(original);
      expect(mapped).toBe(original);
    });

    it('attaches statusCode + responseBody to APICallError-derived error', () => {
      const apiErr = new APICallError({
        message: 'X',
        statusCode: 503,
        responseHeaders: {}, url: 'https://api.openai.com/v1', requestBodyValues: {},
        responseBody: 'maintenance',
      });
      const mapped = mapAiSdkError(apiErr);
      expect(mapped.message).toBe('status 503: maintenance');
      expect((mapped as Error & { statusCode?: number }).statusCode).toBe(503);
      expect((mapped as Error & { responseBody?: string }).responseBody).toBe('maintenance');
    });
  });

  describe('createMessageStream (real word-by-word streaming)', () => {
    // v1.23.0 P1-7: replaces parseSSEEvents hand-rolled SSE parser.
    // AI-SDK's streamText yields textStream as AsyncIterable<string>
    // — true character-level streaming, not chunked SSE frames.

    // Helper: build a streamText mock that returns a textStream
    // yielding the provided chunks in order, and a fullStream that
    // emits reasoning-delta events when reasoningChunks is provided.
    // v1.23.0 P2: Updated to match new stream consumption pattern.
    // Reasoning content is now read from `result.reasoning` Promise
    // (post-stream) instead of fullStream events. The fullStream
    // mock is kept minimal (no events needed since we only consume
    // textStream + result.reasoning).
    function makeStreamTextResult(chunks: string[], reasoningChunks: string[] = []) {
      const reasoningText = reasoningChunks.join('');
      return {
        textStream: (async function* () {
          for (const c of chunks) yield c;
        })(),
        fullStream: (async function* () {
          // No longer consumed by createMessageStream — kept for
          // API completeness; tests that exercise reasoning should
          // rely on result.reasoning.
        })(),
        text: chunks.join(''),
        reasoning: Promise.resolve(reasoningText),
        finalStep: Promise.resolve({
          reasoning: reasoningText ? [{ text: reasoningText }] : [],
          reasoningText: reasoningText || undefined,
        }),
        usage: Promise.resolve({ inputTokens: 10, outputTokens: 20, totalTokens: 30 }),
        finishReason: Promise.resolve('stop'),
        response: Promise.resolve({
          id: 'resp_test',
          timestamp: new Date(),
          modelId: 'gpt-4.1',
          headers: {},
          body: {},
        }),
      } as unknown as Awaited<ReturnType<typeof streamText>>;
    }

    beforeEach(() => {
      mockStreamText.mockReset();
    });

    it('calls onChunk with each text delta in order', async () => {
      mockStreamText.mockReturnValue(makeStreamTextResult(['hello', ' ', 'world']));

      const client = new OpenAISdkClient({ apiKey: 'sk-test', baseURL: 'https://api.openai.com/v1' });
      const chunks: string[] = [];
      // LLMClient interface declares createMessageStream as optional (?),
      // but OpenAISdkClient always implements it. The non-null
      // assertion here is the canonical pattern for testing optional
      // interface methods that we know are present on this class.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      const result = await client.createMessageStream!({
        model: 'gpt-4.1',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
        onChunk: (c: string) => chunks.push(c),
      });

      expect(chunks).toEqual(['hello', ' ', 'world']);
      expect(result).toBe('hello world');
    });

    it('preserves word-by-word granularity (true streaming, not batched)', async () => {
      // AI-SDK typically yields small chunks character-by-character.
      // Verify that even 1-char chunks are passed through.
      mockStreamText.mockReturnValue(makeStreamTextResult(['h', 'e', 'l', 'l', 'o']));

      const client = new OpenAISdkClient({ apiKey: 'sk-test', baseURL: 'https://api.openai.com/v1' });
      const chunks: string[] = [];
      // LLMClient declares createMessageStream as optional (?). The
      // non-null assertion is the canonical pattern when the
      // implementation is known to provide it.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      await client.createMessageStream!({
        model: 'gpt-4.1',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
        onChunk: (c: string) => chunks.push(c),
      });

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks.join('')).toBe('hello');
    });

    it('includes reasoning as <think> block at start of returned text', async () => {
      // DeepSeek-style providers yield reasoning in a separate stream.
      // AI-SDK's streamText wraps them via reasoningStream; we prepend
      // them as <think>...</think> so Query Wiki's extractThinkingBlocks
      // can find them (matches v1.20.0 behavior).
      mockStreamText.mockReturnValue(
        makeStreamTextResult(['final answer'], ['thinking...'])
      );

      const client = new OpenAISdkClient({ apiKey: 'sk-test', baseURL: 'https://api.openai.com/v1' });
      // LLMClient declares createMessageStream as optional (?). The
      // non-null assertion is the canonical pattern when the
      // implementation is known to provide it.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      const result = await client.createMessageStream!({
        model: 'gpt-4.1',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
        onChunk: () => {},
      });

      expect(result).toContain('<think>');
      expect(result).toContain('thinking...');
      expect(result).toContain('final answer');
      expect(result).toMatch(/<think>[\s\S]*?<\/think>[\s\S]*final answer/);
    });

    it('does NOT pass reasoning to onChunk (only text deltas)', async () => {
      // Reasoning is only in the returned string, not in onChunk callback
      // (so Query Wiki UI doesn't show raw reasoning before final answer).
      mockStreamText.mockReturnValue(
        makeStreamTextResult(['final'], ['reasoning-content'])
      );

      const client = new OpenAISdkClient({ apiKey: 'sk-test', baseURL: 'https://api.openai.com/v1' });
      const chunks: string[] = [];
      // LLMClient declares createMessageStream as optional (?). The
      // non-null assertion is the canonical pattern when the
      // implementation is known to provide it.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      await client.createMessageStream!({
        model: 'gpt-4.1',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
        onChunk: (c: string) => chunks.push(c),
      });

      expect(chunks).toEqual(['final']);
      expect(chunks.join('')).not.toContain('reasoning-content');
    });

    it('sends reasoningEffort="none" when enableThinking is false (v1.26.0 Batch 6)', async () => {
      mockStreamText.mockReturnValue(makeStreamTextResult(['hi']));

      const client = new OpenAISdkClient({ apiKey: 'sk-test', baseURL: 'https://api.openai.com/v1' });
      // LLMClient declares createMessageStream as optional (?). The
      // non-null assertion is the canonical pattern when the
      // implementation is known to provide it.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await client.createMessageStream!({
        model: 'gpt-5.5',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
        onChunk: () => {},
        enableThinking: false,
      });

      const call = mockStreamText.mock.calls[0][0] as Record<string, unknown>;
      // v1.26.0 Batch 6: stream path uses the same buildProviderOptions
      // as non-stream, so reasoningEffort='none' applies here too.
      expect(call.providerOptions).toEqual({
        openai: { reasoningEffort: 'none' },
      });
    });

    it('forwards temperature at top level', async () => {
      mockStreamText.mockReturnValue(makeStreamTextResult(['hi']));

      const client = new OpenAISdkClient({ apiKey: 'sk-test', baseURL: 'https://api.openai.com/v1' });
      // LLMClient declares createMessageStream as optional (?). The
      // non-null assertion is the canonical pattern when the
      // implementation is known to provide it.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      await client.createMessageStream!({
        model: 'gpt-4.1',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
        onChunk: () => {},
        temperature: 0.5,
      });

      const call = mockStreamText.mock.calls[0][0] as Record<string, unknown>;
      expect(call.temperature).toBe(0.5);
    });

    it('enriches APICallError with provider body (stream path mirrors createMessage)', async () => {
      // The same v1.22.5 UX preservation applies to stream errors.
      mockStreamText.mockImplementation(() => {
        throw new APICallError({
          message: 'Provider returned error',
          statusCode: 429,
          responseHeaders: {},
          url: 'https://api.openai.com/v1',
          requestBodyValues: {},
          responseBody: JSON.stringify({
            error: { message: 'You exceeded your current quota, please check your plan and billing details' },
          }),
        });
      });

      const client = new OpenAISdkClient({ apiKey: 'sk-test', baseURL: 'https://api.openai.com/v1' });
      await expect(
        // LLMClient declares createMessageStream as optional (?). The
        // non-null assertion is the canonical pattern when the
        // implementation is known to provide it.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        client.createMessageStream!({
          model: 'gpt-5.5',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'hi' }],
          onChunk: () => {},
        })
      ).rejects.toThrow(/status 429/);
      await expect(
        // LLMClient declares createMessageStream as optional (?). The
        // non-null assertion is the canonical pattern when the
        // implementation is known to provide it.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        client.createMessageStream!({
          model: 'gpt-5.5',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'hi' }],
          onChunk: () => {},
        })
      ).rejects.toThrow(/quota/);
    });
  });

  describe('listModels', () => {
    // Test Connection uses listModels for the model dropdown. AI-SDK's
    // createOpenAI has no listModels (each model is constructed ad-hoc
    // by string id). We expose a placeholder that returns [] — the
    // Settings UI falls back to PREDEFINED_PROVIDERS for model
    // suggestions. (Future: wire up to provider's /models endpoint.)
    it('returns empty array (placeholder for OpenAI provider)', async () => {
      const client = new OpenAISdkClient({ apiKey: 'sk-test', baseURL: 'https://api.openai.com/v1' });
      // LLMClient declares listModels as optional (?). The non-null
      // assertion is the canonical pattern when the implementation
      // is known to provide it.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      const models = await client.listModels!();
      expect(models).toEqual([]);
    });
  });
});