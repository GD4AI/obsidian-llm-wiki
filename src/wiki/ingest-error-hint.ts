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

import { namesReasoningOnly } from '../core/output-ceiling-probe';
import { REASONING_ONLY_ERROR_CODE } from '../llm-sdk/finish-reason';
import { TEXTS } from '../texts';

type Language = keyof typeof TEXTS;
type LocaleTexts = (typeof TEXTS)[Language];

export interface IngestErrorContext {
  /** Provider id, used only to name the provider in the message. */
  provider: string;
  /** Resolved model id for the step. */
  model: string;
  /**
   * Whether the call ran on a mobile platform. Optional, and passed in rather
   * than read from `Platform` here, so this module stays pure and its tests need
   * no platform stub (#980).
   */
  isMobile?: boolean;
  /**
   * The user's transport choice, when the caller can read it (#980).
   *
   * The hint needs it to tell apart two states that look identical from the error
   * alone: streaming was on and something upstream buffered the answer, or the
   * user turned streaming off and that is the cause.
   */
  streamIngest?: 'auto' | 'always' | 'never';
  /**
   * The UI language, so the advice is translated (#980 follow-up).
   *
   * This hint is not console output: `ingest-commands.ts` puts the whole error
   * message into a Notice. On a phone that Notice is the only surface a user has,
   * and half-English advice inside a translated prefix reads as a broken plugin.
   */
  language?: Language;
}

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
  return namesReasoningOnly(errMsg);
}

/**
 * Does this rejection name the OUTPUT ceiling?
 *
 * Moved to `core/output-ceiling-probe.ts` by #1019: the generation call sites halve
 * a rejected ceiling too, and `core/` may not import `wiki/`. The reasoning-only
 * exclusion travels with it, because the two families need the same answer to the
 * same question and a second copy would drift.
 */

/**
 * Build the `userHint` half of the first-batch failure message.
 *
 * Every branch that names a settings path must name one that exists —
 * `src/__tests__/wiki/ingest-error-hint.test.ts` fails on a path that does
 * not, because a wrong path is worse than no path: the user looks, does not
 * find it, and concludes the plugin is broken.
 */
/**
 * Pick the advice the platform and the setting call for (#980).
 *
 * Three states, and the setting decides which one applies. On mobile, `auto` and
 * `always` both stream, so a timeout there means something upstream held the
 * answer back; `never` means the user turned streaming off and that is the cause.
 * On desktop nothing streams unless asked, so `always` is the actionable control.
 */
function timeoutAdvice(context: IngestErrorContext, t: LocaleTexts): string {
  if (context.streamIngest === 'never') return t.ingestHintStreamingOff;
  return context.isMobile ? t.ingestHintMobileTimeout : t.ingestHintDesktopTimeout;
}

export function buildIngestErrorHint(errMsg: string, error: unknown, context: IngestErrorContext): string {
  const lowerErr = errMsg.toLowerCase();
  const code = (error as { code?: unknown } | null)?.code;
  // Falls back to English when the caller states no language, so a unit test or a
  // future call site cannot end up with an empty hint.
  const t = TEXTS[context.language ?? 'en'] ?? TEXTS.en;

  // Most specific first. The guard's message is the only one that can contain
  // `token` while being about neither the context window nor `max_tokens`.
  if (looksLikeReasoningOnly(errMsg, code)) return t.ingestHintReasoning;
  if (lowerErr.includes('max_tokens') || lowerErr.includes('max tokens')) {
    return t.ingestHintMaxTokens;
  }
  if (lowerErr.includes('context') || lowerErr.includes('length') || lowerErr.includes('exceed')) {
    return t.ingestHintContextWindow;
  }
  if (lowerErr.includes('400')) {
    return t.ingestHintBadRequest;
  }
  if (lowerErr.includes('401') || lowerErr.includes('403')) {
    return t.ingestHintAuth;
  }
  if (lowerErr.includes('429')) {
    return t.ingestHintRateLimit;
  }
  // After the HTTP codes, so a message carrying both keeps the rejection's
  // advice: a 401 is actionable and a timeout beside it is the symptom.
  if (looksLikeTimeout(lowerErr)) {
    return timeoutAdvice(context, t);
  }
  return t.ingestHintDefault;
}
