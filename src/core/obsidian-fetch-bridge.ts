// v1.23.0 P1-7: Bridge between Obsidian's `requestUrl` API and the Web
// Fetch API surface that Vercel AI-SDK uses internally.
//
// Background: AI-SDK is browser-native — it calls `fetch(url, init)`.
// Obsidian's renderer (Electron Chromium) normally provides `fetch`,
// but two real-world issues break that path:
//   1. Custom protocol schemes / non-HTTP base URLs (e.g. `http://localhost:11434`
//      for Ollama) can hit CORS preflight edge cases.
//   2. Obsidian's `requestUrl` is the official, sandbox-aware HTTP client
//      (handles proxy, offline detection, mobile). Routing through it
//      keeps plugin behavior consistent with the existing llm-client.
//
// Strategy:
//   - Primary path: Obsidian's `requestUrl` (if available in the runtime).
//   - Fallback: native `fetch` (when `requestUrl` throws / isn't injected,
//     e.g. test environments using jsdom).
//   - Both paths return a Fetch-API-compatible Response so AI-SDK can
//     consume it transparently.
//
// v1.22.5 behavior preserved: 4xx error bodies are surfaced via the
// response body (not thrown) so `extractProviderErrorMessage` / AI-SDK's
// `APICallError` can read them.
//
// Reference: https://ai-sdk.dev/docs/reference/ai-sdk-core/provider#custom-fetch

import { requestUrl, RequestUrlParam, Platform } from 'obsidian';
import { nodeHttpsFetch } from './node-https-fetch';

export interface ObsidianFetchInit {
  method?: string;
  /** Fetch-API HeadersInit: plain object, Headers instance, or tuple array. */
  headers?: HeadersInit;
  body?: string | Uint8Array | undefined;
  signal?: AbortSignal;
  // Note: AI-SDK doesn't pass these but we accept them defensively.
  timeout?: number;
}

/**
 * Convert a Fetch API HeadersInit to a plain object that `requestUrl`
 * understands. AI-SDK passes either a Headers instance, a plain object,
 * or an array of tuples.
 *
 * Exported since v1.27.0 (#425): the Bedrock SigV4 signing wrapper
 * reuses this normalization so wrapped and unwrapped paths see
 * identical header shapes.
 */
export function headersToObject(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const obj: Record<string, string> = {};
    headers.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }
  if (Array.isArray(headers)) {
    const obj: Record<string, string> = {};
    for (const [key, value] of headers) {
      obj[key] = value;
    }
    return obj;
  }
  // Plain object — shallow copy to avoid aliasing caller's object.
  const obj: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    obj[key] = value;
  }
  return obj;
}

// v1.23.0 P1-7: debug logging for fetch adapter path selection.
// Matched with "STREAM-FETCH" prefix so it's greppable in DevTools.
const STREAM_FETCH_LOG = 'STREAM-FETCH';

/**
 * Bridge `requestUrl` to a Web Fetch-compatible Response.
 *
 * Returns a `Response`-like object that exposes:
 *   - `.ok` (boolean, status 200-299)
 *   - `.status` (number)
 *   - `.headers` (Headers)
 *   - `.text()` (async → string)
 *   - `.json()` (async → parsed JSON, or null if body is empty)
 *   - `.arrayBuffer()` (async → ArrayBuffer)
 *
 * Throws on:
 *   - AbortSignal cancellation (re-thrown as DOMException 'AbortError')
 *   - Request construction failure (requestUrl without `body` for POST, etc.)
 *
 * Note: AI-SDK reads `.text()` for error body extraction and JSON parsing,
 * never `.body` (ReadableStream), so we don't need to expose it.
 */
export async function obsidianFetchBridge(
  url: string,
  init?: ObsidianFetchInit
): Promise<Response> {
  // AbortSignal short-circuit: AI-SDK respects AbortSignal but requestUrl
  // doesn't accept one. We honor cancellation here.
  if (init?.signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }

  // Build the request. Obsidian's requestUrl requires `body` as string
  // (or undefined for GET), so we serialize Uint8Array as binary string.
  let body: string | undefined;
  if (init?.body !== undefined && init?.body !== null) {
    if (typeof init.body === 'string') {
      body = init.body;
    } else if (init.body instanceof Uint8Array) {
      body = new TextDecoder().decode(init.body);
    } else {
      body = String(init.body);
    }
  }

  const headers = headersToObject(init?.headers);

  const params: RequestUrlParam = {
    url,
    method: init?.method ?? 'GET',
    headers,
    ...(body !== undefined ? { body } : {}),
    // requestUrl `throw: false` makes 4xx/5xx return a response instead
    // of throwing — matches Fetch API semantics and lets AI-SDK read the
    // error body via `.text()`.
    throw: false,
  };

  let response;
  try {
    response = await requestUrl(params);
  } catch (err) {
    // requestUrl threw — usually network error, CORS, or invalid URL.
    // Re-throw as a fetch-like TypeError so AI-SDK treats it as a
    // network failure (vs. an API error with a body).
    if (err instanceof Error) {
      throw new TypeError(`obsidianFetchBridge network error: ${err.message}`);
    }
    throw err;
  }

  // Check abort AFTER requestUrl resolved — race condition: caller
  // aborted while request was in flight.
  if (init?.signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }

  // Build a Fetch-API-compatible Response from requestUrl's result.
  const responseHeaders = new Headers();
  for (const [key, value] of Object.entries(response.headers ?? {})) {
    responseHeaders.set(key, value);
  }

  const text = response.text ?? '';
  const status = response.status;

  return new Response(text, {
    status,
    statusText: response.status ? String(status) : '',
    headers: responseHeaders,
  });
}

/**
 * Returns true if `fetch` is the AI-SDK-compatible function we want.
 * For test mocking purposes — production callers always pass
 * `obsidianFetchBridge` directly.
 */
export function isObsidianFetchBridge(fn: unknown): fn is typeof obsidianFetchBridge {
  return typeof fn === 'function' && (fn as { name?: string }).name === 'obsidianFetchBridge';
}

// v1.23.0 P1-7 follow-up: real streaming via window.fetch.
//
// Why this exists: `obsidianFetchBridge` (requestUrl path) returns
// the full response body in one shot. AI-SDK's streamText can iterate
// it as a single chunk — not real streaming. For chat-GPT-style
// character-by-character output we need a fetch adapter that exposes
// `response.body: ReadableStream<Uint8Array>`.
//
// We use Obsidian's renderer `window.fetch` (Electron Chromium).
// Tradeoffs:
//   - Cloud providers (api.openai.com, api.anthropic.com, DeepSeek,
//     OpenRouter, Moonshot, GLM, etc.) support CORS — window.fetch
//     works without issue.
//   - Local providers (Ollama, LMStudio) typically do NOT return
//     CORS headers — window.fetch throws TypeError. Caller catches
//     and falls back to obsidianFetchBridge (requestUrl).
//
// Throws:
//   - AbortError: when AbortSignal is cancelled (or already aborted).
//   - TypeError: window.fetch network/CORS failure. Caller should
//     fall back to obsidianFetchBridge.
export async function streamingObsidianFetch(
  url: string,
  init?: ObsidianFetchInit
): Promise<Response> {
  // AbortSignal short-circuit: matches fetch API semantics.
  if (init?.signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }

  const headers = headersToObject(init?.headers);

  // Build fetch init. Body: string passes through, Uint8Array
  // gets encoded as Uint8Array (fetch supports Blob | BufferSource
  // | string). AbortSignal passes through.
  //
  // RequestInit.body is typed as BodyInit | null | undefined which
  // is narrower than our ObsidianFetchInit.body. Cast at the
  // boundary — runtime accepts both string and Uint8Array.
  const fetchInit: RequestInit = {
    method: init?.method ?? 'GET',
    ...(init?.body !== undefined && init?.body !== null
      ? { body: init.body as BodyInit }
      : {}),
    ...(Object.keys(headers).length > 0 ? { headers } : {}),
    ...(init?.signal ? { signal: init.signal } : {}),
  };

  // window.fetch is available in Obsidian's Electron renderer.
  // For environments that lack it (e.g. certain test runners), the
  // call throws TypeError synchronously or via the returned promise.
  // Prefer Obsidian's `activeWindow` (popout-window-aware); fall back
  // to `window` for test environments that don't stub activeWindow.
  type FetchLike = typeof fetch;
  const globalWin: Window | undefined =
    typeof activeWindow !== 'undefined'
      ? activeWindow
      : typeof window !== 'undefined' ? window : undefined;
  let fetchFn: FetchLike | undefined;
  if (globalWin && typeof globalWin.fetch === 'function') {
    fetchFn = globalWin.fetch.bind(globalWin);
  }

  if (!fetchFn) {
    throw new TypeError('streamingObsidianFetch: window.fetch is not available in this environment');
  }

  // Let fetch reject propagate — CORS / network errors throw
  // TypeError, 4xx resolves with ok=false. AI-SDK handles both.
  return fetchFn(url, fetchInit);
}

/**
 * Origins where a cross-origin request has already been observed to fail this
 * session (Issue #741).
 *
 * Populated **only** from an observed `TypeError` — never from a host list.
 * Whether a server permits a cross-origin request is a function of the method,
 * the URL *and the header set*, and #736's custom-header field made the header
 * set user data. A table keyed on host cannot represent a function of two
 * variables, so the only faithful record is the outcome. Remembering it also
 * means a host that later starts answering preflights is picked up again after
 * a reload, with no list to maintain.
 *
 * Session-scoped: cleared on reload, and by `__resetCorsMemory()` in tests.
 */
const corsBlockedOrigins = new Set<string>();

/**
 * Origins where the desktop `node:https` transport has already failed this
 * session (Issue #741 step 2).
 *
 * That transport exists because `requestUrl` cannot stream and Electron's `net`
 * is main-process only. Its cost is that Node does not read Obsidian's proxy
 * configuration, so on a machine that needs a proxy it fails where `requestUrl`
 * works. Treating such a failure as a **verdict about the transport** and
 * remembering it is what keeps the change safe: a proxy user ends up on exactly
 * the behaviour they had before this transport existed, and pays for the
 * discovery once per origin per session rather than once per call.
 */
const nodeTransportBlockedOrigins = new Set<string>();

/**
 * Origin of `url`, or the raw string when it cannot be parsed.
 *
 * The fallback matters because a malformed URL is exactly the kind of input
 * that reaches `window.fetch` as a hard failure — treating each unparseable
 * value as its own key keeps the memory working instead of throwing here.
 */
function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

/**
 * Forget every recorded transport failure (both kinds).
 *
 * Test seam. Production relies on the module being re-evaluated on reload,
 * which is the self-healing path described on `corsBlockedOrigins`.
 */
export function __resetCorsMemory(): void {
  corsBlockedOrigins.clear();
  nodeTransportBlockedOrigins.clear();
}

/**
 * Stream-or-fetch with automatic CORS fallback.
 *
 * Decision tree:
 *   - If baseURL is local (Ollama / LMStudio / private IP):
 *     use obsidianFetchBridge (requestUrl). No CORS issue but
 *     "fake streaming" (whole body in one chunk).
 *   - If this origin has already failed a cross-origin request this
 *     session (Issue #741): skip the gamble and go straight to
 *     requestUrl. The attempt is known to be blocked; retrying it
 *     per call buys nothing.
 *   - Otherwise: try streamingObsidianFetch (window.fetch) first.
 *     On TypeError (CORS, network, DNS), record the origin and fall
 *     back to obsidianFetchBridge (requestUrl). Caller gets a
 *     Response either way; AI-SDK handles single-chunk vs
 *     multi-chunk transparently.
 *
 * This is the function the SDK clients should use — it picks the
 * right strategy per provider and gracefully degrades.
 *
 * Failure modes (all result in a non-streaming fallback):
 *   - TypeError from window.fetch (CORS / network / DNS)
 *   - window.fetch unavailable (e.g. test runner without jsdom)
 *
 * The fallback is announced **once per origin per session** via
 * `console.warn`. That channel is deliberate: `console.debug` is neutralised in
 * shipped builds (`esbuild.config.mjs:15`) and `requestUrl` is a main-process
 * call that never appears in the DevTools network panel, so a debug-level note
 * would leave the downgrade with no observable at all. Repeating it per call
 * would be the log spam this used to avoid; once per origin is the compromise.
 * Real errors (after the fallback also fails) still bubble up.
 */
export async function streamWithFallback(
  url: string,
  init?: ObsidianFetchInit
): Promise<Response> {
  const origin = originOf(url);

  // Local providers: skip the CORS gamble. Use requestUrl directly.
  if (isLocalBaseURL(url)) {
    console.debug(`[${STREAM_FETCH_LOG}] isLocal, using obsidianFetchBridge (requestUrl): ${origin}`);
    return obsidianFetchBridge(url, init);
  }

  // This origin is known to refuse cross-origin requests: do not gamble again.
  if (corsBlockedOrigins.has(origin)) {
    return viaFallbackTransport(url, init, origin);
  }

  // Otherwise: try streaming first.
  try {
    console.debug(`[${STREAM_FETCH_LOG}] try streamingObsidianFetch (window.fetch): ${url}`);
    const res = await streamingObsidianFetch(url, init);
    console.debug(`[${STREAM_FETCH_LOG}] streamingObsidianFetch succeeded, body=${typeof res.body}, status=${res.status}`);
    return res;
  } catch (err) {
    // Fallback: TypeError = CORS / network / DNS failure.
    // Other errors (DOMException from AbortSignal) should propagate.
    if (err instanceof TypeError) {
      const firstTime = !corsBlockedOrigins.has(origin);
      corsBlockedOrigins.add(origin);
      if (firstTime) {
        console.warn(
          `[${STREAM_FETCH_LOG}] ${origin} refused the cross-origin request; falling back for the rest of this session.`
        );
      }
      return viaFallbackTransport(url, init, origin);
    }
    throw err;
  }
}

/**
 * Serve a request whose origin refuses `window.fetch`.
 *
 * Desktop tries the `node:https` transport first because it is the only one
 * here that can still stream. If it fails with a `TypeError` — no proxy path,
 * no route, TLS interception — that is recorded as a property of the origin
 * and the request goes through `requestUrl`, which is buffered but honours the
 * proxy. An `AbortError` is not a `TypeError` and propagates: a cancelled
 * request says nothing about whether the transport works.
 */
async function viaFallbackTransport(
  url: string,
  init: ObsidianFetchInit | undefined,
  origin: string
): Promise<Response> {
  // Mobile has no Node transport at all, so this is not a finding worth
  // reporting — the origin simply goes to requestUrl. Only a *desktop* attempt
  // that failed tells the user something they did not already know.
  if (Platform.isDesktopApp && !nodeTransportBlockedOrigins.has(origin)) {
    try {
      console.debug(`[${STREAM_FETCH_LOG}] trying node:https transport for ${origin}`);
      return await nodeHttpsFetch(url, init);
    } catch (err) {
      if (!(err instanceof TypeError)) throw err;
      nodeTransportBlockedOrigins.add(origin);
      console.warn(
        `[${STREAM_FETCH_LOG}] node:https transport unavailable for ${origin} (${err.message}); using requestUrl, so answers will arrive in one piece.`
      );
    }
  }
  return obsidianFetchBridge(url, init);
}

/**
 * Heuristic: is the given baseURL a localhost / private IP?
 *
 * Used to pick the streaming strategy for createMessageStream:
 *   - true  → use obsidianFetchBridge (requestUrl, no CORS, fake streaming)
 *   - false → use streamingObsidianFetch (window.fetch, real streaming)
 *
 * Local baseURLs (Ollama, LMStudio) don't return CORS headers
 * by default, so window.fetch fails. Cloud providers all support
 * CORS, so window.fetch works.
 */
export function isLocalBaseURL(baseURL: string | undefined): boolean {
  if (!baseURL) return false;
  try {
    const u = new URL(baseURL);
    if (u.hostname === 'localhost') return true;
    if (u.hostname === '127.0.0.1' || u.hostname === '[::1]' || u.hostname === '::1') return true;
    // IPv4 private ranges (RFC 1918): 10.x, 172.16-31.x, 192.168.x
    const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const m = u.hostname.match(ipv4);
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      if (a === 10) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
    }
    return false;
  } catch {
    // Malformed URL — defensively treat as cloud (safer default;
    // streaming is the better UX when uncertain).
    return false;
  }
}