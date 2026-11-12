// withTransientRetry — helper for transient LLM response failures.
//
// Failure class: 200-OK-with-empty-body, JSON-parse throw, network jitter.
// None of withTruncationRetry (max_tokens boundary), url-fallback (404),
// or token-key-probe (HTTP 400 → key swap) cover this — see those helpers
// for orthogonal retry policies.

/**
 * Result of a withTransientRetry call.
 * Exactly one of `value` or `error` is set. `value` is set on success
 * (including when the caller accepts the returned value as final even
 * if `isTransientEmpty` would have matched). `error` is set when all
 * attempts failed or the failure was non-retryable (auth/rate-limit).
 */
export interface TransientRetryResult<T> {
  value?: T;
  error?: Error;
  /** Number of attempts actually made (1..maxAttempts). */
  attempts: number;
  /** Total backoff time waited in ms (useful for diagnostics/telemetry). */
  totalBackoffMs: number;
}

export interface TransientRetryOptions<T> {
  /** Function that performs the API call. May throw or return a value. */
  fn: () => Promise<T>;
  /**
   * Optional predicate: returns true if the value should be treated as a
   * transient empty response (e.g. empty string, whitespace-only string).
   * If not provided, no value-level retry is performed — only thrown errors retry.
   */
  isTransientEmpty?: (value: T) => boolean;
  /**
   * Optional validation function. If provided and it throws, the throw is
   * treated as a transient failure (e.g. JSON.parse failure on a non-empty
   * but malformed response).
   */
  validate?: (value: T) => void;
  /**
   * Predicate: returns true if the error is an auth failure (401/403).
   * On match, the helper returns immediately with the error (no retry).
   * Default: never match (every error is retryable).
   */
  isAuthError?: (error: unknown) => boolean;
  /**
   * Predicate: returns true if the error is a rate-limit (429).
   * On match, the helper returns immediately with the error (no retry).
   * Default: never match.
   */
  isRateLimitError?: (error: unknown) => boolean;
  /** Maximum number of attempts (including the first). Default: 3. */
  maxAttempts?: number;
  /** Backoff base in ms. Default: 250. */
  backoffBaseMs?: number;
  /** Jitter cap in ms. Default: 100. Pass 0 for deterministic timing in tests. */
  jitterMs?: number;
  /** Label used in the diagnostic warning log (e.g. "Seed selection"). */
  label: string;
}

export async function withTransientRetry<T>(
  opts: TransientRetryOptions<T>,
): Promise<TransientRetryResult<T>> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const backoffBaseMs = opts.backoffBaseMs ?? 250;
  const jitterMs = opts.jitterMs ?? 100;

  let totalBackoffMs = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const value = await opts.fn();

      // Value-level retry: throwaway responses (empty / whitespace-only).
      if (opts.isTransientEmpty?.(value) === true) {
        const reason = 'transient empty response';
        const gaveUp = await maybeBackoff(
          attempt, maxAttempts, opts, reason, backoffBaseMs, jitterMs,
        );
        totalBackoffMs += gaveUp.backoffMs;
        if (gaveUp.continueLoop) continue;
        // Final attempt also empty — log giveup, return the empty value.
        console.warn(
          `[LLM retry] ${opts.label} giving up after ${maxAttempts} attempts: ${reason}`,
        );
        return { value, attempts: attempt, totalBackoffMs };
      }

      // Validation-level retry: malformed response (e.g. JSON.parse throws).
      if (opts.validate) {
        try {
          opts.validate(value);
        } catch (validateError) {
          const err = validateError instanceof Error ? validateError : new Error(String(validateError));
          const gaveUp = await maybeBackoff(
            attempt, maxAttempts, opts, err.message, backoffBaseMs, jitterMs,
          );
          totalBackoffMs += gaveUp.backoffMs;
          if (gaveUp.continueLoop) continue;
          console.warn(
            `[LLM retry] ${opts.label} giving up after ${maxAttempts} attempts: ${err.message}`,
          );
          return { error: err, attempts: attempt, totalBackoffMs };
        }
      }

      // Success path.
      return { value, attempts: attempt, totalBackoffMs };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Auth / rate-limit: surface immediately, do not retry.
      if (opts.isAuthError?.(err) === true || opts.isRateLimitError?.(err) === true) {
        return { error: err, attempts: attempt, totalBackoffMs };
      }

      const gaveUp = await maybeBackoff(
        attempt, maxAttempts, opts, err.message, backoffBaseMs, jitterMs,
      );
      totalBackoffMs += gaveUp.backoffMs;
      if (gaveUp.continueLoop) continue;

      console.warn(
        `[LLM retry] ${opts.label} giving up after ${maxAttempts} attempts: ${err.message}`,
      );
      return { error: err, attempts: attempt, totalBackoffMs };
    }
  }

  // Unreachable: the loop always returns.
  throw new Error(`withTransientRetry: loop fell through for ${opts.label} (maxAttempts=${maxAttempts})`);
}

/**
 * Compute backoff, log the per-attempt warning, sleep, and signal whether
 * the loop should continue. Extracted to deduplicate the 3 retry paths.
 *
 * Returns `continueLoop: false` when the current attempt is the final
 * one — caller logs a "giving up" warning and surfaces the result.
 */
async function maybeBackoff(
  attempt: number,
  maxAttempts: number,
  // Only the label is read. Taking `TransientRetryOptions<unknown>` forced the
  // caller's `TransientRetryOptions<T>` through a contravariant position, which
  // `strictFunctionTypes` rejects (#816); naming the one field it uses drops the
  // generic entirely and states the real dependency.
  opts: { label: string },
  reason: string,
  backoffBaseMs: number,
  jitterMs: number,
): Promise<{ continueLoop: boolean; backoffMs: number }> {
  if (attempt >= maxAttempts) {
    return { continueLoop: false, backoffMs: 0 };
  }
  const backoffMs = Math.floor(
    backoffBaseMs * Math.pow(2, attempt - 1) + Math.random() * jitterMs,
  );
  console.warn(
    `[LLM retry] ${opts.label} attempt ${attempt}/${maxAttempts} failed: ${reason}`,
  );
  await new Promise<void>(resolve => window.setTimeout(resolve, backoffMs));
  return { continueLoop: true, backoffMs };
}
