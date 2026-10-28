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
export function buildIngestErrorHint(errMsg: string, error: unknown, _context: IngestErrorContext): string {
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
  return 'Check your network connection, API key, and provider URL in Settings. '
    + 'If the error mentions SSL/TLS, try: (1) restart Obsidian, (2) check VPN/proxy settings, (3) verify the provider URL is correct.';
}
