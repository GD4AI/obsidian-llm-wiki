// Dead Link Detector — Pure functions for dead link detection and correction
// Extracted from lint-fixes.ts::fixDeadLink()
// Zero side effects, fully testable

import { computeSlug } from './slug';
import type { WikiPageRef } from '../types';

// Deliberately narrower than WikiPageRef — these functions only need a page's
// identity and names, not wikiLink/tags/ctime/text, so callers (and tests) can
// build a minimal literal instead of a full page object. Derived via Pick so
// the shared fields (notably displayTitle, see below) have one definition.
export type PageRef = Pick<WikiPageRef, 'path' | 'title' | 'aliases' | 'displayTitle'>;
// Issue #592: `title` is the filename slug (`getExistingWikiPages` sets it from `f.basename`), not a display name — title-casing a slug can't recover punctuation, spacing, or subscripts a real heading has.
// `displayTitle`, when present, is the page's real H1 and should be preferred over `title` anywhere a link repair needs to show the reader something, not just address the page.

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
  wikiFolder: string
): string {
  const relPath = page.path
    .replace(wikiFolder + '/', '')
    .replace('.md', '');
  return `[[${relPath}|${page.displayTitle || page.title}]]`;
}

/**
 * Replace dead link in content with corrected link.
 *
 * A dead link may already carry an author-written alias (`[[wrong-path|Custom Name]]`).
 * The reader already saw that name, so it outranks whatever display name `replacement`
 * carries — this is checked per match, not once for the whole file, so a page with two
 * occurrences of the same target under two different aliases keeps both instead of one
 * overwriting the other.
 *
 * @param content - Source page content
 * @param targetName - Dead link target to find
 * @param replacement - Replacement wiki link, used verbatim for an occurrence with no alias of its own
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
  const linkRegex = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g;
  return content.replace(
    linkRegex,
    (fullMatch: string, capturedTarget: string, capturedAlias?: string) => {
      if (capturedTarget.trim() !== targetName) return fullMatch;
      if (!capturedAlias) return replacement;
      const relPath = replacement.match(/^\[\[([^\]|]+)/)![1];
      return `[[${relPath}|${capturedAlias.trim()}]]`;
    }
  );
}
