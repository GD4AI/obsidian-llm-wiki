// Output-args helper — translates the public `response_format` shape
// (`{ type: 'json_object' }` or `{ type: 'json_object', schema? }`,
// Issue #443) into the AI SDK's `Output` mechanism, so the SDK client
// does not have to know about `Output.json` / `Output.object` /
// `jsonSchema` directly.
//
// Why a helper instead of inlining the conditional:
//
//   * The same translation runs at every `createMessage` call site —
//     the compat SDK client has 4 such call sites (initial, URL
//     fallback, reasoning-strip retry, token-key retry, and the new
//     json-object-strip retry in v1.26.3 PATCH follow-up). Inlining the
//     `Output` call at every site risks a typo that silently drops the
//     wire field (this is exactly the v1.26.1 bug #443 is closing).
//     Centralising the translation here means a future retry path can
//     only forget `output` if it forgets to spread `outputArgs` — much
//     harder to miss than 4 separate `Output.json()` lines.
//
//   * AI SDK v6 contract: `generateText` reads `output.responseFormat`
//     (a `Promise`) and passes it to `stepModel.doGenerate` /
//     `doStream` (see `ai@6.0.230/dist/index.mjs:4686` and `:7709`).
//     `Output.json()` produces `{type:'json'}` (no schema) and the
//     compat SDK provider encodes that as
//     `response_format: { type: 'json_object' }` on the wire (see
//     `@ai-sdk/openai-compatible@2.0.62/dist/index.mjs:528`).
//     `Output.object({schema,name})` produces
//     `{type:'json', schema, name}` and the SDK encodes it as
//     `response_format: { type: 'json_schema', json_schema: {...} }`
//     when the provider's `supportsStructuredOutputs` flag is true
//     (line 520-527 of the same dist). LM Studio, Ollama (with the
//     right server build), and `custom` self-hosted servers accept
//     this form; the cloud cohort (openrouter / deepseek / kimi / glm
//     / gemini / minimax) accepts `json_object` and does NOT receive
//     `json_schema`.
//
//   * **No-schema case emits `Output.json()` for every openai-compat
//     provider — a single `Output.json()` call, no per-provider
//     branching.** The AI SDK encodes it as
//     `{type:'json_object'}` on the wire. 6 cloud providers accept
//     this (server-side type hint that reduces parse-failure class of
//     issues #443 is closing). The local server cohort (LM Studio /
//     Ollama / `custom`) may 400 on `json_object` (LM Studio is the
//     measured case, DocTpoint Issue #443 comment 1, 2026-08-09:
//     29 ms, `'response_format.type' must be 'json_schema' or 'text'`)
//     — handled by a runtime 400-strip fallback at the SDK client level
//     (`json-object-strip-probe.ts`, with a per-baseURL cache so the
//     cost is exactly one 400 per unique baseURL). The helper does not
//     know which cohort it's in — that's the SDK client's job, and the
//     client does not hardcode either: it just catches 400s whose
//     error message names `json_object` or `response_format`, retries
//     without `output`, and caches the strip decision.
//
//   * **Both `Output.json()` and `Output.object({schema})` throw
//     `NoObjectGeneratedError` on malformed JSON** (corrects an
//     earlier v1 description that was wrong for `ai@6.0.230`). Both
//     call `outputSpecification.parseCompleteOutput` after the model
//     finishes (`ai@6.0.230/dist/index.mjs:3899` and the Output.json
//     factory). On a JSON-shape mismatch (unclosed array, truncation,
//     malformed structure), the SDK throws and the catch block in
//     `OpenAICompatSdkClient.createMessage` recovers by returning
//     `err.text` so caller-side `parseJsonResponse` + greedy regex +
//     LLM repair can run (the Path 2 fix shipped in commit `9789cbf`).
//     This applies equally to the no-schema (Tier 1) and schema
//     (Tier 0) arms — both call paths can emit malformed JSON on the
//     cloud cohort (deepseek / openrouter / glm / kimi / minimax /
//     gemini).
//
//   * `Output.object({ schema })` requires a `Schema`, not a raw
//     JSONSchema object. The wrapper `jsonSchema()` (re-exported by
//     `ai` from `@ai-sdk/provider-utils`) adapts a raw JSONSchema
//     object to that interface — that is the only place in the
//     codebase that needs to know about the conversion.
//
// Usage:
//   const { generateText } = await import('ai');
//   const result = await generateText({
//     model: languageModel,
//     ...,
//     ...buildOutputArgs(response_format),
//   });

import { jsonSchema, Output, zodSchema } from 'ai';
import type { Schema } from 'ai';
import type { z } from 'zod';
import type { OutputMode } from './output-mode-prober';
import { strictSchemaFor } from './strict-schema';

/**
 * v1.26.3 PATCH simplify round: Output.json() is a no-arg factory that
 * returns a stable object. AI SDK v6's Output.json() allocates a fresh
 * Promise-wrapping object on every call (verified by inspecting
 * `node_modules/ai/dist/index.mjs`). For our hot path (every LLM call
 * that doesn't pass a schema runs Output.json()), that's one
 * allocation per call. Hoist to a module-level frozen constant so the
 * same object is reused across calls.
 *
 * Why frozen: Output.json()'s contract doesn't expose mutation
 * entry points, but a future AI SDK upgrade could. Freezing documents
 * the intent and prevents accidental sharing-state bugs.
 */
const OUTPUT_JSON_FROZEN = Object.freeze(Output.json()) as ReturnType<typeof Output.json>;

/**
 * v1.26.3 PATCH Phase B: discriminates a Zod schema from a raw JSON
 * Schema object. `'safeParse' in schema` alone cannot narrow a union
 * with an index-signature side (`Record<string, unknown>` permits any
 * key), so an explicit type guard is needed for the `Output.object`
 * adapter choice. Zod schemas expose `safeParse`/`parse` as functions;
 * a JSON Schema object never does.
 */
function isZodSchema(schema: Record<string, unknown> | z.ZodType): schema is z.ZodType {
  return typeof schema === 'object'
    && schema !== null
    && 'safeParse' in schema
    && typeof (schema as unknown as { safeParse?: unknown }).safeParse === 'function';
}

export interface ResponseFormatWithSchema {
  type: 'json_object';
  // v1.26.3 PATCH Phase B: the schema can be either a raw JSON Schema
  // object (existing callers, passed through `jsonSchema()`) or a Zod
  // schema (Phase B migrations, passed through `zodSchema()`). Zod is
  // the single source of truth for Phase B callers — the same Zod
  // schema validates the Tier 1/2 fallback `parseJsonResponse` result
  // AND drives the Tier 0 wire shape via the SDK's schema adapter.
  schema?: Record<string, unknown> | z.ZodType;
}

/**
 * Returns `{ output: <Output> }` to spread into `generateText` /
 * `streamText` options, or `{}` when no `response_format` is supplied.
 *
 * v1.26.3 PATCH Phase A3: the helper now takes a 3rd parameter
 * `mode: OutputMode` (one of `'json_schema'` / `'json_object'` /
 * `'text_prompt'`). It dispatches the wire-shape choice so the SDK
 * encodes the strongest mode the backend accepts. The per-baseURL
 * mode cache lives in `OutputModeProber` (src/llm-sdk/output-mode-prober.ts);
 * the helper itself is stateless w.r.t. the cache — the caller passes
 * the current mode in. This keeps the helper pure and easy to test.
 *
 * Dispatch table (response_format × mode):
 *
 * | response_format | mode         | output emitted                              |
 * |-----------------|--------------|---------------------------------------------|
 * | undefined       | any          | `{}` (caller has no JSON intent)            |
 * | {schema}        | json_schema  | `{output: Output.object({schema, name})}`   |
 * | {schema}        | json_schema_strict | same, schema rewritten into the strict |
 * |                 |              | dialect (Issue #658, `strict-schema.ts`)    |
 * | {no schema}     | json_schema  | `{output: Output.json()}` (fallback — no    |
 * |                 |              | schema to constrain; SDK encodes json_object)|
 * | any             | json_object  | `{output: Output.json()}` (schema silently  |
 * |                 |              | dropped — AI SDK cannot attach a schema to  |
 * |                 |              | the json_object wire shape)                 |
 * | any             | text_prompt  | `{}` (we drop response_format entirely;     |
 * |                 |              | caller adds the JSON-shape enforcement      |
 * |                 |              | system prompt prefix at retry time)         |
 *
 * `name` defaults to `'response'`. The AI SDK requires it on
 * `Output.object`; the default matches the convention used by
 * every call site in the codebase.
 *
 * Mode defaults to `'json_schema'` (the strongest, what most modern
 * backends accept) — this preserves backward-compat for the existing
 * 16 callers that pass `response_format` without a mode argument.
 * They get Tier 0 / Tier 1 by default until they explicitly opt into
 * the lower tiers via the OutputModeProber.
 */
export function buildOutputArgs(
  response_format: ResponseFormatWithSchema | undefined,
  mode: OutputMode = 'json_schema',
  options: { name?: string } = {},
): { output?: ReturnType<typeof Output.json> | ReturnType<typeof Output.object> } {
  if (!response_format) return {};

  const name = options.name ?? 'response';

  // Tier 2 — text_prompt: drop response_format entirely. The retry
  // call site adds JSON_ENFORCEMENT_SYSTEM_PREFIX to the system prompt
  // so the model still emits parseable JSON without wire-level
  // constraint. Any caller-supplied schema is meaningless at this tier
  // (no SDK grammar enforcement) and would confuse the model.
  if (mode === 'text_prompt') return {};

  // Tier 1 — json_object: SDK encodes `{type:'json_object'}` on the
  // wire. The AI SDK cannot attach a schema to this wire shape, so a
  // caller-supplied schema is silently dropped at this tier. If the
  // caller wants schema enforcement, they need mode='json_schema'
  // AND the backend must support it (the prober tracks this).
  if (mode === 'json_object') return { output: OUTPUT_JSON_FROZEN };

  // Tier 0 — json_schema: SDK encodes
  // `{type:'json_schema', json_schema:{name, strict, schema}}` on the
  // wire when the provider's `supportsStructuredOutputs` flag is true.
  // Without a schema from the caller, there's nothing to constrain at
  // Tier 0 — fall back to Output.json() (which the SDK encodes as
  // json_object). This is the same fallback the v1.26.2 helper used.
  if (!('schema' in response_format) || response_format.schema === undefined) {
    return { output: OUTPUT_JSON_FROZEN };
  }
  // v1.26.3 PATCH Phase B: a Zod schema (Phase B callers) is adapted
  // via `zodSchema()`; a raw JSON Schema (legacy callers) via
  // `jsonSchema()`. Both return a `Schema` the AI SDK accepts on
  // `Output.object`. The discriminator is `safeParse` (Zod's method) —
  // a JSON Schema object has no `.safeParse` method.
  const schema = response_format.schema;
  // v1.26.3 PATCH Phase B: a Zod schema (Phase B callers) is adapted
  // via `zodSchema()`; a raw JSON Schema (legacy callers) via
  // `jsonSchema()`. Both return a `Schema` the AI SDK accepts on
  // `Output.object`. `isZodSchema` narrows the union.
  const adapt = (): Schema => (isZodSchema(schema) ? zodSchema(schema) : jsonSchema(schema));
  // Issue #658: at the strict tier the schema is rewritten into the strict
  // structured-output dialect — once per schema object, regardless of which
  // adapter produced it; see `strict-schema.ts` for what changes and why the
  // validator is wrapped alongside. The plain tier sends the adapter's own
  // body, so a backend that accepts it (measured: LM Studio) is unaffected.
  const adapted = mode === 'json_schema_strict' ? strictSchemaFor(schema, adapt) : adapt();
  return { output: Output.object({ schema: adapted, name }) };
}
