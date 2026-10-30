// page-factory/complementary-appends.ts — Tier-2 (#216) per-section appends.
//
// Extracted from the original page-factory.ts god-class. This is the largest
// of the page-factory split modules: 7 distinct concerns wired together by
// `applyComplementaryAppends`. The orchestrator composes pure helpers
// (escapeRegExp / spliceAfterSection / findSectionInBody) and the side-
// effecting ones (resolveSectionAnchor / callPerSectionAppend /
// makeFallbackNewInfoSection).
//
// Behavior (v1.24.1 Phase 2 refactor — preserved verbatim):
//   - 4-layer section anchor fallback: exact → Levenshtein snap → body scan
//     (snap + exact + Levenshtein) → null (caller falls back to per-section
//     LLM or New Information section).
//   - Per-section LLM call: returns either appended paragraph(s) or
//     "NO_NEW_CONTENT" verbatim (whitespace-trimmed; empty → NO_NEW_CONTENT).
//   - List-vs-paragraph separator chosen by isListSection() on the section
//     content (#185 follow-up: list sections get single \n, paragraphs get
//     \n\n). spliceAfterSection normalizes trailing whitespace on the
//     prefix to avoid the "extra blank line" bug.
//   - Failed groups (anchor not found + LLM gave NO_NEW_CONTENT) coalesce
//     into a single "## New Information ({{source}})" section appended at EOF.

import { TFile } from 'obsidian';
import type { EntityInfo, ConceptInfo, LLMWikiSettings, LLMClient } from '../../types';
import { TOKENS_COMPLEMENTARY_APPEND } from '../../constants';
import { resolveModelForTask } from '../../core/model-resolver';
import { stripThinkingBlocks } from '../../core/markdown';
import { snapHeaderToCanonical } from '../../core/section-header-canonicalizer';
import { getSectionLabels } from '../system-prompts';
import { escapeRegex } from '../lint/utils';
import { isListSection } from './contextualize';
import type { ComplementaryItem } from './merge-triage';

// Re-export so existing imports of `ComplementaryItem` from this module keep
// working. Single source of truth is merge-triage.ts.
export type { ComplementaryItem } from './merge-triage';

/** Result of `findSectionInBody`: where to insert appended content. */
export interface SectionAnchor {
  headingText: string;
  /** The body content below the heading (up to the next ## or EOF), trimmed. */
  content: string;
  /** Insertion offset in the original body — `body.slice(0, anchorEnd)` is the prefix. */
  anchorEnd: number;
}

/**
 * Minimal context contract required by `applyComplementaryAppends` and its
 * helpers. Production callers pass the real EngineContext.
 */
export interface ComplementaryContext {
  settings: LLMWikiSettings;
  getClient(): LLMClient | null;
  buildSystemPrompt(mode: 'full' | 'compact' | 'merge'): Promise<string>;
}

/**
 * Escape regex special characters in a string.
 * Pure function — independently testable.
 *
 * v1.27.x audit (Phase 3 T1-1): canonical copy lives in `../lint/utils`
 * (`escapeRegex`). Re-exported under the legacy name so the existing
 * public API and its 13 test refs keep working without an import churn.
 */
export { escapeRegex as escapeRegExp };

/**
 * Find a `## headingName` section in `body`. Returns its content (trimmed
 * at end) and the insertion offset (end of section content, beginning of
 * next ## or EOF).
 */
export function findSectionInBody(
  headingText: string,
  body: string,
): SectionAnchor | null {
  // No /m flag — see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
  const nextLinePattern = new RegExp(
    `(?:^|\\n)##\\s*${escapeRegex(headingText)}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`,
  );
  const m = nextLinePattern.exec(body);
  if (!m) return null;

  const content = m[1].trimEnd();
  const anchorEnd = m.index + m[0].length;
  return { headingText, content, anchorEnd };
}

/**
 * Resolve the section anchor for `targetSection` using a 4-layer fallback:
 *   Layer 1 — exact match against canonical labels
 *   Layer 2 — Levenshtein snap (snapHeaderToCanonical, 3-edit window)
 *   Layer 3 — body scan: for each `##` heading, check canonical snap → exact
 *             → Levenshtein. This handles i18n cases where the body uses
 *             localized headings not in the canonical label set.
 *   Layer 4 — all failed; caller (applyComplementaryAppends) lets the
 *             per-section LLM decide.
 */
export function resolveSectionAnchor(
  targetSection: string,
  body: string,
  canonicalLabels: string[],
): SectionAnchor | null {
  if (!body) return null;

  // Layer 1: exact match against canonical labels
  const exactHeading = canonicalLabels.find(hl => hl === targetSection);
  if (exactHeading !== undefined) {
    const pos = findSectionInBody(exactHeading, body);
    if (pos !== null) return pos;
  }

  // Layer 2: Levenshtein snap — snap target to a canonical label
  const snapped = snapHeaderToCanonical(targetSection, canonicalLabels);
  if (snapped !== null && snapped !== targetSection) {
    const pos = findSectionInBody(snapped, body);
    if (pos !== null) return pos;
  }

  // Layer 3: Body scan
  const headingPattern = /^##\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = headingPattern.exec(body)) !== null) {
    const hd = match[1].trim();

    // a) Canonical snap
    const headSnapped = snapHeaderToCanonical(hd, canonicalLabels);
    if (headSnapped !== null && headSnapped === targetSection) {
      const pos = findSectionInBody(hd, body);
      if (pos !== null) return { ...pos, headingText: headSnapped };
    }

    // b) Exact match
    if (hd === targetSection) {
      const pos = findSectionInBody(hd, body);
      if (pos !== null) return pos;
    }

    // c) Levenshtein
    if (
      hd.length > 0 &&
      targetSection.length > 0 &&
      Math.abs(hd.length - targetSection.length) <= 3 &&
      snapHeaderToCanonical(hd, [targetSection]) !== null
    ) {
      const pos = findSectionInBody(hd, body);
      if (pos !== null) return pos;
    }
  }

  // Layer 4: not found
  return null;
}

/**
 * Splice `appendText` into `body` immediately after `anchorEnd`. The
 * separator (single \n vs blank line) is decided by `sectionIsList`:
 *   - list section: single \n (no blank line splitting the visual list)
 *   - paragraph section: \n\n (blank line so the appended text reads as a
 *     distinct paragraph)
 *
 * The prefix is `trimEnd()`-ed so trailing whitespace on the prefix does
 * not double up with the separator — this is the fix for the
 * extra-blank-line bug (#185 follow-up).
 */
export function spliceAfterSection(
  body: string,
  anchorEnd: number,
  appendText: string,
  sectionIsList: boolean,
): string {
  const separator = sectionIsList ? '\n' : '\n\n';
  const prefix = body.slice(0, anchorEnd).trimEnd();
  const suffix = body.slice(anchorEnd);
  return prefix + separator + appendText + suffix;
}

/**
 * Build a "## {{newInformationLabel}} ({{sourceBasename}})" section for failed
 * groups whose section could not be resolved or the per-section LLM returned
 * NO_NEW_CONTENT. Collects all items from all failed groups. The label is the
 * locale's localized `new_information` value, so non-English vaults emit a
 * canonical header on first write.
 */
export function makeFallbackNewInfoSection(
  failedGroups: string[],
  allItems: ComplementaryItem[],
  sourceBasename: string,
  newInformationLabel: string,
): string {
  if (failedGroups.length === 0) return '';
  // Map ALL items — the `failedGroups` parameter tracks which target_section
  // values could not be resolved; we emit all items from those groups for
  // the fallback New Information section.
  const failedSet = new Set(failedGroups);
  const failedItems = allItems.filter(i => failedSet.has(i.target_section));
  const body = failedItems.length > 0
    ? failedItems.map(i => `- ${i.content}${i.reason ? ` (${i.reason})` : ''}`).join('\n')
    : `- New information from ${sourceBasename}`;
  return `## ${newInformationLabel} (${sourceBasename})\n${body}`;
}

/**
 * Call the per-section LLM. Input: existing-section content (may be null
 * if anchor not found — LLM gets null and treats as unknown) + the
 * complementary items targeting this section. Returns appended
 * paragraph(s) or the literal string "NO_NEW_CONTENT".
 */
export async function callPerSectionAppend(
  ctx: ComplementaryContext,
  sectionContent: SectionAnchor | null,
  items: Array<{ content: string; reason?: string }>,
  pageName: string,
  sourceBasename: string,
  client: LLMClient,
): Promise<string> {
  const newFacts = items.map(i => `- ${i.content}${i.reason ? ` (${i.reason})` : ''}`).join('\n');
  const sectionTitle = sectionContent?.headingText ?? '[[unknown section]]';
  const existingSection = sectionContent?.content ?? '[[section not found in body]]';

  const appendPrompt = [
    `You are appending new facts to a single section of a wiki page.`,
    ``,
    `**Page Name:** ${pageName}`,
    `**Section Title:** ${sectionTitle}`,
    `**Source:** ${sourceBasename}`,
    ``,
    `**Existing section content (DO NOT DELETE OR REWRITE):**`,
    existingSection,
    ``,
    `**New facts to append at the end of this section:**`,
    newFacts,
    ``,
    `**Rules:**`,
    `- Output ONLY the new paragraphs to append (1-3 lines of markdown).`,
    `- Do NOT include the section heading or any of the existing content.`,
    `- Match the tone and style of the existing section.`,
    `- If the new facts are already present in the existing section content, output exactly "NO_NEW_CONTENT".`,
    `- Do NOT delete or modify any existing content.`,
  ].join('\n');

  try {
    const response = await client.createMessage({
      task: 'complementary',
      model: resolveModelForTask(ctx.settings, 'ingest'),
      max_tokens: TOKENS_COMPLEMENTARY_APPEND,
      system: await ctx.buildSystemPrompt('merge'),
      messages: [{ role: 'user', content: appendPrompt }],
      // Per-call policy (mirrors welcome-translate, #506): appending a
      // formatted fragment is a mechanical text task — reasoning here only
      // adds latency, and on backends that emit visible <think> it used to
      // leak verbatim into the wiki body (E2E 2026-08-25). Pinned
      // unconditionally, not gated on settings.disableThinking.
      enableThinking: false as const,
      // Issue #916, review follow-up: this call site treats an empty reply as
      // NO_NEW_CONTENT, which is a normal outcome — the prompt even asks for
      // it. Without the opt-out the new empty-answer guard would throw into
      // the catch below and log a warning per section on a healthy run.
      allowEmptyResponse: true,
    });
    // This is the one raw-prose writer that does NOT go through
    // cleanMarkdownResponse (the fragment must not lose its head the way a
    // full page would), so the thinking-block strip is applied directly —
    // single home in core/markdown. Also makes a think-wrapped
    // NO_NEW_CONTENT short-circuit correctly instead of splicing the block.
    const cleaned = stripThinkingBlocks(response ?? '').trim();
    // Empty response (weak model or no new info to add) is equivalent to
    // NO_NEW_CONTENT — falling through here would let spliceAfterSection
    // inject a stray blank line with no content. Short-circuit so the
    // caller's existing NO_NEW_CONTENT branch handles it.
    if (cleaned === '' || cleaned === 'NO_NEW_CONTENT') return 'NO_NEW_CONTENT';
    // Verbatim: the splice site picks the section-break separator (single \n
    // for lists, blank line for paragraphs).
    return cleaned;
  } catch {
    console.warn('[mergePage] per-section append failed — falling back to New Information section');
    return 'NO_NEW_CONTENT';
  }
}

/**
 * Orchestrator. Apply complementary items to the existing body by:
 *   1. Group items by target_section.
 *   2. For each group, resolve anchor → call per-section LLM → splice
 *      result into the body OR mark as failed.
 *   3. Coalesce all failed groups into a "## New Information ({{source}})"
 *      fallback section at EOF.
 *
 * Returns the original body unchanged when:
 *   - items is empty
 *   - no LLM client is configured
 *   - every group ended in NO_NEW_CONTENT and there were no failed groups
 *     (no-op to avoid an empty New Information section).
 */
export async function applyComplementaryAppends(
  ctx: ComplementaryContext,
  items: ComplementaryItem[],
  existingBody: string,
  info: EntityInfo | ConceptInfo,
  sourceFile: TFile | { path: string; basename: string },
): Promise<string> {
  if (items.length === 0) return existingBody;

  const client = ctx.getClient();
  if (!client) return existingBody;

  const labels = getSectionLabels(ctx.settings);
  const canonicalLabels = Object.values(labels);

  // 1. Group items by target_section.
  const groups = new Map<string, ComplementaryItem[]>();
  for (const item of items) {
    const existing = groups.get(item.target_section) ?? [];
    existing.push(item);
    groups.set(item.target_section, existing);
  }

  // 2. For each group, resolve anchor → call per-section LLM.
  let resultBody = existingBody;
  const failedGroups: string[] = [];

  for (const [targetSection, sectionItems] of groups) {
    const sectionContent = resolveSectionAnchor(targetSection, resultBody, canonicalLabels);

    const appendContent = await callPerSectionAppend(
      ctx,
      sectionContent,
      sectionItems,
      info.name,
      sourceFile.basename,
      client,
    );

    if (appendContent === 'NO_NEW_CONTENT') {
      if (sectionContent !== null) {
        // Per-section LLM judged that the new info is already present
        // in the section body. Skip this group — do NOT create a New
        // Information fallback for it, since the info exists.
        continue;
      }
      // Anchor not found AND LLM couldn't place it: fall back to
      // "## New Information" section at EOF.
      failedGroups.push(targetSection);
      continue;
    }

    if (sectionContent !== null) {
      const sectionIsList = isListSection(sectionContent.content);
      resultBody = spliceAfterSection(
        resultBody,
        sectionContent.anchorEnd,
        appendContent,
        sectionIsList,
      );
    } else {
      // Anchor not found and append succeeded (unusual): treat as fallback.
      failedGroups.push(targetSection);
    }
  }

  // 3. Handle failed groups.
  if (failedGroups.length > 0) {
    const newInfoSection = makeFallbackNewInfoSection(
      failedGroups,
      items,
      sourceFile.basename,
      labels.new_information,
    );
    resultBody = `${resultBody}\n\n${newInfoSection}`;
  }

  return resultBody !== existingBody ? resultBody : existingBody;
}