import { createOpenAI } from '@ai-sdk/openai';
import { Output, streamText, type LanguageModel } from 'ai';
import { obsidianFetchBridge } from '../core/obsidian-fetch-bridge';
import type { LLMClient } from '../types';
import { mapAiSdkError } from './openai-sdk-client';
import type { CodexAuthManager } from './openai-codex/auth-manager';
import { CODEX_MODELS } from './openai-codex/constants';
import { normalizeCodexRequest } from './openai-codex/request-adapter';
import { wrapReasoningContent } from '../core/markdown';
import { extractReasoningText } from './finish-reason';
import { forcedTextPromptSystem } from './json-prompt-prefix';

type CodexAuth = Pick<CodexAuthManager, 'getAccess' | 'refreshAfterUnauthorized'>;
type CodexFetch = (url: string, init?: RequestInit) => Promise<Response>;

export interface OpenAICodexSdkClientOptions {
  auth: CodexAuth;
  fetch?: CodexFetch;
  streamFetch?: CodexFetch;
  sessionId: () => string;
  version: string;
  quotaMessage?: string;
}

interface CodexRequestFetchOptions {
  auth: CodexAuth;
  fetchImpl: CodexFetch;
  sessionId: () => string;
  version: string;
  quotaMessage?: string;
}

const AUTH_FORBIDDEN_CODES = new Set(['authentication_error', 'expired_token', 'invalid_authentication', 'invalid_token', 'token_expired', 'unauthorized']);
const DEFAULT_CODEX_QUOTA_MESSAGE = 'ChatGPT Codex allowance reached. Wait for the displayed reset period and try again.';

async function cancelResponseBody(response: Response): Promise<void> {
  if (!response.body || response.bodyUsed || response.body.locked) return;
  try {
    await response.body.cancel();
  } catch {
    return;
  }
}

function throwIfAborted(signal: AbortSignal | null | undefined): void {
  if (signal?.aborted) signal.throwIfAborted();
}

function structuredErrorCode(input: unknown): string | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  const nested = typeof value.error === 'object' && value.error !== null && !Array.isArray(value.error) ? value.error as Record<string, unknown> : null;
  for (const candidate of [nested?.code, nested?.type, value.code, value.type]) {
    if (typeof candidate === 'string') return candidate.toLowerCase();
  }
  return null;
}

async function isAuthenticationForbidden(response: Response): Promise<boolean> {
  if (response.status !== 403) return false;
  if (response.headers.has('www-authenticate')) return true;
  try {
    const code = structuredErrorCode(await response.clone().json());
    if (code !== null) return AUTH_FORBIDDEN_CODES.has(code);
  } catch {
    if (response.headers.has('cf-ray') || response.headers.get('server')?.toLowerCase().includes('cloudflare')) return false;
  }
  return false;
}

export function createCodexRequestFetch(options: CodexRequestFetchOptions): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const access = await options.auth.getAccess();
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const sessionId = options.sessionId();
    const normalized = normalizeCodexRequest({ url, init: init ?? {}, access, sessionId, version: options.version });
    const response = await options.fetchImpl(normalized.url, normalized.init);
    if (response.status === 429) {
      await cancelResponseBody(response);
      throw new Error(options.quotaMessage ?? DEFAULT_CODEX_QUOTA_MESSAGE);
    }
    const authenticationFailure = response.status === 401 || await isAuthenticationForbidden(response);
    if (!authenticationFailure) return response;
    await cancelResponseBody(response);
    throwIfAborted(init?.signal);
    const refreshed = await options.auth.refreshAfterUnauthorized(access.accessToken, response.status);
    throwIfAborted(init?.signal);
    const replay = normalizeCodexRequest({ url, init: init ?? {}, access: refreshed, sessionId, version: options.version });
    return options.fetchImpl(replay.url, replay.init);
  };
}

export class OpenAICodexSdkClient implements LLMClient {
  private readonly auth: CodexAuth;
  private readonly streamFetchImpl: CodexFetch;
  private readonly sessionId: () => string;
  private readonly version: string;
  private readonly quotaMessage: string;
  constructor(options: OpenAICodexSdkClientOptions) {
    this.auth = options.auth;
    this.streamFetchImpl = options.streamFetch ?? options.fetch ?? (obsidianFetchBridge as unknown as CodexFetch);
    this.sessionId = options.sessionId;
    this.version = options.version;
    this.quotaMessage = options.quotaMessage ?? DEFAULT_CODEX_QUOTA_MESSAGE;
  }
  // `seed` and `max_output_tokens` are deliberately absent: the Codex backend
  // accepts neither, so a setting for them is honoured everywhere else and
  // silently does nothing here. `top_p` and `temperature` are also stripped by
  // `normalizeResponsesBody` in `openai-codex/request-adapter.ts` (which calls
  // `delete normalized.top_p` / `temperature` before the wire request) — so
  // even though we forward them through the SDK here, they never reach the
  // Codex endpoint. Comment updated 2026-07-30 (PR #372 review): the previous
  // wording claimed the pair was forwarded, but the adapter strip predates
  // this client and is the authoritative behaviour. Restoring the strip
  // removal would re-test Codex's actual response shape, which is out of scope
  // for this PR.
  //
  // The pairing invariant still holds: a preset is the pair, and sending half
  // of one is the failure this code path exists to absorb — it now does so by
  // stripping both, not by forwarding both.
  // Issue #524 follow-up (#525 review): a per-task policy that pins
  // `text_prompt` has to reach this client too. Before, `outputModeOverride`
  // was simply not read here, so `extract` stayed in JSON-output mode on the
  // Codex provider while every other provider honoured the built-in pin — the
  // one step whose wire shape the whole issue was about. `Output.json()` is
  // the SDK's own structured-output path, so leaving it on also routes the
  // reply around the plugin's JSON repair; pinning text mode means dropping it
  // and carrying the JSON instruction in the system prompt instead, exactly as
  // the openai-compat client does.
  async createMessage(params: Parameters<LLMClient['createMessage']>[0]): Promise<string> {
    const model = this.getModel(params.model, this.streamFetchImpl);
    const forcedText = params.outputModeOverride === 'text_prompt';
    const system = forcedTextPromptSystem(params.system, params.response_format, params.outputModeOverride);
    try {
      let streamError: unknown;
      const result = streamText({ model, ...(system ? { system } : {}), messages: params.messages, ...(params.abortSignal ? { abortSignal: params.abortSignal } : {}), maxOutputTokens: params.max_tokens, ...(params.temperature !== undefined ? { temperature: params.temperature } : {}), ...(params.top_p !== undefined ? { topP: params.top_p } : {}), ...(!forcedText && params.response_format?.type === 'json_object' ? { output: Output.json() } : {}), providerOptions: this.providerOptions(params.enableThinking), maxRetries: 0, onError: ({ error }) => { streamError = error; } });
      let text = '';
      for await (const chunk of result.textStream) text += chunk;
      if (streamError !== undefined) throw streamError instanceof Error ? streamError : new Error(typeof streamError === 'string' ? streamError : 'Codex stream failed');
      return text;
    } catch (error) {
      throw mapAiSdkError(error);
    }
  }
  async createMessageStream(params: Parameters<NonNullable<LLMClient['createMessageStream']>>[0]): Promise<string> {
    const model = this.getModel(params.model, this.streamFetchImpl);
    try {
      const result = streamText({ model, ...(params.system ? { system: params.system } : {}), messages: params.messages, maxOutputTokens: params.max_tokens, ...(params.temperature !== undefined ? { temperature: params.temperature } : {}), ...(params.top_p !== undefined ? { topP: params.top_p } : {}), providerOptions: this.providerOptions(params.enableThinking), maxRetries: 0 });
      let text = '';
      for await (const chunk of result.textStream) {
        text += chunk;
        params.onChunk(chunk);
      }
      // Match openai-sdk-client / openai-compat-sdk-client / anthropic-sdk-client:
      // collect the post-stream reasoning channel and wrap as <think> so the
      // Query UI's extractThinkingPanel renders it as a collapsible <details>
      // block. Without this, reasoning-capable Codex models (o-series)
      // appear to "lose" their chain-of-thought in the Query response.
      let reasoningContent = '';
      try {
        reasoningContent = extractReasoningText(await result.reasoning);
      } catch {
        /* no reasoning for this provider — ignore */
      }
      if (reasoningContent) {
        text = wrapReasoningContent(reasoningContent, text);
      }
      return text;
    } catch (error) {
      throw mapAiSdkError(error);
    }
  }
  async listModels(): Promise<string[]> {
    return [...CODEX_MODELS];
  }
  private getModel(modelId: string, fetchImpl: CodexFetch): LanguageModel {
    const provider = createOpenAI({ apiKey: 'codex-oauth', fetch: createCodexRequestFetch({ auth: this.auth, fetchImpl, sessionId: this.sessionId, version: this.version, quotaMessage: this.quotaMessage }) });
    return provider.responses(modelId);
  }
  private providerOptions(enableThinking: boolean | undefined): Record<string, Record<string, string>> {
    return enableThinking === false ? { openai: { reasoningEffort: 'low' } } : {};
  }
}
