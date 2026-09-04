// Dead Link Detector — Pure functions for dead link detection and correction
// Extracted from lint-fixes.ts::fixDeadLink()
// Zero side effects, fully testable

import { computeSlug } from './slug';

export interface PageRef {
  path: string;
  title: string;
  aliases?: string[];
  /**
   * Issue #592: `title` is the filename slug (`getExistingWikiPages` sets it from `f.basename`), not a display name — title-casing a slug can't recover punctuation, spacing, or subscripts a real heading has.
   * When present, this is the page's real H1 (or, absent that, its first frontmatter alias) and should be preferred over `title` anywhere a link repair needs to show the reader something, not just address the page.
   */
  displayTitle?: string;
}

// #308: a link target is slugified ("Systemische-Inflammation"), titles and
// aliases are not ("Systemische Inflammation"). toLowerCase() alone leaves the
// hyphen different from the space, so the two forms of the same name never
// compare equal. computeSlug is the pure variant of slugify (no console.warn on
// the hot path) and already lowercases, which keeps this comparable regardless
// of the user's slugCase setting.
// Empty input is mapped to '' rather than to computeSlug's 'untitled'
// placeholder, so a page with an empty alias cannot match a link to "untitled".
function slugKey(text: string | undefined): string {
  if (!text || text.trim().length === 0) return '';
  return computeSlug(text);
}

/**
 * Find matching page for a dead link target.
 * Searches by title (case-insensitive) first, then by aliases, then repeats
 * both with slug normalization on either side (#308).
 *
 * @param pages - Available wiki pages from getExistingWikiPages
 * @param targetName - The dead link target (e.g., "思维链" or "CoT")
 * @returns Matching page or undefined if no match found
 *
 * @example
 * const pages = [{ title: 'Chain of Thought', aliases: ['CoT', '思维链'] }];
 * findDeadLinkTarget(pages, '思维链') // => { title: 'Chain of Thought', ... }
 * findDeadLinkTarget(pages, 'cot') // => { title: 'Chain of Thought', ... }
 * findDeadLinkTarget(pages, 'chain-of-thought') // => { title: 'Chain of Thought', ... }
 * findDeadLinkTarget(pages, 'nonexistent') // => undefined
 */
export function findDeadLinkTarget(
  pages: PageRef[],
  targetName: string
): PageRef | undefined {
  const targetBasename = targetName.includes('/')
    ? targetName.split('/').pop()!
    : targetName;
  const lowerTarget = targetBasename.toLowerCase();

  // First: exact title match (case-insensitive)
  let match = pages.find(p => p.title.toLowerCase() === lowerTarget);

  // Second: alias match (case-insensitive)
  if (!match) {
    match = pages.find(p =>
      p.aliases?.some(a => a.toLowerCase() === lowerTarget)
    );
  }

  // Third and fourth (#308): same two lookups over slug-normalized forms.
  // Kept as separate tiers instead of one combined find() so that an exact
  // title match still outranks a slug alias match on a different page.
  const targetSlug = slugKey(targetBasename);

  if (!match && targetSlug) {
    match = pages.find(p => slugKey(p.title) === targetSlug);
  }

  if (!match && targetSlug) {
    match = pages.find(p =>
      p.aliases?.some(a => slugKey(a) === targetSlug)
    );
  }

  return match;
}

/**
 * Build the replacement wiki link for a dead link.
 *
 * @param page - The matching page
 * @param wikiFolder - Wiki root folder (e.g., "wiki")
 * @param existingAlias - An alias the dead link already carried (`[[wrong-path|Custom Name]]`), from `extractDeadLinkAlias`. The reader already saw this name — it outranks even the target's own `displayTitle`.
 * @returns Formatted wiki link (e.g., "[[entities/chain-of-thought|Chain of Thought]]")
 *
 * @example
 * buildDeadLinkReplacement(
 *   { path: 'wiki/entities/chain-of-thought.md', title: 'Chain of Thought' },
 *   'wiki'
 * ) // => "[[entities/chain-of-thought|Chain of Thought]]"
 */
export function buildDeadLinkReplacement(
  page: PageRef,
  wikiFolder: string,
  existingAlias?: string
): string {
  const relPath = page.path
    .replace(wikiFolder + '/', '')
    .replace('.md', '');
  return `[[${relPath}|${existingAlias || page.displayTitle || page.title}]]`;
}

/**
 * A dead link may already carry an author-written alias. Extracted once by `fixDeadLink` and passed into every branch that repairs the link, so a pre-existing alias always wins over the target's own displayTitle/title.
 * Only matches links that already have a `|alias` segment — a bare `[[target]]` or `[[target#heading]]` correctly returns undefined so callers fall through to displayTitle/title.
 *
 * @example
 * extractDeadLinkAlias('See [[wrong-path|Custom Name]] here', 'wrong-path')
 * // => 'Custom Name'
 * extractDeadLinkAlias('See [[wrong-path]] here', 'wrong-path')
 * // => undefined
 */
export function extractDeadLinkAlias(
  content: string,
  targetName: string
): string | undefined {
  const linkRegex = /\[\[([^\]|#]+)(?:#[^\]|]*)?\|([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = linkRegex.exec(content)) !== null) {
    if (m[1].trim() === targetName) return m[2].trim();
  }
  return undefined;
}

/**
 * Replace dead link in content with corrected link.
 *
 * @param content - Source page content
 * @param targetName - Dead link target to find
 * @param replacement - Replacement wiki link
 * @returns Updated content with link replaced
 *
 * @example
 * replaceDeadLink('See [[思维链]] for details', '思维链', '[[entities/cot|Chain of Thought]]')
 * // => 'See [[entities/cot|Chain of Thought]] for details'
 */
export function replaceDeadLink(
  content: string,
  targetName: string,
  replacement: string
): string {
  const linkRegex = /\[\[([^\]|#]+)(?:[|#][^\]]+)?\]\]/g;
  return content.replace(
    linkRegex,
    (fullMatch: string, capturedTarget: string) => {
      if (capturedTarget.trim() === targetName) return replacement;
      return fullMatch;
    }
  );
}
