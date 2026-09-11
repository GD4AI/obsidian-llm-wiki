// v1.23.0 P1-7: Anthropic provider client backed by Vercel AI-SDK v6.
//
// Replaces the hand-rolled AnthropicClient + AnthropicCompatibleClient
// (~547 LOC combined) accumulated across v1.20.0 (#141 prefill) → v1.20.1
// (#141 prefill auto-fallback) → v1.20.2 (#141/#147 system role fix).
//
// Key migration notes:
//   1. system role: AI-SDK abstracts Anthropic's "system at top-level"
//      convention — no manual [system, ...msgs] restructuring needed.
//   2. assistant prefill: AI-SDK handles the "older Claude models reject
//      prefill" detection via its own validation; we don't need a
//      prefillingNotSupported flag.
//   3. baseURL: createAnthropic supports custom baseURL — covers
//      Coding Plan, z.ai, GLM-Anthropic, MiniMax-Anthropic, etc.
//   4. Thinking control: providerOptions.anthropic.thinking controls
//      extended thinking (type: 'enabled' | 'disabled').
//
// Architecture: same shape as OpenAISdkClient — implements LLMClient,
// uses obsidianFetchBridge, lazy-loads @ai-sdk/anthropic.

import { type LanguageModel } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { LLMClient } from '../types';
import { obsidianFetchBridge, streamWithFallback } from '../core/obsidian-fetch-bridge';
import { mapAiSdkError } from './openai-sdk-client';
import {
  getCachedUrl,
  resolveBaseUrlWithFallback,
  isUrlError,
} from '../core/url-fallback';
import { reportFinish, extractReasoningText } from './finish-reason';
import { buildSamplingArgs } from './sampling-args';
import { wrapReasoningContent } from '../core/markdown';

// Re-export for callers that import from anthropic-sdk-client only.
// Reuse the same error mapper as OpenAI — AI-SDK's APICallError shape is
// provider-agnostic, so the same "status <code>: <body message>"
// formatting applies. Anthropic's error body is
// `{type: "error", error: {type: "...", message: "..."}}` —
// extractProviderMessage handles both via the same nested lookup.
export { mapAiSdkError };

/**
 * Issue #449 v1.26.4 PATCH follow-up (DocTpoint blocking review 2026-08-15):
 * `cacheBreakpoint` is a UTF-16 code-unit offset into the FIRST user
 * message's text content — `String.length`, not bytes (set by
 * `source-analyzer.ts:404` as `staticPrefix.length`,
 * measured from the rendered `analyzeSource` template up to but not
 * including `{{batch_context}}`). Anthropic prompt caching is a prefix
 * match on render order `tools → system → messages`; a marker must land
 * on whichever block the offset points at.
 *
 * Pre-fix (PR #464 head `c985196`) attached the marker to the system block.
 * That caches tools + system (a few KB, below Anthropic's minimum
 * cacheable size on every current model) but leaves the 75K-char
 * user-message prefix uncached — the silent no-op class of regression
 * that this fix closes. The floor itself is model-dependent and not
 * monotonic across generations — 512 / 1024 / 2048 / 4096 tokens
 * depending on the model — so it must not be written into the code as
 * a constant; a few KB is below all of them.
 *
 * Emit the user message as two text parts cut at the offset, with
 * `cacheControl` on the first part. AI SDK v6's Anthropic adapter
 * (`@ai-sdk/anthropic/dist/index.mjs:2316-2340`) reads `cacheControl`
 * from `TextPart.providerOptions` and emits `cache_control: { type:
 * 'ephemeral' }` on the corresponding wire block. See also
 * `TextPart` at `@ai-sdk/provider-utils/dist/index.d.ts:615-627`.
 *
 * Defensive behaviour:
 *   - `cacheBreakpoint === undefined` → passthrough (no split).
 *   - No user message in the array → passthrough.
 *   - First user message has non-string content (parts already) → passthrough.
 *   - Offset out of range → clamp to `[0, content.length]`.
 *   - Empty prefix after clamping (offset <= 0) → passthrough, NOT a
 *     split. The AI SDK core drops empty text parts in the user branch
 *     unconditionally (`ai/dist/index.mjs:1451`; the assistant branch two
 *     lines below keeps them when `providerOptions` is set), so a split at
 *     offset 0 emits a single block and NO `cache_control` anywhere in the
 *     body — the same silent no-op this helper exists to close, and one a
 *     part-level assertion cannot see. There is nothing to cache in an
 *     empty prefix, so declining the split is also the honest shape.
 *
 * @returns New message array (never mutates input).
 */
function buildMessagesWithCacheControl(
  messages: ReadonlyArray<{ role: 'user' | 'assistant'; content: string | unknown[] }>,
  cacheBreakpoint: number | undefined,
): Array<{ role: 'user' | 'assistant'; content: string | Array<{ type: 'text'; text: string; providerOptions?: { anthropic?: { cacheControl?: { type: 'ephemeral' } } } }> }> {
  if (cacheBreakpoint === undefined) return messages.slice() as never;
  const firstUserIdx = messages.findIndex((m) => m.role === 'user');
  if (firstUserIdx === -1) return messages.slice() as never;
  const first = messages[firstUserIdx];
  if (typeof first.content !== 'string') return messages.slice() as never;
  const offset = Math.max(0, Math.min(cacheBreakpoint, first.content.length));
  // An empty prefix cannot carry the marker: the SDK core drops the part and
  // the whole body ships without `cache_control`. Reachable from a negative
  // offset through the clamp above, and from `staticPrefix.length === 0`
  // upstream (Issue #493). Leave the message as it is instead.
  if (offset === 0) return messages.slice() as never;
  const prefix = first.content.slice(0, offset);
  const suffix = first.content.slice(offset);
  const rebuilt: { role: 'user' | 'assistant'; content: Array<{ type: 'text'; text: string; providerOptions?: { anthropic?: { cacheControl?: { type: 'ephemeral' } } } }> } = {
    ...first,
    content: [
      { type: 'text' as const, text: prefix, providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' as const } } } },
      { type: 'text' as const, text: suffix },
    ],
  };
  return [...messages.slice(0, firstUserIdx), rebuilt, ...messages.slice(firstUserIdx + 1)] as never;
}

export interface AnthropicSdkClientOptions {
  apiKey: string;
  /**
   * Custom baseURL for Anthropic-compatible endpoints (Coding Plan,
   * z.ai, GLM-Anthropic, MiniMax-Anthropic, etc.).
   * Omit to use official api.anthropic.com.
   */
  baseURL?: string;
  /** Override non-streaming fetch (used in tests with a mocked bridge). */
  fetch?: typeof obsidianFetchBridge;
  /**
   * Override streaming fetch (default: streamWithFallback). Mostly
   * for tests; production should leave this unset.
   */
  streamFetch?: typeof streamWithFallback;
}

export class AnthropicSdkClient implements LLMClient {
  private readonly apiKey: string;
  private readonly baseURL: string | undefined;
  private readonly fetchImpl: typeof obsidianFetchBridge;
  private readonly streamFetchImpl: typeof streamWithFallback;

  constructor(opts: AnthropicSdkClientOptions) {
    this.apiKey = opts.apiKey;
    this.baseURL = opts.baseURL;
    this.fetchImpl = opts.fetch ?? obsidianFetchBridge;
    this.streamFetchImpl = opts.streamFetch ?? streamWithFallback;
  }

  private getProvider(modelId: string, fetchFn: typeof obsidianFetchBridge | typeof streamWithFallback = this.streamFetchImpl, baseURLOverride?: string): LanguageModel {
    // v1.23.0 P1.5: baseURLOverride lets the fallback retry path pass a
    // corrected URL (e.g., `/v1` appended for Kimi Coding Plan) without
    // mutating this.baseURL. Cached resolved URLs flow through this.
    const effectiveBaseURL = baseURLOverride ?? getCachedUrl(this.baseURL ?? '') ?? this.baseURL;
    const provider = createAnthropic({
      apiKey: this.apiKey,
      ...(effectiveBaseURL ? { baseURL: effectiveBaseURL } : {}),
      fetch: fetchFn as unknown as typeof fetch,
    });
    return provider(modelId);
  }

  /**
   * Probe whether a baseURL works for Anthropic messages endpoint.
   * Used by the URL fallback to test candidate URLs without committing
   * the original request payload. Sends a minimal 1-token message and
   * treats 404 as "wrong URL" (return false), all other errors as
   * "auth/server error" (throw to propagate).
   */
  private async probeBaseURL(baseURL: string): Promise<boolean> {
    try {
      const languageModel = this.getProvider('claude-haiku-4-5', this.fetchImpl, baseURL);
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
    const { model, max_tokens, system, messages, temperature, top_p, repetition_penalty, enableThinking, cacheBreakpoint, onFinish, abortSignal } = params;

    // Issue #449 v1.26.4 PATCH follow-up: when cacheBreakpoint is defined,
    // split the FIRST user message's text content at the offset and attach
    // `cacheControl` to the prefix part (DocTpoint blocking review 2026-08-15).
    // system stays a plain string — the cache marker lives on the user
    // block, not the system block. Absent cacheBreakpoint → passthrough.
    const messagesWithCacheControl = buildMessagesWithCacheControl(messages, cacheBreakpoint);

    try {
      const languageModel = this.getProvider(model, this.fetchImpl);
      const { generateText } = await import('ai');

      const result = await generateText({
        model: languageModel,
        // Anthropic accepts system at top-level; AI-SDK abstracts this.
        // Truthy-check drops `system: ''` so it cannot consume one of
        // Anthropic's 4 cache breakpoints (Issue #449 Branch D fix).
        ...(system ? { system } : {}),
        messages: messagesWithCacheControl,
        ...(abortSignal ? { abortSignal } : {}),
        maxOutputTokens: max_tokens,
        providerOptions: this.buildProviderOptions({
          enableThinking,
          repetitionPenalty: repetition_penalty,
        }) as unknown as Parameters<typeof generateText>[0]['providerOptions'],
        ...buildSamplingArgs({ temperature, top_p }, { withSeed: false }),
      });
      reportFinish(onFinish, result.finishReason);
      return result.text;
    } catch (err) {
      // v1.23.0 P1.5: URL fallback for custom baseURLs (Kimi / z.ai / GLM).
      // If the user's baseURL is missing /v1, AI-SDK sends to a wrong
      // path and gets 404. Try candidate URLs and cache the first
      // working one — subsequent calls (Ingest/Lint/Query) reuse it.
      if (isUrlError(err) && this.baseURL) {
        const mappedErr = mapAiSdkError(err);
        const resolved = await resolveBaseUrlWithFallback({
          baseUrl: this.baseURL,
          testFn: (url) => this.probeBaseURL(url),
          originalError: mappedErr,
        });
        // Retry with the resolved URL — separate try block so the
        // fallback result is returned even if the retry somehow fails.
        const retryLanguageModel = this.getProvider(model, this.fetchImpl, resolved);
        const { generateText } = await import('ai');
        const result = await generateText({
          model: retryLanguageModel,
          ...(system ? { system } : {}),
          messages: messagesWithCacheControl,
          maxOutputTokens: max_tokens,
          providerOptions: this.buildProviderOptions({
            enableThinking,
            repetitionPenalty: repetition_penalty,
          }) as unknown as Parameters<typeof generateText>[0]['providerOptions'],
          ...buildSamplingArgs({ temperature, top_p }, { withSeed: false }),
        });
        reportFinish(onFinish, result.finishReason);
        return result.text;
      }
      throw mapAiSdkError(err);
    }
  }

  /**
   * Map AI-SDK options → Anthropic provider options.
   *
   * Anthropic thinking: AI-SDK exposes `providerOptions.anthropic.thinking`
   * with `{type: 'enabled' | 'disabled', budgetTokens?: number}`.
   * We map `enableThinking=false` → `{type: 'disabled'}` for parity
   * with the OpenAI reasoningEffort='low' path.
   *
   * Issue #414: `repetitionPenalty` is intentionally NOT propagated
   * here. Anthropic's Messages API has no `repetition_penalty` (only
   * `temperature` / `top_p` / `top_k`); the AI SDK's `@ai-sdk/anthropic`
   * zod schema also has no entry for it. Sending it would put an
   * unknown field on the wire (Claude silently ignores unknown fields
   * — same silent-no-op class as #414). The user's opt-in setting is
   * honored by being dropped before emit, which matches the 10-locale
   * i18n text ("cloud providers will silently ignore it"). A future
   * Anthropic-side implementation could re-enable propagation by
   * accepting a custom field name here.
   */
  private buildProviderOptions(opts: {
    enableThinking?: boolean;
    repetitionPenalty?: number;
  }): Record<string, Record<string, unknown>> {
    const anthropicOpts: Record<string, unknown> = {};

    if (opts.enableThinking === false) {
      anthropicOpts.thinking = { type: 'disabled' };
    }

    return Object.keys(anthropicOpts).length > 0 ? { anthropic: anthropicOpts } : {};
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
    // No `seed`. The Messages API has no such parameter, so a run against
    // Anthropic is not repeatable no matter what the setting says — see the
    // note on `samplingSeed` in types.ts.
    repetition_penalty?: number;
    /** Step label for per-task accounting (Issue #469). Not consumed here — forwarded for interface conformance. */
    task?: string;
  }): Promise<string> {
    const { model, max_tokens, system, messages, onChunk, temperature, top_p, repetition_penalty, enableThinking } = params;

    // v1.23.0 P1.5: same URL fallback as createMessage, so streaming
    // (Query Wiki) is consistent with non-streaming (Ingest / Lint /
    // Fix). Use cached resolved URL when present; on 404, fall back
    // to candidate URLs and retry.
    try {
      const languageModel = this.getProvider(model, this.streamFetchImpl);
      const { streamText } = await import('ai');

      const result = streamText({
        model: languageModel,
        ...(system ? { system } : {}),
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        maxOutputTokens: max_tokens,
        providerOptions: this.buildProviderOptions({
          enableThinking,
          repetitionPenalty: repetition_penalty,
        }) as unknown as Parameters<typeof streamText>[0]['providerOptions'],
        ...buildSamplingArgs({ temperature, top_p }, { withSeed: false }),
      });

      let fullText = '';
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
      console.debug(`[STREAM-CHUNK] [anthropic] total chunks forwarded: ${chunkCount} in ${Date.now() - streamStartTime}ms`);

      // v1.23.0 P2: Collect Anthropic extended thinking content (Opus 4.6+)
      // from the post-stream Promise. Mirrors the OpenAI SDK pattern.
      let reasoningContent = '';
      try {
        reasoningContent = extractReasoningText(await result.reasoning);
      } catch {
        // No reasoning for this model — ignore.
      }
      if (reasoningContent) {
        fullText = wrapReasoningContent(reasoningContent, fullText);
      }
      return fullText;
    } catch (err) {
      // URL fallback for streaming — same logic as createMessage.
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
            enableThinking,
            repetitionPenalty: repetition_penalty,
          }) as unknown as Parameters<typeof streamText>[0]['providerOptions'],
          ...buildSamplingArgs({ temperature, top_p }, { withSeed: false }),
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
