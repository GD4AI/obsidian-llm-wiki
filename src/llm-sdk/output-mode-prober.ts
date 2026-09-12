// output-mode-prober.ts
//
// v1.26.3 PATCH Phase A2: replaces json-object-strip-probe.ts with a
// 3-tier output-mode state machine. Per-baseURL cache stores the
// strongest mode that the backend accepts (default = 'json_schema').
//
// The 3 tiers, strongest → weakest:
//   - 'json_schema'  — `response_format: {type:'json_schema', json_schema:{...}}` on the wire (Output.object)
//   - 'json_object'  — `response_format: {type:'json_object'}` on the wire (Output.json)
//   - 'text_prompt'  — no `response_format` on the wire; relies on JSON-shape enforcement prompt prefix
//
// Demotion flow on a 400 with structured-output-rejection:
//
//   Tier 0 (json_schema) + 400 with json_schema-rejection  →  Tier 1 (json_object)
//   Tier 1 (json_object)  + 400 with json_object-rejection  →  Tier 2 (text_prompt)
//   Tier 2 (text_prompt)  + 400  →  fall through (no further demotion)
//
// Cache commit policy (mirrors the existing JsonObjectStripProber
// 'markStrip AFTER retry success' pattern):
//
//   The mode is written to cache AFTER the demoted retry succeeds.
//   A transient retry failure (5xx, network blip) must not permanently
//   downgrade the baseURL. The catch-block does:
//
//     if (classifier-matched && retry-succeeded) { prober.markMode(...) }
//
// The classifier for Tier 0 demotion (isJsonSchemaFieldError) is new in
// this PR. The classifier for Tier 1 demotion (isJsonObjectFieldError)
// is the v1.26.2 json-object-strip-probe classifier, kept verbatim so
// the v1.26.2 regression guard test (output-mode-prober.test.ts case
// 'Classifier input contract: responseBody vs message') still pins the
// contract.
//
// Why two classifiers instead of one with a tier field:
//   The two error shapes are distinct — "json_schema not allowed" and
//   "json_object not allowed" can come from the same backend in
//   principle (e.g. a strict-mode proxy that wants the model to emit
//   text) but in practice they don't. Keeping the classifiers
//   independent lets each be tuned against its real-world error bodies
//   without leaking false-positive matches between tiers.
//
// Why per-model (not per-baseURL):
//   The v1.26.3 PATCH Phase A2 design cached per-baseURL ("Same gateway →
//   same wire format → same rejection behaviour") — correct for the
//   400-driven demotion (the BACKEND rejects a wire format; every model
//   on the gateway sees the same 400). But Issue #443 follow-up E2E
//   (2026-08-11) proved the placeholder-driven demotion is a MODEL-level
//   signal: on ONE LM Studio gateway, Qwen3.5 emits `{"": ""}` under
//   grammar constraint while gemma-4-12b emits full JSON. A per-baseURL
//   cache would demote gemma too. Per-model key space makes the
//   placeholder demotion safe; 400-driven demotion merely re-probes a
//   sibling model once (harmless, not incorrect).

import { classifyFieldError } from './shared-rejection-verbs';

/**
 * The three output-mode tiers, ordered strongest → weakest.
 * The demotion order is documented by the numeric comments below: a 400
 * with Tier N's rejection demotes to Tier N+1. The order is encoded in
 * the literal union (kept in sync with the prober's demotion chain).
 */
// Issue #658: `json_schema_strict` sits between `json_schema` and
// `json_object`. It is the same wire shape with the schema rewritten into the
// strict structured-output dialect (`strict-schema.ts`); a backend reaches it
// only by rejecting the plain schema with a strict-mode complaint, so
// backends that accept today's body never see it. Task policies can pin it
// (`extract=strict:off`).
export type OutputMode = 'json_schema' | 'json_schema_strict' | 'json_object' | 'text_prompt';

/**
 * Field markers for the Tier 1 demotion classifier (json_object /
 * response_format rejection). Carried verbatim from
 * json-object-strip-probe.ts to preserve the v1.26.2 regression-guard
 * contract.
 */
const JSON_OBJECT_FIELD_MARKERS = [
  'json_object',
  'json-object',
  'response_format',
  'response-format',
] as const;

/**
 * Field markers for the Tier 0 demotion classifier (json_schema
 * rejection). The kebab-case variant (`json-schema`) is included
 * alongside the canonical snake_case to match the wire-level
 * representations some backends use. The compound `response_format.json_schema`
 * is the canonical form on the wire; the classifier matches either the
 * compound or the bare `json_schema` token.
 */
const JSON_SCHEMA_FIELD_MARKERS = [
  'json_schema',
  'json-schema',
  'response_format.json_schema',
  'response-format.json-schema',
] as const;

/**
 * Issue #658: phrases a strict structured-output validator emits when the
 * schema itself is accepted but its dialect is not — `required` missing a
 * property, `additionalProperties` not `false`. Verbatim from the endpoint in
 * #658: `Invalid schema for response_format 'response': In context=(),
 * 'required' is required to be supplied and to be an array including every
 * key in properties. Missing 'action'.` No rejection verb from
 * `REJECTION_VERBS` appears in it, so this classifier matches on the phrase
 * alone; the phrases are specific enough not to collide with a field
 * rejection (`json_schema` unsupported → Tier 1) or an unrelated 400.
 */
const STRICT_SCHEMA_MARKERS = [
  'required to be supplied',
  "'required' is required",
  'must be required',
  'additionalproperties',
  'invalid schema for response_format',
] as const;

export class OutputModeProber {
  private readonly cache = new Map<string, OutputMode>();

  /** Composite key: baseURL + model so sibling models share no state. */
  private key(baseUrl: string, model: string): string {
    return `${baseUrl}::${model}`;
  }

  /**
   * Read the strongest mode the backend accepts for a (baseURL, model)
   * pair. Default = 'json_schema' (assume strongest, demote on first
   * placeholder / 400).
   */
  getMode(baseUrl: string, model: string): OutputMode {
    return this.cache.get(this.key(baseUrl, model)) ?? 'json_schema';
  }

  /**
   * Write the demoted mode for a (baseURL, model) pair. Called AFTER a
   * demoted retry succeeds — a transient retry failure must not
   * permanently downgrade a model.
   */
  markMode(baseUrl: string, model: string, mode: OutputMode): void {
    this.cache.set(this.key(baseUrl, model), mode);
  }

  /**
   * Two-marker classifier for Tier 0 demotion (json_schema not accepted).
   * BOTH conditions must hold (AND):
   *   1. The body contains a REJECTION_VERB substring.
   *   2. The body contains a JSON_SCHEMA_FIELD_MARKER substring.
   *
   * Bare 'json' is intentionally NOT a marker — it would collide with
   * content-type headers, model names, and unrelated fields. Use the
   * full 'json_schema' or 'response_format.json_schema' to disambiguate.
   *
   * IMPORTANT — the input MUST be the raw response body (e.g.
   * `err.responseBody` from an AI SDK `APICallError`), NOT
   * `err.message`. The AI SDK's APICallError.message field is a
   * fixed template and does NOT include the provider body.
   */
  static isJsonSchemaFieldError(body: string): boolean {
    return classifyFieldError(body, JSON_SCHEMA_FIELD_MARKERS);
  }

  /**
   * Two-marker classifier for Tier 1 demotion (json_object /
   * response_format not accepted). Verbatim from json-object-strip-probe.ts
   * so the v1.26.2 regression guard stays in effect.
   *
   * IMPORTANT — input MUST be the response body, not the APICallError
   * message (same contract as isJsonSchemaFieldError above).
   */
  /** Issue #658: the plain schema was accepted as a field but rejected as a dialect. */
  static isStrictSchemaRejection(body: string): boolean {
    const lower = body.toLowerCase();
    return STRICT_SCHEMA_MARKERS.some((m) => lower.includes(m));
  }

  static isJsonObjectFieldError(body: string): boolean {
    return classifyFieldError(body, JSON_OBJECT_FIELD_MARKERS);
  }
}