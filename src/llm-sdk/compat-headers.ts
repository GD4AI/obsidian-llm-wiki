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
 * Parse the settings field: one `Name: value` per line.
 *
 * Blank lines and `#` comments are skipped. Only the **first** `:` splits, so a
 * value may contain `:` (URLs, `Bearer x`, timestamps). Lines with no `:`, or
 * with an empty name, are dropped — a typo must not become a header named after
 * whatever preceded the colon.
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
    if (name === '') {
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
 * Returns `undefined` when there is nothing to send, so a backend that never
 * asked for extra headers sees exactly the request shape it saw before this
 * feature existed.
 */
export function compatHeaders(sources: CompatHeaderSources): Record<string, string> | undefined {
  const out: Record<string, string> = {};

  // 1. Identity. Sent unconditionally — it is a statement about this client, not
  //    a response to any provider's requirement.
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
