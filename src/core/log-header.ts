// log.md header builder — i18n-aware pure function.
// Called by wiki-engine.ts when a new log.md is created.
// The header explains the log file and points to the Operation History Panel
// for better visualisation.
//
// Structural fingerprint: the new format is wrapped in
// `<!-- llm-wiki-log-header-start -->` HTML comments. Obsidian-invisible,
// never appear in user content, and let isOldFormatLogHeader() detect the
// new format in any language without depending on natural-language text.
//
// All localised strings live in src/texts/<lang>.ts (logHeaderTitle etc.)
// so translations stay consolidated with the rest of the plugin UI.

import { TEXTS } from '../texts';

const HEADER_MARKER_START = '<!-- llm-wiki-log-header-start -->';

/** The rule that closes the header block. `buildLogHeader` ends with it. */
const HEADER_TERMINATOR = '\n---\n';

/**
 * Build the log header.
 *
 * `headerLang` is the language the header is written in — the wiki's content
 * language. `commandName` is the name of the command the header points at,
 * and it comes from the **interface** language, because that is the language
 * the command palette is registered in. Issue #793: with `language: en` and
 * `wikiLanguage: de`, the palette shows "View operation history", so a
 * German header that quoted "Ingestionsverlauf anzeigen" would send the user
 * looking for a command that does not exist.
 *
 * The name is a required argument rather than an optional one. An optional
 * parameter with a fallback to the header language's own name is the same
 * "one fact stored twice" shape that produced the drift in the first place:
 * a caller that forgets it gets a plausible wrong answer instead of a
 * compile error.
 */
export function buildLogHeader(headerLang: string, commandName: string): string {
  const t = TEXTS[headerLang as keyof typeof TEXTS] || TEXTS.en;
  return `${HEADER_MARKER_START}
# ${t.logHeaderTitle}

${t.logHeaderSubtitle}
- ${t.logHeaderShortcut(commandName)}
- ${t.logHeaderSettingsShortcut}

---
`;
}

// v1.22.2: log header old-format detection and non-destructive migration.
// v1.22.1 and earlier wrote a one-line header like:
//   "# Wiki Operation Log\n\n"
// New format is multi-line with History Panel hints (see HEADER_LABELS).
// On startup, scan log.md and replace ONLY the header — all `## [date time]`
// entries are preserved untouched. Idempotent on already-migrated files.

/** True if the given log content has the legacy single-line header
 *  (and not the multi-line new format).
 *
 *  Detection looks for the `<!-- llm-wiki-log-header-start -->` HTML-comment
 *  marker embedded at the start of the new-format header. The marker is:
 *  - Obsidian-invisible (HTML comments aren't rendered)
 *  - Language-agnostic (a single fixed string)
 *  - Structurally unique (would never appear in user-authored content
 *    or in log entry bodies)
 */
export function isOldFormatLogHeader(content: string | null, _lang: string): boolean {
  if (!content) return false;
  return !content.includes(HEADER_MARKER_START);
}

/** Decide whether the header needs rewriting.
 *
 *  Two different questions, deliberately answered in one place:
 *
 *  1. **Is this the legacy single-line format?** Structural, marker-based, and
 *     the same answer in every language.
 *  2. **Does the header block still match what this vault would write now?**
 *     Byte equality against `buildLogHeader`, because the block quotes a
 *     command name and that name moves when the interface language changes.
 *     Issue #876: with only question 1 asked, a file already in the new format
 *     was never looked at again, so every migrated vault kept the command name
 *     it was migrated with — forever.
 *
 *  `commandName` is required for the same reason it is required in
 *  `buildLogHeader`: a caller that omits it would get "nothing to do" instead of
 *  a compile error, and "nothing to do" is indistinguishable from "already
 *  correct".
 *
 *  **Fail closed.** When the block cannot be delimited the answer is `false` —
 *  do not rewrite. A blanket rewrite from a marker to the end of the file would
 *  delete the entries, and a log is the one file in this wiki whose whole value
 *  is that it was not rewritten. */
export function needsLogHeaderMigration(
  content: string | null,
  lang: string,
  commandName: string
): boolean {
  if (!content) return false;
  if (isOldFormatLogHeader(content, lang)) return true;
  const block = headerBlockOf(content);
  if (!block) return false;
  return content.slice(block.start, block.end) !== buildLogHeader(lang, commandName);
}

/** Locate the plugin's own header block, or `null` if it cannot be delimited.
 *
 *  Two conditions, both required, both there to protect the entries:
 *  - the marker must sit at the head of the file (only whitespace before it),
 *    because a marker quoted inside an entry body is not this file's header;
 *  - the closing rule must exist, because without it the block has no end. */
function headerBlockOf(content: string): { start: number; end: number } | null {
  const start = content.indexOf(HEADER_MARKER_START);
  if (start < 0) return null;
  if (content.slice(0, start).trim() !== '') return null;
  const terminator = content.indexOf(HEADER_TERMINATOR, start);
  if (terminator < 0) return null;
  return { start, end: terminator + HEADER_TERMINATOR.length };
}

/** Non-destructive migration: bring the header up to date and touch nothing
 *  else. All `## [date time]` entries are preserved byte-for-byte.
 *
 *  Two paths:
 *  - **A delimited header block exists** (#876): replace exactly that block.
 *    This is what refreshes a stale command name in a file that is already in
 *    the new format.
 *  - **Legacy single-line header**: drop the H1, prepend the new header. This is
 *    the v1.22.2 behaviour, unchanged.
 *
 *  Idempotent on already-current content.
 *
 *  `commandName` is the registered command name, for the same reason it is
 *  required in `buildLogHeader`. */
export function migrateLogHeader(
  content: string | null,
  lang: string,
  commandName: string
): string | null {
  if (!content) return content;
  if (!needsLogHeaderMigration(content, lang, commandName)) return content;

  // A delimited block is the normal case for anything already in the new
  // format: replace it in place, so the bytes on either side are untouched by
  // construction rather than by a cut that has to be correct.
  const block = headerBlockOf(content);
  const newHeader = buildLogHeader(lang, commandName);
  if (block) {
    return content.slice(0, block.start) + newHeader + content.slice(block.end);
  }

  // Legacy format: the H1 is the first line. Drop it + the immediate blank
  // line (if any), then prepend the new header.
  const lines = content.split('\n');
  let cutIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('# ')) { cutIdx = i; break; }
  }
  // Skip the H1 line and any blank lines immediately following
  while (cutIdx + 1 < lines.length && lines[cutIdx + 1].trim() === '') {
    cutIdx++;
  }
  cutIdx++; // cut AFTER the trailing blank line
  const tail = lines.slice(cutIdx).join('\n');
  return newHeader + tail;
}
