// Issue #729 Phase 1 — M0, the co-citation projection.
//
// Two pages are related if the vault's own link structure already joins them:
// `A → E` and `B → E`, so `A — B`. This is the mechanism that holds the Related
// graph's floor, and it holds it **without the model**: zero prompt change, zero
// extra model call, and the same candidates whatever model the user runs. That
// property is the point — the extraction prompt can only ever name things from
// *this* note (`prompts/ingestion.ts:33`), so the floor it produces is intra-source
// by construction and cannot be raised by a better model.
//
// The projection is a pure function over the graph `core/build-graph.ts` already
// builds, so the write-time edges and the query path's PPR graph come from the same
// builder and cannot drift apart.
//
// **Determinism is a requirement, not a nicety.** A projection that reordered
// between runs would produce different page bodies for the same vault, which makes
// the Phase 6 acceptance measurement unrepeatable and turns every rebuild into a
// diff. Ties are therefore broken by path.

import type { Graph } from './build-graph';

/** `target → every page that links it`. `Graph.edges` is outgoing-only. */
export type IncomingIndex = Map<string, string[]>;

export interface CoCitationGraph {
  /** The graph's own outgoing edges — the same Map, not a copy. */
  outgoing: ReadonlyMap<string, readonly string[]>;
  /** The reverse of `outgoing`, built once and reused for every candidate query. */
  incoming: IncomingIndex;
}

export interface CoCitationOptions {
  /**
   * Pages not to offer. The caller passes what it has already placed, so a page
   * that is about to be written from the note-grounded list is not offered again.
   * The projection also excludes itself and its own link targets regardless.
   */
  exclude?: ReadonlySet<string>;
  /** Bound on the returned list. Absent means all of them, ranked. */
  limit?: number;
}

/**
 * Build the reverse index once, up front.
 *
 * `buildGraphFromContent` derives edges from loaded page bodies, so this is O(edges)
 * over data the caller already holds — no IO, and no second pass over the vault.
 */
export function buildCoCitationGraph(graph: Graph): CoCitationGraph {
  const incoming: IncomingIndex = new Map();
  for (const [source, targets] of graph.edges) {
    for (const target of targets) {
      const sources = incoming.get(target);
      if (sources) sources.push(source);
      else incoming.set(target, [source]);
    }
  }
  return { outgoing: graph.edges, incoming };
}

/**
 * Pages that co-cite with `self`, best first.
 *
 * Ranked by how many targets they share with `self` — the count is the evidence —
 * and **ties broken by path**, so the order is a function of the graph's content
 * and not of the order its edges happened to be loaded in.
 *
 * Excluded, and each for its own reason:
 *
 * - **`self`** — a self-link reaches nothing.
 * - **Pages `self` already links.** `A → B` is an edge the vault holds. Re-listing
 *   it under Related duplicates a link the body already carries, which is the
 *   redundancy `hub-link-distinctiveness` reports (#157 / #175), and it would
 *   inflate the cross-source count with a relation that was never missing.
 * - **`opts.exclude`** — what the caller has already placed for this item.
 *
 * A shared target that is not itself a node (a partially-loaded vault, a link to a
 * page no other page has) still counts as shared: the projection answers "what does
 * the vault's structure join", and whether the *result* is writable is the vault
 * resolver's question, answered in `related-shaping.ts`.
 */
export function coCitationCandidates(
  self: string,
  graph: CoCitationGraph,
  opts: CoCitationOptions = {},
): string[] {
  const targets = graph.outgoing.get(self);
  if (!targets || targets.length === 0) return [];

  const alreadyLinked = new Set(targets);
  const shared = new Map<string, number>();
  for (const target of targets) {
    for (const source of graph.incoming.get(target) ?? []) {
      if (source === self) continue;
      if (alreadyLinked.has(source)) continue;
      if (opts.exclude?.has(source)) continue;
      shared.set(source, (shared.get(source) ?? 0) + 1);
    }
  }

  // Total order: shared count descending, then path ascending. Sorting on both
  // keys — rather than relying on Map insertion order for equal counts — is what
  // makes the result independent of how the graph was assembled.
  const ranked = [...shared.entries()]
    .sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([path]) => path);

  return opts.limit === undefined ? ranked : ranked.slice(0, Math.max(0, opts.limit));
}
