import { describe, it, expect, vi } from 'vitest';
import { OpenAICompatSdkClient } from '../../llm-sdk/openai-compat-sdk-client';
import { FixDeadLinkSchema, type FixDeadLink } from '../../llm-sdk/output-schemas';

// Everything this client adds beyond the standard fields travels as
// `providerOptions`. The AI SDK forwards those to the request body only
// under a key matching the provider's own name, OR through fields declared
// in the SDK's zod schema (`openaiCompatibleLanguageModelChatOptions`,
// @ai-sdk/openai-compatible@2.0.62/dist/index.mjs:322-344).
//
// v1.26.0 Batch 6: `reasoningEffort` IS in the zod schema (line 331:
// `z.string().optional()`) and IS emitted to the wire as `reasoning_effort`
// (line 541). This is the force-disable-thinking mechanism that replaced
// `thinking` + `chat_template_kwargs` from PR #410 (Batch 2), which never
// reached the wire: those two keys are not in the zod schema, and the
// SDK's path-2 passthrough at line 533-534 reads from
// `providerOptions[this.providerOptionsName]` (the provider id —
// `deepseek` / `kimi` / `lmstudio` / etc.), not the hardcoded
// `"openaiCompatible"` key that buildProviderOptions returns under.
// None of the 15 provider ids in `types.ts` is literally
// `"openai-compatible"`, so the lookup misses for every provider and the
// extras never spread into the body. DocTpoint verified via
// fetch-interceptor on LM Studio / gemma-4-12b (Issue #382 comment 3,
// 2026-08-04 — supersedes his earlier comment 2, which attributed the
// no-op to a `filter()` "delete" — the filter is a passthrough, the
// real reason is the key mismatch).
describe('OpenAICompatSdkClient — what reaches the request body', () => {
  it('carries reasoning_effort="none" + the seed and the sampling knobs', async () => {
    let body: Record<string, unknown> = {};
    const stub = vi.fn(async (_url: string, init?: { body?: unknown }) => {
      body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        id: 'x', object: 'chat.completion', created: 0, model: 'm',
        choices: [{ index: 0, message: { role: 'assistant', content: '{}' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });

    const client = new OpenAICompatSdkClient({
      apiKey: 'k', baseURL: 'http://localhost/v1/', provider: 'custom',
      fetch: stub as never,
    });
    await client.createMessage({
      model: 'm', max_tokens: 100, messages: [{ role: 'user', content: 'hi' }],
      enableThinking: false, seed: 42, repetition_penalty: 1.05, top_p: 0.8,
      // Asked for on purpose: the assertion below is only worth anything if the
      // caller requests the field. Without it the test passes whether the
      // client withholds `response_format` or has stopped building any
      // provider options at all.
      response_format: { type: 'json_object' },
    });

    // What travels: standard `generateText` arguments, which the SDK maps
    // itself and which never depended on the providerOptions key.
    expect(body).toHaveProperty('seed', 42);
    expect(body).toHaveProperty('top_p', 0.8);

    // v1.26.0 Batch 6: the force-disable-thinking field IS on the wire.
    // `reasoningEffort` (camelCase) is in the zod schema and the SDK
    // emits it as `reasoning_effort` (snake_case). Backends that honor
    // the field (DeepSeek V3/V3.1/V4, Kimi k2.5/2.6, GLM-4.6, LM Studio
    // per DocTpoint's measurement) will turn reasoning off.
    expect(body).toHaveProperty('reasoning_effort', 'none');

    // Issue #414 (v1.26.3 PATCH): the per-id provider key fix flips this
    // assertion. `repetition_penalty` (or its llama.cpp dialect
    // `repeat_penalty`) IS expected on the wire for the providers whose
    // APIs accept the field — see the dialect tests further down for the
    // per-provider spelling. The 'thinking' + 'chat_template_kwargs'
    // pair stays absent (those were stripped by the SDK zod filter and
    // remain so after this fix — see buildProviderOptions in
    // openai-compat-sdk-client.ts:1132-1156).
    //
    // For `provider: 'custom'`, `repetition_penalty` IS on the wire
    // (per the dialect dispatch — `custom` maps to `repetition_penalty`,
    // NOT `repeat_penalty`). The llama.cpp spelling `repeat_penalty`
    // must still be absent. This catches a future regression where a
    // contributor adds both keys for the same provider (cross-dialect
    // leak).
    expect(Object.keys(body)).not.toContain('thinking');
    expect(Object.keys(body)).not.toContain('chat_template_kwargs');
    expect(Object.keys(body)).not.toContain('repeat_penalty');

    // v1.26.3 PATCH follow-up (Issue #443 elegant fallback): the no-
    // schema case now emits `response_format: { type: 'json_object' }`
    // on the wire. The 6 cloud providers accept it (server-side type
    // hint, reduces parse-failure class). Local-server cohort (LM
    // Studio / Ollama / `custom`) may 400 on the field — handled by
    // the json-object-strip 400-retry at the client level
    // (`json-object-strip-probe.ts`). The `custom` provider used in
    // this test (stubbed fetch returning 200 OK) accepts the field
    // and the wire assertion is the elgant-fallback contract: the
    // field IS present on the wire for non-rejecting backends.
    //
    // (DocTpoint's 2026-08-09 LM Studio / gemma-4-12b measurement
    //  is the gate for the strip fallback: `json_object` answers HTTP
    //  400 in 29 ms — `'response_format.type' must be 'json_schema' or
    //  'text'`. Same measurement is cited in the schema-arm tests
    //  below as the gate: `json_schema` answers 200 in 356 ms.)
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  // v1.26.3 PATCH follow-up (Issue #443 elegant fallback):
  // No-schema case now emits `{type:'json_object'}` on the wire for ALL
  // openai-compat providers — the SDK encodes `Output.json()` to that
  // shape automatically (see @ai-sdk/openai-compatible@2.0.62/dist/index.mjs
  // :520-528, the `Output.json()` arm). The 6 cloud providers (deepseek /
  // openrouter / kimi / glm / gemini / minimax) accept this — the
  // server-side type hint reduces parse-failure class of issues
  // (DocTpoint Issue #443). Local servers (lmstudio / ollama / custom)
  // may 400 on `json_object` (LM Studio is the measured case, Issue
  // #443 comment 1, 2026-08-09) — handled by a runtime 400-strip
  // fallback at the SDK client level (json-object-strip-probe.ts, with
  // per-baseURL cache so the cost is one 400 per unique baseURL).
  // This test pins the wire shape: NO provider hardcoding in the
  // client; the same `Output.json()` call goes to all 9 providers.
  it('emits response_format:json_object on the wire for ALL openai-compat providers (no-schema case)', async () => {
    const validResponse = (): Response => new Response(JSON.stringify({
      id: 'x', object: 'chat.completion', created: 0, model: 'm',
      choices: [{ index: 0, message: { role: 'assistant', content: '{}' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });

    for (const provider of [
      'gemini', 'openrouter', 'deepseek', 'kimi', 'glm', 'minimax',
      'ollama', 'lmstudio', 'custom',
    ] as const) {
      let body: Record<string, unknown> = {};
      const stub = vi.fn(async (_url: string, init?: { body?: unknown }) => {
        body = JSON.parse(String(init?.body));
        return validResponse();
      });
      const client = new OpenAICompatSdkClient({
        apiKey: 'k', baseURL: `http://localhost/v1/`, provider,
        fetch: stub as never,
      });
      await client.createMessage({
        model: 'm', max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
        response_format: { type: 'json_object' },
      });
      // Every openai-compat provider gets the same `Output.json()` →
      // `json_object` wire shape. The runtime 400-strip fallback
      // (json-object-strip-probe.ts) handles backends that reject this
      // (LM Studio is the measured case). The test is server-agnostic:
      // it pins the wire shape the SDK ACTUALLY SENDS, before any
      // fallback decision.
      expect(body.response_format, `provider=${provider}`).toEqual({ type: 'json_object' });
    }
  });

  // v1.26.3 PATCH follow-up (Issue #443): sanity check that the wire
  // shape survives the 4 retry paths. Each retry path spreads
  // `outputArgs` (the helper's return value) into its generateText
  // call. The current implementation only exercises the initial path
  // above; this test pins that the URL-fallback / reasoning-strip /
  // token-key retry paths all carry `response_format: json_object` on
  // the wire when the caller's `response_format` is set.
  it('emits response_format:json_object in the URL-fallback retry path', async () => {
    let body: Record<string, unknown> = {};
    const stub = vi.fn(async (_url: string, init?: { body?: unknown }) => {
      body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        id: 'x', object: 'chat.completion', created: 0, model: 'm',
        choices: [{ index: 0, message: { role: 'assistant', content: '{}' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const client = new OpenAICompatSdkClient({
      apiKey: 'k', baseURL: 'http://localhost/v1/', provider: 'custom',
      fetch: stub as never,
    });
    await client.createMessage({
      model: 'm', max_tokens: 100, messages: [{ role: 'user', content: 'hi' }],
      response_format: { type: 'json_object' },
    });
    expect(body.response_format).toEqual({ type: 'json_object' });
    // Also assert that NO json_schema encoding happens (no schema was
    // supplied) — `json_object` is the no-schema wire shape.
    expect(body.response_format).not.toEqual(expect.objectContaining({ type: 'json_schema' }));
  });
});

// v1.26.3 PATCH pilot — Issue #443.
//
// The compat SDK client currently drops `response_format` before the wire
// (destructure list at openai-compat-sdk-client.ts:154 does not include
// it). The 16 call sites in source-analyzer / conversation-ingest / lint /
// query that ask for `json_object` therefore get no server-side JSON
// constraint on openai-compat providers — backends like LM Studio / Ollama
// reject the absence too, so a passing prompt-only result depends on the
// model following the prompt without help.
//
// The fix has two halves. (1) The compat provider is created with
// `supportsStructuredOutputs: true` for the providers whose servers
// accept `json_schema` (LM Studio, Ollama with the right build, custom
// self-hosted). (2) When the caller passes a `schema` on `response_format`
// and the provider is in the supportsStructuredOutputs set, the SDK
// emits `response_format: { type: 'json_schema', json_schema: { ... } }`
// on the wire (via the AI SDK's own `responseFormat: { type: 'json',
// schema }` path, which the compat provider turns into json_schema when
// supportsStructuredOutputs=true). Without a schema, the SDK falls back
// to `json_object` — same shape the call sites had before, and
// acceptable for OpenAI / Anthropic / cloud providers that already
// accept `json_object`.
//
// The pilot: ONE call site (path-resolution.ts:217) passes a schema; the
// other 15 stay on plain `json_object` until the pilot validates. If the
// wire-body tests below pass and Gate 1 is green, the design is proven
// and the remaining 15 sites can be ported one PR at a time per the
// CLAUDE.md "one PR per call site" rule for #407 Stages 1+2.
describe('OpenAICompatSdkClient — Issue #443 pilot: schema emits json_schema on the wire', () => {
  const validResponse = (): Response => new Response(JSON.stringify({
    id: 'x', object: 'chat.completion', created: 0, model: 'm',
    choices: [{ index: 0, message: { role: 'assistant', content: '{}' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  }), { status: 200, headers: { 'content-type': 'application/json' } });

  // Reads the request body the compat SDK actually sent. Returns a parsed
  // object so each assertion can pattern-match against the wire shape.
  async function captureBody(provider: string): Promise<Record<string, unknown>> {
    let body: Record<string, unknown> = {};
    const stub = vi.fn(async (_url: string, init?: { body?: unknown }) => {
      // Guard: the AI SDK's compat provider stringifies chat-completions
      // bodies. If a future SDK version shipped a binary / streamed
      // encoding, `String(<any non-string>)` would silently coerce to
      // `"[object Object]"` / `"<Buffer ...>"` and JSON.parse would
      // throw with a cryptic message that hides the regression. Assert
      // the contract up-front so the next regression surfaces as a
      // "wrong body type" error, not a parse error.
      if (typeof init?.body !== 'string') {
        throw new Error(`expected body to be a string, got ${typeof init?.body}`);
      }
      body = JSON.parse(init.body);
      return validResponse();
    });
    const client = new OpenAICompatSdkClient({
      apiKey: 'k', baseURL: 'http://localhost/v1/', provider,
      fetch: stub as never,
    });
    await client.createMessage({
      model: 'm', max_tokens: 100,
      messages: [{ role: 'user', content: 'hi' }],
      response_format: {
        type: 'json_object',
        schema: { type: 'object', properties: { match: { type: 'boolean' } } },
      },
    });
    return body;
  }

  // The 3 providers whose `PREDEFINED_PROVIDERS[provider].supportsStructuredOutputs`
  // is true. Each should produce `json_schema` on the wire when a schema
  // is supplied (the AI SDK's compat provider reads that flag and
  // encodes the schema-bearing form on `response_format`). LM Studio
  // gets the full strict-match assertion because it is the canonical
  // Issue #443 root-cause case; the other two are toMatchObject
  // because the AI SDK's `name` / `strict` field order is not
  // contractually pinned.
  it.each([
    'lmstudio',
    'ollama',
    'custom',
  ] as const)('emits json_schema on the wire for provider:%s when a schema is supplied', async (provider) => {
    const body = await captureBody(provider);
    if (provider === 'lmstudio') {
      expect(body.response_format).toEqual({
        type: 'json_schema',
        json_schema: expect.objectContaining({
          schema: expect.objectContaining({ type: 'object' }),
          strict: true,
          name: 'response',
        }),
      });
    } else {
      expect(body.response_format).toMatchObject({ type: 'json_schema' });
    }
  });

  it('emits response_format:json_object on the wire for lmstudio (no-schema case) — server-side 400 handled by json-object-strip 400-retry', async () => {
    let body: Record<string, unknown> = {};
    const stub = vi.fn(async (_url: string, init?: { body?: unknown }) => {
      body = JSON.parse(String(init?.body));
      return validResponse();
    });
    const client = new OpenAICompatSdkClient({
      apiKey: 'k', baseURL: 'http://localhost/v1/', provider: 'lmstudio',
      fetch: stub as never,
    });
    await client.createMessage({
      model: 'm', max_tokens: 100,
      messages: [{ role: 'user', content: 'hi' }],
      response_format: { type: 'json_object' },
    });
    // v1.26.3 PATCH follow-up (Issue #443 elegant fallback):
    // No-schema case emits `response_format: { type: 'json_object' }`
    // on the wire for every openai-compat provider — same as the 6
    // cloud providers. The SDK encodes `Output.json()` to that shape
    // uniformly (no per-provider branching in the helper).
    //
    // If the test stub were a real LM Studio server (which 400s on
    // `json_object` per DocTpoint Issue #443 comment 1, 2026-08-09),
    // the json-object-strip 400-retry at the client level would fire
    // and the second attempt would omit `output` entirely. The
    // fallback scenarios are pinned in
    // `openai-compat-sdk-client.test.ts:json-object-strip 400-retry`
    // — this test only pins the wire shape on the FIRST call (before
    // any fallback decision).
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  // Sanity guard: the supportsStructuredOutputs flag is for the local-
  // server cohort (lmstudio / ollama / custom) only. The cloud compat
  // providers (openrouter / deepseek / kimi / glm / gemini / minimax)
  // keep `supportsStructuredOutputs: false`. When a schema is supplied
  // but the flag is false, the AI SDK encoder at
  // @ai-sdk/openai-compatible@2.0.62/dist/index.mjs:520-528 emits
  // `{ type: 'json_object' }` on the wire (fallback) AND pushes a
  // warning to `result.warnings`. The schema is silently dropped — not
  // the constraint #443 asks for (the SDK can't encode it without
  // the flag). The per-caller migration PR (one per site, gated on
  // #443's pilot validating in production) must also flip
  // `supportsStructuredOutputs` for that provider — separate PR.
  it.each([
    'openrouter',
    'deepseek',
    'kimi',
    'glm',
    'gemini',
    'minimax',
  ] as const)('falls back to json_object for cloud compat provider:%s when caller supplies a schema (flag is the open question for the per-caller migration PR)', async (provider) => {
    const body = await captureBody(provider);
    expect(body.response_format, `${provider} without supportsStructuredOutputs=true emits json_object, NOT json_schema — flip the flag in the per-caller migration PR`).toEqual({ type: 'json_object' });
  });
});

// Issue #414: `repetitionPenalty` user setting is a silent no-op on every
// shipped provider today (verified 2026-08-12). Pre-fix root cause:
// `buildProviderOptions` returned `{ openaiCompatible: openaiOpts }`, but the
// AI SDK's passthrough at `@ai-sdk/openai-compatible@2.0.62/dist/index.mjs:525-540`
// reads `providerOptions[this.providerOptionsName]` (the provider id —
// `lmstudio` / `deepseek` / etc.), so the field never reached the wire.
//
// Fix in `openai-compat-sdk-client.ts`: switch the return key to
// `this.provider`, add a per-provider spelling dispatch for `repetitionPenalty`
// (llama.cpp / Ollama accept `repeat_penalty` — no `-ion`; Kimi / OpenRouter
// / vLLM accept the OpenAI-spec `repetition_penalty`; Anthropic / DeepSeek /
// OpenAI don't accept either). Dialect evidence: DocTpoint's #414 comment
// (2026-08-07) type-error test on LM Studio / gemma-4-12b (server returns
// HTTP 400 for `repeat_penalty: "abc"`, HTTP 200 for `repetition_penalty: "abc"`).
describe('OpenAICompatSdkClient — Issue #414: repetitionPenalty dialect dispatch', () => {
  const validResponse = (): Response => new Response(JSON.stringify({
    id: 'x', object: 'chat.completion', created: 0, model: 'm',
    choices: [{ index: 0, message: { role: 'assistant', content: '{}' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  }), { status: 200, headers: { 'content-type': 'application/json' } });

  async function captureBody(provider: string, repetitionPenalty: number | null = 1.5): Promise<Record<string, unknown>> {
    let body: Record<string, unknown> = {};
    const stub = vi.fn(async (_url: string, init?: { body?: unknown }) => {
      body = JSON.parse(String(init?.body));
      return validResponse();
    });
    const client = new OpenAICompatSdkClient({
      apiKey: 'k', baseURL: 'http://localhost/v1/', provider,
      fetch: stub as never,
    });
    await client.createMessage({
      model: 'm', max_tokens: 100,
      messages: [{ role: 'user', content: 'hi' }],
      ...(repetitionPenalty !== null ? { repetition_penalty: repetitionPenalty } : {}),
    });
    return body;
  }

  // The dialect map:
  //   lmstudio, ollama  -> repeat_penalty   (no `-ion`; llama.cpp dialect)
  //   kimi, openrouter  -> repetition_penalty (OpenAI-spec name, accepted)
  //   custom            -> repetition_penalty (vLLM / OpenAI-spec default)
  //   deepseek          -> (drop; DeepSeek API docs do not list the field)
  // Each branch is its own test so a future regression in one dialect
  // surfaces as a single named failure rather than a batch-skipped
  // describe block.
  it('lmstudio: emits repeat_penalty (no -ion, llama.cpp dialect)', async () => {
    const body = await captureBody('lmstudio');
    expect(body.repeat_penalty).toBe(1.5);
    expect(Object.keys(body)).not.toContain('repetition_penalty');
  });

  it('ollama: emits repeat_penalty (Ollama-native name)', async () => {
    const body = await captureBody('ollama');
    expect(body.repeat_penalty).toBe(1.5);
    expect(Object.keys(body)).not.toContain('repetition_penalty');
  });

  it.each(['kimi', 'openrouter', 'custom'] as const)(
    '%s: emits repetition_penalty (OpenAI-spec name)',
    async (provider) => {
      const body = await captureBody(provider);
      expect(body.repetition_penalty, `provider=${provider}`).toBe(1.5);
      expect(Object.keys(body), `provider=${provider}`).not.toContain('repeat_penalty');
    },
  );

  it('deepseek: omits the field (DeepSeek API does not support it)', async () => {
    const body = await captureBody('deepseek');
    expect(Object.keys(body)).not.toContain('repeat_penalty');
    expect(Object.keys(body)).not.toContain('repetition_penalty');
  });

  it('omits the field when repetition_penalty is not passed', async () => {
    // Pass `null` (not `undefined`) so the default parameter doesn't
    // kick in — caller wants to verify the "field omitted" branch.
    const body = await captureBody('lmstudio', null);
    expect(Object.keys(body)).not.toContain('repeat_penalty');
    expect(Object.keys(body)).not.toContain('repetition_penalty');
  });

  // Boundary value tests (Issue #414 / code-review finding 2a): the
  // client does NOT transform `repetition_penalty` — values are passed
  // through verbatim to the wire (the backend's responsibility is
  // clamping / interpretation, not ours). These tests pin that
  // contract so a future contributor adding a "clamp for safety" code
  // path would surface as a single-named test failure.
  describe('boundary values pass through verbatim (no client-side transformation)', () => {
    it('repetition_penalty: 0 — emits repeat_penalty: 0 (lmstudio)', async () => {
      const body = await captureBody('lmstudio', 0);
      expect(body.repeat_penalty).toBe(0);
    });
    it('repetition_penalty: 1 — emits repeat_penalty: 1 (lmstudio, "no effect")', async () => {
      const body = await captureBody('lmstudio', 1);
      expect(body.repeat_penalty).toBe(1);
    });
    it('repetition_penalty: 0.5 (<1) — emits repeat_penalty: 0.5 (unusual but valid)', async () => {
      const body = await captureBody('lmstudio', 0.5);
      expect(body.repeat_penalty).toBe(0.5);
    });
  });
});

// Issue #658: a strict OpenAI-compatible endpoint rejected `FixDeadLinkSchema`
// because `required` did not list its four optional properties
// (`'required' is required to be supplied and to be an array including every
// key in properties. Missing 'action'`). The strict dialect is a negotiated
// tier: the plain body goes first (unchanged for every backend that accepts
// it — LM Studio measured), the strict rewrite is sent after that 400 and
// remembered per (baseURL, model). These tests read what the SDK actually
// sends and what the caller actually receives.
describe('OpenAICompatSdkClient — Issue #658: strict schema dialect as a negotiated tier', () => {
  const STRICT_REJECTION = `Invalid schema for response_format 'response': In context=(), 'required' is required to be supplied and to be an array including every key in properties. Missing 'action'.`;

  const respond = (content: string): Response => new Response(JSON.stringify({
    id: 'x', object: 'chat.completion', created: 0, model: 'm',
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
  const reject400 = (message: string): Response => new Response(JSON.stringify({ error: { message } }), { status: 400, headers: { 'content-type': 'application/json' } });

  type Body = Record<string, unknown>;
  const schemaOf = (body: Body): Record<string, unknown> =>
    (body.response_format as { json_schema: { schema: Record<string, unknown> } }).json_schema.schema;

  /** A client whose fetch answers from a script of responses and records every request body. */
  function scripted(provider: string, script: Array<() => Response>) {
    const bodies: Body[] = [];
    const stub = vi.fn(async (_url: string, init?: { body?: unknown }) => {
      bodies.push(JSON.parse(String(init?.body)));
      const next = script.shift();
      if (!next) throw new Error('script exhausted');
      return next();
    });
    const client = new OpenAICompatSdkClient({
      apiKey: 'k', baseURL: 'http://localhost/v1/', provider,
      fetch: stub as never,
    });
    const call = () => client.createMessageWithOutput<FixDeadLink>({
      model: 'm', max_tokens: 100,
      messages: [{ role: 'user', content: 'hi' }],
      response_format: { type: 'json_object', schema: FixDeadLinkSchema },
    });
    return { bodies, call };
  }

  const STRICT_BODY = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    additionalProperties: false,
    properties: {
      action: { type: ['string', 'null'] },
      correct_link: { type: ['string', 'null'] },
      stub_title: { type: ['string', 'null'] },
      stub_type: { type: ['string', 'null'] },
    },
    required: ['action', 'correct_link', 'stub_title', 'stub_type'],
    type: 'object',
  };

  it('LM Studio: the first body is the plain adapter body, unchanged (optionals not required)', async () => {
    const { bodies, call } = scripted('lmstudio', [() => respond('{"action":"skip"}')]);
    await call();
    expect(bodies).toHaveLength(1);
    const schema = schemaOf(bodies[0]);
    expect(schema.required).toBeUndefined();
    expect(schema.properties).toEqual({
      action: { type: 'string' }, correct_link: { type: 'string' }, stub_title: { type: 'string' }, stub_type: { type: 'string' },
    });
    expect((bodies[0].response_format as { json_schema: { strict: boolean } }).json_schema.strict).toBe(true);
  });

  it('custom strict endpoint: the #658 400 is answered with the strict body, and the caller sees the answer', async () => {
    const { bodies, call } = scripted('custom', [
      () => reject400(STRICT_REJECTION),
      () => respond('{"action":"stub","correct_link":null,"stub_title":"Kreatin","stub_type":"entity"}'),
    ]);
    const result = await call();
    expect(bodies).toHaveLength(2);
    expect(schemaOf(bodies[1])).toEqual(STRICT_BODY);
    expect(result.outputMode).toBe('json_schema_strict');
    expect(result.output).toEqual({ action: 'stub', stub_title: 'Kreatin', stub_type: 'entity' });
  });

  it('the strict tier is remembered: the next call goes strict directly, no second 400', async () => {
    const { bodies, call } = scripted('custom', [
      () => reject400(STRICT_REJECTION),
      () => respond('{"action":"skip","correct_link":null,"stub_title":null,"stub_type":null}'),
      () => respond('{"action":"skip","correct_link":null,"stub_title":null,"stub_type":null}'),
    ]);
    await call();
    const second = await call();
    expect(bodies).toHaveLength(3);
    expect(schemaOf(bodies[2])).toEqual(STRICT_BODY);
    expect(second.output).toEqual({ action: 'skip' });
  });

  it('a backend that rejects json_schema as a field still demotes to json_object, not to strict', async () => {
    const { bodies, call } = scripted('custom', [
      () => reject400("Unsupported parameter: 'response_format.json_schema'"),
      () => respond('{"action":"skip"}'),
    ]);
    const result = await call();
    expect(bodies).toHaveLength(2);
    expect(bodies[1].response_format).toEqual({ type: 'json_object' });
    expect(result.outputMode).toBe('json_object');
  });

  it('the non-typed branch is unchanged: no schema, no dialect, json_object on the wire', async () => {
    let body: Body = {};
    const stub = vi.fn(async (_url: string, init?: { body?: unknown }) => {
      body = JSON.parse(String(init?.body));
      return respond('{}');
    });
    const client = new OpenAICompatSdkClient({
      apiKey: 'k', baseURL: 'http://localhost/v1/', provider: 'custom',
      fetch: stub as never,
    });
    await client.createMessage({
      model: 'm', max_tokens: 100,
      messages: [{ role: 'user', content: 'hi' }],
      response_format: { type: 'json_object' },
    });
    expect(body.response_format).toEqual({ type: 'json_object' });
  });
});
