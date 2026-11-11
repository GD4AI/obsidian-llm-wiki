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
// So never guess how long reasoning will be: declare the model's own ceiling
// and let it stop when it is done. Since #912 this holds even when thinking is
// switched off, because the toggle is a request and not an outcome.
//
// Pure: no IO, no settings object, no defaults of its own. The caller resolves
// the ceiling.

import { DEFAULT_MODEL_OUTPUT_TOKENS } from '../constants';
import type { TaskPolicyMap } from './task-policy';

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
}

/**
 * Output budget for one extraction call.
 *
 * Always the ceiling. #904 narrowed this to the answer need when reasoning
 * looked switched off, on the reasoning that there was no second bill to pay.
 * #912 removed that: asking for silence is not evidence of silence. A model
 * that refuses to stop thinking (Claude Opus 5.5) lands in the narrow branch
 * and spends the whole budget on reasoning, leaving nothing for the answer, so
 * the batch comes back empty — the exact failure the narrow number was meant
 * to prevent.
 *
 * The cost of not narrowing is smaller than it looks: `max_tokens` is a cap,
 * not a reservation. A model that does obey the request uses what it uses and
 * bills for that. A model that ignores it gets the room it needs instead of
 * failing.
 *
 * The ceiling is never exceeded: a declared value above the model's limit is a
 * guaranteed 400, which is the failure this module exists to avoid.
 */
export function computeExtractionBudget(input: ExtractionBudgetInput): number {
  return input.ceiling;
}
