// #1019: a provider that rejects an output ceiling has not failed. It has told us
// its limit, and the same request can run again with a value that fits.
//
// This lives in `core/` rather than next to either caller because two families
// need it and they disagree about the floor: a batch extraction walks down from
// 128,000 and stops at `MAX_TOKENS_BATCH`, while one page walks down from 32,000
// and must reach 4,000 to fit a small local model. The floor is a parameter for
// exactly that reason.
//
// `wiki/` imports this; `core/` must not import `wiki/`, which is why the two
// message predicates live here now instead of in `ingest-error-hint.ts`.

import { MAX_TOKENS_BATCH } from '../constants';

/**
 * Does the message report that the model returned only reasoning?
 *
 * Text only. The error's `code` is the stronger signal, but it cannot cross a
 * serialisation boundary — a proxy, a queued toast or a log replay arrives as a
 * string — so the phrase match is kept beside it and used as the fallback.
 */
export function namesReasoningOnly(errMsg: string): boolean {
  const lower = errMsg.toLowerCase();
  return lower.includes('on reasoning') || lower.includes('only its reasoning');
}

/**
 * Does this rejection name the OUTPUT ceiling?
 *
 * A reasoning-only message is excluded even though it contains `max_tokens`:
 * the guard's own sentence ends with "raise the token limit (max_tokens)", and
 * halving the ceiling is the opposite of its advice.
 */
export function namesOutputCeiling(errMsg: string): boolean {
  if (namesReasoningOnly(errMsg)) return false;
  const lower = errMsg.toLowerCase();
  return lower.includes('max_tokens')
    || lower.includes('max_completion_tokens')
    || lower.includes('max output tokens');
}

/**
 * The ceiling to try after a provider rejected one, or `null` when no probe is
 * left to spend.
 *
 * Bounded on purpose: two attempts, only while there is room to halve, and only
 * for a message that names the ceiling. A context-length complaint means the
 * INPUT is too long, and halving the output budget would burn calls and change
 * nothing. `floor` is the smallest ceiling worth sending: below it the answer
 * cannot fit and the call would fail for a different reason.
 */
export function ceilingAfterRejection(
  current: number,
  probes: number,
  errMsg: string,
  floor: number = MAX_TOKENS_BATCH,
): number | null {
  if (probes >= 2 || current <= floor || !namesOutputCeiling(errMsg)) return null;
  const next = Math.max(floor, Math.floor(current / 2));
  return next < current ? next : null;
}
