// The shape of a per-task policy, and the thinking levels it may name.
//
// Declared in `types/` rather than in `core/task-policy.ts` since #931:
// `LLMWikiSettings.taskPolicies` is typed by `TaskPolicyMap`, and a settings
// type that reaches up into `core/` inverts the graph. The policy *logic* —
// `resolveTaskPolicy`, the built-in table, the spec parser — stays in `core/`.
//
// `core/task-policy.ts` imports these and re-exports them, so every existing
// caller keeps its import.
import type { OutputMode } from './llm';

/**
 * Output mode for one step. `default` leaves the choice to the
 * OutputModeProber's per-model cache (today's behaviour: start at
 * `json_schema`, demote on a 400).
 *
 * The other three name a wire shape and pin it, skipping the prober for this
 * step only. `text_prompt` is the one that matters for reasoning — it is the
 * only mode that puts no `response_format` on the request.
 */
export type TaskOutputMode = 'default' | OutputMode;

/**
 * Thinking for one step. `default` passes the call site's own argument
 * through, which is what every call site does with `disableThinking` today.
 *
 * `off` and `on` override it. Note that both are requests, not guarantees:
 * with a `response_format` on the wire, `on` is overruled by the schema
 * (#481), which is precisely why the two axes are set together here.
 *
 * `low` / `medium` / `high` are `on` with a budget — they send
 * `reasoning_effort` at that level. The distinction earns its place: measured
 * on gemma-4-26b, unbounded thinking at the extraction step consumed all
 * 16000 tokens of the batch budget and returned nothing, twice. "Thinking
 * helps here" and "thinking fits here" are different questions, and only the
 * bounded levels can ask the first one.
 */
export type TaskThinking = 'default' | 'off' | 'on' | 'low' | 'medium' | 'high';

/** The three that name a budget, as opposed to just not suppressing. */
export const THINKING_EFFORTS = ['low', 'medium', 'high'] as const;
export type ThinkingEffort = (typeof THINKING_EFFORTS)[number];

export interface TaskPolicy {
  outputMode: TaskOutputMode;
  thinking: TaskThinking;
}

export type TaskPolicyMap = Readonly<Record<string, TaskPolicy>>;
