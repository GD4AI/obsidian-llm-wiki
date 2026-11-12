/**
 * Sources field normalizer for Issue #81.
 *
 * Pure functions (no IO, no Obsidian API). The wiki's `sources:` YAML frontmatter
 * field is a list of wikilinks pointing to source files. Real-world pollution patterns
 * (per DocTpoint's report) include:
 *
 *   - "[[Notizen/Glycin.md]]"   → remove (external path) or remap to sources/Glycin
 *   - "[[sources/Glycin.md]]"   → [[sources/Glycin]]  (strip .md)
 *   - "[[sources/Foo|Foo]]"     → [[sources/Foo]]    (strip alias pipe)
 *   - duplicates of the above    → deduplicate
 *   - "[[]]"                    → remove (empty link)
 *
 * The canonical form: `[[<entities|concepts|sources>/X]]` — wikilink, no extension,
 * no alias pipe.
 */

import type { TFile } from 'obsidian';
import { computeSlug } from './slug';
import { isInFolderScope } from './folder-scope';

/**
 * The minimum `app.vault` surface used by `normalizeSourcesInFolder`.
 * Spelled out so callers and tests don't have to fake the full Obsidian
 * `App` (the previous extraction needed `{} as unknown as WikiEngine`
 * junk casts because the shape lived on the AutoMaintainManager class).
 */
/**
 * The part of `App['vault']` this module reads. Typed with the real `TFile` rather
 * than `{ path: string }`: `strictFunctionTypes` (#816) stopped the wider parameter
 * from accepting `App`, whose `read` takes a `TFile`. The widened form was never
 * true — the objects passed here come from `getMarkdownFiles()`.
 */
interface VaultLike {
  getMarkdownFiles: () => TFile[];
  read: (file: TFile) => Promise<string>;
  // `fn` returns `string`, matching Obsidian's own signature. A `string |
  // Promise<string>` return made this type wider than the real vault, which
  // `strictFunctionTypes` rejects (#816).
  process: (file: TFile, fn: (data: string) => string) => Promise<string>;
}

/**
 * Normalize a single raw source entry to its canonical form.
 *
 * @param raw - Raw string from frontmatter (may include `[[ ]]`, `.md`, `|alias`, or external path)
 * @param wikiFolder - User's wiki folder name (used to strip the prefix and detect internal paths)
 * @param preserveCase - Match the user's slugCase setting when slugifying a remapped external filename
 * @returns Normalized relative path (e.g. `sources/Foo`), or empty string for unfixable inputs
 */
export function normalizeSourcePath(raw: string, wikiFolder: string, preserveCase = true): string {
  let s = raw.trim();
  if (!s || s === '[[]]') return '';

  // Strip [[ ]] brackets
  if (s.startsWith('[[') && s.endsWith(']]')) {
    s = s.slice(2, -2).trim();
  }
  if (!s) return '';

  // Strip |alias pipe (keep the left side, the target)
  const pipeIdx = s.indexOf('|');
  if (pipeIdx !== -1) s = s.substring(0, pipeIdx).trim();
  if (!s) return '';

  // Strip .md extension
  if (s.endsWith('.md')) s = s.slice(0, -3);
  if (!s) return '';

  // Detect internal vs external paths
  const wikiPrefix = wikiFolder + '/';
  if (s.startsWith(wikiPrefix)) {
    // Internal: strip wiki/ prefix
    s = s.substring(wikiPrefix.length);
  } else if (
    s.startsWith('entities/') ||
    s.startsWith('concepts/') ||
    s.startsWith('sources/')
  ) {
    // Already canonical internal path
  } else {
    // External: remap to sources/<filename>, slugified so the link resolves to the
    // canonical source page (e.g. "Notizen/Autonome Dysregulation" → "sources/Autonome-Dysregulation",
    // "AGEs (Advanced Glycation End Products)" → "sources/AGEs-Advanced-Glycation-End-Products").
    const filename = s.split('/').pop() || s;
    s = `sources/${computeSlug(filename, preserveCase)}`;
  }

  return s;
}

/**
 * Normalize a list of raw source entries: apply normalizeSourcePath to each,
 * filter empty results, and deduplicate (preserving first-occurrence order).
 *
 * @param rawList - Array of raw source strings from frontmatter
 * @param wikiFolder - User's wiki folder name
 * @param preserveCase - Match the user's slugCase setting when slugifying remapped external filenames
 * @returns Array of normalized wikilink strings `[[path]]` (no `.md`, no `|alias`)
 */
export function normalizeSourcesField(rawList: string[], wikiFolder: string, preserveCase = true): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of rawList) {
    const normalized = normalizeSourcePath(String(raw), wikiFolder, preserveCase);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(`[[${normalized}]]`);
  }
  return result;
}

/**
 * Detect if a file's frontmatter sources field is polluted (has any entry that
 * would change under normalization).
 *
 * @param content - File content (full markdown including frontmatter)
 * @param wikiFolder - User's wiki folder name
 * @param preserveCase - Match the user's slugCase setting (must agree with fixPollutedSources)
 * @returns true if any sources entry would change
 */
export function scanPollutedSources(content: string, wikiFolder: string, preserveCase = true): boolean {
  const entries = extractRawSourcesEntries(content);
  if (entries.length === 0) return false;
  return entries.some(e => {
    const canonical = normalizeSourcePath(e, wikiFolder, preserveCase);
    if (!canonical) return true; // empty link — pollution
    // Strip brackets to compare
    const stripped = e.replace(/^\[\[/, '').replace(/\]\]$/, '');
    const changed = canonical !== stripped;
    if (changed) console.debug(`[scanPollutedSources] entry changed: "${e}" → canonical="${canonical}"`);
    return changed;
  });
}

/**
 * Extract raw source entries from a file's frontmatter. Returns array of raw strings
 * (each potentially with `[[ ]]`, `.md`, `|alias`). Empty if no sources field.
 */
function extractRawSourcesEntries(content: string): string[] {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return [];
  const fmBody = fmMatch[1];

  // Find the sources: line(s)
  // Inline array: sources: ["a", "b"]
  const inlineMatch = fmBody.match(/^sources:\s*\[(.*)\]\s*$/m);
  if (inlineMatch) {
    return inlineMatch[1]
      .split(',')
      .map(s => s.trim().replace(/^"|"$/g, ''))
      .filter(Boolean);
  }

  // Multi-line list:
  // sources:
  //   - "a"
  //   - "b"
  const lines = fmBody.split('\n');
  const startIdx = lines.findIndex(l => /^sources:\s*$/.test(l));
  if (startIdx === -1) return [];
  const result: string[] = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^\s*-\s*"([^"]*)"/);
    if (m) result.push(m[1]);
    else if (line.trim() && !/^\s*-\s*/.test(line)) break;
  }
  return result;
}

/**
 * Fix polluted sources field in file content. Idempotent.
 *
 * @param content - File content (full markdown including frontmatter)
 * @param wikiFolder - User's wiki folder name
 * @param preserveCase - Match the user's slugCase setting when slugifying remapped external filenames
 * @returns Object with `fixed` (number of changes made) and `content` (potentially modified)
 */
export function fixPollutedSources(
  content: string,
  wikiFolder: string,
  preserveCase = true
): { fixed: number; content: string } {
  const rawEntries = extractRawSourcesEntries(content);
  if (rawEntries.length === 0) return { fixed: 0, content };
  console.debug(`[fixPollutedSources] rawEntries (${rawEntries.length}): ${JSON.stringify(rawEntries)}`);

  // Compute the normalized entries
  const normalized = normalizeSourcesField(rawEntries, wikiFolder, preserveCase);
  console.debug(`[fixPollutedSources] normalized (${normalized.length}): ${JSON.stringify(normalized)}`);

  // Always perform the fix; the diff between before/after content is the truth.
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return { fixed: 0, content };
  const fmBody = fmMatch[1];

  // Determine format and build replacement.
  // Use anchored regex that matches from `sources:` line start through its end.
  // For inline array: must handle nested [[wikilinks]] correctly — use a non-greedy match
  // that captures everything from `sources: [` to the LAST `]` on the same line.
  const isInline = /^[ \t]*sources:\s*\[.*\][ \t]*$/m.test(fmBody);
  let newFmBody: string;
  if (isInline) {
    const newLine = `sources: [${normalized.map(n => `"${n}"`).join(', ')}]`;
    // Match `sources: [` ... `]` at the end of the line, tolerating nested wikilinks
    newFmBody = fmBody.replace(/^([ \t]*)sources:\s*\[(.*)\][ \t]*$/m, (_match, indent) => `${indent}${newLine}`);
  } else {
    const newBlock = `sources:\n${normalized.map(n => `  - "${n}"`).join('\n')}\n`;
    newFmBody = fmBody.replace(/^([ \t]*)sources:\s*\n((?:[ \t]*-\s*"[^"]*"\s*\n?)+)/m, (_match, indent) => `${indent}${newBlock}`);
  }

  // Source of truth: did the content actually change?
  if (newFmBody === fmBody) {
    return { fixed: 0, content };
  }

  const newContent =
    content.substring(0, fmMatch.index) +
    `---\n${newFmBody}\n---` +
    content.substring(fmMatch.index! + fmMatch[0].length);

  return { fixed: 1, content: newContent };
}

/**
 * Phase 2 of `AutoMaintainManager.runStartupCheck`, extracted as a module
 * function so the folder-scope filter is testable without standing up the
 * whole startup surface (which sleeps 3s and needs the wikiEngine/plugin
 * dependencies). Mirrors the Phase 3 shape (`findIncompletePages` in
 * `incomplete-page-cleaner.ts`) so all startup phases follow the same
 * dependency surface.
 *
 * Returns `{ filesCleaned, entriesCleaned }` so the caller (runStartupCheck
 * Phase 5) can build the summary Notice. The function swallows per-call
 * errors via the underlying `vault.process` and `vault.read` paths the
 * caller already supplied — the original inline loop did the same.
 */
export async function normalizeSourcesInFolder(
  app: { vault: VaultLike },
  wikiFolder: string,
  preserveCase: boolean
): Promise<{ filesCleaned: number; entriesCleaned: number }> {
  let filesCleaned = 0;
  let entriesCleaned = 0;
  try {
    const wikiFiles = app.vault.getMarkdownFiles()
      .filter(f => isInFolderScope(f.path, wikiFolder, false));
    let polluted = 0;
    for (const file of wikiFiles) {
      const content = await app.vault.read(file);
      if (!scanPollutedSources(content, wikiFolder, preserveCase)) continue;
      polluted += 1;
      const { fixed, content: fixedContent } = fixPollutedSources(content, wikiFolder, preserveCase);
      if (fixed > 0) {
        await app.vault.process(file, () => fixedContent);
        filesCleaned += 1;
        entriesCleaned += fixed;
      }
    }
    console.debug(`[QuickFixes] Phase 2 complete: ${wikiFiles.length} scanned, ${polluted} polluted, ${filesCleaned} fixed (${entriesCleaned} entries)`);
  } catch (e) {
    console.warn('[QuickFixes] Phase 2 failed:', e);
  }
  return { filesCleaned, entriesCleaned };
}
