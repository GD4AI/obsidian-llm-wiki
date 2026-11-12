// #1019: the output ceiling for a generation call is resolved, not declared.
//
// The old shape was one constant, `TOKENS_PAGE_GENERATION`, passed by every
// page-writing call site. That fails in both directions and neither failure is
// visible from the constant: a reasoning model can spend the whole ceiling before
// it writes anything, and the one setting a user would reach for
// (`maxTokensPerCall`) could only lower the value.
//
// Five layers, first available wins:
//
//   1. the user's `maxTokensPerCall` — the only deliberate instruction
//   2. the ceiling a provider accepted last time, keyed by (baseURL, model)
//   3. the provider's own limit: omitted for `anthropic` and `openai`, where the
//      SDK or the service already knows it; `TOKENS_PAGE_GENERATION` otherwise,
//      because a compat server decides for itself and nothing is knowable
//   4. `contextWindow - inputTokens`, when the user declared a window
//   5. `TOKENS_PAGE_GENERATION`, when all of the above are silent
//
// There is deliberately no table of per-model limits: it would go stale between
// releases and could never cover a custom gateway. The two numbers the plug-in can
// trust are ones it is told — by the user, by a provider's acceptance, or by a
// context window the user owns.

import { TOKENS_GENERATION_FLOOR, TOKENS_PAGE_GENERATION } from '../constants';
import type { LLMClient, LLMFinishMeta } from '../types/llm';
import { estimateTokens } from './context-budget';
import { outputCeilingCache, rememberCeiling } from './output-ceiling-cache';
import { ceilingAfterRejection } from './output-ceiling-probe';

/**
 * Providers whose output limit is known without being told.
 *
 * `anthropic`: `@ai-sdk/anthropic` resolves `maxOutputTokens ?? maxOutputTokensForModel`
 * and clamps to the model's limit. `openai`: an absent `max_completion_tokens` means
 * the model's limit. Declaring a number here would replace a known value with a guess.
 */
const PROVIDERS_WITH_KNOWN_LIMIT = new Set(['anthropic', 'openai']);

export interface GenerationCeilingInput {
  /** Provider id, used only to decide whether the limit is already known. */
  provider?: string;
  /** The user's declaration. `0` or absent means "not set". */
  maxTokensPerCall?: number;
  /** The user's declared window, input and output together. */
  contextWindow?: number;
  /** Part of the cache key: the limit belongs to the backend behind the URL. */
  baseUrl?: string;
  /** The resolved model for this step, also part of the cache key. */
  modelRef: string;
  /** Prompt tokens, so a declared window bounds the answer rather than the call. */
  inputTokens: number;
  /**
   * Layer 5's value, and layer 3's for a provider with no readable limit.
   * Defaults to `TOKENS_PAGE_GENERATION`; the append path passes its own 4,000,
   * because a short addition does not need a page's room.
   */
  fallbackCeiling?: number;
}

/**
 * The ceiling to declare for one generation call, or `undefined` to declare none.
 *
 * `undefined` is a real answer, not a missing one: for the two providers whose
 * limit is already known, declaring nothing is what makes the model's own maximum
 * apply.
 */
export function resolveGenerationCeiling(input: GenerationCeilingInput): number | undefined {
  const declared = input.maxTokensPerCall && input.maxTokensPerCall > 0
    ? input.maxTokensPerCall
    : undefined;
  const familyDefault = input.fallbackCeiling ?? TOKENS_PAGE_GENERATION;
  const learned = outputCeilingCache.get(input.baseUrl ?? '', input.modelRef);

  const base = declared
    ?? learned
    ?? (PROVIDERS_WITH_KNOWN_LIMIT.has(input.provider ?? '') ? undefined : familyDefault);

  if (input.contextWindow && input.contextWindow > 0) {
    // The window holds input and output together, and the input is assembled here,
    // so the answer's room is arithmetic rather than a guess. When the room is
    // smaller than the generation floor the input does not fit the declared window
    // at all: declaring the floor makes the provider reject the request, which is
    // visible, where declaring the sliver would produce a silently truncated page.
    const room = Math.max(0, input.contextWindow - Math.max(0, input.inputTokens));
    const bounded = Math.max(TOKENS_GENERATION_FLOOR, room);
    return Math.min(base ?? bounded, bounded);
  }

  return base;
}

/**
 * Build the resolver input for one call site.
 *
 * The prompt parts are estimated here rather than at each call site: a declared
 * context window bounds the answer by subtracting the input, and the input is the
 * exact text the request will carry.
 */
export function generationBudget(
  settings: {
    provider?: string;
    maxTokensPerCall?: number;
    contextWindow?: number;
    baseUrl?: string;
  },
  modelRef: string,
  prompts: ReadonlyArray<string | undefined>,
  fallbackCeiling?: number,
): GenerationCeilingInput {
  const text = prompts.filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join('\n');
  return {
    provider: settings.provider,
    maxTokensPerCall: settings.maxTokensPerCall,
    contextWindow: settings.contextWindow,
    baseUrl: settings.baseUrl,
    modelRef,
    inputTokens: estimateTokens(text),
    ...(fallbackCeiling !== undefined ? { fallbackCeiling } : {}),
  };
}

/**
 * One plain-text generation call, with the ceiling resolved for it.
 *
 * The four page-writing call sites differ only in their task label, prompt and
 * `onFinish`, so the resolver and the retry are stated once here. Extracting this
 * also keeps `mergePage` and `ingestConversation` inside their recorded length
 * ceilings: the wrapper costs seven lines at each site, and the ratchet may not be
 * raised to absorb them.
 */
export interface PageTextCall {
  task: string;
  model: string;
  system: string;
  prompt: string;
  onFinish?: (meta: LLMFinishMeta) => void;
  /** Layer 5 for this call. Defaults to `TOKENS_PAGE_GENERATION`. */
  fallbackCeiling?: number;
}

export async function generatePageText(
  client: Pick<LLMClient, 'createMessage'>,
  settings: {
    provider?: string;
    maxTokensPerCall?: number;
    contextWindow?: number;
    baseUrl?: string;
    disableThinking?: boolean;
  },
  call: PageTextCall,
): Promise<string> {
  const budget = generationBudget(
    settings,
    call.model,
    [call.system, call.prompt],
    call.fallbackCeiling,
  );
  return callWithCeilingFallback(budget, (maxTokens) => client.createMessage({
    task: call.task,
    model: call.model,
    ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
    system: call.system,
    messages: [{ role: 'user', content: call.prompt }],
    ...(settings.disableThinking ? { enableThinking: false } : {}),
    ...(call.onFinish ? { onFinish: call.onFinish } : {}),
  }));
}

/**
 * Run one generation call, stepping the ceiling down when the provider rejects it.
 *
 * The retry is bounded by `ceilingAfterRejection`: two probes, halving, and only
 * for an error that names the output ceiling. A reasoning-only failure is not
 * retried, because the ceiling was not the problem and halving it would make the
 * failure certain rather than possible.
 */
export async function callWithCeilingFallback<T>(
  input: GenerationCeilingInput,
  attempt: (maxTokens: number | undefined) => Promise<T>,
): Promise<T> {
  const key = { baseUrl: input.baseUrl ?? '', model: input.modelRef };
  let ceiling = resolveGenerationCeiling(input);
  let probes = 0;

  for (;;) {
    try {
      return await attempt(ceiling);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const next = ceiling === undefined
        ? null
        : ceilingAfterRejection(ceiling, probes, message, TOKENS_GENERATION_FLOOR);
      if (next === null) throw error;
      probes += 1;
      ceiling = rememberCeiling(key, next);
      console.debug(`Provider rejected the output ceiling; retrying this page with ${ceiling}`);
    }
  }
}
