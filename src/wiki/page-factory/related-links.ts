// One pass, shared by the three page factories: resolve the Related links
// against every page in the vault (#482 stage 2 — the prompt carries no page
// list any more), then write the two Related sections from the typed lists
// (core/related-sections.ts). A rewrite hands the body it replaces in
// `keepFrom`, so the relations the page already had stay in front.

import { correctRelatedLinkPrefixes, buildVaultResolver } from '../../core/related-link-corrector';
import { renderRelatedSections } from '../../core/related-sections';
import type { Folder } from '../../core/related-sections';
import { RELATED_BUDGET } from '../../constants';
import type { ExtractionGranularity } from '../../constants';
import type { WikiPageRef } from '../../types';

interface RelatedLinkCtx {
  settings: { wikiFolder: string; slugCase?: string; extractionGranularity?: ExtractionGranularity };
  /** The wiki page index, through the engine's own held copy (Issue #662). */
  getExistingWikiPages(): Promise<WikiPageRef[]>;
}

interface RelatedLists {
  related_entities?: string[];
  related_concepts?: string[];
}

/** `getSectionLabels(settings)` — the two Related labels are read by key. */
type RelatedLabels = Record<string, string>;

export async function applyRelatedLinks(
  ctx: RelatedLinkCtx,
  content: string,
  lists: RelatedLists,
  labels: RelatedLabels,
  opts: { pageType: 'entity' | 'concept'; keepFrom?: string; selfPath?: string },
): Promise<string> {
  const firstSection: Folder = opts.pageType === 'concept' ? 'concepts' : 'entities';
  const vaultIndex = { wikiFolder: ctx.settings.wikiFolder, pages: await ctx.getExistingWikiPages() };
  const prefixed = correctRelatedLinkPrefixes(
    content,
    lists.related_entities,
    lists.related_concepts,
    labels.related_entities,
    labels.related_concepts,
    vaultIndex,
  );
  const ceiling = RELATED_BUDGET[ctx.settings.extractionGranularity ?? 'standard'].total;
  return renderRelatedSections(
    prefixed,
    lists.related_entities,
    lists.related_concepts,
    labels.related_entities,
    labels.related_concepts,
    {
      preserveCase: ctx.settings.slugCase === 'preserve',
      resolve: buildVaultResolver(vaultIndex),
      keepFrom: opts.keepFrom,
      // #664, first half: the page-level budget bounds what a write may ADD. Kept
      // entries are untouched, so a list already over the ceiling keeps every entry
      // and simply stops growing until #729 Phase 2 truncates it.
      ceiling,
      // The ceiling refuses silently: nothing is written, so nothing shows on the
      // page. This line is the only trace, and it is `console.debug`, so production
      // builds strip it (#664).
      onRefused: (section, names) =>
        console.debug(`[Related ceiling] ${opts.pageType} page kept ${ceiling} entries, refused ${names.length} new ${section} name(s): ${names.join(', ')}`),
      firstSection,
      ...(opts.selfPath !== undefined ? { selfPath: opts.selfPath } : {}) },
  );
}
