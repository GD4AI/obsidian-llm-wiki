// v1.27.3: topic-scoped prompt customization — WeKnora-style "Wiki
// extraction focus" and "Wiki content requirements".
//
// Resolution mirrors core/tag-vocab.ts: the ACTIVE topic's own field wins
// (matched on settings.wikiFolder, since every ingest/lint/prompt path
// runs on the active topic), then the global setting, then off.
//
// Both fields are PROMPT HINTS injected as extra sections; they never
// replace system-owned contracts (JSON protocol, classification rules,
// tag vocabulary, citation/merge/anti-hallucination rules).

import { LLMWikiSettings } from '../types';

/** Normalize a user-typed folder path into a comparable vault path.
 *  Self-contained (no Obsidian normalizePath dependency) so the module
 *  stays testable without an app handle. */
function normalizeFolder(raw: string): string {
  return raw.trim().replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/');
}

function sameFolder(a: string, b: string): boolean {
  return normalizeFolder(a) === normalizeFolder(b);
}

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

function activeTopic<T>(settings: LLMWikiSettings, pick: (topic: NonNullable<LLMWikiSettings['wikiTopics']>[number]) => T | undefined): T | undefined {
  const folder = (settings.wikiFolder ?? '').trim();
  if (!folder) return undefined;
  const topic = (settings.wikiTopics ?? []).find(t => sameFolder(t.folder, folder));
  if (!topic) return undefined;
  return pick(topic);
}

/**
 * Effective extraction focus for the active topic: topic override →
 * global → ''. Empty string = inject nothing (byte-identical prompts).
 */
export function getExtractionFocus(settings: LLMWikiSettings): string {
  const topicValue = activeTopic(settings, t => t.extractionFocus);
  if (topicValue !== undefined) return clampPromptFocusText(topicValue);
  return clampPromptFocusText(settings.extractionFocus);
}

/**
 * Effective content requirements for the active topic: topic override →
 * global → ''. Empty string = inject nothing.
 */
export function getContentRequirements(settings: LLMWikiSettings): string {
  const topicValue = activeTopic(settings, t => t.contentRequirements);
  if (topicValue !== undefined) return clampPromptFocusText(topicValue);
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
