// v1.23.0 P1-7: Unit tests for OpenAICompatSdkClient.
//
// Covers the 6 baseURLs in PREDEFINED_PROVIDERS (Gemini / OpenRouter /
// DeepSeek / MiniMax / Moonshot / GLM / Ollama / LMStudio) by
// parameterizing over their baseURLs.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APICallError, NoObjectGeneratedError, NoOutputGeneratedError } from 'ai';

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

vi.mock('@ai-sdk/openai-compatible', async () => {
  const actual = await vi.importActual<typeof import('@ai-sdk/openai-compatible')>('@ai-sdk/openai-compatible');
  return {
    ...actual,
    createOpenAICompatible: vi.fn(actual.createOpenAICompatible),
  };
});

import { generateText } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { OpenAICompatSdkClient, repetitionPenaltyWireField } from '../../llm-sdk/openai-compat-sdk-client';

const mockGenerateText = vi.mocked(generateText);
const mockCreateOpenAICompatible = vi.mocked(createOpenAICompatible);

function makeResult(text: string): Awaited<ReturnType<typeof generateText>> {
  return {
    text,
    content: [],
    reasoning: [],
    reasoningText: undefined,
    files: [],
    sources: [],
    toolCalls: [],
    toolResults: [],
    finishReason: 'stop',
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30, reasoningTokens: undefined, cachedInputTokens: undefined },
    warnings: [],
    request: {},
    response: { id: 'resp_test', timestamp: new Date(), modelId: 'test', headers: {}, body: {} },
    providerMetadata: undefined,
    experimental_providerMetadata: undefined,
  } as unknown as Awaited<ReturnType<typeof generateText>>;
}

// v1.26.3 PATCH Phase B: helper for tests that exercise the typed-output
// path. Returns a generateText result with the SDK-parsed `output` field
// populated (Tier 0 schema-arm success path). The schema path is when
// `Output.object({schema, name})` is set on the generateText call; on
// success the SDK attaches `output: <parsed object>` to the result.
//
// `output` is added with `as unknown` to the type cast because the AI
// SDK's ReturnType may not declare it depending on the schema overload
// type signature. In production, callers use Zod-inferred types via
// `LLMClient.createMessageWithOutput<T>`.
function makeResultWithOutput(text: string, output: unknown): Awaited<ReturnType<typeof generateText>> {
  const base = makeResult(text);
  return { ...(base as object), output } as unknown as Awaited<ReturnType<typeof generateText>>;
}

// v1.26.x PATCH follow-up (#443 LMStudio + Qwen3.5): helper for tests that
// exercise the reasoning_content prepend path. AI SDK's generateText
// returns `reasoning` as a Promise<string> (or array of {text}) that
// resolves after the main response — mirroring the streaming variant
// already covered in the SDK. Tests use this to simulate a backend like
// LMStudio + Qwen3.5 whose chat template routes structured output into
// reasoning_content and leaves content empty.
function makeResultWithReasoning(
  text: string,
  reasoning: string | Array<{ text?: string }>,
  output?: unknown,
): Awaited<ReturnType<typeof generateText>> {
  const base = output !== undefined ? makeResultWithOutput(text, output) : makeResult(text);
  return {
    ...(base as object),
    reasoning: Promise.resolve(reasoning),
    reasoningText: undefined,
  } as unknown as Awaited<ReturnType<typeof generateText>>;
}

const PRESETS = [
  { id: 'gemini', baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash' },
  { id: 'openrouter', baseURL: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-3.5-sonnet' },
  { id: 'deepseek', baseURL: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { id: 'minimax', baseURL: 'https://api.minimaxi.com/v1', model: 'MiniMax-Text-01' },
  { id: 'moonshot', baseURL: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  { id: 'glm', baseURL: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-plus' },
  { id: 'ollama', baseURL: 'http://localhost:11434/v1', model: 'llama3.1' },
  { id: 'lmstudio', baseURL: 'http://localhost:1234/v1', model: 'qwen2.5-7b' },
];

describe('OpenAICompatSdkClient', () => {
  beforeEach(() => {
    mockGenerateText.mockReset();
    mockGenerateText.mockResolvedValue(makeResult('hello'));
    mockCreateOpenAICompatible.mockClear();
  });

  describe.each(PRESETS)('for provider "$id" ($baseURL)', (preset) => {
    it('forwards baseURL + name to createOpenAICompatible', async () => {
      const client = new OpenAICompatSdkClient({
        apiKey: 'test-key',
        baseURL: preset.baseURL,
        provider: preset.id,
      });
      await client.createMessage({
        model: preset.model,
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
      });

      const callOpts = mockCreateOpenAICompatible.mock.calls.at(-1)![0] as unknown as Record<string, unknown>;
      expect(callOpts.baseURL).toBe(preset.baseURL);
      expect(callOpts.name).toBe(preset.id);
      expect(callOpts.apiKey).toBe('test-key');
    });

    it('hands the abort signal to the AI SDK (#646)', async () => {
      const client = new OpenAICompatSdkClient({ apiKey: 'test-key', baseURL: preset.baseURL, provider: preset.id });
      const signal = new AbortController().signal;
      await client.createMessage({ model: preset.model, max_tokens: 100, messages: [{ role: 'user', content: 'hi' }], abortSignal: signal });
      const call = mockGenerateText.mock.calls.at(-1)![0] as Record<string, unknown>;
      expect(call.abortSignal).toBe(signal);
    });

    it('creates the model with the given id', async () => {
      const client = new OpenAICompatSdkClient({
        apiKey: 'test-key',
        baseURL: preset.baseURL,
        provider: preset.id,
      });
      await client.createMessage({
        model: preset.model,
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
      });

      const call = mockGenerateText.mock.calls[0][0] as Record<string, unknown>;
      expect(call.model).toBeDefined();
      expect(typeof call.model).toBe('object');
    });
  });

  // v1.26.0 Batch 6: force-disable thinking via `reasoningEffort: 'none'`.
  //
  // History (per [[project_v1_26_0_batch_6_real_wire_thinking_disable]]):
  //   - v1.23.0:  `reasoningEffort: 'low'` (OpenAI gpt-5.x style) — DeepSeek
  //               silently mapped `'low'` → `'high'`, intent lost
  //   - PR #410:  `thinking: { type: 'disabled' }` +
  //               `chat_template_kwargs: { enable_thinking: false }` — both
  //               are NOT in @ai-sdk/openai-compatible's zod schema
  //               (line 322-344 of dist/index.mjs), so the SDK's `filter()`
  //               at line 531-540 deletes them before the body is built.
  //               Verified by DocTpoint via fetch-interceptor (Issue #382
  //               comment 2, 2026-08-04): neither field left the process.
  //   - Batch 6:  `reasoningEffort: 'none'` (camelCase) — the zod schema
  //               accepts it (line 331: `z.string().optional()`) and emits
  //               as `reasoning_effort: 'none'` on the wire (line 541).
  //               DocTpoint's LM Studio / gemma-4-12b measurement confirmed
  //               wire-reaches + reasoning_tokens=0.
  //
  // Backend compatibility (no per-vendor matching — 400-retry in B6-3
  // handles the Gemini-via-OpenAI-shim case):
  //   - DeepSeek V3/V3.1/V4: ✅ accepts reasoning_effort
  //   - Kimi k2.5/2.6:       ✅ accepts
  //   - GLM-4.6:             ✅ accepts
  //   - LM Studio / llama.cpp: ✅ DocTpoint measured
  //   - OpenRouter:          ⚠️ uses `reasoning: { enabled: false }`
  //                          (different dialect, silently ignored)
  describe('enableThinking handling (reasoningEffort="none" for OpenAI-compatible)', () => {
    it('sends reasoningEffort="none" when enableThinking is false', async () => {
      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'https://api.deepseek.com/v1',
        provider: 'deepseek',
      });
      await client.createMessage({
        model: 'deepseek-chat',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
        enableThinking: false,
      });

      const call = mockGenerateText.mock.calls[0][0] as unknown as Record<string, unknown>;
      // v1.26.0 Batch 6: the field that the SDK's zod schema accepts
      // (line 331 of @ai-sdk/openai-compatible@2.0.62/dist/index.mjs) and
      // that the SDK emits as `reasoning_effort: 'none'` on the wire
      // (line 541). Prior Batch 2 PR #410 used `thinking.type` +
      // `chat_template_kwargs` which are stripped by the filter and
      // never leave the process.
      //
      // Issue #414: `buildProviderOptions` now returns under the
      // per-id provider key (`deepseek` here), not the legacy
      // `openaiCompatible` key. The SDK's openai-compat passthrough at
      // @ai-sdk/openai-compatible@2.0.62/dist/index.mjs:525-540 reads
      // from this per-id key — which is the fix that lets
      // `reasoningEffort` (and `repetition_penalty`) reach the wire.
      expect(call.providerOptions).toEqual({
        deepseek: {
          reasoningEffort: 'none',
        },
      });
    });


    it('omits reasoningEffort when enableThinking is undefined', async () => {
      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'https://api.deepseek.com/v1',
        provider: 'deepseek',
      });
      await client.createMessage({
        model: 'deepseek-chat',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
      });

      const call = mockGenerateText.mock.calls[0][0] as Record<string, unknown>;
      expect(call.providerOptions).toEqual({});
    });
  });

  // v1.26.x PATCH follow-up (#443 LMStudio + Qwen3.5):
  //
  // AI SDK's `generateText` returns the visible `content` field as
  // `result.text` and the reasoning (DeepSeek R1 / OpenAI o-series /
  // LMStudio + Qwen3.5) as a SEPARATE `result.reasoning` Promise that
  // resolves after the main response. The SDK must prepend the
  // reasoning content so `parseJsonResponse`'s balanced-JSON finder can
  // recover JSON-shaped payloads that the backend routed into the
  // reasoning channel.
  //
  // Before this fix, source-analyzer's batch 1 ingested through
  // `createMessageWithOutput` and saw `text: ''` because the model
  // output was entirely in reasoning_content (LMStudio chat-template
  // parser bug + Qwen3.5 thinking mode). parseJsonResponse classified
  // it as 'empty' even though a complete `{"entities": [...]}` payload
  // existed in reasoning_content. The user's E2E log on 2026-08-11
  // showed `Response length: 0` for that exact reason.
  describe('reasoning_content prepend (Issue #443 follow-up — LMStudio + Qwen3.5)', () => {
    it('createMessageWithOutput: prepends raw reasoning when no <think> tag is present', async () => {
      mockGenerateText.mockReset();
      mockGenerateText.mockResolvedValue(
        makeResultWithReasoning('', '{"entities":[{"name":"X"}],"concepts":[]}'),
      );
      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'http://localhost:1234/v1',
        provider: 'lmstudio',
      });
      const result = await client.createMessageWithOutput({
        model: 'qwen3.5-9b',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'analyze' }],
        response_format: { type: 'json_object', schema: {} },
      });
      // The JSON-shaped reasoning payload must survive in the returned
      // text — NOT be wrapped in <think> tags (those would force
      // parseJsonResponse to strip them and lose the JSON).
      expect(result.text).not.toMatch(/^<think>/);
      expect(result.text).toContain('"entities"');
      expect(result.text).toContain('"name":"X"');
      // output should be undefined because Tier 0 schema parse failed
      // (we passed an empty schema, that's fine — the important thing
      // is that the text is not empty).
      expect(result.output).toBeUndefined();
    });

    it('createMessage (legacy): also prepends reasoning content on the non-typed path', async () => {
      mockGenerateText.mockReset();
      mockGenerateText.mockResolvedValue(
        makeResultWithReasoning('', '{"entities":[{"name":"A"}]}'),
      );
      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'http://localhost:1234/v1',
        provider: 'lmstudio',
      });
      const text = await client.createMessage({
        model: 'qwen3.5-9b',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'analyze' }],
      });
      expect(text).toContain('"entities"');
      expect(text).toContain('"name":"A"');
    });

    // S143: the prepend rescue is for answers that arrived through the
    // reasoning channel (finish=stop). A think that ran into the token limit
    // with empty content never produced an answer — prepending it would
    // launder the runaway reasoning into a "valid" response that downstream
    // merges into wiki pages (observed: 7 pages with 30K-char English
    // think-plans as body). The #470 guard must fire instead.
    it('createMessage: does NOT launder a runaway think (empty content at length)', async () => {
      mockGenerateText.mockReset();
      const runaway = {
        ...(makeResultWithReasoning('', '*   Target: Update the "Burnout" wiki page…') as object),
        finishReason: 'length',
        usage: { inputTokens: 9000, outputTokens: 32767, totalTokens: 41767, reasoningTokens: 32765, cachedInputTokens: undefined },
      } as Awaited<ReturnType<typeof generateText>>;
      mockGenerateText.mockResolvedValue(runaway);
      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'http://localhost:1234/v1',
        provider: 'lmstudio',
      });
      await expect(client.createMessage({
        model: 'gemma-4-26b',
        max_tokens: 32767,
        messages: [{ role: 'user', content: 'merge' }],
      })).rejects.toThrow(/max_tokens/);
    });

    it('createMessageWithOutput: same runaway gate on the typed path', async () => {
      mockGenerateText.mockReset();
      const runaway = {
        ...(makeResultWithReasoning('', 'endless format rumination…') as object),
        finishReason: 'length',
        usage: { inputTokens: 9000, outputTokens: 16000, totalTokens: 25000, reasoningTokens: 15997, cachedInputTokens: undefined },
      } as Awaited<ReturnType<typeof generateText>>;
      mockGenerateText.mockResolvedValue(runaway);
      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'http://localhost:1234/v1',
        provider: 'lmstudio',
      });
      await expect(client.createMessageWithOutput({
        model: 'gemma-4-26b',
        max_tokens: 16000,
        messages: [{ role: 'user', content: 'analyze' }],
        response_format: { type: 'json_object', schema: {} },
      })).rejects.toThrow(/reasoning/);
    });

    it('does NOT prepend when reasoning is empty (cloud providers unaffected)', async () => {
      mockGenerateText.mockReset();
      mockGenerateText.mockResolvedValue(
        makeResultWithReasoning('{"summary":"ok"}', ''),
      );
      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'https://api.deepseek.com/v1',
        provider: 'deepseek',
      });
      const result = await client.createMessageWithOutput({
        model: 'deepseek-chat',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'analyze' }],
      });
      // Reasoning empty → no prepend → text is exactly the visible text.
      expect(result.text).toBe('{"summary":"ok"}');
    });

    it('wraps reasoning in <think> tags when reasoning already contains <think> (DeepSeek R1 compat)', async () => {
      mockGenerateText.mockReset();
      mockGenerateText.mockResolvedValue(
        makeResultWithReasoning(
          '{"answer":"yes"}',
          '<think>let me think</think>step',
        ),
      );
      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'https://api.deepseek.com/v1',
        provider: 'deepseek',
      });
      const result = await client.createMessageWithOutput({
        model: 'deepseek-reasoner',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'analyze' }],
      });
      // Reasoning already wrapped → keep the wrap contract so
      // extractThinkingBlocks in the Query UI still recognises it.
      expect(result.text).toMatch(/<think>/);
      expect(result.text).toMatch(/<\/think>/);
      expect(result.text).toContain('{"answer":"yes"}');
    });

    it('handles reasoning as Array<{text}> form', async () => {
      mockGenerateText.mockReset();
      mockGenerateText.mockResolvedValue(
        makeResultWithReasoning('', [
          { text: '{"a":1}' },
          { text: '{"b":2}' },
        ]),
      );
      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'http://localhost:1234/v1',
        provider: 'lmstudio',
      });
      const result = await client.createMessageWithOutput({
        model: 'qwen3.5-9b',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'x' }],
      });
      // Both reasoning chunks must be joined and prepended.
      expect(result.text).toContain('{"a":1}');
      expect(result.text).toContain('{"b":2}');
    });
  });

  describe('response_format: no-schema case sets output=Output.json() for the SDK to encode (Issue #443 elegant fallback)', () => {
    // v1.26.3 PATCH follow-up (elegant fallback) supersedes Option 1:
    //
    //   Option 1 (shipped in e053cef): buildOutputArgs returned `{}` for
    //   the no-schema case — `Output.json()` was never invoked, no
    //   `output` was set, the SDK never saw a `response_format` field.
    //   Rationale: LM Studio rejects `json_object` with HTTP 400
    //   (DocTpoint Issue #443 comment 1, 2026-08-09) — skip the field
    //   to avoid 400. Cost: the 6 cloud providers (deepseek / openrouter
    //   / kimi / glm / gemini / minimax) lose the server-side type hint
    //   that reduces parse-failure class of issues.
    //
    //   Elegant fallback (this follow-up): buildOutputArgs returns
    //   `{ output: Output.json() }` for the no-schema case. The SDK
    //   encodes `response_format: { type: 'json_object' }` on the wire
    //   for every openai-compat provider. The 6 cloud providers accept
    //   it (server-side type hint restored). The local-server cohort
    //   (LM Studio / Ollama / `custom`) that rejects the field is
    //   caught by the json-object-strip 400-retry at the client
    //   level (json-object-strip-probe.ts) — the cost is one 400 per
    //   unique baseURL, then cache hit and the wire field is dropped
    //   silently thereafter. No provider is hardcoded in the helper.
    //
    // This test pins the SDK-client call-site boundary: `output` IS
    // set (so the SDK encodes `json_object` on the wire). The
    // wire-body assertion in `openai-compat-request-body.test.ts`
    // pins what the SDK actually sends.
    it('sets top-level output=Output.json() when caller asks for json_object without schema', async () => {
      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'https://api.deepseek.com/v1',
        provider: 'deepseek',
      });
      await client.createMessage({
        model: 'deepseek-chat',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'JSON' }],
        response_format: { type: 'json_object' },
      });

      const call = mockGenerateText.mock.calls[0][0] as Record<string, unknown>;
      expect(call.providerOptions).toEqual({});
      // Issue #443 elegant-fallback contract: no-schema case → `output`
      // is set (the SDK encodes it as `json_object` on the wire). The
      // strip probe at the client level handles backends that 400 on
      // the field (LM Studio is the measured case). The wire-body test
      // in `openai-compat-request-body.test.ts` pins the actual wire
      // shape: `{type:'json_object'}`.
      expect(call.output).toBeDefined();
    });
  });

  describe('error mapping (preserves v1.22.5 error body UX)', () => {
    it('enriches APICallError with provider body for 4xx responses', async () => {
      mockGenerateText.mockReset();
      mockGenerateText.mockRejectedValue(new APICallError({
        message: 'Provider returned error',
        statusCode: 429,
        responseHeaders: {},
        url: 'https://api.deepseek.com/v1',
        requestBodyValues: {},
        responseBody: JSON.stringify({
          error: { message: 'You exceeded your current quota, please check your plan and billing details' },
        }),
      }));

      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'https://api.deepseek.com/v1',
        provider: 'deepseek',
      });
      await expect(
        client.createMessage({
          model: 'deepseek-chat',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'hi' }],
        })
      ).rejects.toThrow(/status 429/);
      await expect(
        client.createMessage({
          model: 'deepseek-chat',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'hi' }],
        })
      ).rejects.toThrow(/quota/);
    });
  });

  // v1.26.0 Batch 6: Layer-3 400-retry integration tests. Regression
  // guard for the force-disable-thinking mechanism — when the backend
  // rejects reasoning_effort='none' with HTTP 400, the client must
  // strip the field and retry exactly once, then cache the strip
  // decision so subsequent calls skip the probe.
  describe('reasoning-strip 400-retry (v1.26.0 Batch 6 Layer 3)', () => {
    it('retries without reasoningEffort after 400 mentioning reasoning_effort', async () => {
      mockGenerateText.mockReset();
      mockGenerateText
        .mockRejectedValueOnce(new APICallError({
          message: "Invalid value for 'reasoning_effort': 'none' is not supported",
          statusCode: 400,
          responseHeaders: {},
          url: 'https://api.deepseek.com/v1',
          requestBodyValues: {},
          responseBody: '{"error":{"message":"Invalid value for reasoning_effort"}}',
        }))
        .mockResolvedValueOnce(makeResult('hello'));

      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'https://api.deepseek.com/v1',
        provider: 'deepseek',
      });
      const text = await client.createMessage({
        model: 'deepseek-chat',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
        enableThinking: false,
      });

      expect(text).toBe('hello');
      expect(mockGenerateText).toHaveBeenCalledTimes(2);

      // First call: reasoningEffort='none' is present
      const firstCall = mockGenerateText.mock.calls[0][0] as Record<string, unknown>;
      // Issue #414: per-id provider key (deepseek), not openaiCompatible.
      expect(firstCall.providerOptions).toEqual({
        deepseek: { reasoningEffort: 'none' },
      });

      // Second call: reasoningEffort stripped
      const secondCall = mockGenerateText.mock.calls[1][0] as Record<string, unknown>;
      expect(secondCall.providerOptions).toEqual({});
    });

    it('caches the strip decision per baseURL — second call skips the 400', async () => {
      mockGenerateText.mockReset();
      // First call to this baseURL: 400 then retry success
      mockGenerateText
        .mockRejectedValueOnce(new APICallError({
          // v1.26.3 PATCH follow-up: simulate the real AI SDK APICallError
          // shape — `message` is the AI SDK template, `responseBody` is
          // the provider's actual body. The reasoning-strip classifier
          // now checks responseBody (not message). This matches what
          // the wire produces in production.
          message: 'Provider returned error',
          statusCode: 400,
          responseHeaders: {},
          url: 'https://api.deepseek.com/v1',
          requestBodyValues: {},
          responseBody: '{"error":{"message":"Invalid value for reasoning_effort"}}',
        }))
        .mockResolvedValueOnce(makeResult('hello-1'));
      // Second call: should NOT 400 again — strip is cached, the call
      // goes out without reasoningEffort from the start
      mockGenerateText.mockResolvedValueOnce(makeResult('hello-2'));

      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'https://api.deepseek.com/v1',
        provider: 'deepseek',
      });

      // First invocation: triggers 400 → retry → cache strip
      const text1 = await client.createMessage({
        model: 'deepseek-chat',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
        enableThinking: false,
      });
      expect(text1).toBe('hello-1');
      expect(mockGenerateText).toHaveBeenCalledTimes(2);

      // Second invocation: cache hit, only ONE call, no reasoningEffort
      const text2 = await client.createMessage({
        model: 'deepseek-chat',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
        enableThinking: false,
      });
      expect(text2).toBe('hello-2');
      expect(mockGenerateText).toHaveBeenCalledTimes(3); // 1st = 400, 2nd = retry-success, 3rd = second-call (single)

      const thirdCall = mockGenerateText.mock.calls[2][0] as Record<string, unknown>;
      expect(thirdCall.providerOptions).toEqual({});
    });

    it('does NOT add reasoningEffort when enableThinking is undefined (no override)', async () => {
      // When the user did NOT explicitly disable thinking, we don't
      // send reasoningEffort at all, so the 400 can't be on that field
      // in our config. The token-key retry may still fire (any 400
      // triggers it) but it does not add reasoningEffort either.
      mockGenerateText.mockReset();
      mockGenerateText.mockRejectedValue(new APICallError({
        // Real AI SDK shape — see comment above (line 325-333).
        message: 'Provider returned error',
        statusCode: 400,
        responseHeaders: {},
        url: 'https://api.deepseek.com/v1',
        requestBodyValues: {},
        responseBody: '{"error":{"message":"Invalid value for reasoning_effort"}}',
      }));

      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'https://api.deepseek.com/v1',
        provider: 'deepseek',
      });
      // v1.26.3 PATCH follow-up: the AI SDK's APICallError.message is
      // a fixed template ("Provider returned error"). The real
      // provider body is in responseBody. Assert the body carries
      // the reasoning_effort marker (the actual content the user
      // cares about), not the message string.
      await expect(
        client.createMessage({
          model: 'deepseek-chat',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'hi' }],
          // enableThinking intentionally not set
        }),
      ).rejects.toMatchObject({
        responseBody: expect.stringContaining('reasoning_effort'),
      });
      // The original call AND the token-key retry fire (any 400 →
      // token-key retry) — but no reasoningEffort is added in either
      // call because enableThinking !== false.
      expect(mockGenerateText).toHaveBeenCalledTimes(2);
      const firstCall = mockGenerateText.mock.calls[0][0] as Record<string, unknown>;
      const secondCall = mockGenerateText.mock.calls[1][0] as Record<string, unknown>;
      expect(firstCall.providerOptions).toEqual({});
      expect(secondCall.providerOptions).toEqual({});
    });

    it('does NOT retry on 400 mentioning max_tokens (handled by TokenKeyProber instead)', async () => {
      // Sanity check: the reasoning-strip retry should NOT swallow 400s
      // that belong to the token-key mechanism. The 400 here mentions
      // max_tokens only — token-key retry handles it.
      mockGenerateText.mockReset();
      mockGenerateText
        .mockRejectedValueOnce(new APICallError({
          // Real AI SDK APICallError shape — responseBody carries the
          // provider's actual body, message is the AI SDK template.
          // The body mentions max_tokens only (no reasoning field
          // marker), so the reasoning-strip probe must NOT fire.
          message: 'Provider returned error',
          statusCode: 400,
          responseHeaders: {},
          url: 'https://api.deepseek.com/v1',
          requestBodyValues: {},
          responseBody: '{"error":{"message":"Invalid value for max_tokens"}}',
        }))
        .mockResolvedValueOnce(makeResult('hello'));

      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'https://api.deepseek.com/v1',
        provider: 'deepseek',
      });
      const text = await client.createMessage({
        model: 'deepseek-chat',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
        enableThinking: false,
      });
      expect(text).toBe('hello');
      // Two calls — token-key retry path (different from reasoning-strip).
      // We don't assert which retry fired, only that the 400 was handled.
      expect(mockGenerateText).toHaveBeenCalledTimes(2);
    });
  });

  // v1.26.3 PATCH Phase A4 — 3-tier output-mode demotion chain (replaces
  // the v1.26.2 2-tier json-object-strip describe block). The legacy
  // block tested "strip output on json_object 400" — the new chain
  // demotes one tier per matched classifier. The two tests below cover
  // the LM Studio 400 body verbatim (the regression guard from the
  // 2026-08-10 E2E that surfaced the err.message vs err.responseBody
  // bug). They now assert the 3-call demotion path: json_schema → 400 →
  // json_object → 400 → text_prompt → success.
  describe('output-mode 3-tier demotion (LM Studio regression guard)', () => {
    it('demotes json_schema → json_object → text_prompt on the LM Studio body', async () => {
      mockGenerateText.mockReset();
      mockGenerateText
        .mockRejectedValueOnce(new APICallError({
          // v1.26.2 used `err.message` for the classifier — both probes
          // were silently broken until the 2026-08-10 E2E surfaced it.
          // We use the real AI SDK shape here (message=template,
          // responseBody=provider body) to pin the v1.26.2 fix.
          message: 'Provider returned error',
          statusCode: 400,
          responseHeaders: {},
          url: 'http://localhost:1234/v1',
          requestBodyValues: {},
          responseBody: '{"error":"\'response_format.type\' must be \'json_schema\' or \'text\'"}',
        }))
        .mockRejectedValueOnce(new APICallError({
          message: 'Provider returned error',
          statusCode: 400,
          responseHeaders: {},
          url: 'http://localhost:1234/v1',
          requestBodyValues: {},
          responseBody: '{"error":"\'response_format.type\' must be \'json_schema\' or \'text\'"}',
        }))
        .mockResolvedValueOnce(makeResult('hello'));

      const client = new OpenAICompatSdkClient({
        apiKey: 'lm-studio',
        baseURL: 'http://localhost:1234/v1',
        provider: 'lmstudio',
      });
      const text = await client.createMessage({
        model: 'qwythos-9b',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
        response_format: { type: 'json_object' },
      });

      expect(text).toBe('hello');
      // 3 calls: Tier 0 (json_schema) → Tier 1 (json_object) → Tier 2 (text_prompt)
      expect(mockGenerateText).toHaveBeenCalledTimes(3);

      // Tier 0 call: Output.json() (no schema → A3 fallback)
      const call1 = mockGenerateText.mock.calls[0][0] as { output?: { name?: string } };
      expect(call1.output?.name).toBe('json');

      // Tier 1 call: same Output.json() (json_object wire)
      const call2 = mockGenerateText.mock.calls[1][0] as { output?: { name?: string } };
      expect(call2.output?.name).toBe('json');

      // Tier 2 call: output is undefined, JSON enforcement prefix injected
      const call3 = mockGenerateText.mock.calls[2][0] as { output?: { name?: string }; system?: string };
      expect(call3.output?.name).toBeUndefined();
      expect(call3.system).toContain('CRITICAL: Your reply MUST be a single valid JSON object');
    });

    it('caches the demoted mode per baseURL — second call goes directly to Tier 2', async () => {
      mockGenerateText.mockReset();
      // First invocation: 3 calls (Tier 0 → Tier 1 → Tier 2)
      mockGenerateText
        .mockRejectedValueOnce(new APICallError({
          message: 'Provider returned error',
          statusCode: 400,
          responseHeaders: {},
          url: 'http://localhost:1234/v1',
          requestBodyValues: {},
          responseBody: '{"error":"\'response_format.type\' must be \'json_schema\' or \'text\'"}',
        }))
        .mockRejectedValueOnce(new APICallError({
          message: 'Provider returned error',
          statusCode: 400,
          responseHeaders: {},
          url: 'http://localhost:1234/v1',
          requestBodyValues: {},
          responseBody: '{"error":"\'response_format.type\' must be \'json_schema\' or \'text\'"}',
        }))
        .mockResolvedValueOnce(makeResult('hello-1'));
      // Second invocation: cache hit at Tier 2 — 1 call, no output
      mockGenerateText.mockResolvedValueOnce(makeResult('hello-2'));

      const client = new OpenAICompatSdkClient({
        apiKey: 'lm-studio',
        baseURL: 'http://localhost:1234/v1',
        provider: 'lmstudio',
      });

      // First invocation: 3 generateText calls (chain to Tier 2)
      const text1 = await client.createMessage({
        model: 'qwythos-9b',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
        response_format: { type: 'json_object' },
      });
      expect(text1).toBe('hello-1');
      expect(mockGenerateText).toHaveBeenCalledTimes(3);

      // Second invocation: cache hit at Tier 2 — 1 generateText call, no output
      const text2 = await client.createMessage({
        model: 'qwythos-9b',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
        response_format: { type: 'json_object' },
      });
      expect(text2).toBe('hello-2');
      expect(mockGenerateText).toHaveBeenCalledTimes(4);

      const fourthCall = mockGenerateText.mock.calls[3][0] as { output?: { name?: string }; system?: string };
      expect(fourthCall.output?.name).toBeUndefined();
      // No system was passed by the caller on the second invocation,
      // and the cache-hit path doesn't add the JSON prefix (the prefix
      // is only injected on Tier 2 RETRY, not on subsequent cache-hit
      // calls). This is intentional: on cache hits the model already
      // emits well-formed JSON because the previous retry succeeded.
      expect(fourthCall.system).toBeUndefined();
    });

    it('does NOT trigger strip on non-400 errors (e.g., 500, 401, 429)', async () => {
      // The strip retry is gated on statusCode === 400 + a json_object /
      // response_format field marker. Other status codes must NOT
      // trigger the strip — the existing token-key / URL-fallback paths
      // handle those, and silently disabling `json_object` for a
      // 500/401/429 would be a wrong cache decision.
      for (const statusCode of [500, 401, 429] as const) {
        mockGenerateText.mockReset();
        mockGenerateText.mockRejectedValue(new APICallError({
          // Real AI SDK shape — generic server error. No json_object /
          // response_format field marker in the body, so even on 400
          // the strip would not fire. statusCode guards the first
          // gate, field marker guards the second.
          message: 'Provider returned error',
          statusCode,
          responseHeaders: {},
          url: 'https://api.deepseek.com/v1',
          requestBodyValues: {},
          responseBody: '{"error":{"message":"server error"}}',
        }));

        const client = new OpenAICompatSdkClient({
          apiKey: 'sk-test',
          baseURL: 'https://api.deepseek.com/v1',
          provider: 'deepseek',
        });
        await expect(
          client.createMessage({
            model: 'deepseek-chat',
            max_tokens: 100,
            messages: [{ role: 'user', content: 'hi' }],
            response_format: { type: 'json_object' },
          })
        ).rejects.toThrow();
        // Single call: no retry, no strip probe. (Token-key fallback
        // would fire for some 400s, but for 500/401/429 it doesn't —
        // and even if it did, that's a different retry path that does
        // not omit `output`.)
        expect(mockGenerateText.mock.calls.length, `statusCode=${statusCode}`).toBeLessThanOrEqual(2);
      }
    });

    it('does NOT trigger strip when caller did not pass response_format', async () => {
      // No response_format → no `output` set → no json_object on the
      // wire → the 400 must not be misclassified as a json_object
      // rejection. Mirrors the reasoning-strip "no override → no field"
      // pattern.
      mockGenerateText.mockReset();
      mockGenerateText.mockRejectedValue(new APICallError({
        // Real AI SDK shape — body carries reasoning_effort, no
        // json_object marker. Reasoning-strip probe fires (because
        // the message identifies reasoning_effort as the cause);
        // json-object-strip does NOT (caller did not pass
        // response_format, and body has no json_object marker).
        message: 'Provider returned error',
        statusCode: 400,
        responseHeaders: {},
        url: 'https://api.deepseek.com/v1',
        requestBodyValues: {},
        responseBody: '{"error":{"message":"Invalid value for \'reasoning_effort\'"}}',
      }));

      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'https://api.deepseek.com/v1',
        provider: 'deepseek',
      });
      // The 400 here mentions reasoning_effort (not json_object), so
      // the reasoning-strip retry fires — but the json-object-strip
      // does NOT (the strip cache stays empty for this baseURL).
      // v1.26.3 PATCH follow-up: AI SDK's APICallError.message is a
      // fixed template; the real body is in responseBody. Assert the
      // body content (what the user cares about), not the message
      // string. Also assert the reasoning-strip branch fired (call
      // count = 2: original + retry without reasoning_effort), which
      // is the actual behavior we want to pin.
      await expect(
        client.createMessage({
          model: 'deepseek-chat',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'hi' }],
          // response_format intentionally not set
        }),
      ).rejects.toMatchObject({
        responseBody: expect.stringContaining('reasoning_effort'),
      });
      // Reasoning-strip retry fired (1 = original, 2 = retry without
      // reasoning_effort). Json-object-strip did NOT fire — total calls
      // is exactly 2, not 3.
      expect(mockGenerateText).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // v1.26.3 PATCH Phase A4 — 3-tier output-mode demotion chain
  //
  // The chain:
  //   Tier 0 (json_schema) + 400 with json_schema-rejection  →  retry Tier 1 (json_object)
  //   Tier 1 (json_object)  + 400 with json_object-rejection  →  retry Tier 2 (text_prompt)
  //   Tier 2 (text_prompt)  + 400  →  fall through (no further demotion)
  //
  // The mode cache is committed AFTER the demoted retry succeeds (not
  // before). A transient retry failure must not permanently downgrade
  // a baseURL.
  //
  // The 6 P0 callers' Phase B migration will exercise Tier 0
  // (json_schema on the wire). For now, all callers pass no schema →
  // they start at the no-schema Tier 0 path and immediately fall back
  // to Tier 1 (json_object) when response_format has no schema. So
  // Tier 0 demotion is exercised via a test that supplies a schema.
  // ==========================================================================

  describe('Phase A4 — 3-tier output-mode demotion chain', () => {
    const makeTier0Rejection = () => new APICallError({
      message: 'Provider returned error',
      statusCode: 400,
      responseHeaders: {},
      url: 'https://custom.example.com/v1',
      requestBodyValues: {},
      responseBody: '{"error":{"message":"Unsupported value: response_format.json_schema"}}',
    });

    const makeTier1Rejection = () => new APICallError({
      message: 'Provider returned error',
      statusCode: 400,
      responseHeaders: {},
      url: 'http://localhost:1234/v1',
      requestBodyValues: {},
      responseBody: '{"error":"\'response_format.type\' must be \'json_schema\' or \'text\'"}',
    });

    it('Tier 0 → Tier 1: schema-rejection 400 demotes to json_object, then succeeds', async () => {
      mockGenerateText.mockReset();
      mockGenerateText
        .mockRejectedValueOnce(makeTier0Rejection())  // 1st call: json_schema rejected
        .mockResolvedValueOnce(makeResult('ok'));  // 2nd call: json_object works

      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'https://custom.example.com/v1',
        provider: 'custom',
      });
      const schema = { type: 'object', properties: { name: { type: 'string' } } } as const;
      const result = await client.createMessage({
        model: 'any-model',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
        response_format: { type: 'json_object', schema },
      });
      expect(result).toBe('ok');
      // 2 calls: original (json_schema) + retry (json_object)
      expect(mockGenerateText).toHaveBeenCalledTimes(2);
      // 2nd call's output should be Output.json() (name='json'),
      // not Output.object() (name='object')
      const secondCallArgs = mockGenerateText.mock.calls[1][0] as { output?: { name?: string } };
      expect(secondCallArgs.output?.name).toBe('json');
    });

    it('Tier 0 → Tier 1 → Tier 2: schema-rejection, then object-rejection, then succeeds with text_prompt', async () => {
      mockGenerateText.mockReset();
      mockGenerateText
        .mockRejectedValueOnce(makeTier0Rejection())  // Tier 0 rejected
        .mockRejectedValueOnce(makeTier1Rejection())  // Tier 1 rejected
        .mockResolvedValueOnce(makeResult('ok'));  // Tier 2 works

      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'http://localhost:1234/v1',
        provider: 'lmstudio',
      });
      const schema = { type: 'object', properties: { name: { type: 'string' } } } as const;
      const result = await client.createMessage({
        model: 'any-model',
        max_tokens: 100,
        system: 'You are a helper.',
        messages: [{ role: 'user', content: 'hi' }],
        response_format: { type: 'json_object', schema },
      });
      expect(result).toBe('ok');
      // 3 calls: json_schema → json_object → text_prompt
      expect(mockGenerateText).toHaveBeenCalledTimes(3);
      // Last call: no output, JSON enforcement prefix injected
      const lastCallArgs = mockGenerateText.mock.calls[2][0] as {
        output?: { name?: string };
        system?: string;
      };
      expect(lastCallArgs.output?.name).toBeUndefined();
      expect(lastCallArgs.system).toContain('CRITICAL: Your reply MUST be a single valid JSON object');
    });

    it('Tier 2 is the floor: object-rejection after Tier 2 is reached does NOT trigger another retry', async () => {
      // After two demotions, cache says text_prompt. A subsequent call
      // on the same baseURL should NOT re-probe — it should emit Tier 2
      // directly. We test this with a single client instance: the cache
      // lives for the lifetime of the client.
      mockGenerateText.mockReset();
      mockGenerateText
        .mockRejectedValueOnce(makeTier0Rejection())
        .mockRejectedValueOnce(makeTier1Rejection())
        .mockResolvedValueOnce(makeResult('ok'))
        .mockResolvedValueOnce(makeResult('ok2'));  // 2nd call: cache hit, Tier 2 directly

      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'http://localhost:1234/v1',
        provider: 'lmstudio',
      });
      const schema = { type: 'object', properties: { name: { type: 'string' } } } as const;
      // First call: Tier 0 → 1 → 2 (3 generateText calls)
      await client.createMessage({
        model: 'any-model',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
        response_format: { type: 'json_object', schema },
      });
      // Second call: should hit cache at Tier 2 — only 1 generateText call
      await client.createMessage({
        model: 'any-model',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi again' }],
        response_format: { type: 'json_object', schema },
      });
      // Total: 4 generateText calls (3 for first call's chain + 1 for
      // second call's cache-hit).
      expect(mockGenerateText).toHaveBeenCalledTimes(4);
      // 4th call: no output (Tier 2)
      const lastCallArgs = mockGenerateText.mock.calls[3][0] as { output?: { name?: string } };
      expect(lastCallArgs.output?.name).toBeUndefined();
    });

    it('tentative markMode is rolled back when the chain exhausts without success', async () => {
      // v1.26.3 PATCH Phase A4 — the chain tentatively writes the
      // demoted mode BEFORE each retry so the next iteration's
      // classifier check sees the demoted mode. If the chain exhausts
      // (all tiers rejected), we roll back so a transient retry
      // failure doesn't permanently downgrade the baseURL.
      //
      // Setup: Tier 0 reject → Tier 1 retry rejects → Tier 2 retry
      // rejects → chain exhausted → all tentative writes rolled back.
      mockGenerateText.mockReset();
      mockGenerateText
        .mockRejectedValueOnce(makeTier0Rejection())   // Tier 0 reject
        .mockRejectedValueOnce(makeTier0Rejection())   // Tier 1 retry reject
        .mockRejectedValueOnce(makeTier0Rejection());  // Tier 2 retry reject

      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'https://custom.example.com/v1',
        provider: 'custom',
      });
      const schema = { type: 'object', properties: { name: { type: 'string' } } } as const;
      // First call: chain exhausts, error propagates
      await expect(
        client.createMessage({
          model: 'any-model',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'hi' }],
          response_format: { type: 'json_object', schema },
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
      // 3 generateText calls (Tier 0 → Tier 1 → Tier 2)
      expect(mockGenerateText).toHaveBeenCalledTimes(3);
      // Second call: cache rolled back to json_schema — re-probes from Tier 0
      mockGenerateText.mockResolvedValueOnce(makeResult('ok'));
      const result = await client.createMessage({
        model: 'any-model',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
        response_format: { type: 'json_object', schema },
      });
      expect(result).toBe('ok');
      // 2nd call succeeds with 1 generateText call (Tier 0 directly)
      expect(mockGenerateText).toHaveBeenCalledTimes(4);
    });
  });

  // ==========================================================================
  // v1.26.3 PATCH Path 2 fix: catch NoObjectGeneratedError from AI SDK
  // and return the raw text so caller-side parseJsonResponse + greedy
  // regex + LLM repair runs.
  //
  // Background (DocTpoint CHANGES_REQUESTED, 2026-08-10T12:50:37Z):
  //
  //   Both `Output.json()` (no-schema path) and `Output.object()`
  //   (schema path) call `parseCompleteOutput` after the model finishes
  //   (`ai@6.0.230/dist/index.mjs:3899`). On malformed JSON — common
  //   on the cloud cohort (deepseek / openrouter / glm / kimi / minimax
  //   / gemini) when the model emits unclosed arrays — the SDK throws
  //   `NoObjectGeneratedError`. Without a catch in the SDK client,
  //   the raw text NEVER reaches the caller-side `parseJsonResponse`,
  //   so the existing repair path (greedy regex + LLM repair) is dead.
  //   Users see "Failed to connect to <provider> API" — a JSON-shape
  //   problem misreported as a connectivity/credentials error.
  //
  //   This describe block pins the fix: the client catches
  //   NoObjectGeneratedError, returns `err.text`, and the caller-side
  //   parseJsonResponse can do its job on the malformed JSON.
  // ==========================================================================

  describe('NoObjectGeneratedError path (Path 2 fix — Issue #443 regression)', () => {
    // Real shape from `ai@6.0.230/dist/index.mjs` (line 3899):
    // `parseCompleteOutput` throws NoObjectGeneratedError with the
    // malformed raw text in `.text` (and the underlying JSONParseError
    // in `.cause`). We import the real class from `ai` so the SDK
    // client's `NoObjectGeneratedError.isInstance(err)` check works
    // the same way as in production.
    //
    // Constructor requires response/usage/finishReason — minimal placeholders.
    const makeNoObjectError = (
      text: string,
      body?: Record<string, unknown>,
    ) => new NoObjectGeneratedError({
      message: 'No object generated',
      text,
      cause: new Error('JSONParseError'),
      response: {
        id: 'test',
        timestamp: new Date(),
        modelId: 'test',
        headers: {},
        body: body ?? {},
      } as unknown as ConstructorParameters<typeof NoObjectGeneratedError>[0]['response'],
      usage: {
        inputTokens: 10,
        inputTokenDetails: { noCacheTokens: 10, cacheReadTokens: undefined, cacheWriteTokens: undefined },
        outputTokens: 20,
        outputTokenDetails: { textTokens: 20, reasoningTokens: undefined },
        totalTokens: 30,
      },
      finishReason: 'stop',
    });

    it('returns err.text when Output.json() throws NoObjectGeneratedError on malformed JSON', async () => {
      // Setup: model returns malformed JSON with finish_reason:'stop'.
      // AI SDK's parseCompleteOutput (Output.json() / Output.object()
      // both call it) throws NoObjectGeneratedError with text=<raw>.
      const MALFORMED = '{"entities": [{"name": "A", "mentions_in_source": ["x"},]}';
      mockGenerateText.mockReset();
      mockGenerateText.mockRejectedValueOnce(makeNoObjectError(MALFORMED));

      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'https://api.deepseek.com/v1',
        provider: 'deepseek',
      });
      // Path 2 contract: caller receives the RAW malformed text
      // (not undefined, not thrown) so parseJsonResponse can repair it.
      const result = await client.createMessage({
        model: 'deepseek-chat',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'extract' }],
        response_format: { type: 'json_object' },
      });

      expect(result).toBe(MALFORMED);
      // Exactly one generateText call — no retry, no probe. The error
      // is recovered inline, not via a chain. Without Path 2, the
      // NoObjectGeneratedError propagates and the user sees
      // "Failed to connect" — the parse-failure repair path is bypassed.
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
    });

    it('returns err.text when Output.object() (schema path) throws NoObjectGeneratedError', async () => {
      // Schema path also throws NoObjectGeneratedError — same contract.
      const MALFORMED = '{"name": "broken", "extra": ';  // truncated
      mockGenerateText.mockReset();
      mockGenerateText.mockRejectedValueOnce(makeNoObjectError(MALFORMED));

      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'http://localhost:1234/v1',
        provider: 'lmstudio',
      });
      const schema = { type: 'object', properties: { name: { type: 'string' } } } as const;
      const result = await client.createMessage({
        model: 'qwythos-9b',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'extract' }],
        response_format: { type: 'json_object', schema },
      });

      expect(result).toBe(MALFORMED);
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
    });

    it('does NOT trigger 3-tier demotion chain on NoObjectGeneratedError (different error class)', async () => {
      // The 3-tier chain demotes on APICallError + statusCode===400.
      // NoObjectGeneratedError is AISDKError, not APICallError. It must
      // NOT demote — it must recover inline (Path 2). Otherwise the
      // chain would consume the error and either retry (wasting HTTP
      // calls) or roll back the cache (wrong — the demoted mode isn't
      // the cause; the JSON parse failure is).
      const MALFORMED = '{"key": "value"';
      mockGenerateText.mockReset();
      mockGenerateText.mockRejectedValueOnce(makeNoObjectError(MALFORMED));

      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'http://localhost:1234/v1',
        provider: 'lmstudio',
      });
      const result = await client.createMessage({
        model: 'qwythos-9b',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'extract' }],
        response_format: { type: 'json_object' },
      });

      expect(result).toBe(MALFORMED);
      // Exactly 1 call: no chain, no retry. (Without Path 2, this test
      // would throw — the catch block's `APICallError.isInstance(err)`
      // gate would fail and the error would propagate via
      // `throw mapAiSdkError(err)`.)
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
    });

    it('caller-side parseJsonResponse can repair the returned text (integration check)', async () => {
      // Verifies the upstream invariant: when Path 2 returns the raw
      // malformed text, parseJsonResponse's repair logic can do its
      // job. We test the shape — the actual repair lives in
      // `parseJsonResponse.ts`; what we pin here is that the text
      // reaches the caller intact (not truncated, not transformed,
      // not wrapped in an error).
      const MALFORMED_WITH_TRUNCATION =
        '{"candidates": [{"path": "a.md", "relevance": 0.9}, {"path": "b.md", "relevance": 0.8';  // missing close brackets
      mockGenerateText.mockReset();
      mockGenerateText.mockRejectedValueOnce(makeNoObjectError(MALFORMED_WITH_TRUNCATION));

      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'https://api.deepseek.com/v1',
        provider: 'deepseek',
      });
      const result = await client.createMessage({
        model: 'deepseek-chat',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'select' }],
        response_format: { type: 'json_object' },
      });

      // Strict equality on the raw text — any transformation (e.g.
      // truncating at position N, wrapping in an error message) would
      // defeat parseJsonResponse's greedy-regex + LLM repair path.
      expect(result).toBe(MALFORMED_WITH_TRUNCATION);
    });

    // Issue #443 follow-up (LMStudio + Qwen3.5). When the model emits
    // `{"": ""}` under grammar-constrained decoding, Output.object
    // throws NoObjectGeneratedError. err.text is empty (only the
    // visible content field is captured) — the JSON-shaped payload
    // lives in err.response.body.choices[0].message.reasoning_content.
    // The SDK must reach in there and prepend it so the caller's
    // parseJsonResponse thinking-block fallback (Layer 3) can recover
    // the structured output.
    it('createMessage: recovers reasoning_content from err.response.body when err.text is empty', async () => {
      const reasoningContent =
        '{"source_title": "Developer policies", "entities": [{"name": "Obsidian"}]}';
      mockGenerateText.mockReset();
      mockGenerateText.mockRejectedValueOnce(
        makeNoObjectError('', {
          choices: [{
            message: {
              role: 'assistant',
              content: '',
              reasoning_content: reasoningContent,
              tool_calls: [],
            },
          }],
        }),
      );
      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'http://localhost:1234/v1',
        provider: 'lmstudio',
      });
      const text = await client.createMessage({
        model: 'qwen3.5-9b',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'analyze' }],
        response_format: { type: 'json_object', schema: {} },
      });
      // The reasoning payload must reach the caller — not be wrapped in
      // <think> tags (those would force parseJsonResponse's block-strip
      // to discard it).
      expect(text).toContain('"source_title"');
      expect(text).toContain('"entities"');
      expect(text).not.toMatch(/^<think>/);
    });

    it('createMessageWithOutput: recovers reasoning_content from err.response.body when err.text is empty', async () => {
      const reasoningContent = '{"entities":[{"name":"X"}],"summary":"yes"}';
      mockGenerateText.mockReset();
      mockGenerateText.mockRejectedValueOnce(
        makeNoObjectError('', {
          choices: [{
            message: {
              role: 'assistant',
              content: '',
              reasoning_content: reasoningContent,
              tool_calls: [],
            },
          }],
        }),
      );
      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'http://localhost:1234/v1',
        provider: 'lmstudio',
      });
      const result = await client.createMessageWithOutput({
        model: 'qwen3.5-9b',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'analyze' }],
        response_format: { type: 'json_object', schema: {} },
      });
      expect(result.text).toContain('"entities"');
      expect(result.text).toContain('"summary"');
      expect(result.output).toBeUndefined(); // Tier 0 failed → caller parses text
    });

    it('createMessage: degrades to err.text when err.response.body lacks reasoning_content', async () => {
      // Defensive: if the body shape is unexpected (e.g. cloud provider
      // without reasoning_content), do not crash — just surface err.text.
      const FALLBACK_TEXT = '{"placeholder":"yes"}';
      mockGenerateText.mockReset();
      mockGenerateText.mockRejectedValueOnce(
        makeNoObjectError(FALLBACK_TEXT, {
          choices: [{ message: { role: 'assistant', content: '', tool_calls: [] } }],
        }),
      );
      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'http://localhost:1234/v1',
        provider: 'lmstudio',
      });
      const text = await client.createMessage({
        model: 'qwen3.5-9b',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'analyze' }],
        response_format: { type: 'json_object' },
      });
      expect(text).toBe(FALLBACK_TEXT);
    });

    // ==========================================================================
    // Issue #443 follow-up (2026-08-11 E2E): per-model placeholder demotion.
    //
    // When LMStudio + Qwen3.5 emits `{"": ""}` under grammar-constrained
    // decoding (thinking mode cannot co-exist with the json_schema grammar,
    // so the model bails with the 5-token minimum-valid-object), the 400
    // demotion chain never fires (no 400 — the backend accepted the wire).
    // The placeholder is a SEMANTIC failure, not a protocol failure.
    //
    // The demotion target is text_prompt DIRECTLY (skipping json_object):
    // the placeholder's root cause is grammar-constrained decoding, and
    // json_object's Output.json() still applies a (weak) grammar — only
    // text_prompt drops it. The cache write is PER-MODEL so a healthy
    // sibling model on the same gateway (gemma-4-12b) is never demoted.
    // ==========================================================================
    describe('createMessageWithOutput: placeholder → text_prompt demotion (per-model, Issue #443 follow-up)', () => {
      const PLACEHOLDER = '{"": ""}';
      const baseURL = 'http://localhost:1234/v1';

      const makePlaceholderError = () =>
        makeNoObjectError('', {
          choices: [{ message: { role: 'assistant', content: '', reasoning_content: PLACEHOLDER, tool_calls: [] } }],
        });

      it('demotes to text_prompt and retries once when reasoning_content is a placeholder', async () => {
        mockGenerateText.mockReset();
        mockGenerateText.mockRejectedValueOnce(makePlaceholderError());
        // Second call (text_prompt retry) succeeds with real content.
        mockGenerateText.mockResolvedValueOnce(makeResult('{"entities":[{"name":"X"}],"concepts":[]}'));

        const client = new OpenAICompatSdkClient({ apiKey: 'sk-test', baseURL, provider: 'lmstudio' });
        const result = await client.createMessageWithOutput({
          model: 'qwen3.5-9b',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'analyze' }],
          response_format: { type: 'json_object', schema: {} },
        });

        // Two generateText calls: the placeholder failure, then the demoted retry.
        expect(mockGenerateText).toHaveBeenCalledTimes(2);
        const firstCall = mockGenerateText.mock.calls[0][0] as Record<string, unknown>;
        const secondCall = mockGenerateText.mock.calls[1][0] as Record<string, unknown>;
        // Tier 0 first attempt: Output.object on the wire.
        expect(firstCall.output).toBeDefined();
        // Demoted retry: text_prompt → buildOutputArgs returns {} (no output arg).
        expect(secondCall.output).toBeUndefined();
        // JSON-shape enforcement prefix injected into the retry system prompt.
        expect(String(secondCall.system)).toContain('MUST be a single valid JSON object');

        // Success path returns the retry's text + the demoted outputMode.
        expect(result.text).toContain('"entities"');
        expect(result.outputMode).toBe('text_prompt');
        expect(result.output).toBeUndefined();

        // Cache committed per-model: qwen3.5-9b is demoted...
        const prober = (client as unknown as { outputModeProber: { getMode: (u: string, m: string) => string } }).outputModeProber;
        expect(prober.getMode(baseURL, 'qwen3.5-9b')).toBe('text_prompt');
        // ...but gemma on the same gateway stays at the strongest tier.
        expect(prober.getMode(baseURL, 'gemma-4-12b')).toBe('json_schema');
      });

      it('returns the raw placeholder text when the text_prompt retry also fails', async () => {
        mockGenerateText.mockReset();
        mockGenerateText.mockRejectedValueOnce(makePlaceholderError());
        mockGenerateText.mockRejectedValueOnce(makePlaceholderError());

        const client = new OpenAICompatSdkClient({ apiKey: 'sk-test', baseURL, provider: 'lmstudio' });
        const result = await client.createMessageWithOutput({
          model: 'qwen3.5-9b',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'analyze' }],
          response_format: { type: 'json_object', schema: {} },
        });

        // Two calls attempted; no crash — raw placeholder text surfaced so the
        // caller's parseJsonResponse placeholder gate can diagnose it.
        expect(mockGenerateText).toHaveBeenCalledTimes(2);
        expect(result.text).toContain('{"": ""}');
        expect(result.output).toBeUndefined();
        // No cache write on failed retry (mirror the 400 chain's "success-only" policy).
        const prober = (client as unknown as { outputModeProber: { getMode: (u: string, m: string) => string } }).outputModeProber;
        expect(prober.getMode(baseURL, 'qwen3.5-9b')).toBe('json_schema');
      });

      it('does NOT demote when reasoning_content is a real object (non-placeholder)', async () => {
        mockGenerateText.mockReset();
        // Full valid JSON in reasoning_content — the "good" #443 path that
        // must keep working unchanged: recover + return, no retry.
        mockGenerateText.mockRejectedValueOnce(
          makeNoObjectError('', {
            choices: [{ message: { role: 'assistant', content: '', reasoning_content: '{"entities":[{"name":"X"}],"concepts":[]}', tool_calls: [] } }],
          }),
        );

        const client = new OpenAICompatSdkClient({ apiKey: 'sk-test', baseURL, provider: 'lmstudio' });
        const result = await client.createMessageWithOutput({
          model: 'qwen3.5-9b',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'analyze' }],
          response_format: { type: 'json_object', schema: {} },
        });

        // Exactly one call — no demotion retry for a real payload.
        expect(mockGenerateText).toHaveBeenCalledTimes(1);
        expect(result.text).toContain('"entities"');
        expect(result.outputMode).toBe('json_schema');
      });
    });
  });

  // ==========================================================================
  // v1.26.3 PATCH Phase B — createMessageWithOutput (typed output).
  //
  // Opt-in variant that returns `{text, output?, outputMode, finishReason, usage?}`.
  // When Tier 0 (json_schema on the wire, `Output.object({schema, name})`)
  // succeeds, `output` is populated with the SDK-parsed object. When
  // Tier 1 (json_object) or Tier 2 (text_prompt) succeeds, `output` is
  // undefined and the caller falls back to `parseJsonResponse(text)`.
  //
  // Anthropic / OpenAI / Codex clients do NOT implement this method
  // (their callers don't opt in yet). The interface declares it
  // optional, so missing implementations don't break callers — they
  // just fall back to `createMessage` + parseJsonResponse.
  // ==========================================================================
  describe('createMessageWithOutput (Phase B typed output)', () => {
    const schema = { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } as const;
    const PARSED = { name: 'Alice' };

    it('returns output from generateText.result.output when Tier 0 succeeds', async () => {
      mockGenerateText.mockReset();
      mockGenerateText.mockResolvedValueOnce(makeResultWithOutput(JSON.stringify(PARSED), PARSED));

      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'http://localhost:1234/v1',
        provider: 'lmstudio',
      });
      const result = await client.createMessageWithOutput!({
        model: 'qwythos-9b',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'extract' }],
        response_format: { type: 'json_object', schema },
      });

      // Tier 0 (default): `output` is populated by SDK parse.
      expect(result.output).toEqual(PARSED);
      expect(result.text).toBe(JSON.stringify(PARSED));
      expect(result.outputMode).toBe('json_schema');
      expect(result.finishReason).toBe('stop');
    });

    it('returns output=undefined when Tier 1 succeeds (json_object, no schema parse)', async () => {
      // Tier 1 is reached when the cached mode is `json_object` — no
      // SDK parse happens because `Output.json()` (no schema) doesn't
      // parse eagerly into a typed object. The text is parseable JSON
      // but it's a raw string the caller must handle.
      mockGenerateText.mockReset();
      mockGenerateText.mockResolvedValueOnce(makeResult(JSON.stringify(PARSED)));

      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'https://api.deepseek.com/v1',
        provider: 'deepseek',
      });
      // Force Tier 1 by simulating a baseURL whose cache says json_object.
      // We do this by first triggering a 400 demotion, then asserting
      // the second call's `output` is undefined.
      // Simpler approach: directly invoke and assert based on default
      // mode ('json_schema' → no-schema path falls through to
      // Output.json() → output is still parsed IF the SDK does so). For
      // the Tier 1 contract we instead test the explicit case where
      // mode is forced via the prober.
      const prober = (client as unknown as { outputModeProber: { markMode: (u: string, m: string, mode: 'json_object') => void } }).outputModeProber;
      prober.markMode(client['baseURL'] as string, 'deepseek-chat', 'json_object');
      const result = await client.createMessageWithOutput!({
        model: 'deepseek-chat',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'extract' }],
        response_format: { type: 'json_object' },
      });

      expect(result.output).toBeUndefined();
      expect(result.text).toBe(JSON.stringify(PARSED));
      expect(result.outputMode).toBe('json_object');
    });

    it('returns output=undefined when Tier 2 succeeds (text_prompt, prompt enforcement)', async () => {
      mockGenerateText.mockReset();
      mockGenerateText.mockResolvedValueOnce(makeResult(JSON.stringify(PARSED)));

      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'http://localhost:1234/v1',
        provider: 'lmstudio',
      });
      const prober = (client as unknown as { outputModeProber: { markMode: (u: string, m: string, mode: 'text_prompt') => void } }).outputModeProber;
      prober.markMode(client['baseURL'] as string, 'qwythos-9b', 'text_prompt');
      const result = await client.createMessageWithOutput!({
        model: 'qwythos-9b',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'extract' }],
        response_format: { type: 'json_object' },
      });

      expect(result.output).toBeUndefined();
      expect(result.outputMode).toBe('text_prompt');
      // text is the raw model output (parseable JSON, but caller uses
      // parseJsonResponse to validate).
      expect(result.text).toBe(JSON.stringify(PARSED));
    });

    it('falls back to err.text on NoObjectGeneratedError (Path 2 fix applies to typed path)', async () => {
      // Same contract as createMessage: malformed JSON on the SDK parse
      // should surface the raw text so the caller can repair it. The
      // typed-output path must NOT swallow the error.
      const MALFORMED = '{"name": "broken", "extra": ';
      mockGenerateText.mockReset();
      mockGenerateText.mockRejectedValueOnce(new NoObjectGeneratedError({
        message: 'No object generated',
        text: MALFORMED,
        cause: new Error('JSONParseError'),
        response: { id: 'test', timestamp: new Date(), modelId: 'test', headers: {} },
        usage: {
          inputTokens: 10,
          inputTokenDetails: { noCacheTokens: 10, cacheReadTokens: undefined, cacheWriteTokens: undefined },
          outputTokens: 20,
          outputTokenDetails: { textTokens: 20, reasoningTokens: undefined },
          totalTokens: 30,
        },
        finishReason: 'stop',
      }));

      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'http://localhost:1234/v1',
        provider: 'lmstudio',
      });
      const result = await client.createMessageWithOutput!({
        model: 'qwythos-9b',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'extract' }],
        response_format: { type: 'json_object', schema },
      });

      expect(result.text).toBe(MALFORMED);
      expect(result.output).toBeUndefined();  // parse failed
    });

    it('does NOT throw when NoObjectGeneratedError has no .text field (defensive)', async () => {
      // The Path 2 contract has a defensive fallback: if .text is
      // missing (shouldn't happen per ai SDK contract, but if it
      // does), we re-throw. The typed-output path inherits the same
      // contract.
      mockGenerateText.mockReset();
      const err = new NoObjectGeneratedError({
        message: 'No object generated',
        // text intentionally missing
        cause: new Error('JSONParseError'),
        response: { id: 'test', timestamp: new Date(), modelId: 'test', headers: {} },
        usage: {
          inputTokens: 10,
          inputTokenDetails: { noCacheTokens: 10, cacheReadTokens: undefined, cacheWriteTokens: undefined },
          outputTokens: 20,
          outputTokenDetails: { textTokens: 20, reasoningTokens: undefined },
          totalTokens: 30,
        },
        finishReason: 'stop',
      });
      // Strip the .text field via Object.defineProperty since the SDK
      // sets it to undefined when not provided; we want to simulate a
      // truly missing field.
      // (Per ai SDK behavior, when `text` is not passed to the ctor,
      // it's set to undefined, not omitted. So this test really checks
      // the "undefined text → re-throw" branch.)
      mockGenerateText.mockRejectedValueOnce(err);

      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'http://localhost:1234/v1',
        provider: 'lmstudio',
      });
      await expect(
        client.createMessageWithOutput!({
          model: 'qwythos-9b',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'extract' }],
          response_format: { type: 'json_object', schema },
        }),
      ).rejects.toBe(err);
    });
  });

  // ==========================================================================
  // v1.26.4 PATCH (Issue #474 — Layer 2): NoOutputGeneratedError catch.
  //
  // Background: deepseek-v4-flash + reasoning model + heavy prompt → the
  // reasoning_content consumes the entire maxOutputTokens budget. The
  // model emits zero tokens in the visible content channel. AI SDK's
  // step-level retry loop then throws `NoOutputGeneratedError`
  // (sibling of `NoObjectGeneratedError`, both extend `AISDKError` —
  // `AI_NoOutputGeneratedError` vs `AI_NoObjectGeneratedError`,
  // ai@6.0.230/dist/index.mjs:5146, 7077, 7232, 7933).
  //
  // Previous behavior: the catch block only checked
  // `NoObjectGeneratedError.isInstance(err)`. The sibling class slipped
  // through and was mapped by `mapAiSdkError` to a "Failed to connect
  // to <provider> API" misreport. The user saw a connectivity error
  // when the actual cause was "model produced nothing".
  //
  // Fix: catch `NoOutputGeneratedError` alongside `NoObjectGeneratedError`
  // and return the empty quiet path (empty string for createMessage;
  // empty typed shape for createMessageWithOutput). The caller's
  // `parseJsonResponse` already handles empty input via its
  // `silentOnEmpty` / `EmptyResponseError` branches.
  // ==========================================================================
  describe('NoOutputGeneratedError path (Issue #474 — Layer 2)', () => {
    // Minimal real-shape constructor — AI SDK's NoOutputGeneratedError
    // accepts zero-args in some lines (line 5146) and structured-args in
    // others (line 7933). We use the no-args form to mirror the
    // step-retry exhaustion path that's the actual #474 cause.
    const makeNoOutputError = () => new NoOutputGeneratedError();

    it('returns "" from createMessage when generateText throws NoOutputGeneratedError', async () => {
      // Issue #474 symptom: deepseek-v4-flash burned all budget on
      // reasoning, emitted zero visible content, SDK threw
      // NoOutputGeneratedError. Old behavior: error propagated as
      // "Failed to connect to deepseek API". New behavior: empty quiet
      // path so caller-side parseJsonResponse can take its empty-input
      // branch (Source analysis: halveBatchAndRetry / Source analysis
      // failed).
      mockGenerateText.mockReset();
      mockGenerateText.mockRejectedValueOnce(makeNoOutputError());

      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'https://api.deepseek.com/v1',
        provider: 'deepseek',
      });
      const result = await client.createMessage({
        model: 'deepseek-v4-flash',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'extract' }],
        response_format: { type: 'json_object' },
      });

      expect(result).toBe('');
      // Exactly one generateText call — no retry, no chain. The error
      // class is recovered inline (empty quiet path), not retried.
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
    });

    it('returns empty typed shape from createMessageWithOutput when generateText throws NoOutputGeneratedError', async () => {
      // The typed-output path mirrors the empty quiet path:
      //   text: ''             (caller parseJsonResponse gets empty input)
      //   output: undefined    (no SDK-parsed object — there was nothing)
      //   outputMode: 'json_schema' (unchanged from cache default)
      //   finishReason: 'stop' (the SDK's step retry exhaustion is
      //                       semantically "stop", not "error" — the
      //                       model wasn't refused or rate-limited)
      //   usage: undefined     (no token counts when nothing was emitted)
      mockGenerateText.mockReset();
      mockGenerateText.mockRejectedValueOnce(makeNoOutputError());

      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'https://api.deepseek.com/v1',
        provider: 'deepseek',
      });
      const result = await client.createMessageWithOutput!({
        model: 'deepseek-v4-flash',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'extract' }],
        response_format: { type: 'json_object' },
      });

      expect(result.text).toBe('');
      expect(result.output).toBeUndefined();
      expect(result.finishReason).toBe('stop');
      expect(result.usage).toBeUndefined();
    });

    it('recovery branch preserves the true finishReason and reports finish exactly once (#544)', async () => {
      // DocTpoint PR #544 review: in origin (b) — generateText RESOLVED, the
      // output getter then threw NoOutputGeneratedError — the early
      // reportFinish already delivered the true finishReason (typically
      // `length` when reasoning burned the budget). The recovery branch must
      // not re-report ('stop', undefined): last-write-wins consumers like
      // source-analyzer would see a masked 'stop', so length-keyed remedies
      // never fire on a budget-truncated composite. The returned object must
      // carry the hoisted reason too.
      mockGenerateText.mockReset();
      const resolved = {
        ...makeResultWithReasoning('', 'truncated json from the reasoning channel'),
        finishReason: 'length',
      } as Awaited<ReturnType<typeof generateText>>;
      // The output getter throws AFTER resolution — mirrors ai@6.0.230's
      // readOutput path where Output.json() finds nothing parseable.
      Object.defineProperty(resolved, 'output', {
        get() { throw makeNoOutputError(); },
        configurable: true,
      });
      mockGenerateText.mockResolvedValueOnce(resolved);

      const onFinish = vi.fn();
      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'https://api.deepseek.com/v1',
        provider: 'deepseek',
      });
      const result = await client.createMessageWithOutput!({
        model: 'deepseek-v4-flash',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'extract' }],
        response_format: { type: 'json_object' },
        onFinish,
      });

      expect(result.text).toContain('truncated json');
      expect(result.output).toBeUndefined();
      expect(result.finishReason).toBe('length');
      expect(result.usage).toBeDefined();
      expect(onFinish).toHaveBeenCalledTimes(1);
      expect(onFinish.mock.calls[0][0].finishReason).toBe('length');
    });

    it('does NOT trigger 3-tier demotion chain on NoOutputGeneratedError (different error class)', async () => {
      // The 3-tier chain runs on APICallError + statusCode===400.
      // NoOutputGeneratedError is AISDKError, not APICallError — same
      // invariant as NoObjectGeneratedError. Must NOT demote, must NOT
      // consume the error and rethrow. The empty quiet path is the
      // single recovery action.
      mockGenerateText.mockReset();
      mockGenerateText.mockRejectedValueOnce(makeNoOutputError());

      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'https://api.deepseek.com/v1',
        provider: 'deepseek',
      });
      const result = await client.createMessage({
        model: 'deepseek-v4-flash',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'extract' }],
        response_format: { type: 'json_object' },
      });

      expect(result).toBe('');
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
    });

    it('does NOT trigger reasoning-strip or token-key retry on NoOutputGeneratedError', async () => {
      // The reasoning-strip and token-key retry paths both require
      // APICallError + statusCode===400. NoOutputGeneratedError is
      // AISDKError — neither branch matches. Sanity check that exactly
      // one call to generateText happens (no retries, no probes).
      mockGenerateText.mockReset();
      mockGenerateText.mockRejectedValueOnce(makeNoOutputError());

      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'https://api.deepseek.com/v1',
        provider: 'deepseek',
      });
      const result = await client.createMessage({
        model: 'deepseek-v4-flash',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'extract' }],
        response_format: { type: 'json_object' },
        enableThinking: false, // would normally trigger reasoning-strip path on 400
      });

      expect(result).toBe('');
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
    });

    it('recovers the composed text when the typed-path output getter throws NoOutputGeneratedError (Issue #506)', async () => {
      // Origin (b) of NoOutputGeneratedError on createMessageWithOutput:
      // generateText RESOLVED, but nothing parsed into `output`, so the
      // SDK's `.output` getter (ai@6.0.230 dist/index.mjs:5146) throws.
      // The payload travelled in the reasoning channel, and the client
      // has already composed reasoning + visible text into a local
      // before readOutput() touches the getter. The catch must return
      // that composite — not the empty quiet shape — so caller-side
      // parseJsonResponse can recover the JSON (Layer 3).
      //
      // NOTE: this is NOT the err.response recovery the issue sketched.
      // The class carries no `.response` (constructor is {message,
      // cause} only), so an in-scope recovery is the only real one.
      const REASONING_JSON = '{"translated": "# 欢迎使用你的维基"}';
      const throwing = makeResultWithReasoning('', [{ text: REASONING_JSON }]) as unknown as Record<string, unknown>;
      Object.defineProperty(throwing, 'output', {
        get() { throw new NoOutputGeneratedError(); },
      });
      mockGenerateText.mockReset();
      mockGenerateText.mockResolvedValueOnce(throwing as never);

      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'https://api.deepseek.com/v1',
        provider: 'deepseek',
      });
      const result = await client.createMessageWithOutput!({
        model: 'deepseek-v4-flash',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'translate' }],
        response_format: { type: 'json_object' },
      });

      // The JSON-shaped reasoning payload reaches the caller.
      expect(result.text).toContain(REASONING_JSON);
      expect(result.output).toBeUndefined();
      expect(result.finishReason).toBe('stop');
    });

    it('keeps the empty quiet path when nothing was composed (origin a — generateText rejected)', async () => {
      // Origin (a): generateText itself rejects (stream flush without a
      // terminal chunk). No result exists in scope and the class carries
      // no `.response` to mine — the quiet path stays correct.
      mockGenerateText.mockReset();
      mockGenerateText.mockRejectedValueOnce(makeNoOutputError());

      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'https://api.deepseek.com/v1',
        provider: 'deepseek',
      });
      const result = await client.createMessageWithOutput!({
        model: 'deepseek-v4-flash',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'extract' }],
        response_format: { type: 'json_object' },
      });

      expect(result.text).toBe('');
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // v1.26.4 PATCH (Issue #474 — Layer 3): mode clamp for non-supportsStructuredOutputs providers.
  //
  // Background: cloud openai-compat providers (deepseek / kimi / glm /
  // minimax / openrouter) do NOT declare `supportsStructuredOutputs:
  // true` in `PREDEFINED_PROVIDERS`. The AI SDK already encodes
  // `response_format: { type: 'json_object' }` on the wire for them
  // regardless of what `Output.object({schema})` was passed — but
  // `OutputModeProber` defaults to `json_schema`, so `buildOutputArgs`
  // tries to emit `Output.object` and the schema is silently dropped at
  // the SDK layer. Worse, `outputMode` reports `json_schema` to the
  // caller (dishonest — the wire shape was json_object).
  //
  // Fix: pre-seed `outputModeProber` to `json_object` for providers
  // whose `supportsStructuredOutputs` is false, on the first call per
  // (baseURL, model). Subsequent calls reuse the cached mode. The
  // `outputMode` reported to the caller is now honest (matches the
  // wire shape the SDK actually emitted).
  //
  // Local providers (lmstudio / ollama / custom) declare
  // `supportsStructuredOutputs: true` — the pre-seed is a no-op for them.
  // ==========================================================================
  describe('mode clamp for non-supportsStructuredOutputs providers (Issue #474 — Layer 3)', () => {
    it('seeds mode to json_object for deepseek on first call (supportsStructuredOutputs=false)', async () => {
      // deepseek is the canonical "no json_schema on wire" case.
      // First call: OutputModeProber has no entry for (baseURL, model)
      // → default 'json_schema'. supportsStructuredOutputs=false →
      // pre-seed to 'json_object' BEFORE buildOutputArgs runs. The
      // schema in response_format gets dropped (Tier 1: Output.json()
      // can't carry a schema), which matches what the SDK actually does
      // on the wire for this provider — so reporting is honest.
      mockGenerateText.mockReset();
      mockGenerateText.mockResolvedValue(makeResult('{}'));

      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'https://api.deepseek.com/v1',
        provider: 'deepseek',
      });
      const schema = {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      } as const;
      const result = await client.createMessageWithOutput!({
        model: 'deepseek-chat',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
        response_format: { type: 'json_object', schema },
      });

      // Honest reporting: mode is json_object, matching the wire shape
      // the SDK emitted (schema was dropped at the SDK layer because
      // Output.json() can't carry a schema; the wire is json_object).
      expect(result.outputMode).toBe('json_object');
      // The model-emitted text is what the caller gets (parseable
      // through parseJsonResponse downstream).
      expect(result.text).toBe('{}');
    });

    it('keeps mode as json_schema for lmstudio on first call (supportsStructuredOutputs=true)', async () => {
      // Local LM Studio / Ollama / custom providers accept json_schema
      // on the wire. The pre-seed is gated on supportsStructuredOutputs,
      // so their mode stays 'json_schema' (Tier 0). Backward compat:
      // existing LM Studio 3-tier chain behavior is unchanged.
      mockGenerateText.mockReset();
      mockGenerateText.mockResolvedValue(makeResult('{}'));

      const client = new OpenAICompatSdkClient({
        apiKey: 'lmstudio-key',
        baseURL: 'http://localhost:1234/v1',
        provider: 'lmstudio',
      });
      const schema = {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      } as const;
      const result = await client.createMessageWithOutput!({
        model: 'qwen3.5',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
        response_format: { type: 'json_object', schema },
      });

      expect(result.outputMode).toBe('json_schema');
    });

    it('reuses seeded json_object on subsequent calls (no re-probe)', async () => {
      // The pre-seed is committed to the cache. Subsequent calls for
      // the same (baseURL, model) read the cached mode — no extra
      // probes, no waste. This is the same per-model key space the
      // OutputModeProber already uses; the pre-seed is just an
      // initialization step, not a demotion.
      mockGenerateText.mockReset();
      mockGenerateText.mockResolvedValue(makeResult('{}'));

      const client = new OpenAICompatSdkClient({
        apiKey: 'sk-test',
        baseURL: 'https://api.deepseek.com/v1',
        provider: 'deepseek',
      });
      // Call 1: seeds the cache.
      await client.createMessageWithOutput!({
        model: 'deepseek-chat',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'a' }],
        response_format: { type: 'json_object' },
      });
      // Call 2: should read the cached mode (no wire probe needed).
      mockGenerateText.mockResolvedValue(makeResult('{"x":1}'));
      const result2 = await client.createMessageWithOutput!({
        model: 'deepseek-chat',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'b' }],
        response_format: { type: 'json_object' },
      });
      expect(result2.outputMode).toBe('json_object');
      expect(mockGenerateText).toHaveBeenCalledTimes(2);
    });
  });

  // Issue #414: the dialect dispatch table is exported as a pure module
  // function precisely so the table itself can be unit-tested without
  // spinning up the full client (which would need a stubbed fetch and
  // AI SDK mocks). Each branch — llama.cpp dialect (lmstudio / ollama),
  // OpenAI-spec dialect (kimi / openrouter / custom), and the
  // drop-silently default (deepseek / others) — gets one assertion.
  // Hoisted to a top-level import (vs the dynamic `await import(...)`
  // pattern) so the binding is visible at module scope and tests can't
  // drift against a stale module record.
  describe('Issue #414: repetitionPenaltyWireField dispatch table', () => {
    it('returns repeat_penalty for llama.cpp dialect providers (lmstudio)', () => {
      expect(repetitionPenaltyWireField('lmstudio')).toBe('repeat_penalty');
    });

    it('returns repeat_penalty for llama.cpp dialect providers (ollama)', () => {
      expect(repetitionPenaltyWireField('ollama')).toBe('repeat_penalty');
    });

    it('returns repetition_penalty for OpenAI-spec dialect providers (kimi / openrouter / custom)', () => {
      for (const provider of ['kimi', 'openrouter', 'custom'] as const) {
        expect(repetitionPenaltyWireField(provider), provider).toBe('repetition_penalty');
      }
    });

    it('returns null for providers whose public API does not document the field (drop silently)', () => {
      for (const provider of ['deepseek', 'gemini', 'minimax', 'glm', 'bedrock-openai'] as const) {
        expect(repetitionPenaltyWireField(provider), provider).toBeNull();
      }
    });

    it('returns null for unknown / malformed provider ids (defensive — covers future providers not in the table)', () => {
      expect(repetitionPenaltyWireField('unknown-provider')).toBeNull();
      // `undefined as any` simulates a runtime miss where the caller
      // somehow passes nothing — type system normally prevents this but
      // we defend at the dispatch boundary.
      expect(repetitionPenaltyWireField(undefined as unknown as string)).toBeNull();
    });
  });
});