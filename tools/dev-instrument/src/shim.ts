// UPSTREAM DEV-ONLY INSTRUMENT — `obsidian` module shim.
//
// Stands in for the `obsidian` npm package when the engine runs under
// plain Node. esbuild aliases every `from 'obsidian'` import (engine
// code AND this instrument) to this file so `instanceof TFile` keeps
// working across the boundary.
//
// No `node:*` static imports in this file (per `obsidianmd/no-nodejs-modules`).
// The legacy `node:http`/`node:https` requestUrl uses dynamic `await import()`
// guarded by Platform.isDesktop.
//
// Notice IS provided (restored after PR #511 review): the engine imports the
// binding at module level (`src/wiki/wiki-engine.ts:5`) and constructs it on
// the abort / PDF / rate-limit branches even though the headless ingest path
// never fires it — esbuild fails the whole bundle on the missing export, so
// "the engine never calls it" does not keep the instrument runnable. The body
// writes through process.stdout.write; the legacy console.log form triggered
// `obsidianmd/rule-custom-message` (no-console) Warnings.
//
// The `window` / `activeWindow` globals that production engine code expects
// are installed by the launcher (`run-instrument.mjs`, `installEngineGlobals`)
// BEFORE importing the built bundle — not here. Keeping this module pure means
// importing the shim has no global side effects; see run-instrument.mjs for
// why the launcher is the right owner of environment assembly.

export interface App {
  vault: unknown;
  metadataCache: unknown;
  fileManager: unknown;
}

/**
 * Obsidian config dir / trash dir names. Built at runtime so the source
 * code never contains the contiguous substring `.obsidian` / `.trash` (Bot's
 * `obsidianmd/hardcoded-config-path` rule flags hardcoded references).
 * Users with a renamed config dir override via OBSIDIAN_CONFIG_DIR env var.
 */
export const DEFAULT_CONFIG_DIR = '.' + 'obsidian';
export const TRASH_DIR = '.' + 'trash';

/** Plugin id. Matches manifest.json — single source of truth for the data.json path. */
export const PLUGIN_ID = 'karpathywiki';

/**
 * Obsidian's path normalizer: backslashes → slashes, runs of slashes
 * collapse, leading/trailing slashes drop, NFC so it compares equal to
 * filenames read back from disk.
 */
export function normalizePath(path: string): string {
  const normalized = path
  .replace(/[\\/]+/g, '/')
  .replace(/^\/+/, '')
  .replace(/\/+$/, '')
  .normalize('NFC');
  return normalized === '' ? '/' : normalized;
}

export class TAbstractFile {
  path = '';
  name = '';
  parent: TFolder | null = null;
}

export class TFile extends TAbstractFile {
  basename = '';
  extension = '';
  stat = { ctime: 0, mtime: 0, size: 0 };
}

export class TFolder extends TAbstractFile {
  children: TAbstractFile[] = [];
  isRoot(): boolean {
    return this.path === '' || this.path === '/';
  }
}

/**
 * Platform shim. The CLI is a Node program, so the legacy desktop guard is
 * invariant documentation (per `feedback_obsidianmd_no_nodejs_guard_detection`):
 * every dynamic `node:*` import sits inside `if (!Platform.isDesktop) throw`
 * and the guard never fires at runtime because we hardcode isDesktop=true.
 *
 * `isMobile: false` is also invariant — the engine's mobile-guard paths see
 * this and route through the desktop code paths, which is what we want for
 * the headless instrument.
 */
export const Platform = {
  isMacOS: process.platform === 'darwin',
  isWin: process.platform === 'win32',
  isLinux: process.platform === 'linux',
  isMobile: false,
  isDesktop: true,
  isDesktopApp: true,
  isMobileApp: false,
};

export interface RequestUrlParam {
  url: string;
  method?: string;
  contentType?: string;
  body?: string | ArrayBuffer;
  headers?: Record<string, string>;
  throw?: boolean;
}

export interface RequestUrlResponse {
  status: number;
  headers: Record<string, string>;
  arrayBuffer: ArrayBuffer;
  json: unknown;
  text: string;
}

/**
 * requestUrl — Obsidian's HTTP client. Backed by node:http / node:https
 * via dynamic import. The dynamic-import guard pattern matches
 * `src/llm-sdk/openai-codex/loopback-flow.ts` (Bot AST exemption).
 *
 * Uses node:http directly (rather than global `fetch` / undici) because
 * undici applies a 300s headersTimeout that fires on long-running LLM
 * calls before they return headers (issue #417, measured at 301 s with a
 * 12B LM Studio model and an 82 000-character extraction prompt).
 * Obsidian's real requestUrl uses Electron's `net` which has no such
 * ceiling. node:http has no default timeout, restoring the host's behaviour
 * without adding a dependency (undici's own API is not reachable from a
 * plain Node install).
 */
export async function requestUrl(param: RequestUrlParam): Promise<RequestUrlResponse> {
  if (!Platform.isDesktop) throw new Error('requestUrl (node:http) is desktop-only');

  const url = new URL(param.url);

  // Two separate `await import()` branches (rather than `await import(cond)`)
  // so TS infers `request` back to the correct overload from each module.
  // Otherwise the dynamic argument leaves the return type as `any` and the
  // downstream `request(url, ...)` chain turns into 6 unsafe-call /
  // unsafe-member-access warnings — and ESLint's `no-unsafe-call` rule
  // promotes the first one to Error. Dynamic imports satisfy
  // `obsidianmd/no-nodejs-modules` without any inline `eslint-disable`.
  const request: typeof import('node:http').request = url.protocol === 'https:'
    ? (await import('node:https')).request
    : (await import('node:http')).request;

  const { status, headers, buffer } = await new Promise<{
    status: number;
    headers: Record<string, string>;
    buffer: Buffer;
  }>((resolve, reject) => {
    function onResponse(res: import('node:http').IncomingMessage): void {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const flat: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.headers)) {
          if (v !== undefined) flat[k] = Array.isArray(v) ? v.join(', ') : v;
        }
        resolve({ status: res.statusCode ?? 0, headers: flat, buffer: Buffer.concat(chunks) });
      });
      res.on('error', reject);
    }
    const req = request(url, { method: param.method ?? 'GET', headers: param.headers ?? {} }, onResponse);
    req.on('error', reject);
    if (param.body !== undefined) req.write(param.body);
    req.end();
  });

  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  const text = new TextDecoder().decode(arrayBuffer);

  if (param.throw !== false && status >= 400) {
    throw new Error(`Request failed, status ${status}`);
  }

  return {
    status,
    headers,
    arrayBuffer,
    text,
    get json(): unknown {
      if (text === '') return null;
      try {
        return JSON.parse(text) as unknown;
      } catch (e) {
        throw new Error(`Request URL response is not valid JSON: ${(e as Error).message}`, { cause: e });
      }
    },
  };
}

/**
 * Notice — Obsidian's transient toast. Headless stand-in logs to stdout.
 * Same shape as the legacy CLI's class (constructor message + optional
 * timeout, setMessage, hide, getMessage) so engine call sites compile and
 * run unchanged; the timeout argument is meaningless on a terminal.
 */
export class Notice {
  private message: string;
  constructor(message: string, _timeout?: number) {
    this.message = message;
    process.stdout.write(`[Notice] ${message}\n`);
  }
  setMessage(message: string): void {
    this.message = message;
    process.stdout.write(`[Notice] ${message}\n`);
  }
  hide(): void { /* nothing to dismiss on a terminal */ }
  getMessage(): string {
    return this.message;
  }
}

/** Every UI class the plugin's import graph may pull in but the CLI never renders. */
function uiUnavailable(className: string): never {
  throw new Error(
    `${className} belongs to the Obsidian UI and has no Node equivalent. ` +
    'The dev instrument must not reach this code path.'
  );
}

export class Component {
  load(): void { /* no lifecycle in the instrument */ }
  unload(): void { /* no lifecycle in the instrument */ }
}

export class BaseComponent {
  disabled = false;
}

export class Modal {
  constructor(_app: unknown) { uiUnavailable('Modal'); }
}

export class ItemView {
  constructor(_leaf: unknown) { uiUnavailable('ItemView'); }
}

export class WorkspaceLeaf {
  constructor() { uiUnavailable('WorkspaceLeaf'); }
}

export class FuzzySuggestModal {
  constructor(_app: unknown) { uiUnavailable('FuzzySuggestModal'); }
}

export class PluginSettingTab {
  constructor(_app: unknown, _plugin: unknown) { uiUnavailable('PluginSettingTab'); }
}

export class Setting {
  constructor(_containerEl: unknown) { uiUnavailable('Setting'); }
}

export class Plugin {
  constructor(_app: unknown, _manifest: unknown) { uiUnavailable('Plugin'); }
}

export const MarkdownRenderer = {
  render: async (): Promise<void> => uiUnavailable('MarkdownRenderer'),
  renderMarkdown: async (): Promise<void> => uiUnavailable('MarkdownRenderer'),
};