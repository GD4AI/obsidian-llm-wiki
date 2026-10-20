// Thin wrapper that injects advanced settings into createMessage calls.
// v1.20.0: by default the plugin does NOT inject any provider-specific
// thinking-control / temperature / repetition_penalty field. Each setting
// is only sent when the caller explicitly passed it AND when the user has
// configured a value in Custom Advanced Settings. This keeps backward
// compatibility: empty/undefined settings mean "use provider default".
//
// Issue #99: disableThinking (data.json field) was a v1.18.2 opt-out that
// was flipped to opt-in in v1.20.0 — see types.ts for the new semantics.
// When the user does enable it, the LLMClient itself walks the 3-tier
// dialect fallback (anthropic → openai → none). The wrapper stays passive.
// Issue #128: extractionTemperature / chatTemperature inject `temperature`.
// Issue #128 follow-up: repetitionPenalty injects `repetition_penalty`.
// Issue #75: maxTokensPerCall cap wraps max_tokens via capMaxTokens.
//
// v1.26.4 PATCH (Issue #451): createMessageStream was silently inheriting
// verbatim via Object.create, dropping temperature/top_p/seed/repetitionPenalty
// on the stream path. Added explicit override that mirrors the
// createMessage / createMessageWithOutput pattern via shared helpers below.

import { LLMClient } from './types';
import { capMaxTokens } from './core/token-cap';
import { recordTaskUsage } from './core/llm-task-usage';
import { resolveTaskPolicy, thinkingEffort, type TaskPolicyMap, type ThinkingEffort } from './core/task-policy';
import type { OutputMode } from './llm-sdk/output-mode-prober';

export interface WrapperSettings {
  maxTokensPerCall: number;
  extractionTemperature?: number;
  /**
   * Nucleus sampling for extraction. Its partner, not an independent knob: a
   * server preset sets the two together, so overriding only the temperature
   * leaves the run on half of one preset and half of another.
   */
  extractionTopP?: number;
  /** Fixed sampling seed. Unset means the provider picks one per request. */
  samplingSeed?: number;
  chatTemperature?: number;
  repetitionPenalty?: number;
  /**
   * Issue #481 follow-up: per-step output mode / thinking. Unset means every
   * step keeps today's behaviour — see src/core/task-policy.ts.
   */
  taskPolicies?: TaskPolicyMap;
}

// Closed union for the [llm] debug-log breadcrumb. Stays narrow so a typo
// becomes a compile error instead of a degraded debug log.
type LlmCallKind = 'plain' | 'typed' | 'stream';

/**
 * Concrete overlay type for the 5 settings this wrapper injects + the cap.
 * Returning this (instead of `Record<string, unknown>`) keeps excess-property
 * checks at the helper's return site, so a typo'd key is a compile error
 * rather than a silent wire-level drop.
 */
type AdvancedSettingsOverlay = Partial<{
  max_tokens: number;
  temperature: number;
  top_p: number;
  repetition_penalty: number;
  seed: number;
  maxTokensPerCall: number;
}>;

/**
 * Returns a new LLMClient whose `createMessage` injects advanced settings
 * when set; otherwise passes through. The returned client's `createMessage`
 * never modifies a caller-provided parameter — only fills in unset ones.
 *
 * v1.23.2 refactor: replaced `.bind()` + in-place mutation (the old
 * pattern silently mutated the caller's client reference) with
 * `Object.create(client)` + explicit override of `createMessage`.
 * spread `{ ...client }` is NOT used because `OpenAICompatSdkClient`
 * (and other implementations) define `createMessageStream` as a
 * prototype method — spread only captures own
 * enumerable properties, which drops all prototype methods.
 * `Object.create(client)` preserves the prototype chain, so prototype
 * methods stay available; `createMessage`,
 * `createMessageWithOutput`, and `createMessageStream` are explicitly
 * overridden below whenever the client implements them (Issue #451).
 */
export function wrapWithAdvancedSettings(
  client: LLMClient,
  settings: WrapperSettings
): LLMClient {
  const capTokens = settings.maxTokensPerCall > 0;

  // Preserve prototype chain — Object.create inherits the prototype
  // methods from the original client.
  const wrapper = Object.create(client) as LLMClient;
  wrapper.createMessage = (params) => withTaskAccounting(params.task, async () => {
    logLlmCall(params.task, params.model, params.max_tokens, 'plain');
    return client.createMessage({
      ...params,
      ...injectAdvancedSettings(params, settings, capTokens),
      ...applyTaskPolicy(params.task, settings),
    });
  });

  if (client.createMessageWithOutput) {
    wrapper.createMessageWithOutput = (params) => withTaskAccounting(params.task, async () => {
      logLlmCall(params.task, params.model, params.max_tokens, 'typed');
      return client.createMessageWithOutput!({
        ...params,
        ...injectAdvancedSettings(params, settings, capTokens),
        ...applyTaskPolicy(params.task, settings),
      });
    });
  }

  // Issue #451: createMessageStream previously inherited verbatim via
  // Object.create, silently dropping advanced settings on the stream path.
  // Issue #469: the interface now carries a task label, so the stream path
  // accounts under the step like every other caller — Query Wiki streams
  // under 'query-wiki' instead of a merged 'untagged' row — and the same
  // label keys the per-step thinking policy (see applyTaskPolicy).
  if (client.createMessageStream) {
    wrapper.createMessageStream = (params) => withTaskAccounting(params.task, async () => {
      logLlmCall(params.task, params.model, params.max_tokens, 'stream');
      const { enableThinking } = applyTaskPolicy(params.task, settings);
      return client.createMessageStream!({
        ...params,
        ...injectAdvancedSettings(params, settings, capTokens),
        ...(enableThinking !== undefined ? { enableThinking } : {}),
      });
    });
  }
  return wrapper;
}

// Build the settings-injection overlay used by all three wrapper blocks.
// Caller-wins semantics: each spread only fires when the caller's params
// omitted the field AND the setting was configured.
//
// Returns `AdvancedSettingsOverlay` (not `Record<string, unknown>`) so a
// typo'd key inside the literal is caught at compile time. Issue #451 was
// the silent-drop class; this typed return prevents re-opening it inside
// the helper.
function injectAdvancedSettings(
  params: { max_tokens?: number; temperature?: number; top_p?: number; repetition_penalty?: number; seed?: number },
  settings: WrapperSettings,
  capTokens: boolean,
): AdvancedSettingsOverlay {
  const maxTokensPresent = params.max_tokens !== undefined;
  return {
    ...(capTokens && maxTokensPresent ? { max_tokens: capMaxTokens(params.max_tokens as number, { maxTokensPerCall: settings.maxTokensPerCall }) } : {}),
    ...(capTokens ? { maxTokensPerCall: settings.maxTokensPerCall } : {}),
    ...(params.temperature === undefined && settings.extractionTemperature !== undefined ? { temperature: settings.extractionTemperature } : {}),
    ...(params.top_p === undefined && settings.extractionTopP !== undefined ? { top_p: settings.extractionTopP } : {}),
    ...(params.repetition_penalty === undefined && settings.repetitionPenalty !== undefined ? { repetition_penalty: settings.repetitionPenalty } : {}),
    ...(params.seed === undefined && settings.samplingSeed !== undefined ? { seed: settings.samplingSeed } : {}),
  };
}

/**
 * Overlay for the per-step policy (Issue #481 follow-up).
 *
 * Applied after `injectAdvancedSettings` and therefore wins over it and over
 * the call site: the policy names one step deliberately, while the call site
 * passes `disableThinking` because every call site does. An unset policy
 * spreads `{}` and changes nothing, which is what keeps the default path
 * byte-identical to pre-#481.
 *
 * The stream path takes only the thinking half: it has no output mode (a
 * stream is text by construction) and its interface carries no effort
 * level, so a named level rides as `enableThinking: true` and the budget
 * is left to the client's default. Until now the stream path was skipped
 * altogether — the note here said it carried no `task` label, which #469
 * ended: Query Wiki streams under 'query-wiki', and a policy of
 * `*=default:off` reached every step except the one the user waits for.
 */
function applyTaskPolicy(
  task: string | undefined,
  settings: WrapperSettings,
): Partial<{
  outputModeOverride: OutputMode;
  enableThinking: boolean;
  reasoningEffort: ThinkingEffort;
}> {
  const policy = resolveTaskPolicy(settings.taskPolicies, task);
  const effort = thinkingEffort(policy.thinking);
  return {
    ...(policy.outputMode !== 'default' ? { outputModeOverride: policy.outputMode } : {}),
    ...(policy.thinking !== 'default' ? { enableThinking: policy.thinking !== 'off' } : {}),
    // A named level is `on` plus a budget; it rides alongside enableThinking
    // rather than replacing it, because the suppression field and the effort
    // field are the same wire key and the client decides which value it takes.
    ...(effort ? { reasoningEffort: effort } : {}),
  };
}

// The one seam every call passes through (`createLLMClient` always returns
// this wrapper), so the step's name is logged here rather than at twelve
// call sites. Without it the debug log prints a provider, a model and a
// prompt length per call and never says which step asked. Stubbed out in
// production builds along with every other `console.debug`. Format is
// pre-#451: `(typed)` / `(stream)` disambiguate the breadcrumb.
function logLlmCall(task: string | undefined, model: string, maxTokens: number, kind: LlmCallKind): void {
  const suffix = kind === 'plain' ? '' : ` (${kind})`;
  console.debug(`[llm] task=${task ?? 'untagged'} model=${model} max_tokens=${maxTokens}${suffix}`);
}

// Timed around the whole call, not on success: a call that throws still
// spent the time, and leaving it out would flatter whichever step fails.
async function withTaskAccounting<T>(task: string | undefined, fn: () => Promise<T>): Promise<T> {
  const startedAt = Date.now();
  try {
    return await fn();
  } finally {
    recordTaskUsage(task, Date.now() - startedAt);
  }
}