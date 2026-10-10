/**
 * #729 Phase 6 — the assembly step.
 *
 * The first test reproduces the measured symptom and shows the rule fixing it.
 * 「强化学习 推理能力」 had ten sources in the top-50 pool and loaded one. If a
 * change cannot beat that on a pool constructed to look like it, the change is
 * not doing what the issue asked for.
 */

import { describe, it, expect } from 'vitest';
import {
  rrfFuse,
  maxFuse,
  assembleWithCoverage,
  RRF_K,
  type Assemblable,
} from '../../core/assembly';

function page(key: string, sourceSlug?: string): Assemblable {
  return sourceSlug === undefined ? { key } : { key, sourceSlug };
}

describe('maxFuse — a page one channel likes keeps that score (#819, max fusion)', () => {
  /**
   * RRF sums the two channels' contributions. When ppr ranks a page third and
   * lex ranks it 200th, the sum drags it down and the answer is lost. Taking the
   * LARGER of the two normalised scores is what the reader needs: each channel
   * speaks on the questions it is good at and is not diluted by the other.
   *
   * No parameter. No threshold. This is the whole rule.
   */
  it('keeps the higher channel score instead of averaging the two', () => {
    const fused = maxFuse([
      { channel: 'lex', candidates: [{ item: page('a'), rank: 1 }, { item: page('b'), rank: 200 }] },
      { channel: 'ppr', candidates: [{ item: page('b'), rank: 3 }, { item: page('c'), rank: 4 }] },
    ]);
    const byKey = new Map(fused.map(f => [f.item.key, f.score]));
    // b is rank 3 on ppr and rank 200 on lex. Under a sum its high ppr standing
    // is diluted. Under max it keeps the ppr value.
    expect(byKey.get('b')).toBeCloseTo(1 / (60 + 3) / (1 / (60 + 3)));
  });

  it('normalises each channel by its own best score', () => {
    // lex scores on a wildly different scale from ppr. Without per-channel
    // normalisation the larger-scale channel would win every tie.
    const fused = maxFuse([
      { channel: 'lex', candidates: [{ item: page('a'), rank: 1 }] },
      { channel: 'ppr', candidates: [{ item: page('b'), rank: 1 }] },
    ]);
    for (const f of fused) expect(f.score).toBeCloseTo(1);
  });

  it('a page in only one channel scores on that channel alone', () => {
    const fused = maxFuse([
      { channel: 'lex', candidates: [{ item: page('a'), rank: 1 }, { item: page('b'), rank: 2 }] },
      { channel: 'ppr', candidates: [{ item: page('c'), rank: 1 }] },
    ]);
    const byKey = new Map(fused.map(f => [f.item.key, f.score]));
    expect(byKey.get('b')).toBeGreaterThan(0);
    expect(byKey.get('c')).toBeCloseTo(1);
  });

  it('the same page from BOTH channels takes the larger, and records both', () => {
    const fused = maxFuse([
      { channel: 'lex', candidates: [{ item: page('a'), rank: 1 }] },
      { channel: 'ppr', candidates: [{ item: page('a'), rank: 5 }] },
    ]);
    expect(fused).toHaveLength(1);
    expect(fused[0].score).toBeCloseTo(1);
    expect(fused[0].channels).toBe(2);
  });

  it('an empty channel contributes nothing and does not divide by zero', () => {
    const fused = maxFuse([
      { channel: 'lex', candidates: [] },
      { channel: 'ppr', candidates: [{ item: page('a'), rank: 1 }] },
    ]);
    expect(fused).toHaveLength(1);
    expect(fused[0].score).toBeCloseTo(1);
    expect(Number.isFinite(fused[0].score)).toBe(true);
  });

  it('beats the RRF sum on the case it was built for', () => {
    // The defect, stated as a test: ppr finds the answer at rank 3, lex cannot
    // find it at all. Under RRF the answer loses to a page both channels mildly
    // like. Under max it wins.
    const lists = [
      { channel: 'lex', candidates: [{ item: page('noise1'), rank: 1 }, { item: page('noise2'), rank: 2 }, { item: page('answer'), rank: 200 }] },
      { channel: 'ppr', candidates: [{ item: page('answer'), rank: 3 }, { item: page('noise1'), rank: 10 }, { item: page('noise2'), rank: 11 }] },
    ];
    const rrf = rrfFuse(lists);
    const max = maxFuse(lists);
    const rankOf = (arr: Array<{ item: { key: string } }>, key: string) =>
      arr.findIndex(f => f.item.key === key);
    expect(rankOf(max, 'answer')).toBeLessThan(rankOf(rrf, 'answer'));
  });
});

describe('rrfFuse', () => {
  it('a page in two channels outranks a page in one at the same rank', () => {
    const a = page('a', 's1');
    const b = page('b', 's2');
    const fused = rrfFuse([
      { channel: 'lex', candidates: [{ item: a, rank: 1 }, { item: b, rank: 2 }] },
      { channel: 'ppr', candidates: [{ item: a, rank: 1 }] },
    ]);
    expect(fused[0].item.key).toBe('a');
    expect(fused[0].channels).toBe(2);
    expect(fused[1].channels).toBe(1);
  });

  it('never looks at a score — no scale to reconcile', () => {
    // The old `mergeWithPPR` added `ppr + hint × 0.1 × maxPpr`: two score
    // scales with no shared unit, joined by a hand-picked coefficient. RRF
    // adds 1/(k+rank) and there is no coefficient in it.
    const a = page('a', 's1');
    const b = page('b', 's2');
    const one = rrfFuse([
      { channel: 'x', candidates: [{ item: a, rank: 1 }, { item: b, rank: 2 }] },
    ]);
    const two = rrfFuse([
      { channel: 'x', candidates: [{ item: a, rank: 1 }, { item: b, rank: 2 }] },
    ]);
    expect(one).toEqual(two);
    expect(one[0].score).toBeCloseTo(1 / (RRF_K + 1));
  });

  it('rank and agreement both count — and at k=60 agreement can outweigh rank', () => {
    // Measured, not assumed: 1/(60+1) = 0.0164 against 2×1/(60+50) = 0.0182.
    // Two channels agreeing on a page DO beat one channel's top pick at this k.
    // That is the design — cross-channel agreement is the signal RRF exists to
    // capture — and stating it here stops someone "fixing" it later.
    const top = page('top', 's1');
    const tail = page('tail', 's2');
    const fused = rrfFuse([
      { channel: 'a', candidates: [{ item: top, rank: 1 }] },
      { channel: 'b', candidates: [{ item: tail, rank: 50 }] },
      { channel: 'c', candidates: [{ item: tail, rank: 50 }] },
    ]);
    expect(fused[0].item.key).toBe('tail');
    expect(fused[0].channels).toBe(2);
  });

  it('a single rank-1 beats a single rank-50 — rank always contributes more', () => {
    const top = page('top', 's1');
    const tail = page('tail', 's2');
    const fused = rrfFuse([
      { channel: 'a', candidates: [{ item: top, rank: 1 }, { item: tail, rank: 50 }] },
    ]);
    expect(fused[0].item.key).toBe('top');
  });

  it('is deterministic and breaks ties on key, never on input order', () => {
    const a = page('a', 's1');
    const b = page('b', 's1');
    const one = rrfFuse([{ channel: 'x', candidates: [{ item: a, rank: 1 }, { item: b, rank: 1 }] }]);
    const two = rrfFuse([{ channel: 'x', candidates: [{ item: b, rank: 1 }, { item: a, rank: 1 }] }]);
    expect(one.map(r => r.item.key)).toEqual(two.map(r => r.item.key));
    expect(one.map(r => r.item.key)).toEqual(['a', 'b']);
  });

  it('an empty list is empty, not an error', () => {
    expect(rrfFuse([])).toEqual([]);
    expect(rrfFuse([{ channel: 'x', candidates: [] }])).toEqual([]);
  });
});

describe('assembleWithCoverage — the issue own symptom', () => {
  it('ten sources in the pool do not collapse into one', () => {
    // The measured case: 「强化学习 推理能力」, top-50 across ten sources,
    // top-10 loading one. Constructed so the fix has something to beat: one
    // source holds every top score, which is what the naive cut takes.
    const candidates = [];
    for (let j = 0; j < 10; j += 1) {
      candidates.push({ item: page(`dominant-${j}`, 'paper-0'), score: 100 - j });
    }
    for (let i = 1; i < 10; i += 1) {
      for (let j = 0; j < 3; j += 1) {
        candidates.push({
          item: page(`s${i}-p${j}`, `paper-${i}`),
          score: 50 - i * 0.1 - j * 0.01,
        });
      }
    }
    const naive = [...candidates].sort((a, b) => b.score - a.score).slice(0, 10);
    const naiveSources = new Set(naive.map(c => c.item.sourceSlug)).size;
    const result = assembleWithCoverage(candidates, 10, { lambda: 0.25 });
    // The naive cut loads only the dominant source. That is the symptom.
    expect(naiveSources).toBe(1);
    expect(result.pickedSources).toBeGreaterThan(naiveSources);
    expect(result.dominantShare).toBeLessThan(0.5);
  });

  it('diminishing return is monotone — a higher score never ranks lower at equal coverage', () => {
    const candidates = [
      { item: page('low', 's1'), score: 1 },
      { item: page('high', 's2'), score: 2 },
    ];
    const r = assembleWithCoverage(candidates, 2);
    expect(r.picked[0].item.key).toBe('high');
  });

  it('the first page from a source is full, the second is damped by lambda', () => {
    // The claim this test used to make — "there is no lambda here to
    // calibrate" — was WRONG and is retracted. The form is fixed but its
    // strength is set implicitly by the score scale, and it is now explicit.
    const candidates = [
      { item: page('a', 's1'), score: 10 },
      { item: page('b', 's1'), score: 10 },
      { item: page('c', 's2'), score: 6 },
    ];
    // At lambda 1 the second s1 page falls to 5 and loses to c's 6. At 0.25 it
    // falls only to 8 and stays ahead — the damping is a preference, not an
    // eviction. The default is now lambda 0, so it is passed explicitly here.
    const r1 = assembleWithCoverage(candidates, 2, { lambda: 1 });
    expect(r1.picked.map(p => p.item.key)).toEqual(['a', 'c']);
    expect(r1.picked[1].effective).toBeCloseTo(6);

    const r = assembleWithCoverage(candidates, 2, { lambda: 0.25 });
    expect(r.picked.map(p => p.item.key)).toEqual(['a', 'b']);
    expect(r.picked[0].effective).toBeCloseTo(10);
    expect(r.picked[1].effective).toBeCloseTo(8);

    // Lambda 0 does not damp at all: the second s1 page keeps its full score.
    const r0 = assembleWithCoverage(candidates, 2);
    expect(r0.picked.map(p => p.item.key)).toEqual(['a', 'b']);
    expect(r0.picked[1].effective).toBeCloseTo(10);
  });

  it('never penalises a page with no source ref — that is the blind spot, not a choice', () => {
    // 75 % of the measured mixed-generation vault carries no `sources:` ref.
    // Pushing those down would not be diversity; it would punish the layer's
    // own blind spot.
    const candidates = [
      { item: page('bare-1'), score: 10 },
      { item: page('bare-2'), score: 9 },
      { item: page('sourced', 's1'), score: 8 },
    ];
    const r = assembleWithCoverage(candidates, 3);
    expect(r.picked.map(p => p.item.key)).toEqual(['bare-1', 'bare-2', 'sourced']);
    expect(r.unattributedPicked).toBe(2);
  });

  it('reports a single-source pool rather than pretending to fix it', () => {
    const candidates = [
      { item: page('a', 'only'), score: 10 },
      { item: page('b', 'only'), score: 9 },
    ];
    const r = assembleWithCoverage(candidates, 2);
    expect(r.singleSourcePool).toBe(true);
    expect(r.unattributedPool).toBe(false);
    expect(r.pickedSources).toBe(1);
  });

  it('reports an unattributed pool as blind, which is not the same as narrow', () => {
    const candidates = [
      { item: page('a'), score: 10 },
      { item: page('b'), score: 9 },
    ];
    const r = assembleWithCoverage(candidates, 2);
    expect(r.unattributedPool).toBe(true);
    expect(r.singleSourcePool).toBe(false);
    expect(r.poolSources).toBe(0);
  });

  it('honours the budget', () => {
    const candidates = Array.from({ length: 20 }, (_, i) => ({
      item: page(`p${i}`, `s${i}`), score: 20 - i,
    }));
    expect(assembleWithCoverage(candidates, 5).picked).toHaveLength(5);
    expect(assembleWithCoverage(candidates, 0).picked).toHaveLength(0);
  });

  it('is deterministic', () => {
    const candidates = [
      { item: page('a', 's1'), score: 5 },
      { item: page('b', 's1'), score: 5 },
      { item: page('c', 's2'), score: 5 },
    ];
    const r1 = assembleWithCoverage(candidates, 3);
    const r2 = assembleWithCoverage(candidates, 3);
    expect(r1.picked.map(p => p.item.key)).toEqual(r2.picked.map(p => p.item.key));
    // Lambda 0 is plain score order.
    expect(r1.picked.map(p => p.item.key)).toEqual(['a', 'b', 'c']);
  });

  it('reports dominant share so a reader can see the collapse', () => {
    const candidates = [
      { item: page('a', 's1'), score: 10 },
      { item: page('b', 's1'), score: 9 },
      { item: page('c', 's1'), score: 8 },
    ];
    const r = assembleWithCoverage(candidates, 3);
    expect(r.dominantShare).toBeCloseTo(1);
    expect(r.pickedSources).toBe(1);
  });

  it('the pool source count is the window, not the vault', () => {
    // Counting the whole vault makes every pool look rich and hides the case
    // the limit is about. The candidates passed in ARE the window.
    const window = [
      { item: page('a', 's1'), score: 3 },
      { item: page('b', 's2'), score: 2 },
    ];
    expect(assembleWithCoverage(window, 2).poolSources).toBe(2);
    const narrow = [{ item: page('a', 's1'), score: 3 }];
    expect(assembleWithCoverage(narrow, 1).poolSources).toBe(1);
  });
});

describe('coverage lambda — the relevance cost is measured, not assumed (#819 step 4)', () => {
  /**
   * The scenario from the external review. One source holds EIGHT relevant
   * pages at ranks 1-8. Eleven other sources hold one irrelevant page each at
   * ranks 9-19. Budget 10. Source count alone calls every answer a win: at
   * lambda 1 it reports 10 sources and a 10% dominant share while loading ONE
   * of the eight pages that answer the question.
   */
  const scenario = () => {
    const cand = [];
    for (let i = 0; i < 8; i += 1) {
      cand.push({ item: { key: `A${i}`, sourceSlug: 'A' }, score: 0.0164 - i * 0.0001 });
    }
    for (let i = 0; i < 11; i += 1) {
      cand.push({ item: { key: `S${i}`, sourceSlug: `S${i}` }, score: 0.0091 - i * 0.00005 });
    }
    return cand;
  };

  const loadedRelevant = (lambda: number) =>
    assembleWithCoverage(scenario(), 10, { lambda }).picked.filter(p => p.sourceSlug === 'A').length;

  it('lambda 0 keeps every relevant page but gives up the diversity', () => {
    expect(loadedRelevant(0)).toBe(8);
  });

  it('lambda 1 loads only ONE of the eight — the cost the review named', () => {
    expect(loadedRelevant(1)).toBe(1);
  });

  it('the default is lambda 0 — the diversity rule is OFF until one is chosen', () => {
    // The calibration that put 0.25 here was done on raw BM25F scores while
    // production serves RRF scores. Under RRF every lambda above zero costs
    // 25-55% of the co-citation recall across three vaults, and what it buys is
    // source count. So the default is the no-diversity rule.
    const r = assembleWithCoverage(scenario(), 10);
    expect(r.picked.filter(p => p.sourceSlug === 'A').length).toBe(8);
    expect(r.pickedSources).toBe(3);
  });

  it('lambda 0.25 keeps four of the eight for one source less', () => {
    const r = assembleWithCoverage(scenario(), 10, { lambda: 0.25 });
    expect(r.picked.filter(p => p.sourceSlug === 'A').length).toBe(4);
    expect(r.pickedSources).toBe(7);
  });

  it('lambda 0.5 keeps twice as many relevant pages for one source less', () => {
    const r = assembleWithCoverage(scenario(), 10, { lambda: 0.5 });
    expect(r.picked.filter(p => p.sourceSlug === 'A').length).toBe(2);
    expect(r.pickedSources).toBe(9);
  });

  it('the penalty is monotone in lambda — raising it never loads MORE from one source', () => {
    let prev = Infinity;
    for (const lambda of [0, 0.25, 0.5, 1, 2, 5]) {
      const n = loadedRelevant(lambda);
      expect(n).toBeLessThanOrEqual(prev);
      prev = n;
    }
  });
});
