// page-factory/merge-triage.ts — Issue #216 merge triage: ask the LLM whether
// the new entity/concept info should be merged, skipped, appended as
// complementary content, or treated as contradictory. Also builds the
// compact `{{new_info}}` payload the triage prompt consumes.
//
// Extracted from the original page-factory.ts god-class so the LLM triage
// validation rules (defensive shape checks on `strategy` / `items`) are
// independently testable.
//
// Behavior (v1.24.1 Phase 2 refactor — preserved verbatim):
//   - classifyMergeNeed renders the merge analysis prompt with the localized
//     section labels, calls the LLM, parses JSON, and validates the strategy
//     string and complementary-item shape. Any validation failure throws
//     so the caller can fall back to the default merge path.
//   - buildNewInfoSummary mirrors the fields the full merge prompt uses but
//     kept tight to control classify-token cost.

import { TFile } from 'obsidian';
import type { EntityInfo, ConceptInfo, SourceContext } from '../../types';
import { slugKeys } from '../../core/slug';
import { PROMPTS } from '../../prompts';
import { parseJsonResponse } from '../../core/json';
import { TOKENS_MERGE_TRIAGE } from '../../constants';
import { resolveModelForTask } from '../../core/model-resolver';
import { getSectionLabels, applySectionLabels } from '../system-prompts';
import { firstQuotesForPrompt } from './contextualize';
import { renderNoteExcerptBlock } from './note-window';
import { renderTemplate } from '../../core/template-renderer';
import { MergeTriageSchema, type MergeTriage } from '../../llm-sdk/output-schemas';
import { applyContradictionGates, type DemotedContradiction, type SourceStanceContext } from './contradiction-gates';
import type { ComplementaryItem } from './merge-shared';

// Re-exported so the call sites that read it from this module keep working.
export type { ComplementaryItem };
export type { DemotedContradiction } from './contradiction-gates';

/** Strategy selected by the LLM for handling new information vs. an existing page. */
export type MergeStrategy = 'merge' | 'skip' | 'complementary' | 'contradictory';


/**
 * Single source of truth for the runtime list of valid strategies. Derived
 * from the `MergeStrategy` union literal so adding a new strategy to the
 * type forces a runtime check update at compile time.
 */
export const MERGE_STRATEGIES = ['merge', 'skip', 'complementary', 'contradictory'] as const satisfies readonly MergeStrategy[];

/** Result of classifyMergeNeed. */
export interface MergeTriageResult {
  strategy: MergeStrategy;
  items: ComplementaryItem[];
  reason: string;
  /** `contradictory` items the gates turned into plain complementary facts. */
  demoted: DemotedContradiction[];
}

/**
 * Minimal context contract required by `classifyMergeNeed`. Production
 * callers pass the real EngineContext; tests inject a mock with the same
 * shape. `getClient()` returns `LLMClient | null` so the typed-output
 * path (`createMessageWithOutput`) is available when the client
 * implements it (Phase B).
 */
export interface MergeTriageContext extends SourceStanceContext {
  buildSystemPrompt(mode: 'full' | 'compact' | 'merge'): Promise<string>;
}

/**
 * Ask the LLM whether the new info should be merged, skipped, appended as
 * complementary content, or treated as contradictory.
 *
 * Throws on invalid response shapes (unknown strategy, complementary with
 * empty items, missing content / target_section) so the caller can fall
 * back to the default merge path.
 */
export async function classifyMergeNeed(
  ctx: MergeTriageContext,
  info: EntityInfo | ConceptInfo,
  pageType: 'entity' | 'concept',
  sourceFile: TFile | { path: string; basename: string },
  existingContent: string,
  sourceContext?: SourceContext,
  sourceExcerpt?: string,
): Promise<MergeTriageResult> {
  const client = ctx.getClient();
  if (!client) throw new Error('LLM client not initialized');

  // Tier-2: include the localized section labels so the LLM returns
  // target_section values that match the existing page's headers
  // (matters for i18n wikis where labels are translated).
  const labels = getSectionLabels(ctx.settings);
  const sectionLabelsList = Object.values(labels).join('\n- ');

  const triagePrompt = renderTemplate(PROMPTS.mergeAnalysis, {
    page_name: info.name,
    page_type: pageType,
    existing_content: existingContent,
    new_info: buildNewInfoSummary(info, sourceFile),
    source_excerpt: renderNoteExcerptBlock(sourceExcerpt ?? '', info.name),
    source_context: renderSourceContextBlock(sourceContext),
    source_ownership_rule: renderSourceOwnershipRule(sourceContext),
    section_labels: `- ${sectionLabelsList}`,
  });

  // Issue #328 Phase 1 follow-up: removed appendTagVocabularyToPrompt wrapper
  // because the system layer now always injects the same section once.
  const finalPrompt = applySectionLabels(triagePrompt, ctx.settings);
  const systemPrompt = await ctx.buildSystemPrompt('merge');
  const model = resolveModelForTask(ctx.settings, 'ingest');
  const disableThinking = ctx.settings.disableThinking;

  // v1.26.3 PATCH Phase B (Issue #443): typed-output path. Prefer
  // `result.output` when the client implements createMessageWithOutput
  // and the Tier 0 (json_schema) parse succeeds; fall back to
  // parseJsonResponse(text) otherwise. The strategy/items validation
  // below is unchanged — it runs on whatever shape we recovered.
  let parsed: MergeTriage | null;
  if (client.createMessageWithOutput) {
    const result = await client.createMessageWithOutput<MergeTriage>({
      task: 'merge-triage',
      model,
      max_tokens: TOKENS_MERGE_TRIAGE,
      system: systemPrompt,
      messages: [{ role: 'user', content: finalPrompt }],
      response_format: { type: 'json_object', schema: MergeTriageSchema },
      ...(disableThinking ? { enableThinking: false } : {}),
    });
    parsed = result.output && typeof result.output === 'object'
      ? result.output
      : await parseJsonResponse(result.text) as MergeTriage | null;
  } else {
    const response = await client.createMessage({
      task: 'merge-triage',
      model,
      max_tokens: TOKENS_MERGE_TRIAGE,
      system: systemPrompt,
      messages: [{ role: 'user', content: finalPrompt }],
      response_format: { type: 'json_object' },
      ...(disableThinking ? { enableThinking: false } : {}),
    });
    parsed = await parseJsonResponse(response) as MergeTriage | null;
  }

  if (!parsed) throw new Error('merge triage: empty response');
  if (!(MERGE_STRATEGIES as readonly string[]).includes(parsed.strategy ?? '')) {
    throw new Error(`merge triage: invalid strategy "${parsed.strategy}"`);
  }
  const strategy = parsed.strategy as MergeStrategy;
  const reason = typeof parsed.reason === 'string' ? parsed.reason : '';

  // Items are populated only for the complementary path. Validate the
  // shape defensively — invalid items throw so the caller falls back.
  const items: ComplementaryItem[] = [];
  let demoted: DemotedContradiction[] = [];
  if (strategy === 'complementary') {
    const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
    if (rawItems.length === 0) {
      // Defensive: classify said complementary but no items — caller falls back.
      throw new Error('merge triage: complementary strategy with empty items');
    }
    for (const item of rawItems) {
      if (
        typeof item?.content !== 'string' || item.content.trim() === '' ||
        typeof item?.target_section !== 'string' || item.target_section.trim() === ''
      ) {
        throw new Error('merge triage: invalid complementary item');
      }
      // Unknown/missing kinds default to 'complementary' so older or
      // sloppier model outputs keep today's behavior.
      const kind: ComplementaryItem['kind'] = item.kind === 'contradictory' ? 'contradictory' : 'complementary';
      const statement = typeof item.existing_statement === 'string' ? item.existing_statement.trim() : '';
      items.push({
        kind,
        content: item.content,
        target_section: item.target_section,
        reason: typeof item.reason === 'string' ? item.reason : undefined,
        ...(kind === 'contradictory' ? { existing_statement: statement } : {}),
      });
    }
    // Both gates, in order: the quoted page sentence has to be on the page,
    // and the source has to hold the claim rather than report it.
    ({ demoted } = await applyContradictionGates(items, existingContent, ctx, {
      pageName: info.name,
      sourceExcerpt: sourceExcerpt ?? '',
      sourceContext,
    }));
  }

  return { strategy, items, reason, demoted };
}

/**
 * Issue #312 part 1 — the source-level summary, rendered into the triage
 * prompt. Empty when no context is available, which leaves the rendered prompt
 * byte-identical to the previous one (the placeholder carries its own leading
 * newlines so nothing drifts).
 *
 * The label is `Source summary:` and not `Summary:` on purpose: `{{new_info}}`
 * already carries `Summary:` for the extracted ITEM. Two lines with the same
 * label and different scopes would be worse than the missing field.
 *
 * The source name is not repeated here — `buildNewInfoSummary` already writes
 * `Source: <basename>` into `{{new_info}}`.
 */
function renderSourceContextBlock(sourceContext?: SourceContext): string {
  const summary = sourceContext?.summary?.trim();
  if (!summary) return '';
  return `\n\n**What the source document as a whole is about:**\nSource summary: ${summary}`;
}

/**
 * Issue #312 part 1 — the question the prompt never asked. Adding the summary
 * alone supplies context to a prompt whose four strategies are all keyed to
 * novelty; without this rule the model has the fact and no reason to use it.
 *
 * Rendered only alongside the summary: asking whether a source is the page's
 * subject, without saying what the source is about, is not answerable.
 */
function renderSourceOwnershipRule(sourceContext?: SourceContext): string {
  if (!renderSourceContextBlock(sourceContext)) return '';
  return '\n- Consider whether this source is primarily ABOUT this page or only mentions it in passing. A source whose subject IS this page carries more weight for the page\'s core description than an incidental mention — prefer "merge" over "skip" for it.';
}

/**
 * Issue #312 part 2 — deterministic ownership test, no LLM involved.
 *
 * True when the source carries the page's own lemma: its file basename, its
 * analyzer title, or one of its curated note aliases slug-matches the page
 * name or one of the page's aliases. That is the case where the source IS the
 * page's subject rather than a document that mentions it in passing.
 *
 * Fires only when `sourceContext` is present, i.e. on the ingest path. Callers
 * without one (lint) keep their previous behaviour exactly.
 *
 * On a corpus whose notes are not lemma-shaped — no note titled like the page
 * it is about — this never matches and the merge path is unchanged. Inert
 * rather than harmful is the intended failure mode.
 */
export function isSourceOwnPageLemma(params: {
  pageName: string;
  pageAliases?: readonly string[];
  sourceBasename: string;
  sourceContext?: SourceContext;
}): boolean {
  const { pageName, pageAliases = [], sourceBasename, sourceContext } = params;
  if (!sourceContext) return false;

  const pageKeys = slugKeys(pageName, pageAliases);
  if (pageKeys.size === 0) return false;

  const sourceKeys = slugKeys(sourceBasename, [
    sourceContext.sourceTitle,
    ...(sourceContext.noteAliases ?? []),
  ]);

  for (const key of sourceKeys) {
    if (pageKeys.has(key)) return true;
  }
  return false;
}

/**
 * v1.24.0 #216 — build the compact `{{new_info}}` payload for the triage
 * prompt. Mirrors the fields the full merge prompt uses, but kept tight to
 * control classify-token cost.
 */
export function buildNewInfoSummary(
  info: EntityInfo | ConceptInfo,
  sourceFile: TFile | { path: string; basename: string },
): string {
  const parts: string[] = [];
  parts.push(`Source: ${sourceFile.basename}`);
  parts.push(`Summary: ${info.summary}`);
  if (info.related_entities?.length) {
    parts.push(`Related entities: ${info.related_entities.join(', ')}`);
  }
  if (info.related_concepts?.length) {
    parts.push(`Related concepts: ${info.related_concepts.join(', ')}`);
  }
  const quotes = firstQuotesForPrompt(info);
  if (quotes) parts.push(`Key details: ${quotes}`);
  return parts.join('\n');
}
