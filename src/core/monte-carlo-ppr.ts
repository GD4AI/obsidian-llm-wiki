// monte-carlo-ppr.ts — Monte Carlo Personalized PageRank (Fogaras 2005)
//
// Pure function for the v1.23.0 Graph Engine (#198 consensus 2026-06-24).
// Replaces power-iteration for query-time PageRank because Monte Carlo's
// K×L cost is independent of |V|: a 2000-page vault costs the same per
// query as a 200-page vault (per @DocTpoint on #198 Q4/Q5).
//
// Algorithm:
// For each of `numWalks` walks:
//   1. Start at `seed`.
//   2. At each step, with probability `damping` teleport back to seed;
//      otherwise pick a random outgoing edge uniformly and follow it.
//   3. Continue for `maxSteps` steps.
// Aggregate visit counts, normalize to probabilities.
//
// Edge case: a seed node with no outgoing edges always teleports back
// to itself, so all probability stays on the seed (verified in tests).
//
// Why not seedable RNG in the public API: tests inject a PRNG via
// `options.rng` for determinism. Production calls omit it; the default
// uses Math.random (acceptable for non-deterministic ranking — top-k
// is robust to sampling noise per #198 consensus).

export interface Graph {
  nodes: string[];
  edges: Map<string, string[]>;
}

export interface PPROptions {
  numWalks?: number;
  maxSteps?: number;
  damping?: number;
  rng?: () => number;
}

const DEFAULT_NUM_WALKS = 3000;
const DEFAULT_MAX_STEPS = 50;
const DEFAULT_DAMPING = 0.05;

export function personalizedPageRank(
  graph: Graph,
  seed: string,
  options: PPROptions = {},
): Map<string, number> {
  // Validate graph contains the seed. PPR is undefined for a missing seed.
  if (!graph.nodes.includes(seed)) {
    return new Map();
  }

  const numWalks = options.numWalks ?? DEFAULT_NUM_WALKS;
  const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
  const damping = options.damping ?? DEFAULT_DAMPING;
  const rng = options.rng ?? Math.random;

  // Pre-cache outgoing edges. Map.get on undefined returns undefined;
  // we treat that as "no outgoing edges" (the seed teleports back to
  // itself every step, retaining all probability on the seed).
  const visitCounts = new Map<string, number>();
  visitCounts.set(seed, numWalks); // every walk starts at seed

  for (let walk = 0; walk < numWalks; walk++) {
    let current = seed;
    for (let step = 0; step < maxSteps; step++) {
      // With probability `damping`, teleport back to seed.
      if (rng() < damping) {
        current = seed;
        visitCounts.set(current, (visitCounts.get(current) ?? 0) + 1);
        continue;
      }
      // Otherwise follow a random outgoing edge.
      const outgoing = graph.edges.get(current);
      if (!outgoing || outgoing.length === 0) {
        // Dead end. Per the standard PPR formulation, treat as teleport
        // back to seed (this is the Haveliwala 2002 "dead-end" rule —
        // prevents walks from getting stuck on nodes without out-edges).
        current = seed;
        visitCounts.set(current, (visitCounts.get(current) ?? 0) + 1);
        continue;
      }
      const next = outgoing[Math.floor(rng() * outgoing.length)];
      current = next;
      visitCounts.set(current, (visitCounts.get(current) ?? 0) + 1);
    }
  }

  // Normalize: total visits across all walks (numWalks * (maxSteps + 1)
  // start counts + per-step visits, but we only track what we record).
  // Sum of visitCounts is the total recorded visits. Probabilities are
  // each node's count / total.
  let total = 0;
  for (const count of visitCounts.values()) total += count;

  const result = new Map<string, number>();
  if (total === 0) return result;
  for (const [node, count] of visitCounts) {
    result.set(node, count / total);
  }
  return result;
}

/**
 * A deterministic PRNG: mulberry32 over an FNV-1a hash of the seed string.
 *
 * Why this exists. `options.rng ?? Math.random` made the graph arm an
 * estimate rather than a function: the same query ran to a different ranking
 * each time. #729's measurement cannot separate two arms under that variance,
 * and a user who asks the same question twice gets two answers. A seeded
 * generator turns the walk into a function of its inputs, which is what a
 * ranking is supposed to be.
 *
 * Pure function. No IO, no global state.
 */
export function makeSeededRng(seed: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  let state = (h ^ 0x9e3779b9) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The rng a query gets when the caller does not supply one. The seed is the
 * question, the seed set and the graph size, so two different questions do
 * not walk the same paths and one question always walks the same ones.
 *
 * The seed set is sorted before it is joined: `[a, b]` and `[b, a]` are one
 * query, not two.
 */
export function seededRngFrom(
  query: string,
  seeds: readonly string[],
  graphSize: number,
): () => number {
  return makeSeededRng(`${query}\u0000${[...seeds].sort().join('\u0001')}\u0000${graphSize}`);
}