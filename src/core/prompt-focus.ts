// v1.27.3: prompt customization — WeKnora-style "Wiki extraction focus" and
// "Wiki content requirements".
//
// Two free-text fields, read from settings on every prompt build. Empty means
// the prompt is byte-identical to what it was before this feature, which is
// what keeps the prefix cache intact for every vault that never configures it.
//
// Both fields are PROMPT HINTS injected as extra sections; they never
// replace system-owned contracts (JSON protocol, classification rules,
// tag vocabulary, citation/merge/anti-hallucination rules).
//
// The per-topic layer (a `wikiTopics` entry overriding the global value) is not
// here. It shipped ahead of the picker that would write it, so it could never
// resolve: nothing in the settings UI creates a topic, and `activeTopicId` had
// no reader. It is recorded as an issue rather than carried as a branch that
// cannot run.

import { LLMWikiSettings } from '../types';

/** Cap both fields: WeKnora uses 4000 chars; keep the same ceiling so a
 *  runaway paste cannot bloat every batch prompt. */
export const PROMPT_FOCUS_MAX_CHARS = 4000;

export function clampPromptFocusText(raw: string | undefined): string {
  const text = (raw ?? '').trim();
  if (text.length === 0) return '';
  return text.length > PROMPT_FOCUS_MAX_CHARS
    ? text.slice(0, PROMPT_FOCUS_MAX_CHARS)
    : text;
}

/**
 * Effective extraction focus: the global setting, or '' when unset. Empty
 * string = inject nothing (byte-identical prompts).
 */
export function getExtractionFocus(settings: LLMWikiSettings): string {
  return clampPromptFocusText(settings.extractionFocus);
}

/**
 * Effective content requirements: the global setting, or '' when unset.
 */
export function getContentRequirements(settings: LLMWikiSettings): string {
  return clampPromptFocusText(settings.contentRequirements);
}

/**
 * Rendered extraction-focus section appended to the Extraction Scope
 * block of the analyzeSource prompt. Empty input → empty output.
 */
export function buildExtractionFocusSection(focus: string): string {
  const text = clampPromptFocusText(focus);
  if (!text) return '';
  return [
    '**Topic Extraction Focus (user-configured for this wiki):**',
    'Prioritize recognizing the following domain entities and concepts. This narrows what you look for — it does NOT change the JSON protocol, the classification rules, or the allowed tag vocabulary above.',
    '',
    text,
  ].join('\n');
}

/**
 * Rendered content-requirements section appended to entity/concept
 * page-generation prompts. Empty input → empty output.
 */
export function buildContentRequirementsSection(requirements: string): string {
  const text = clampPromptFocusText(requirements);
  if (!text) return '';
  return [
    '**Topic Content Requirements (user-configured for this wiki):**',
    'Follow these expressive requirements when writing the page. They control emphasis and structure only — the citation format, wiki-link rules, merge strategy and objectivity requirements above remain binding.',
    '',
    text,
  ].join('\n');
}
