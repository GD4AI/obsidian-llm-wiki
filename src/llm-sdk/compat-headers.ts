// compat-headers.ts — request headers for the OpenAI-compatible path (Issue #723)
//
// Three sources, in precedence order (later wins):
//
//   1. **Plugin identity** — `User-Agent: karpathywiki/<version>`. The bundled
//      `@ai-sdk/openai-compatible` otherwise sends the generic
//      `ai-sdk/openai-compatible/<v>`, and gateways that ask clients to identify
//      themselves treat that as an anonymous SDK. OpenCode Zen/Go documents this
//      as a requirement. The Codex OAuth path has always sent the plugin's own
//      name (`openai-codex/request-adapter.ts:39`); this brings the compat path
//      in line rather than adding an OpenCode special case.
//   2. **The provider preset's defaults** — e.g. OpenCode requires a stable
//      per-conversation `x-opencode-session`. The preset table stays declarative
//      by using the `{sessionId}` placeholder, which this module replaces.
//   3. **The user's own headers**, parsed from the settings field.
//
// The AI SDK adds `Authorization` from `apiKey` *before* the custom map and
// documents the map as overriding, so the precedence here is what reaches the
// wire — a user header can replace even the generated ones.
//
// Pure: no Obsidian import, no `crypto` call of its own (the caller supplies the
// session id), so it is testable without the plugin runtime.

/** Placeholder a preset uses when it needs the per-conversation id. */
export const SESSION_ID_PLACEHOLDER = '{sessionId}';

export interface CompatHeaderSources {
  /** Plugin version (`manifest.version`). Missing ⇒ the header is still sent, as `unknown`. */
  version?: string;
  /** `PREDEFINED_PROVIDERS[provider].defaultHeaders`. */
  presetHeaders?: Record<string, string>;
  /** Called at most once, and only when a preset actually asks for it. */
  sessionId?: () => string;
  /** Raw user text, one `Name: value` per line (the settings field). */
  customHeadersRaw?: string;
}

/**
 * RFC 7230 `token` — the only characters a header field-name may contain.
 *
 * Anything else makes `Headers.set` throw at request time, inside the fetch
 * wrapper, where it surfaces as an opaque request failure with no hint at which
 * settings line caused it. `My Header: v` used to pass the colon test and
 * explode later; validating here turns it into the same visible `invalid` count
 * the settings field already reports. Reported by @aisahpA (#736).
 */
const HEADER_NAME_RE = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

/**
 * RFC 7230 §3.2.6 — a field-value may not carry C0 controls or DEL. TAB (0x09)
 * is allowed, as the spec's own `obs-fold` whitespace rule assumes.
 *
 * Written as a loop rather than a regex so no `no-control-regex` suppression is
 * needed; the project forbids `eslint-disable`.
 */
function hasControlChar(value: string): boolean {
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code <= 0x08 || (code >= 0x0a && code <= 0x1f) || code === 0x7f) return true;
  }
  return false;
}

/**
 * Parse the settings field: one `Name: value` per line.
 *
 * Blank lines and `#` comments are skipped. Only the **first** `:` splits, so a
 * value may contain `:` (URLs, `Bearer x`, timestamps). Lines with no `:`, with
 * an empty or non-token name, or with a control character in the value are
 * dropped and counted — a typo must never become a header, and it must not
 * reach `Headers.set`, which would throw far from the cause.
 */
export function parseCustomHeaders(raw: string | undefined): {
  headers: Record<string, string>;
  invalid: number;
} {
  const headers: Record<string, string> = {};
  let invalid = 0;
  for (const line of (raw ?? '').split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const colon = trimmed.indexOf(':');
    if (colon <= 0) {
      invalid += 1;
      continue;
    }
    const name = trimmed.slice(0, colon).trim();
    const value = trimmed.slice(colon + 1).trim();
    if (name === '' || !HEADER_NAME_RE.test(name) || hasControlChar(value)) {
      invalid += 1;
      continue;
    }
    headers[name] = value;
  }
  return { headers, invalid };
}

/**
 * Compose the map handed to `createOpenAICompatible({ headers })`.
 *
 * Never returns an empty map: the identity header is unconditional, so in
 * production this always gives the fetch wrapper something to apply. The
 * `undefined` return covers only the caller that passes no sources at all.
 */
export function compatHeaders(sources: CompatHeaderSources): Record<string, string> | undefined {
  const out: Record<string, string> = {};

  // 1. Identity. Sent unconditionally, and therefore to **every** provider on
  //    this path — not only to one that asked. That is the intent (see the
  //    module header), but it means the earlier claim that header-less providers
  //    "keep the exact call path they had" holds only for a client constructed
  //    directly without headers, which is what the unit tests do — not in
  //    production, where the factory always supplies this.
  //
  //    Caveat worth knowing before relying on it: `User-Agent` is a
  //    fetch-forbidden header, so Chromium may drop it on the `window.fetch`
  //    branch. The `obsidianFetchBridge` (requestUrl) branch does send it. The
  //    header is therefore best-effort on one path and guaranteed on the other.
  out['User-Agent'] = `karpathywiki/${sources.version ?? 'unknown'}`;

  // 2. Preset defaults. The session id is generated lazily and at most once:
  //    ten of the twelve presets never reference the placeholder, and they must
  //    not pay for a UUID they will never send.
  let sessionId: string | undefined;
  for (const [name, value] of Object.entries(sources.presetHeaders ?? {})) {
    if (!value.includes(SESSION_ID_PLACEHOLDER)) {
      out[name] = value;
      continue;
    }
    sessionId ??= sources.sessionId?.() ?? '';
    out[name] = value.split(SESSION_ID_PLACEHOLDER).join(sessionId);
  }

  // 3. User headers last — they win.
  Object.assign(out, parseCustomHeaders(sources.customHeadersRaw).headers);

  return Object.keys(out).length > 0 ? out : undefined;
}
