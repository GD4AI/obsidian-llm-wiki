// page-factory/related-page.ts — update an existing wiki page that's
// topically related to a newly-ingested source.
//
// Extracted from the original page-factory.ts god-class so the three-branch
// routing logic (no-new-info / reviewed / normal) is independently testable.
//
// Behavior (v1.24.1 Phase 2 refactor — preserved verbatim):
//   - No matching entity/concept in the analysis → only re-merge frontmatter
//     (sources + updated). Issue #131 fix: skip the LLM entirely to avoid the
//     no-op rewrite that corrupts verbatim text (#131).
//   - reviewed: true page → route to `appendToReviewedPage` so the curated
//     body is preserved verbatim and only genuinely-new content lands in
//     ## New Information. Parity with the createOrUpdatePage routing.
//   - Normal path → LLM rewrites the body via the updateRelatedPage prompt.

import { TFile } from 'obsidian';
import type { SourceAnalysis, LLMWikiSettings, LLMClient } from '../../types';
import { PROMPTS } from '../../prompts';
import { TOKENS_PAGE_GENERATION, WIKI_SUBFOLDERS } from '../../constants';
import { resolveModelForTask } from '../../core/model-resolver';
import { cleanMarkdownResponse } from '../../core/markdown';
import { mergeFrontmatter, parseFrontmatter } from '../../core/frontmatter';
import { incomingTypeTag } from '../../core/tag-vocab';
import { collectActiveVocabulary } from '../../core/domain-axis';
import { stripMentionsSection } from '../../core/mentions-parser';
import { guardBodyRewrite } from '../../core/paragraph-provenance';
import { renderTemplate } from '../../core/template-renderer';
import {
  canonicalizeSectionHeaders,
  stripUnknownSections,
} from '../../core/section-header-canonicalizer';
import { applyRelatedLinks } from './related-links';
import { getSectionLabels } from '../system-prompts';
import { getExistingWikiPages } from '../lint/get-existing-pages';
import { UNIVERSAL_LINK_CONSTRAINTS } from '../prompts/constraints';
import { appendToReviewedPage, type MergeContext } from './merge-page';
import { assembleFinalContent } from './mentions-integration';

/**
 * Minimal context contract required by `updateRelatedPage`. Mirrors the real
 * EngineContext shape for the small subset this function uses.
 */
export interface RelatedPageContext extends MergeContext {
  app: {
    vault: {
      getAbstractFileByPath(path: string): unknown;
      read(file: TFile): Promise<string>;
    };
  };
  settings: LLMWikiSettings;
  getClient(): LLMClient | null;
  buildSystemPrompt(mode: 'full' | 'compact' | 'merge' | 'related'): Promise<string>;
  createOrUpdateFile(path: string, content: string): Promise<void>;
}

/**
 * Update an existing wiki page that's topically related to a newly-ingested
 * source. Returns false when the related page doesn't exist (or isn't a
 * regular TFile); returns true on any successful write.
 */
export async function updateRelatedPage(
  ctx: RelatedPageContext,
  pageName: string,
  analysis: SourceAnalysis,
  sourceFile: TFile | { path: string; basename: string },
  sourceSlug?: string,
): Promise<boolean> {
  const existingPages = await getExistingWikiPages(
    ctx.app as never,
    ctx.settings.wikiFolder,
  );
  // A related page is an entity or concept page. The title index spans the
  // whole wiki folder, and a source page shares its basename with the entity
  // its note is about (`sources/Zytokine` next to `entities/Zytokine`), so a
  // bare title lookup picked whichever the vault listed first — on a measured
  // vault 573 of the rewrites landed on source pages, whose one-note summary
  // then got the entity prompt, the entity's `new_info`, and the entity-page
  // Mentions budget. Only the two entity folders are candidates here.
  const relatedFolders = [
    `${ctx.settings.wikiFolder}/${WIKI_SUBFOLDERS.entities}/`,
    `${ctx.settings.wikiFolder}/${WIKI_SUBFOLDERS.concepts}/`,
  ];
  const page = existingPages.find(
    p => p.title === pageName && relatedFolders.some(folder => p.path.startsWith(folder)),
  );

  if (!page) {
    console.debug('Related page not found:', pageName);
    return false;
  }

  const abstractFile = ctx.app.vault.getAbstractFileByPath(page.path);
  if (!(abstractFile instanceof TFile)) {
    console.debug('Related page is not a file:', pageName);
    return false;
  }

  const existingContent = await ctx.app.vault.read(abstractFile);

  // Hoisted above the merge so this source's type reaches `tags:`; the skip
  // decision below reads the same value. Which list it came from is the kind,
  // so the vocabulary check below needs no second lookup.
  const asEntity = analysis.entities.find(e => e.name === pageName);
  const newInfo = asEntity || analysis.concepts.find(c => c.name === pageName);

  // 1. Programmatic frontmatter merge (sources + updated).
  // Issue #155: cite the canonical source PAGE link (disambiguated slug).
  const { frontmatter, body: existingBody } = mergeFrontmatter(
    existingContent,
    sourceSlug ? `sources/${sourceSlug}` : sourceFile.path,
    incomingTypeTag(ctx.settings, asEntity ? 'entity' : 'concept', newInfo?.type, collectActiveVocabulary(ctx.app as never, ctx.settings)),
  );

  // Issue #131: when the source extracted nothing matching this page, skip the
  // LLM entirely — record the new source in frontmatter and leave the body
  // untouched (a no-op rewrite corrupts verbatim text).
  if (!newInfo) {
    await ctx.createOrUpdateFile(page.path, `${frontmatter}\n\n${existingBody}`);
    return true;
  }

  // Parity with createOrUpdatePage: a `reviewed: true` page must never have its
  // body LLM-rewritten — even when a different source extracts it here.
  if (parseFrontmatter(existingContent)?.reviewed === true) {
    await appendToReviewedPage(ctx, newInfo, sourceFile, existingContent, page.path);
    return true;
  }

  const labels = getSectionLabels(ctx.settings);

  // The Mentions section is programmatic since #244 and must never be
  // LLM-rewritten. Strip it from the prompt body so the model cannot drift its
  // format; it is re-attached deterministically by assembleFinalContent below.
  const promptBody = stripMentionsSection(existingBody, labels.mentions_in_source);

  const prompt = renderTemplate(PROMPTS.updateRelatedPage, {
    page_name: pageName,
    existing_body: promptBody,
    source_basename: sourceFile.basename,
    new_info: JSON.stringify(newInfo),
    constraints: UNIVERSAL_LINK_CONSTRAINTS,
  });

  const client = ctx.getClient();
  if (!client) throw new Error('LLM client not initialized');

  const updatedBody = await client.createMessage({
    task: 'related-page',
    model: resolveModelForTask(ctx.settings, 'ingest'),
    max_tokens: TOKENS_PAGE_GENERATION,
    system: await ctx.buildSystemPrompt('related'),
    messages: [{ role: 'user', content: prompt }],
    ...(ctx.settings.disableThinking ? { enableThinking: false } : {}),
  });

  const cleanedBody = cleanMarkdownResponse(updatedBody);

  // Parity with createNewPage / mergePage: this path used to persist the model's
  // reply verbatim, so it ran neither the header canonicalizer (#241) nor the
  // related-link prefix corrector (#187). A garbled section label therefore
  // stayed garbled — and Tier-B retrieval matches labels exactly — while a
  // `sources/`-mis-prefixed link in a Related section was never re-typed.
  const canonicalizedBody = canonicalizeSectionHeaders(cleanedBody, Object.values(labels));
  const prunedBody = stripUnknownSections(canonicalizedBody, Object.values(labels));
  // Related links resolved against every page, sections written from the
  // lists with the page's earlier entries in front — see page-factory/related-links.ts.
  const correctedBody = await applyRelatedLinks(ctx, prunedBody, newInfo, labels, { pageType: asEntity ? 'entity' : 'concept', keepFrom: existingBody });

  // Completeness is the schema's call, not the model's: sections the rewrite
  // dropped or collapsed come back (#618), footnoted paragraphs another source
  // owns come back, the H1 comes back (#419). The Mentions section is
  // re-attached by assembleFinalContent below.
  const titledBody = guardBodyRewrite(
    promptBody,
    correctedBody,
    sourceFile.basename,
    Object.values(labels),
    labels.mentions_in_source,
  );

  // 2. Assemble: programmatic frontmatter + LLM body + Mentions section.
  // Issue #267 established a non-lossy re-ingest on the merge path, but this
  // path never had it: the Mentions section lives in the body handed to the LLM,
  // so a rewrite that failed to reproduce it destroyed every accumulated quote.
  // Route through assembleFinalContent exactly as mergePage does — it unions the
  // page's mentions with this source's, and falls back to preserving an
  // unparseable section verbatim. `existingBody` (not promptBody) is passed so
  // the accumulated mentions are recovered from the unstripped page.
  await ctx.createOrUpdateFile(
    page.path,
    await assembleFinalContent(ctx, frontmatter, titledBody, newInfo, sourceFile, existingBody),
  );
  return true;
}