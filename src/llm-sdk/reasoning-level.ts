// reasoning-level.ts — our four levels, translated into the AI SDK's own.
//
// Issue #904. The plugin used to hand-roll every provider's reasoning field:
// `providerOptions.anthropic.thinking = { type: 'disabled' }`,
// `providerOptions.openai.reasoningEffort = 'none'`, a per-provider key swap
// on the openai-compatible path, and a bespoke 400-strip cache on top.
//
// The installed SDK already does that job, and it does more than a name map:
//
//   ai@7.0.142        CallSettings.reasoning, forwarded to doGenerate/doStream
//   @ai-sdk/openai     validates against modelCapabilities.supportedReasoningEfforts
//                      and DROPS an unsupported level with a warning
//   @ai-sdk/anthropic  maps through an explicit table and, on a model that
//                      rejects `thinking: disabled` (Claude Opus 5.5), downgrades
//                      `'none'` to `{ effort: 'low' }` with a compatibility
//                      warning instead of returning 400
//
// So the plugin's job shrinks to: produce one of four levels, plus the
// existing on/off toggle. Everything below is that translation and nothing
// else — no provider names, no per-model tables, nothing to keep current.
//
// `'provider-default'` is the SDK's way of saying "send no field at all",
// which is what the plugin did before any of this existed.

/**
 * The value handed to `generateText({ reasoning })`.
 *
 * `undefined` means the caller said nothing at all, which is distinct from
 * asking for the provider default: the clients use `undefined` to keep a
 * legacy `providerOptions` path that a test may still pin.
 */
export type SdkReasoning =
  | 'provider-default'
  | 'none'
  | 'low'
  | 'medium'
  | 'high';

export interface ReasoningInput {
  /** The on/off toggle. `false` asks the provider not to think. */
  enableThinking?: boolean;
  /** A named level. Only the three the UI offers; the SDK has more. */
  reasoningEffort?: 'low' | 'medium' | 'high';
  /** Global level, already resolved by the wrapper. */
  thinkingEffort?: 'default' | 'low' | 'medium' | 'high';
}

/**
 * Resolve one SDK reasoning level.
 *
 * Order: an explicit level beats the toggle, because a level IS a request for
 * thinking and can only arrive next to `enableThinking: true`. The toggle
 * beats the global default, because off is the stronger statement.
 *
 * Returns `undefined` when nothing was asked — the caller then emits no
 * reasoning field, which is byte-identical to the pre-#904 request.
 */
export function resolveSdkReasoning(input: ReasoningInput): SdkReasoning | undefined {
  const level = input.reasoningEffort ?? namedLevel(input.thinkingEffort);
  if (level) return level;
  if (input.enableThinking === false) return 'none';
  if (input.enableThinking === true) return 'provider-default';
  return undefined;
}

/** Narrow the global setting to the three levels the SDK is asked for. */
function namedLevel(
  value: 'default' | 'low' | 'medium' | 'high' | undefined,
): 'low' | 'medium' | 'high' | undefined {
  return value === 'low' || value === 'medium' || value === 'high' ? value : undefined;
}
