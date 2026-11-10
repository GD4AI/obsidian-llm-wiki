// ingest-error-hint.ts — turn a first-batch failure into advice the user can act on.
//
// Extracted from `source-analyzer.ts` (Issue #904) for one reason: the
// classifier there matched on substrings, and it matched them in the wrong
// order. The reasoning-only guard reports "…spending 16000 of 16000 output
// tokens on reasoning", which contains the word `token`, so the generic
// context-window branch claimed it and the user was told to find a model with
// a larger context window. That advice cannot fix the problem and points away
// from the setting that can.
//
// A pure string function, so the ordering is testable without building a
// client. Order is the whole design: the most specific explanation must be
// tested first, and the guards below state which is most specific and why.

import { REASONING_ONLY_ERROR_CODE } from '../llm-sdk/finish-reason';

export interface IngestErrorContext {
  /** Provider id, used only to name the provider in the message. */
  provider: string;
  /** Resolved model id for the step. */
  model: string;
  /**
   * Whether the call ran on iOS/iPadOS. Optional, and passed in rather than read
   * from `Platform` here, so this module stays pure and its tests need no
   * platform stub (#980).
   */
  isMobile?: boolean;
}

/** The reasoning-only sentence, appended after the guard's own explanation. */
const REASONING_ADVICE =
  'The cause is the thinking budget, not the file size: the model spent the whole output budget on reasoning, so no answer was left. '
  + 'Either turn thinking off for this step (Settings → LLM Advanced Parameters → Disable thinking), '
  + 'or lower the thinking level, or raise Max output tokens per call — extraction now declares the model\'s full output ceiling by default, '
  + 'so if this still happens the ceiling is being capped by that setting.';

const CONTEXT_ADVICE =
  'The request was rejected because the source file is too large for this model\'s context window. '
  + 'Try: (1) switch to a model with a larger context window (e.g. 1M tokens) in Settings, '
  + '(2) reduce the file size, or (3) use a provider that supports larger contexts.';

/**
 * A timeout, on the one platform where the plugin cannot prevent it (Issue #980).
 *
 * The transport now streams ingest requests, so the plugin no longer creates this
 * failure by itself. What remains is upstream: a reverse proxy that buffers the
 * response, or a provider that does not flush partial output. Naming both keeps
 * the advice true after the fix instead of pointing at a limit that no longer
 * applies.
 */
const MOBILE_TIMEOUT_ADVICE =
  'The request received no data for 60 seconds. That is the iOS limit for one request, and it fires while the model is still working. '
  + 'Ingest requests stream when the provider allows it, so a gap this long means something between the plugin and the model held the answer back. '
  + 'Try: (1) turn off response buffering on any reverse proxy in front of the model server, '
  + '(2) use a provider or model that streams partial output, or (3) run the ingest from a desktop device, which has no such limit.';

/** The same failure with no platform stated: the cause is named, the number is not. */
const TIMEOUT_ADVICE =
  'The request timed out before any data arrived. Ingest requests stream when the provider allows it, so a silent gap usually means the answer was buffered — '
  + 'by a reverse proxy, or by a provider that does not flush partial output. Check the provider URL and any proxy in front of it.';

/**
 * Match a timeout, and not a user cancellation.
 *
 * `aborted` is deliberately absent: Obsidian raises it when the user cancels a
 * run, and advising them about a 60-second limit they never reached would be
 * wrong in the one case they caused themselves.
 */
function looksLikeTimeout(lowerErr: string): boolean {
  return lowerErr.includes('timed out')
    || lowerErr.includes('timeout')
    || lowerErr.includes('etimedout')
    || lowerErr.includes('deadline exceeded');
}

/**
 * Match the reasoning-only failure.
 *
 * Two independent signals, because they arrive on different paths: the `code`
 * property survives any client that re-wraps the error, and the phrase match
 * covers errors serialised to a plain string (a provider proxy, a queued
 * toast, a log replay). Both are narrow on purpose — "reasoning" appears in
 * no other message this plugin emits for a first-batch failure.
 */
function looksLikeReasoningOnly(errMsg: string, code: unknown): boolean {
  if (code === REASONING_ONLY_ERROR_CODE) return true;
  const lower = errMsg.toLowerCase();
  return lower.includes('on reasoning') || lower.includes('only its reasoning');
}

/**
 * Does this rejection name the OUTPUT ceiling?
 *
 * Used by the extraction loop to distinguish "this provider will not accept a
 * ceiling this large" (learnable: halve it and retry) from every other
 * failure (not learnable: let the classifier explain it).
 *
 * A reasoning-only message is excluded even though it contains `max_tokens`:
 * the guard's own sentence ends with "raise the token limit (max_tokens)", and
 * halving the ceiling is the opposite of its advice.
 */
export function namesOutputCeiling(errMsg: string): boolean {
  if (looksLikeReasoningOnly(errMsg, undefined)) return false;
  const lower = errMsg.toLowerCase();
  return lower.includes('max_tokens')
    || lower.includes('max_completion_tokens')
    || lower.includes('max output tokens')
    || lower.includes('max_completion_tokens');
}

/**
 * Build the `userHint` half of the first-batch failure message.
 *
 * Every branch that names a settings path must name one that exists —
 * `src/__tests__/wiki/ingest-error-hint.test.ts` fails on a path that does
 * not, because a wrong path is worse than no path: the user looks, does not
 * find it, and concludes the plugin is broken.
 */
export function buildIngestErrorHint(errMsg: string, error: unknown, context: IngestErrorContext): string {
  const lowerErr = errMsg.toLowerCase();
  const code = (error as { code?: unknown } | null)?.code;

  // Most specific first. The guard's message is the only one that can contain
  // `token` while being about neither the context window nor `max_tokens`.
  if (looksLikeReasoningOnly(errMsg, code)) return REASONING_ADVICE;
  if (lowerErr.includes('max_tokens') || lowerErr.includes('max tokens')) {
    return 'The model rejected the max_tokens value. Lower Max output tokens per call in Settings → LLM Advanced Parameters.';
  }
  if (lowerErr.includes('context') || lowerErr.includes('length') || lowerErr.includes('exceed')) {
    return CONTEXT_ADVICE;
  }
  if (lowerErr.includes('400')) {
    return 'The API returned a Bad Request error. Check that the model name is correct and supported by your provider.';
  }
  if (lowerErr.includes('401') || lowerErr.includes('403')) {
    return 'Authentication failed. Check your API key in Settings.';
  }
  if (lowerErr.includes('429')) {
    return 'Rate limit exceeded. Wait a moment and try again, or switch to a provider with higher limits.';
  }
  // After the HTTP codes, so a message carrying both keeps the rejection's
  // advice: a 401 is actionable and a timeout beside it is the symptom.
  if (looksLikeTimeout(lowerErr)) {
    return context.isMobile ? MOBILE_TIMEOUT_ADVICE : TIMEOUT_ADVICE;
  }
  return 'Check your network connection, API key, and provider URL in Settings. '
    + 'If the error mentions SSL/TLS, try: (1) restart Obsidian, (2) check VPN/proxy settings, (3) verify the provider URL is correct.';
}
