import { Platform } from 'obsidian';
import { buildAuthorizationUrl, extractTokenResponseAccountId, generateOAuthState, generatePkce, parseTokenResponse } from './auth-core';
import { CODEX_OAUTH_CLIENT_ID, CODEX_REDIRECT_URI, CODEX_TOKEN_URL } from './constants';
import type { PkcePair } from './auth-core';
import type { CodexCredential, FetchLike } from './types';

const LOOPBACK_HOST = '127.0.0.1';
const LOOPBACK_PORT = 1455;
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
const SUCCESS_HTML = '<!doctype html><html><body><h1>Authorization complete</h1><p>You can close this window.</p></body></html>';
const ERROR_HTML = '<!doctype html><html><body><h1>Authorization failed</h1><p>Return to the app and try again.</p></body></html>';

export interface LoopbackCallbackResult {
  code: string;
}

export interface LoopbackServer {
  start(): Promise<void>;
  waitForCallback(): Promise<string>;
  close(): void;
}

export type LoopbackServerFactory = (expectedState: string) => LoopbackServer;

interface LoopbackHttpRequest {
  url?: string;
}

interface LoopbackHttpResponse {
  writeHead(status: number, headers: Record<string, string>): void;
  end(body: string): void;
}

export interface LoopbackHttpServer {
  once(event: 'error', listener: (error: Error) => void): void;
  removeListener(event: 'error', listener: (error: Error) => void): void;
  listen(port: number, host: string, listener: () => void): void;
  close(): void;
}

export interface LoopbackHttpModule {
  createServer(listener: (request: LoopbackHttpRequest, response: LoopbackHttpResponse) => void): LoopbackHttpServer;
}

export type LoopbackHttpLoader = () => Promise<LoopbackHttpModule>;
export type LoopbackNodeHttpImporter = () => Promise<typeof import('node:http')>;

export interface RunLoopbackLoginInput {
  fetchFn: FetchLike;
  openExternal: (url: string) => void | Promise<void>;
  signal?: AbortSignal;
  serverFactory?: LoopbackServerFactory;
  stateFactory?: () => string;
  pkceFactory?: () => Promise<PkcePair>;
  now?: () => number;
}

function abortError(): DOMException {
  return new DOMException('The operation was aborted', 'AbortError');
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw abortError();
}

export function parseLoopbackCallback(requestUrl: string, expectedState: string): LoopbackCallbackResult {
  const url = new URL(requestUrl, `http://localhost:${LOOPBACK_PORT}`);
  if (url.pathname !== '/auth/callback') throw new Error('Invalid OAuth callback path');
  const error = url.searchParams.get('error');
  if (error) throw new Error(url.searchParams.get('error_description') || error);
  if (url.searchParams.get('state') !== expectedState) throw new Error('Invalid OAuth state');
  const code = url.searchParams.get('code');
  if (!code) throw new Error('Missing authorization code');
  return { code };
}

class NodeLoopbackServer implements LoopbackServer {
  private server: LoopbackHttpServer | null = null;
  private closed = false;
  private readonly callback: Promise<string>;
  private resolveCallback: (requestUrl: string) => void = () => undefined;
  private rejectCallback: (error: Error) => void = () => undefined;
  constructor(private readonly expectedState: string, private readonly loadHttp: LoopbackHttpLoader) {
    this.callback = new Promise((resolve, reject) => { this.resolveCallback = resolve; this.rejectCallback = reject; });
  }
  async start(): Promise<void> {
    const http = await this.loadHttp();
    if (this.closed) throw new Error('Loopback server closed');
    this.server = http.createServer((request, response) => {
      const requestUrl = request.url ?? '';
      const callbackUrl = new URL(requestUrl, `http://localhost:${LOOPBACK_PORT}`);
      if (callbackUrl.pathname !== '/auth/callback') {
        response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end(ERROR_HTML);
        return;
      }
      if (callbackUrl.searchParams.get('state') !== this.expectedState) {
        response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end(ERROR_HTML);
        return;
      }
      try {
        parseLoopbackCallback(requestUrl, this.expectedState);
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end(SUCCESS_HTML);
        this.resolveCallback(requestUrl);
      } catch (error: unknown) {
        response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end(ERROR_HTML);
        this.rejectCallback(error instanceof Error ? error : new Error('Invalid OAuth callback'));
      }
    });
    await new Promise<void>((resolve, reject) => {
      const server = this.server;
      if (!server) {
        reject(new Error('Loopback server unavailable'));
        return;
      }
      const onError = (error: Error): void => reject(error);
      server.once('error', onError);
      server.listen(LOOPBACK_PORT, LOOPBACK_HOST, () => { server.removeListener('error', onError); resolve(); });
    });
  }
  waitForCallback(): Promise<string> {
    return this.callback;
  }
  close(): void {
    this.closed = true;
    this.server?.close();
    this.server = null;
  }
}

async function requireNodeHttp(): Promise<typeof import('node:http')> {
  // Obsidian loads plugins as CommonJS. A dynamic import of a Node built-in
  // is handled by the renderer as a browser module fetch on some Obsidian
  // versions (`Failed to fetch dynamically imported module: node module`).
  // Use the CJS loader that is already available to the plugin instead.
  // v1.25.6: Use module.createRequire(__filename) — the typed Node.js API
  // for creating a CJS require function. Replaces the
  // bare `require('node:http')` that v1.25.4/5 used because:
  //   - The bare `require()` global returns `any` per @types/node, polluting
  //     every downstream consumer with `@typescript-eslint/no-unsafe-*`
  //     warnings (Bot enforces these as errors).
  //   - `createRequire` is the official typed Node API for this — both
  //     `node:module` (CommonJS require, guarded below) and `node:http`
  //     (the createRequire result) are protected by the
  //     Platform.isDesktop guard satisfying `obsidianmd/no-nodejs-modules`
  //     AST guard-detection.
  //   - `__filename` is replaced by esbuild with the actual file path in
  //     the bundled CJS output (no `import.meta.url` needed).
  //   - Static imports would fire `no-nodejs-modules` unconditionally, so
  //     the CommonJS require stays inside the desktop guard.
  // The nodeRequire function signature in @types/node is `(id: string) => any`
  // (same as the bare require), so we cast the result to the precise
  // `typeof import('node:http')` type at the call site — the cast is local
  // to this single return statement, so `any` does not propagate downstream.
  if (!Platform.isDesktop) throw new Error('Codex browser login is available only on desktop');
  // eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef -- guarded desktop-only CommonJS loader
  const nodeModule = require('node:module') as typeof import('node:module');
  // eslint-disable-next-line no-undef -- __filename is provided by the CommonJS bundle
  const nodeRequire = nodeModule.Module.createRequire(__filename);
  return nodeRequire('node:http') as typeof import('node:http');
}

export async function loadNodeHttp(isDesktopApp = Platform.isDesktopApp, importHttp: LoopbackNodeHttpImporter = requireNodeHttp): Promise<LoopbackHttpModule> {
  if (!isDesktopApp) throw new Error('Codex browser login is available only on desktop');
  const http = await importHttp();
  return { createServer: (listener) => {
    const server = http.createServer((request, response) => { listener(request, response); });
    return { once: (event, onError) => { server.once(event, onError); }, removeListener: (event, onError) => { server.removeListener(event, onError); }, listen: (port, host, onListening) => { server.listen(port, host, onListening); }, close: () => { server.close(); } };
  } };
}

export function createLoopbackServer(expectedState: string, loadHttp: LoopbackHttpLoader = loadNodeHttp): LoopbackServer {
  return new NodeLoopbackServer(expectedState, loadHttp);
}

function productionServerFactory(expectedState: string): LoopbackServer {
  return createLoopbackServer(expectedState);
}

async function raceWithLoginBounds<T>(operation: Promise<T>, signal: AbortSignal | undefined, deadlineAt: number, now: () => number): Promise<T> {
  throwIfAborted(signal);
  let timer: number | undefined;
  let removeAbortListener = (): void => undefined;
  const cancellation = new Promise<never>((_resolve, reject) => {
    const abort = (): void => reject(abortError());
    removeAbortListener = (): void => signal?.removeEventListener('abort', abort);
    signal?.addEventListener('abort', abort, { once: true });
    const remainingMs = deadlineAt - now();
    if (remainingMs <= 0) {
      reject(new Error('OAuth login timed out'));
      return;
    }
    timer = window.setTimeout(() => reject(new Error('OAuth login timed out')), remainingMs);
  });
  try {
    return await Promise.race([operation, cancellation]);
  } finally {
    if (timer !== undefined) window.clearTimeout(timer);
    removeAbortListener();
  }
}

async function tokenResponseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error('Invalid token response');
  }
}

async function exchangeAuthorizationCode(input: RunLoopbackLoginInput, code: string, pkce: PkcePair, deadlineAt: number, now: () => number): Promise<CodexCredential> {
  const body = new URLSearchParams({ grant_type: 'authorization_code', client_id: CODEX_OAUTH_CLIENT_ID, code, redirect_uri: CODEX_REDIRECT_URI, code_verifier: pkce.verifier });
  const response = await raceWithLoginBounds(input.fetchFn(CODEX_TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString(), signal: input.signal }), input.signal, deadlineAt, now);
  if (!response.ok) throw new Error(`Token exchange failed: ${response.status}`);
  const token = parseTokenResponse(await raceWithLoginBounds(tokenResponseJson(response), input.signal, deadlineAt, now));
  const accountId = extractTokenResponseAccountId(token);
  if (accountId === null) throw new Error('Token response missing account id');
  const credential: CodexCredential = { accessToken: token.access_token, refreshToken: token.refresh_token, accountId, expiresAt: now() + token.expires_in * 1000 };
  if (token.id_token !== undefined) credential.idToken = token.id_token;
  return credential;
}

export async function runLoopbackLogin(input: RunLoopbackLoginInput): Promise<CodexCredential> {
  const controller = new AbortController();
  const abort = (): void => controller.abort();
  if (input.signal?.aborted) controller.abort();
  else input.signal?.addEventListener('abort', abort, { once: true });
  const boundedInput: RunLoopbackLoginInput = { ...input, signal: controller.signal };
  const now = input.now ?? Date.now;
  const deadlineAt = now() + LOGIN_TIMEOUT_MS;
  try {
    throwIfAborted(controller.signal);
    const state = (input.stateFactory ?? generateOAuthState)();
    const pkce = await raceWithLoginBounds((input.pkceFactory ?? generatePkce)(), controller.signal, deadlineAt, now);
    const server = (input.serverFactory ?? productionServerFactory)(state);
    try {
      await raceWithLoginBounds(server.start(), controller.signal, deadlineAt, now);
      const callback = raceWithLoginBounds(server.waitForCallback(), controller.signal, deadlineAt, now);
      const opening = raceWithLoginBounds(Promise.resolve().then(() => input.openExternal(buildAuthorizationUrl(state, pkce))), controller.signal, deadlineAt, now);
      const [, requestUrl] = await Promise.all([opening, callback]);
      const { code } = parseLoopbackCallback(requestUrl, state);
      return await exchangeAuthorizationCode(boundedInput, code, pkce, deadlineAt, now);
    } finally {
      server.close();
    }
  } finally {
    controller.abort();
    input.signal?.removeEventListener('abort', abort);
  }
}
