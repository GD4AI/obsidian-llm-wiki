// graph-audit.ts — the graph-shape metrics that decide #729's P4.
//
// Pure: no IO, no node builtins, no Obsidian types. The dev instrument reads a
// vault from disk and hands this module a graph and a per-page source map.
//
// Four questions, in the order the maintainer asked them:
//
//   1. Is the graph planet-shaped?         topInDegreeShare
//      A few nodes hold most of the in-degree. "Planet" is the shape where the
//      important pages orbit a hub instead of linking each other.
//
//   2. Are the edges born from one note?    intraSourceEdgeShare
//      The premise of #729. An edge is intra-source when its two ends name a
//      common source. This is the "95 %" number, computed rather than quoted.
//
//   3. Do the main nodes link each other?   topNodeEdges
//      The direct measure of the question asked: among the pages with the most
//      incoming links, how many of the possible ordered pairs are an edge.
//
//   4. Can the main nodes reach each other? topNodeReach / crossSourceReach
//      Two hops and three hops, in both directions. The directed form is what
//      the query path's walk can actually traverse; the undirected form says
//      whether the information exists in the graph at all.
//
// Everything here is deterministic. Ties in the in-degree ranking break by path
// ascending, because a ranking that follows the caller's array order is the
// defect this audit exists to measure — it must not reproduce it.

/** The graph shape this module reads: a node list and an out-edge map. */
export interface AuditGraph {
  nodes: readonly string[];
  edges: ReadonlyMap<string, readonly string[]>;
}

/** One node's incoming-link count. */
export interface DegreeEntry {
  path: string;
  inDegree: number;
}

/** Edge attribution by source. Pages with no source are counted apart. */
export interface SourceEdgeShare {
  /** Both ends name a common source. */
  intra: number;
  /** Both ends name a source, and the two sets are disjoint. */
  cross: number;
  /** At least one end names no source, so the edge cannot be attributed. */
  unattributed: number;
  /** intra / (intra + cross). 1 when nothing is attributed, so read the counts. */
  share: number;
}

/** One row per hop distance, both traversal forms. */
export interface ReachRow {
  hops: number;
  /** Out-edges only — what the query walk follows. */
  directed: number;
  /** Out-edges and in-edges — what the graph holds regardless of direction. */
  undirected: number;
}

/** Reachability among the top-k nodes, with the pair count behind the fraction. */
export interface TopReachRow extends ReachRow {
  /** Ordered non-self pairs among the top-k nodes. */
  pairs: number;
}

export interface GraphAuditReport {
  nodeCount: number;
  /** Total edge count; also the sum of all in-degrees. */
  edgeCount: number;
  /** Every node by in-degree, highest first. */
  topInDegree: DegreeEntry[];
  /** Share of all in-degree held by the top-k nodes. */
  topInDegreeShare: { k: number; share: number };
  intraSourceEdgeShare: SourceEdgeShare;
  /** Among the top-k: how many of the k(k-1) ordered pairs are a direct edge. */
  topNodeEdges: { k: number; edgesAmong: number; possible: number; density: number };
  /** Among the top-k: how many ordered pairs are reachable within N hops. */
  topNodeReach: TopReachRow[];
  /** From each source's own pages, the share of other-source pages reached. */
  crossSourceReach: ReachRow[];
}

export interface GraphAuditOptions {
  /** Nodes to treat as "the main nodes". Default 3. */
  topK?: number;
  /** Hop distances to report. Default [1, 2, 3]. */
  hops?: readonly number[];
}

const DEFAULT_TOP_K = 3;
const DEFAULT_HOPS: readonly number[] = [1, 2, 3];

function compareByDegreeThenPath(a: DegreeEntry, b: DegreeEntry): number {
  if (b.inDegree !== a.inDegree) return b.inDegree - a.inDegree;
  return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
}

function inDegreeOf(graph: AuditGraph): Map<string, number> {
  const degree = new Map<string, number>();
  for (const n of graph.nodes) if (!degree.has(n)) degree.set(n, 0);
  for (const targets of graph.edges.values()) {
    for (const t of targets) degree.set(t, (degree.get(t) ?? 0) + 1);
  }
  return degree;
}

function buildInEdges(graph: AuditGraph): Map<string, string[]> {
  const inEdges = new Map<string, string[]>();
  for (const [from, targets] of graph.edges) {
    for (const to of targets) {
      const list = inEdges.get(to);
      if (list) list.push(from);
      else inEdges.set(to, [from]);
    }
  }
  return inEdges;
}

/**
 * Every node by incoming links, highest first. Ties break by path ascending so
 * two runs over the same graph give the same list whatever order the caller
 * built its node array in.
 */
export function topByInDegree(graph: AuditGraph, k: number): DegreeEntry[] {
  const degree = inDegreeOf(graph);
  return [...degree.entries()]
    .map(([path, inDegree]) => ({ path, inDegree }))
    .sort(compareByDegreeThenPath)
    .slice(0, k);
}

/**
 * Attribute each edge to the note it was born from. An edge counts as
 * intra-source when its two ends name at least one common source. An edge with
 * a sourceless end is unattributed rather than cross — counting it as cross
 * would inflate the number this issue rests on.
 */
export function intraSourceEdgeShare(
  graph: AuditGraph,
  sourceOf: ReadonlyMap<string, readonly string[]>,
): SourceEdgeShare {
  let intra = 0;
  let cross = 0;
  let unattributed = 0;
  for (const [from, targets] of graph.edges) {
    for (const to of targets) {
      const a = sourceOf.get(from);
      const b = sourceOf.get(to);
      if (!a?.length || !b?.length) {
        unattributed++;
        continue;
      }
      if (a.some(s => b.includes(s))) intra++;
      else cross++;
    }
  }
  const attributed = intra + cross;
  return { intra, cross, unattributed, share: attributed === 0 ? 1 : intra / attributed };
}

/**
 * Every node within `hops` of `seed`, including `seed` itself.
 *
 * `directed` follows out-edges only, which is what the query path's walk can
 * traverse. `undirected` follows both directions, which says whether the
 * connection exists in the graph at all. The two together separate "the walk
 * cannot get there" from "there is nothing to get to".
 */
export function reachableWithin(
  graph: AuditGraph,
  seed: string,
  hops: number,
  mode: 'directed' | 'undirected',
): Set<string> {
  const inEdges = mode === 'undirected' ? buildInEdges(graph) : null;
  const reached = new Set<string>([seed]);
  let frontier: string[] = [seed];
  for (let step = 0; step < hops && frontier.length > 0; step++) {
    const next: string[] = [];
    for (const node of frontier) {
      for (const t of graph.edges.get(node) ?? []) {
        if (!reached.has(t)) {
          reached.add(t);
          next.push(t);
        }
      }
      if (inEdges) {
        for (const t of inEdges.get(node) ?? []) {
          if (!reached.has(t)) {
            reached.add(t);
            next.push(t);
          }
        }
      }
    }
    frontier = next;
  }
  return reached;
}

/**
 * The four questions, answered with counts as well as fractions, because a
 * fraction over a small count reads as a strong result and is not one.
 */
export function graphAudit(
  input: { graph: AuditGraph; sourceOf: ReadonlyMap<string, readonly string[]> },
  options: GraphAuditOptions = {},
): GraphAuditReport {
  const { graph, sourceOf } = input;
  const k = options.topK ?? DEFAULT_TOP_K;
  const hops = options.hops ?? DEFAULT_HOPS;

  const degree = inDegreeOf(graph);
  let edgeCount = 0;
  for (const targets of graph.edges.values()) edgeCount += targets.length;

  const topInDegree = [...degree.entries()]
    .map(([path, inDegree]) => ({ path, inDegree }))
    .sort(compareByDegreeThenPath);

  const topK = topInDegree.slice(0, k);
  const topSet = new Set(topK.map(t => t.path));
  const topDegreeSum = topK.reduce((sum, t) => sum + t.inDegree, 0);

  // Direct edges among the top-k nodes.
  let edgesAmong = 0;
  for (const [from, targets] of graph.edges) {
    if (!topSet.has(from)) continue;
    for (const to of targets) if (topSet.has(to)) edgesAmong++;
  }
  const possible = k * (k - 1);

  // Reachability among the top-k nodes, excluding self-pairs.
  const topNodeReach: TopReachRow[] = hops.map(h => {
    let directed = 0;
    let undirected = 0;
    for (const a of topSet) {
      const d = reachableWithin(graph, a, h, 'directed');
      const u = reachableWithin(graph, a, h, 'undirected');
      for (const b of topSet) {
        if (a === b) continue;
        if (d.has(b)) directed++;
        if (u.has(b)) undirected++;
      }
    }
    return { hops: h, directed, undirected, pairs: possible };
  });

  // From each source's own pages, the share of other-source pages reached.
  const bySource = new Map<string, string[]>();
  const sourced: string[] = [];
  for (const [path, srcs] of sourceOf) {
    if (!srcs.length) continue;
    sourced.push(path);
    for (const s of srcs) {
      const list = bySource.get(s);
      if (list) list.push(path);
      else bySource.set(s, [path]);
    }
  }
  const crossSourceReach: ReachRow[] = hops.map(h => {
    let directedSum = 0;
    let undirectedSum = 0;
    let counted = 0;
    for (const [source, own] of bySource) {
      const ownSet = new Set(own);
      const others = sourced.filter(p => !ownSet.has(p));
      if (others.length === 0) continue;
      const dSeeds = new Set<string>();
      const uSeeds = new Set<string>();
      for (const p of own) {
        for (const t of reachableWithin(graph, p, h, 'directed')) dSeeds.add(t);
        for (const t of reachableWithin(graph, p, h, 'undirected')) uSeeds.add(t);
      }
      let dHit = 0;
      let uHit = 0;
      for (const o of others) {
        if (dSeeds.has(o)) dHit++;
        if (uSeeds.has(o)) uHit++;
      }
      directedSum += dHit / others.length;
      undirectedSum += uHit / others.length;
      counted++;
    }
    return {
      hops: h,
      directed: counted === 0 ? 0 : directedSum / counted,
      undirected: counted === 0 ? 0 : undirectedSum / counted,
    };
  });

  return {
    nodeCount: graph.nodes.length,
    edgeCount,
    topInDegree,
    topInDegreeShare: { k, share: edgeCount === 0 ? 0 : topDegreeSum / edgeCount },
    intraSourceEdgeShare: intraSourceEdgeShare(graph, sourceOf),
    topNodeEdges: {
      k,
      edgesAmong,
      possible,
      density: possible === 0 ? 0 : edgesAmong / possible,
    },
    topNodeReach,
    crossSourceReach,
  };
}
