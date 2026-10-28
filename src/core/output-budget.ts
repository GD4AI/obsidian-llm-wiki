// output-budget.ts — how many output tokens one call may declare.
//
// Issue #904. The bug it exists to prevent: `max_tokens` is one ceiling that
// pays three bills — reasoning, answer, formatting (Azure OpenAI documents
// this explicitly; Gemini 4 says the same from the context side). A budget
// sized from the ANSWER alone therefore fails on any model that thinks,
// because the reasoning is not subtracted from the answer, it is subtracted
// from the same number.
//
// The rule this module encodes is deliberately one-sided:
//
//   A declared ceiling costs nothing when it is not used. A ceiling that is
//   too small costs the whole turn.
//
// So while reasoning is possible, do not guess how long it will be. Declare
// the model's own ceiling and let the model stop when it is done. Measure the
// answer only when thinking has been switched off and the provider accepted
// that (see `reasoningPossible`).
//
// Pure: no IO, no settings object, no defaults of its own. The caller resolves
// the ceiling and states whether reasoning is possible.

import { MAX_TOKENS_BATCH, DEFAULT_MODEL_OUTPUT_TOKENS } from '../constants';
import { resolveTaskPolicy, type TaskPolicyMap } from './task-policy';

/**
 * Global thinking level (Issue #904). Four values, no `off`:
 * switching thinking off is what the existing `disableThinking` toggle is
 * for, and duplicating it in a second control is how two sources of truth
 * start disagreeing.
 *
 * `default` sends nothing and lets the provider choose, which is what the
 * plugin did before this setting existed.
 */
export type ThinkingEffortSetting = 'default' | 'low' | 'medium' | 'high';

/** The subset of settings this module reads. */
export interface BudgetSettings extends OutputCeilingSettings {
  disableThinking?: boolean;
  thinkingEffort?: ThinkingEffortSetting;
  taskPolicies?: TaskPolicyMap;
}

export interface OutputCeilingSettings {
  /** User-chosen output ceiling per call. `0` or absent = Auto. */
  maxTokensPerCall?: number;
  /** User-declared context window. `0` or absent = Auto. */
  contextWindow?: number;
}

/**
 * Resolve the output ceiling for one call.
 *
 * `Auto` means the wide default (#904 decision: 128,000, the modal
 * current-generation limit — OpenAI and Anthropic both). A user choice wins
 * over the default, and the context window is a hard bound on top of both: a
 * request cannot emit more tokens than the window holds.
 *
 * Members that do not exist in a stored `data.json` stay `undefined`, so this
 * returns the default rather than a sentinel.
 */
export function resolveOutputCeiling(settings: OutputCeilingSettings): number {
  const chosen = settings.maxTokensPerCall && settings.maxTokensPerCall > 0
    ? settings.maxTokensPerCall
    : DEFAULT_MODEL_OUTPUT_TOKENS;
  const window = settings.contextWindow && settings.contextWindow > 0
    ? settings.contextWindow
    : Number.POSITIVE_INFINITY;
  return Math.min(chosen, window);
}

export interface ExtractionBudgetInput {
  /** Answer need: items x per-item budget. Measured, not guessed. */
  taskNeed: number;
  /** Ceiling resolved by `resolveOutputCeiling`. */
  ceiling: number;
  /**
   * True unless the step's thinking policy is `off` AND the provider honours
   * it. Providers that always think (Claude Opus 5.5) keep this true.
   */
  reasoningPossible: boolean;
}

/**
 * Output budget for one extraction call.
 *
 * Reasoning possible -> the ceiling, unchanged. Anything smaller is a guess
 * about reasoning length, and a guess is what produced the empty batch in
 * #904. Reasoning off -> the answer need, capped by the ceiling; there is no
 * second bill to pay, so the narrow number is the correct one.
 *
 * The answer need is floored at `MAX_TOKENS_BATCH` so a small batch never
 * declares less than the constant every existing test and caller assumes.
 * The ceiling is never exceeded in either branch: a declared value above the
 * model's limit is a guaranteed 400, which is the failure this module exists
 * to avoid, not one it may introduce.
 */
export function computeExtractionBudget(input: ExtractionBudgetInput): number {
  const answerNeed = Math.max(MAX_TOKENS_BATCH, input.taskNeed);
  return input.reasoningPossible
    ? input.ceiling
    : Math.min(input.ceiling, answerNeed);
}

/**
 * Will this step's request let the provider reason?
 *
 * Same precedence as the request itself, so the budget and the wire agree:
 *
 *   1. per-task policy (`taskPolicies`) — names one step deliberately, wins;
 *   2. the global toggle (`disableThinking`) — the user's on/off;
 *   3. the global level (`thinkingEffort`) — `default` and the named levels
 *      all permit reasoning, only the toggle forbids it.
 *
 * A provider that thinks anyway when asked not to (Claude Opus 5.5 refuses
 * `thinking: disabled` outright) lands in the narrow branch and can still
 * fail; the failure now says so, which is the most this can promise without
 * per-provider probing.
 */
export function isReasoningPossible(settings: BudgetSettings, task: string): boolean {
  const policy = resolveTaskPolicy(settings.taskPolicies, task);
  if (policy.thinking === 'off') return false;
  if (policy.thinking !== 'default') return true;
  return settings.disableThinking !== true;
}
