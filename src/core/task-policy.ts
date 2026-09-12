// task-policy.ts — per-step choice of wire output mode and thinking.
//
// Issue #481 established that on an openai-compatible wire the two are not
// independent: a `response_format` on the request sets `reasoning_tokens` to
// 0 regardless of `reasoning_effort`, `disableThinking`, or the server's own
// switch. "Let this step think" is therefore not a flag but a decision about
// the output mode, and it can only be made per step — the pipeline's schema
// callers (extract, lemma-classify, merge-triage, the dedup pair) and its
// prose callers (page-generate, source-page, merge-body, related-page,
// complementary, pdf-convert) want opposite things from the same setting.
//
// Which of them benefits from reasoning is unmeasured. This module exists so
// that it can be measured: an arm of a comparison run is a policy string, not
// a patch and a rebuild.
//
// Default is "change nothing" for every step except the two named in
// `BUILTIN_TASK_POLICIES` (Issue #524): an unset policy resolves to `default`
// on both axes, which means the OutputModeProber picks the mode exactly as
// before and the caller's own `enableThinking` argument is passed through
// untouched. `src/__tests__/core/task-policy.test.ts` pins that.

import type { OutputMode } from '../llm-sdk/output-mode-prober';

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
const THINKING_EFFORTS = ['low', 'medium', 'high'] as const;
export type ThinkingEffort = (typeof THINKING_EFFORTS)[number];

export function thinkingEffort(thinking: TaskThinking): ThinkingEffort | undefined {
  return (THINKING_EFFORTS as readonly string[]).includes(thinking)
    ? thinking as ThinkingEffort
    : undefined;
}

export interface TaskPolicy {
  outputMode: TaskOutputMode;
  thinking: TaskThinking;
}

export const DEFAULT_TASK_POLICY: TaskPolicy = Object.freeze({
  outputMode: 'default',
  thinking: 'default',
});

/** Wildcard key: applies to every task that has no entry of its own. */
const TASK_POLICY_WILDCARD = '*';

export type TaskPolicyMap = Readonly<Record<string, TaskPolicy>>;

const TEXT_MODE_STEP: TaskPolicy = Object.freeze({ outputMode: 'text_prompt', thinking: 'default' });

/**
 * Built-in baseline, below anything the user sets (Issue #524).
 *
 * `extract` and `extract-retry` run in `text_prompt`: no `response_format`
 * on the wire, the JSON-enforcement prefix in the system prompt instead.
 * Measured on LM Studio / gemma-4-26b with the real pipeline request, the
 * extraction under `json_schema` degraded in 3 of 3 draws — twice silently,
 * as schema-valid JSON with 4–5 items where text mode returned 17–30 — and
 * the server logs of one vault show 14 repetition loops in 125 schema-mode
 * extraction calls against 9 in 2,368 text-mode ones. Before 1.26.3 every
 * user ran extraction in text mode; this restores that wire shape for the
 * one long-output generative step and leaves the short judgement calls
 * (lemma-classify, merge-triage, the dedup pair) on the prober's default.
 *
 * Thinking stays `default` on purpose: the call site's `disableThinking`
 * argument passes through exactly as it did before 1.26.3. A user entry for
 * the task, or a `*` wildcard, wins over this baseline.
 */
export const BUILTIN_TASK_POLICIES: TaskPolicyMap = Object.freeze({
  'extract': TEXT_MODE_STEP,
  'extract-retry': TEXT_MODE_STEP,
});

/**
 * The policy for one `task` label, or the default when none applies.
 *
 * Lookup order is user-specific → user wildcard → built-in baseline →
 * default, so `*=text:on` can set a baseline for a whole run, a single
 * `extract=schema:off` entry can hold one step out of it, and either of them
 * overrides `BUILTIN_TASK_POLICIES`.
 */
export function resolveTaskPolicy(
  policies: TaskPolicyMap | undefined,
  task: string | undefined,
): TaskPolicy {
  if (task && policies?.[task]) return policies[task];
  if (policies?.[TASK_POLICY_WILDCARD]) return policies[TASK_POLICY_WILDCARD];
  if (task && BUILTIN_TASK_POLICIES[task]) return BUILTIN_TASK_POLICIES[task];
  return DEFAULT_TASK_POLICY;
}

const MODE_ALIASES: Readonly<Record<string, TaskOutputMode>> = {
  '-': 'default',
  'default': 'default',
  'schema': 'json_schema',
  'json_schema': 'json_schema',
  'strict': 'json_schema_strict',
  'json_schema_strict': 'json_schema_strict',
  'json': 'json_object',
  'json_object': 'json_object',
  'text': 'text_prompt',
  'text_prompt': 'text_prompt',
};

const THINKING_ALIASES: Readonly<Record<string, TaskThinking>> = {
  '-': 'default',
  'default': 'default',
  'off': 'off',
  'on': 'on',
  'low': 'low',
  'medium': 'medium',
  'high': 'high',
};

/**
 * Parse a policy spec into a map. The format is meant to survive a shell
 * script and stay readable in a run manifest:
 *
 *   extract=text:on,merge-triage=text:on,page-generate=-:off
 *
 * One entry per task, `task=mode:thinking`, `-` for "leave alone", and the
 * thinking half optional (`extract=text` means mode only). `*` as the task
 * name sets the baseline for every step.
 *
 * Throws on anything it does not understand rather than skipping it. A
 * silently ignored entry would mean an arm that did not run what its own
 * manifest says it ran, and the manifest is the only record of which arm a
 * number came from. For the same reason a task named twice is an error and
 * not a last-one-wins (#525 review): `extract=text,extract=schema` states two
 * arms, and picking one of them quietly is exactly the manifest lie above.
 *
 * The task NAME is deliberately not validated (#525 review, the "or document"
 * branch). There is no registry to validate against: every label is a string
 * literal at its own call site (`task: 'merge-triage'`), so a list here would
 * be a second copy that drifts the moment a step is added or renamed — and a
 * stale list would reject a policy for a step that does exist, which is worse
 * than the typo it would catch. An unknown name is inert: `resolveTaskPolicy`
 * only ever looks up labels the pipeline passes, so a misspelled entry simply
 * never matches. Give the labels one home and this becomes a two-line check.
 */
export function parseTaskPolicySpec(spec: string): TaskPolicyMap {
  // #543: a null-prototype map. `policies['__proto__'] = ...` on a plain
  // object literal invokes the inherited accessor instead of setting an
  // own property, so a second `__proto__=...` entry bypassed the duplicate
  // guard and silently mutated the object's prototype. `hasOwnProperty.call`
  // on a null-proto object still reports whatever string was assigned, and
  // `__proto__` becomes a normal own key like any other.
  const policies: Record<string, TaskPolicy> = Object.create(null) as Record<string, TaskPolicy>;
  for (const rawEntry of spec.split(',')) {
    const entry = rawEntry.trim();
    if (entry === '') continue;
    const eq = entry.indexOf('=');
    if (eq <= 0) {
      throw new Error(`task policy: expected "task=mode[:thinking]", got "${entry}"`);
    }
    const task = entry.slice(0, eq).trim();
    if (task === '') {
      throw new Error(`task policy: empty task name in "${entry}"`);
    }
    if (Object.prototype.hasOwnProperty.call(policies, task)) {
      throw new Error(`task policy: "${task}" is set twice; keep one entry per task`);
    }
    const [rawMode = '', rawThinking = '-'] = entry.slice(eq + 1).trim().split(':');
    const outputMode = MODE_ALIASES[rawMode.trim()];
    const thinking = THINKING_ALIASES[rawThinking.trim()];
    if (!outputMode) {
      throw new Error(
        `task policy for "${task}": unknown mode "${rawMode}" `
        + `(expected one of -, schema, json, text)`,
      );
    }
    if (!thinking) {
      throw new Error(
        `task policy for "${task}": unknown thinking "${rawThinking}" `
        + `(expected one of -, off, on, low, medium, high)`,
      );
    }
    policies[task] = { outputMode, thinking };
  }
  return policies;
}

/** Round-trips `parseTaskPolicySpec`, for stamping the arm into a manifest. */
export function formatTaskPolicyMap(policies: TaskPolicyMap): string {
  return Object.entries(policies)
    .map(([task, policy]) => `${task}=${policy.outputMode}:${policy.thinking}`)
    .join(',');
}
