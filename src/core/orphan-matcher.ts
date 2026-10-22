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
/**
 * The target of a wikilink: `[[path|Label]]` → `path`, without the extension.
 *
 * The identity of a link is its target, not its spelling. A label is
 * presentation, and `[[page]]` and `[[page|Label]]` are the same link to the
 * same page.
 */
export function linkTargetOf(linkTarget: string): string {
  const match = linkTarget.match(/\[\[\s*([^\]|]+?)\s*(?:\|\s*([^\]]*?)\s*)?\]\]/);
  return (match ? match[1] : linkTarget).trim().replace(/\.md$/, '');
}

/**
 * Should the append be skipped?
 *
 * True when the content already links to the same page. The comparison is by
 * target identity, not by whole string: `[[page]]` and `[[page|Label]]` are the
 * same link, and a page linked under the vault path and under the wiki-relative
 * path is the same page too. Comparing whole strings let one page be linked
 * twice under two spellings.
 *
 * @param relatedContent - Current content of the related page
 * @param linkTarget - The link that would be appended
 * @param acceptedTargets - Other spellings of the same page
 * @returns True when the content already links that page
 */
export function validateOrphanLinkTarget(
  relatedContent: string,
  linkTarget: string,
  acceptedTargets: readonly string[] = []
): boolean {
  if (relatedContent.includes(linkTarget)) return true;
  const wanted = linkTargetOf(linkTarget);
  if (!wanted) return false;
  const spellings = new Set<string>([wanted]);
  for (const accepted of acceptedTargets) {
    const normalized = accepted.trim().replace(/\.md$/, '');
    if (normalized) spellings.add(normalized);
  }
  for (const match of relatedContent.matchAll(/\[\[\s*([^\]|]+?)\s*(?:\|\s*([^\]]*?)\s*)?\]\]/g)) {
    if (spellings.has(linkTargetOf(match[1]))) return true;
  }
  return false;
}

/**
 * The page's path relative to the wiki folder, without the extension.
 */
export function wikiRelativePagePath(orphanPath: string, wikiFolder: string): string {
  const prefix = `${wikiFolder}/`;
  return (orphanPath.startsWith(prefix) ? orphanPath.slice(prefix.length) : orphanPath)
    .replace(/\.md$/, '');
}

/**
 * Every spelling a link to this page can take: the vault path, the path
 * relative to the wiki folder, and the bare file name.
 */
export function orphanLinkSpellings(orphanPath: string, wikiFolder: string): string[] {
  const rel = wikiRelativePagePath(orphanPath, wikiFolder);
  const base = rel.split('/').pop() ?? rel;
  return [orphanPath.replace(/\.md$/, ''), rel, base];
}

/**
 * Rebuild a link so that it names the orphan itself.
 *
 * Issue #824's acceptance criterion is that the orphan **gains an inbound link**.
 * Skipping an unresolvable target does not meet it: the page stays orphaned and is
 * re-reported on the next run, which is the loop the report describes. The repair
 * needs no second model call — the orphan's own path is known here, and a link built
 * from it cannot be wrong, because the page is by definition there.
 *
 * The model's readable text is kept as the display label, so a repaired entry still
 * reads `sources/paste-rules` where the file is `sources/paste-rules_f7bbee`. That
 * suffix is an ingester artefact, and showing it to the user is a worse outcome than
 * the label the model already wrote.
 *
 * The function is idempotent on its own output, and returns the input unchanged when
 * the target already equals the real path.
 *
 * @param linkTarget - What the model supplied: `[[target]]`, `[[target|display]]`, or
 *   prose carrying no wikilink at all
 * @param orphanPath - Full vault path of the orphan, e.g. `wiki/sources/x_f7bbee.md`
 * @param wikiFolder - Wiki root, stripped so the link matches the vault's own style
 * @returns A wikilink whose target names a page that exists
 */
export function retargetOrphanLinkTarget(
  linkTarget: string,
  orphanPath: string,
  wikiFolder: string
): string {
  // Mirrors `makeOrphanLinkTargetResolver`, which registers both forms: stripping the
  // wiki prefix only when it is there, so a page outside the wiki folder still works.
  const rel = wikiRelativePagePath(orphanPath, wikiFolder);
  const match = linkTarget.match(/\[\[\s*([^\]|]+?)\s*(?:\|\s*([^\]]*?)\s*)?\]\]/);
  if (!match) return `[[${rel}]]`;
  const inner = match[1].trim().replace(/\.md$/, '');
  const display = match[2]?.trim();
  if (display) return `[[${rel}|${display}]]`;
  if (inner === rel) return `[[${rel}]]`;
  return `[[${rel}|${inner}]]`;
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
