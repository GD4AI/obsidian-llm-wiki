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

  it('passes queryTerms to loadRelevantPagesForQuery at BOTH call sites', () => {
    // #855 fix 6. `queryTerms` is optional; a call site that omits it gets
    // `[]` back and the matched paragraphs silently become ''.
    const calls = src.match(/loadRelevantPagesForQuery\([\s\S]*?\);/g) ?? [];
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

  it('attaches a handler to every sendMessage call site (#914)', () => {
    // `sendMessage` can reject: a throw in its DOM setup sits above its own
    // error boundary, and `reportQueryFailure` only runs from the `.catch()`
    // here. A `void this.sendMessage(...)` with no handler is an unhandled
    // rejection, which the user reads as "nothing happened" — and it leaves
    // `isStreaming` set, so the pane refuses every later query.
    //
    // Structural rather than behavioural on purpose: the behaviour of
    // `reportQueryFailure` is covered in `query-view-pre-answer-error.test.ts`,
    // and driving the real handlers would mean rebuilding `onOpen()`. What
    // this can catch is the failure a refactor causes — a third call site, or
    // a handler that gets dropped from one of the two.
    const callSites = src.match(/void this\.sendMessage\([^;]*;/g) ?? [];
    expect(callSites.length, 'sendMessage must be called from the two handlers').toBe(2);
    for (const site of callSites) {
      expect(site, `call site without a rejection handler: ${site}`).toMatch(/\.catch\(/);
    }
  });
});
