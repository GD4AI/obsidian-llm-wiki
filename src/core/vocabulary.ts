// One tag vocabulary, three sources, every reader the same list.
//
// Until now two lists both called themselves "the active vocabulary". The
// settings list (`getActiveEntityTags` / `getActiveConceptTags`) was what the
// system prompt offered, what the #527 type repair folded onto, and what the
// lint scanner and the retag runner judged against. The harvest of the vault's
// own tags (`collectActiveVocabulary`, #568/#569) was what the write gate
// stripped against and what the merge writers admitted. A type the prompt
// explicitly allowed was deleted at the gate whenever no note happened to
// carry it: measured on a 903-page rebuild, 69 pages (7.6 %) were born with an
// empty `tags:` — organisations, classification systems, persons — and the
// scanner skips an empty list as "not a violation", so nobody saw it.
//
// The rule this module states, and that the tests hold: what the prompt offers
// is exactly what the gate lets through. A term enters the vocabulary through
// a note's frontmatter, a page's frontmatter, or the settings list — never
// through the model. The settings list is the place for a term no note carries
// yet; a user without tagged notes keeps the built-in taxonomy, unchanged.

import type { App } from 'obsidian';
import type { LLMWikiSettings } from '../types';
import { collectActiveVocabulary, fold, isDomainTag, unionDomains } from './domain-axis';
import { getActiveConceptTags, getActiveEntityTags } from './tag-vocab';

export type VocabularyKind = 'entity' | 'concept';

/** The two per-kind lists the system prompt renders. */
export interface VocabularyLists {
  entities: string[];
  concepts: string[];
}

/** `unionDomains` is the validator's own notion of "the same value"; sorted for a stable prompt. */
function union(first: readonly string[], second: readonly string[]): string[] {
  return unionDomains(first, second).sort((a, b) => fold(a) < fold(b) ? -1 : fold(a) > fold(b) ? 1 : 0);
}

/**
 * The vocabulary a page of `kind` may carry in `tags:`: the settings list for
 * that kind ∪ the vault harvest (watched-folder tags + nested tags of existing
 * pages). Fold-deduplicated, settings spelling wins, sorted for a stable
 * prompt. Without `kind` the union over both kinds — the offer for a per-item
 * `domains` choice and for source pages, which carry either.
 */
export function activeVocabulary(app: App, settings: LLMWikiSettings, kind?: VocabularyKind): string[] {
  const declared = kind === 'entity'
    ? getActiveEntityTags(settings)
    : kind === 'concept'
      ? getActiveConceptTags(settings)
      : [...getActiveEntityTags(settings), ...getActiveConceptTags(settings)];
  return union(declared, collectActiveVocabulary(app, settings));
}

export function activeVocabularyLists(app: App, settings: LLMWikiSettings): VocabularyLists {
  return {
    entities: activeVocabulary(app, settings, 'entity'),
    concepts: activeVocabulary(app, settings, 'concept'),
  };
}

/**
 * The group-qualified view of the same list — every value written as
 * `Group/Value`. This is the domains axis (#568): what an item *belongs to*,
 * offered per extracted item and validated on the way back. The flat identity
 * types (`person`, `theory`, …) are the `type` axis and are not domains; the
 * built-in taxonomy would otherwise turn a vault without note tags into one
 * with a domain block. One list, one shape filter — not a second source.
 */
export function domainVocabulary(app: App, settings: LLMWikiSettings): string[] {
  return activeVocabulary(app, settings).filter(isDomainTag);
}

/** The vocabulary kind a page type draws from; a source page draws from both. */
export function vocabularyKindFor(pageType: 'entity' | 'concept' | 'source'): VocabularyKind | undefined {
  return pageType === 'source' ? undefined : pageType;
}
