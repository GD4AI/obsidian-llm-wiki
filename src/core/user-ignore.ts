// Issue #503 — Obsidian's own "Excluded files" list (Settings → Files and links).
//
// The setting lives as `userIgnoreFilters` in `.obsidian/app.json`, and
// `metadataCache.isUserIgnored(path)` is the resolver Obsidian itself uses. **Neither
// is in the published typings**, which is why this file exists: it is the single place
// that knows the runtime shape, so the rest of the plugin gets a plain
// `(path: string) => boolean`.
//
// Reimplementing the matching was rejected on measurement, not on taste. Measured by
// @DocTpoint on Obsidian 1.13.7 against a real list (`copilot/copilot-custom-prompts/`,
// `#Definition`, `wiki/sources/`):
//
//   1. a plain entry is a string PREFIX on the vault-relative path — the trailing
//      slash is part of the pattern (`wiki/sources` does not match `wiki/sources/`),
//      and there is no substring matching (`Notizen/wiki/sources/x.md` is not caught);
//   2. `#Definition` — a tag entry — matches nothing at all, including a note that
//      carries the tag in its frontmatter;
//   3. `/…/` entries are evaluated as JavaScript regexes.
//
// Three rules, one of which is "silently match nothing". Two of them would drift from
// Obsidian the first time its list semantics changed, and the third is a behaviour
// nobody would think to reimplement. So the plugin asks, and does not decide.

/** The one method this needs, narrowed instead of casting the cache to `any`. */
interface UserIgnoreCache {
  isUserIgnored?(path: string): boolean;
}

/**
 * Derive the exclusion predicate from a `MetadataCache`.
 *
 * Returns a function that never throws. An absent method — an older Obsidian, or a
 * test double — yields "nothing is excluded", which is the same behaviour as a vault
 * with an empty list.
 *
 * A throwing `isUserIgnored` is caught and treated as "not excluded" with a warning.
 * That is deliberate: `userIgnoreFilters` accepts regexes, a user can write an invalid
 * one, and the recoverable failure is ingesting a file the user meant to exclude. The
 * alternative is that one broken pattern stops a whole folder ingest with no path
 * forward, which is worse and harder to discover.
 */
export function makeUserIgnorePredicate(metadataCache: unknown): (path: string) => boolean {
  const cache = metadataCache as UserIgnoreCache | null | undefined;
  if (typeof cache?.isUserIgnored !== 'function') return () => false;

  const isUserIgnored = cache.isUserIgnored.bind(cache);
  return (path: string): boolean => {
    try {
      return isUserIgnored(path) === true;
    } catch (e) {
      console.warn(
        `userIgnoreFilters: isUserIgnored threw for ${path}; treating it as not excluded`,
        e
      );
      return false;
    }
  };
}
