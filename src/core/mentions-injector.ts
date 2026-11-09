// Issue #244 — Programmatic Mentions writes (injector)
//
// Replaces any LLM-written `## Mentions in Source` section in the page body
// with the deterministic one produced by `formatMentionsSection`.
//
// A reviewed page (`reviewed: true` in frontmatter) is protected from
// overwrite: callers pass `pageIsReviewed` and the injector returns the body
// untouched. This replaces the earlier `<!-- reviewed: keep -->` body marker
// (v1.24.0, #244), which lived in the body — invisible in the Properties panel
// and fragile under Markdown linters. Frontmatter `reviewed: true` is the
// single, linter-stable, Properties-visible protection mechanism.

import type { MentionWithProvenance } from '../types';
import { formatMentionsSection } from './mentions-formatter';
import { escapeRegex } from './regex-escape';

export interface InjectMentionsOptions {
  /** Section header label (default: caller must pass). */
  sectionLabel: string;
  /** Pass-through to the formatter. */
  conversationMode?: boolean;
  /** Pass-through to the formatter. */
  conversationLabel?: string;
  /**
   * Pass-through to the formatter — override of the 500-char total budget.
   * Callers whose page's payload IS the quotes (the #496 source-page route)
   * raise it; every other caller keeps the default.
   */
  maxChars?: number;
  /**
   * When true, the page is reviewed (`reviewed: true` frontmatter) and its
   * existing Mentions section must not be overwritten — the injector returns
   * `body` unchanged. Set by the reviewed-page write path.
   */
  pageIsReviewed?: boolean;
}

/**
 * Inject the programmatically-formatted Mentions section into `body`.
 *
 * Behavior:
 *  - If `options.pageIsReviewed` is set, body is returned unchanged (the
 *    page is `reviewed: true` and its Mentions section is protected).
 *  - If body has an existing `## <sectionLabel>` block (LLM-written or
 *    otherwise), that block is replaced with the new formatMentionsSection output.
 *  - Otherwise the section is appended at the end of the body.
 *  - If `mentions` is empty AND no existing section exists, body is returned unchanged.
 *  - If `mentions` is empty AND an existing section exists, the existing section
 *    is replaced with an empty header-only section (callers that want the
 *    section removed entirely should detect and strip it themselves).
 *
 * @param body       The full page body markdown (frontmatter already stripped by caller).
 * @param mentions   Structured `MentionWithProvenance[]` (preferred) or legacy `string[]`.
 * @param sourcePath Original vault-note path; used only by the legacy form.
 * @param options    Injector options — currently just `sectionLabel`.
 */
export function injectMentionsSection(
  body: string,
  mentions: MentionWithProvenance[] | string[],
  sourcePath: string,
  options: InjectMentionsOptions,
): string {
  if (!options.sectionLabel || !options.sectionLabel.trim()) return body;

  // Reviewed page: its Mentions section is protected — preserve as-is.
  if (options.pageIsReviewed) return body;

  // Generate the new section (may be empty if mentions is empty).
  // Conversation mode short-circuits the empty-mentions check: a single
  // citation line is emitted regardless of the mentions array content.
  const newSection = formatMentionsSection(
    mentions,
    sourcePath,
    options.sectionLabel,
    {
      conversationMode: options.conversationMode,
      conversationLabel: options.conversationLabel,
      maxChars: options.maxChars,
    },
  );

  // Strip existing Mentions section (LLM-written or previous run) and
  // replace with the new one — or append if no existing section.
  // Case-insensitive (R5): localized labels in any case must match.
  const headerRe = new RegExp(`^##\\s+${escapeRegex(options.sectionLabel)}\\s*$`, 'mi');
  const match = body.match(headerRe);

  let stripped: string;
  if (match && match.index !== undefined) {
    // Find the section's body — from the header line to the next ## header or EOF.
    const headerIdx = match.index;
    const afterHeader = headerIdx + match[0].length;
    const rest = body.substring(afterHeader);
    // Section ends at the next `## ` heading or EOF. Skip any leading
    // blank lines after the header so the section's body starts on the first
    // non-blank character.
    const afterBlankStripped = rest.replace(/^\s*\n/, '');
    const nextHeading = afterBlankStripped.search(/^##\s/m);
    const sectionEndInRest = nextHeading === -1 ? afterBlankStripped.length : nextHeading;
    // Keep everything AFTER the section block.
    const afterSection = afterBlankStripped.substring(sectionEndInRest).replace(/^\s*\n/, '');
    // Strip the section from `body` and any trailing blank lines immediately
    // before the section, so we don't accumulate blank gaps.
    const before = body.substring(0, headerIdx).replace(/\n+\s*$/, '');
    stripped = afterSection.length > 0
      ? (before.length > 0 ? `${before}\n\n${afterSection}` : afterSection)
      : before;
  } else {
    stripped = body.replace(/\s+$/, '');
  }

  if (!newSection) return stripped;

  // Append the new section.
  return stripped ? `${stripped}\n\n${newSection}` : newSection;
}
