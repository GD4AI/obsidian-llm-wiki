// core/assembly.ts — #729 Phase 6: the assembly step.
//
// This is where the issue's own symptom lives. Measured on the maintainer's
// `wiki/`: the top-50 candidates for six realistic questions cover **9.3
// distinct sources** on average, and the top-10 that actually loads covers
// **3.5**, with the dominant source holding **77 %**. On the controlled vault:
// 4.8 against 3.3. The cleanest case —「强化学习 推理能力」— had ten sources in
// the pool and loaded **one**.
//
// So the pool is not short of cross-source pages. The selection throws them
// away. That is what the issue's "reserved budget" was always about, and its
// native home is a selection rule, not a new kind of edge in the graph.
//
// Two pieces, each replacing something hand-rolled:
//
//   1. RRF fusion (`k = 60`). The old `mergeWithPPR` fused two rankings as
//      `ppr + hint × 0.1 × maxPpr` — a hand-written quantity addition across
//      two score scales that do not share units. Reciprocal rank fusion adds
//      `1 / (k + rank)` and never looks at the score at all, so nothing has to
//      be normalised and no coefficient is chosen for a scale.
//
//   2. Source coverage. A greedy pick whose marginal return falls as a source
//      gets covered: `effective = score / (1 + alreadyTakenFromThisSource)`.
//      Diminishing, monotone, and — the part that matters — **it introduces no
//      constant**. There is no lambda to calibrate and no threshold to guess,
//      which is the failure mode this whole line of work keeps running into.
//
// Two limits come with the layer and both are measured, not assumed. It can
// only act on pages carrying a `sources:` ref: 97 % of a freshly generated
// vault, **25 % of the maintainer's mixed-generation one** (538 of 2141). And
// one measured question had a single-source candidate window, where no
// selection rule can diversify anything. The diagnostic reports both rather
// than letting a reader blame the layer for a pool it cannot fix.

/** One ranked list from one retrieval channel (lex, PPR, keywords, …). */
export interface RankedCandidate<T> {
  readonly item: T;
  readonly rank: number;
}

/** What the assembly step needs to know about a page. */
export interface Assemblable {
  /** Stable identity, used only for tie-breaking. */
  readonly key: string;
  /** Source note slug, or undefined when the page carries no `sources:` ref. */
  readonly sourceSlug?: string;
}

/**
 * A candidate the assembly step can compare across tiers.
 *
 * `tier` is a lexicographic band, not a weight. Lower tier always picks first.
 * It exists because one ordering guarantee is not a preference but a promise:
 * the query path pays for seed pages with an LLM call, and a ranking that lets
 * an unreached keyword hit displace them throws away what that call bought.
 * Measured once already — with 76 lex hits the top ten were all lex and the
 * seeds were gone. A band preserves the promise with no coefficient, so there
 * is nothing to calibrate.
 */
export interface Tiered extends Assemblable {
  readonly tier?: number;
}

export interface RrfInput<T> {
  readonly candidates: readonly RankedCandidate<T>[];
  /** Not used in the formula; reported so a reader can tell channels apart. */
  readonly channel: string;
}

/** The RRF constant. 60 is the literature default and is not tuned here. */
export const RRF_K = 60;

/**
 * Reciprocal rank fusion over one or more ranked lists.
 *
 * Score is `sum over lists of 1 / (k + rank)`. A page appearing in several
 * lists accumulates, which is the point: agreement across channels is the
 * signal, and neither channel's score scale has to be reconciled with the
 * other's.
 *
 * Pure. Deterministic. Ties break on `key` ascending, never on input order.
 */
export function rrfFuse<T extends Assemblable>(
  lists: readonly RrfInput<T>[],
  k: number = RRF_K,
): Array<{ item: T; score: number; channels: number }> {
  const byKey = new Map<string, { item: T; score: number; channels: number }>();
  for (const list of lists) {
    for (const { item, rank } of list.candidates) {
      const contribution = 1 / (k + rank);
      const existing = byKey.get(item.key);
      if (existing) {
        existing.score += contribution;
        existing.channels += 1;
      } else {
        byKey.set(item.key, { item, score: contribution, channels: 1 });
      }
    }
  }
  return [...byKey.values()].sort(
    (a, b) => b.score - a.score || (a.item.key < b.item.key ? -1 : a.item.key > b.item.key ? 1 : 0),
  );
}

export interface AssemblyResult<T> {
  readonly picked: Array<{ item: T; score: number; effective: number; sourceSlug: string | null }>;
  /** Distinct sources among what was picked. */
  readonly pickedSources: number;
  /** Distinct sources in the candidate pool. 0 when nothing carries a ref. */
  readonly poolSources: number;
  /** Largest single source's share of the picked set, 0 to 1. */
  readonly dominantShare: number;
  /** Pages picked that carry no source ref — invisible to the coverage rule. */
  readonly unattributedPicked: number;
  /** True when the pool itself is single-source. The layer cannot fix that. */
  readonly singleSourcePool: boolean;
  /** True when the pool carries no source ref at all — the blind case. */
  readonly unattributedPool: boolean;
}

/**
 * Greedy pick with diminishing return per source.
 *
 * `effective = score / (1 + alreadyTakenFromThisSource)`. The first page from a
 * source is worth its full score; the second is worth half; the third a third.
 * That is the whole rule. It is monotone — a higher score never ranks lower —
 * and it has no coefficient, so there is nothing here to calibrate wrong.
 *
 * Pages with no `sourceSlug` are never penalised. Penalising them would push
 * down the 75 % of an old vault that carries no ref, which is not diversity,
 * it is punishing the layer's own blind spot.
 *
 * Pure. Deterministic. Ties break on `key`.
 */
export function assembleWithCoverage<T extends Tiered>(
  candidates: ReadonlyArray<{ item: T; score: number }>,
  budget: number,
): AssemblyResult<T> {
  const poolSources = new Set<string>();
  for (const c of candidates) {
    if (c.item.sourceSlug !== undefined) poolSources.add(c.item.sourceSlug);
  }
  const remaining = [...candidates].sort(
    (a, b) =>
      (a.item.tier ?? 0) - (b.item.tier ?? 0)
      || b.score - a.score
      || (a.item.key < b.item.key ? -1 : a.item.key > b.item.key ? 1 : 0),
  );
  const taken = new Map<string, number>();
  const picked: AssemblyResult<T>['picked'] = [];
  while (picked.length < budget && remaining.length > 0) {
    // The lowest tier still present owns the pick. Within a tier the coverage
    // rule decides. A later tier never displaces an earlier one, whatever the
    // score says — that is what makes it a band rather than a weight.
    const lowestTier = remaining[0].item.tier ?? 0;
    let bestIndex = 0;
    let bestEffective = -Infinity;
    for (let i = 0; i < remaining.length; i += 1) {
      const c = remaining[i];
      if ((c.item.tier ?? 0) !== lowestTier) continue;
      const slug = c.item.sourceSlug;
      const penalty = slug === undefined ? 0 : (taken.get(slug) ?? 0);
      const effective = c.score / (1 + penalty);
      if (effective > bestEffective) {
        bestEffective = effective;
        bestIndex = i;
      }
    }
    const chosen = remaining.splice(bestIndex, 1)[0];
    const slug = chosen.item.sourceSlug ?? null;
    if (slug !== null) taken.set(slug, (taken.get(slug) ?? 0) + 1);
    picked.push({
      item: chosen.item,
      score: chosen.score,
      effective: bestEffective,
      sourceSlug: slug,
    });
  }

  const pickedSources = new Set<string>();
  let unattributedPicked = 0;
  const perSource = new Map<string, number>();
  for (const p of picked) {
    if (p.sourceSlug === null) { unattributedPicked += 1; continue; }
    pickedSources.add(p.sourceSlug);
    perSource.set(p.sourceSlug, (perSource.get(p.sourceSlug) ?? 0) + 1);
  }
  const dominant = picked.length > 0 && perSource.size > 0
    ? Math.max(...perSource.values()) / picked.length
    : 0;
  return {
    picked,
    pickedSources: pickedSources.size,
    poolSources: poolSources.size,
    dominantShare: dominant,
    unattributedPicked,
    singleSourcePool: poolSources.size === 1,
    unattributedPool: poolSources.size === 0,
  };
}
