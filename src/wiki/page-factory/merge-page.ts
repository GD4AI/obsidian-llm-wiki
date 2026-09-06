// page-factory/merge-page.ts — merge new info into an EXISTING page.
//
// Extracted from the original page-factory.ts god-class. Contains the two
// merge paths:
//
//   - mergePage: the main path. Runs triage (skip / complementary / merge /
//     contradictory), then either preserves the body (skip), appends per-
//     section (complementary), or rewrites the body via the LLM
//     (merge / contradictory).
//   - appendToReviewedPage: a stripped-down variant for `reviewed: true`
//     pages. The page's existing content is locked; we only ask the LLM
//     to draft a small new block.
//
// Both share Issue #244 programmatic Mentions injection via
// `assembleFinalContent` (mentions-integration.ts) so conversation-source
// citation and the #267 union logic apply uniformly.
//
// Behavior (v1.24.1 Phase 2 refactor — preserved verbatim):
//   - mergePage's triage failure is non-fatal — it falls through to the
//     merge path (backward compatible). The actual `createOrUpdateFile`
//     write happens INSIDE the try so a triage failure cannot be
//     misclassified as a write failure (and trigger a double-write).
//   - The complementary-path NO_NEW_CONTENT fallback: if every per-section
//     LLM call returned NO_NEW_CONTENT, fall through to the merge path
//     so the new info isn't silently lost.
//   - appendToReviewedPage: writes the new block + locks the existing
//     Mentions section (pageIsReviewed: true).

import { TFile } from 'obsidian';
import type { EntityInfo, ConceptInfo, LLMWikiSettings, LLMClient, SourceContext, ContradictionInfo } from '../../types';
import {
  TOKENS_PAGE_GENERATION,
  TOKENS_APPEND_REVIEWED,
} from '../../constants';
import { PROMPTS } from '../../prompts';
import { resolveModelForTask } from '../../core/model-resolver';
import { cleanMarkdownResponse } from '../../core/markdown';
import {
  canonicalizeSectionHeaders,
  stripUnknownSections,
} from '../../core/section-header-canonicalizer';
import { guardBodyRewrite } from '../../core/paragraph-provenance';
import { applyRelatedLinks } from './related-links';
import { mergeFrontmatter, parseFrontmatter, extractBody } from '../../core/frontmatter';
import { incomingTypeTag } from '../../core/tag-vocab';
import { collectActiveVocabulary } from '../../core/domain-axis';
import { appendContradictedByMarker } from '../../core/contradicted-marker';
import { buildContradictionRecord } from '../../core/contradiction-record';
import { describeDemotion } from './contradiction-gates';
import { isStubPage, stripStubMarker } from './stub-page';
import { injectMentionsSection } from '../../core/mentions-injector';
import { renderTemplate } from '../../core/template-renderer';
import { applySectionLabels, getSectionLabels } from '../system-prompts';
import { UNIVERSAL_LINK_CONSTRAINTS } from '../prompts/constraints';
import { classifyMergeNeed, isSourceOwnPageLemma, type ComplementaryItem } from './merge-triage';
import { assembleFinalContent } from './mentions-integration';
import { applyComplementaryAppends } from './complementary-appends';
import { firstQuotesForPrompt, isConversationSource, mergeError } from './contextualize';
import { buildNoteExcerpt, renderNoteExcerptBlock } from './note-window';
import { localDateStamp } from '../../core/format';

/**
 * Minimal context contract required by mergePage / appendToReviewedPage.
 * Production callers pass the real EngineContext.
 */
export interface MergeContext {
  app: unknown;
  settings: LLMWikiSettings;
  getClient(): LLMClient | null;
  buildSystemPrompt(mode: 'full' | 'compact' | 'merge'): Promise<string>;
  createOrUpdateFile(path: string, content: string): Promise<void>;
  tryReadFile(path: string): Promise<string | null>;
  /** Optional: receives each contradiction the triage lane records (see EngineContext). */
  onContradiction?(contradiction: ContradictionInfo): void;
}

/**
 * Issue #216 merge path: triage new info, then route to one of
 *   skip — preserve body, only re-merge frontmatter
 *   complementary — append per-section via the Tier-2 LLM calls
 *   merge / contradictory — rewrite the body via the main LLM call
 *
 * Returns the path that was written, or null on a hard failure (NO_NEW_CONTENT
 * is treated as success and returns the path unchanged).
 */
export async function mergePage(
  ctx: MergeContext,
  info: EntityInfo | ConceptInfo,
  pageType: 'entity' | 'concept',
  sourceFile: TFile | { path: string; basename: string },
  existingContent: string,
  extraPagePaths: string[],
  path: string,
  sourceSlug?: string,
  sourceContext?: SourceContext,
): Promise<string | null> {
  const client = ctx.getClient();
  if (!client) throw new Error('LLM client not initialized');

  try {
    // 0. Hoist frontmatter + body above triage so both skip and merge paths share them.
    const { frontmatter, body: existingBody } = mergeFrontmatter(
      existingContent,
      sourceSlug ? `sources/${sourceSlug}` : sourceFile.path,
      incomingTypeTag(ctx.settings, pageType, info.type, collectActiveVocabulary(ctx.app as never, ctx.settings)),
      info.domains, // domain axis stage 3 (#568): union the extraction's domain subset
    );

    // Issue #312 part 2 — deterministic, no LLM: is this source the page's own
    // subject? Compared against the page FILE name (the page's identity) plus
    // its curated aliases; slug comparison on both sides, so "Silent
    // Inflammation.md" matches the page "Silent-Inflammation".
    const pageBasename = path.split('/').pop()?.replace(/\.md$/i, '') ?? '';
    const existingFm = parseFrontmatter(existingContent);
    const existingAliases = existingFm?.aliases;
    const sourceOwnsPage = isSourceOwnPageLemma({
      pageName: pageBasename,
      pageAliases: Array.isArray(existingAliases) ? existingAliases : undefined,
      sourceBasename: sourceFile.basename,
      sourceContext,
    });

    // Note excerpt window — the merge payload was a constant (item summary +
    // two quotes) regardless of how much the note says about this page;
    // measured on a real ingest, 5 of 7 merges added nothing but links. Give
    // both merge consumers the note's own paragraphs about the page — and
    // the page whose lemma the note carries gets the whole note, because a
    // note about X is THE source for page X. Deterministic, bounded, and ''
    // (prompt-invariant) when the note never discusses the page in prose.
    const noteRaw = await ctx.tryReadFile(sourceFile.path);
    const noteExcerpt = noteRaw
      ? buildNoteExcerpt(extractBody(noteRaw), {
          pageName: pageBasename,
          aliases: [
            info.name,
            ...(info.aliases ?? []),
            ...(Array.isArray(existingAliases) ? existingAliases : []),
          ],
          fullNote: sourceOwnsPage,
        })
      : '';

    // S135: a stub (dissent-born or Fix-Dead-Links, both carry `stub: true`)
    // must never be skip-frozen — its whole contract is that the next source
    // treating the subject fills it. The triage sees a thin placeholder body
    // and can honestly judge a real source as "nothing new"; that judgement
    // is right about the body and wrong about the page. Same narrow shape as
    // the #312 override below: only `skip` is rerouted. A write that adds
    // content promotes the page: the marker is stripped below.
    const existingIsStub = isStubPage(existingFm);

    // 1. v1.24.0 #216 — classify-then-route triage.
    let shouldSkip = false;
    let complementaryBody: string | null = null;
    // v1.25.10 PATCH DocTpoint §4: track whether the rewrite path was
    // triggered by a contradiction so we can stamp the frontmatter
    // marker. Default to 'merge' (no marker) when triage fails or is
    // not classified.
    let contradictedSourcePath: string | null = null;
    try {
      const triage = await classifyMergeNeed(ctx, info, pageType, sourceFile, existingBody, sourceContext, noteExcerpt);

      // #312 part 2: a page's own primary source must not be dropped on a
      // novelty judgement — that is how an incidental mention keeps a
      // definition it wrote first. Route it to the body merge, which is the
      // prompt's own stated default whenever the call is not clear-cut.
      // Deliberately narrow: only `skip` is overridden. `complementary`
      // already writes the new facts, and rerouting it would trade a targeted
      // append for a full rewrite without cause.
      const strategy = triage.strategy === 'skip' && (sourceOwnsPage || existingIsStub) ? 'merge' : triage.strategy;
      if (strategy !== triage.strategy) {
        console.debug(
          sourceOwnsPage
            ? `[mergePage] triage=skip overridden to merge — "${sourceFile.basename}" carries this page's own lemma (#312) for ${path}`
            : `[mergePage] triage=skip overridden to merge — ${path} is a stub (generation_complete: false), skip would freeze it (S135)`,
        );
      }

      if (strategy === 'skip') {
        console.debug(
          `[mergePage] triage=skip reason="${triage.reason}" — preserving existing body for ${path}`,
        );
        shouldSkip = true;
      } else if (strategy === 'complementary' && triage.items.length > 0) {
        // Item-level contradiction lane: a piece that conflicts with an
        // existing statement must not ride the per-section append (which
        // integrates it as if it were a fact). The page gets the same
        // frontmatter marker as the page-level 'contradictory' strategy
        // (the durable index), and the prose goes to a record file under
        // `<wikiFolder>/contradictions/` — a body block is not a durable
        // carrier, stripUnknownSections removes it on the next rewrite.
        const appendItems = triage.items.filter(i => i.kind !== 'contradictory');
        const conflictItems = triage.items.filter(i => i.kind === 'contradictory');
        for (const d of triage.demoted) {
          // Reported, never silent: the item is still appended as a fact,
          // only the record and the marker are withheld.
          console.warn(`[mergePage] ${describeDemotion(d)} for ${path}`);
        }
        console.debug(
          `[mergePage] triage=complementary items=${appendItems.length} conflicts=${conflictItems.length} — appending to existing sections for ${path}`,
        );
        complementaryBody = appendItems.length > 0
          ? await applyComplementaryAppends(
              ctx,
              appendItems,
              existingBody,
              info,
              sourceFile,
            )
          : existingBody;
        if (conflictItems.length > 0) {
          contradictedSourcePath = sourceFile.path;
          await writeContradictionRecords(ctx, conflictItems, path, sourceFile.path);
          for (const item of conflictItems) {
            ctx.onContradiction?.({
              claim: item.content,
              source_page: `[[${wikiRelativePagePath(ctx.settings.wikiFolder, path)}]]`,
              contradicted_by: existingViewOf(item),
              resolution: '',
            });
          }
        }
        if (complementaryBody === existingBody) {
          if (contradictedSourcePath) {
            // Only conflicts, no appends: the records are written and the
            // marker still needs stamping — the body itself has nothing to
            // merge, so keep it instead of falling into a body rewrite.
            shouldSkip = true;
          } else {
            console.debug(
              `[mergePage] complementary path produced no per-section appends — falling back to body-merge for ${path}`,
            );
          }
        } else {
          shouldSkip = true; // signal "use existing frontmatter + write complementaryBody"
        }
      } else if (strategy === 'contradictory') {
        // v1.25.10 PATCH DocTpoint §4 — flag the frontmatter for the
        // downstream call below. We fall through to the body-rewrite
        // path; the marker is stamped just before the assemble call.
        contradictedSourcePath = sourceFile.path;
        console.debug(
          `[mergePage] triage=contradictory — will stamp frontmatter marker for ${path} (source=${sourceFile.path})`,
        );
        ctx.onContradiction?.({
          claim: info.summary,
          source_page: `[[${wikiRelativePagePath(ctx.settings.wikiFolder, path)}]]`,
          contradicted_by: triage.reason,
          resolution: '',
        });
      }
      // strategy === 'merge' | 'contradictory': fall through to body rewrite.
    } catch (triageError) {
      console.warn(
        `[mergePage] triage failed (${triageError instanceof Error ? triageError.message : String(triageError)}) — falling back to merge path`,
      );
    }

    if (shouldSkip) {
      const bodyToWrite = complementaryBody ?? existingBody;
      // Item-level contradictions reach this path (complementary write):
      // stamp the same frontmatter marker the rewrite path stamps below.
      let fmToWrite = contradictedSourcePath
        ? appendContradictedByMarker(frontmatter, contradictedSourcePath)
        : frontmatter;
      // S135 promotion: a complementary append put real content onto a stub.
      // A pure skip cannot reach a stub (the override above reroutes it), so
      // the marker survives only untouched writes elsewhere.
      if (existingIsStub && complementaryBody !== null) {
        fmToWrite = stripStubMarker(fmToWrite);
      }
      await ctx.createOrUpdateFile(
        path,
        await assembleFinalContent(ctx, fmToWrite, bodyToWrite, info, sourceFile, existingBody),
      );
      return path;
    }

    // 2. LLM intelligent body merge.
    const mergePrompt = pageType === 'entity' ? PROMPTS.mergeEntityPage : PROMPTS.mergeConceptPage;

    const prompt = renderTemplate(mergePrompt, {
      existing_body: existingBody,
      new_source: sourceFile.basename,
      entity_summary: info.summary,
      concept_summary: info.summary,
      related_entities: info.related_entities?.join(', ') || '',
      related_concepts: info.related_concepts?.join(', ') || '',
      key_details: firstQuotesForPrompt(info),
      source_excerpt: renderNoteExcerptBlock(noteExcerpt, pageBasename),
    });

    // #328 Phase 1 follow-up: user-layer tag-vocab removed — system layer injects once.
    const finalPrompt = applySectionLabels(prompt, ctx.settings);

    const mergedBody = await client.createMessage({
      task: 'merge-body',
      model: resolveModelForTask(ctx.settings, 'ingest'),
      max_tokens: TOKENS_PAGE_GENERATION,
      system: await ctx.buildSystemPrompt('merge'),
      messages: [{ role: 'user', content: finalPrompt }],
      ...(ctx.settings.disableThinking ? { enableThinking: false } : {}),
    });

    const cleanedBody = cleanMarkdownResponse(mergedBody);

    if (cleanedBody.trim() === 'NO_NEW_CONTENT') {
      console.debug(`${pageType} page merge returned NO_NEW_CONTENT, keeping existing:`, path);
      return path;
    }

    // 3. Assemble final content (re-assert related-link types deterministically).
    const labels = getSectionLabels(ctx.settings);
    const canonicalizedBody = canonicalizeSectionHeaders(cleanedBody, Object.values(labels));
    const prunedBody = stripUnknownSections(canonicalizedBody, Object.values(labels));
    // Related links resolved against every page, sections written from the
    // lists with the page's earlier entries in front — see page-factory/related-links.ts.
    const correctedBody = await applyRelatedLinks(ctx, prunedBody, info, labels, { pageType, keepFrom: existingBody });
    // Completeness is the schema's call, not the model's: sections the rewrite
    // dropped or collapsed come back (#618), footnoted paragraphs another source
    // owns come back, the H1 comes back (#419). The Mentions section is
    // re-attached by assembleFinalContent below.
    const titledBody = guardBodyRewrite(
      existingBody,
      correctedBody,
      sourceFile.basename,
      Object.values(labels),
      labels.mentions_in_source,
    );
    await ctx.createOrUpdateFile(
      path,
      await assembleFinalContent(
        ctx,
        // v1.25.10 PATCH DocTpoint §4 — when triage returned `contradictory`,
        // stamp the source on the rewritten frontmatter so Lint can surface
        // pages whose rewrite was triggered by a conflict rather than a
        // routine merge. Unknown-field preservation (PR A Step 2) keeps the
        // marker across subsequent re-touches; the helper dedupes by
        // sourcePath so idempotent re-runs are safe.
        // S135 promotion: the body merge below filled the stub with a source
        // that treats its subject — the marker comes off with the same write.
        contradictedSourcePath
          ? appendContradictedByMarker(existingIsStub ? stripStubMarker(frontmatter) : frontmatter, contradictedSourcePath)
          : existingIsStub ? stripStubMarker(frontmatter) : frontmatter,
        titledBody,
        info,
        sourceFile,
        existingBody,
      ),
    );
    return path;
  } catch (error) {
    throw mergeError(error, info.name, pageType);
  }
}

/** What the record and the report say the claim conflicts with: section, plus the triage's reason when it gave one. */
function existingViewOf(item: ComplementaryItem): string {
  // Gate 1 verified the quoted page sentence exactly — that IS the existing
  // view. A partial match arrives without the quote and, like an ungated
  // item, is described by section and reason.
  if (item.existing_statement?.trim()) return item.existing_statement.trim();
  return item.reason?.trim() ? `${item.target_section}: ${item.reason.trim()}` : item.target_section;
}

/** `wiki/entities/X.md` → `entities/X` — the form `source_page` links carry. */
function wikiRelativePagePath(wikiFolder: string, pagePath: string): string {
  return pagePath.startsWith(`${wikiFolder}/`)
    ? pagePath.slice(wikiFolder.length + 1).replace(/\.md$/i, '')
    : pagePath.replace(/\.md$/i, '');
}

/**
 * Write one contradiction record per item-level conflict. The record file
 * under `<wikiFolder>/contradictions/` is the durable prose carrier; the
 * frontmatter marker on the page is the index. File name is claim slug +
 * date (same convention as ContradictionManager), and an existing record
 * is left alone so idempotent re-runs are safe.
 */
async function writeContradictionRecords(
  ctx: MergeContext,
  items: readonly ComplementaryItem[],
  pagePath: string,
  sourceNotePath: string,
): Promise<void> {
  const wikiFolder = ctx.settings.wikiFolder;
  const dir = `${wikiFolder}/contradictions`;
  try {
    await (ctx.app as { vault: { createFolder(p: string): Promise<unknown> } }).vault.createFolder(dir);
  } catch {
    // folder already exists
  }
  const labels = getSectionLabels(ctx.settings);
  const date = localDateStamp();
  const pageRelPath = wikiRelativePagePath(wikiFolder, pagePath);
  for (const item of items) {
    const record = buildContradictionRecord(
      {
        claim: item.content,
        existingView: existingViewOf(item),
        resolution: '',
        pageRelPath,
        sourceNotePath,
        date,
      },
      labels,
    );
    const filePath = `${dir}/${record.fileName}`;
    if (await ctx.tryReadFile(filePath)) continue;
    await ctx.createOrUpdateFile(filePath, record.content);
  }
}

/**
 * Issue #216 — append-only path for `reviewed: true` pages. The existing
 * content is locked (the Mentions section is preserved by the pageIsReviewed
 * flag); we only ask the LLM to draft a small new block, then assemble.
 */
export async function appendToReviewedPage(
  ctx: MergeContext,
  info: EntityInfo | ConceptInfo,
  sourceFile: TFile | { path: string; basename: string },
  existingContent: string,
  path: string,
  sourceSlug?: string,
): Promise<string | null> {
  const client = ctx.getClient();
  if (!client) throw new Error('LLM client not initialized');

  try {
    // 1. Programmatic frontmatter merge
    // Issue #155: record the canonical source PAGE link (disambiguated slug).
    // The page declares its own kind; this function takes no `pageType`.
    const pageKind = parseFrontmatter(existingContent)?.type === 'concept' ? 'concept' : 'entity';
    const { frontmatter, body: existingBody } = mergeFrontmatter(
      existingContent,
      sourceSlug ? `sources/${sourceSlug}` : sourceFile.path,
      incomingTypeTag(ctx.settings, pageKind, info.type, collectActiveVocabulary(ctx.app as never, ctx.settings)),
      info.domains, // domain axis stage 3 (#568): union the extraction's domain subset
    );

    // 2. Minimal LLM check for genuinely new content. Same note-excerpt
    // window as mergePage (matched paragraphs only — no lemma full-note
    // here, the reviewed body is locked anyway and only a small block is
    // drafted): the draft should see what the note says, not just two quotes.
    const reviewedPageBasename = path.split('/').pop()?.replace(/\.md$/i, '') ?? '';
    const reviewedAliases = parseFrontmatter(existingContent)?.aliases;
    const reviewedNoteRaw = await ctx.tryReadFile(sourceFile.path);
    const reviewedExcerpt = reviewedNoteRaw
      ? buildNoteExcerpt(extractBody(reviewedNoteRaw), {
          pageName: reviewedPageBasename,
          aliases: [
            info.name,
            ...(info.aliases ?? []),
            ...(Array.isArray(reviewedAliases) ? reviewedAliases : []),
          ],
        })
      : '';
    const prompt = renderTemplate(PROMPTS.appendToReviewedPage, {
      existing_body: existingBody,
      new_source: sourceFile.basename,
      entity_summary: info.summary,
      key_details: firstQuotesForPrompt(info),
      source_excerpt: renderNoteExcerptBlock(reviewedExcerpt, reviewedPageBasename),
      constraints: UNIVERSAL_LINK_CONSTRAINTS,
    });

    // #328 Phase 1 follow-up: user-layer tag-vocab removed — system layer injects once.
    const finalPrompt = applySectionLabels(prompt, ctx.settings);

    const newContent = await client.createMessage({
      task: 'reviewed-append',
      model: resolveModelForTask(ctx.settings, 'ingest'),
      max_tokens: TOKENS_APPEND_REVIEWED,
      system: await ctx.buildSystemPrompt('merge'),
      messages: [{ role: 'user', content: finalPrompt }],
      ...(ctx.settings.disableThinking ? { enableThinking: false } : {}),
    });

    const cleanedContent = cleanMarkdownResponse(newContent);

    if (cleanedContent.trim() === 'NO_NEW_CONTENT') {
      console.debug('Reviewed page has no new content, preserving existing:', path);
      return path;
    }

    // 3. Assemble final content (Issue #244: programmatic Mentions injection).
    const labels = getSectionLabels(ctx.settings);
    // B2: prefer structured provenance when present; only fall back to legacy
    // mentions_in_source if the structured form is absent (not just empty).
    const isConv = isConversationSource(sourceFile, ctx.settings.wikiFolder);
    const appendMentionsForInject = isConv
      ? []
      : (info.mentions_with_provenance?.length
        ? info.mentions_with_provenance
        : info.mentions_in_source);
    const cleanedContentWithMentions = injectMentionsSection(
      cleanedContent,
      appendMentionsForInject,
      sourceFile.path,
      {
        sectionLabel: labels.mentions_in_source,
        conversationMode: isConv,
        conversationLabel: `Conversation: ${sourceFile.basename}`,
        // This path only runs for `reviewed: true` pages (page-factory routing
        // at createOrUpdatePage): the existing Mentions section is protected
        // and must not be overwritten (replaces the <!-- reviewed: keep --> marker).
        pageIsReviewed: true,
      },
    );
    const finalContent = `${frontmatter}\n\n${cleanedContentWithMentions}`;
    await ctx.createOrUpdateFile(path, finalContent);
    return path;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to update reviewed page "${info.name}": ${msg}`);
  }
}