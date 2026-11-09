/**
 * Output languages and the closed frontmatter vocabularies.
 *
 * Values, not types. They travel with the types that key off them, the way
 * `DEFAULT_SETTINGS` travels with `LLMWikiSettings`. Split out of `types.ts`
 * by #929.
 */
// Wiki output language options

export const WIKI_LANGUAGES: Record<string, string> = {
  'en': 'English',
  'zh': '中文',
  'zh-Hant': '繁體中文',  // v1.22.0: Traditional Chinese
  'ja': '日本語',
  'ko': '한국어',
  'de': 'Deutsch',
  'fr': 'Français',
  'es': 'Español',
  'pt': 'Português',
  'it': 'Italiano',
  'ru': 'Русский',        // v1.26.0: Russian
};

// Valid frontmatter tag values per schema classification rules.
// `type: entity` pages use entity subtypes as tags.
// `type: concept` pages use concept subtypes as tags.
export const VALID_ENTITY_TAGS = ['person', 'organization', 'project', 'product', 'event', 'place', 'other'];
export const VALID_CONCEPT_TAGS = ['theory', 'method', 'field', 'phenomenon', 'standard', 'term', 'other'];
export const DEFAULT_ENTITY_TAG = 'other';
export const DEFAULT_CONCEPT_TAG = 'term';

// Issue #85 v7: source pages use a separate, static "form" vocabulary
// (describing the type of the source artifact — paper, document, etc.)
// rather than a topic. NOT user-configurable per Issue #85 design
// decision: source pages have a closed taxonomy that the user picks
// from, and the lint audit + retag runner validates against this list.
export const VALID_SOURCE_TAGS = [
  'paper', 'article', 'book', 'transcript', 'clippings',
  'notes', 'other',
] as const;
export const DEFAULT_SOURCE_TAG = 'other';
