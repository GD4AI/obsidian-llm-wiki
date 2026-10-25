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

/** Decide whether migration is needed: file present AND old format. */
export function needsLogHeaderMigration(content: string | null, lang: string): boolean {
  if (!content) return false;
  return isOldFormatLogHeader(content, lang);
}

/** Non-destructive migration: replace the legacy single-line H1 with the
 *  new multi-line header from buildLogHeader, preserving all subsequent
 *  ## [date time] entries. Idempotent on already-migrated content.
 *
 *  `commandName` is the registered command name, for the same reason it is
 *  required in `buildLogHeader`. */
export function migrateLogHeader(
  content: string | null,
  lang: string,
  commandName: string
): string | null {
  if (!content) return content;
  if (!needsLogHeaderMigration(content, lang)) return content;
  // The H1 is the first line. Drop it + the immediate blank line (if any),
  // then prepend the new header.
  //
  // Issue #888: the cut below removes ONE line, and that line is the H1. The
  // precondition is therefore "the file starts with an H1", and it is checked
  // rather than assumed. Without the check, a file whose first line is an entry
  // leaves `cutIdx` at 0 and the loop advances past line 0 — deleting an entry,
  // silently, because `AutoMaintain` writes the result back with no notice.
  // A cut whose precondition does not hold must not run.
  const lines = content.split('\n');
  let cutIdx = 0;
  let foundH1 = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('# ')) { cutIdx = i; foundH1 = true; break; }
    // Leading blank lines are allowed; anything else means this is not the
    // legacy shape, and there is nothing here for this branch to remove.
    if (lines[i].trim() !== '') break;
  }
  if (!foundH1) return content;
  // Skip the H1 line and any blank lines immediately following
  while (cutIdx + 1 < lines.length && lines[cutIdx + 1].trim() === '') {
    cutIdx++;
  }
  cutIdx++; // cut AFTER the trailing blank line
  const tail = lines.slice(cutIdx).join('\n');
  const newHeader = buildLogHeader(lang, commandName);
  return newHeader + tail;
}
