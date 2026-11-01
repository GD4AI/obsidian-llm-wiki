// Put `stream: false` on a request body that does not carry the field.
//
// Issue #916. The AI SDK omits `stream` on the non-streaming path. That is
// correct — OpenAI's default is `stream: false` — but a gateway that reads
// `body.stream !== false` treats an ABSENT field as a request for a stream
// and answers with an event stream. The SDK parses a non-streaming response
// as JSON, so the body fails to parse, and the failure surfaces to the user
// as `status 200: {the whole body}`.
//
// Measured against a 9router gateway: the request body the plugin put on the
// wire was `{"model":…,"max_tokens":…,"messages":[…]}`, and the answer came
// back as a JSON object with `data: [DONE]` appended.
//
// Sending the field explicitly is spec-compliant for every OpenAI-shaped API
// and removes the ambiguity. The streaming path already sends `stream: true`,
// so a body that already carries the field is left alone — that is what makes
// the same wrapper safe to install on both paths.
//
// Scope: the wrapper only touches a body that is a JSON string holding a
// JSON object with no `stream` key. Everything else passes through byte for
// byte.

/** How a fetch is shaped in this codebase — deliberately loose. */
type LooseFetch = (url: unknown, init?: unknown) => Promise<unknown>;

/**
 * Wrap a fetch so a JSON request body without a `stream` field gets one.
 *
 * Returns the given fetch unchanged when there is nothing to do, so the
 * common case costs one call.
 */
export function withExplicitStreamFalse(fetchFn: unknown): unknown {
  const inner = fetchFn as LooseFetch;
  return async (url: unknown, init?: { body?: unknown } & Record<string, unknown>) => {
    const rewritten = withStreamFalse(init?.body);
    if (rewritten === undefined) return inner(url, init);
    return inner(url, { ...(init ?? {}), body: rewritten });
  };
}

/**
 * The rewritten body, or `undefined` when the body must be left alone.
 *
 * `undefined` means "no change" — not "an empty body" — so a request with no
 * body and a request with a body that cannot be parsed both fall through.
 */
function withStreamFalse(body: unknown): string | undefined {
  if (typeof body !== 'string') return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return undefined;
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
  if ('stream' in (parsed as Record<string, unknown>)) return undefined;

  return JSON.stringify({ ...(parsed as Record<string, unknown>), stream: false });
}
