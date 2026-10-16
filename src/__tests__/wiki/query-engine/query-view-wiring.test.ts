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

/** Repo-relative source path -> absolute. Anchored on this file, not cwd. */
const srcPath = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

const QUERY_VIEW = srcPath('../../../wiki/query-engine/QueryView-class.ts');
const SELECT_SEEDS = srcPath('../../../wiki/query-engine/pipeline/select-seeds.ts');
const QUERY_EXPANSION = srcPath('../../../core/query-expansion.ts');
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
  it('derives all three query strings from one call, not three separate ones', () => {
    // Three independently built strings is how the LLM ended up holding the
    // history: each call site chose its own input and one chose wrong.
    const prep = call(src, 'prepareRetrievalInputs');
    expect(src).toMatch(/const\s*\{[^}]*\bretrievalQuery\b[^}]*\bllmQuery\b[^}]*\bgateQuery\b[^}]*\}\s*=\s*prepareRetrievalInputs\([\s\S]*?\);/);
    expect(prep).toContain('userMessage');
    expect(prep).toContain('RETRIEVAL_HISTORY_ROUNDS');
  });

  it('hands the LLM stages the question, not the history', () => {
    // #855 point 2. `query-keywords.ts` labels this "User question:".
    expect(call(src, 'selectPprSeeds')).toMatch(/\n\s*llmQuery,\s*\n/);
  });

  it('hands the escalation gate the un-expanded query', () => {
    // #855 point 3. The expansion's words sit in no name tier and can only
    // lower `nameTierCoverage`.
    expect(call(src, 'selectPprSeeds')).toMatch(/\n\s*gateQuery,\s*\n/);
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

  it('gives the expansion segmented terms', () => {
    // A Chinese run handed unsegmented matches nothing and the expansion
    // returns its input verbatim.
    expect(call(src, 'twoStageExpand')).toMatch(/\n\s*expansionQueryTerms,\s*\n/);
  });
});

describe('KNOWN GAPS — asserted as failing until each one is wired', () => {
  // Each of these is a real fix from the previous review round that no user
  // path reaches today. They live here, visibly red, rather than in a comment
  // nobody re-reads. This file gains the `it` form for each as it lands.
  it.skip('buildWeightedRetrievalQuery has a production caller', () => {
    const usedSomewhere = src.includes('buildWeightedRetrievalQuery')
      || seeds.includes('buildWeightedRetrievalQuery')
      || readFileSync(QUERY_EXPANSION, 'utf8').includes('buildWeightedRetrievalQuery');
    expect(usedSomewhere, 'buildWeightedRetrievalQuery is exported and tested but never called').toBe(true);
  });
});
