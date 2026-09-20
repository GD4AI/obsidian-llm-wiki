// Issue #758: which ids a model catalogue's response may contribute, and what
// happens to a model the user has already chosen.
//
// Both answers used to live inside the settings tab's fetch callback, which made
// them unreachable from a test — and the filter had already been wrong in a way a
// test would have caught. They are pure here so the rule is checkable rather
// than only observable by fetching from a real endpoint.

/**
 * Providers whose catalogues legitimately return **namespaced** ids.
 *
 * `/` in a model id is a namespace separator, not a defect: LM Studio's
 * Hub-managed downloads are keyed `publisher/model` (`qwen/qwen3.6-35b-a3b`,
 * `openai/gpt-oss-120b`), and other OpenAI-compatible gateways do the same. The
 * filter rejected `/` for every provider except ollama, which meant those models
 * could never appear in "Fetch Available Models" — the setting was unreachable
 * for them, not merely awkward (#758).
 *
 * Listed rather than applied to all providers on purpose. Widening the filter is
 * the smaller change, and no other provider's list changes shape because of it;
 * a later provider that needs it is one entry here, with its reason.
 */
const NAMESPACED_ID_PROVIDERS = new Set(['lmstudio']);

/**
 * Providers that may return **any** string id.
 *
 * `openrouter` uses `:` for catalogue variants (`liquid/lfm-2.5-2.6b:free`), so no
 * sign implies an unusable id there.
 */
const UNFILTERED_PROVIDERS = new Set(['openrouter']);

/**
 * Whether a fetched id can be offered as a model choice.
 *
 * `unknown` rather than `string` because the input is a parsed HTTP response: an
 * endpoint that returns objects instead of strings should contribute nothing
 * rather than an `[object Object]` entry.
 *
 * The two separators mean different things and are not interchangeable. `:` is a
 * tag or catalogue variant — ollama's own syntax, and a reason to drop an id
 * anywhere else. `/` is a namespace, which is a valid id shape; it is rejected
 * except where a catalogue is known to use it, because ollama's `/api/tags` lists
 * both a bare name and its `library/`-qualified twin and offering both is noise.
 * That ollama rule is kept as it was: this fixes the provider that was reported,
 * and widening a filter beyond the report is its own change to justify.
 */
export function isUsableModelId(provider: string, id: unknown): boolean {
  if (typeof id !== 'string') return false;
  if (UNFILTERED_PROVIDERS.has(provider)) return true;
  if (id.includes(':')) return provider === 'ollama';
  if (id.includes('/')) return NAMESPACED_ID_PROVIDERS.has(provider);
  return true;
}

/** The catalogue an endpoint returned, reduced to the ids worth offering. */
export function filterModelIds(provider: string, ids: readonly unknown[]): string[] {
  return ids.filter(id => isUsableModelId(provider, id)) as string[];
}

/** What a successful fetch should do to the two model fields. */
export interface ModelSelectionPatch {
  /** Set when the model field should be rewritten. */
  model?: string;
  /** Set when the custom-model flag should change. `false` means the picked id
   *  came from the catalogue; `true` means the field is the user's own. */
  useCustomModel?: boolean;
}

/**
 * Reconcile a successful fetch against what the user has already chosen.
 *
 * Three cases, and the third is the bug (#758):
 *
 * - **Nothing chosen yet** — seed from the catalogue. Without this the dropdown
 *   starts empty after a fetch, which is the one thing a fetch is for.
 * - **The chosen id is in the catalogue** — it came from a list, so clear the
 *   custom flag. This is the case the old code implemented.
 * - **The chosen id is *not* in the catalogue** — leave both fields alone.
 *   The old code rewrote the model to `availableModels[0]` and set
 *   `useCustomModel = false`, which silently destroyed a hand-typed id. That id
 *   may be valid at request time and simply absent from this endpoint's listing
 *   — a namespaced id the filter dropped, a model loaded after the last fetch, a
 *   gateway that lists a subset — and the user has no way to know it was taken.
 *   Overwriting input the user has demonstrated to work is worse than leaving a
 *   field that might need a second look.
 */
export function reconcileModelSelection(
  current: string | undefined,
  fetched: readonly string[]
): ModelSelectionPatch {
  if (fetched.length === 0) return {};
  if (!current) return { model: fetched[0], useCustomModel: false };
  if (fetched.includes(current)) return { useCustomModel: false };
  return {};
}
