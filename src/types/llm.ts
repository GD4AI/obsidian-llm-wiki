/**
 * LLM transport types: the provider shape, the message and client contract.
 *
 * Split out of `types.ts` by #929. Nothing here imports the barrel.
 */
import type { z } from 'zod';
import type { OutputMode } from '../llm-sdk/output-mode-prober';

// LLM Provider configuration

export interface ProviderConfig {
  id: string;
  name: string; // Deprecated: use nameEn/nameZh instead
  nameEn: string; // English provider name
  nameZh: string; // Chinese provider name
  baseUrl: string;
  apiKeyPlaceholder: string;
  apiKeyPlaceholderEn?: string; // English placeholder
  apiKeyPlaceholderZh?: string; // Chinese placeholder
  requiresBaseUrl: boolean;
  authMode: 'api-key' | 'none' | 'codex-oauth';
  /**
   * v1.26.3 PATCH (Issue #443): whether the openai-compat SDK client
   * should create the compat provider with
   * `supportsStructuredOutputs: true`. When true AND a caller supplies
   * a `schema` on `response_format`, the AI SDK encodes
   * `response_format: { type: 'json_schema', json_schema: { ... } }`
   * on the wire. Local servers (LM Studio / Ollama / self-hosted
   * `custom`) accept this form; cloud compat servers
   * (openrouter / deepseek / kimi / glm) accept `json_object` and
   * should NOT receive `json_schema` (they may 400 on it). The
   * openai / anthropic / codex paths go through their own SDK
   * clients and are unaffected by this flag.
   */
  supportsStructuredOutputs?: boolean;
  /**
   * Issue #723: extra headers this provider requires on every request. Values
   * may contain the `{sessionId}` placeholder, replaced once per client with a
   * stable UUID — that is how OpenCode gets its required per-conversation
   * `x-opencode-session` without the table having to compute one at module load.
   * Merged after the plugin's `User-Agent` and before the user's own headers.
   */
  defaultHeaders?: Record<string, string>;
  /**
   * Issue #723: which API shape the OpenAI-compatible path should speak.
   * `chat` (default, and what every existing preset uses) is
   * `/v1/chat/completions` via `@ai-sdk/openai-compatible`. `responses` is
   * `/v1/responses` via the already-bundled `@ai-sdk/openai`
   * (`createOpenAI({ baseURL }).responses(modelId)`), so it needs no new
   * dependency and no bespoke request adapter.
   *
   * Only meaningful for providers that route through the compat path; the
   * native OpenAI / Anthropic / Codex clients ignore it.
   */
  apiShape?: 'chat' | 'responses';
}
export interface OpenAICodexModelCatalogEntry {
  slug: string;
  displayName: string;
  supportedReasoningLevels: string[];
  additionalSpeedTiers: string[];
  serviceTiers: Array<{ id: string; name: string; description: string }>;
  defaultServiceTier?: string;
}

/**
 * A content part within a chat message. Extends the legacy `string` content
 * type with multi-modal support (file / image). String content is still
 * supported for backward compatibility — see `messages[].content: string | MessageContentPart[]`.
 *
 * v1.25.0 PDF Level 1: `type: 'file'` with `mediaType: 'application/pdf'`
 * is the wire format for PDF ingestion. The AI SDK v6 transparently maps
 * this to provider-native PDF blocks (Anthropic `document`, OpenAI `input_file`).
 */
export type MessageContentPart =
  | { type: 'text'; text: string }
  | { type: 'file'; data: string; mediaType: 'application/pdf'; filename?: string }
  | ImageContentPart;

/** A local image encoded as base64 for the AI SDK's multimodal input. */
export type ImageContentPart = {
  type: 'image';
  image: string;
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' | 'image/bmp';
};

/** User messages may carry images; assistant messages retain text/file compatibility. */
export type LLMMessage =
  | { role: 'user'; content: string | MessageContentPart[] }
  | { role: 'assistant'; content: string | Exclude<MessageContentPart, ImageContentPart>[] };

/**
 * Why the provider stopped generating. Mirrors the AI SDK v6 `FinishReason`
 * union, which normalizes the OpenAI `finish_reason` field and the Anthropic
 * `stop_reason` field into one vocabulary.
 *
 * Issue #305: `'length'` is the only reliable truncation signal. An
 * OpenAI-compatible provider does not throw on truncation — it returns HTTP
 * 200 with a body that stops mid-token — so callers that only observe the
 * response text cannot tell a truncated answer from a complete one.
 */
export type LLMFinishReason =
  | 'stop'
  | 'length'
  | 'content-filter'
  | 'tool-calls'
  | 'error'
  | 'other'
  | 'unknown';

/** Token usage for a single LLM call (AI-SDK v6 shape). Any field may be
 *  undefined when a provider omits usage from its response. */
export interface LLMUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  /**
   * Reasoning tokens counted inside `outputTokens`. Normalized by
   * `normalizeUsage` from the SDK's `outputTokenDetails.reasoningTokens`
   * (its deprecated top-level `reasoningTokens` is the fallback), which in
   * turn comes from `usage.completion_tokens_details.reasoning_tokens` on
   * the wire.
   *
   * Undefined means "the provider said nothing", which is not the same as
   * zero: a provider that omits the field and a model that did not think
   * are indistinguishable from the response alone, and only the second is
   * a statement about the model.
   */
  reasoningTokens?: number;
}

/** Metadata surfaced by SDK-backed clients via `onFinish` (Issue #305 +
 *  token usage). Additive: callers that ignore it are unaffected. */
export interface LLMFinishMeta {
  finishReason: LLMFinishReason;
  usage?: LLMUsage;
}

export interface LLMClient {
  createMessage(params: {
    model: string;
    max_tokens: number;
    system?: string;
    messages: LLMMessage[];
    response_format?:
      | { type: 'json_object' }
      // v1.26.3 PATCH pilot (Issue #443): a schema can now travel with
      // the response_format request. When the openai-compat SDK client
      // is created with `supportsStructuredOutputs: true` (currently
      // LM Studio / Ollama / `provider: custom`) AND a schema is
      // supplied, the AI SDK's `responseFormat: { type: 'json', schema }`
      // path is used, which the compat provider encodes as
      // `response_format: { type: 'json_schema', json_schema: { ... } }`
      // on the wire. Without a schema, the SDK falls back to
      // `json_object` (unchanged behaviour for the existing 15 call sites
      // that have not yet opted in).
      | { type: 'json_object'; schema?: Record<string, unknown> };
    /**
     * Anthropic prompt-cache breakpoint offset. Anthropic SDK honors this;
     * OpenAI / openai-compat / OpenAI Codex clients ignore the field (AI SDK
     * does not expose cache hooks for those providers). See Issue #449 + Issue #468.
     */
    cacheBreakpoint?: number;
    /**
     * Which step of the pipeline is asking. Purely for accounting: an ingest is
     * ten different call sites with different shapes — some write prose and are
     * decode-bound, some answer in a dozen tokens over a long prompt — and a
     * single total cannot tell them apart, so it cannot say where the time went.
     * Clients ignore it; the CLI groups its usage report by it.
     */
    task?: string;
    /**
     * Pin the wire output mode for this one call, bypassing the
     * OutputModeProber's cached choice. Set by the client wrapper from the
     * per-task policy (`src/core/task-policy.ts`); no call site passes it.
     *
     * Why it exists: `text_prompt` is the only mode that puts no
     * `response_format` on the request, and per #481 that is the only way a
     * schema-carrying step can think at all. A 400-driven demotion cannot
     * serve here — it is a repair, and it never fires on a backend that
     * accepts the schema.
     */
    outputModeOverride?: OutputMode;
    maxTokensPerCall?: number;  // Issue #75: cap for truncation retry
    enableThinking?: boolean;   // ROADMAP P3 #12: allow thinking for thinking-capable models
    /**
     * Bound the thinking rather than only permitting it. Sent as
     * `reasoning_effort` at the named level — the same wire key the
     * force-disable path uses with `'none'`. Set by the wrapper from the
     * per-task policy; no call site passes it.
     */
    reasoningEffort?: 'low' | 'medium' | 'high';
    temperature?: number;       // Issue #128: per-request sampling temperature
    /**
     * Issue #916: accept an empty answer instead of raising.
     *
     * An empty answer is never useful, so the clients raise on it by default
     * — an empty response used to render as a blank pane with no error
     * anywhere. One call site has a different contract: `lint/fix-dead-link.ts`
     * probes with `response_format: json_object`, and an empty response there
     * means "this backend rejected the JSON mode", so it retries without it.
     * That probe needs the empty string back, so it sets this.
     */
    allowEmptyResponse?: boolean;
    /**
     * Nucleus sampling. Travels with `temperature` because a preset is a pair:
     * sending one and leaving the other to the server compares two halves of
     * two different presets, which is not a comparison of anything.
     */
    top_p?: number;
    /**
     * Fixed sampling seed. Unset — the default — leaves the provider free to
     * pick a fresh one per request, which is normal generation behaviour but
     * means no comparison between two versions of a prompt can tell a change
     * from the sampler.
     */
    seed?: number;
    repetition_penalty?: number; // Issue #128 follow-up: llama.cpp extension
    chat_template_kwargs?: Record<string, unknown>; // Issue #99: template-based reasoning disable
    // v1.25.0 PR3 follow-up #8 (Bug D, e2e 2026-07-17): cancellation
    // signal for long-running calls. The PDF converter threads the
    // engine's AbortSignal through so a status-bar click during PDF
    // conversion actually aborts the LLM call rather than only
    // finishing the post-conversion phase. AI SDK v6 accepts this
    // natively; legacy clients ignore it.
    abortSignal?: AbortSignal;
    // Issue #305: optional out-channel for response metadata. The SDK-backed
    // clients invoke this once, immediately before returning the text. It is
    // additive on purpose — `createMessage` keeps returning `Promise<string>`,
    // so every existing caller and every mock client is unaffected. Callers
    // that need to distinguish "the model finished" from "the model ran out
    // of tokens" opt in; callers that do not, see no change.
    onFinish?: (meta: LLMFinishMeta) => void;
  }): Promise<string>;

  // v1.26.3 PATCH Phase B (Issue #443): typed-output variant. Opt-in
  // for callers that want the AI SDK's `Output.object({schema})`
  // parsed-object result (Tier 0 success) instead of the raw text.
  // Returns the same `text` for backward compatibility, plus an
  // `output` field that's populated when `Output.object` parsed
  // successfully (Tier 0 on supported backends).
  //
  // OPTIONAL — clients that don't implement it fall back to
  // `createMessage` + caller-side `parseJsonResponse`. Anthropic /
  // OpenAI / Codex clients do not implement this method yet (their
  // 3 callers — `seed-selector` etc. — currently use no schema; the
  // 6 P0 Phase B migrations only touch openai-compat callers).
  //
  // When `outputMode === 'text_prompt'` or `json_object`, `output`
  // is undefined (no SDK parse happened — the model emitted free-form
  // text) and the caller is expected to run `parseJsonResponse(text)`
  // to recover the structured object. This matches the existing
  // 16-callers contract (Tier 1 path).
  createMessageWithOutput?<T = unknown>(params: {
    model: string;
    max_tokens: number;
    system?: string;
    messages: LLMMessage[];
    // v1.26.3 PATCH Phase B: `schema` accepts either a raw JSON Schema
    // (legacy callers) or a Zod schema (Phase B migrations — the Zod
    // schema is the single source of truth for both the Tier 0 wire
    // shape and the Tier 1/2 fallback parseJsonResponse validation).
    response_format?: { type: 'json_object'; schema?: Record<string, unknown> | z.ZodType };
    /**
     * Aborts the request (#646). The engine's cancel flips it; the SDK
     * clients hand it to the AI SDK, which aborts the HTTP request. Without
     * it a cancel waits for the running call to finish.
     */
    abortSignal?: AbortSignal;
    task?: string;
    /** See `createMessage`. Set by the wrapper from the per-task policy. */
    outputModeOverride?: OutputMode;
    enableThinking?: boolean;
    /** See `createMessage`. */
    reasoningEffort?: 'low' | 'medium' | 'high';
    temperature?: number;
    top_p?: number;
    seed?: number;
    repetition_penalty?: number;
    onFinish?: (meta: LLMFinishMeta) => void;
  }): Promise<{
    text: string;
    output?: T;
    outputMode: 'json_schema' | 'json_schema_strict' | 'json_object' | 'text_prompt';
    finishReason: LLMFinishReason;
    usage?: LLMUsage;
  }>;

  createMessageStream?(params: {
    model: string;
    max_tokens: number;
    system?: string;
    messages: LLMMessage[];
    onChunk: (chunk: string) => void;
    enableThinking?: boolean;
    temperature?: number;
    top_p?: number;
    seed?: number;
    repetition_penalty?: number;
    /** Step label for per-task LLM accounting (Issue #469) — same contract as createMessage. */
    /** Aborts the request (#646) — see `createMessage`. */
    abortSignal?: AbortSignal;
    task?: string;
    /** Issue: streamed answers were truncated silently — surface finish_reason. */
    onFinish?: (meta: LLMFinishMeta) => void;
  }): Promise<string>;

}
