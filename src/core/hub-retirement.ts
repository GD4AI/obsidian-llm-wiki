// Hub Retirement — Pure functions for deciding whether a tagged hub has
// "crystallized" and can have its hub status retired.
//
// Model (S15): a hub is a content-unspecific CRYSTALLIZATION POINT for a
// developing domain, and its hub status is a DECAYING developmental role. While
// the domain is a STAR — neighbors hang only off the hub — the hub is
// load-bearing → keep. Once the neighbors interconnect (crystallization) the hub
// is structurally redundant → retire the status.
//
// A hub TAG is a curatorial marker that the plugin does not read. No code path
// consults it, and hub status is recomputed from the graph on every run, so
// removing a tag changes nothing. This module tells the user when the role the
// marker describes has ended. The one suppression the product still performs is
// degree-based, not tag-based: `scanHubLinkDensity` examines the `detectHubs`
// set and `runHubLinkFixes` strips low-distinctiveness links there.
//
// Metric = local clustering coefficient of the hub: edges among its neighbors
// divided by possible neighbor pairs. Hubs have intrinsically LOW clustering, so
// what carries signal is the RELATIVE rank within the hub set, not an absolute
// cut. Measured across 4 independent graphs (prod + 3 experiment vaults,
// 2026-06): no high-degree node crosses clustering 0.10, i.e. an absolute
// crystallization cut never fires and the percentile rank is the only firing
// signal. Hence the verdict is percentile-based by default, with an optional
// absolute clustering floor as an escape hatch for all-star graphs.
//
// Zero side effects, fully unit-testable. The caller owns graph construction and
// the actual tag write; this module only judges.

export type HubVerdict = 'building' | 'star' | 'transition' | 'crystallized';

export interface HubAssessment {
  id: string;
  degree: number;
  clustering: number;
  /** Rank of this hub's clustering within the assessed set, 0..1 (1 = most crystallized). */
  clusteringPercentile: number;
  verdict: HubVerdict;
}

export interface HubRetirementOptions {
  /**
   * Clustering percentile (0..1) at/above which a hub counts as crystallized.
   * Relative to the assessed hub set. Default 0.75 (top quarter).
   */
  crystallizedPercentile?: number;
  /**
   * Clustering percentile (0..1) at/above which a hub is in transition.
   * Default 0.50 (upper half).
   */
  transitionPercentile?: number;
  /**
   * Absolute degree below which clustering is treated as statistical noise and
   * the hub is "building" regardless of rank. This is a noise guard, not a
   * relative threshold: clustering variance scales with 1/degree, so a
   * low-degree node's coefficient is unreliable in any graph. Default 30.
   */
  degreeFloor?: number;
  /**
   * Optional absolute clustering floor: a hub below this is never "crystallized"
   * regardless of rank, so the tool does not mechanically retire the top of an
   * all-star graph. Default 0 (off → pure relative verdict).
   */
  absoluteClusteringFloor?: number;
}

const DEFAULTS: Required<HubRetirementOptions> = {
  crystallizedPercentile: 0.75,
  transitionPercentile: 0.5,
  degreeFloor: 30,
  absoluteClusteringFloor: 0,
};

/**
 * Local clustering coefficient of a node: existing edges among its neighbors
 * divided by the number of possible neighbor pairs. Returns 0 for degree < 2.
 *
 * @param id - Node id
 * @param adjacency - Undirected adjacency (symmetric neighbor sets)
 *
 * @example
 * // triangle a-b-c: every neighbor pair is connected
 * localClustering('a', new Map([
 *   ['a', new Set(['b','c'])], ['b', new Set(['a','c'])], ['c', new Set(['a','b'])],
 * ])) // => { clustering: 1, degree: 2 }
 */
export function localClustering(
  id: string,
  adjacency: ReadonlyMap<string, ReadonlySet<string>>,
): { clustering: number; degree: number } {
  const neighbors = adjacency.get(id);
  const degree = neighbors ? neighbors.size : 0;
  if (degree < 2) return { clustering: 0, degree };
  let edges = 0;
  for (const u of neighbors!) {
    const un = adjacency.get(u);
    if (!un) continue;
    for (const v of neighbors!) {
      if (u < v && un.has(v)) edges++;
    }
  }
  return { clustering: (2 * edges) / (degree * (degree - 1)), degree };
}

/**
 * Build an undirected adjacency from a directed link map (each node → the nodes
 * it links to). Self-loops are dropped; edges are symmetrized. Lets a caller
 * feed the plugin's per-page outgoing-link sets directly.
 *
 * @param links - node id → ids it links to
 */
export function buildUndirectedAdjacency(
  links: ReadonlyMap<string, Iterable<string>>,
): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  const touch = (n: string): Set<string> => {
    let s = adj.get(n);
    if (!s) { s = new Set<string>(); adj.set(n, s); }
    return s;
  };
  for (const [src, targets] of links) {
    for (const tgt of targets) {
      if (tgt === src) continue;
      touch(src).add(tgt);
      touch(tgt).add(src);
    }
  }
  return adj;
}

/** Fraction of values strictly less than `value`; 0 for the min, 1 for the max. */
function percentileRank(value: number, sorted: readonly number[]): number {
  const n = sorted.length;
  if (n <= 1) return 0;
  let below = 0;
  for (const v of sorted) if (v < value) below++;
  return below / (n - 1);
}

/**
 * Assess each tagged hub and return a crystallization verdict. The verdict is
 * relative to the supplied hub set (percentile of clustering), so it is
 * vault-size invariant; `degreeFloor` and `absoluteClusteringFloor` are absolute
 * guards layered on top.
 *
 * Returned assessments are sorted most-crystallized first.
 *
 * @param adjacency - Undirected graph adjacency (full graph, not just hubs)
 * @param hubIds - Ids currently tagged as hubs
 * @param options - Tunable thresholds (see HubRetirementOptions)
 */
export function assessHubs(
  adjacency: ReadonlyMap<string, ReadonlySet<string>>,
  hubIds: Iterable<string>,
  options: HubRetirementOptions = {},
): HubAssessment[] {
  const o = { ...DEFAULTS, ...options };
  const measured = [...hubIds].map(id => {
    const { clustering, degree } = localClustering(id, adjacency);
    return { id, clustering, degree };
  });
  const clusterings = measured.map(m => m.clustering).sort((a, b) => a - b);

  const assessed = measured.map(({ id, clustering, degree }): HubAssessment => {
    const clusteringPercentile = percentileRank(clustering, clusterings);
    let verdict: HubVerdict;
    if (degree < o.degreeFloor) {
      verdict = 'building';
    } else if (
      clusteringPercentile >= o.crystallizedPercentile &&
      clustering >= o.absoluteClusteringFloor
    ) {
      verdict = 'crystallized';
    } else if (clusteringPercentile >= o.transitionPercentile) {
      verdict = 'transition';
    } else {
      verdict = 'star';
    }
    return { id, degree, clustering, clusteringPercentile, verdict };
  });

  return assessed.sort((a, b) => b.clusteringPercentile - a.clusteringPercentile);
}
