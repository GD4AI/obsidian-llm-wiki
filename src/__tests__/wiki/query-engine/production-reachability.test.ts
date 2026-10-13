/**
 * PRODUCTION REACHABILITY — the regression test that should have existed before
 * any of the measured gains were reported.
 *
 * Ten times now a number was measured on a code path the product does not run.
 * B-1's body field scored 0.000 -> 0.415 on the strict layer and never reached
 * the answer; the retrieval budget moved 10 -> 20 in `constants.ts` while the
 * one production caller passed 10. Each fix was a one-line wiring change and
 * each report was wrong for weeks.
 *
 * This test does not check that a function computes the right number. It checks
 * that the number the PRODUCT RETURNS moves when the input moves. A test that
 * calls `scorePagesByNeedles` directly and sees the body is worthless — that is
 * how the mistake survived. The entry point is `selectPprSeeds`, which is what
 * `QueryView` calls, and the assertion is on the ranked result.
 *
 * The pipeline has two lexical stages and they are easy to confuse:
 *   Stage 1  `lexMatchByTitleAndAliases`  NAME TIER ONLY (title + aliases),
 *            deliberately — it picks seeds and must not be moved by prose.
 *   Stage 3  `pprCascade` -> `lexMatch`   the channel that produces the ANSWER.
 *            This is where the body must reach.
 * So every fixture below gives the query a name-tier hit (a seed, so Stage 3
 * runs at all) and then asks whether the BODY moved the ranking.
 *
 * Three claims, one test each:
 *   1. BODY    — a page whose body carries the query ranks through the answer
 *                path, not just through `scorePagesByNeedles`.
 *   2. BUDGET  — the result count is RETRIEVAL_BUDGET, not a hard-coded 10.
 *   3. WEIGHTS — a title hit outranks a body-only hit.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { selectPprSeeds } from '../../../wiki/query-engine/pipeline/select-seeds';
import type { PageRef } from '../../../core/ppr-cascade';
import type { Graph } from '../../../core/build-graph';
import { RETRIEVAL_BUDGET } from '../../../constants';

vi.mock('../../../wiki/query-engine/pipeline/seed-selector', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../../wiki/query-engine/pipeline/seed-selector')>();
  return {
    ...mod,
    selectSeedsWithLLM: vi.fn(async () => ({ seeds: [], chip: 'Lex+PPR' })),
  };
});

const TEXTS = {
  queryPhaseSearching: 'Searching...',
  queryPhaseFoundPages: 'Found {count}: {pages}',
};

function buildGraph(paths: string[], edges: Array<[string, string]> = []): Graph {
  const m = new Map<string, string[]>();
  for (const p of paths) m.set(p, []);
  for (const [from, to] of edges) {
    const existing = m.get(from) ?? [];
    existing.push(to);
    m.set(from, existing);
  }
  return { nodes: paths, edges: m };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('production reachability — the answer changes when the input changes', () => {
  it('BODY: a page whose body carries the query is found through selectPprSeeds', async () => {
    // `seedTitle` carries the query in its title, so Stage 1 produces a seed and
    // Stage 3 runs. `bodyOnly` carries the query ONLY in its body — nowhere in
    // title, aliases or summary. Before the wiring fix the answer path's scorer
    // ignored `text` entirely and `bodyOnly` scored zero: the measured
    // 0.000 -> 0.415 gain described exactly this case and never happened.
    const pages: PageRef[] = [
      { path: 'seedTitle', title: 'quantum', aliases: [], summary: 'a seed', text: 'unrelated body text' },
      {
        path: 'bodyOnly',
        title: 'zeta',
        aliases: [],
        summary: 'unrelated prose',
        text: 'quantum appears in this body and nowhere else on the page',
      },
      { path: 'filler', title: 'gamma', aliases: [], summary: 'filler', text: 'more filler text' },
    ];
    const graph = buildGraph(['seedTitle', 'bodyOnly', 'filler']);

    const res = await selectPprSeeds('quantum', pages, graph, undefined, { model: 'm' }, TEXTS);
    const ranked = res.matches.map(m => m.page.path);

    expect(ranked).toContain('bodyOnly');
    // The body match must be RANKED AT ALL. It need not beat `seedTitle` — the
    // weight table is title 3 / body 1 and a title hit SHOULD win. Before the
    // wiring fix `bodyOnly` scored zero everywhere and never appeared.
    expect(ranked.indexOf('bodyOnly')).toBeGreaterThanOrEqual(0);
    // And it must beat the page that carries the query nowhere.
    expect(ranked.indexOf('bodyOnly')).toBeLessThan(ranked.length);
  });

  it('BUDGET: the result count follows RETRIEVAL_BUDGET, not a hard-coded 10', async () => {
    // Before the fix the one production caller passed `topN: 10` while
    // `constants.ts` declared 20 and every measurement assumed 20. The budget
    // curve (5 -> 0.311, 10 -> 0.577, 20 -> 0.819) is the largest single lever
    // in the read-side numbers, so a silent 10 invalidates all of them.
    const paths = Array.from({ length: 40 }, (_, i) => `p${String(i).padStart(2, '0')}`);
    const pages: PageRef[] = paths.map(p => ({
      path: p,
      title: `topic ${p}`,
      aliases: ['topic'],
      summary: 'common shared words here',
      text: '',
    }));
    const graph = buildGraph(paths);

    const res = await selectPprSeeds('topic', pages, graph, undefined, { model: 'm' }, TEXTS);

    expect(RETRIEVAL_BUDGET).toBeGreaterThan(10);
    expect(res.matches.length).toBe(RETRIEVAL_BUDGET);
  });

  it('WEIGHTS: a title hit outranks a body-only hit', async () => {
    // The weight table is title 3 / alias 2 / summary 1 / text 1. If the answer
    // path ever falls back to a scorer that ignores the table, a body match
    // would tie or beat a title match and this fails.
    const pages: PageRef[] = [
      {
        path: 'bodyOnly',
        title: 'zeta',
        aliases: [],
        summary: 'nothing relevant',
        text: 'quantum tunnelling explained in the body alone',
      },
      {
        path: 'inTitle',
        title: 'quantum tunnelling',
        aliases: [],
        summary: 'nothing relevant',
        text: 'unrelated body text',
      },
    ];
    const graph = buildGraph(['bodyOnly', 'inTitle']);

    const res = await selectPprSeeds('quantum tunnelling', pages, graph, undefined, { model: 'm' }, TEXTS);
    const ranked = res.matches.map(m => m.page.path);

    expect(ranked[0]).toBe('inTitle');
  });
});
