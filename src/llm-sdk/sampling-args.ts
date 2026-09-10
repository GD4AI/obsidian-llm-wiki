// Sampling-args helper — consolidates the three conditional spread blocks
// (`temperature`, `top_p`, `seed`) repeated across the OpenAI, Anthropic and
// OpenAI-compatible SDK clients (the Codex client uses a different shape
// because `response_format` routes to AI-SDK's `Output.json()`, so it stays
// out of scope here).
//
// Why a helper instead of inlining the conditional spreads:
//   * The block is duplicated 13× across 3 SDK clients. A typo in any one of
//     them (e.g. forgetting `seed !== undefined` and emitting `{ seed: null }`)
//     silently changes wire behaviour.
//   * Anthropic deliberately omits `seed` (no Messages API parameter). The
//     `withSeed: false` flag scopes seed to the clients that accept it
//     without needing the caller to know about each provider's parameter
//     surface.
//   * All callers spread the return value, so the helper is non-invasive
//     and the wire shape is byte-identical to the pre-helper form.
//
// Usage:
//   const { temperature, top_p, seed } = params;
//   const result = await generateText({
//     ...,
//     ...buildSamplingArgs({ temperature, top_p, seed }),  // with seed
//     // OR
//     ...buildSamplingArgs({ temperature, top_p }),        // without seed
//   });

export interface SamplingArgs {
  temperature?: number;
  top_p?: number;
  seed?: number;
  /** #646: rides along here because every real model call spreads this helper. */
  abortSignal?: AbortSignal;
}

/**
 * Returns a partial object containing only the sampling fields that are
 * present in the input. Spreads into AI-SDK's generateText/streamText
 * options; absent fields stay absent (matching the original inline form).
 *
 * @param withSeed — when false, the `seed` field is dropped even if present.
 *   Anthropic's Messages API has no `seed` parameter; passing it would
 *   confuse the SDK's zod schema strip. Default: true.
 */
export function buildSamplingArgs(
  args: SamplingArgs,
  options: { withSeed?: boolean } = {}
): {
  temperature?: number;
  topP?: number;
  seed?: number;
  abortSignal?: AbortSignal;
} {
  const withSeed = options.withSeed ?? true;
  const out: { temperature?: number; topP?: number; seed?: number; abortSignal?: AbortSignal } = {};
  if (args.temperature !== undefined) out.temperature = args.temperature;
  if (args.top_p !== undefined) out.topP = args.top_p;
  if (withSeed && args.seed !== undefined) out.seed = args.seed;
  if (args.abortSignal !== undefined) out.abortSignal = args.abortSignal;
  return out;
}