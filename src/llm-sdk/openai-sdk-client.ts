// v1.23.0 P1-7: OpenAI provider client backed by Vercel AI-SDK v6.
//
// Replaces the hand-rolled OpenAICompatibleClient (~813 LOC) that
// accumulated across v1.20.0 (#143 max_tokens) → v1.22.4 (#207 probe) →
// v1.22.5 (#207 Responses API). Each historical hotfix added ~50–200
// LOC of provider-specific workaround code. AI-SDK maintains all of
// this internally and ships with:
//
//   - Auto-routing gpt-5.1+ / gpt-5.5 / o1-o4 → Responses API
//   - Auto-selecting max_tokens ↔ max_completion_tokens per model
//   - Reasoning effort: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'
//     (v1.26.0 Batch 6: enableThinking=false maps to 'none' for full skip)
//   - Unified error type (APICallError) with provider body attached
//   - Native streaming (textStream, fullStream)
//
// Architecture:
//   - This class implements our internal LLMClient interface (types.ts)
//     so existing call sites (wiki-engine, query-engine, page-factory,
//     main.ts Test Connection) keep working without changes.
//   - We inject `obsidianFetchBridge` so AI-SDK uses our sandbox-aware
//     HTTP layer (requestUrl) instead of bare window.fetch.
//   - Lazy-load @ai-sdk/openai in constructor so unused providers don't
//     bloat the bundle (B1 strategy).
//
// What is NOT in scope here:
//   - Anthropic / Google — separate classes (AnthropicSdkClient,
//     OpenAICompatSdkClient reuses OpenAI provider with custom baseURL
//     for Gemini/MiniMax/GLM/Kimi/OpenRouter/Ollama/LMStudio).
//   - Anthropic SDK provider via custom baseURL (Coding Plan / z.ai).
//   - Streaming SSE parser — AI-SDK's textStream replaces it.

import { type LanguageModel, APICallError, NoSuchModelError, InvalidPromptError } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { LLMClient } from '../types';
import { obsidianFetchBridge, streamWithFallback } from '../core/obsidian-fetch-bridge';
import { wrapReasoningContent } from '../core/markdown';
import {
  getCachedUrl,
  resolveBaseUrlWithFallback,
  isUrlError,
} from '../core/url-fallback';
import { reportFinish } from './finish-reason';
import { buildSamplingArgs } from './sampling-args';
import { ReasoningStripProber } from './reasoning-strip-probe';

export interface OpenAISdkClientOptions {
  apiKey: string;
  baseURL?: string;
  /**
   * Override the fetch adapter used for streaming. Defaults to
   * `streamWithFallback` which picks window.fetch (real streaming)
   * for cloud providers and requestUrl (no CORS) for local. The
   * override is mainly for tests — production should leave this
   * unset.
   */
  streamFetch?: typeof streamWithFallback;
  /**
   * Override the non-streaming fetch adapter. Defaults to
   * `obsidianFetchBridge`. Override for tests.
   */
  fetch?: typeof obsidianFetchBridge;
}

/**
 * Thin adapter over `@ai-sdk/openai`'s `createOpenAI()` that conforms
 * to the plugin's `LLMClient` interface.
 *
 * Lazy-loads the @ai-sdk/openai package in the constructor — keeps
 * unused providers out of the bundle for users on a single Provider.
 */
export class OpenAISdkClient implements LLMClient {
  private readonly apiKey: string;
  private readonly baseURL: string | undefined;
  private readonly fetchImpl: typeof obsidianFetchBridge;
  private readonly streamFetchImpl: typeof streamWithFallback;

  /**
   * v1.26.0 Batch 6: Layer-3 fallback cache. Custom OpenAI-compatible
   * baseURLs (e.g. user-provided self-hosted) may reject
   * `reasoning_effort: 'none'` with HTTP 400. On 400 with a
   * reasoning-related field name in the error message, strip the field
   * and retry exactly once. Per-(baseURL, model) cache prevents infinite loops.
   * Mirrors the [[ReasoningStripProber]] use in OpenAICompatSdkClient.
   */
  private readonly reasoningStripProber = new ReasoningStripProber();

  constructor(opts: OpenAISdkClientOptions) {
    this.apiKey = opts.apiKey;
    this.baseURL = opts.baseURL;
    this.fetchImpl = opts.fetch ?? obsidianFetchBridge;
    this.streamFetchImpl = opts.streamFetch ?? streamWithFallback;
  }

  /**
   * Build (or rebuild) the underlying AI-SDK provider/model.
   * Called per-request to pick up baseURL changes (rare — usually
   * stable for the lifetime of the client).
   *
   * For now: one model per client (the `model` field on the LLMClient
   * call is ignored at the provider level — we pass it per-request).
   * Tests can swap `this.model` via constructor option in future.
   */
  private getProvider(modelId: string, fetchFn: typeof obsidianFetchBridge | typeof streamWithFallback = this.streamFetchImpl, baseURLOverride?: string): LanguageModel {
    // v1.23.0 P1.5: baseURLOverride lets the fallback retry path pass a
    // corrected URL (e.g., `/v1` appended for Kimi Coding Plan) without
    // mutating this.baseURL. Cached resolved URLs flow through this.
    const effectiveBaseURL = baseURLOverride ?? getCachedUrl(this.baseURL ?? '') ?? this.baseURL;
    const provider = createOpenAI({
      apiKey: this.apiKey,
      ...(effectiveBaseURL ? { baseURL: effectiveBaseURL } : {}),
      fetch: fetchFn as unknown as typeof fetch,
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
    // Type-safe params destructure (LLMClient.createMessage signature).
    const { model, max_tokens, system, messages, temperature, top_p, repetition_penalty, seed, enableThinking, response_format, onFinish } = params;

    try {
      const languageModel = this.getProvider(model, this.fetchImpl);
      // Lazy import to keep generateText on the same module surface.
      const { generateText } = await import('ai');

      const result = await generateText({
        model: languageModel,
        ...(system ? { system } : {}),
        messages,
        maxOutputTokens: max_tokens,
        // Provider-specific options (OpenAI: reasoning effort + thinking).
        // Type: AI-SDK's SharedV3ProviderOptions is a deeply-typed JSON
        // tree. Our buildProviderOptions returns a structurally-correct
        // object but TypeScript can't narrow `unknown` → JSONValue
        // automatically. Cast at the boundary; runtime behavior is fine.
        providerOptions: this.buildProviderOptions({
          model,
          enableThinking,
          repetitionPenalty: repetition_penalty,
          // Built here, discarded by the SDK. `createOpenAI()(modelId)` returns
          // the Responses model, which never emits `response_format` under any
          // name — its JSON mode is `text.format` — and which parses
          // providerOptions through a zod schema that strips unknown keys.
          // See the note on `repetition_penalty`.
          responseFormat: response_format,
        }) as unknown as Parameters<typeof generateText>[0]['providerOptions'],
        // Plugin-level sampling (OpenAI's standard param).
        // `seed` is forwarded but the Responses model discards it; see comment in
        // src/llm-sdk/sampling-args.ts. Top-level repetition_penalty is
        // non-standard for OpenAI; pass via providerOptions.
        ...buildSamplingArgs({ temperature, top_p, seed }),
        // Top-level repetition_penalty is non-standard for OpenAI; pass via providerOptions.
      });
      reportFinish(onFinish, result.finishReason, result.usage);
      return result.text;
    } catch (err) {
      // v1.23.0 P1.5: URL fallback for custom baseURLs (Kimi / z.ai / GLM).
      // If user's baseURL is missing /v1, AI-SDK sends to wrong path and
      // gets 404. Try candidate URLs and cache the first working one.
      if (isUrlError(err) && this.baseURL) {
        const mappedErr = mapAiSdkError(err);
        const resolved = await resolveBaseUrlWithFallback({
          baseUrl: this.baseURL,
          testFn: (url) => this.probeBaseURL(url),
          originalError: mappedErr,
        });
        // Retry with the resolved URL
        const retryLanguageModel = this.getProvider(model, this.fetchImpl, resolved);
        const { generateText } = await import('ai');
        const result = await generateText({
          model: retryLanguageModel,
          ...(system ? { system } : {}),
          messages,
          maxOutputTokens: max_tokens,
          providerOptions: this.buildProviderOptions({
            model,
            enableThinking,
            repetitionPenalty: repetition_penalty,
            responseFormat: response_format,
          }) as unknown as Parameters<typeof generateText>[0]['providerOptions'],
          ...buildSamplingArgs({ temperature, top_p, seed }),
        });
        reportFinish(onFinish, result.finishReason, result.usage);
        return result.text;
      }

      // v1.26.0 Batch 6: Layer-3 400-retry for reasoning-related fields.
      // Custom OpenAI-compatible baseURLs (Kimi / z.ai / GLM routed via
      // OpenAI SDK path) may reject `reasoning_effort: 'none'` with
      // HTTP 400. Same logic as the openai-compat sibling — match the
      // error message, strip the field, retry once, cache the decision.
      //
      // Bug-3 (Aug 2026 code-review): markStrip moved AFTER the retry
      // succeeds (not before). If the retry itself throws (network
      // blip, transient 5xx), we don't want the cache permanently
      // poisoned. Mirrors the openai-compat fix at line ~236 of
      // openai-compat-sdk-client.ts.
      if (
        APICallError.isInstance(err) &&
        err.statusCode === 400 &&
        enableThinking === false &&
        this.baseURL !== undefined &&
        !this.reasoningStripProber.shouldStrip(this.baseURL, model) &&
        ReasoningStripProber.isReasoningFieldError(err.message ?? '')
      ) {
        const retryLanguageModel = this.getProvider(model, this.fetchImpl);
        const { generateText } = await import('ai');
        const result = await generateText({
          model: retryLanguageModel,
          ...(system ? { system } : {}),
          messages,
          maxOutputTokens: max_tokens,
          providerOptions: this.buildProviderOptions({
            model,
            enableThinking: true,
            repetitionPenalty: repetition_penalty,
            responseFormat: response_format,
          }) as unknown as Parameters<typeof generateText>[0]['providerOptions'],
          ...buildSamplingArgs({ temperature, top_p, seed }),
        });
        // Retry succeeded — commit the cache decision now. If the
        // retry above throws, this line never runs and the cache is
        // untouched; the outer catch propagates the error.
        this.reasoningStripProber.markStrip(this.baseURL, model);
        reportFinish(onFinish, result.finishReason, result.usage);
        return result.text;
      }
      throw mapAiSdkError(err);
    }
  }

  /**
   * Map AI-SDK options → OpenAI provider options.
   *
   * OpenAI reasoning effort: maps `enableThinking=false` → `reasoningEffort: 'none'`
   * (v1.26.0 Batch 6). On GPT-5.1+ models the AI SDK
   * (@ai-sdk/openai@3.0.86/dist/index.mjs:943) skips the reasoning path
   * entirely when effort is 'none' and supportsNonReasoningParameters is
   * true — no reasoning tokens billed, no sampling-param validation
   * overhead. For dedup-phase / fix-runners / merge / ingest JSON-decision
   * calls this is the right tradeoff.
   *
   * Chat Completions path accepts string() (line 4856) so 'none' is also
   * harmless on the older endpoint.
   *
   * Note: we do NOT support `enableThinking=true` explicitly — leaving it
   * undefined lets OpenAI decide the model's reasoning behavior. This
   * matches the v1.20.0 "provider-first thinking control" policy.
   */
  private buildProviderOptions(opts: {
    /** Issue #551: the strip cache is keyed per (baseURL, model). */
    model: string;
    enableThinking?: boolean;
    repetitionPenalty?: number;
    responseFormat?: { type: 'json_object' };
  }): Record<string, Record<string, unknown>> {
    // AI-SDK's providerOptions is typed as SharedV3ProviderOptions which
    // recursively constrains values to JSONValue. We use `unknown` here
    // and cast at the call site — TypeScript's deep type narrowing
    // doesn't help us for forward-compat provider option keys.
    const openaiOpts: Record<string, unknown> = {};

    if (
      opts.enableThinking === false &&
      !(this.baseURL !== undefined && this.reasoningStripProber.shouldStrip(this.baseURL, opts.model))
    ) {
      // v1.26.0 Batch 6 + Bug-1 fix: switch from 'low' to 'none' for the
      // official OpenAI Responses path; gate on shouldStrip((baseURL, model)).
      //
      // The shouldStrip guard prevents a regression spotted during
      // code-review (Aug 2026): once Layer-3 marks a (baseURL, model) as
      // "strip" (because it 400'd on reasoning_effort), the next call
      // must NOT re-inject the field — otherwise the catch-block guard
      // `!shouldStrip` short-circuits and the reasoning-strip retry
      // never fires. This is the same guard openai-compat has at
      // line 322 of openai-compat-sdk-client.ts (B6-4).
      //
      // The `baseURL !== undefined` sub-check: shouldStrip only matters
      // for custom baseURLs (the official OpenAI API never goes through
      // Layer-3 — there's no per-baseURL cache for it). For the official
      // path, always emit.
      //
      // History:
      //   - v1.23.0: 'low' was the OpenAI-recommended safe default for
      //     latency-sensitive cases per the GPT-5.x migration guide.
      //   - Batch 6: 'none' is the more aggressive switch that fully
      //     disables reasoning. Per the AI SDK source
      //     (@ai-sdk/openai@3.0.86/dist/index.mjs:943):
      //       if (openaiOptions.reasoningEffort !== 'none' ||
      //           !modelCapabilities.supportsNonReasoningParameters) {
      //         // …emit reasoning_effort…
      //       }
      //     On GPT-5.1+ models (supportsNonReasoningParameters=true),
      //     'none' skips the reasoning path entirely — no reasoning
      //     tokens billed, no temperature/top_p/logprobs validation
      //     overhead. For dedup-phase this is exactly what we want.
      //
      //     Chat Completions path (@ai-sdk/openai@3.0.86:4856) accepts
      //     string() (any value), so 'none' is also harmless there.
      //
      //   - Backend compat (no per-vendor matching): OpenAI SDK is
      //     official OpenAI only — no Gemini-via-shim, no DeepSeek.
      //     The 400-retry in B6-3 still applies if the user's baseURL
      //     routes to a non-OpenAI backend that rejects 'none'.
      openaiOpts.reasoningEffort = 'none';
    }

    if (opts.repetitionPenalty !== undefined) {
      // llama.cpp extension — passed through as-is. The wire name rather than
      // the camelCase one; which backend reads which spelling is not settled
      // here, and the sibling compat client carries what is known.
      //
      // On this path it never leaves the process. `createOpenAI()(modelId)`
      // returns the Responses model, which parses providerOptions through a zod
      // schema and strips whatever the schema does not name — it does not
      // spread raw fields the way `@ai-sdk/openai-compatible` does. Read on
      // `@ai-sdk/openai` 3.0.86 as installed; 1.23.0 shipped `^3.0.77`, same
      // major, unverified. The sibling test asserts
      // the argument handed to the SDK, not the body, so it cannot tell the
      // difference — the same blind spot that let a wrong providerOptions key
      // look correct since v1.23.0, across fifteen releases. Left as-is rather
      // than removed: establishing which of these fields this client actually
      // delivers wants a request-body test and its own change.
      openaiOpts.repetition_penalty = opts.repetitionPenalty;
    }

    if (opts.responseFormat?.type === 'json_object') {
      openaiOpts.response_format = opts.responseFormat;
    }

    return Object.keys(openaiOpts).length > 0 ? { openai: openaiOpts } : {};
  }

  /**
   * Real word-by-word streaming (v1.23.0 P1-7 replacement for
   * parseSSEEvents).
   *
   * AI-SDK's streamText yields `textStream: AsyncIterable<string>`
   * directly — no manual SSE parsing needed. Each chunk is a text
   * delta straight from the provider's tokenizer.
   *
   * Reasoning content (DeepSeek / OpenAI reasoning models) is yielded
   * via `reasoningStream`. We accumulate it and prepend as <think>...
   * </think> in the returned string so Query Wiki's extractThinkingBlocks
   * can find it (matches v1.20.0 behavior). Reasoning is NEVER passed to
   * onChunk — only final-answer text appears in the streaming UI.
   */
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
  }): Promise<string> {
    const { model, max_tokens, system, messages, onChunk, temperature, top_p, repetition_penalty, seed, enableThinking } = params;

    // v1.23.0 P1.5: same URL fallback as createMessage, so streaming
    // (Query Wiki) is consistent with non-streaming (Ingest / Lint).
    try {
      const languageModel = this.getProvider(model, this.streamFetchImpl);
      const { streamText } = await import('ai');

      // v1.23.0 P2: AI-SDK v6 stream consumption fix.
      // See openai-compat-sdk-client.ts for full rationale — only consume
      // textStream to get true real-time chunk forwarding. Iterating
      // fullStream first causes textStream to buffer all chunks and yield
      // them at completion, defeating streaming UX.
      const result = streamText({
        model: languageModel,
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

      // Accumulate text deltas (sent to onChunk) and reasoning (prepended).
      let fullText = '';

      // Text stream — true character-level deltas from AI-SDK.
      let chunkCount = 0;
      const streamStartTime = Date.now();
      for await (const chunk of result.textStream) {
        chunkCount++;
        fullText += chunk;
        onChunk(chunk);
        // v1.23.0 P2: Force a macrotask yield between chunks (see
        // openai-compat-sdk-client.ts for rationale).
        await new Promise<void>(resolve => window.setTimeout(resolve, 0));
      }
      console.debug(`[STREAM-CHUNK] [openai] total chunks forwarded: ${chunkCount} in ${Date.now() - streamStartTime}ms`);

      // Collect reasoning content (if any) from the post-stream Promise.
      // AI-SDK v6 resolves `result.reasoning` after the stream completes.
      let reasoningContent = '';
      try {
        const reasoning = await result.reasoning;
        if (typeof reasoning === 'string' && reasoning) {
          reasoningContent = reasoning;
        } else if (Array.isArray(reasoning)) {
          reasoningContent = reasoning.map((r) => (r as { text?: string }).text || '').join('');
        }
      } catch {
        // No reasoning for this provider (most non-reasoning models) — ignore.
      }

      // Prepend reasoning as <think> block (only in returned string,
      // never sent to onChunk to avoid double-render).
      if (reasoningContent) {
        fullText = wrapReasoningContent(reasoningContent, fullText);
      }

      return fullText;
    } catch (err) {
      // v1.23.0 P1.5: URL fallback for streaming path (Query Wiki)
      // — same logic as createMessage. If 404 on wrong URL, resolve
      // to the correct baseURL via the module-level cache and retry.
      if (isUrlError(err) && this.baseURL) {
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
          const reasoning = await result.reasoning;
          if (typeof reasoning === 'string' && reasoning) {
            reasoningContent = reasoning;
          } else if (Array.isArray(reasoning)) {
            reasoningContent = reasoning.map((r) => (r as { text?: string }).text || '').join('');
          }
        } catch { /* no reasoning */ }
        if (reasoningContent) {
          fullText = wrapReasoningContent(reasoningContent, fullText);
        }
        return fullText;
      }

      // v1.26.0 Batch 6 CR-4: Layer-3 400-retry on the streaming path.
      // Mirrors the createMessage retry at line 211 and the openai-compat
      // streaming retry at line 576. Custom baseURLs that route through
      // the OpenAI SDK (e.g. Kimi Coding Plan / z.ai via OpenAI SDK
      // mode) and 400 on `reasoning_effort: 'none'` need this branch
      // to recover; otherwise Query Wiki hard-fails where Ingest/Lint
      // recovered.
      if (
        APICallError.isInstance(err) &&
        err.statusCode === 400 &&
        enableThinking === false &&
        this.baseURL !== undefined &&
        !this.reasoningStripProber.shouldStrip(this.baseURL, model) &&
        ReasoningStripProber.isReasoningFieldError(err.message ?? '')
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
          const reasoning = await result.reasoning;
          if (typeof reasoning === 'string' && reasoning) {
            reasoningContent = reasoning;
          } else if (Array.isArray(reasoning)) {
            reasoningContent = reasoning.map((r) => (r as { text?: string }).text || '').join('');
          }
        } catch { /* no reasoning */ }
        // Bug-3: markStrip AFTER retry succeeds. If the stream throws,
        // the cache stays untouched and the outer catch propagates.
        this.reasoningStripProber.markStrip(this.baseURL, model);
        if (reasoningContent) {
          fullText = wrapReasoningContent(reasoningContent, fullText);
        }
        return fullText;
      }
      throw mapAiSdkError(err);
    }
  }

  /**
   * List available models for the Test Connection / Settings dropdown.
   *
   * AI-SDK's OpenAI provider doesn't expose listModels — models are
   * constructed ad-hoc by string id. We return [] and rely on
   * PREDEFINED_PROVIDERS (types.ts) for the model suggestions in the
   * settings UI.
   *
   * Future: could call OpenAI's /v1/models endpoint and merge with
   * the curated suggestion list.
   */
  async listModels(): Promise<string[]> {
    return [];
  }
}

/**
 * Map AI-SDK errors to the plugin's existing error surface.
 *
 * Why this exists:
 *   - The plugin's Notice UI calls `(err as Error).message` everywhere.
 *   - AI-SDK's APICallError already includes the provider response body
 *     in `err.responseBody` and status in `err.statusCode`, but to keep
 *     the existing UI readable we embed those into Error.message.
 *   - This preserves the v1.22.5 behavior where Test Connection Notice
 *     shows e.g. `"status 429: You exceeded your current quota..."`.
 */
export function mapAiSdkError(err: unknown): Error {
  if (err instanceof APICallError) {
    // APICallError.message is "Provider returned error [status]: message"
    // We rebuild it to match the v1.22.5 format exactly:
    //   "status <code>: <provider message>"
    const providerMsg = extractProviderMessage(err);
    const code = err.statusCode ?? 0;
    const enriched = new Error(`status ${code}${providerMsg ? `: ${providerMsg}` : ''}`);
    // Attach useful properties for any code that reads them.
    (enriched as Error & { statusCode?: number; responseBody?: string }).statusCode = code;
    (enriched as Error & { statusCode?: number; responseBody?: string }).responseBody = err.responseBody ?? '';
    return enriched;
  }
  if (err instanceof NoSuchModelError) {
    return new Error(`Unknown model: ${err.modelId ?? 'unspecified'} (${err.message})`);
  }
  if (err instanceof InvalidPromptError) {
    return new Error(`Invalid prompt: ${err.message}`);
  }
  if (err instanceof Error) {
    return err;
  }
  return new Error(String(err));
}

/**
 * Pull the provider's diagnostic message out of an APICallError.
 *
 * Mirrors v1.22.5's `extractProviderErrorMessage` behavior:
 *   - OpenAI: `err.responseBody` is JSON `{error: {message: "..."}}`
 *   - Anthropic: `{type: "error", error: {message: "..."}}`
 *   - Gemini: `{error: {message: "..."}}`
 *   - Plain text (rare): raw body as-is
 */
function extractProviderMessage(err: APICallError): string {
  const body = err.responseBody;
  if (!body) return err.message;

  // Try JSON parse
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    // OpenAI / Anthropic / Gemini all nest under `error.message` or `error.error.message`
    const errorObj = (parsed as { error?: { message?: string; error?: { message?: string } } }).error;
    if (errorObj) {
      if (typeof errorObj.message === 'string') return errorObj.message;
      if (errorObj.error && typeof errorObj.error.message === 'string') return errorObj.error.message;
    }
  } catch {
    // Not JSON — fall through to raw body
  }
  return body;
}
