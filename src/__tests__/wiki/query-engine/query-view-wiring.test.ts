// PRODUCTION WIRING — the guard against "the module exists, the tests pass,
// and nothing calls it".
//
// @DocTpoint's second review (#855, 2026-10-16) found three fixes from the
// previous review round that were fully written, fully unit-tested, and reached
// by no user path: `buildWeightedRetrievalQuery` had zero production callers,
// `lexMatch` was never passed its `tables` argument, and `extractMatchedParagraphs`
// was called with an empty term list because both call sites omitted
// `queryTerms`. Every one of them had a passing test suite.
//
// A unit test that calls the function directly cannot catch this, and that is
// precisely the pattern used here before: `retrieval-history.test.ts` calls
// `buildWeightedRetrievalQuery` and asserts its output. That test passes, and
// the function is dead.
//
// `production-reachability.test.ts` is the behavioural half of the guard and
// enters at `selectPprSeeds`. It cannot see anything ABOVE that line, and all
// three of the above sit above it, in `QueryView`.
//
// This file is the structural half. It reads the source and asserts that the
// call sites pass what the fix needs. It is deliberately not a behaviour test:
// it cannot tell you the ranking improved. What it can tell you is that a fix
// cannot be silently disconnected from the product by a refactor — which is the
// failure that has now happened three times in one cycle.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { prepareRetrievalInputs } from '../../../core/retrieval-query';

/** Repo-relative source path -> absolute. Anchored on this file, not cwd. */
const srcPath = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

const QUERY_VIEW = srcPath('../../../wiki/query-engine/QueryView-class.ts');
const SELECT_SEEDS = srcPath('../../../wiki/query-engine/pipeline/select-seeds.ts');
const src = readFileSync(QUERY_VIEW, 'utf8');
const seeds = readFileSync(SELECT_SEEDS, 'utf8');

/** The body of one call, from its opening paren to the line that closes it. */
function call(source: string, name: string): string {
  const start = source.indexOf(`${name}(`);
  expect(start, `${name}( must be called`).toBeGreaterThan(-1);
  let depth = 0;
  for (let i = start + name.length; i < source.length; i += 1) {
    if (source[i] === '(') depth += 1;
    else if (source[i] === ')') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`${name}( is never closed`);
}

describe('production wiring — QueryView', () => {
  it('builds the query plan through the one shared composition', () => {
    // Three independently built strings is how the LLM ended up holding the
    // history and the gate ended up holding the expansion. The composition now
    // lives in `pipeline/retrieval-plan.ts` and every measurement tool calls
    // the same function, so there is no second copy to drift.
    const plan = call(src, 'planRetrieval');
    expect(plan).toContain('userMessage');
    expect(plan).toContain('RETRIEVAL_HISTORY_ROUNDS');
    expect(plan).toContain('this.expansionCache');
  });

  it('hands the LLM stages the question, not the history', () => {
    // #855 point 2. `query-keywords.ts` labels this "User question:".
    expect(call(src, 'selectPprSeeds')).toMatch(/\n\s*plan\.llmQuery,\s*\n/);
  });

  it('hands the escalation gate the un-expanded query', () => {
    // #855 point 3. The expansion's words sit in no name tier and can only
    // lower `nameTierCoverage`.
    expect(call(src, 'selectPprSeeds')).toMatch(/\n\s*plan\.gateQuery,\s*\n/);
  });

  it('passes queryTerms to the page loader at BOTH call sites', () => {
    // #855 fix 6. `queryTerms` is optional; a call site that omits it gets
    // `[]` back and the matched paragraphs silently become ''.
    //
    // Issue #880 review: the answer path now calls the `...WithPaths` variant,
    // because the retrieval label has to know which pages survived the token
    // budget and a body carries no path. Both variants take the same argument,
    // so the contract is the same and the pattern accepts either name.
    const calls = src.match(/loadRelevantPagesForQuery(?:WithPaths)?\([\s\S]*?\);/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(2);
    for (const c of calls) {
      expect(c, 'a call site omits queryTerms').toMatch(/_lastRetrievalTerms/);
    }
  });

  it('gives the escalation the expansion, not the bare query', () => {
    // A Chinese run handed unsegmented matches nothing and the expansion
    // returns its input verbatim — the bug that voided every number on it.
    expect(call(src, 'selectPprSeeds')).toMatch(/\n\s*plan\.expandedQuery,\s*\n/);
  });

  it('passes the BM25F tables into the answer path', () => {
    // #855 fix 5. `pprCascade` called `lexMatch(query, pages)` with no tables,
    // so the BM25F branch had no production caller and the hand-tuned weight
    // table scored every answer.
    expect(seeds).toMatch(/pprCascade\([\s\S]*?tables:/);
    // And the tables must be the FULL tier, not the name tier: the answer path
    // is the one that reads the body.
    expect(seeds).toMatch(/getFull\(/);
  });

  it('reports the pages that survived the budget, not the pages retrieval chose (#880)', () => {
    // DocTpoint, 2026-10-27: the label was built from `relevantPages`, decided
    // BEFORE `fitPagesToBudget` cuts the tail. An answer built from 6 pages
    // showed 20, so a reader checking where an answer came from was shown
    // sources the model never received.
    const labelWrites: string[] = src.match(/_lastRetrieval = \{[\s\S]*?\};/g) ?? [];
    const afterBudget = labelWrites.find((block) => block.includes('keptIndexes'));
    expect(afterBudget, 'the label must be rewritten with the kept pages').toBeDefined();

    // And the paths have to come from the loader's pairing: a body is anonymous
    // markdown, so an index into `kept` does not name a page.
    expect(src).toMatch(/loadRelevantPagesForQueryWithPaths\(/);
    expect(src).toMatch(/budget\.keptIndexes\.map\(\(i\) => loadedPagesForQuery\[i\]/);
  });

  it('keeps matchesCount on what retrieval found, not on what survived (#880)', () => {
    // `assembleWikiContext` turns `matchesCount === 0` into "No relevant pages
    // found, answer from general knowledge". `budget.keptCount` is 0 whenever
    // `rawLoadedPages` is empty — the loader skips a page it cannot read, e.g.
    // after a rename with a stale index — which tells the model it had no pages
    // while `pureLLM` stays false and no verification banner appears. The cut
    // alone cannot take the count to 0, so the pre-cut count is the honest one.
    const finalAssemble = src.slice(src.lastIndexOf('assembleWikiContext({'));
    expect(finalAssemble).toMatch(/matchesCount: relevantPages\.length/);
    expect(finalAssemble, 'keptCount is 0 when every page failed to load')
      .not.toMatch(/matchesCount: budget\.keptCount/);
  });
});
