// One pass, shared by the three page factories: resolve the Related links
// against every page in the vault (#482 stage 2 — the prompt carries no page
// list any more), then write the two Related sections from the typed lists
// (core/related-sections.ts). A rewrite hands the body it replaces in
// `keepFrom`, so the relations the page already had stay in front.

import { correctRelatedLinkPrefixes, buildVaultResolver } from '../../core/related-link-corrector';
import { renderRelatedSections } from '../../core/related-sections';
import type { Folder } from '../../core/related-sections';
import { getExistingWikiPages } from '../lint/get-existing-pages';

interface RelatedLinkCtx {
  app: unknown;
  settings: { wikiFolder: string; slugCase?: string };
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
  opts: { pageType: 'entity' | 'concept'; keepFrom?: string },
): Promise<string> {
  const firstSection: Folder = opts.pageType === 'concept' ? 'concepts' : 'entities';
  const vaultIndex = { wikiFolder: ctx.settings.wikiFolder, pages: await getExistingWikiPages(ctx.app as never, ctx.settings.wikiFolder) };
  const prefixed = correctRelatedLinkPrefixes(
    content,
    lists.related_entities,
    lists.related_concepts,
    labels.related_entities,
    labels.related_concepts,
    vaultIndex,
  );
  return renderRelatedSections(
    prefixed,
    lists.related_entities,
    lists.related_concepts,
    labels.related_entities,
    labels.related_concepts,
    { preserveCase: ctx.settings.slugCase === 'preserve', resolve: buildVaultResolver(vaultIndex), keepFrom: opts.keepFrom, firstSection },
  );
}
