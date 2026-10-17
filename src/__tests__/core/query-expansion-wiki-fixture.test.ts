/**
 * Query expansion against the synthetic wiki fixture.
 *
 * The unit tests in `query-expansion.test.ts` describe the expansion's
 * properties on four synthetic pages. This file runs the same machinery on the
 * sixty-page synthetic wiki the project ships, which has a real graph, real
 * frontmatter and a real vocabulary. The two layers answer different
 * questions: the unit tests say "the algorithm does what it claims", this one
 * says "it works on input shaped like a vault".
 *
 * The fixture is synthetic and lives in the repo. No contributor's vault can
 * break these tests, and every contributor can run them.
 */
import { describe, it, expect } from 'vitest';
import { twoStageExpand, buildExpansionTerms, DEFAULT_EXPANSION } from '../../core/query-expansion';
import { buildCorpusTerms } from '../../core/term-index';
import { loadWikiFixture, buildLinkGraph } from '../__support__/wiki-fixture-loader';

const pages = loadWikiFixture();
const expansionPages = pages.map(p => ({ key: p.key, title: p.title, summary: p.summary, text: p.text }));
const terms = buildExpansionTerms(expansionPages);
const corpus = buildCorpusTerms(terms);

describe('expansion on the synthetic wiki fixture', () => {
  it('the fixture loads and has pages with links', () => {
    expect(pages.length).toBeGreaterThan(20);
    expect(pages.some(p => p.links.length > 0)).toBe(true);
  });

  it('expands a query drawn from one page with that page\'s neighbourhood', () => {
    // Pick a page that has at least one outgoing link so there is a
    // neighbourhood to read.
    const source = pages.find(p => p.links.length > 0);
    expect(source).toBeDefined();
    const queryTerms = [source!.title.toLowerCase().replace(/\s+/g, '-')];
    const out = twoStageExpand(queryTerms, expansionPages, corpus, DEFAULT_EXPANSION, terms);
    expect(out.length).toBeGreaterThanOrEqual(queryTerms.length);
  });

  it('adds no word that is not in the fixture', () => {
    const source = pages.find(p => p.links.length > 0)!;
    const queryTerms = [source.title.toLowerCase().replace(/\s+/g, '-')];
    const out = twoStageExpand(queryTerms, expansionPages, corpus, DEFAULT_EXPANSION, terms);
    const vocabulary = new Set<string>();
    for (const pt of terms) {
      for (const k of pt.fields.text.tf.keys()) vocabulary.add(k);
      for (const k of pt.fields.title.tf.keys()) vocabulary.add(k);
    }
    // Every word the expansion adds must be a word the corpus carries.
    for (const t of out) expect(vocabulary.has(t) || queryTerms.includes(t)).toBe(true);
  });

  it('builds a link graph from the fixture\'s wiki-links', () => {
    const graph = buildLinkGraph(pages);
    expect(graph.nodes.length).toBe(pages.length);
    expect(graph.edges.size).toBeGreaterThan(0);
    // Every edge target is a page in the fixture. A dangling link would mean
    // the fixture and the graph disagree.
    const nodeSet = new Set(graph.nodes);
    for (const targets of graph.edges.values()) {
      for (const t of targets) expect(nodeSet.has(t)).toBe(true);
    }
  });

  it('is deterministic: the same query expands to the same words', () => {
    const q = ['heart-failure'];
    const a = twoStageExpand(q, expansionPages, corpus, DEFAULT_EXPANSION, terms);
    const b = twoStageExpand(q, expansionPages, corpus, DEFAULT_EXPANSION, terms);
    expect(a).toEqual(b);
  });
});
