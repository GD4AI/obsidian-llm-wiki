// Orphan Matcher — Pure functions for orphan page linking
// Extracted from lint-fixes.ts::linkOrphanPage()
// Zero side effects, fully testable

export interface OrphanContext {
  orphanContent: string;
  wikiIndex: string;
  wikiFolder: string;
}

export interface OrphanLinkSuggestion {
  pagePath: string;
  linkText: string;
  linkTarget: string;
}

/**
 * Build prompt for linking orphan pages to related content.
 *
 * @param template - The prompt template with {{placeholders}}
 * @param context - Context information for the orphan page
 * @returns Constructed prompt ready for LLM
 */
export function buildOrphanLinkPrompt(
  template: string,
  context: OrphanContext
): string {
  // Truncate content and index to prevent token overflow
  const truncatedContent = context.orphanContent.substring(0, 2000);
  const truncatedIndex = context.wikiIndex.substring(0, 3000);

  return template
    .replace(/\{\{wikiFolder\}\}/g, context.wikiFolder)
    .replace(/\{\{orphan_content\}\}/g, truncatedContent)
    .replace(/\{\{wiki_index\}\}/g, truncatedIndex);
}

/**
 * Should the append be skipped?
 *
 * Two reasons to skip, and both return true: the page already carries the link,
 * or the target resolves to no page at all.
 *
 * Issue #824: the second reason is what was missing. The caller appended
 * `- {linkText} {linkTarget}` as-is, and the target the model supplies is a
 * display-derived guess — measured on a real vault as `[[sources/paste-rules]]`
 * where the page is `sources/paste-rules_f7bbee`. The orphan therefore gained no
 * inbound link and was re-reported on every lint, while each run added fresh dead
 * links elsewhere.
 *
 * @param relatedContent - Content of the related page
 * @param linkTarget - The link target to validate
 * @param resolveTargetExists - Optional. Returns true when the target names a
 *   page that exists. Omit it and the check is the substring test alone, which is
 *   the behaviour every pre-#824 caller keeps.
 * @returns True when the append must be skipped
 */
export function validateOrphanLinkTarget(
  relatedContent: string,
  linkTarget: string,
  resolveTargetExists?: (linkTarget: string) => boolean
): boolean {
  if (resolveTargetExists && !resolveTargetExists(linkTarget)) return true;
  return relatedContent.includes(linkTarget);
}

/**
 * Build the content update for linking an orphan page.
 *
 * @param relatedContent - Current content of related page
 * @param suggestion - Link suggestion from LLM
 * @param sectionHeader - Header for related pages section
 * @returns Updated content with orphan link added
 */
export function buildOrphanLinkUpdate(
  relatedContent: string,
  suggestion: OrphanLinkSuggestion,
  sectionHeader: string
): string {
  const header = `## ${sectionHeader}`;
  const section = relatedContent.includes(header) ? '' : `\n\n${header}`;
  // Issue #824: `link_text` is a sentence the model writes, and it sometimes
  // already ends with the link. Appending `link_target` unconditionally then
  // produced `[[X|Y]]. [[X|Y]]` on one line — measured on a real vault.
  const entry = suggestion.linkText.includes(suggestion.linkTarget)
    ? suggestion.linkText
    : `${suggestion.linkText} ${suggestion.linkTarget}`;
  return `${relatedContent}${section}\n- ${entry}`;
}

/**
 * Normalize page path to full path.
 *
 * @param pagePath - Page path (may be relative or full)
 * @param wikiFolder - Wiki root folder
 * @returns Full path
 */
export function normalizeOrphanPagePath(
  pagePath: string,
  wikiFolder: string
): string {
  return pagePath.startsWith(`${wikiFolder}/`)
    ? pagePath
    : `${wikiFolder}/${pagePath}`;
}
