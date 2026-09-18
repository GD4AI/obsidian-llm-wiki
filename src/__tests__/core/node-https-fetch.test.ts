// Issue #741 step 2: desktop-only streaming transport for hosts that block
// cross-origin requests.
//
// Why this exists at all: `requestUrl` returns a complete body
// (`obsidian.d.ts:5293` — `{status, headers, arrayBuffer, json, text}`, no
// `body`), so on a host that refuses the CORS preflight real streaming is
// architecturally unavailable through it. Electron's `net` module would be the
// ideal answer — Chromium's network stack, so proxy-aware *and* streaming — but
// its documented process list is "Main, Utility" and a plugin runs in the
// renderer, so it is out of reach. `node:https` is what remains: no CORS (it is
// not a browser request) and a real socket stream, at the cost of not honouring
// Obsidian's proxy configuration. That cost is why the caller treats a failure
// here as a *verdict about the transport* and falls back to `requestUrl`.
//
// Bot compliance: `node:https` is a Node built-in, so
// `obsidianmd/no-nodejs-modules` applies. The accepted shapes are enumerated in
// the plugin's own test file (`dist/tests/noNodejsModules.test.js`): a positive
// `if (Platform.isDesktop) { … }`, a `Platform.isDesktop && …` short-circuit, a
// ternary consequent, or an early `if (!Platform.isDesktop) { throw }` at
// function start. `if (!Platform.isDesktop) { import('node:https') }` is
// explicitly *forbidden*. Test files under `src/__tests__/` are outside the
// Bot's scan.

import { describe, it, expect, vi } from 'vitest';
import { Platform } from 'obsidian';
import { nodeHttpsFetch } from '../../core/node-https-fetch';

// ─── A fake `node:https` module ─────────────────────────────────────────────
// Injected through `nodeHttpsFetch`'s last parameter, so no module mocking is
// needed and the production import path (guarded, dynamic, createRequire) is
// never exercised by tests.

interface FakeResponseSpec {
  statusCode?: number;
  headers?: Record<string, string | string[]>;
  chunks?: string[];
  /** When set, the request emits `error` instead of responding. */
  error?: Error;
  /** When set, the response emits `error` after the first chunk. */
  streamError?: Error;
}

function makeFakeHttps(spec: FakeResponseSpec) {
  const calls: { options: Record<string, unknown>; body: string } = { options: {}, body: '' };
  let destroyCount = 0;
  let registeredError: ((e: Error) => void) | undefined;

  const request = vi.fn((options: Record<string, unknown>, onResponse: (res: unknown) => void) => {
    calls.options = options;

    const req = {
      on(event: string, handler: (e: Error) => void) {
        if (event === 'error') registeredError = handler;
        return req;
      },
      end(chunk?: string) {
        calls.body = chunk ?? '';
        if (spec.error) {
          // Node emits 'error' asynchronously.
          queueMicrotask(() => registeredError?.(spec.error!));
          return;
        }
        const res = {
          statusCode: spec.statusCode ?? 200,
          headers: spec.headers ?? { 'content-type': 'text/event-stream' },
          on(event: string, handler: (arg: unknown) => void) {
            if (event === 'data') {
              for (const c of spec.chunks ?? []) queueMicrotask(() => handler(new TextEncoder().encode(c)));
            }
            if (event === 'end') queueMicrotask(() => handler(undefined));
            if (event === 'error' && spec.streamError) {
              queueMicrotask(() => handler(spec.streamError));
            }
            return res;
          },
        };
        queueMicrotask(() => onResponse(res));
      },
      destroy() {
        destroyCount += 1;
      },
    };
    return req;
  });

  return {
    module: { request } as unknown as typeof import('node:https'),
    calls,
    request,
    get destroyCount() {
      return destroyCount;
    },
  };
}

async function readAll(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let out = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out;
}

describe('nodeHttpsFetch (desktop-only streaming transport — #741)', () => {
  it('throws TypeError on mobile, so the caller can fall back to requestUrl', async () => {
    const fake = makeFakeHttps({});
    await expect(
      nodeHttpsFetch('https://opencode.ai/zen/go/v1/chat', undefined, false, async () => fake.module)
    ).rejects.toBeInstanceOf(TypeError);
    // The transport must not even load the module when it cannot be used.
    expect(fake.request).not.toHaveBeenCalled();
  });

  it('returns a Response whose body is a real stream, chunk by chunk', async () => {
    const fake = makeFakeHttps({ chunks: ['data: {"a":', '1}\n\n', 'data: [DONE]\n\n'] });

    const res = await nodeHttpsFetch('https://opencode.ai/zen/go/v1/chat', undefined, true, async () => fake.module);

    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(ReadableStream);
    expect(await readAll(res)).toBe('data: {"a":1}\n\ndata: [DONE]\n\n');
  });

  it('forwards method, headers and body to the underlying request', async () => {
    const fake = makeFakeHttps({ chunks: ['ok'] });

    await nodeHttpsFetch(
      'https://opencode.ai/zen/go/v1/chat',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer k', 'Content-Type': 'application/json' },
        body: '{"model":"go"}',
      },
      true,
      async () => fake.module
    );

    expect(fake.calls.options.method).toBe('POST');
    expect(fake.calls.options.headers).toMatchObject({
      Authorization: 'Bearer k',
      'Content-Type': 'application/json',
    });
    expect(fake.calls.options.hostname).toBe('opencode.ai');
    expect(fake.calls.options.path).toBe('/zen/go/v1/chat');
    expect(fake.calls.body).toBe('{"model":"go"}');
  });

  it('reflects the response status and headers', async () => {
    const fake = makeFakeHttps({
      statusCode: 429,
      headers: { 'content-type': 'application/json', 'retry-after': '12' },
      chunks: ['{"error":"rate limited"}'],
    });

    const res = await nodeHttpsFetch('https://opencode.ai/v1/chat', undefined, true, async () => fake.module);

    // 4xx must pass through as a Response, not throw — AI-SDK reads the body.
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('12');
    expect(await res.text()).toBe('{"error":"rate limited"}');
  });

  it('rejects with TypeError on a connection error, so the caller records the transport as unusable', async () => {
    const fake = makeFakeHttps({ error: new Error('connect ECONNREFUSED 127.0.0.1:443') });

    await expect(
      nodeHttpsFetch('https://opencode.ai/v1/chat', undefined, true, async () => fake.module)
    ).rejects.toBeInstanceOf(TypeError);
  });

  it('destroys the request when the signal aborts', async () => {
    const controller = new AbortController();
    const fake = makeFakeHttps({ chunks: ['first'] });

    const res = await nodeHttpsFetch('https://opencode.ai/v1/chat', { signal: controller.signal }, true, async () => fake.module);
    expect(res.body).toBeInstanceOf(ReadableStream);

    controller.abort();
    expect(fake.destroyCount).toBe(1);
  });

  it('rejects an already-aborted signal without opening a socket', async () => {
    const controller = new AbortController();
    controller.abort();
    const fake = makeFakeHttps({ chunks: ['never'] });

    await expect(
      nodeHttpsFetch('https://opencode.ai/v1/chat', { signal: controller.signal }, true, async () => fake.module)
    ).rejects.toThrow();
    expect(fake.request).not.toHaveBeenCalled();
  });

  it('does not leave the socket open after the stream has been fully read', async () => {
    const fake = makeFakeHttps({ chunks: ['a', 'b'] });

    const res = await nodeHttpsFetch('https://opencode.ai/v1/chat', undefined, true, async () => fake.module);
    await readAll(res);

    expect(fake.destroyCount).toBe(0);
  });
});
