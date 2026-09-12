export function slugify(text: string, preserveCase = false): string {
  // v1.22.2 D2: console.debug removed from slugify hot-path (called thousands
  // of times per batch — every debug log is I/O that slows ingest).
  if (!text || text.trim().length === 0) {
    console.warn('slugify: input text is empty');
    return 'untitled';
  }

  return computeSlug(text, preserveCase);
}

// Pure slug computation — no debug logs on normal path. Used for batch operations
// where thousands of silent calls are needed (e.g. matching 2141 existing pages).
// preserveCase skips the final toLowerCase() for file creation (Issue #111).
// All comparison/matching callers must NOT pass preserveCase so slugs stay
// case-insensitively comparable regardless of the user's slugCase setting.
import { MIN_ALIAS_LENGTH, MIN_ALIAS_LENGTH_MIN, MIN_ALIAS_LENGTH_MAX } from '../constants';

export function computeSlug(text: string, preserveCase = false): string {
  if (!text || text.trim().length === 0) return 'untitled';

  const trimmed = text.trim();

  // Step 1: Remove ASCII control characters and filesystem-unsafe symbols
  const afterRemoveInvalid = trimmed
    // eslint-disable-next-line no-control-regex -- deliberate control-char strip for filename safety
    .replace(/[\x00-\x1f]/g, '')
    .replace(/[/\\:*?"<>|,()'!?、，。；：！？（）【】《》]/g, '');

  if (afterRemoveInvalid.length === 0) return 'untitled-' + Date.now();

  // Step 2: Convert spaces and dots to dashes
  const afterSpaceToDash = afterRemoveInvalid.replace(/[\s.]+/g, '-');

  // Step 3: Merge multiple dashes
  const afterMergeDash = afterSpaceToDash.replace(/-+/g, '-');

  // Step 4: Remove leading and trailing dashes
  const finalSlug = afterMergeDash.replace(/^-|-$/g, '').trim();

  if (finalSlug.length === 0) return 'untitled-' + Date.now();

  return preserveCase ? finalSlug : finalSlug.toLowerCase();
}

// v1.25.10 PATCH Issue #366 — Turkish-aware case fold for *comparison*
// keys.
//
// `slugKeys` is used to compare "do these two names denote the same thing"
// across pages and across the link graph. For Turkish-language vaults a
// plain `.toLowerCase()` is not enough — `I` and `İ` are different
// letters in Turkish and `Ş`/`Ğ` are not in the ASCII fold at all.
//
// We do NOT change `computeSlug`'s output (the file-naming path) —
// existing users' filenames stay byte-identical. The fold only affects
// the comparison keys, so the plugin now recognises a wikilink target
// that exists under either spelling.
//
// Pure function, easily unit-tested. The six-letter fold runs in a
// single regex + map pass (one allocation per match), avoiding the
// chained `.replace` that would otherwise re-scan the text six times.
const TURKISH_FOLD: Readonly<Record<string, string>> = {
  'İ': 'i', 'Ş': 'ş', 'Ğ': 'ğ', 'Ü': 'ü', 'Ö': 'ö', 'Ç': 'ç',
};
export function turkishCaseFold(text: string): string {
  return text.replace(/[İŞĞÜÖÇ]/g, ch => TURKISH_FOLD[ch]).toLowerCase();
}

// Issue #312 — comparison keys for "do these two names denote the same thing".
// Returns the slugified forms of a name plus its aliases in the
// comparison-key form. The fold strategy is opt-in via the second
// argument so non-Turkish vaults stay on the cheap ASCII path.
//
// Pure and allocation-cheap: the merge path calls it once per page write.
export function slugKeys(
  name: string,
  aliases: readonly string[] = [],
  opts: { turkishFold?: boolean } = {},
): Set<string> {
  const keys = new Set<string>();
  const fold = opts.turkishFold === true;
  for (const raw of [name, ...aliases]) {
    if (typeof raw !== 'string') continue;
    // NFC first: a name read back from disk may be decomposed (macOS hands
    // out NFD filenames) while the model writes composed text, and
    // `computeSlug` compares code points — without this the two forms of
    // one umlaut are two keys. The file-naming path is untouched.
    const trimmed = raw.trim().normalize('NFC');
    if (trimmed.length === 0) continue;
    // Fold BEFORE slugifying so that `[[İsim]]` and `[[isim]]` collapse
    // to the same comparison key inside a Turkish vault. ASCII `I`
    // lowercase remains `i`, but `İ` is folded to `i` first, so both
    // inputs land on `isim` via the same `computeSlug` path.
    const folded = fold ? turkishCaseFold(trimmed) : trimmed;
    const slugged = computeSlug(folded);
    if (slugged.length === 0) continue;
    keys.add(slugged);
  }
  return keys;
}

// Filter out aliases that are redundant against a page's own filename.
// Obsidian resolves `[[X]]` to a file whose basename equals X (case-insensitive),
// so an alias that already equals the filename is a self-pointing no-op that only
// clutters frontmatter. This commonly happens on cross-type collisions where the
// colliding name is identical to the existing page's name (e.g. adding "Vigilanz"
// to vigilanz.md). Comparison is exact case-insensitive basename match — NOT slug
// based — because Obsidian does not collapse spaces/symbols when resolving links,
// so a space-variant like "Deep Learning" on deep-learning.md IS a useful alias
// and must be kept.
// Pure function (no IO) so the dedup rule can be unit-tested in isolation.
//
// v1.25.10 PATCH alias hardening:
//   - `MIN_ALIAS_LENGTH` floor (2 chars). One-character aliases carry no
//     dedup value above the page basename and collide with everything;
//     two-character aliases (ML / HD / CD / AI / UI / ...) are common in
//     real-world vaults and would be too aggressive to drop, so the
//     floor is 2, not 3. Tunable per vault via the `minAliasLength`
//     setting, which callers pass as `minLength`; callers that pass
//     nothing keep the constant, i.e. v1.25.9 behaviour.
//   - Optional `existingAliasesAcrossPages` argument lets callers (alias
//     completion, merge triage) reject candidates that would create a
//     wikilink ambiguity by overlapping with an alias already on
//     another page. Pass-through by default — v1.25.9 callers
//     unchanged.
//
// The constant itself lives in `src/constants.ts` so it can be
// tuned centrally without grepping the codebase.
//
// The comparison key is NFC-normalised and folded like `slugKeys` (not bare
// `toLowerCase()`): a page basename that came back from disk decomposed and
// a composed alias from the model must meet, and `İstanbul`/`istanbul` must
// be one alias, not two — `toLowerCase()` turns `İ` into `i` + COMBINING DOT
// ABOVE, so without the fold the uniqueness gate never fires on that pair.
//
// Exported because the comparison must be the same wherever two aliases are
// asked whether they are one alias. `filterRedundantAliases` folds; the
// append path used to compare the page's OWN existing aliases with a plain
// `Array.includes`, which let "NAC" and "NAc" stand side by side on a page.
export function aliasKey(raw: string): string {
  return turkishCaseFold(raw.trim().normalize('NFC'));
}

/**
 * The alias floor a caller applies: the `minAliasLength` setting when it is an
 * integer inside the accepted range, the `MIN_ALIAS_LENGTH` constant otherwise.
 * Lives next to `filterRedundantAliases` so BOTH writers of `aliases:` (the
 * append path and `enforceFrontmatterConstraints` on the create path) resolve
 * the same floor from the same place — before this, only the append path read
 * the setting and the create path silently fell back to the constant.
 */
export function resolveMinAliasLength(settings?: { minAliasLength?: number }): number {
  const v = settings?.minAliasLength;
  return Number.isInteger(v) && (v as number) >= MIN_ALIAS_LENGTH_MIN && (v as number) <= MIN_ALIAS_LENGTH_MAX
    ? (v as number)
    : MIN_ALIAS_LENGTH;
}

export function filterRedundantAliases(
  pagePath: string,
  candidateAliases: string[],
  existingAliasesAcrossPages?: readonly string[],
  minLength: number = MIN_ALIAS_LENGTH,
): string[] {
  const fileName = pagePath.split('/').pop() || '';
  const fileKey = aliasKey(fileName.replace(/\.md$/i, ''));
  const crossPageKeys = new Set<string>();
  if (existingAliasesAcrossPages) {
    for (const raw of existingAliasesAcrossPages) {
      if (typeof raw !== 'string') continue;
      const trimmed = raw.trim();
      if (trimmed.length >= minLength) {
        crossPageKeys.add(aliasKey(trimmed));
      }
    }
  }
  const seen = new Set<string>();
  return candidateAliases.filter(alias => {
    if (typeof alias !== 'string') return false;
    const trimmed = alias.trim();
    if (trimmed.length < minLength) return false;
    const key = aliasKey(trimmed);
    if (key === fileKey) return false; // already resolves to this file — redundant
    if (crossPageKeys.has(key)) return false; // already used on another page — wikilink ambiguity
    if (seen.has(key)) return false; // duplicate within the batch (case-insensitive)
    seen.add(key);
    return true;
  });
}
