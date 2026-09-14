// shared-rejection-verbs.ts
//
// v1.26.3 PATCH — extracted from the per-prober REJECTION_VERBS
// constants in output-mode-prober.ts and reasoning-strip-probe.ts.
// Both classifiers use the same vocabulary (verb + field-marker two-
// marker pattern). Keeping them in sync by hand is a foot-gun: any
// future contributor who adds a verb to one probe will forget the
// other. A single shared constant + a generic classifier helper makes
// drift impossible.
//
// The vocabulary is the union of both probes' previous verbs:
//
//   'unrecognized', 'unknown', 'invalid value', 'unsupported',
//   'not allowed', 'not supported', 'must be', 'should be'
//
// The reasoning-strip prober (PR #411) originally had the first 6;
// the output-mode prober (Phase A2) added the last 2 ('must be',
// 'should be') to catch Anthropic / Claude-style field-rejection
// phrasing. The union is the safe form — adding verbs only widens
// matches, doesn't narrow them. No production classifier behavior
// changes (every string that previously matched still matches).

export const REJECTION_VERBS = [
  'unrecognized',
  'unknown',
  'invalid value',
  'unsupported',
  'not allowed',
  'not supported',
  'must be',
  'should be',
  // Corporate LLM gateways phrase the complaint as an availability /
  // validity verdict on the response_format *type* rather than a
  // value complaint: "This response_format type is unavailable now"
  // (internal Venus-style proxy), "... is invalid for this model".
  // Both previously fell through every verb, so the demotion chain
  // never engaged and the 400 surfaced to the user. Deliberately
  // narrow phrases: bare 'invalid' would also match the #658
  // strict-dialect body ("Invalid schema for response_format ...")
  // and value complaints about unrelated fields, widening the
  // false-positive surface for the permanent mode cache.
  'unavailable',
  'is invalid',
] as const;

/**
 * Two-marker field-error classifier shared by OutputModeProber and
 * ReasoningStripProber.
 *
 * Matches an HTTP 400 body when it contains BOTH:
 *   1. A REJECTION_VERB substring (case-insensitive)
 *   2. A FIELD_MARKERS substring (caller-supplied, per-prober)
 *
 * BOTH conditions must hold (AND) — bare "json" or "thinking" tokens
 * without a rejection verb would cause false-positive matches on
 * model names (`kimi-k2-thinking`, `*-agentic-fable5`) and unrelated
 * fields. False positives permanently downgrade a baseURL via the
 * mode cache, so the classifier is deliberately conservative.
 *
 * IMPORTANT — the input MUST be the raw response body (e.g.
 * `err.responseBody` from an AI SDK `APICallError`), NOT
 * `err.message`. The AI SDK's APICallError.message is a fixed
 * template ("Provider returned error") and does NOT contain the
 * provider's actual error text. See the v1.26.3 PATCH responseBody-
 * vs-message post-mortem (commit `5f4983b`).
 */
export function classifyFieldError(body: string, fieldMarkers: readonly string[]): boolean {
  const lower = body.toLowerCase();
  const hasVerb = REJECTION_VERBS.some((v) => lower.includes(v));
  const hasField = fieldMarkers.some((f) => lower.includes(f));
  return hasVerb && hasField;
}