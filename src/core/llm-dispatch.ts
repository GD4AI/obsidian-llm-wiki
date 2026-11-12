// core/llm-dispatch.ts
//
// v1.26.3 PATCH expanded-scope follow-up: centralize the typed-output /
// legacy dispatch guard that was duplicated at every migrated call site.
//
// Before this helper, each caller had:
//   const response = client.createMessageWithOutput
//     ? (await client.createMessageWithOutput(args)).text
//     : await client.createMessage(args);
//
// ...with subtle variations on the `.text` fallback path (some callers did
// `result.text`, others wrapped `createMessage` directly). This helper
// collapses the dispatch into one place so future LLMClient shape changes
// (e.g. a streaming-typed variant) only need to update one function.
//
// The legacy `createMessage` path returns `Promise<string>` directly — same
// shape we return. The typed path returns `{text, output?, outputMode,
// finishReason, usage?}`; we extract `.text` so callers can continue to
// treat the result as a string and route it through `parseJsonResponse`.
// Callers that want the typed `output` should call `client.createMessageWithOutput`
// directly and inspect `result.output` themselves.

import type { LLMClient } from '../types';

/**
 * Variant of `Parameters<NonNullable<LLMClient['createMessageWithOutput']>>[0]`
 * that does not require the optional method. We accept the same argument
 * shape the wrapped client expects so the typed and legacy calls match.
 */
export type LlmCallArgs = Parameters<
  NonNullable<LLMClient['createMessageWithOutput']>
>[0];

/** The parameter object `LLMClient.createMessage` takes, named so it can be reused. */
export type LlmMessageArgs = Parameters<LLMClient['createMessage']>[0];

/**
 * Minimal client shape `callLlm` requires. Some callers pass a narrowed
 * context type (e.g. `PathResolutionContext.getClient()` returns a
 * `{createMessage, createMessageWithOutput?}`-shaped object, not the full
 * `LLMClient`).
 *
 * The parameters are the real ones, not `unknown[]`. Widening them used to work
 * because method parameters were bivariant; #816 turned on `strictFunctionTypes`,
 * and a function accepting a specific object can no longer stand in for one
 * accepting anything. Reusing `LLMClient`'s own parameter type is both assignable
 * and more honest about what the dispatch passes on.
 */
export interface LlmDispatchClient {
  createMessage: (params: LlmMessageArgs) => Promise<string>;
  createMessageWithOutput?: (params: LlmCallArgs) => Promise<{ text: string }>;
}

/**
 * Dispatch an LLM call. Prefers the typed `createMessageWithOutput` method
 * when the client implements it; falls back to plain `createMessage` on
 * legacy clients (Anthropic / OpenAI / Codex / mock clients without the
 * typed method). Returns the wire text — callers that need the typed
 * `output` field should call `createMessageWithOutput` directly and
 * inspect `result.output`.
 */
export async function callLlm(
  client: LlmDispatchClient,
  args: LlmCallArgs
): Promise<string> {
  if (client.createMessageWithOutput) {
    const result = await client.createMessageWithOutput(args);
    return result.text;
  }
  return client.createMessage(args);
}