// hub-detection.ts — v1.23.0 Graph Engine hub identification (P1-3)
//
// Pure function. Identifies "hub" pages in the wiki-link graph: nodes
// that many other pages link to. Hub detection is consumer #1 of the
// Personalized PageRank engine (closes Issue #117, per #198 consensus
// 2026-06-24).
//
// Algorithm:
// 1. Compute in-degree for every node (count of incoming edges).
// 2. Optionally run PPR from a query seed for query-time relevance.
// 3. Composite score = inDegree + normalized PPR score (equal weight
//    when both available, inDegree only otherwise).
// 4. Filter by minInDegree threshold (default 2).
// 5. Sort descending by composite score; keep topN.
//
// Clustering-coefficient retirement (Haveliwala clustering × out-degree
// threshold) is deferred to v1.24.0 per @DocTpoint's commitment on
// #198. Only consumer that needs it is tag inference (also v1.24.0+).
//
// Why not pure inDegree: inDegree is static — it answers "what's been
// linked a lot in the past". PPR from a query seed answers "what's
// most relevant to this query right now". The composite blends both
// signals: a hub for the current query is one that has historical
// centrality AND query-time proximity.

import { personalizedPageRank, seededRngFrom, type Graph, type PPROptions } from './monte-carlo-ppr';

export type { Graph, PPROptions };

export interface Hub {
  node: string;
  inDegree: number;
  totalDegree: number;
  /** Normalized PPR score (0-1) from the pprSeed, if provided. */
  pprScore?: number;
  /** Whether this node is classified as a hub (composite above threshold). */
  isHub: boolean;
}

export interface HubDetectionOptions {
  minInDegree?: number;
  topN?: number;
  pprSeed?: string;
  pprOptions?: PPROptions;
}

const DEFAULT_MIN_IN_DEGREE = 2;
const DEFAULT_TOP_N = 10;
/**
 * A node is a hub if its composite score is at or above this percentile
 * of all candidates' composite scores. Conservative default (top 30%)
 * — picks up the central pages without over-flagging moderately-linked
 * nodes.
 */
const HUB_PERCENTILE = 0.7;

export function detectHubs(graph: Graph, options: HubDetectionOptions = {}): Hub[] {
  const minInDegree = options.minInDegree ?? DEFAULT_MIN_IN_DEGREE;
  const topN = options.topN ?? DEFAULT_TOP_N;

  // Step 1: in-degree count.
  const inDegree = new Map<string, number>();
  for (const node of graph.nodes) inDegree.set(node, 0);
  for (const targets of graph.edges.values()) {
    for (const t of targets) {
      inDegree.set(t, (inDegree.get(t) ?? 0) + 1);
    }
  }

  // Step 2 (optional): PPR from query seed.
  // The rng is seeded from the seed node when the caller supplies none, so
  // the same graph gives the same PPR every time. It used to be
  // `Math.random`, which made a hub's `pprScore` — and with it the composite
  // score that decides whether the page is a hub — a different number on every
  // run. The lint reads that number and can strip a link because of it, so a
  // finding that flickers is a finding that fires at random.
  const pprOptions = options.pprOptions ?? {};
  const pprScores = options.pprSeed !== undefined
    ? personalizedPageRank(graph, options.pprSeed, {
        ...pprOptions,
        rng: pprOptions.rng ?? seededRngFrom(options.pprSeed, [options.pprSeed]),
      })
    : null;

  // Step 3: build candidates with composite score.
  // Composite = inDegree + pprScore (when present), normalized to
  // [0, 1] across candidates so inDegree and PPR are on comparable
  // scales. Equal weight: each is half the composite after
  // normalization.
  const candidates: Array<{ node: string; inD: number; total: number; ppr: number }> = [];
  for (const node of graph.nodes) {
    const inD = inDegree.get(node) ?? 0;
    if (inD < minInDegree) continue;
    const total = countTotalDegree(graph, node);
    const ppr = pprScores?.get(node) ?? 0;
    candidates.push({ node, inD, total, ppr });
  }

  if (candidates.length === 0) return [];

  // Normalize inDegree and PPR each to [0, 1] within the candidate set.
  const maxIn = Math.max(...candidates.map(c => c.inD), 1);
  const maxPpr = Math.max(...candidates.map(c => c.ppr), 1);

  const scored: Array<Hub & { composite: number }> = candidates.map(c => {
    const normIn = c.inD / maxIn;
    const normPpr = c.ppr / maxPpr;
    // Equal weight: 50/50 if PPR is present, 100% inDegree if not.
    const composite = pprScores ? (normIn + normPpr) / 2 : normIn;
    return {
      node: c.node,
      inDegree: c.inD,
      totalDegree: c.total,
      pprScore: pprScores ? c.ppr : undefined,
      isHub: false, // filled in step 4
      composite,
    };
  });

  // Step 4: classify isHub. Top HUB_PERCENTILE of composite scores are
  // hubs. Compute the threshold as the HUB_PERCENTILE-quantile of
  // composite scores.
  const sorted = [...scored].sort((a, b) => a.composite - b.composite);
  const thresholdIndex = Math.max(0, Math.floor(sorted.length * HUB_PERCENTILE));
  const hubThreshold = sorted[thresholdIndex]?.composite ?? 0;

  const result: Array<Hub & { composite: number }> = scored
    .map(s => ({ ...s, isHub: s.composite >= hubThreshold && s.composite > 0 }))
    // Step 5: sort by composite desc, keep topN.
    .sort((a, b) => b.composite - a.composite)
    .slice(0, topN);

  // Drop the internal `composite` field from the public Hub shape.
  return result.map(({ composite: _composite, ...rest }) => rest);
}

function countTotalDegree(graph: Graph, node: string): number {
  const out = graph.edges.get(node)?.length ?? 0;
  let inCount = 0;
  for (const targets of graph.edges.values()) {
    if (targets.includes(node)) inCount++;
  }
  return out + inCount;
}