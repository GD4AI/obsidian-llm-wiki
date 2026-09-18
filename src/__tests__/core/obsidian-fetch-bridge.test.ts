// v1.23.0 P1-7: Unit tests for obsidianFetchBridge.
//
// Tests cover:
//   - Happy path: 200 response (text, status, headers)
//   - 4xx passes through (requestUrl throws NOT — we set throw:false)
//   - AbortSignal before request → throws AbortError
//   - AbortSignal during request (race) → throws AbortError
//   - Headers conversion (plain object, Headers instance, array tuple)
//   - Body serialization (string, Uint8Array)
//   - requestUrl throws → re-throws as TypeError
//   - JSON body parsing helper (consumers do .json() themselves)
//
// v1.23.0 P1-7 follow-up (true streaming):
//   - streamingObsidianFetch: returns native Response with body stream
//   - CORS / network error → throws TypeError (caller falls back)
//   - isLocalBaseURL: localhost / 127. / RFC 1918 private IPs

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestUrl } from 'obsidian';
import {
  obsidianFetchBridge,
  isObsidianFetchBridge,
  streamingObsidianFetch,
  streamWithFallback,
  isLocalBaseURL,
  __resetCorsMemory,
} from '../../core/obsidian-fetch-bridge';

const mockRequestUrl = vi.mocked(requestUrl);

// The desktop `node:https` transport is injected here rather than exercised for
// real. Note the harness's `Platform` mock sets `isDesktopApp: true` but leaves
// `isDesktop` undefined, so the production loader would throw — which would make
// these tests pass for the wrong reason, or worse, reach the network if the
// mock is ever completed. Stubbing the module keeps the intent explicit.
const mockNodeHttpsFetch = vi.hoisted(() => vi.fn());
vi.mock('../../core/node-https-fetch', () => ({ nodeHttpsFetch: mockNodeHttpsFetch }));

function makeRequestUrlResult(opts: {
  status: number;
  text?: string;
  headers?: Record<string, string>;
}): Awaited<ReturnType<typeof requestUrl>> {
  const text = opts.text ?? '';
  // Best-effort JSON parse — production code (obsidianFetchBridge) only
  // uses `response.text`, never `response.json`, so this is purely a
  // mock fidelity convenience.
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  return {
    status: opts.status,
    text,
    json,
    headers: opts.headers ?? {},
    arrayBuffer: async () => new TextEncoder().encode(text).buffer,
  } as unknown as Awaited<ReturnType<typeof requestUrl>>;
}

describe('obsidianFetchBridge', () => {
  beforeEach(() => {
    mockRequestUrl.mockReset();
  });

  describe('happy path', () => {
    it('returns a Response with status 200 and text body', async () => {
      mockRequestUrl.mockResolvedValue(makeRequestUrlResult({
        status: 200,
        text: 'hello world',
      }));

      const res = await obsidianFetchBridge('https://api.example.com/v1/chat', {
        method: 'POST',
        body: '{"prompt":"hi"}',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      expect(res.ok).toBe(true);
      expect(await res.text()).toBe('hello world');
    });

    it('forwards method, headers, and body to requestUrl', async () => {
      mockRequestUrl.mockResolvedValue(makeRequestUrlResult({ status: 200, text: '' }));

      await obsidianFetchBridge('https://api.example.com/v1/chat', {
        method: 'POST',
        headers: { 'X-Custom': 'value', 'Authorization': 'Bearer sk-test' },
        body: '{"k":"v"}',
      });

      const call = mockRequestUrl.mock.calls[0][0] as unknown as Record<string, unknown>;
      expect(call.url).toBe('https://api.example.com/v1/chat');
      expect(call.method).toBe('POST');
      expect(call.headers).toEqual({
        'X-Custom': 'value',
        'Authorization': 'Bearer sk-test',
      });
      expect(call.body).toBe('{"k":"v"}');
      // throw: false is critical — AI-SDK reads 4xx bodies, not throws
      expect(call.throw).toBe(false);
    });

    it('uses GET with no body when init is omitted', async () => {
      mockRequestUrl.mockResolvedValue(makeRequestUrlResult({ status: 200, text: '[]' }));

      await obsidianFetchBridge('https://api.example.com/v1/models');

      const call = mockRequestUrl.mock.calls[0][0] as unknown as Record<string, unknown>;
      expect(call.method).toBe('GET');
      expect(call.body).toBeUndefined();
    });

    it('exposes response headers as a Fetch-API Headers instance', async () => {
      mockRequestUrl.mockResolvedValue(makeRequestUrlResult({
        status: 200,
        text: '',
        headers: { 'content-type': 'application/json', 'x-request-id': 'abc-123' },
      }));

      const res = await obsidianFetchBridge('https://api.example.com/v1/chat', { method: 'GET' });

      expect(res.headers).toBeInstanceOf(Headers);
      expect(res.headers.get('content-type')).toBe('application/json');
      expect(res.headers.get('x-request-id')).toBe('abc-123');
    });
  });

  describe('4xx / 5xx passes through (preserves v1.22.5 behavior)', () => {
    it('returns 400 with body for caller to read (does not throw)', async () => {
      // AI-SDK's APICallError reads .text() / .json() on 4xx — if we
      // throw here, AI-SDK can't extract the provider error message.
      mockRequestUrl.mockResolvedValue(makeRequestUrlResult({
        status: 400,
        text: JSON.stringify({ error: { message: 'Invalid API key' } }),
      }));

      const res = await obsidianFetchBridge('https://api.openai.com/v1/chat', {
        method: 'POST',
        body: '{}',
      });

      expect(res.status).toBe(400);
      expect(res.ok).toBe(false);
      expect(await res.text()).toContain('Invalid API key');
    });

    it('returns 429 with quota body intact (Issue #207 v1.22.5 regression test)', async () => {
      mockRequestUrl.mockResolvedValue(makeRequestUrlResult({
        status: 429,
        text: JSON.stringify({ error: { message: 'You exceeded your current quota, please check your plan and billing details' } }),
      }));

      const res = await obsidianFetchBridge('https://api.openai.com/v1/chat', { method: 'POST', body: '{}' });

      expect(res.status).toBe(429);
      const body = await res.text();
      expect(body).toContain('quota');
      expect(body).toContain('billing');
    });

    it('returns 500 with body for caller to read', async () => {
      mockRequestUrl.mockResolvedValue(makeRequestUrlResult({
        status: 500,
        text: 'Internal Server Error',
      }));

      const res = await obsidianFetchBridge('https://api.example.com/v1/chat', { method: 'POST', body: '{}' });

      expect(res.status).toBe(500);
      expect(await res.text()).toBe('Internal Server Error');
    });
  });

  describe('AbortSignal handling', () => {
    it('throws AbortError when signal is already aborted before request', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        obsidianFetchBridge('https://api.example.com/v1/chat', {
          method: 'POST',
          body: '{}',
          signal: controller.signal,
        })
      ).rejects.toThrow(DOMException);

      // requestUrl should NOT have been called
      expect(mockRequestUrl).not.toHaveBeenCalled();
    });

    it('throws AbortError when signal is aborted during in-flight request', async () => {
      // Simulate requestUrl resolving AFTER caller aborted
      const deferred: { resolve?: (value: unknown) => void } = {};
      mockRequestUrl.mockImplementation(
        () =>
          new Promise((resolve) => {
            deferred.resolve = resolve;
          }) as unknown as ReturnType<typeof requestUrl>
      );

      const controller = new AbortController();
      const promise = obsidianFetchBridge('https://api.example.com/v1/chat', {
        method: 'POST',
        body: '{}',
        signal: controller.signal,
      });

      // Caller aborts while request is pending
      controller.abort();

      // Now resolve requestUrl
      deferred.resolve!(makeRequestUrlResult({ status: 200, text: 'ok' }));

      await expect(promise).rejects.toThrow(DOMException);
    });

    it('does NOT throw when no signal is provided', async () => {
      mockRequestUrl.mockResolvedValue(makeRequestUrlResult({ status: 200, text: '' }));

      const res = await obsidianFetchBridge('https://api.example.com/v1/chat', { method: 'POST', body: '{}' });
      expect(res.status).toBe(200);
    });
  });

  describe('Headers conversion', () => {
    it('accepts a Headers instance (Fetch API style — lowercase keys per spec)', async () => {
      mockRequestUrl.mockResolvedValue(makeRequestUrlResult({ status: 200, text: '' }));

      const headers = new Headers();
      headers.set('X-Custom', 'value');
      headers.set('Authorization', 'Bearer sk-test');

      await obsidianFetchBridge('https://api.example.com/v1/chat', {
        method: 'POST',
        headers,
        body: '{}',
      });

      // Per Fetch spec, Headers.forEach() yields lowercase keys.
      const call = mockRequestUrl.mock.calls[0][0] as unknown as Record<string, unknown>;
      expect(call.headers).toEqual({
        'x-custom': 'value',
        'authorization': 'Bearer sk-test',
      });
    });

    it('accepts an array of tuples (Fetch API style)', async () => {
      mockRequestUrl.mockResolvedValue(makeRequestUrlResult({ status: 200, text: '' }));

      // HeadersInit array form: explicitly typed because TS infers
      // nested literal as `string[]` otherwise.
      const tupleHeaders: HeadersInit = [['X-Custom', 'value'], ['Authorization', 'Bearer sk-test']];
      await obsidianFetchBridge('https://api.example.com/v1/chat', {
        method: 'POST',
        headers: tupleHeaders,
        body: '{}',
      });

      const call = mockRequestUrl.mock.calls[0][0] as unknown as Record<string, unknown>;
      expect(call.headers).toEqual({
        'X-Custom': 'value',
        'Authorization': 'Bearer sk-test',
      });
    });

    it('returns empty headers when input is undefined', async () => {
      mockRequestUrl.mockResolvedValue(makeRequestUrlResult({ status: 200, text: '' }));

      await obsidianFetchBridge('https://api.example.com/v1/chat', { method: 'POST', body: '{}' });

      const call = mockRequestUrl.mock.calls[0][0] as unknown as Record<string, unknown>;
      expect(call.headers).toEqual({});
    });
  });

  describe('Body serialization', () => {
    it('passes string body verbatim', async () => {
      mockRequestUrl.mockResolvedValue(makeRequestUrlResult({ status: 200, text: '' }));

      await obsidianFetchBridge('https://api.example.com/v1/chat', {
        method: 'POST',
        body: 'plain text body',
      });

      const call = mockRequestUrl.mock.calls[0][0] as unknown as Record<string, unknown>;
      expect(call.body).toBe('plain text body');
    });

    it('serializes Uint8Array body via TextDecoder', async () => {
      mockRequestUrl.mockResolvedValue(makeRequestUrlResult({ status: 200, text: '' }));

      const bytes = new TextEncoder().encode('hello bytes');
      await obsidianFetchBridge('https://api.example.com/v1/chat', {
        method: 'POST',
        body: bytes,
      });

      const call = mockRequestUrl.mock.calls[0][0] as unknown as Record<string, unknown>;
      expect(call.body).toBe('hello bytes');
    });

    it('omits body when undefined (GET request safety)', async () => {
      mockRequestUrl.mockResolvedValue(makeRequestUrlResult({ status: 200, text: '' }));

      await obsidianFetchBridge('https://api.example.com/v1/models');

      const call = mockRequestUrl.mock.calls[0][0] as unknown as Record<string, unknown>;
      expect('body' in call ? call.body : undefined).toBeUndefined();
    });
  });

  describe('Network error handling', () => {
    it('re-throws requestUrl errors as TypeError for AI-SDK network detection', async () => {
      mockRequestUrl.mockRejectedValue(new Error('Network request failed'));

      await expect(
        obsidianFetchBridge('https://api.example.com/v1/chat', { method: 'POST', body: '{}' })
      ).rejects.toThrow(TypeError);

      await expect(
        obsidianFetchBridge('https://api.example.com/v1/chat', { method: 'POST', body: '{}' })
      ).rejects.toThrow(/network error/);
    });

    it('re-throws non-Error exceptions unchanged', async () => {
      mockRequestUrl.mockRejectedValue('string error');

      await expect(
        obsidianFetchBridge('https://api.example.com/v1/chat', { method: 'POST', body: '{}' })
      ).rejects.toBe('string error');
    });
  });

  describe('isObsidianFetchBridge', () => {
    it('returns true for the bridge function itself', () => {
      expect(isObsidianFetchBridge(obsidianFetchBridge)).toBe(true);
    });

    it('returns false for other functions', () => {
      expect(isObsidianFetchBridge(() => Promise.resolve())).toBe(false);
    });

    it('returns false for non-functions', () => {
      expect(isObsidianFetchBridge('string')).toBe(false);
      expect(isObsidianFetchBridge(null)).toBe(false);
      expect(isObsidianFetchBridge(undefined)).toBe(false);
    });
  });
});

describe('streamingObsidianFetch (true streaming via window.fetch)', () => {
  // v1.23.0 P1-7 follow-up: real character-by-character streaming for
  // AI-SDK's streamText. The legacy requestUrl path returns the full
  // body at once (cannot stream). window.fetch returns a native
  // Response with a ReadableStream body — AI-SDK can iterate it
  // chunk-by-chunk. For LOCAL providers (Ollama / LMStudio) CORS
  // blocks window.fetch; callers must catch + fall back to
  // obsidianFetchBridge.

  // Helper: build a fetch stub that returns a Response with a
  // ReadableStream body yielding the given chunks in order.
  function makeFetchResponse(chunks: string[], status = 200) {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        for (const c of chunks) {
          controller.enqueue(encoder.encode(c));
        }
        controller.close();
      },
    });
    return new Response(body, { status, headers: { 'content-type': 'text/event-stream' } });
  }

  beforeEach(() => {
    // Restore window.fetch in case a prior test stubbed it. The
    // jsdom default fetch returns 200 OK for any URL, which our
    // production code may pick up if vi.spyOn wasn't called.
    vi.restoreAllMocks();
  });

  it('returns a Response with status 200 when window.fetch succeeds', async () => {
    const mockFetch = vi.spyOn(window, 'fetch').mockResolvedValueOnce(
      makeFetchResponse(['data: {"chunk":1}\n\n', 'data: {"chunk":2}\n\n'])
    );

    const res = await streamingObsidianFetch('https://api.openai.com/v1/chat', {
      method: 'POST',
      body: '{}',
    });

    expect(res.status).toBe(200);
    expect(res.ok).toBe(true);
    // Body is a ReadableStream (not a string) — AI-SDK can stream it.
    expect(res.body).toBeInstanceOf(ReadableStream);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('forwards method, headers, body, and signal to window.fetch', async () => {
    const mockFetch = vi.spyOn(window, 'fetch').mockResolvedValueOnce(
      makeFetchResponse([])
    );

    const controller = new AbortController();
    await streamingObsidianFetch('https://api.openai.com/v1/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'authorization': 'Bearer sk-test' },
      body: '{"prompt":"hi"}',
      signal: controller.signal,
    });

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe('https://api.openai.com/v1/chat');
    const init = callArgs[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"prompt":"hi"}');
    expect(init.signal).toBe(controller.signal);
    expect(init.headers).toEqual({
      'content-type': 'application/json',
      'authorization': 'Bearer sk-test',
    });
  });

  it('throws TypeError on CORS failure (window.fetch rejects with TypeError)', async () => {
    // CORS errors from window.fetch manifest as TypeError: Failed to fetch.
    // Caller is expected to catch and fall back to requestUrl path.
    vi.spyOn(window, 'fetch').mockRejectedValueOnce(
      new TypeError('Failed to fetch')
    );

    await expect(
      streamingObsidianFetch('http://localhost:11434/v1/chat', { method: 'POST' })
    ).rejects.toThrow(TypeError);
  });

  it('throws TypeError on network error (DNS / connection refused)', async () => {
    vi.spyOn(window, 'fetch').mockRejectedValueOnce(
      new TypeError('NetworkError when attempting to fetch resource')
    );

    await expect(
      streamingObsidianFetch('https://api.openai.com/v1/chat', { method: 'POST' })
    ).rejects.toThrow(TypeError);
  });

  it('throws AbortError when AbortSignal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const mockFetch = vi.spyOn(window, 'fetch');

    await expect(
      streamingObsidianFetch('https://api.openai.com/v1/chat', {
        method: 'POST',
        signal: controller.signal,
      })
    ).rejects.toThrow(DOMException);

    // fetch should NOT have been called
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('passes 4xx through as Response (does not throw — AI-SDK reads body for error)', async () => {
    // window.fetch resolves with ok=false for 4xx; the body is still
    // readable. AI-SDK's APICallError reads responseBody to surface
    // the provider diagnostic. This is the v1.22.5 behavior we
    // preserve.
    vi.spyOn(window, 'fetch').mockResolvedValueOnce(
      makeFetchResponse(
        ['data: {"error":{"message":"You exceeded your current quota"}}\n\n'],
        429
      )
    );

    const res = await streamingObsidianFetch('https://api.openai.com/v1/chat', { method: 'POST' });
    expect(res.status).toBe(429);
    expect(res.ok).toBe(false);
    const text = await res.text();
    expect(text).toContain('quota');
  });
});

describe('isLocalBaseURL', () => {
  // Determines whether to use streamingObsidianFetch (cloud) or
  // obsidianFetchBridge (local) for createMessageStream. Local URLs
  // (Ollama / LMStudio) fail CORS on window.fetch.
  it('returns true for http://localhost:* (Ollama default)', () => {
    expect(isLocalBaseURL('http://localhost:11434/v1')).toBe(true);
  });

  it('returns true for http://127.0.0.1:* (LMStudio default)', () => {
    expect(isLocalBaseURL('http://127.0.0.1:1234/v1')).toBe(true);
  });

  it('returns true for http://[::1]:* (IPv6 loopback)', () => {
    expect(isLocalBaseURL('http://[::1]:11434/v1')).toBe(true);
  });

  it('returns true for RFC 1918 private IPs (10.x / 172.16-31.x / 192.168.x)', () => {
    expect(isLocalBaseURL('http://10.0.0.5:11434/v1')).toBe(true);
    expect(isLocalBaseURL('http://172.20.1.1:1234/v1')).toBe(true);
    expect(isLocalBaseURL('http://192.168.1.100:8080/v1')).toBe(true);
  });

  it('returns false for cloud providers (api.openai.com etc.)', () => {
    expect(isLocalBaseURL('https://api.openai.com/v1')).toBe(false);
    expect(isLocalBaseURL('https://api.anthropic.com/v1')).toBe(false);
    expect(isLocalBaseURL('https://api.deepseek.com/v1')).toBe(false);
  });

  it('returns false for empty / malformed baseURL (defensive: cloud is safer default)', () => {
    expect(isLocalBaseURL('')).toBe(false);
    expect(isLocalBaseURL('not-a-url')).toBe(false);
  });
});

describe('streamWithFallback (CORS memory — #741)', () => {
  // #741: the transport used to be chosen from the URL shape alone
  // (`isLocalBaseURL`), but whether a server permits a cross-origin request is
  // a function of method + URL + *header set*, and #736 made the header set
  // user data. A table keyed on host cannot represent a function of two
  // variables, so the only faithful record is the observed outcome: a real
  // CORS TypeError is remembered per origin for the session, and later calls
  // stop gambling on a request already known to be blocked.
  //
  // The memory is session-scoped — a reload clears it, which is also how it
  // self-heals if a host starts answering preflights.

  function chunkedResponse(chunks: string[], status = 200) {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        for (const c of chunks) controller.enqueue(encoder.encode(c));
        controller.close();
      },
    });
    return new Response(body, { status, headers: { 'content-type': 'text/event-stream' } });
  }

  const CHAT = '/v1/chat/completions';
  const OPENCODE = `https://opencode.ai/zen/go/v1${CHAT}`;

  beforeEach(() => {
    vi.restoreAllMocks();
    __resetCorsMemory();
    // The fallback leg always ends in `requestUrl`; give it a body so the
    // assertions can check that the caller still receives a Response.
    mockRequestUrl.mockReset();
    mockRequestUrl.mockResolvedValue(makeRequestUrlResult({ status: 200, text: 'buffered' }));
    // Default: the desktop transport is unavailable (the common case in the
    // field today — a proxy, or a build without Node access). Individual tests
    // override this to exercise the streaming path.
    mockNodeHttpsFetch.mockReset();
    mockNodeHttpsFetch.mockRejectedValue(new TypeError('node:https transport is available on desktop only'));
  });

  it('uses the desktop node transport for a blocked origin, which still streams', async () => {
    // The whole point of step 2: on desktop, a CORS-blocked origin keeps real
    // streaming instead of degrading to a buffered requestUrl answer.
    const streamed = new Response(
      new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode('data: {"a":1}\n\n'));
          c.close();
        },
      }),
      { status: 200 }
    );
    mockNodeHttpsFetch.mockReset();
    mockNodeHttpsFetch.mockResolvedValue(streamed);
    vi.spyOn(window, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    const res = await streamWithFallback(OPENCODE, { method: 'POST' });

    expect(mockNodeHttpsFetch).toHaveBeenCalledTimes(1);
    expect(res).toBe(streamed);
    // requestUrl is the buffered last resort and must not be reached.
    expect(mockRequestUrl).not.toHaveBeenCalled();
  });

  it('remembers a failed node transport so later calls skip it (no regression for proxy users)', async () => {
    // A machine behind a proxy cannot reach the host directly, so the desktop
    // transport fails where requestUrl succeeds. Recording that failure is what
    // keeps such a user on exactly the behaviour they had before step 2.
    vi.spyOn(window, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    await streamWithFallback(OPENCODE, { method: 'POST' });
    expect(mockNodeHttpsFetch).toHaveBeenCalledTimes(1);
    expect(mockRequestUrl).toHaveBeenCalledTimes(1);

    await streamWithFallback(OPENCODE, { method: 'POST' });
    // Not retried, and the request still completes through requestUrl.
    expect(mockNodeHttpsFetch).toHaveBeenCalledTimes(1);
    expect(mockRequestUrl).toHaveBeenCalledTimes(2);
  });

  it('tries window.fetch first on a host with no recorded failure', async () => {
    const mockFetch = vi
      .spyOn(window, 'fetch')
      .mockResolvedValueOnce(chunkedResponse(['data: {"a":1}\n\n']));

    const res = await streamWithFallback(`https://api.openai.com/v1${CHAT}`, { method: 'POST' });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    // Real streaming is preserved: the body is a stream, not a string.
    expect(res.body).toBeInstanceOf(ReadableStream);
  });

  it('remembers a CORS TypeError so the next call skips the doomed attempt', async () => {
    const mockFetch = vi
      .spyOn(window, 'fetch')
      .mockRejectedValue(new TypeError('Failed to fetch'));

    await streamWithFallback(OPENCODE, { method: 'POST' });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockRequestUrl).toHaveBeenCalled();

    await streamWithFallback(OPENCODE, { method: 'POST' });
    // The whole point: a second call to the same origin does not re-attempt a
    // request that is already known to be blocked.
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('keeps the memory per-origin, so other hosts still stream', async () => {
    const mockFetch = vi
      .spyOn(window, 'fetch')
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await streamWithFallback(OPENCODE, { method: 'POST' });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    mockFetch.mockResolvedValueOnce(chunkedResponse(['data: {"a":1}\n\n']));
    const res = await streamWithFallback(`https://api.openai.com/v1${CHAT}`, { method: 'POST' });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(res.body).toBeInstanceOf(ReadableStream);
  });

  it('does not remember a non-TypeError (only CORS/network is the signal)', async () => {
    const mockFetch = vi.spyOn(window, 'fetch').mockRejectedValueOnce(new Error('boom'));

    await expect(
      streamWithFallback(`https://api.kimi.com/v1${CHAT}`, { method: 'POST' })
    ).rejects.toThrow('boom');

    mockFetch.mockResolvedValueOnce(chunkedResponse(['data: {"a":1}\n\n']));
    await streamWithFallback(`https://api.kimi.com/v1${CHAT}`, { method: 'POST' });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does not remember AbortError (a cancelled request is not a CORS verdict)', async () => {
    const mockFetch = vi
      .spyOn(window, 'fetch')
      .mockRejectedValueOnce(new DOMException('The operation was aborted.', 'AbortError'));

    await expect(
      streamWithFallback(`https://api.deepseek.com/v1${CHAT}`, { method: 'POST' })
    ).rejects.toThrow();

    mockFetch.mockResolvedValueOnce(chunkedResponse(['data: {"a":1}\n\n']));
    await streamWithFallback(`https://api.deepseek.com/v1${CHAT}`, { method: 'POST' });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('warns on the production-visible channel when it downgrades', async () => {
    // console.debug is neutralised in shipped builds (esbuild.config.mjs:15),
    // so console.warn is the only signal a user's build can emit. Without it
    // the degradation is invisible: no log, no error, and requestUrl never
    // appears in the DevTools network panel either.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(window, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await streamWithFallback(OPENCODE, { method: 'POST' });

    // Two lines are expected and they say different things: the origin refused
    // the cross-origin request, and the desktop transport could not stand in
    // for it. Both name the origin so the cause can be traced.
    const lines = warn.mock.calls.map(c => String(c[0]));
    expect(lines.some(l => l.includes('opencode.ai') && l.includes('refused'))).toBe(true);
    expect(lines.some(l => l.includes('node:https'))).toBe(true);
  });

  it('does not warn again for the same origin in the same session', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(window, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    await streamWithFallback(OPENCODE, { method: 'POST' });
    const afterFirst = warn.mock.calls.length;
    expect(afterFirst).toBeGreaterThan(0);

    await streamWithFallback(OPENCODE, { method: 'POST' });

    // Everything about this origin is already known; repeating it is the log
    // spam the original silent fallback was written to avoid.
    expect(warn.mock.calls.length).toBe(afterFirst);
  });

  it('sends local providers straight to requestUrl without touching window.fetch', async () => {
    const mockFetch = vi.spyOn(window, 'fetch');

    await streamWithFallback('http://localhost:11434/v1/chat/completions', { method: 'POST' });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockRequestUrl).toHaveBeenCalled();
  });

  it('treats an unparseable URL as its own origin rather than trusting it', async () => {
    const mockFetch = vi
      .spyOn(window, 'fetch')
      .mockRejectedValue(new TypeError('Failed to fetch'));

    await streamWithFallback('not-a-url', { method: 'POST' });
    await streamWithFallback('not-a-url', { method: 'POST' });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});