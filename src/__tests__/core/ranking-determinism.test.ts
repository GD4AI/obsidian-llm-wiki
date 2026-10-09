// ranking-determinism.test.ts — the ranking must be a function, not a lottery.
//
// Two defects let the same input give different answers:
//
//   1. `monte-carlo-ppr.ts:53` defaulted `rng` to `Math.random` over 3000
//      walks, so every query re-ran to a different ranking. #729's measurement
//      cannot separate two arms under that variance, and a user who asks twice
//      gets two answers.
//
//   2. The score sorts broke ties by the caller's array order, so the cut fell
//      inside a group of equals and the winner was whoever happened to be
//      first. @DocTpoint measured half of M0's selection following the
//      iteration order.
//
// The fix is not "sort by path only". That replaces an ordering nobody chose
// with an alphabetical one — the same defect in a different hat. Ties break by
// the breadth of the match first (more distinct needles matched is a better
// page), and only then by a stable identity.

import { describe, it, expect } from 'vitest';
import { makeSeededRng, seededRngFrom } from '../../core/monte-carlo-ppr';

describe('seededRngFrom — the seed is the request, not the world', () => {
  // Regression. The seed used to include the graph size, so adding an
  // unrelated page changed every walk's randomness and moved rankings that had
  // nothing to do with the change. A rerun is only a rerun if the seed depends
  // on what was asked.
  it('is unaffected by the size of the graph', () => {
    // The old signature took graphSize and mixed it into the seed. It is gone:
    // there is no size to pass, and that is the assertion.
    const a = seededRngFrom('query', ['s1', 's2']);
    const b = seededRngFrom('query', ['s1', 's2']);
    expect(a()).toBe(b());
  });

  it('depends on the query and the seed set, and on nothing else', () => {
    const base = seededRngFrom('q', ['a', 'b'])();
    expect(seededRngFrom('q', ['a', 'b'])()).toBe(base);
    expect(seededRngFrom('other', ['a', 'b'])()).not.toBe(base);
    expect(seededRngFrom('q', ['a', 'c'])()).not.toBe(base);
  });

  it('is independent of seed order — the set is sorted before hashing', () => {
    expect(seededRngFrom('q', ['a', 'b'])()).toBe(seededRngFrom('q', ['b', 'a'])());
  });
});
import { scorePagesByNeedles, type PageRef } from '../../core/ppr-cascade';
import { selectCandidateWindow, type WindowPage } from '../../core/candidate-window';

function page(path: string, title: string, aliases: string[] = [], summary?: string): PageRef {
  return { path, title, aliases, summary };
}

describe('makeSeededRng', () => {
  it('gives the same sequence for the same seed', () => {
    const a = makeSeededRng('query-1');
    const b = makeSeededRng('query-1');
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it('gives a different sequence for a different seed', () => {
    const a = makeSeededRng('query-1');
    const b = makeSeededRng('query-2');
    expect([a(), a()]).not.toEqual([b(), b()]);
  });

  it('stays inside [0, 1)', () => {
    const rng = makeSeededRng('range');
    for (let i = 0; i < 500; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('spreads over [0, 1) rather than clustering', () => {
    // A constant generator would pass the two tests above if both seeds
    // happened to collide. Check the distribution has width.
    const rng = makeSeededRng('spread');
    const values = Array.from({ length: 2000 }, () => rng());
    const min = Math.min(...values);
    const max = Math.max(...values);
    expect(max - min).toBeGreaterThan(0.5);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    expect(mean).toBeGreaterThan(0.35);
    expect(mean).toBeLessThan(0.65);
  });

  it('derives one rng from the query and the seed set', () => {
    const one = seededRngFrom('what is this', ['a/b'])();
    const two = seededRngFrom('what is this', ['a/b'])();
    const other = seededRngFrom('what is this', ['a/c'])();
    expect(one).toBe(two);
    expect(one).not.toBe(other);
  });
});

describe('scorePagesByNeedles — ties do not follow the array', () => {
  // Both pages match both needles once, so the total score is equal. Page b
  // matches on breadth (two different fields) and should win on that alone.
  const broad = page('x/b', 'alpha', ['beta']);
  const narrow = page('x/a', 'alphabetism');

  it('breaks a score tie by breadth of match first', () => {
    // narrow: "alpha" hits the title (3) and "beta" hits nothing => score 3, 1 needle
    // broad:  "alpha" hits the title (3) and "beta" hits the alias (2) => score 5
    // Not a tie — so construct one deliberately below.
    //
    // This one is routed to the legacy scorer on purpose. The tie it builds
    // relies on substring matching — `alphabet` hits the needle `alpha` — and
    // on the legacy absolute scores, so both pages come out at 5. Under BM25F
    // `alpha` and `alphabet` are distinct terms and there is no tie to break,
    // which is exactly the property the plan claims for continuous scores:
    // ties become rare rather than common. The tie-break itself is still
    // exercised below on pages that are identical.
    const tiedA = page('x/a', 'alpha', ['beta']);
    const tiedB = page('x/b', 'alphabet', ['betamax']);
    const r = scorePagesByNeedles([tiedB, tiedA], ['alpha', 'beta'], { scorer: 'legacy' });
    expect(r[0].score).toBe(r[1].score);
    expect(r[0].page.path).toBe('x/a');
  });

  it('a tie is rare under BM25F — distinct terms do not tie', () => {
    // The same pair, scored by the default (BM25F). `alpha` and `alphabet` are
    // distinct terms, so B does not match the query at all and drops out rather
    // than tying. The legacy scorer's substring match is what made the two pages
    // comparable in the first place. This is the anomaly the plan says
    // continuous scores remove.
    const tiedA = page('x/a', 'alpha', ['beta']);
    const tiedB = page('x/b', 'alphabet', ['betamax']);
    const r = scorePagesByNeedles([tiedB, tiedA], ['alpha', 'beta']);
    expect(r.map(x => x.page.path)).toEqual(['x/a']);
  });

  it('breaks a full tie by path ascending', () => {
    const r = scorePagesByNeedles([narrow, broad], ['nothing']);
    expect(r).toEqual([]);
    const tiedA = page('x/a', 'alpha');
    const tiedB = page('x/b', 'alpha');
    const r1 = scorePagesByNeedles([tiedB, tiedA], ['alpha']);
    const r2 = scorePagesByNeedles([tiedA, tiedB], ['alpha']);
    expect(r1.map(x => x.page.path)).toEqual(['x/a', 'x/b']);
    expect(r2.map(x => x.page.path)).toEqual(r1.map(x => x.page.path));
  });

  it('is order-independent on a shuffled pool', () => {
    const pool = [
      page('m/one', 'alpha', ['beta']),
      page('a/two', 'alpha'),
      page('z/three', 'alphabet', ['betamax']),
      page('b/four', 'gamma', ['alpha']),
    ];
    const forward = scorePagesByNeedles(pool, ['alpha', 'beta']).map(x => x.page.path);
    const backward = scorePagesByNeedles([...pool].reverse(), ['alpha', 'beta']).map(x => x.page.path);
    expect(backward).toEqual(forward);
  });
});

describe('selectCandidateWindow — the pool order is a contract, not a lottery', () => {
  const wp = (path: string, title: string, text = ''): WindowPage => ({ path, title, text });

  it('keeps the caller\'s pool order on a score tie', () => {
    // Pinned on purpose, and it reads as wrong at first sight. A change to
    // path-ascending here was tried and reverted on 2026-10-07: callers pass
    // the pool ctime-ascending, and the dedup prompt's KV-prefix cache depends
    // on that order holding across calls. See
    // `src/__tests__/wiki/page-factory/dedup-prompt-order.test.ts`.
    //
    // So the tie here is deterministic and load-bearing. The tie lottery
    // #729 measured is in the seed ranking, fixed in `scorePagesByNeedles`
    // above — where nothing depended on the order.
    const pool = [
      wp('x/3', 'alpha', 'alpha beta'),
      wp('x/1', 'alpha', 'alpha beta'),
      wp('x/2', 'alpha', 'alpha beta'),
    ];
    const one = selectCandidateWindow({ name: 'alpha', context: 'alpha beta' }, pool, 2);
    expect(one.map(p => p.path)).toEqual(['x/3', 'x/1']);
  });
});
