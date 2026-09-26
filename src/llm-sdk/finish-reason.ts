// Issue #305: surface *why* the provider stopped generating.
//
// An OpenAI-compatible provider does not throw when it hits the token limit.
// It returns HTTP 200 and a body that stops mid-token, so a caller that only
// sees the response text cannot distinguish "the model finished" from "the
// model was cut off". The AI SDK already normalizes this into
// `result.finishReason`; every client here simply dropped it on `return
// result.text`. These helpers carry it to callers that opt in.

import type { LLMFinishReason, LLMFinishMeta, LLMUsage } from '../types';

const KNOWN_FINISH_REASONS: readonly LLMFinishReason[] = [
  'stop',
  'length',
  'content-filter',
  'tool-calls',
  'error',
  'other',
  'unknown',
];

/**
 * Map an SDK-reported finish reason onto our union.
 *
 * Deliberately total: anything unrecognized (including `undefined`, which is
 * what a provider that omits the field yields) becomes `'unknown'` rather
 * than throwing. A caller acting on `'length'` therefore never fires on a
 * value it did not understand — the failure mode is "no signal", which is
 * exactly the pre-#305 behavior.
 */
export function normalizeFinishReason(raw: unknown): LLMFinishReason {
  return typeof raw === 'string' && (KNOWN_FINISH_REASONS as readonly string[]).includes(raw)
    ? (raw as LLMFinishReason)
    : 'unknown';
}

/**
 * Lift the SDK's reasoning-token count onto our own `LLMUsage`.
 *
 * The SDK reports it twice: `outputTokenDetails.reasoningTokens` is current,
 * the top-level `reasoningTokens` is deprecated but still populated by some
 * providers. We read the current one first and keep every other field the
 * SDK sent, so this is purely additive for callers that ignore it.
 *
 * Absent stays absent. A provider that omits the field must not be recorded
 * as one that reported zero — the guard below distinguishes the two, and
 * collapsing them here would make "this model does not think"
 * indistinguishable from "this provider does not say".
 */
export function normalizeUsage(usage: unknown): LLMUsage | undefined {
  if (!usage || typeof usage !== 'object') return undefined;
  const raw = usage as LLMUsage & {
    outputTokenDetails?: { reasoningTokens?: number };
    reasoningTokens?: number;
  };
  const reasoning = raw.outputTokenDetails?.reasoningTokens ?? raw.reasoningTokens;
  return reasoning === undefined ? raw : { ...raw, reasoningTokens: reasoning };
}

/**
 * Invoke the optional `onFinish` callback with a normalized reason.
 *
 * No-op when the caller did not pass one, which keeps every existing call
 * site and every mock client unchanged.
 */
export function reportFinish(
  onFinish: ((meta: LLMFinishMeta) => void) | undefined,
  raw: unknown,
  usage?: LLMUsage,
): void {
  if (!onFinish) return;
  const normalized = normalizeUsage(usage);
  onFinish({ finishReason: normalizeFinishReason(raw), ...(normalized ? { usage: normalized } : {}) });
}

/**
 * Lift the SDK's reasoning-channel content onto a string.
 *
 * The SDK's `result.reasoning` is either a string (most providers) or an
 * array of `{ text }` parts (anthropic). Both shapes appear across the
 * 4 SDK clients (openai / openai-compat / openai-codex / anthropic). Centralised
 * here so each client carries the same shape-checking logic instead of
 * copying the `typeof === 'string'` / `Array.isArray` branching.
 */
export function extractReasoningText(reasoning: unknown): string {
  if (typeof reasoning === 'string') return reasoning;
  if (Array.isArray(reasoning)) {
    return reasoning
      .map((r) => {
        const t = (r as { text?: unknown }).text;
        return typeof t === 'string' ? t : '';
      })
      .join('');
  }
  return '';
}

type ReasoningStep = {
  reasoning?: unknown;
  reasoningText?: string;
};

/**
 * AI SDK v7 deprecates top-level `result.reasoning`. Read `finalStep`
 * instead. generateText exposes it synchronously; streamText as a
 * PromiseLike. `reasoningText` is the concatenated form when present.
 */
export async function extractResultReasoning(result: {
  finalStep?: ReasoningStep | PromiseLike<ReasoningStep>;
}): Promise<string> {
  if (result.finalStep === undefined) return '';
  const step = await result.finalStep;
  if (typeof step.reasoningText === 'string' && step.reasoningText.length > 0) {
    return step.reasoningText;
  }
  return extractReasoningText(step.reasoning);
}

/**
 * Issue #470: restore the reasoning-only guard that shipped in v1.19.0 for
 * Issue #99 and was dropped with `src/llm-client.ts` in the v1.23.0 AI-SDK
 * migration.
 *
 * A thinking-capable model whose runtime ignores the thinking-disable control
 * spends its budget in the reasoning channel and returns empty visible
 * content at `finish_reason: length`. On the wire that is a 200, so without
 * this the caller sees a generic parse failure and goes looking for a bad
 * prompt — the exact wrong place.
 *
 * Two deliberate narrowings against the v1.19.0 predicate:
 *
 *   - `text` is the text the caller is about to receive, AFTER the
 *     reasoning-channel prepend (`prependReasoningForParse`). LMStudio +
 *     Qwen3.5 routes valid structured output into `reasoning_content` with
 *     empty visible content; that call succeeded and must not throw here.
 *   - An absent `reasoningTokens` never fires. The predicate needs the
 *     provider to have said what the tokens went to; without it, "empty at
 *     length" is just truncation, which is #305's signal, not this one.
 */
/**
 * S143: the predicate of assertNotReasoningOnly, reusable BEFORE the
 * reasoning-channel prepend. When it holds, the reasoning is a runaway think
 * that never reached the answer — prepending it would hand 30K chars of
 * reasoning prose to markdown-consuming callers (merge/create), which have
 * no parse gate and write it into pages. Callers skip the prepend so the
 * assert below sees the empty answer and throws. When the provider reports
 * no reasoning breakdown, this stays false and the legacy prepend applies
 * (#544: a truncated JSON in the reasoning channel still reaches the
 * parse-and-retry path downstream).
 */
export function isReasoningRunaway(
  text: string,
  raw: unknown,
  usage: LLMUsage | undefined,
): boolean {
  if (text.trim().length > 0) return false;
  if (normalizeFinishReason(raw) !== 'length') return false;
  const outputTokens = usage?.outputTokens ?? 0;
  const reasoningTokens = usage?.reasoningTokens;
  if (reasoningTokens === undefined || outputTokens <= 0) return false;
  return reasoningTokens / outputTokens >= 0.5;
}

export function assertNotReasoningOnly(
  text: string,
  raw: unknown,
  usage: LLMUsage | undefined,
): void {
  if (!isReasoningRunaway(text, raw, usage)) return;
  const outputTokens = usage?.outputTokens ?? 0;
  const reasoningTokens = usage?.reasoningTokens;
  throw new Error(
    `The model returned empty content after spending ${reasoningTokens} of `
    + `${outputTokens} output tokens on reasoning. Disable thinking for this `
    + `model, or raise the token limit (max_tokens) so the answer fits after it.`,
  );
}

/**
 * Sink for `onFinish` that answers one question afterwards: did the provider
 * stop at its token limit?
 *
 * A body rewrite that hit `max_tokens` is not a rewrite, it is the first N
 * tokens of one. The clients above already report the reason; the
 * page-factory paths never asked, so a truncated body was written over the
 * page it was meant to rewrite. Measured on a 413-note rebuild: 13 body
 * rewrites grew a page by more than 8 KB, 10 of them next to a
 * `finish_reason: length` in the provider log — the model had looped on a
 * provenance footnote (`^[Quelle: [[X]]]` 650 times in one line) until the
 * budget ran out, and the loop became the page.
 *
 * Only `'length'` counts. A client that reports nothing leaves the reason
 * `'unknown'`, so legacy and mock clients keep the pre-#305 behaviour.
 */
export function captureFinish(): { onFinish: (meta: LLMFinishMeta) => void; readonly truncated: boolean } {
  let reason: LLMFinishReason = 'unknown';
  return {
    onFinish: (meta) => { reason = meta.finishReason; },
    get truncated() { return reason === 'length'; },
  };
}
