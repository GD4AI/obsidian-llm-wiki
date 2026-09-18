// Issue #741 step 2: a desktop-only streaming transport for hosts that refuse
// the CORS preflight.
//
// ## Why a second network stack exists at all
//
// Three transports were available, and none of them is both CORS-free and
// streaming:
//
// | transport      | CORS | streams | honours the proxy |
// |----------------|------|---------|-------------------|
// | `window.fetch` | yes  | yes     | yes               |
// | `requestUrl`   | no   | **no**  | yes               |
// | `node:https`   | no   | yes     | **no**            |
// | Electron `net` | no   | yes     | yes               |
//
// `requestUrl` cannot stream by construction: it resolves to a finished body
// (`obsidian.d.ts:5293` — `{status, headers, arrayBuffer, json, text}`, no
// `body`). Electron's `net` would be the ideal fourth row, but its documented
// process list is "Main, Utility" and a plugin runs in the renderer.
//
// So `node:https` is what remains, and its one cost is real: Electron's own
// documentation contrasts `net` with the Node modules by noting that `net`
// offers "better support for web proxies". Node's `https` does not read
// `http_proxy`/`https_proxy` and cannot see Obsidian's proxy configuration, so
// on a machine that needs a proxy this transport fails where `requestUrl`
// succeeds.
//
// That is why this module is written to **fail loudly and cheaply**, and why
// the caller treats failure as a verdict about the transport rather than about
// the request: a `TypeError` from here sends the call back to `requestUrl` and
// records the origin so it is not retried. The worst case for any user is
// therefore the behaviour they already had.
//
// ## Bot compliance
//
// `node:https` is a Node built-in, so `obsidianmd/no-nodejs-modules` applies.
// The accepted shapes are enumerated in the plugin's own test file
// (`eslint-plugin-obsidianmd/dist/tests/noNodejsModules.test.js`): a positive
// `if (Platform.isDesktop) { … }`, a `Platform.isDesktop && …` short-circuit, a
// ternary consequent, or an early `if (!Platform.isDesktop) { throw }` at
// function start. The negated form wrapping the import —
// `if (!Platform.isDesktop) { import('node:https') }` — is explicitly
// *forbidden*. This file uses the early-exit form, matching
// `openai-codex/loopback-flow.ts:134`, which has shipped since v1.25.6.

import { Platform } from 'obsidian';
import type { ObsidianFetchInit } from './obsidian-fetch-bridge';
import { headersToObject } from './obsidian-fetch-bridge';

/** The shape of the Node module this transport needs. */
type NodeHttpsModule = typeof import('node:https');

/** Loader seam: tests inject a fake instead of the real module. */
export type NodeHttpsImporter = () => Promise<NodeHttpsModule>;

/**
 * Load `node:https`, desktop only.
 *
 * The early-exit guard at function start is what satisfies
 * `obsidianmd/no-nodejs-modules` — see the module header. `createRequire` is
 * used rather than bare `require()` because `@types/node` types the latter as
 * `any`, which would propagate `@typescript-eslint/no-unsafe-*` through every
 * caller (Bot enforces those as errors). The cast is local to the return
 * statement so `any` stops here.
 */
async function requireNodeHttps(): Promise<NodeHttpsModule> {
  if (!Platform.isDesktop) {
    throw new TypeError('node:https transport is available on desktop only');
  }
  const nodeModule = await import('node:module');
  // eslint-disable-next-line no-undef -- __filename is a CJS global injected by esbuild's CJS bundler; not a browser global - desktop-only, guarded by Platform.isDesktop above
  const nodeRequire = nodeModule.Module.createRequire(__filename);
  return nodeRequire('node:https') as NodeHttpsModule;
}

/** Status codes for which the Fetch API forbids a body. */
const NULL_BODY_STATUSES = new Set([204, 205, 304]);

/**
 * Issue the request through `node:https` and hand back a Fetch-API `Response`
 * whose body is a live stream.
 *
 * Throws `TypeError` for everything that means "this transport did not work"
 * (module unavailable, connection refused, DNS, TLS, proxy interception) so the
 * caller's existing `instanceof TypeError` handling routes the origin back to
 * `requestUrl`. An `AbortError` is deliberately *not* a `TypeError` — a
 * cancelled request says nothing about whether the transport is usable.
 */
export async function nodeHttpsFetch(
  url: string,
  init?: ObsidianFetchInit,
  isDesktopApp = Platform.isDesktopApp,
  importHttps: NodeHttpsImporter = requireNodeHttps
): Promise<Response> {
  if (!isDesktopApp) {
    throw new TypeError('node:https transport is available on desktop only');
  }
  if (init?.signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }

  const https = await importHttps();
  const parsed = new URL(url);
  const headers = headersToObject(init?.headers);

  return new Promise<Response>((resolve, reject) => {
    const request = https.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || undefined,
        path: `${parsed.pathname}${parsed.search}`,
        method: init?.method ?? 'GET',
        headers,
      },
      response => {
        const statusCode = response.statusCode ?? 0;
        // Response rejects statuses outside 200-599, and refuses a body for
        // 204/205/304. Neither can carry information the caller could use.
        const status = statusCode >= 200 && statusCode <= 599 ? statusCode : 200;
        const responseHeaders = new Headers();
        for (const [key, value] of Object.entries(response.headers ?? {})) {
          if (Array.isArray(value)) {
            for (const v of value) responseHeaders.append(key, v);
          } else if (value !== undefined) {
            responseHeaders.set(key, value);
          }
        }

        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            response.on('data', chunk => {
              controller.enqueue(new Uint8Array(chunk as Uint8Array));
            });
            response.on('end', () => controller.close());
            response.on('error', err => controller.error(err));
          },
          // Consumer walked away (AI-SDK abort, error path): stop the socket
          // rather than letting the response drain into nothing.
          cancel() {
            request.destroy();
          },
        });

        resolve(
          new Response(NULL_BODY_STATUSES.has(status) ? null : stream, {
            status,
            headers: responseHeaders,
          })
        );
      }
    );

    request.on('error', err => {
      reject(new TypeError(`node:https request failed: ${err.message}`));
    });

    if (init?.signal) {
      init.signal.addEventListener('abort', () => {
        request.destroy();
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      });
    }

    const body = init?.body;
    request.end(typeof body === 'string' || body instanceof Uint8Array ? body : undefined);
  });
}
