import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createLoopbackServer, loadNodeHttp, parseLoopbackCallback, runLoopbackLogin } from '../../../llm-sdk/openai-codex/loopback-flow';
import type { LoopbackHttpModule } from '../../../llm-sdk/openai-codex/loopback-flow';
import type { FetchLike } from '../../../llm-sdk/openai-codex/types';
import { fakeLoopbackServer, failingFetch, jwt } from '../openai-codex-test-helpers';

const callbackUrl = '/auth/callback?code=abc&state=state-1';

function tokenResponse(): Response {
  return new Response(JSON.stringify({ access_token: 'opaque-access', refresh_token: 'refresh', expires_in: 3600, id_token: jwt('acct-1') }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve = (_value: T): void => undefined;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function fakeHttpModule(createServer: ReturnType<typeof vi.fn<LoopbackHttpModule['createServer']>>): LoopbackHttpModule {
  return { createServer };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('Codex loopback flow', () => {
  it('bundles desktop HTTP as a lazy, guarded load of node:module', () => {
    // v1.25.6: switched from bare require('node:http') (which Bot
    // rejected as no-unsafe-* propagation) to a typed createRequire
    // helper. The property under test is laziness behind the desktop
    // guard, not a spelling.
    //
    // #751 changed what the build emits for it. esbuild's `platform`
    // defaults to 'browser', and under that platform an *external*
    // dynamic import is assumed available natively and left as written —
    // so `await import('node:module')` shipped as a native ESM import
    // inside a CJS bundle, could not load, and was swallowed by the
    // callers' TypeError handling. With
    // `supported: { 'dynamic-import': false }` the same guarded source
    // compiles to the deferred require form below. Both forms are lazy
    // and both sit behind the guard; only one of them can actually load.
    //
    // Asserting the wrapper rather than the token is strictly stronger:
    // the old assertion passed for ANY occurrence of
    // `import("node:module")`, including one at module-eval time. Here
    // every `require("node:module")` must be the deferred one, so an
    // eager load cannot be introduced without failing this test.
    const bundle = readFileSync('main.js', 'utf8');
    expect(bundle).not.toContain('require("node:http")');
    expect(bundle).not.toContain('import("node:http")');
    const loads = bundle.match(/require\("node:module"\)/g) ?? [];
    const deferred = bundle.match(/Promise\.resolve\(\)\.then\(\(\) => __toESM\(require\("node:module"\)\)\)/g) ?? [];
    expect(deferred).toHaveLength(2);
    expect(loads).toHaveLength(deferred.length);
    expect(bundle).toContain('createRequire');
    // Both call sites keep their own desktop guard, and the load cannot run
    // before its guard: assert by position rather than by a character budget,
    // which would be a guess about how much the bundler elides between them.
    const firstLoad = bundle.indexOf('require("node:module")');
    const secondLoad = bundle.indexOf('require("node:module")', firstLoad + 1);
    const guardHttps = bundle.indexOf('node:https transport is available on desktop only');
    const guardLoopback = bundle.indexOf('Codex browser login is available only on desktop');
    expect(guardHttps).toBeGreaterThan(-1);
    expect(guardLoopback).toBeGreaterThan(-1);
    expect(guardHttps).toBeLessThan(firstLoad);
    expect(guardLoopback).toBeLessThan(secondLoad);
  });
  it('rejects mobile runtime loading before resolving Node HTTP', async () => {
    const importHttp = vi.fn();
    await expect(loadNodeHttp(false, importHttp)).rejects.toThrow('desktop');
    expect(importHttp).not.toHaveBeenCalled();
  });
  it('accepts the callback path with a code and matching state', () => {
    expect(parseLoopbackCallback(callbackUrl, 'state-1')).toEqual({ code: 'abc' });
  });

  it('rejects a callback on the wrong path', () => {
    expect(() => parseLoopbackCallback('/wrong?code=abc&state=state-1', 'state-1')).toThrow('Invalid OAuth callback path');
  });

  it('rejects a callback without an authorization code', () => {
    expect(() => parseLoopbackCallback('/auth/callback?state=state-1', 'state-1')).toThrow('Missing authorization code');
  });

  it('surfaces an OAuth provider error', () => {
    expect(() => parseLoopbackCallback('/auth/callback?error=access_denied&error_description=Login+cancelled', 'state-1')).toThrow('Login cancelled');
  });

  it('rejects a callback with mismatched state', () => {
    expect(() => parseLoopbackCallback('/auth/callback?code=abc&state=wrong', 'state-1')).toThrow('Invalid OAuth state');
  });

  it('opens the browser after listening and exchanges a valid callback', async () => {
    const events: string[] = [];
    const close = vi.fn(() => { events.push('close'); });
    const fetchFn = vi.fn<FetchLike>(async () => tokenResponse());
    const server = fakeLoopbackServer({ requestUrl: callbackUrl, close });
    const credential = await runLoopbackLogin({ serverFactory: () => ({ ...server, start: async () => { events.push('start'); } }), fetchFn, openExternal: (url) => { events.push(`open:${url}`); }, stateFactory: () => 'state-1', pkceFactory: async () => ({ verifier: 'verifier-1', challenge: 'challenge-1' }), now: () => 1000 });
    expect(events[0]).toBe('start');
    expect(events[1]).toContain('open:https://auth.openai.com/oauth/authorize?');
    expect(events[1]).toContain('state=state-1');
    expect(events[1]).toContain('code_challenge=challenge-1');
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(fetchFn.mock.calls[0]?.[0]).toBe('https://auth.openai.com/oauth/token');
    expect(fetchFn.mock.calls[0]?.[1]?.method).toBe('POST');
    expect(fetchFn.mock.calls[0]?.[1]?.body).toContain('code_verifier=verifier-1');
    expect(credential).toEqual({ accessToken: 'opaque-access', refreshToken: 'refresh', accountId: 'acct-1', expiresAt: 3601000, idToken: jwt('acct-1') });
    expect(close).toHaveBeenCalledOnce();
  });

  it('keeps listening after unrelated paths and mismatched state callbacks', async () => {
    let listener: Parameters<LoopbackHttpModule['createServer']>[0] = () => undefined;
    const responseStatuses: number[] = [];
    const http = fakeHttpModule(vi.fn((handler) => {
      listener = handler;
      return { once: () => undefined, removeListener: () => undefined, listen: (_port, _host, onListening) => { onListening(); }, close: () => undefined };
    }));
    const server = createLoopbackServer('state-1', async () => http);
    await server.start();
    const callback = server.waitForCallback();
    let settled = false;
    void callback.then(() => { settled = true; }, () => { settled = true; });
    const respond = { writeHead: (status: number) => { responseStatuses.push(status); }, end: () => undefined };
    listener({ url: '/favicon.ico' }, respond);
    listener({ url: '/auth/callback?code=attacker&state=wrong' }, respond);
    await Promise.resolve();
    expect(settled).toBe(false);
    listener({ url: callbackUrl }, respond);
    await expect(callback).resolves.toBe(callbackUrl);
    expect(responseStatuses).toEqual([404, 400, 200]);
    server.close();
  });

  it.each([
    ['/wrong?code=abc&state=state-1', 'Invalid OAuth callback path'],
    ['/auth/callback?state=state-1', 'Missing authorization code'],
    ['/auth/callback?error=access_denied', 'access_denied'],
    ['/auth/callback?code=abc&state=wrong', 'Invalid OAuth state'],
  ])('closes the listener after callback rejection for %s', async (requestUrl, message) => {
    const close = vi.fn();
    const server = fakeLoopbackServer({ requestUrl, close });
    await expect(runLoopbackLogin({ serverFactory: () => server, fetchFn: vi.fn(), openExternal: vi.fn(), stateFactory: () => 'state-1', pkceFactory: async () => ({ verifier: 'verifier-1', challenge: 'challenge-1' }) })).rejects.toThrow(message);
    expect(close).toHaveBeenCalledOnce();
  });

  it('closes the listener when its port is occupied', async () => {
    const close = vi.fn();
    const server = fakeLoopbackServer({ startError: new Error('listen EADDRINUSE: address already in use 127.0.0.1:1455'), close });
    await expect(runLoopbackLogin({ serverFactory: () => server, fetchFn: vi.fn(), openExternal: vi.fn(), stateFactory: () => 'state-1', pkceFactory: async () => ({ verifier: 'verifier-1', challenge: 'challenge-1' }) })).rejects.toThrow('EADDRINUSE');
    expect(close).toHaveBeenCalledOnce();
  });

  it('closes the listener after token exchange failure', async () => {
    const close = vi.fn();
    const server = fakeLoopbackServer({ requestUrl: callbackUrl, close });
    await expect(runLoopbackLogin({ serverFactory: () => server, fetchFn: failingFetch, openExternal: vi.fn(), stateFactory: () => 'state-1', pkceFactory: async () => ({ verifier: 'verifier-1', challenge: 'challenge-1' }) })).rejects.toThrow('Token exchange failed');
    expect(close).toHaveBeenCalledOnce();
  });

  it('closes the listener after the five-minute timeout', async () => {
    vi.useFakeTimers();
    const close = vi.fn();
    const server = fakeLoopbackServer({ waitForCallback: () => new Promise(() => undefined), close });
    const pending = runLoopbackLogin({ serverFactory: () => server, fetchFn: vi.fn(), openExternal: vi.fn(), stateFactory: () => 'state-1', pkceFactory: async () => ({ verifier: 'verifier-1', challenge: 'challenge-1' }) });
    const rejection = expect(pending).rejects.toThrow('OAuth login timed out');
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    await rejection;
    expect(close).toHaveBeenCalledOnce();
  });

  it('aborts an in-flight token exchange when the five-minute bound expires', async () => {
    vi.useFakeTimers();
    let fetchAborted = false;
    const fetchFn = vi.fn<FetchLike>((_url, init) => new Promise<Response>((_resolve, reject) => {
      if (!init?.signal) throw new Error('Missing OAuth timeout signal');
      init.signal.addEventListener('abort', () => { fetchAborted = true; reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
    }));
    const pending = runLoopbackLogin({ serverFactory: () => fakeLoopbackServer({ requestUrl: callbackUrl, close: vi.fn() }), fetchFn, openExternal: vi.fn(), stateFactory: () => 'state-1', pkceFactory: async () => ({ verifier: 'verifier-1', challenge: 'challenge-1' }) });
    const rejection = expect(pending).rejects.toThrow('OAuth login timed out');
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    await rejection;
    expect(fetchAborted).toBe(true);
  });

  it('closes the listener after abort', async () => {
    const controller = new AbortController();
    const close = vi.fn();
    const server = fakeLoopbackServer({ waitForCallback: () => new Promise(() => undefined), close });
    const pending = runLoopbackLogin({ serverFactory: () => server, fetchFn: vi.fn(), openExternal: vi.fn(), stateFactory: () => 'state-1', pkceFactory: async () => ({ verifier: 'verifier-1', challenge: 'challenge-1' }), signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(close).toHaveBeenCalledOnce();
  });

  it('prevents a late loopback bind after abort during runtime loading', async () => {
    const controller = new AbortController();
    const loading = deferred<LoopbackHttpModule>();
    const loadHttp = vi.fn(() => loading.promise);
    const createServer = vi.fn<LoopbackHttpModule['createServer']>(() => ({ once: () => undefined, removeListener: () => undefined, listen: () => undefined, close: () => undefined }));
    const server = createLoopbackServer('state-1', loadHttp);
    const pending = runLoopbackLogin({ serverFactory: () => server, fetchFn: vi.fn(), openExternal: vi.fn(), stateFactory: () => 'state-1', pkceFactory: async () => ({ verifier: 'verifier-1', challenge: 'challenge-1' }), signal: controller.signal });
    await vi.waitFor(() => { expect(loadHttp).toHaveBeenCalledOnce(); });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    loading.resolve(fakeHttpModule(createServer));
    await Promise.resolve();
    await Promise.resolve();
    expect(createServer).not.toHaveBeenCalled();
  });

  it('prevents a late loopback bind after timeout during runtime loading', async () => {
    vi.useFakeTimers();
    const loading = deferred<LoopbackHttpModule>();
    const loadHttp = vi.fn(() => loading.promise);
    const createServer = vi.fn<LoopbackHttpModule['createServer']>(() => ({ once: () => undefined, removeListener: () => undefined, listen: () => undefined, close: () => undefined }));
    const server = createLoopbackServer('state-1', loadHttp);
    const pending = runLoopbackLogin({ serverFactory: () => server, fetchFn: vi.fn(), openExternal: vi.fn(), stateFactory: () => 'state-1', pkceFactory: async () => ({ verifier: 'verifier-1', challenge: 'challenge-1' }) });
    const rejection = expect(pending).rejects.toThrow('OAuth login timed out');
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    await rejection;
    expect(loadHttp).toHaveBeenCalledOnce();
    loading.resolve(fakeHttpModule(createServer));
    await Promise.resolve();
    await Promise.resolve();
    expect(createServer).not.toHaveBeenCalled();
  });

  it('observes callback rejection while browser opening is pending', async () => {
    const opening = deferred<void>();
    const events: string[] = [];
    const server = { start: async () => undefined, waitForCallback: () => { events.push('wait'); return Promise.reject(new Error('Invalid OAuth state')); }, close: vi.fn() };
    const pending = runLoopbackLogin({ serverFactory: () => server, fetchFn: vi.fn(), openExternal: () => { events.push('open'); return opening.promise; }, stateFactory: () => 'state-1', pkceFactory: async () => ({ verifier: 'verifier-1', challenge: 'challenge-1' }) });
    const rejection = pending.catch((error: unknown) => error);
    await vi.waitFor(() => { expect(events).toEqual(['wait', 'open']); });
    opening.resolve();
    await expect(rejection).resolves.toMatchObject({ message: 'Invalid OAuth state' });
    expect(server.close).toHaveBeenCalledOnce();
  });
});
