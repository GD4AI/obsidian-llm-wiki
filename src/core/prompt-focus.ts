// v1.27.3 prompt customization — the two free-text hints live in the SCHEMA.
//
// **They are not settings.** `## Extraction Focus` and `## Content Rules` are
// sections of `schema/config.md`, and `TASK_SECTIONS` routes them to the tasks
// that need them:
//
//   analyze (extraction)            <- Content Rules, Extraction Focus
//   entity / concept (generation)   <- Content Rules
//   merge                           <- Content Rules
//
// A settings copy of the same text was rejected on 2026-10-30: it would be a
// second store for one instruction, with no precedence rule between the two
// blocks the model receives. `AGENTS.md` §"Schema 三层分离" states the rule —
// layer 1 is "page templates, content rules, naming conventions, merge
// policies" — and the test that applies it is: **a value the engine only
// forwards to the model is domain knowledge, and belongs to the schema; a value
// the engine parses, validates or branches on is a runtime parameter, and
// belongs to Settings.** Tag vocabulary is validated at write time, so it is a
// setting. This text is forwarded verbatim, so it is not.
//
// What survives here is the input guard the Settings editor still needs.
//
// The per-topic layer recorded as issue #896 becomes natural under this shape:
// one schema section per topic, selected by folder, reusing `TASK_SECTIONS`
// rather than a second settings store.

/** Cap one section's text: 4000 chars keeps a runaway paste out of every prompt. */
export const PROMPT_FOCUS_MAX_CHARS = 4000;

export function clampPromptFocusText(raw: string | undefined): string {
  const text = (raw ?? '').trim();
  if (text.length === 0) return '';
  return text.length > PROMPT_FOCUS_MAX_CHARS
    ? text.slice(0, PROMPT_FOCUS_MAX_CHARS)
    : text;
}
