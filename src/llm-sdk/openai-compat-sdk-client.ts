// v1.23.0 P1-7: OpenAI-compatible provider client backed by Vercel AI-SDK v6.
//
// Replaces the OpenAICompatibleClient's role as the catch-all for any
// non-Anthropic, non-Official-OpenAI provider. Covers 6 baseURLs from
// PREDEFINED_PROVIDERS:
//
//   - gemini:      https://generativelanguage.googleapis.com/v1beta/openai
//   - openrouter:  https://openrouter.ai/api/v1
//   - deepseek:    https://api.deepseek.com/v1
//   - minimaxi:    https://api.minimaxi.com/v1
//   - moonshot:    https://api.moonshot.cn/v1
//   - glm:         https://open.bigmodel.cn/api/paas/v4
//   - ollama:      http://localhost:11434/v1
//   - lmstudio:    http://localhost:1234/v1
//
// Architecture: thin wrapper around `@ai-sdk/openai-compatible`'s
// `createOpenAICompatible`. Per-baseURL `providerOptions` (e.g.
// `supportsStructuredOutputs`, `includeUsage`) are set automatically
// based on the `provider` id we pass in.

import { type LanguageModel, APICallError, NoObjectGeneratedError, NoOutputGeneratedError } from 'ai';
import type { z } from 'zod';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import {
  LLMClient,
  PREDEFINED_PROVIDERS,
  type LLMFinishReason,
  type LLMFinishMeta,
  type LLMUsage,
  type LLMMessage,
} from '../types';
import { obsidianFetchBridge, streamWithFallback } from '../core/obsidian-fetch-bridge';
import { mapAiSdkError } from './openai-sdk-client';
import {
  getCachedUrl,
  resolveBaseUrlWithFallback,
  isUrlError,
} from '../core/url-fallback';
import { TokenKeyProber } from './token-key-probe';
import { ReasoningStripProber } from './reasoning-strip-probe';
import { OutputModeProber, type OutputMode } from './output-mode-prober';
import { assertNotReasoningOnly, isReasoningRunaway, normalizeUsage, reportFinish, extractReasoningText } from './finish-reason';
import { buildSamplingArgs } from './sampling-args';
import { buildOutputArgs } from './output-args';
import { JSON_ENFORCEMENT_SYSTEM_PREFIX, forcedTextPromptSystem } from './json-prompt-prefix';
import { prependReasoningForParse, wrapReasoningContent } from '../core/markdown';
import { isPlaceholderJsonText } from '../core/json';

export interface OpenAICompatSdkClientOptions {
  apiKey: string;
  baseURL: string;
  /** Provider id used as the `name` (e.g. 'gemini', 'openrouter'). */
  provider: string;
  /** Override non-streaming fetch (used in tests). */
  fetch?: typeof obsidianFetchBridge;
  /** Override streaming fetch (default: streamWithFallback). */
  streamFetch?: typeof streamWithFallback;
}

// Issue #414 wire-field dialect lives in core (shared with the error-hint
// helper, which must not name a setting that never reaches the wire). Re-export
// here to keep the existing test import (`from openai-compat-sdk-client`)
// unchanged.
import { repetitionPenaltyWireField } from '../core/repetition-penalty-dialect';
export { repetitionPenaltyWireField };

/**
 * Read the SDK's parsed output, or `undefined` when there is none to read.
 *
 * `generateText`'s `output` is a getter that throws `NoOutputGeneratedError`
 * whenever no output specification was passed (`ai@6.0.230/dist/index.mjs`
 * line 5146). At the `text_prompt` tier `buildOutputArgs` deliberately passes
 * none — the JSON shape comes from the prompt — so every plain
 * `result.output` read at that tier throws, whatever the model returned.
 *
 * Today the tier is only reachable through a 400-driven demotion, where the
 * throw lands in the surrounding catch-all and reads as a failed retry. The
 * #470 guard below has to work on exactly that tier, so it cannot touch the
 * getter directly.
 */
function readOutput<T>(result: { output?: unknown }, mode: OutputMode): T | undefined {
  if (mode === 'text_prompt') return undefined;
  return result.output as T | undefined;
}

export class OpenAICompatSdkClient implements LLMClient {
  private readonly apiKey: string;
  private readonly baseURL: string;
  private readonly provider: string;
  private readonly fetchImpl: typeof obsidianFetchBridge;
  private readonly streamFetchImpl: typeof streamWithFallback;
  /**
   * v1.23.0 P1.5 follow-up: runtime probe-then-cache for token-key
   * preference (max_tokens vs max_completion_tokens). Owned per client
   * so cache lifetime == client lifetime. When the user changes baseURL
   * or API key in settings, a new client is constructed and probing
   * starts fresh.
   */
  private readonly tokenKeyProber = new TokenKeyProber();

  /**
   * v1.26.0 Batch 6: Layer-3 fallback cache. Some openai-compat
   * backends (Gemini-via-shim per #137) reject `reasoning_effort: 'none'`
   * with HTTP 400. On 400 with a reasoning-related field name in the
   * error message, we strip the field and retry exactly once; the
   * strip decision is cached per (baseURL, model) so subsequent calls skip
   * the probe. Mirrors the [[TokenKeyProber]] design.
   */
  private readonly reasoningStripProber = new ReasoningStripProber();

  /**
   * v1.26.3 PATCH Phase A2 — 3-tier output-mode state machine
   * (replaces the v1.26.2 JsonObjectStripProber). Per-baseURL cache
   * stores the strongest mode the backend accepts (default =
   * 'json_schema'). On 400 with a structured-output rejection, the
   * catch-block demotes one tier and retries; the demotion is
   * committed to the cache AFTER the retry succeeds. See
   * [[OutputModeProber]] for the tier ordering and classifier
   * contract.
   */
  private readonly outputModeProber = new OutputModeProber();

  /**
   * v1.26.3 PATCH (Issue #443): whether the openai-compat SDK provider
   * should be created with `supportsStructuredOutputs: true`. Reads
   * from `PREDEFINED_PROVIDERS` (the canonical per-provider config
   * table at `src/types.ts`) so adding a new compat provider that
   * accepts `json_schema` is a one-field config change instead of
   * editing the SDK client. Local servers (LM Studio / Ollama /
   * self-hosted `custom`) accept this form; cloud compat servers
   * (openrouter / deepseek / kimi / glm) accept `json_object` and
   * do NOT receive `json_schema` (they may 400 on it). The openai /
   * anthropic / codex paths go through their own SDK clients and
   * are unaffected by this flag.
   */
  private readonly supportsStructuredOutputs: boolean;

  /**
   * Issue #414: per-provider wire-field spelling for `repetitionPenalty`.
   * Computed once in the constructor — `this.provider` is immutable per
   * client, so the lookup runs at most once per client lifetime (vs
   * once per LLM call if the helper were re-evaluated on each
   * `buildProviderOptions`). `null` means "drop silently" (DeepSeek /
   * Gemini / MiniMax / GLM — providers whose public API does not
   * document `repetition_penalty`).
   */
  private readonly repetitionPenaltyWireField: 'repeat_penalty' | 'repetition_penalty' | null;

  constructor(opts: OpenAICompatSdkClientOptions) {
    this.apiKey = opts.apiKey;
    this.baseURL = opts.baseURL;
    this.provider = opts.provider;
    this.fetchImpl = opts.fetch ?? obsidianFetchBridge;
    this.streamFetchImpl = opts.streamFetch ?? streamWithFallback;
    this.supportsStructuredOutputs
      = PREDEFINED_PROVIDERS[opts.provider]?.supportsStructuredOutputs ?? false;
    this.repetitionPenaltyWireField = repetitionPenaltyWireField(opts.provider);
  }

  /**
   * v1.26.4 PATCH (Issue #474 — Layer 3): pre-seed OutputModeProber on
   * the first call for a (baseURL, model) pair. For providers whose
   * `supportsStructuredOutputs` flag is false (deepseek / kimi / glm /
   * minimax / openrouter — cloud openai-compat backends), the SDK
   * encodes `response_format: { type: 'json_object' }` on the wire
   * regardless of whether we passed `Output.object({schema})` — the
   * schema is silently dropped at the SDK layer. Without the pre-seed,
   * `outputMode` reports `json_schema` (dishonest — the wire shape was
   * json_object) and a 400 on the first call would waste a demotion
   * cycle going `json_schema → json_object` that the SDK would have
   * already done on its own.
   *
   * The pre-seed commits the cache with the value the wire actually
   * used. Subsequent calls reuse the cached mode (no extra probes).
   * Cache write happens here — not in the 400-retry catch chain —
   * because the prober's success-only demotion policy is for
   * 400-driven demotions. This is initialization, not demotion.
   *
   * For providers with `supportsStructuredOutputs: true` (lmstudio /
   * ollama / custom), the cached default of `json_schema` is kept and
   * the existing 3-tier chain handles rejections.
   */
  private getCurrentOutputMode(model: string): OutputMode {
    const cached = this.outputModeProber.getMode(this.baseURL, model);
    if (cached === 'json_schema' && !this.supportsStructuredOutputs) {
      this.outputModeProber.markMode(this.baseURL, model, 'json_object');
      return 'json_object';
    }
    return cached;
  }

  /**
   * Build the AI-SDK provider for a given model.
   *
   * `fetchFn` is the fetch adapter. Pass the streaming variant
   * (`streamFetchImpl`) for createMessageStream, the non-stream
   * variant (`fetchImpl`) for createMessage / listModels. When
   * omitted, defaults to streamFetchImpl — both are URL-based and
   * the streamFetchImpl's fallback handles CORS for cloud, so it's
   * safe to use for non-stream too (AI-SDK just doesn't iterate
   * the body stream). However, calling createMessage with
   * streamFetchImpl pulls in a bit more code path; tests that
   * want to mock non-stream fetch pass fetchImpl explicitly.
   */
  private getProvider(modelId: string, fetchFn: typeof obsidianFetchBridge | typeof streamWithFallback = this.streamFetchImpl, baseURLOverride?: string): LanguageModel {
    // v1.23.0 P1.5: baseURLOverride lets the fallback retry path pass a
    // corrected URL (e.g., `/v1` appended for Kimi Coding Plan) without
    // mutating this.baseURL. Cached resolved URLs flow through this.
    const effectiveBaseURL = baseURLOverride ?? getCachedUrl(this.baseURL) ?? this.baseURL;
    const provider = createOpenAICompatible({
      name: this.provider,
      baseURL: effectiveBaseURL,
      apiKey: this.apiKey,
      fetch: (fetchFn ?? this.streamFetchImpl) as unknown as typeof fetch,
      // includeUsage: Some OpenAI-compatible providers (DeepSeek, GLM)
      // don't return usage unless asked. AI-SDK's default is true for
      // OpenAI; we set it explicitly to ensure consistent token tracking.
      includeUsage: true,
      // v1.26.3 PATCH (Issue #443): when true AND a schema is supplied
      // on the call's `response_format`, the SDK encodes
      // `response_format: { type: 'json_schema', json_schema: { ... } }`
      // on the wire. Without a schema, the SDK falls back to
      // `json_object` — same shape the 15 non-pilot call sites
      // produce today. The flag is sourced from
      // `PREDEFINED_PROVIDERS[provider].supportsStructuredOutputs` and
      // cached on the instance in the constructor.
      supportsStructuredOutputs: this.supportsStructuredOutputs,
      // v1.23.0 P1.5 follow-up: token-key probe hook. Read the
      // current cached key for this (baseURL, model) at request time — this
      // closure captures `this` so each request consults the latest
      // probe result. If we have no cached entry, the transform is
      // a no-op and the request goes out with the AI-SDK default
      // (max_tokens). On rejection we probe + cache + next request
      // uses the swapped key.
      transformRequestBody: (args: Record<string, unknown>) => {
        // Issue #551 follow-up: keyed per (baseURL, modelId). The URL-fallback
        // probe uses synthetic 'gpt-4o-mini' (probeBaseURL) — its slot is
        // never populated; no swap applied there (safe — the probe is a
        // separate connectivity check, not a request that needs the token-key fix).
        const cached = this.tokenKeyProber.getCachedKey(this.baseURL, modelId);
        if (!cached) return args;
        if (cached === 'max_tokens') return args;
        // cached === 'max_completion_tokens'
        const body = { ...args };
        if (body.max_tokens !== undefined) {
          body.max_completion_tokens = body.max_tokens;
          delete body.max_tokens;
        }
        return body;
      },
    });
    return provider(modelId);
  }

  /**
   * Probe whether a baseURL works for OpenAI-compatible chat endpoint.
   * Used by the URL fallback to test candidate URLs without committing
   * the original request payload. Sends a minimal 1-token message and
   * treats 404 as "wrong URL" (return false), all other errors as
   * "auth/server error" (throw to propagate).
   */
  private async probeBaseURL(baseURL: string): Promise<boolean> {
    try {
      const languageModel = this.getProvider('gpt-4o-mini', this.fetchImpl, baseURL);
      const { generateText } = await import('ai');
      await generateText({
        model: languageModel,
        messages: [{ role: 'user', content: 'hi' }],
        maxOutputTokens: 1,
      });
      return true;
    } catch (err) {
      if (isUrlError(err)) return false;
      throw err;
    }
  }

  async createMessage(params: LLMClient['createMessage'] extends (p: infer P) => unknown ? P : never): Promise<string> {
    const { model, max_tokens, messages, temperature, top_p, repetition_penalty, seed, enableThinking, reasoningEffort, response_format, outputModeOverride, onFinish, abortSignal } = params;
    // Issue #481: a pinned mode skips the prober for this call. `text_prompt`
    // puts no `response_format` on the wire, so the JSON shape has to come from
    // the prompt — the same prefix the 400-driven demotion adds at retry time,
    // applied up front because there is no retry here.
    const system = forcedTextPromptSystem(params.system, response_format, outputModeOverride);

    // v1.26.3 PATCH (Issue #443): translate the public `response_format`
    // shape into the AI SDK's `output` mechanism via `buildOutputArgs`
    // (see `src/llm-sdk/output-args.ts` for the contract). Build once
    // and spread at every generateText call site below — the URL
    // fallback and reasoning-strip retry paths both reuse the same
    // args. Without this shared object, a future retry path can
    // silently omit `output` and re-introduce the v1.26.1 bug #443
    // is closing.
    //
    // v1.26.3 PATCH follow-up (elegant fallback): if the per-baseURL
    // strip cache says "this backend rejects json_object", skip the
    // helper's `Output.json()` emission entirely — pass `{}` so no
    // `response_format` field reaches the wire. The prober itself is
    // stateless w.r.t. the response_format — the override happens here
    // at the call site: getMode() returns the strongest mode the
    // backend has accepted (default 'json_schema'); buildOutputArgs
    // then dispatches based on the mode.
    //
    // v1.26.3 PATCH Phase A4: the previous 2-tier shouldStrip boolean
    // is gone. The 3-tier mode ('json_schema' / 'json_object' /
    // 'text_prompt') is consulted instead, and the demotion happens in
    // the catch-block below.
    //
    // v1.26.4 PATCH (Issue #474 — Layer 3): use getCurrentOutputMode
    // instead of getMode — the helper pre-seeds the cache to
    // 'json_object' for providers whose supportsStructuredOutputs is
    // false (deepseek / kimi / glm / minimax / openrouter) so
    // `outputMode` reporting is honest (matches the wire shape the SDK
    // actually emits) and the wasted `json_schema → json_object`
    // demotion cycle on first 400 is skipped.
    const currentMode = outputModeOverride ?? this.getCurrentOutputMode(model);
    const outputArgs = buildOutputArgs(response_format, currentMode);

    // [DEBUG-LOG v1.26.3 E2E] visible entry-point trace: response_format
    // requested by caller, current mode from the prober, and the
    // final outputArgs that will reach the wire.
    //   - outputArgs has no `output` key     → Tier 2 (text_prompt)
    //   - output.output.name === 'object'    → Tier 0 (json_schema with schema)
    //   - output.output.name === 'json'      → Tier 1 (json_object, or Tier 0 with no schema)
    console.debug(
      `[OUTPUT-MODE-DEBUG] baseURL=${this.baseURL} ` +
      `response_format=${JSON.stringify(response_format)} ` +
      `mode=${currentMode} ` +
      `outputArgs=${JSON.stringify(outputArgs)}`,
    );

    try {
      const languageModel = this.getProvider(model, this.fetchImpl);
      const { generateText } = await import('ai');

      const result = await generateText({
        model: languageModel,
        ...(system ? { system } : {}),
        messages,
        ...(abortSignal ? { abortSignal } : {}),
        maxOutputTokens: max_tokens,
        ...outputArgs,
        providerOptions: this.buildProviderOptions({
          model,
          enableThinking,
          reasoningEffort,
          repetitionPenalty: repetition_penalty,
        }) as unknown as Parameters<typeof generateText>[0]['providerOptions'],
        ...buildSamplingArgs({ temperature, top_p, seed }),
      });
      reportFinish(onFinish, result.finishReason, result.usage);
      // Issue #443 follow-up (v1.26.x PATCH) — mirror createMessageWithOutput:
      // LMStudio + Qwen3.5 routes structured output into `reasoning_content`
      // and leaves the visible `content` empty. `generateText` returns the
      // visible text only — reasoning arrives via the separate
      // `result.reasoning` promise. Prepend it so parseJsonResponse's
      // balanced-JSON finder can reach the JSON-shaped payload.
      let reasoningContent = '';
      try {
        // AI SDK 6.0.230: `result.reasoning` is a sync getter returning
        // Array<ReasoningOutput> in the DefaultGenerateTextResult class
        // (line 5096-5098 of ai/dist/index.mjs). The .d.ts signature
        // misleadingly declares `PromiseLike<Array<ReasoningOutput>>` —
        // there is no actual Promise to await. `await` on a non-Thenable
        // value wraps it in a resolved Promise immediately, so the code
        // path still works; the cast below silences the await-thenable
        // lint without changing runtime behaviour.
        const reasoningRaw = await (result.reasoning as unknown as Promise<unknown>);
        const reasoningArr: ReadonlyArray<{ text?: string }> = Array.isArray(reasoningRaw)
          ? (reasoningRaw as ReadonlyArray<{ text?: string }>)
          : typeof reasoningRaw === 'string'
            ? [{ text: reasoningRaw }]
            : [];
        reasoningContent = reasoningArr.map((r) => r.text ?? '').join('');
      } catch {
        /* No reasoning field on this provider. */
      }
      // S143: the reasoning-channel rescue below exists for backends that put
      // the ANSWER into `reasoning_content`. When the usage says the budget
      // went to reasoning and content is empty at `length`, the reasoning is
      // a runaway think, not an answer — skip the prepend so the #470 assert
      // sees the empty answer and throws (see isReasoningRunaway).
      const usage = normalizeUsage(result.usage);
      const finalText = reasoningContent
          && !isReasoningRunaway(result.text, result.finishReason, usage)
        ? prependReasoningForParse(reasoningContent, result.text)
        : result.text;
      // Issue #470: empty answer + `length` + the budget spent on reasoning is
      // a thinking-control failure, not a parse failure. Checked on finalText
      // so the reasoning-channel prepend above counts as content.
      assertNotReasoningOnly(finalText, result.finishReason, usage);
      return finalText;
    } catch (err) {
      // v1.26.3 PATCH Path 2 fix (DocTpoint CHANGES_REQUESTED
      // 2026-08-10T12:50:37Z) — catch `NoObjectGeneratedError` from
      // AI SDK's `parseCompleteOutput` (line 3899 of
      // `ai@6.0.230/dist/index.mjs`).
      //
      // WHY THIS IS A SEPARATE BRANCH (not folded into the APICallError
      // arm): `NoObjectGeneratedError extends AISDKError`, NOT
      // `APICallError`. It's thrown by the SDK after `generateText`
      // succeeds — the wire call returned 200, the model emitted JSON,
      // but `Output.json()` / `Output.object()` could not parse it
      // (unclosed array, truncation, malformed structure). The 200 OK
      // means none of the 400-class probes below apply, but the
      // caller-side `parseJsonResponse` would still be able to repair
      // the text if we surfaced it.
      //
      // Without this branch, the error propagates to the user as
      // "Failed to connect to <provider> API" — a JSON-shape problem
      // misreported as a connectivity/credentials error. The
      // downstream `parseJsonResponse` + greedy regex + LLM repair
      // path is bypassed entirely.
      //
      // CONTRACT: return `err.text` verbatim (no transformation, no
      // truncation). Caller-side repair depends on the exact raw
      // characters the model emitted — any rewrapping (e.g. truncating
      // at position N, prepending "JSON: ") would defeat the
      // greedy-regex + LLM repair heuristics. The integration test
      // `caller-side parseJsonResponse can repair the returned text`
      // pins this contract.
      //
      // SCOPE: only `createMessage` (the path the 16 production callers
      // use). `createMessageStream` does not consume Output.json() /
      // Output.object() and does not throw NoObjectGeneratedError, so
      // it does not need this fix. The schema arm (Phase B migration)
      // also throws NoObjectGeneratedError on malformed JSON, so this
      // branch serves both the no-schema (Tier 1) and schema (Tier 0)
      // paths.
      if (NoObjectGeneratedError.isInstance(err)) {
        const text = (err as Error & { text?: unknown }).text;
        if (typeof text === 'string') {
          reportFinish(onFinish, 'stop', undefined);
          // Issue #443 follow-up (mirrors createMessageWithOutput):
          // when parseCompleteOutput throws on the JSON-shaped payload
          // that LMStudio + Qwen3.5 routes into reasoning_content,
          // `err.text` is empty (only the visible content is captured).
          // Reach into err.response.body for reasoning_content and
          // prepend it so parseJsonResponse's thinking-block fallback
          // (Layer 3) can recover the structured payload.
          let reasoningContent = '';
          try {
            const body = (err as Error & {
              response?: { body?: { choices?: Array<{ message?: { reasoning_content?: unknown } }> } };
            }).response?.body;
            const reasoningFromBody = body?.choices?.[0]?.message?.reasoning_content;
            if (typeof reasoningFromBody === 'string' && reasoningFromBody) {
              reasoningContent = reasoningFromBody;
            } else if (Array.isArray(reasoningFromBody)) {
              reasoningContent = reasoningFromBody.map((r) => (r as { text?: string }).text || '').join('');
            }
          } catch {
            /* response body shape unexpected */
          }
          return reasoningContent
            ? prependReasoningForParse(reasoningContent, text)
            : text;
        }
        // Defensive fallback: NoObjectGeneratedError without a `.text`
        // field (shouldn't happen per ai SDK contract, but if it does,
        // surface the underlying cause so the user sees a real error
        // instead of a silent "undefined" return). Falling through to
        // the existing throw path below would otherwise lose this
        // diagnostic.
        throw err;
      }

      // v1.26.4 PATCH (Issue #474 — Layer 2): catch the sibling class
      // `NoOutputGeneratedError`. AI SDK throws this from the
      // step-retry exhaustion path (ai@6.0.230/dist/index.mjs:5146,
      // 7077, 7232, 7933) when the model produced zero output across
      // all retries — typical with reasoning models (deepseek-v4-flash)
      // whose `reasoning_content` consumes the entire `maxOutputTokens`
      // budget and leaves `content` empty.
      //
      // Without this branch, the error propagates to the user as
      // "Failed to connect to <provider> API" — a budget-exhaustion
      // problem misreported as a connectivity/credentials error. The
      // caller's `parseJsonResponse` has a well-defined empty-input
      // path (`silentOnEmpty: true` / `EmptyResponseError`); let it
      // run instead.
      //
      // Different error class from `NoObjectGeneratedError` (sibling
      // — both extend `AISDKError`, markers `AI_NoObjectGeneratedError`
      // vs `AI_NoOutputGeneratedError`). Cannot share the
      // `err.text`-recovery branch above because NoOutputGeneratedError
      // has no `.text` field (the model emitted nothing to capture).
      if (NoOutputGeneratedError.isInstance(err)) {
        console.debug(
          `[NO-OUTPUT-GENERATED] baseURL=${this.baseURL} model=${model} ` +
          `model produced zero output across step retries — returning empty quiet path ` +
          `(hint: a reasoning model may have spent maxOutputTokens on the reasoning channel; ` +
          `a per-step policy like \`<task>=text:off\` in the LLM Advanced settings can disable it)`,
        );
        reportFinish(onFinish, 'stop', undefined);
        return '';
      }

      // v1.23.0 P1.5: URL fallback for custom baseURLs.
      // If user's baseURL is missing /v1, AI-SDK sends to wrong path
      // and gets 404. Try candidate URLs and cache the first working
      // one. Subsequent calls (Ingest/Lint/Query) reuse the cache.
      if (isUrlError(err)) {
        const mappedErr = mapAiSdkError(err);
        const resolved = await resolveBaseUrlWithFallback({
          baseUrl: this.baseURL,
          testFn: (url) => this.probeBaseURL(url),
          originalError: mappedErr,
        });
        const retryLanguageModel = this.getProvider(model, this.fetchImpl, resolved);
        const { generateText } = await import('ai');
        const result = await generateText({
          model: retryLanguageModel,
          ...(system ? { system } : {}),
          messages,
          maxOutputTokens: max_tokens,
          ...outputArgs,
          providerOptions: this.buildProviderOptions({
            model,
            enableThinking,
            reasoningEffort,
            repetitionPenalty: repetition_penalty,
          }) as unknown as Parameters<typeof generateText>[0]['providerOptions'],
          ...buildSamplingArgs({ temperature, top_p, seed }),
        });
        reportFinish(onFinish, result.finishReason, result.usage);
        return result.text;
      }

      // v1.26.0 Batch 6: Layer-3 400-retry for reasoning-related fields.
      //
      // Some openai-compat backends (notably Gemini-via-OpenAI-shim per
      // Issue #137) reject `reasoning_effort: 'none'` with HTTP 400.
      // Match the error message for `reasoning_effort` / `thinking` /
      // `chat_template` (case-insensitive), then retry exactly once
      // with reasoningEffort stripped from the provider options.
      //
      // ORDER MATTERS: this branch runs BEFORE the token-key fallback
      // below. Token-key probe is a coarse "any 400 → swap max_tokens
      // ↔ max_completion_tokens" — if we let it run first on a
      // reasoning-related 400, it would mark the baseURL as
      // max_completion_tokens and skip the reasoning-strip probe
      // entirely. Then the retry would still send reasoning_effort
      // and the second 400 would not be retried at all. Reasoning-
      // strip must run first when the message clearly identifies the
      // reasoning field as the cause.
      //
      // Guard: skip retry if we've already cached "strip" for this (baseURL, model)
      // baseURL — means the first retry already happened (and the
      // retry would either succeed or fail the same way).
      //
      // No per-vendor matching: we don't know which backends reject
      // which dialect, and the user already opted into
      // enableThinking=false explicitly (per the dedup-phase
      // `enableThinkingOverride = false`). Per user guidance
      // (2026-08-04): "做好通用、完善的fallback机制即可".
      //
      // v1.26.0 Batch 6 Bug-3 fix: markStrip moved AFTER the retry
      // succeeds (not before). If the retry itself throws — same
      // backend, transient 5xx, network blip — we don't want the
      // cache permanently poisoned. Mirrors the token-key branch
      // pattern (setCachedKey + try + retry; if retry throws, the
      // outer throw mapAiSdkError catches and the cache is set, but
      // for the reasoning-strip the cache-write is gated on retry
      // success because the cache decision is "this baseURL rejects
      // reasoning_effort" — a transient retry failure shouldn't
      // cement that decision).
      if (
        APICallError.isInstance(err) &&
        err.statusCode === 400 &&
        enableThinking === false &&
        !this.reasoningStripProber.shouldStrip(this.baseURL, model) &&
        ReasoningStripProber.isReasoningFieldError(err.responseBody ?? err.message ?? '')
      ) {
        // [DEBUG-LOG v1.26.3 E2E] reasoning-strip probe matched — the
        // classifier returned true on err.responseBody. If this never
        // fires during a real 400, the classifier still misreads the
        // field; the responseBody excerpt proves what the provider
        // actually said.
        console.debug(
          `[REASONING-STRIP-DEBUG] baseURL=${this.baseURL} ` +
          `classifier matched. statusCode=${err.statusCode} ` +
          `responseBody="${(err.responseBody ?? '').slice(0, 240)}" ` +
          `→ retrying with enableThinking=true (no reasoningEffort on wire)`,
        );
        const retryLanguageModel = this.getProvider(model, this.fetchImpl);
        const { generateText } = await import('ai');
        // Retry without reasoningEffort — pass enableThinking=true so
        // buildProviderOptions does not re-add the field. A per-task policy's
        // named effort (#481) is dropped here for the same reason: the backend
        // just rejected that wire field, so re-sending it at another value
        // would only earn a second 400. The user's
        // intent ("force-disable thinking") was honored by the first
        // attempt; on the retry we accept whatever the backend's
        // default reasoning behavior is, since the field itself is
        // rejected.
        const result = await generateText({
          model: retryLanguageModel,
          ...(system ? { system } : {}),
          messages,
          maxOutputTokens: max_tokens,
          ...outputArgs,
          providerOptions: this.buildProviderOptions({
            model,
            enableThinking: true,
            repetitionPenalty: repetition_penalty,
          }) as unknown as Parameters<typeof generateText>[0]['providerOptions'],
          ...buildSamplingArgs({ temperature, top_p, seed }),
        });
        // Retry succeeded — commit the cache decision now. If the
        // retry above throws, this line never runs and the cache is
        // untouched; the outer catch propagates the error.
        this.reasoningStripProber.markStrip(this.baseURL, model);
        console.debug(`[REASONING-STRIP-DEBUG] baseURL=${this.baseURL} cache committed (markStrip). Future calls on this (baseURL, model) will skip the probe.`);
        reportFinish(onFinish, result.finishReason, result.usage);
        return result.text;
      }

      // v1.26.3 PATCH follow-up (Issue #443 elegant fallback): Layer-3
      // 400-retry for `json_object` / `response_format` field rejection.
      //
      // LM Studio is the measured case (DocTpoint Issue #443 comment 1,
      // 2026-08-09: 29 ms, `'response_format.type' must be 'json_schema'
      // or 'text'`). The SDK's `Output.json()` arm encodes
      // `response_format: { type: 'json_object' }` on the wire for every
      // openai-compat provider — most accept it (the 6 cloud providers
      // documented in their respective json_mode guides), but local
      // servers may not. On 400 with a json_object/response_format field
      // marker, retry exactly once with `output` omitted (i.e. no
      // `response_format` on the wire at all), and cache the strip
      // decision so subsequent calls skip the probe.
      //
      // v1.26.3 PATCH Phase A4 — 3-tier output-mode demotion chain.
      //
      // Replaces the v1.26.2 2-tier json-object-strip branch. The
      // chain demotes one tier weaker per matched 400:
      //
      //   currentMode='json_schema' + isJsonSchemaFieldError(err)  →  retry at 'json_object'
      //   currentMode='json_object'  + isJsonObjectFieldError(err)  →  retry at 'text_prompt'
      //   currentMode='text_prompt'                              →  no demotion (floor)
      //
      // Order matters: this block runs AFTER the reasoning-strip branch
      // above (so a 400 with a reasoning-field marker goes to the
      // reasoning path first) and BEFORE the token-key branch below
      // (token-key is coarse — any 400 → swap max_tokens — and would
      // otherwise swallow a structured-output 400, mark the baseURL as
      // max_completion_tokens, and skip the mode demotion entirely).
      //
      // Guards:
      //   - response_format must have been passed on the call site. If
      //     the caller did not opt in, no response_format was on the
      //     wire, no mode demotion applies. Mirrors the reasoning-strip
      //     `enableThinking === false` guard.

      if (
        APICallError.isInstance(err) &&
        err.statusCode === 400 &&
        response_format !== undefined
      ) {
        let lastErrBody: string = err.responseBody ?? err.message ?? '';
        // currentMode is read fresh inside the for-loop body — don't
        // hoist, the loop re-reads after markMode writes, and a stale
        // hoist would defeat the chain's per-iteration visibility.

      // Cache write policy (3-tier chain):
      //
      //   markMode BEFORE the retry (tentatively), so that if the retry
      //   ALSO throws, the catch block sees the demoted mode and
      //   progresses to the next tier instead of looping back to Tier
      //   0. If the retry succeeds, the cache is already at the
      //   correct value — no extra write needed. If the retry fails,
      //   the NEXT tier's demotion branch runs; if THAT retry also
      //   fails, we UNDO the tentative write before propagating so a
      //   transient retry failure does not permanently downgrade the
      //   baseURL. This mirrors the v1.26.2 strip-probe "commit AFTER
      //   retry success" intent but is structured for a multi-step
      //   chain rather than a single retry.
      //
      // Why tentatively-write instead of tracking retry state in a
      //   local variable: the chain is a sequence of independent
      //   catch → retry cycles that recurse through the SAME catch
      //   block. Each cycle needs to see the mode corresponding to
      //   the LAST attempt, not the original. Writing to the cache is
      //   the simplest way to make the "current mode" state visible
      //   across these cycles.
      //
      // Implementation note — why an inner for-loop instead of nested
      //   catches: nested catches can't re-enter their parent's catch
      //   (the throw exits the entire catch block). The chain needs to
      //   iterate so that a retry's error can re-trigger the demotion
      //   branch with the (now-updated) mode.
      let tentativeDemotion: OutputMode | null = null;
      // Up to 2 demotions: Tier 0→1, then Tier 1→2.
      for (let chainAttempt = 0; chainAttempt < 2; chainAttempt++) {
        const currentMode = this.outputModeProber.getMode(this.baseURL, model);

        // Determine target tier based on current mode and last error body.
        let demotedMode: OutputMode | null = null;
        if (currentMode === 'json_schema' && OutputModeProber.isJsonSchemaFieldError(lastErrBody)) {
          demotedMode = 'json_object';
        } else if (currentMode === 'json_object' && OutputModeProber.isJsonObjectFieldError(lastErrBody)) {
          demotedMode = 'text_prompt';
        } else {
          // No demotion applies at this level. Break out cleanly —
          // either the 400 doesn't match any classifier (chain
          // doesn't apply) or we've exhausted the floor.
          break;
        }

        // [DEBUG-LOG v1.26.3 E2E] demotion step.
        console.debug(
          `[OUTPUT-MODE-DEMOTE-DEBUG] baseURL=${this.baseURL} ` +
          `tier=${currentMode} → tier=${demotedMode}. ` +
          `responseBody="${lastErrBody.slice(0, 240)}"`,
        );

        // Tentative write BEFORE retry so the next iteration sees the
        // demoted mode if the retry throws.
        this.outputModeProber.markMode(this.baseURL, model, demotedMode);
        tentativeDemotion = demotedMode;

        try {
          const retryLanguageModel = this.getProvider(model, this.fetchImpl);
          const { generateText } = await import('ai');
          // Tier 2 retry injects the JSON enforcement prefix; Tier 1
          // does not (Output.json() is a wire-shape constraint; no
          // prompt change needed).
          const retrySystem =
            demotedMode === 'text_prompt'
              ? (system ? `${JSON_ENFORCEMENT_SYSTEM_PREFIX}\n\n${system}` : JSON_ENFORCEMENT_SYSTEM_PREFIX)
              : system;
          const result = await generateText({
            model: retryLanguageModel,
            ...(retrySystem ? { system: retrySystem } : {}),
            messages,
            maxOutputTokens: max_tokens,
            ...buildOutputArgs(response_format, demotedMode),
            providerOptions: this.buildProviderOptions({
              model,
              enableThinking,
              reasoningEffort,
              repetitionPenalty: repetition_penalty,
            }) as unknown as Parameters<typeof generateText>[0]['providerOptions'],
            ...buildSamplingArgs({ temperature, top_p, seed }),
          });
          console.debug(`[OUTPUT-MODE-DEMOTE-DEBUG] baseURL=${this.baseURL} retry succeeded. Cache committed: mode=${demotedMode}.`);
          reportFinish(onFinish, result.finishReason, result.usage);
          return result.text;
        } catch (retryErr) {
          // Retry at the demoted tier also failed. Update lastErrBody
          // for the next iteration's classifier check (the loop will
          // decide whether to demote one more tier or break).
          if (APICallError.isInstance(retryErr)) {
            lastErrBody = retryErr.responseBody ?? retryErr.message ?? '';
          }
          console.debug(`[OUTPUT-MODE-DEMOTE-DEBUG] baseURL=${this.baseURL} retry at tier=${demotedMode} failed. Continuing chain.`);
        }
      }
      // Chain exhausted without success. Roll back any tentative
      // writes so a transient retry failure doesn't poison the cache.
      if (tentativeDemotion !== null) {
        this.outputModeProber.markMode(this.baseURL, model, 'json_schema');
        console.debug(`[OUTPUT-MODE-DEMOTE-DEBUG] baseURL=${this.baseURL} chain exhausted without success. Rolling back tentative writes; cache reset to json_schema.`);
      }
      // Re-throw the original 400 so the caller sees the same
      // APICallError that started the chain. The token-key probe
      // below is a coarse "any 400" mechanism — we don't want it to
      // trigger on a structured-output-rejection 400 (that's already
      // been correctly diagnosed above).
      throw err;
      }

      // v1.23.0 P1.5 follow-up: token-key probe-then-retry fallback.
      //
      // On ANY HTTP 400 from the gateway, try the alternate token key
      // exactly once. No error-body inspection needed: status 400 is
      // sufficient signal that "something went wrong", and the cost
      // of a false-positive retry is one extra HTTP call (<1s LAN).
      //
      // Guard: skip retry if we already have a cached key for this
      // (baseURL, model) — means the first retry already happened (and failed),
      // so retrying again would loop.
      //
      // Runs AFTER the reasoning-strip + json-object-strip branches
      // above: those branches handle more specific 400 cases (the
      // error message clearly names a reasoning-related field, or
      // `json_object` / `response_format`). Token-key is the broader
      // catch-all for any other 400.
      if (APICallError.isInstance(err) && err.statusCode === 400 && !this.tokenKeyProber.getCachedKey(this.baseURL, model)) {
        // The default wire format is `max_tokens`. If the gateway
        // rejected it, try `max_completion_tokens`.
        this.tokenKeyProber.setCachedKey(this.baseURL, model, 'max_completion_tokens');
        const retryLanguageModel = this.getProvider(model, this.fetchImpl);
        const { generateText } = await import('ai');
        const result = await generateText({
          model: retryLanguageModel,
          ...(system ? { system } : {}),
          messages,
          maxOutputTokens: max_tokens,
          ...outputArgs,
          providerOptions: this.buildProviderOptions({
            model,
            enableThinking,
            reasoningEffort,
            repetitionPenalty: repetition_penalty,
          }) as unknown as Parameters<typeof generateText>[0]['providerOptions'],
          ...buildSamplingArgs({ temperature, top_p, seed }),
        });
        reportFinish(onFinish, result.finishReason, result.usage);
        return result.text;
      }

      throw mapAiSdkError(err);
    }
  }

  /**
   * v1.26.3 PATCH Phase B (Issue #443) — typed-output variant.
   *
   * Returns `{ text, output?, outputMode, finishReason, usage? }` where
   * `output` is the SDK-parsed object when Tier 0 (json_schema on the
   * wire via `Output.object({schema, name})`) succeeds. For Tier 1
   * (json_object) and Tier 2 (text_prompt) successes, `output` is
   * undefined — the caller falls back to `parseJsonResponse(text)`.
   *
   * Why a separate method (not extending `createMessage`):
   *   - `createMessage` returns `Promise<string>` and is called by 16
   *     production sites; changing the return type is a breaking change
   *     to the public LLMClient interface. Adding a sibling method
   *     keeps both contracts clean.
   *   - Callers that want the typed object opt in via the optional
   *     method; callers that don't are unaffected.
   *   - The 6 P0 Phase B migrations (`seed-selector`, `query-keywords`,
   *     `merge-triage`, `link-orphan`, `fix-dead-link`, `QueryView`)
   *     will use this method with Zod-inferred types. The remaining
   *     10+ callers stay on `createMessage` + parseJsonResponse.
   *
   * Implementation: same shape as `createMessage` — Path 2 fix
   * (NoObjectGeneratedError → `err.text`), 3-tier output-mode demotion
   * chain on 400, URL fallback on isUrlError. Only the success path
   * differs: it returns `result.output` (parsed object) in addition
   * to `result.text` (raw text).
   *
   * Backward compat: callers that check `if (client.createMessageWithOutput)`
   * before calling this method can fall back to `createMessage` for
   * clients (Anthropic / OpenAI / Codex) that don't implement it yet.
   */
  async createMessageWithOutput<T = unknown>(params: {
    model: string;
    max_tokens: number;
    system?: string;
    messages: LLMMessage[];
    response_format?: { type: 'json_object'; schema?: Record<string, unknown> | z.ZodType };
    task?: string;
    outputModeOverride?: OutputMode;
    enableThinking?: boolean;
    reasoningEffort?: 'low' | 'medium' | 'high';
    temperature?: number;
    top_p?: number;
    seed?: number;
    repetition_penalty?: number;
    onFinish?: (meta: LLMFinishMeta) => void;
  }): Promise<{
    text: string;
    output?: T;
    outputMode: OutputMode;
    finishReason: LLMFinishReason;
    usage?: LLMUsage;
  }> {
    const { model, max_tokens, messages, response_format, outputModeOverride, enableThinking, reasoningEffort, repetition_penalty, temperature, top_p, seed, onFinish } = params;
    // See createMessage — a pinned `text_prompt` needs the prompt-side
    // enforcement up front, because no demotion retry will add it.
    const system = forcedTextPromptSystem(params.system, response_format, outputModeOverride);

    // v1.26.4 PATCH (Issue #474 — Layer 3): see createMessage. Use
    // getCurrentOutputMode for honest outputMode reporting on
    // non-supportsStructuredOutputs providers. A per-task policy (#481) pins
    // the mode ahead of both.
    const currentMode = outputModeOverride ?? this.getCurrentOutputMode(model);
    const outputArgs = buildOutputArgs(response_format, currentMode);

    console.debug(
      `[OUTPUT-MODE-DEBUG] (typed) baseURL=${this.baseURL} ` +
      `response_format=${JSON.stringify(response_format)} ` +
      `mode=${currentMode} ` +
      `outputArgs=${JSON.stringify(outputArgs)}`,
    );

    // Issue #506: NoOutputGeneratedError reaches this catch from two
    // origins. (a) generateText rejects — stream flush without a terminal
    // chunk; no result exists in scope and the class carries no
    // `.response` to mine (constructor is {message, cause} only), so the
    // reasoning channel is genuinely unreachable there. (b) generateText
    // RESOLVED but nothing parsed into `output`, so the SDK's `.output`
    // getter throws — at that point the composite text below has already
    // been built from the reasoning channel. Hoisting it lets the catch
    // return the real payload for caller-side repair instead of the
    // empty quiet shape.
    let recoveredText = '';
    let recoveredUsage: LLMUsage | undefined;
    // DocTpoint review (PR #544): origin (b)'s true finish reason — typically
    // `length` when reasoning burned the budget — must survive the recovery.
    // The early reportFinish above already told the truth; a second
    // ('stop', undefined) report in the catch would overwrite it
    // (last-write-wins in consumers like source-analyzer), and the returned
    // finishReason feeds length-keyed remedies that would never fire on a
    // masked 'stop'.
    let recoveredFinishReason: LLMFinishReason = 'stop';

    try {
      const languageModel = this.getProvider(model, this.fetchImpl);
      const { generateText } = await import('ai');
      const result = await generateText({
        model: languageModel,
        ...(system ? { system } : {}),
        messages,
        maxOutputTokens: max_tokens,
        ...outputArgs,
        providerOptions: this.buildProviderOptions({
          model,
          enableThinking,
          reasoningEffort,
          repetitionPenalty: repetition_penalty,
        }) as unknown as Parameters<typeof generateText>[0]['providerOptions'],
        ...buildSamplingArgs({ temperature, top_p, seed }),
      });
      reportFinish(onFinish, result.finishReason, result.usage);
      // Issue #443 follow-up (v1.26.x PATCH) — LMStudio + Qwen3.5 routes the
      // structured output into `reasoning_content` and leaves the visible
      // `content` empty. AI SDK's `generateText` does not include reasoning
      // in `result.text` (it goes into the separate `result.reasoning`
      // promise, mirroring the streaming pattern at line 1078). Without
      // this prepend, `result.text` is `''` and parseJsonResponse sees
      // empty body — losing the JSON-shaped reasoning payload. Mirrors
      // the streaming variant at line 1078–1093.
      let reasoningContent = '';
      try {
        // See createMessage comment for the PromiseLike<Array<...>> vs
        // sync-getter mismatch in the AI SDK 6.0.230 type signature.
        const reasoningRaw = await (result.reasoning as unknown as Promise<unknown>);
        const reasoningArr: ReadonlyArray<{ text?: string }> = Array.isArray(reasoningRaw)
          ? (reasoningRaw as ReadonlyArray<{ text?: string }>)
          : typeof reasoningRaw === 'string'
            ? [{ text: reasoningRaw }]
            : [];
        reasoningContent = reasoningArr.map((r) => r.text ?? '').join('');
      } catch {
        /* No reasoning field on this provider. */
      }
      // S143: same runaway gate as the plain path — see createMessage.
      const usage = normalizeUsage(result.usage);
      const text = reasoningContent
          && !isReasoningRunaway(result.text, result.finishReason, usage)
        ? prependReasoningForParse(reasoningContent, result.text)
        : result.text;
      recoveredText = text;
      recoveredUsage = usage;
      recoveredFinishReason = result.finishReason;
      const output = readOutput<T>(result, currentMode);
      // Issue #470: same guard as the plain path, with one extra let-through —
      // a typed call that produced `output` delivered its answer even when the
      // visible text is empty, so only the case with nothing at all can be a
      // reasoning-only response.
      if (output === undefined) {
        assertNotReasoningOnly(text, result.finishReason, usage);
      }
      return {
        text,
        output,
        outputMode: currentMode,
        finishReason: result.finishReason,
        usage,
      };
    } catch (err) {
      // v1.26.3 PATCH Path 2 fix (mirrors createMessage):
      // catch NoObjectGeneratedError → return err.text verbatim so
      // caller-side parseJsonResponse can repair the malformed JSON.
      // The contract is identical to createMessage — see the long
      // comment there for the rationale (parseCompleteOutput throws on
      // malformed JSON; without this catch, the raw text never reaches
      // the caller).
      if (NoObjectGeneratedError.isInstance(err)) {
        const text = (err as Error & { text?: unknown }).text;
        if (typeof text === 'string') {
          reportFinish(onFinish, 'stop', undefined);
          // Issue #443 follow-up: when Output.object's parseCompleteOutput
          // throws (e.g. LMStudio + Qwen3.5 emits `{"": ""}` under grammar
          // constraint), `err.text` only contains the visible `content`
          // field (often empty). The JSON-shaped reasoning payload lives
          // in `err.response.body.choices[0].message.reasoning_content` —
          // AI SDK does not promote it onto the error. Reach in via the
          // response body and prepend it so parseJsonResponse's
          // thinking-block fallback (Layer 3) can recover the structured
          // payload.
          let reasoningContent = '';
          try {
            const body = (err as Error & {
              response?: { body?: { choices?: Array<{ message?: { reasoning_content?: unknown } }> } };
            }).response?.body;
            const reasoningFromBody = body?.choices?.[0]?.message?.reasoning_content;
            if (typeof reasoningFromBody === 'string' && reasoningFromBody) {
              reasoningContent = reasoningFromBody;
            } else if (Array.isArray(reasoningFromBody)) {
              reasoningContent = reasoningFromBody.map((r) => (r as { text?: string }).text || '').join('');
            }
          } catch {
            /* response body shape unexpected */
          }
          const finalText = reasoningContent
            ? prependReasoningForParse(reasoningContent, text)
            : text;

          // v1.26.3 PATCH follow-up (Issue #443 E2E 2026-08-11): per-model
          // placeholder → text_prompt demotion. When LMStudio + Qwen3.5 emits
          // `{"": ""}` under grammar-constrained decoding (thinking mode
          // collides with the json_schema grammar, model bails with the
          // 5-token minimum-valid-object), the 400 demotion chain never fires
          // (no 400 — the backend accepted the wire). The placeholder is a
          // SEMANTIC failure, not a protocol failure.
          //
          // Demote DIRECTLY to text_prompt (skipping json_object): the root
          // cause is grammar-constrained decoding, and json_object's
          // Output.json() still applies a (weak) grammar — only text_prompt
          // drops it. The cache write is PER-MODEL so a healthy sibling model
          // on the same gateway (gemma-4-12b) is never demoted.
          if (isPlaceholderJsonText(finalText)) {
            console.debug(
              `[OUTPUT-MODE-PLACEHOLDER-DEMOTE] baseURL=${this.baseURL} model=${model} placeholder detected, retrying at tier=text_prompt`,
            );
            try {
              const retryLanguageModel = this.getProvider(model, this.fetchImpl);
              const { generateText } = await import('ai');
              const retrySystem = system
                ? `${JSON_ENFORCEMENT_SYSTEM_PREFIX}\n\n${system}`
                : JSON_ENFORCEMENT_SYSTEM_PREFIX;
              const retryResult = await generateText({
                model: retryLanguageModel,
                ...(retrySystem ? { system: retrySystem } : {}),
                messages,
                maxOutputTokens: max_tokens,
                ...buildOutputArgs(response_format, 'text_prompt'),
                providerOptions: this.buildProviderOptions({
                  model,
                  enableThinking,
                  reasoningEffort,
                  repetitionPenalty: repetition_penalty,
                }) as unknown as Parameters<typeof generateText>[0]['providerOptions'],
                ...buildSamplingArgs({ temperature, top_p, seed }),
              });
              reportFinish(onFinish, retryResult.finishReason, retryResult.usage);
              // Cache committed per-model ONLY on retry success (mirror the
              // 400 chain's success-only policy) — a transient failure must
              // not permanently downgrade the model.
              this.outputModeProber.markMode(this.baseURL, model, 'text_prompt');
              console.debug(
                `[OUTPUT-MODE-PLACEHOLDER-DEMOTE] baseURL=${this.baseURL} model=${model} retry succeeded. Cache committed: text_prompt`,
              );
              return {
                text: retryResult.text,
                output: readOutput<T>(retryResult, 'text_prompt'),
                outputMode: 'text_prompt',
                finishReason: retryResult.finishReason,
                usage: retryResult.usage,
              };
            } catch {
              console.debug(
                `[OUTPUT-MODE-PLACEHOLDER-DEMOTE] baseURL=${this.baseURL} model=${model} retry failed. Returning raw placeholder text.`,
              );
            }
          }

          return {
            text: finalText,
            output: undefined,
            outputMode: currentMode,
            finishReason: 'stop',
            usage: undefined,
          };
        }
        throw err;
      }

      // v1.26.4 PATCH (Issue #474 — Layer 2): catch the sibling class
      // `NoOutputGeneratedError` on the typed-output path. Same root
      // cause as the createMessage branch (reasoning budget exhausted
      // → zero visible content). Return the empty quiet shape so the
      // caller's parseJsonResponse can take its empty-input branch.
      // See the long comment in createMessage for the rationale.
      if (NoOutputGeneratedError.isInstance(err)) {
        // Issue #506, origin (b): generateText resolved but the output
        // getter threw — the composite text built from the reasoning
        // channel is still in scope. Hand it to the caller's repair path
        // (parseJsonResponse Layer 3) instead of discarding it.
        if (recoveredText.trim() !== '') {
          console.debug(
            `[NO-OUTPUT-GENERATED] (typed) baseURL=${this.baseURL} model=${model} ` +
            `no parseable output; returning ${recoveredText.length}-char composite ` +
            `from the reasoning channel for caller-side repair`,
          );
          // No second reportFinish here — the early one after generateText
          // already delivered the true finishReason/usage (DocTpoint PR #544:
          // last-write-wins consumers would otherwise see a masked 'stop').
          return {
            text: recoveredText,
            output: undefined,
            outputMode: currentMode,
            finishReason: recoveredFinishReason,
            usage: recoveredUsage,
          };
        }
        console.debug(
          `[NO-OUTPUT-GENERATED] (typed) baseURL=${this.baseURL} model=${model} ` +
          `model produced zero output across step retries — returning empty quiet path ` +
          `(hint: a reasoning model may have spent maxOutputTokens on the reasoning channel; ` +
          `a per-step policy like \`<task>=text:off\` in the LLM Advanced settings can disable it)`,
        );
        reportFinish(onFinish, 'stop', undefined);
        return {
          text: '',
          output: undefined,
          outputMode: currentMode,
          finishReason: 'stop',
          usage: undefined,
        };
      }

      // URL fallback (same as createMessage).
      if (isUrlError(err)) {
        const mappedErr = mapAiSdkError(err);
        const resolved = await resolveBaseUrlWithFallback({
          baseUrl: this.baseURL,
          testFn: (url) => this.probeBaseURL(url),
          originalError: mappedErr,
        });
        const retryLanguageModel = this.getProvider(model, this.fetchImpl, resolved);
        const { generateText } = await import('ai');
        const result = await generateText({
          model: retryLanguageModel,
          ...(system ? { system } : {}),
          messages,
          maxOutputTokens: max_tokens,
          ...outputArgs,
          providerOptions: this.buildProviderOptions({
            model,
            enableThinking,
            reasoningEffort,
            repetitionPenalty: repetition_penalty,
          }) as unknown as Parameters<typeof generateText>[0]['providerOptions'],
          ...buildSamplingArgs({ temperature, top_p, seed }),
        });
        reportFinish(onFinish, result.finishReason, result.usage);
        return {
          text: result.text,
          output: readOutput<T>(result, currentMode),
          outputMode: currentMode,
          finishReason: result.finishReason,
          usage: result.usage,
        };
      }

      // 3-tier demotion chain on 400 (same logic as createMessage).
      // Only differs in the success branch: returns typed shape instead
      // of bare string.
      if (
        APICallError.isInstance(err) &&
        err.statusCode === 400 &&
        response_format !== undefined
      ) {
        let lastErrBody: string = err.responseBody ?? err.message ?? '';
        let tentativeDemotion: OutputMode | null = null;
        for (let chainAttempt = 0; chainAttempt < 2; chainAttempt++) {
          const iterMode = this.outputModeProber.getMode(this.baseURL, model);
          let demotedMode: OutputMode | null = null;
          if (iterMode === 'json_schema' && OutputModeProber.isJsonSchemaFieldError(lastErrBody)) {
            demotedMode = 'json_object';
          } else if (iterMode === 'json_object' && OutputModeProber.isJsonObjectFieldError(lastErrBody)) {
            demotedMode = 'text_prompt';
          } else {
            break;
          }

          console.debug(
            `[OUTPUT-MODE-DEMOTE-DEBUG] (typed) baseURL=${this.baseURL} ` +
            `tier=${iterMode} → tier=${demotedMode}. ` +
            `responseBody="${lastErrBody.slice(0, 240)}"`,
          );

          this.outputModeProber.markMode(this.baseURL, model, demotedMode);
          tentativeDemotion = demotedMode;

          try {
            const retryLanguageModel = this.getProvider(model, this.fetchImpl);
            const { generateText } = await import('ai');
            const retrySystem =
              demotedMode === 'text_prompt'
                ? (system ? `${JSON_ENFORCEMENT_SYSTEM_PREFIX}\n\n${system}` : JSON_ENFORCEMENT_SYSTEM_PREFIX)
                : system;
            const result = await generateText({
              model: retryLanguageModel,
              ...(retrySystem ? { system: retrySystem } : {}),
              messages,
              maxOutputTokens: max_tokens,
              ...buildOutputArgs(response_format, demotedMode),
              providerOptions: this.buildProviderOptions({
                model,
                enableThinking,
                reasoningEffort,
                repetitionPenalty: repetition_penalty,
              }) as unknown as Parameters<typeof generateText>[0]['providerOptions'],
              ...buildSamplingArgs({ temperature, top_p, seed }),
            });
            reportFinish(onFinish, result.finishReason, result.usage);
            return {
              text: result.text,
              output: readOutput<T>(result, demotedMode),
              outputMode: demotedMode,
              finishReason: result.finishReason,
              usage: result.usage,
            };
          } catch (retryErr) {
            if (APICallError.isInstance(retryErr)) {
              lastErrBody = retryErr.responseBody ?? retryErr.message ?? '';
            }
            console.debug(`[OUTPUT-MODE-DEMOTE-DEBUG] (typed) baseURL=${this.baseURL} retry at tier=${demotedMode} failed.`);
          }
        }
        if (tentativeDemotion !== null) {
          this.outputModeProber.markMode(this.baseURL, model, 'json_schema');
        }
        throw err;
      }

      // Token-key probe (coarse any-400 fallback).
      if (APICallError.isInstance(err) && err.statusCode === 400 && !this.tokenKeyProber.getCachedKey(this.baseURL, model)) {
        this.tokenKeyProber.setCachedKey(this.baseURL, model, 'max_completion_tokens');
        const retryLanguageModel = this.getProvider(model, this.fetchImpl);
        const { generateText } = await import('ai');
        const result = await generateText({
          model: retryLanguageModel,
          ...(system ? { system } : {}),
          messages,
          maxOutputTokens: max_tokens,
          ...outputArgs,
          providerOptions: this.buildProviderOptions({
            model,
            enableThinking,
            reasoningEffort,
            repetitionPenalty: repetition_penalty,
          }) as unknown as Parameters<typeof generateText>[0]['providerOptions'],
          ...buildSamplingArgs({ temperature, top_p, seed }),
        });
        reportFinish(onFinish, result.finishReason, result.usage);
        return {
          text: result.text,
          output: readOutput<T>(result, currentMode),
          outputMode: currentMode,
          finishReason: result.finishReason,
          usage: result.usage,
        };
      }

      throw mapAiSdkError(err);
    }
  }

  /**
   * Map AI-SDK options → OpenAI-compatible provider options.
   *
   * Same shape as OpenAISdkClient (these providers all speak the
   * OpenAI Chat Completions format). `enableThinking=false` maps to
   * `reasoningEffort='none'` (v1.26.0 Batch 6) — verified wire-reaches
   * the openai-compat SDK's zod schema (@ai-sdk/openai-compatible@2.0.62
   * line 331) and is emitted as `reasoning_effort: 'none'` on the wire
   * (line 541). DocTpoint's LM Studio / gemma-4-12b fetch-interceptor
   * measurement (Issue #382 comment 2, 2026-08-04) confirmed the field
   * reaches the backend; reasoning_tokens=0 in the response.
   *
   * Earlier this mapped to `thinking.type: 'disabled'` — neither it nor
   * `chat_template_kwargs` were declared in the AI SDK's zod schema
   * (openaiCompatibleLanguageModelChatOptions, line 322-344 of
   * @ai-sdk/openai-compatible@2.0.62/dist/index.mjs), and the SDK's
   * "passthrough" path (line 533-534) reads from
   * `providerOptions[this.providerOptionsName]` (the provider id we
   * pass in — `deepseek` / `kimi` / `lmstudio` / etc.) rather than the
   * hardcoded `"openaiCompatible"` key that buildProviderOptions
   * returns under. None of the 15 provider ids in `types.ts` is the
   * literal string `"openai-compatible"`, so the lookup misses for
   * every provider and the extras never reach the wire. DocTpoint
   * identified this via fetch-interceptor on Issue #382 comment 3
   * (2026-08-04); the field never left the process on the openai-compat
   * path. The 979s→365s e2e gain came from retry/backoff only. See
   * [[project_v1_26_0_batch_6_real_wire_thinking_disable]] for the
   * full post-mortem.
   */
  private buildProviderOptions(opts: {
    /** Issue #551: the strip cache is keyed per (baseURL, model). */
    model: string;
    enableThinking?: boolean;
    reasoningEffort?: 'low' | 'medium' | 'high';
    repetitionPenalty?: number;
  }): Record<string, Record<string, unknown>> {
    const openaiOpts: Record<string, unknown> = {};

    // Issue #481: a named effort bounds the thinking instead of only permitting
    // it. Same wire key as the force-disable path below, different value, and it
    // takes precedence — asking for `low` and `none` at once is a contradiction
    // the policy layer cannot produce (`off` yields no effort) and that a call
    // site should not be able to smuggle in either.
    if (opts.reasoningEffort && !this.reasoningStripProber.shouldStrip(this.baseURL, opts.model)) {
      openaiOpts.reasoningEffort = opts.reasoningEffort;
    } else if (opts.enableThinking === false && !this.reasoningStripProber.shouldStrip(this.baseURL, opts.model)) {
      // v1.26.0 Batch 6: force-disable thinking via reasoningEffort.
      //
      // Prior mechanism (PR #410 / Batch 2) used `thinking.type: 'disabled'`
      // + `chat_template_kwargs.enable_thinking: false` — neither is in
      // @ai-sdk/openai-compatible's zod schema
      // (openaiCompatibleLanguageModelChatOptions, line 322-344 of dist/index.mjs),
      // and the SDK's "passthrough" path at line 533-534 reads from
      // `providerOptions[this.providerOptionsName]` (our provider id —
      // `deepseek` / `kimi` / `lmstudio` / etc.), not the hardcoded
      // `"openaiCompatible"` key that buildProviderOptions returns under.
      // For every provider id we ship (none is literally
      // `"openai-compatible"`), that lookup misses and the fields never
      // reach the wire. Verified by DocTpoint via fetch-interceptor
      // (Issue #382 comment 3, 2026-08-04 — supersedes his earlier
      // comment 2 which called this "stripped"; it is misaddressed).
      //
      // The new mechanism is `reasoningEffort: 'none'` (camelCase) which
      // the zod schema DOES accept (line 331: `z.string().optional()`) and
      // which the SDK emits as `reasoning_effort: 'none'` (snake_case) on
      // the wire (line 541). DocTpoint's LM Studio / gemma-4-12b
      // measurement confirmed wire-reaches + reasoning_tokens=0.
      //
      // Backend compatibility (no per-vendor matching):
      //   - DeepSeek V3/V3.1/V4 — accepts (official reasoning_effort field)
      //   - Kimi k2.5/2.6 — accepts
      //   - GLM-4.6 (智谱 BigModel) — accepts
      //   - LM Studio / llama.cpp — DocTpoint measured
      //   - OpenRouter — uses `reasoning: { enabled: false }` (different
      //     dialect, silently ignored on openai-compat path; not a 400)
      //   - Gemini via OpenAI shim — likely 400; handled by Layer 3
      //     (400-retry in commit B6-3) which strips the field and retries
      //
      // The `!shouldStrip(this.baseURL)` guard: once the Layer-3 retry
      // learned this backend rejects reasoning_effort, future calls on
      // this baseURL should NOT re-add the field (otherwise the retry
      // path would just re-400 forever). The strip decision is a
      // per-baseURL "this backend doesn't accept this field" signal.
      openaiOpts.reasoningEffort = 'none';
    }

    if (opts.repetitionPenalty !== undefined) {
      // Issue #414: per-provider spelling dispatch. The AI SDK's
      // openai-compat passthrough (dist/index.mjs:525-540) reads from
      // `providerOptions[this.providerOptionsName]` (our provider id —
      // `lmstudio` / `kimi` / etc.), not the hardcoded `"openaiCompatible"`
      // key. This branch now emits under the per-id key (the return key
      // below) so passthrough delivers the field to the wire body.
      //
      // Different backends accept different spellings (see constructor
      // for the dispatch table — the field is `null` for providers whose
      // public API does not document `repetition_penalty`, in which case
      // we drop silently to avoid the "user sets 1.5 expecting a
      // reduction, field is silently ignored" failure class that
      // motivated #414):
      //   - `lmstudio` / `ollama` (llama.cpp dialect) → `repeat_penalty`
      //     (no `-ion`). Verified by DocTpoint #414 type-error test on
      //     LM Studio / gemma-4-12b.
      //   - `kimi` / `openrouter` / `custom` (OpenAI-spec dialect) →
      //     `repetition_penalty` (snake_case).
      //
      // No 400-strip retry: `repetitionPenalty` is a user opt-in
      // setting (not a plugin default), so a backend rejection should
      // surface to the user, not be silently swallowed. If a future
      // pattern emerges of "users frequently 400 because they set
      // repetitionPenalty", add a per-baseURL strip prober (see
      // `reasoning-strip-probe.ts` for the pattern) — not preemptively,
      // per dead-code-as-docs policy.
      //
      // Log fires only when the field IS sent (not on drop), matching
      // the `[REASONING-STRIP-DEBUG]` convention of "log on the action
      // the caller will care about". The drop path is documented in
      // the constructor field's JSDoc + in `repetitionPenaltyWireField`.
      //
      // Tag `[REPETITION-PENALTY-EMIT]` (parallel to `[REASONING-STRIP-DEBUG]`)
      // includes `baseURL=` for disambiguation across `custom` providers
      // pointing at different backends — same provider id, different
      // contract.
      const wireField = this.repetitionPenaltyWireField;
      if (wireField !== null) {
        console.debug(
          `[REPETITION-PENALTY-EMIT] baseURL=${this.baseURL} ` +
          `provider=${this.provider} wireField=${wireField} ` +
          `value=${opts.repetitionPenalty}`,
        );
        openaiOpts[wireField] = opts.repetitionPenalty;
      }
    }

    // Issue #414: return under `this.provider` (e.g. `lmstudio`,
    // `kimi`), not the hardcoded `"openaiCompatible"` key. The AI SDK's
    // openai-compat passthrough at
    // `@ai-sdk/openai-compatible@2.0.62/dist/index.mjs:525-540` reads
    // from `providerOptions[this.providerOptionsName]` (camelCase,
    // double-lookup) and forwards every field not in the zod whitelist
    // (`reasoningEffort` / `textVerbosity` / `strictJsonSchema` / `user`)
    // to the wire body unchanged. `reasoningEffort` is handled by the
    // SDK separately (whitelisted → wire `reasoning_effort` at line
    // 541); the per-provider key swap is what allows `repetition_penalty`
    // (and any future per-provider field we add) to reach the wire.
    //
    // Side-effect: `thinking` + `chat_template_kwargs` (no longer used
    // post-PR #411 / Batch 6) would now also passthrough if added
    // here. We never add them, so this is a non-concern. PR #411's
    // `reasoningEffort` → `reasoning_effort` path is unaffected (it's
    // a zod-whitelist translation, not a passthrough).
    return Object.keys(openaiOpts).length > 0
      ? { [this.provider]: openaiOpts }
      : {};
  }

  async createMessageStream(params: {
    model: string;
    max_tokens: number;
    system?: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    onChunk: (chunk: string) => void;
    enableThinking?: boolean;
    temperature?: number;
    top_p?: number;
    repetition_penalty?: number;
    seed?: number;
    /** Step label for per-task accounting (Issue #469). Not consumed here — interface conformance. */
    task?: string;
    onFinish?: (meta: { finishReason: LLMFinishReason }) => void;
  }): Promise<string> {
    const { model, max_tokens, system, messages, onChunk, temperature, top_p, repetition_penalty, seed, enableThinking, onFinish } = params;

    // v1.23.0 P1-7 follow-up: stream path uses streamWithFallback
    // (real streaming via window.fetch with CORS fallback to
    // requestUrl). See obsidian-fetch-bridge.ts for rationale.
    const languageModel = this.getProvider(model, this.streamFetchImpl);
    const { streamText } = await import('ai');

    try {
      // v1.23.0 P2: AI-SDK v6 stream consumption fix.
      //
      // Root cause of "一次性" (batch) streaming UX:
      // The previous code iterated `result.fullStream` first to collect
      // reasoning-delta events, THEN iterated `result.textStream` to
      // forward text chunks. AI-SDK v6's fullStream and textStream share
      // the same underlying event source — iterating fullStream causes
      // the framework to buffer all text-delta events internally and
      // yield them to textStream all at once when the stream completes.
      // Result: onChunk fires N times in ~50ms, UI shows a single render.
      //
      // Fix: consume ONLY textStream. For reasoning content (DeepSeek
      // doesn't emit reasoning; OpenAI o1-series does), read from
      // `result.reasoning` (a Promise<string>) after stream completes —
      // this is the AI-SDK v6 recommended pattern.
      const result = streamText({
        model: languageModel,
        ...(system ? { system } : {}),
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        maxOutputTokens: max_tokens,
        // No effort here: the stream path carries no `task` label (#469), so
        // no per-step policy can be resolved for it.
        providerOptions: this.buildProviderOptions({
          model,
          enableThinking,
          repetitionPenalty: repetition_penalty,
        }) as unknown as Parameters<typeof streamText>[0]['providerOptions'],
        ...buildSamplingArgs({ temperature, top_p, seed }),
      });

      let fullText = '';
      let chunkCount = 0;
      const streamStartTime = Date.now();
      // v1.23.0 P2: Force a macrotask yield between chunks so the
      // browser can paint each onChunk's DOM update as a separate
      // frame. Without this, AI-SDK's async iterator drains the
      // entire response in a single microtask batch (all onChunk
      // calls complete before the next requestAnimationFrame fires),
      // making the UI appear to render the final state in one go.
      //
      // v1.24.1 PATCH Phase 5.5.0: removed per-chunk console.debug
      // (was noisy + triggered DevTools forced-reflow on long
      // streams). chunkCount is now used only by the post-loop
      // summary line below; we still append each chunk to fullText.
      for await (const chunk of result.textStream) {
        chunkCount++;
        fullText += chunk;
        onChunk(chunk);
        await new Promise<void>(resolve => window.setTimeout(resolve, 0));
      }
      console.debug(`[STREAM-CHUNK] total chunks forwarded: ${chunkCount} in ${Date.now() - streamStartTime}ms`);

      // Surface why generation stopped. Without this a `length` finish is
      // indistinguishable from a normal one and the answer simply ends
      // mid-sentence with no indication anything was cut.
      try {
        reportFinish(onFinish, await result.finishReason, await result.usage);
      } catch {
        /* finishReason unavailable on this provider — leave as unknown */
      }

      // Collect reasoning content (if any) from the post-stream Promise.
      // OpenAI o-series and reasoning-capable providers populate this.
      let reasoningContent = '';
      try {
        const reasoning = await result.reasoning;
        if (typeof reasoning === 'string' && reasoning) {
          reasoningContent = reasoning;
        } else if (Array.isArray(reasoning)) {
          reasoningContent = reasoning.map((r) => (r as { text?: string }).text || '').join('');
        }
      } catch {
        // No reasoning field for this provider (DeepSeek, etc.) — ignore.
      }

      if (reasoningContent) {
        fullText = wrapReasoningContent(reasoningContent, fullText);
      }
      return fullText;
    } catch (err) {
      // v1.23.0 P1.5: URL fallback for streaming (Query Wiki) — same
      // logic as createMessage. If 404 on wrong URL, resolve to the
      // correct baseURL via the module-level cache and retry.
      if (isUrlError(err)) {
        const mappedErr = mapAiSdkError(err);
        const resolved = await resolveBaseUrlWithFallback({
          baseUrl: this.baseURL,
          testFn: (url) => this.probeBaseURL(url),
          originalError: mappedErr,
        });
        const retryLanguageModel = this.getProvider(model, this.streamFetchImpl, resolved);
        const { streamText } = await import('ai');

        const result = streamText({
          model: retryLanguageModel,
          ...(system ? { system } : {}),
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          maxOutputTokens: max_tokens,
          providerOptions: this.buildProviderOptions({
            model,
            enableThinking,
            repetitionPenalty: repetition_penalty,
          }) as unknown as Parameters<typeof streamText>[0]['providerOptions'],
          ...buildSamplingArgs({ temperature, top_p, seed }),
        });

        let fullText = '';
        for await (const chunk of result.textStream) {
          fullText += chunk;
          onChunk(chunk);
        }
        let reasoningContent = '';
        try {
          reasoningContent = extractReasoningText(await result.reasoning);
        } catch { /* no reasoning */ }
        if (reasoningContent) {
          fullText = wrapReasoningContent(reasoningContent, fullText);
        }
        return fullText;
      }

      // v1.26.0 Batch 6 Bug-2 fix: Layer-3 400-retry for reasoning-related
      // fields (streaming variant — same logic as createMessage above).
      //
      // ORDER MATTERS: this branch runs BEFORE the token-key fallback
      // below. Token-key probe is coarse (any 400 →
      // max_tokens ↔ max_completion_tokens); if it runs first on a
      // reasoning-related 400, it would mark the baseURL and skip the
      // reasoning-strip probe entirely. Then the retry still sends
      // reasoning_effort and the second 400 is never retried.
      //
      // Bug-2 (Aug 2026 code-review): this branch used to be AFTER
      // the token-key branch on the streaming path — opposite of the
      // non-streaming path. The token-key branch would mark the
      // baseURL first and the reasoning-strip probe never fired. Now
      // both paths follow the same order.
      if (
        APICallError.isInstance(err) &&
        err.statusCode === 400 &&
        enableThinking === false &&
        !this.reasoningStripProber.shouldStrip(this.baseURL, model) &&
        ReasoningStripProber.isReasoningFieldError(err.responseBody ?? err.message ?? '')
      ) {
        const retryLanguageModel = this.getProvider(model, this.streamFetchImpl);
        const { streamText } = await import('ai');
        const result = streamText({
          model: retryLanguageModel,
          ...(system ? { system } : {}),
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          maxOutputTokens: max_tokens,
          providerOptions: this.buildProviderOptions({
            model,
            enableThinking: true,
            repetitionPenalty: repetition_penalty,
          }) as unknown as Parameters<typeof streamText>[0]['providerOptions'],
          ...buildSamplingArgs({ temperature, top_p, seed }),
        });
        let fullText = '';
        for await (const chunk of result.textStream) {
          fullText += chunk;
          onChunk(chunk);
        }
        let reasoningContent = '';
        try {
          reasoningContent = extractReasoningText(await result.reasoning);
        } catch { /* no reasoning */ }
        // Bug-3: markStrip AFTER the retry succeeds. If the stream
        // throws (network blip, transient 5xx), the cache is not
        // poisoned; the outer catch propagates the error and the
        // next call gets a fresh probe.
        this.reasoningStripProber.markStrip(this.baseURL, model);
        if (reasoningContent) {
          fullText = wrapReasoningContent(reasoningContent, fullText);
        }
        return fullText;
      }

      // v1.23.0 P1.5 follow-up: token-key probe-then-retry for streaming.
      // Same logic as createMessage — cache the alt key for this
      // (baseURL, model) and retry. No error-body inspection.
      if (APICallError.isInstance(err) && err.statusCode === 400 && !this.tokenKeyProber.getCachedKey(this.baseURL, model)) {
        this.tokenKeyProber.setCachedKey(this.baseURL, model, 'max_completion_tokens');
        const retryLanguageModel = this.getProvider(model, this.streamFetchImpl);
        const { streamText } = await import('ai');
        const result = streamText({
          model: retryLanguageModel,
          ...(system ? { system } : {}),
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          maxOutputTokens: max_tokens,
          providerOptions: this.buildProviderOptions({
            model,
            enableThinking,
            repetitionPenalty: repetition_penalty,
          }) as unknown as Parameters<typeof streamText>[0]['providerOptions'],
          ...buildSamplingArgs({ temperature, top_p, seed }),
        });
        let fullText = '';
        for await (const chunk of result.textStream) {
          fullText += chunk;
          onChunk(chunk);
        }
        let reasoningContent = '';
        try {
          reasoningContent = extractReasoningText(await result.reasoning);
        } catch { /* no reasoning */ }
        if (reasoningContent) {
          fullText = wrapReasoningContent(reasoningContent, fullText);
        }
        return fullText;
      }

      throw mapAiSdkError(err);
    }
  }

  async listModels(): Promise<string[]> {
    return [];
  }
}
