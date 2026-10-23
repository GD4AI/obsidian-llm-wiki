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

  it('the index regeneration calls the production generator', () => {
    // The whole reason #855's cross-source layer read `n=0` for weeks is that
    // the committed indexes predate the `source:` marker, not that the marker
    // could not be written. Rebuilding an index by hand — assembling
    // `- [[path|name]] \`source: ...\`` lines here — would be the same drift
    // in a new place, and would silently disagree with the generator the moment
    // it changes.
    const src = read('run-regenerate-index.mjs');
    expect(src, 'does not use the production IndexGenerator').toMatch(/\bIndexGenerator\b/);
    expect(src, 'builds index lines itself').not.toContain('- [[${');
    expect(src, 'does not warn when it produces no source markers')
      .toMatch(/no source markers|WARNING/);
  });

  it('the index regeneration never writes to the vault', () => {
    // Measuring a corpus must not mutate it.
    const src = read('run-regenerate-index.mjs');
    expect(src).toMatch(/writeFile:\s*async/);
    expect(src, 'the vault path reaches writeFileSync')
      .not.toMatch(/writeFileSync\(join\(vaultDir/);
  });

  it('a tool that needs `obsidian` uses a shim scoped to tool runs', () => {
    // `index-generator.ts` imports `normalizePath` at runtime. The shim supplies
    // that one value; `typecheck:tools` still checks tool code against the real
    // API because the runtime config is a separate file.
    const shim = readFileSync(`${TOOLS_DIR}stubs/obsidian.ts`, 'utf8');
    expect(shim).toMatch(/export function normalizePath/);
    const runConfig = JSON.parse(readFileSync(`${TOOLS_DIR}tsconfig.tools-run.json`, 'utf8'));
    expect(runConfig.compilerOptions.paths.obsidian[0]).toBe('tools/dev-instrument/stubs/obsidian.ts');
    // The checked config must NOT carry the mapping, or a tool's `obsidian`
    // usage would be type-checked against three lines of stub.
    const checked = JSON.parse(readFileSync(`${TOOLS_DIR}tsconfig.json`, 'utf8'));
    expect(checked.compilerOptions?.paths?.obsidian).toBeUndefined();
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

  it('a sampling truncation copies its source before emptying it', () => {
    // The seventh instance, and the one that hid longest because it produced a
    // plausible explanation instead of an error.
    //
    // `run-expansion-eval.mjs` sampled like this:
    //
    //   const sampled = stride > 1 ? questions.filter(...) : questions;
    //   questions.length = 0;
    //   questions.push(...sampled);
    //
    // When `stride === 1` — every run WITHOUT `--limit` — `sampled` WAS
    // `questions`, so emptying the source emptied the result, and the run
    // reported zero questions. It then printed "the graph carries no
    // resolvable (asker -> truth) pair", which blames the corpus for a tool
    // defect. Every full-set expansion run was therefore impossible, and the
    // only shape the tool could produce was a `--limit` sample.
    //
    // The assertion is structural because the defect is structural: truncate
    // an array that `sampled` aliases, and the sample is empty. It targets the
    // SAMPLED assignment line, not the file: `: [...all]` appears a few lines
    // above in the layer selection, so a file-wide match passes on the buggy
    // version too. That is what the first version of this test did, and it
    // reported PASS against the defect it was written to catch.
    for (const tool of RETRIEVAL_TOOLS) {
      const src = read(tool);
      const sampledLine = src.split('\n').find(l => /^\s*const sampled\s*=/.test(l));
      if (!sampledLine) continue; // does not sample
      if (!/questions\.length\s*=\s*0/.test(src)) continue; // does not truncate in place
      expect(
        sampledLine,
        `${tool} truncates a question list in place while the sampled alias may point at it`,
      ).toMatch(/\[\s*\.\.\.questions\s*\]/);
    }
  });

  it('a tool that samples says which of the two reasons left no questions', () => {
    // "No questions" has two causes: the graph yielded none, or the sample came
    // out empty. They need different fixes, and the expansion tool gave the
    // graph's answer for both. The requirement applies only to a tool that
    // SAMPLES — a tool with no sampling has one cause and one correct message.
    for (const tool of RETRIEVAL_TOOLS) {
      const src = read(tool);
      if (!/No questions/.test(src)) continue;
      if (!/stride/.test(src)) continue; // no sampling, so no second cause
      expect(src, `${tool} samples and reports an empty question set without naming the cause`)
        .toMatch(/available/);
    }
  });
});
