// TOOL/PRODUCT DRIFT — the second guard, and the one that closes the failure
// that has now happened six times in one cycle.
//
// `query-view-wiring.test.ts` guards the product side: a fix exists but no user
// path reaches it. This one guards the other side: a TOOL reimplements a
// composition the product owns, and the tool's numbers describe the tool's copy.
//
// The six instances, all measured through code the product does not run:
//   1. `summary` mapped as `aliases[0]` in the product and `body.slice(0,200)`
//      in the tool.
//   2. The conversation-history evaluation built a different question.
//   3. #843's cost model counted the scorer and not the table build feeding it.
//   4. The expansion A/B fed the expansion segmented bigrams while production
//      fed it an uncut Chinese run — the expansion returned its input verbatim.
//   5. A lexical A/B passed a third argument to a two-parameter function, so
//      both arms ran identical code and "BM25F buys nothing" was the tool's
//      own null result.
//   6. A fusion A/B compared against a score the tool invented.
//
// A behaviour test cannot catch this: every piece is correct on its own, and
// the tool's assertions pass. Only the COMPOSITION can be wrong. So the
// assertions here are on what the tools import and how they enter the product.
//
// `planRetrieval` and `selectPprSeeds` are the two seams. A tool that measures
// the retrieval must reach both, and must not rank anything itself.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const TOOLS_DIR = fileURLToPath(new URL('../../../../tools/dev-instrument/', import.meta.url));

/** Tools that rank or expand a query, i.e. anything whose output is a number
 *  someone will quote about retrieval quality. */
const RETRIEVAL_TOOLS = [
  'run-expansion-eval.mjs',
  'run-answer-path-ab.mjs',
  'run-retrieval-ab.mjs',
];

const read = (name: string) => readFileSync(TOOLS_DIR + name, 'utf8');

describe('tool/product drift — a measurement tool enters the product, it does not copy it', () => {
  for (const tool of RETRIEVAL_TOOLS) {
    it(`${tool} is present`, () => {
      expect(readdirSync(TOOLS_DIR)).toContain(tool);
    });

    it(`${tool} runs the production entry point`, () => {
      const src = read(tool);
      // The one function that owns seed selection, the gate, the fusion and
      // the assembly. A tool that does not call it is describing itself.
      expect(src, `${tool} does not call selectPprSeeds`).toMatch(/\bselectPprSeeds\(/);
    });

    it(`${tool} does not rank pages on its own`, () => {
      const src = read(tool);
      // `bm25fScore`, a local `scorePagesByNeedles`, a hand-rolled RRF or a
      // local `lexScore` are all a second scorer. The assembly primitives are
      // fine to use when a tool measures ASSEMBLY specifically; a tool that
      // measures retrieval quality is not.
      expect(src, `${tool} scores with bm25fScore directly`).not.toMatch(/\bbm25fScore\s*\(/);
      expect(src, `${tool} defines its own ranker`).not.toMatch(/function\s+rank(PPR|Ppr|Bm25f|Lex|Scoring)/i);
      expect(src, `${tool} fabricates a score to stand in for a channel`).not.toMatch(/1\s*-\s*\w+\.rank\s*\/\s*1000/);
    });

    it(`${tool} loads pages the way the product loads them`, () => {
      const src = read(tool);
      // The wiki index is the product's page list and the source of each page's
      // summary. A tool that walks the .md tree and invents a summary is
      // measuring a different corpus.
      // `readWikiIndex` is the product's own reader and calls
      // `parseIndexForPages`; either is reaching the production path.
      expect(
        src,
        `${tool} does not load the page list through the product's reader`,
      ).toMatch(/\b(parseIndexForPages|readWikiIndex)\s*\(/);
      expect(src, `${tool} does not attach bodies with withBodies`).toMatch(/\bwithBodies\(/);
    });

    it(`${tool} builds the graph with the production resolver`, () => {
      const src = read(tool);
      expect(src, `${tool} does not use buildGraphFromContent`).toMatch(/\bbuildGraphFromContent\(/);
    });

    it(`${tool} honours --exclude-asker rather than parsing it and dropping it`, () => {
      const src = read(tool);
      // The flag was once parsed, passed as `false`, and filtered with
      // `p => true` in both branches — so every figure it printed was
      // link-following. If the flag is absent from the flag table it is a
      // finding, not a style choice.
      expect(src, `${tool} has no --exclude-asker flag`).toMatch(/exclude-asker/);
      // And it must actually subtract the asker from the candidate set.
      // Matched loosely on purpose: the point is that the asker leaves the
      // candidate set, not what the variable is called.
      expect(src, `${tool} filters the asker out of the refs`).toMatch(/\.path\s*!==\s*[\w.]*asker/i);
    });
  }

  it('the expansion tool builds its arms with the shared composition', () => {
    // Arms A and B differ by `expand: false` and nothing else, so the baseline
    // is the product minus one step rather than a parallel implementation.
    const src = read('run-expansion-eval.mjs');
    expect(src).toMatch(/\bplanRetrieval\(/);
    expect(src).toMatch(/expand:\s*false/);
    expect(src).toMatch(/expand:\s*true/);
  });

  it('the expansion tool self-checks that the expansion ran', () => {
    // A run where the expansion added nothing measures the baseline twice and
    // reports it as a null result. That is exactly what happened.
    const src = read('run-expansion-eval.mjs');
    expect(src, 'no no-op self-check').toMatch(/addedTerms/);
    expect(src, 'no no-op report').toMatch(/added nothing/);
  });

  it('a tool that reports layers marks an empty one instead of scoring it', () => {
    // `n = 0` printed as `0.000` is a score, and every CROSS figure on these
    // vaults was one — no index.md carries the `source:` marker, so the layer
    // had no questions at all.
    for (const tool of RETRIEVAL_TOOLS) {
      const src = read(tool);
      if (!/CROSS/.test(src)) continue; // reports no layer, so it can hide none
      expect(src, `${tool} reports CROSS but has no empty-layer marker`).toMatch(/n\/a/);
    }
  });

  it('a tool that reports a recall says how many questions it scored', () => {
    // A ratio without its denominator cannot be compared across runs, and the
    // 200-question subsample that read +0.182 against a full run's +0.011 is
    // what that looks like.
    for (const tool of RETRIEVAL_TOOLS) {
      const src = read(tool);
      expect(src, `${tool} reports a recall without its n`).toMatch(/questions=|n=\$\{|questions\.length/);
    }
  });
});
