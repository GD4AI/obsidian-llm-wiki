// page-factory/index.ts — PageFactory facade after the v1.24.1 Phase 2
// god-class split.
//
// The original page-factory.ts was a 1297-LOC god class with 27 private
// methods, tightly coupled via `this.ctx` / `this.settings`. Phase 2 split
// every method into 9 focused module files under `src/wiki/page-factory/`.
//
// This facade preserves the EXACT public API:
//   - `new PageFactory(ctx)`
//   - `pageFactory.createOrUpdateEntityPage(...)`
//   - `pageFactory.createOrUpdateConceptPage(...)`
//   - `pageFactory.updateRelatedPage(...)`
//
// so existing callers (`wiki-engine.ts`, `conversation-ingest.ts`, and the
// 5 existing page-factory-*.test.ts integration tests) keep working
// unchanged. The class methods are thin one-line delegates to the
// module-level functions in the sibling files.
//
// Behavior is identical to the pre-split god class. All observable side
// effects (frontmatter merges, slug-vs-LLM path resolution, triage routing,
// mentions injection, reviewed-page locking, conversation-mode citation)
// are preserved verbatim.
//
// Module-level functions are independently testable (see the 91 tests in
// `src/__tests__/wiki/page-factory/*.test.ts`). This facade only exists
// to keep the existing call sites stable.

import type {
  EntityInfo,
  ConceptInfo,
  SourceAnalysis,
  PageCreationResult,
} from '../../types';
import type { EngineContext } from '../../types';

import {
  createOrUpdateEntityPage,
  createOrUpdateConceptPage,
  createNewPage as _createNewPage,
  createOrUpdatePage as _createOrUpdatePage,
  type CreatePageContext,
} from './create-page';
import type { RelatedProjection } from '../../core/related-sections';
import { resolvePagePath, type PathResolutionContext } from './path-resolution';
import { updateRelatedPage, type RelatedPageContext } from './related-page';
import { mergePage as _mergePage, appendToReviewedPage as _appendToReviewedPage } from './merge-page';
import { applyComplementaryAppends as _applyComplementaryAppends } from './complementary-appends';
import { classifyMergeNeed as _classifyMergeNeed, buildNewInfoSummary } from './merge-triage';
import { appendAliases as _appendAliases } from './aliases';

/**
 * Type alias for the file parameter used by the public API. Mirrors the
 * original `TFile | { path: string; basename: string }` union.
 */
export type PageFactorySourceFile = NonNullable<
  Parameters<typeof createOrUpdateEntityPage>[3]
>;

/**
 * PageFactory facade. Preserves the pre-split public API. All public
 * methods are thin delegates to the module-level functions in the
 * sibling files.
 */
export class PageFactory {
  constructor(private ctx: EngineContext) {}

  /**
   * Narrow EngineContext to the CreatePageContext contract. Both share
   * the same shape for the fields `createOrUpdateEntityPage` /
   * `createOrUpdateConceptPage` read.
   */
  private get createCtx(): CreatePageContext {
    return this.ctx as unknown as CreatePageContext;
  }

  /**
   * Narrow EngineContext to the PathResolutionContext contract.
   */
  private get pathCtx(): PathResolutionContext {
    return this.ctx as unknown as PathResolutionContext;
  }

  /**
   * Narrow EngineContext to the RelatedPageContext contract.
   */
  private get relatedCtx(): RelatedPageContext {
    return this.ctx as unknown as RelatedPageContext;
  }

  /**
   * Create or update an entity page.
   *
   * @param entity          The LLM-extracted entity info.
   * @param _analysis       Source analysis (unused by the create path;
   *                        kept for API parity with wiki-engine.ts).
   * @param sourceFile      The source note this entity came from.
   * @param extraPagePaths  Additional wiki pages to surface in the LLM
   *                        candidate list (e.g. the just-created
   *                        sources/<slug> page).
   * @param sourceSlug      Optional disambiguated source slug (used when
   *                        the source page itself was a re-ingest of an
   *                        already-known file — see Issue #155).
   */
  async createOrUpdateEntityPage(
    entity: EntityInfo,
    _analysis: SourceAnalysis,
    sourceFile: PageFactorySourceFile,
    extraPagePaths: string[] = [],
    sourceSlug?: string,
    projected?: RelatedProjection,
  ): Promise<PageCreationResult> {
    return createOrUpdateEntityPage(
      this.createCtx,
      entity,
      _analysis,
      sourceFile,
      extraPagePaths,
      sourceSlug,
      projected,
    );
  }

  /**
   * Create or update a concept page. See createOrUpdateEntityPage for the
   * parameter contract.
   */
  async createOrUpdateConceptPage(
    concept: ConceptInfo,
    _analysis: SourceAnalysis,
    sourceFile: PageFactorySourceFile,
    extraPagePaths: string[] = [],
    sourceSlug?: string,
    projected?: RelatedProjection,
  ): Promise<PageCreationResult> {
    return createOrUpdateConceptPage(
      this.createCtx,
      concept,
      _analysis,
      sourceFile,
      extraPagePaths,
      sourceSlug,
      projected,
    );
  }

  /**
   * Update an existing wiki page that's topically related to a newly-
   * ingested source. See `related-page.ts` for the routing logic.
   */
  async updateRelatedPage(
    pageName: string,
    analysis: SourceAnalysis,
    sourceFile: PageFactorySourceFile,
    sourceSlug?: string,
  ): Promise<string | null> {
    return updateRelatedPage(
      this.relatedCtx,
      pageName,
      analysis,
      sourceFile,
      sourceSlug,
    );
  }

  // ────────────────────────────────────────────────────────────────────
  // @internal — These methods preserve the pre-split class surface so the
  // existing test suite (page-factory-merge-triage / page-factory-core /
  // page-factory-complementary-append / page-factory-list-section-no-blank /
  // page-factory-sources-filter / page-factory.test.ts) can keep using
  // HelperAccess casts to invoke private methods. NEW code should call the
  // module-level functions directly (they're already imported above).
  //
  // Do NOT add more methods to this section. If a future test needs a new
  // private method, write the test against the module-level function instead.
  // ────────────────────────────────────────────────────────────────────

  /** @internal Used by page-factory.test.ts (private-method access). */
  async mergePage(
    info: EntityInfo | ConceptInfo,
    pageType: 'entity' | 'concept',
    sourceFile: Parameters<typeof _mergePage>[3],
    existingContent: string,
    extraPagePaths: string[],
    path: string,
    sourceSlug?: string,
  ): Promise<string | null> {
    return _mergePage(this.createCtx, info, pageType, sourceFile, existingContent, extraPagePaths, path, sourceSlug);
  }

  /** @internal Used by page-factory.test.ts (private-method access). */
  async createNewPage(
    info: EntityInfo | ConceptInfo,
    pageType: 'entity' | 'concept',
    sourceFile: Parameters<typeof _createNewPage>[3],
    extraPagePaths: string[],
    path: string,
    sourceSlug?: string,
  ): Promise<string | null> {
    return _createNewPage(this.createCtx, info, pageType, sourceFile, extraPagePaths, path, sourceSlug);
  }

  /** @internal Used by page-factory-merge-triage.test.ts (private-method access). */
  classifyMergeNeed(
    info: EntityInfo | ConceptInfo,
    pageType: 'entity' | 'concept',
    sourceFile: Parameters<typeof _mergePage>[3],
    existingContent: string,
  ): ReturnType<typeof _classifyMergeNeed> {
    return _classifyMergeNeed(this.createCtx, info, pageType, sourceFile, existingContent);
  }

  /** @internal Used by page-factory-merge-triage.test.ts (private-method access). */
  buildNewInfoSummary(
    info: EntityInfo | ConceptInfo,
    sourceFile: Parameters<typeof _mergePage>[3],
  ): string {
    return buildNewInfoSummary(info, sourceFile);
  }

  /** @internal Used by page-factory-complementary-append.test.ts (private-method access). */
  applyComplementaryAppends(
    items: Parameters<typeof _applyComplementaryAppends>[1],
    existingBody: string,
    info: Parameters<typeof _applyComplementaryAppends>[3],
    sourceFile: Parameters<typeof _applyComplementaryAppends>[4],
  ): ReturnType<typeof _applyComplementaryAppends> {
    return _applyComplementaryAppends(this.createCtx, items, existingBody, info, sourceFile);
  }

  /** @internal Used by page-factory-list-section-no-blank.test.ts (private-method access). */
  resolvePagePath(
    name: string,
    pageType: 'entity' | 'concept',
    summary: string,
  ): ReturnType<typeof resolvePagePath> {
    return resolvePagePath(this.pathCtx, name, pageType, summary);
  }

  /** @internal Used by page-factory.test.ts (private-method access). */
  createOrUpdatePage(
    info: EntityInfo | ConceptInfo,
    pageType: 'entity' | 'concept',
    sourceFile: Parameters<typeof _createOrUpdatePage>[3],
    extraPagePaths: string[] = [],
    sourceSlug?: string,
  ): Promise<PageCreationResult> {
    return _createOrUpdatePage(this.createCtx, info, pageType, sourceFile, extraPagePaths, sourceSlug);
  }

  /** @internal Used by page-factory-complementary-append.test.ts (private-method access). */
  appendToReviewedPage(
    info: EntityInfo | ConceptInfo,
    sourceFile: Parameters<typeof _appendToReviewedPage>[2],
    existingContent: string,
    path: string,
    sourceSlug?: string,
  ): ReturnType<typeof _appendToReviewedPage> {
    return _appendToReviewedPage(this.createCtx, info, sourceFile, existingContent, path, sourceSlug);
  }

  /** @internal Used by page-factory.test.ts (private-method access). */
  appendAliases(
    pagePath: string,
    newAliases: string[],
  ): ReturnType<typeof _appendAliases> {
    return _appendAliases(this.createCtx, pagePath, newAliases);
  }
}