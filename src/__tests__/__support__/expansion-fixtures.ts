/**
 * Fixtures for the query-expansion tests.
 *
 * Why these exist. The first version of these tests named real pages —
 * "Kimi", "DeepSeek", "GLM-4.5" — and asserted on their words. That passes on
 * one vault and fails on every other, and a contributor who renames a note
 * cannot tell whether they broke the test or the test was always wrong. The
 * tests must describe a property, not a corpus.
 *
 * These builders construct pages whose CONTENT is what the test asserts on.
 * The names are the property under test: `twoPagesSharingAllTerms` for the
 * "nothing is distinctive" case, `pagesWithDistinctVocabularies` for the
 * expansion case. A reader sees what the fixture is for without opening it.
 *
 * The terms are synthetic English identifiers, not prose. The expansion
 * machinery does not care what language the terms are in; what matters is
 * which pages carry which words. Synthetic terms make that visible at a
 * glance, and they do not break when someone renames a note in their vault.
 * Chinese segmentation is a separate concern and has its own test file.
 */
import type { ExpansionPage } from '../../core/query-expansion';

export interface PageSpec {
  readonly title: string;
  readonly terms: readonly string[];
  readonly summary?: string;
}

/**
 * Build pages from a spec. Each term becomes one sentence in the body, so the
 * segmenter sees the terms as separate words and the document-frequency table
 * reflects which pages carry which terms.
 */
export function makePages(specs: ReadonlyArray<PageSpec>): ExpansionPage[] {
  return specs.map((s, i) => ({
    key: `page-${i}`,
    title: s.title,
    summary: s.summary ?? s.terms.slice(0, 2).join(' '),
    text: s.terms.join('. ') + '.',
  }));
}

/**
 * Two pages whose vocabulary overlaps completely. No term is distinctive, so
 * an expansion over these adds nothing. Proves the expansion does not invent
 * words the corpus does not support.
 */
export const twoPagesSharingAllTerms = makePages([
  { title: 'Alpha', terms: ['shared-one', 'shared-two', 'shared-three'] },
  { title: 'Beta', terms: ['shared-one', 'shared-two', 'shared-three'] },
]);

/**
 * Four pages with disjoint vocabularies. Each page's terms are unique to it,
 * so an expansion over the neighbourhood of one page finds the others' terms
 * as the topic's vocabulary. Proves the expansion reads the neighbourhood.
 */
export const pagesWithDistinctVocabularies = makePages([
  { title: 'Alpha', terms: ['alpha-one', 'alpha-two', 'alpha-three'] },
  { title: 'Beta', terms: ['beta-one', 'beta-two', 'beta-three'] },
  { title: 'Gamma', terms: ['gamma-one', 'gamma-two', 'gamma-three'] },
  { title: 'Delta', terms: ['delta-one', 'delta-two', 'delta-three'] },
]);

/**
 * Four pages where one carries a rare term the others do not. The rare term is
 * the only word that distinguishes that page, so an expansion over a
 * neighbourhood containing it must surface the rare term and not the shared
 * ones. Proves rarity is the filter.
 */
export const pageWithRareTerm = makePages([
  { title: 'Alpha', terms: ['common-one', 'common-two'] },
  { title: 'Beta', terms: ['common-one', 'common-two'] },
  { title: 'Gamma', terms: ['common-one', 'common-two', 'rare-xyz'] },
  { title: 'Delta', terms: ['common-one', 'common-two'] },
]);
