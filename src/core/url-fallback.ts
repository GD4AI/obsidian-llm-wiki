// url-fallback.ts — Custom baseURL fallback mechanism
//
// v1.23.0 P1.5 follow-up: Kimi Coding Plan Anthropic-compatible endpoint
// `https://api.kimi.com/coding/` returns 404 because AI-SDK appends
// `/messages` to the baseURL but Kimi expects `/v1/messages`. Users
// frequently enter incomplete URLs (missing `/v1`, trailing slashes),
// and the SDK providers fail on first try without suggesting a fix.
//
// Design:
//   1. generateUrlCandidates — pure function, original first, then
//      variations (add /v1, strip trailing /).
//   2. Module-level cache — persists across client re-creation so
//      Ingest/Lint/Query all benefit from the first resolution.
//   3. isUrlError — only 404 is retryable. 401/403/429/5xx are NOT
//      (429 would worsen rate limit; 5xx means URL is correct, server
//      is broken; 401/403 mean auth issue regardless of URL).
//   4. resolveBaseUrlWithFallback — orchestrates try-original →
//      try-candidates with 300ms delay (rate limit protection).
//
// This module is pure + IO-free (except for the cache + delay utility),
// which makes it easy to test without mocking SDK clients.

/**
 * Delay between fallback attempts. 300ms is small enough to feel
 * instant for the user during Test Connection, large enough to not
 * trigger rate limits on providers like Kimi (which has aggressive
 * rate limiting per their Coding Plan docs).
 */
export const RETRY_DELAY_MS = 300;

/**
 * Generate URL candidates to try when the user-entered baseURL fails.
 *
 * Always tries the original URL first (no transformations), since
 * users sometimes know what they're doing. Then adds reasonable
 * variations to cover common mistakes.
 *
 * @example
 * generateUrlCandidates('https://api.kimi.com/coding/')
 *   → ['https://api.kimi.com/coding/', 'https://api.kimi.com/coding/v1', 'https://api.kimi.com/coding']
 *
 * @example
 * generateUrlCandidates('http://localhost:1234')
 *   → ['http://localhost:1234', 'http://localhost:1234/v1']
 */
export function generateUrlCandidates(userUrl: string): string[] {
  if (!userUrl) return [];

  const candidates = new Set<string>([userUrl]);

  // Strip trailing slash for comparison. Most URL parsers treat
  // `http://x.com/` and `http://x.com` as equivalent, but AI-SDK
  // appends path segments literally so `/v1/messages` vs `/v1/messages`
  // after appending might 404 on strict providers.
  const withoutTrailingSlash = userUrl.endsWith('/') ? userUrl.slice(0, -1) : userUrl;

  // Only add the slash-stripped variant if it differs from the original
  // AND no other candidate already covers it (e.g., if `/v1` variant
  // already equals the stripped form, don't duplicate).
  if (withoutTrailingSlash !== userUrl) {
    candidates.add(withoutTrailingSlash);
  }

  // If URL doesn't already have `/v1`, add a variant with `/v1`
  // appended to the stripped form. This is the Kimi case fix.
  const strippedHasV1 = hasV1Segment(withoutTrailingSlash);
  if (!strippedHasV1 && !hasV1Segment(userUrl)) {
    candidates.add(`${withoutTrailingSlash}/v1`);
  }

  // Original always first for the "user knows best" principle.
  return Array.from(candidates);
}

/**
 * Check if URL contains `/v1` as a path segment (not part of a longer
 * segment like `/v123` or `/v1beta`).
 */
export function hasV1Segment(url: string): boolean {
  // Strip query string + fragment before checking
  const pathOnly = url.split('?')[0].split('#')[0];
  return /\/v1(\/|$)/.test(pathOnly) || pathOnly.endsWith('/v1');
}

// ─── Module-level cache ──────────────────────────────────────────────
// Survives SDK client re-creation (e.g., settings change → new
// createLLMClient call) so Ingest/Lint/Query all benefit from the
// first request's URL resolution.

const cache = new Map<string, string>();

export function getCachedUrl(userUrl: string): string | undefined {
  return cache.get(userUrl);
}

export function cacheResolvedUrl(userUrl: string, resolvedUrl: string): void {
  cache.set(userUrl, resolvedUrl);
}

/**
 * Invalidate one or all cached URLs.
 * - Call with no args on settings change to force re-resolution.
 * - Call with a specific URL after manual settings edit for that provider.
 */
export function invalidateCache(userUrl?: string): void {
  if (userUrl === undefined) {
    cache.clear();
  } else {
    cache.delete(userUrl);
  }
}

// ─── Error detection ─────────────────────────────────────────────────

/**
 * Determine if an error is likely caused by a wrong URL path
 * (vs auth, rate limit, or server error).
 *
 * Only 404 is retryable:
 *   - 401/403: auth issue, retrying the same URL won't help
 *   - 429: rate limit — retrying with the same URL would worsen it
 *   - 5xx: server error — URL is correct, server is broken
 *
 * Uses statusCode property first (set by `mapAiSdkError` in
 * openai-sdk-client.ts), then falls back to parsing message text
 * for unmapped errors.
 */
export function isUrlError(error: unknown): boolean {
  // Duck-typed, not `instanceof Error`. The AI SDK's APICallError is bundled
  // into `main.js` and can arrive across a realm boundary where `instanceof`
  // answers false for an object that is an Error in every other respect. A
  // 404 that this gate fails to recognise never reaches the URL fallback, and
  // the user sees "404 page not found" with no recovery — measured 2026-10-15
  // on a MiniMax custom-Anthropic endpoint where fetch-models passed and the
  // wiki query then failed.
  if (error === null || typeof error !== 'object') return false;

  const err = error as Error & { statusCode?: number; responseBody?: string };
  const message = typeof err.message === 'string' ? err.message : '';
  const responseBody = typeof err.responseBody === 'string' ? err.responseBody : '';
  if (isModelNotFound404({ message, responseBody })) {
    return false;
  }
  if (typeof err.statusCode === 'number') {
    return err.statusCode === 404;
  }

  // Fallback: parse "status 404: ..." from error.message (set by mapAiSdkError
  // for an APICallError thrown from the AI SDK), and a message that IS the
  // status, which is the other form some gateways produce.
  //
  // Anchored on purpose. A bare `/\b404\b/` anywhere in the message fires on any
  // text that happens to contain the number — a model id like `gpt-404`, a
  // request id, a body echoing one — and each false positive makes the plugin
  // silently rewrite the user's Base URL and retry against a URL that was
  // never wrong. @DocTpoint's second review (#855) named this.
  return /status\s+404\b/.test(message) || /^\s*404\b/.test(message);
}

function isModelNotFound404(error: { message?: string; responseBody?: string }): boolean {
  return /no endpoints found for\b/i.test(error.message ?? '')
    || /no endpoints found for\b/i.test(error.responseBody ?? '');
}

// ─── Orchestrator ────────────────────────────────────────────────────

export interface ResolveOptions {
  /** User-entered baseURL (always tried first if no cache). */
  baseUrl: string;
  /**
   * Probe function: returns true if the URL works (e.g., minimal
   * message request succeeds), false if it doesn't. Should NOT
   * throw on URL errors — return false instead so the orchestrator
   * can try the next candidate. Throw only on auth/server errors
   * that should propagate.
   */
  testFn: (url: string) => Promise<boolean>;
  /**
   * Original error from the first request attempt — re-thrown if
   * all fallback candidates fail so the user sees the actual error
   * that was observed (not just "all candidates failed").
   */
  originalError?: Error;
}

/**
 * Resolve a working baseURL with fallback to common variations.
 *
 * 1. Check cache → return cached URL if found
 * 2. Try user-entered baseURL via testFn
 * 3. Try each candidate (with 300ms delay between attempts)
 * 4. Cache + return first working URL
 * 5. All fail → throw originalError (or a synthesized error)
 *
 * Returns the user-entered URL if it works (no caching needed).
 */
export async function resolveBaseUrlWithFallback(opts: ResolveOptions): Promise<string> {
  const { baseUrl, testFn, originalError } = opts;

  // Step 1: Check cache
  const cached = getCachedUrl(baseUrl);
  if (cached !== undefined) {
    return cached;
  }

  // Step 2: Try original URL — no try/catch needed; let it throw
  // so auth/server errors propagate immediately. URL errors are
  // the only ones we want to fallback on, and we still surface them
  // via the testFn return value (false = not a URL error worth
  // retrying, true = URL works).
  const originalWorks = await testFn(baseUrl);
  if (originalWorks) {
    return baseUrl;
  }

  // Step 3: Try each candidate with delay
  const candidates = generateUrlCandidates(baseUrl);
  // Skip the first candidate if it's the same as the original URL
  const candidatesToTry = candidates.slice(1);

  for (const candidate of candidatesToTry) {
    // Rate limit protection — small delay between attempts.
    // 300ms × N candidates = max ~1.5s for typical 4-5 candidate
    // lists, which is acceptable for Test Connection.
    await delay(RETRY_DELAY_MS);

    try {
      const works = await testFn(candidate);
      if (works) {
        cacheResolvedUrl(baseUrl, candidate);
        return candidate;
      }
    } catch {
      // testFn threw for this candidate — skip to next
      continue;
    }
  }

  // Step 4: All candidates failed
  if (originalError) {
    throw originalError;
  }
  throw new Error(`All URL candidates failed for: ${baseUrl}`);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

// ─── Fetch Models with fallback ───────────────────────────────────────
//
// v1.23.0 P1.5 follow-up: Kimi Coding Plan Fetch Models inconsistency.
// The settings.ts page has its own hand-rolled Fetch Models logic
// (settings.ts:311-346) that does NOT use the url-fallback module —
// it tries one URL with hardcoded `/v1/models` then falls back to
// `/models` only for Anthropic-compatible, never for OpenAI-compatible.
// Test Connection (createMessage → fallback) uses our url-fallback and
// succeeds for Kimi Anthropic-compatible. Fetch Models fails because
// the hand-rolled path is rigid.
//
// This function unifies the two paths — settings.ts Fetch Models should
// call fetchModelsWithFallback instead of duplicating the URL construction logic.

export type ProviderKind = 'openai-compatible' | 'anthropic-compatible' | 'openai' | 'anthropic';

export interface FetchModelsOptions {
  /** User-entered baseURL (always tried first if no cache). */
  baseUrl: string;
  /** Provider type — affects URL path layout (Anthropic: /v1/models, OpenAI: /models). */
  provider: ProviderKind;
  /**
   * Probe function: takes a fully-constructed models URL (e.g.,
   * `https://api.kimi.com/coding/v1/models`) and returns the list of
   * model IDs from the response, or an empty array when the endpoint
   * answers 2xx with no/empty `data` (a valid "no models" answer) so the
   * orchestrator can try the next candidate.
   *
   * May ALSO throw — every non-2xx response and every transport failure
   * is a throw, not a `[]`:
   *   - `HTTP {status}: …` (non-2xx) — the orchestrator preserves the last
   *     such error and re-throws it, so the caller's `classifyFetchError`
   *     can route the status to Auth/Endpoint/Server.
   *   - `Network error: …` (DNS / refused / timeout wrapped by fetchOneUrl)
   *     — the orchestrator preserves the last such error and re-throws it
   *     when no HTTP-status error was seen, so a disconnect surfaces as
   *     Network rather than the misleading 'empty model list'.
   */
  fetchFn: (modelsUrl: string) => Promise<string[]>;
}

/**
 * Try a series of candidate baseURLs to fetch available models.
 *
 * Algorithm:
 *   1. Check cache → if cached URL has a working models endpoint, return.
 *   2. Try user-entered baseURL + '/models' (OpenAI-style) AND
 *      baseURL + '/v1/models' (Anthropic-style) for provider kinds
 *      that support both layouts. Pick the first that returns non-empty.
 *   3. If user-entered baseURL fails, try fallback candidates from
 *      generateUrlCandidates (add /v1, strip trailing slash, etc.).
 *   4. Cache the first working baseURL for cross-call sharing.
 *   5. Return empty array if all candidates fail (caller shows Notice).
 *
 * Cross-path consistency: this function uses the same module-level
 * cache as resolveBaseUrlWithFallback, so Test Connection's resolved
 * URL is reused for Fetch Models and vice versa.
 */
export async function fetchModelsWithFallback(opts: FetchModelsOptions): Promise<string[]> {
  const { baseUrl, provider, fetchFn } = opts;

  if (!baseUrl) return [];

  // B1 (v1.26.3 PATCH): when fetchFn throws an HTTP-status-bearing error
  // (e.g., fetchOneUrl throws "HTTP 401: ..." for an invalid API key),
  // preserve the last such error so the caller can surface the real status
  // via classifyFetchError. Previously every throw was swallowed by the
  // `catch { continue }` block, and the final empty return was
  // indistinguishable from "URL not found". Also track the last wrapped
  // network error (DNS / refused / timeout — fetchOneUrl wraps these as
  // "Network error: ...") so a genuine connectivity failure is re-thrown as
  // Network instead of collapsing into `[]` → 'empty model list' →
  // fetchErrorEmpty (DocT CR, B1 row 2).
  let lastHttpError: Error | null = null;
  let lastNetworkError: Error | null = null;

  // Step 0: Check cache — if a previous Test Connection resolved this
  // baseURL, reuse the resolved URL for Fetch Models too. This is
  // the cross-path sharing the user reported as missing.
  const cachedResolved = getCachedUrl(baseUrl);
  if (cachedResolved !== undefined && cachedResolved !== baseUrl) {
    // Try the cached resolved URL first
    const cachedPaths = buildModelsPaths(cachedResolved, provider);
    for (const modelsUrl of cachedPaths) {
      await delay(RETRY_DELAY_MS);
      try {
        const models = await fetchFn(modelsUrl);
        if (models.length > 0) return models;
      } catch (err) {
        if (err instanceof Error && /^HTTP \d+/.test(err.message)) {
          lastHttpError = err;
        } else if (err instanceof Error) {
          lastNetworkError = err;
        }
        continue;
      }
    }
    // Cached URL didn't work — fall through to full candidate scan
  }

  // Step 1: Build candidate baseURLs (original first, then fallbacks)
  const baseUrlCandidates = generateUrlCandidates(baseUrl);

  for (const candidateBaseUrl of baseUrlCandidates) {
    // Step 2: Generate URL paths to try for this baseURL. Anthropic and
    // OpenAI providers expose the /models endpoint at different paths:
    //   - Anthropic: {baseURL}/v1/models (Anthropic official) OR /models
    //     (some proxies like Kimi expose at root)
    //   - OpenAI: {baseURL}/models (OpenAI standard) or {baseURL}/v1/models
    //     (some OpenAI-compatible providers like Kimi)
    const pathsToTry = buildModelsPaths(candidateBaseUrl, provider);

    for (const modelsUrl of pathsToTry) {
      // Rate limit protection
      await delay(RETRY_DELAY_MS);

      try {
        const models = await fetchFn(modelsUrl);
        if (models.length > 0) {
          // Cache the resolved baseURL derived from the successful
          // modelsUrl (strip the /models suffix only — see
          // deriveBaseUrlFromModelsUrl for the rationale on
          // stripping just `/models`, not `/v1/models`, because
          // Anthropic AI-SDK appends paths relative to a baseURL
          // that already contains /v1).
          const resolvedBaseUrl = deriveBaseUrlFromModelsUrl(modelsUrl);
          if (resolvedBaseUrl && resolvedBaseUrl !== baseUrl) {
            cacheResolvedUrl(baseUrl, resolvedBaseUrl);
          }
          return models;
        }
      } catch (err) {
        // testFn threw — remember HTTP-status errors (and wrapped network
        // errors) for the final throw; the other kind falls through to the
        // next candidate.
        if (err instanceof Error && /^HTTP \d+/.test(err.message)) {
          lastHttpError = err;
        } else if (err instanceof Error) {
          lastNetworkError = err;
        }
        continue;
      }
    }
  }

  // B1 (v1.26.3 PATCH): surface the last HTTP-status error so the caller's
  // classifyFetchError sees a real status code instead of falling through
  // to the default 'Network' branch. If no HTTP status was seen but a
  // genuine network error was (DNS / refused / timeout wrapped as
  // "Network error: ..." by fetchOneUrl), re-throw that too — a disconnect
  // must report Network, not the misleading 'empty model list' → Empty.
  if (lastHttpError) {
    throw lastHttpError;
  }
  if (lastNetworkError) {
    throw lastNetworkError;
  }

  return [];
}

/**
 * Derive the baseURL from a successful /models URL by stripping
 * just the `/models` suffix (7 chars). The AI-SDK Anthropic provider
 * constructs `{baseURL}/v1/messages` and `{baseURL}/v1/models` —
 * meaning `/v1` IS part of the baseURL, not a path suffix to strip.
 *
 * Returns null if the URL doesn't end with `/models` (caller should
 * skip caching in that case).
 */
function deriveBaseUrlFromModelsUrl(modelsUrl: string): string | null {
  if (modelsUrl.endsWith('/models')) {
    return modelsUrl.slice(0, -'/models'.length);
  }
  return null;
}

/**
 * Build the list of /models paths to try for a given baseURL + provider.
 *
 * For anthropic-compatible, the AI-SDK Anthropic provider constructs
 * `{baseURL}/messages` (no auto /v1 prefix). So if user has `/v1` in
 * their URL, messages go to `/v1/messages`. The /models endpoint is
 * at `/v1/models` (Anthropic official) or `/models` (some proxies).
 *
 * For openai-compatible, the AI-SDK OpenAI provider constructs
 * `{baseURL}/chat/completions`. /models is at `{baseURL}/models` (OpenAI
 * standard). If user has `/v1` in URL, /models is at `/v1/models`.
 */
function buildModelsPaths(baseUrl: string, provider: ProviderKind): string[] {
  const pathSet = new Set<string>();

  if (provider === 'anthropic' || provider === 'anthropic-compatible') {
    // Anthropic style: {baseURL}/v1/models (most common for Anthropic-compatible)
    // Strip any trailing slash, then check if baseURL already has /v1
    const base = baseUrl.replace(/\/+$/, '');
    if (/\/v1$/.test(base)) {
      pathSet.add(`${base}/models`); // already has /v1
    } else {
      // No /v1 in baseURL — try /v1/models AND /models (some providers
      // like Kimi expose /models at the root, not under /v1)
      pathSet.add(`${base}/v1/models`);
      pathSet.add(`${base}/models`);
    }
  } else {
    // OpenAI style: {baseURL}/models
    const base = baseUrl.replace(/\/+$/, '');
    pathSet.add(`${base}/models`);
    // Some OpenAI-compatible providers also expose /v1/models (rare)
    if (!/\/v1$/.test(base)) {
      pathSet.add(`${base}/v1/models`);
    }
  }

  return Array.from(pathSet);
}
