// Describe a response body the plugin could not read.
//
// Issue #916. The SDK wraps a body it could not parse in an APICallError
// carrying the HTTP status, so a request that succeeded arrives as an error
// with a 2xx status. The old format — `status 200: {the whole body}` — read
// as a contradiction and pasted hundreds of characters of raw response into
// the UI.
//
// This module produces the replacement text. It is a pure function so the
// wording can be tested without a provider, and so the same description can
// be reused by the error mapper and by anything else that has to say this.

/** How much of the body to quote. Long enough to identify, short enough to read. */
const EXCERPT_CHARS = 200;

/**
 * A one-line description of why a 2xx body could not be read.
 *
 * The event-stream case is named because it is the one that was reported
 * (#916) and because it has an unusual signature: the body is valid JSON
 * followed by an SSE terminator, so it looks like JSON until the last few
 * characters.
 */
export function describeUnreadableBody(body: string): string {
  const trimmed = body.trim();
  if (trimmed.length === 0) return 'The response body was empty.';

  if (looksLikeEventStream(trimmed)) {
    return 'The body looks like an event stream, not JSON. A gateway that answers a '
      + 'non-streaming request with a stream produces this; the request needs "stream": false.';
  }

  // A body that IS valid JSON is not "not JSON". Naming the real problem saves
  // the reader from concluding the gateway mangled the encoding when it
  // actually answered something the SDK did not recognise as a completion.
  try {
    JSON.parse(trimmed);
    return 'The body is JSON, but not a completion response this client recognises.';
  } catch {
    return 'The body is not JSON.';
  }
}

/** A short excerpt of the body, for identifying which response it was. */
export function bodyExcerpt(body: string): string {
  const trimmed = body.trim();
  if (trimmed.length <= EXCERPT_CHARS) return trimmed;
  return `${trimmed.slice(0, EXCERPT_CHARS)}… (${trimmed.length} characters total)`;
}

/**
 * True when the body carries SSE framing.
 *
 * Two shapes count: a `data:` line anywhere in it, and a trailing
 * `data: [DONE]`. The second is the #916 signature — a JSON object with the
 * terminator appended — and it is checked first because it is the narrower
 * and more specific signal.
 */
function looksLikeEventStream(body: string): boolean {
  if (/\bdata:\s*\[DONE\]/i.test(body)) return true;
  return /^\s*data:\s/m.test(body);
}
