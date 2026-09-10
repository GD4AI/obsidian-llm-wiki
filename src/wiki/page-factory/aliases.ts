// page-factory/aliases.ts — append-deduplicate-merge aliases into a wiki page's
// frontmatter. Module-level function extracted from the original
// page-factory.ts god-class so the frontmatter-mutation rule is independently
// testable and free of class-instance state.
//
// Behavior (v1.24.1 Phase 2 refactor — preserved verbatim):
//   - Reads the existing page via `ctx.tryReadFile`. No-op when the page is
//     missing or unreadable.
//   - Drops aliases that already equal the page's filename (case-insensitive)
//     via `filterRedundantAliases` so we don't add "Vigilanz" to vigilanz.md.
//   - Deduplicates against the existing `aliases:` array before merging.
//   - Replaces the existing `aliases:` block if present, otherwise injects a
//     fresh block before the closing `---`.

import { aliasKey, filterRedundantAliases, resolveMinAliasLength } from '../../core/slug';
import { parseFrontmatter } from '../../core/frontmatter';

// Moved to core/slug.ts so the create path (enforceFrontmatterConstraints)
// resolves the same floor without importing from the page factory; re-exported
// here so existing importers keep working.
export { resolveMinAliasLength };

/**
 * Minimal context contract required by `appendAliases`. The real
 * `EngineContext` (defined in `src/types.ts`) satisfies this; tests inject
 * a mock with the same shape.
 */
export interface AliasesContext {
  tryReadFile: (path: string) => Promise<string | null>;
  createOrUpdateFile: (path: string, content: string) => Promise<void>;
  /** Optional: only `minAliasLength` is read here. Absent → MIN_ALIAS_LENGTH. */
  settings?: { minAliasLength?: number };
}

/**
 * Append `newAliases` to the frontmatter `aliases:` block of `pagePath`,
 * deduplicating against the existing list. No-op if:
 *   - the page is missing or unreadable;
 *   - every input alias is redundant (matches the filename) or already
 *     present in the existing list;
 *   - the page has no frontmatter delimiters (corrupt file).
 *
 * The frontmatter rewrite preserves everything outside the `aliases:` block,
 * so unrelated fields (tags, source paths, etc.) are untouched.
 */
export async function appendAliases(
  ctx: AliasesContext,
  pagePath: string,
  newAliases: string[],
  existingAliasesAcrossPages?: readonly string[],
): Promise<void> {
  const content = await ctx.tryReadFile(pagePath);
  if (!content) return;

  // Drop aliases that already equal the page's filename (case-insensitive),
  // e.g. adding "Vigilanz" to vigilanz.md. Common on cross-type collisions
  // where the colliding name is identical to the existing page's name.
  const candidates = filterRedundantAliases(pagePath, newAliases, existingAliasesAcrossPages, resolveMinAliasLength(ctx.settings));
  if (candidates.length === 0) return;

  const fm = parseFrontmatter(content);
  const existingAliases = Array.isArray(fm?.aliases) ? fm.aliases : [];
  // Fold before comparing, the same way `filterRedundantAliases` just folded
  // the batch and the cross-page claims. A plain `includes` here made this the
  // one list compared byte-exactly, so an incoming "NAc" did not recognise the
  // "NAC" already on the page. The spelling already on disk wins.
  const existingKeys = new Set(existingAliases.map(aliasKey));
  const toAdd = candidates.filter(a => !existingKeys.has(aliasKey(a)));
  if (toAdd.length === 0) return;

  const merged = [...existingAliases, ...toAdd];
  const aliasesLine = `aliases:\n${merged.map(a => `  - "${a}"`).join('\n')}`;

  // Replace existing aliases block or inject before closing ---
  const fmStart = content.indexOf('---');
  const fmEnd = content.indexOf('\n---', fmStart + 3);
  if (fmStart === -1 || fmEnd === -1) return;

  const fmText = content.substring(fmStart + 3, fmEnd);
  const body = content.substring(fmEnd + 4);

  let newFm: string;
  if (fmText.includes('aliases:')) {
    // Replace existing aliases block
    newFm = fmText.replace(/^aliases:[^\n]*(?:\n[ \t]+[^\n]*)*/m, aliasesLine);
  } else {
    // Inject before closing ---
    newFm = fmText.trimEnd() + '\n' + aliasesLine;
  }

  const newContent = `---${newFm}\n---${body}`;
  await ctx.createOrUpdateFile(pagePath, newContent);
  console.debug(`appendAliases: added ${toAdd.join(', ')} to ${pagePath}`);
}
/**
 * The names another page may not claim again: every OTHER page's basename and
 * aliases. Feeds `filterRedundantAliases`' cross-page gate (f9a680e), which was
 * introduced for exactly this and never had a caller. Basenames are included
 * alongside aliases because Obsidian resolves `[[X]]` to basenames first: an
 * alias equal to another page's basename is shadowed and never carries a
 * resolution.
 */
export function aliasClaimsFromPages(
  pages: ReadonlyArray<{ path: string; title: string; aliases?: string[] }>,
  excludePath: string,
): string[] {
  const claims: string[] = [];
  for (const p of pages) {
    if (p.path === excludePath) continue;
    if (p.title) claims.push(p.title);
    if (Array.isArray(p.aliases)) {
      for (const a of p.aliases) {
        if (typeof a === 'string' && a.trim()) claims.push(a);
      }
    }
  }
  return claims;
}
