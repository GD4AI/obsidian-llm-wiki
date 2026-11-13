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
// diff. The order is a function of the graph alone: shared-target count, then the
// `1/(1+incoming)` weight of those targets, then path as the last resort. The middle
// term replaced a plain path tie-break on 2026-11-02, because breaking a tie on the
// alphabet is repeatable *and* systematically biased ("A" titles were 17.1 % of
// chosen entries against 9.1 % of pages).

import type { Graph } from './build-graph';
import { WIKI_SUBFOLDERS } from '../constants';

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
  /**
   * Shared targets a page needs before it is offered at all. Defaults to 2.
   *
   * One shared target is not a relation. On the 2,110-page vault the review
   * measured, a single hub produced 16.5 % of all candidate pairs, and every one
   * of those pairs had exactly one piece of evidence — the hub. A caller whose
   * vault is too sparse to reach two can lower this, and then it has said so.
   */
  minShared?: number;
}

/** The floor. See `CoCitationOptions.minShared`. */
const DEFAULT_MIN_SHARED = 2;

/**
 * How much one shared target says.
 *
 * A target cited by a hundred pages is weak evidence: "both cite Oxidative
 * stress" is nearly true of the whole vault. A target cited by one other page is
 * strong evidence. The weight falls off as `1 / (1 + incoming)`, so a target
 * shared with one other page weighs about fifty times what a hub of a hundred
 * weighs.
 *
 * The exact form is a choice, and the tests assert its **property** rather than
 * its value: strictly decreasing in how many pages cite the target. Both the
 * count and this weight are deterministic functions of the graph, so the ordering
 * stays repeatable.
 */
function targetWeight(incoming: number): number {
  return 1 / (1 + incoming);
}

/**
 * Is this path a source page — the note the vault was built from?
 *
 * Source pages are the wiki's record of a note, not a subject the note is about. Two
 * pages that share one are pages from the same note, which is what the sibling rule
 * already handles; counting it as cross-source evidence made the projection re-add
 * intra-source links and call them new (#1017).
 */
function isSourcePage(path: string): boolean {
  return path.startsWith(`${WIKI_SUBFOLDERS.sources}/`);
}

/** The source pages a page links — usually one, and that is the note it came from. */
function sourcesOf(page: string, graph: CoCitationGraph): ReadonlySet<string> {
  const targets = graph.outgoing.get(page) ?? [];
  return new Set(targets.filter(isSourcePage));
}

/** Does `candidate` come from a note that `self` also came from? */
function sharesSourcePage(
  candidate: string,
  selfSources: ReadonlySet<string>,
  graph: CoCitationGraph,
): boolean {
  for (const source of sourcesOf(candidate, graph)) {
    if (selfSources.has(source)) return true;
  }
  return false;
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
 * Ranked by how many targets they share with `self` — the count is the evidence.
 * Equal counts are ordered by the weight of the shared targets, `1/(1+incoming)`, so
 * a target cited by `N` pages weighs `1/(1+N)` and a pair held together by one broad
 * hub sorts last within its count. Path is the final tie-break, so the order is a
 * function of the graph's content and not of the order its edges were loaded in.
 * Pairs sharing fewer than `minShared` targets are not candidates at all.
 *
 * Excluded, and each for its own reason:
 *
 * - **`self`** — a self-link reaches nothing.
 * - **Pages `self` already links.** `A → B` is an edge the vault holds. Re-listing
 *   it under Related duplicates a link the body already carries, which is the
 *   redundancy `hub-link-distinctiveness` reports (#157 / #175), and it would
 *   inflate the cross-source count with a relation that was never missing.
 * - **`opts.exclude`** — what the caller has already placed for this item.
 * - **Source pages, as candidates.** A source page is the note, not a subject the
 *   note is about. Offering one lands a `sources/` path in `related_entities` or
 *   `related_concepts` (2.7 % of chosen entries measured on `test10`) and displaces a
 *   real entity or concept from a bounded list.
 * - **Source pages, as evidence.** See `isSourcePage`: a source page says two pages
 *   came from the same note, which the sibling rule already owns.
 * - **Pages that share a source page with `self`.** The larger half of #1017, and the
 *   half the issue's own candidate fix 1 does not reach: excluding the source page as
 *   a *target* still offers two pages of one note whenever they share two other
 *   targets. Measured on `test10` with that exclusion alone, 98.9 % of chosen entries
 *   still came from the same note as the page they were offered to — the share rose,
 *   because the pairs it removed were the weakly connected cross-source ones. This
 *   phase exists to add cross-source edges, so a same-note pair is not a candidate.
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

  const minShared = opts.minShared ?? DEFAULT_MIN_SHARED;
  const alreadyLinked = new Set(targets);
  const selfSources = sourcesOf(self, graph);
  /** Per candidate: how many targets it shares, and how much they say. */
  const shared = new Map<string, { count: number; weight: number }>();
  for (const target of targets) {
    if (isSourcePage(target)) continue;
    const citing = graph.incoming.get(target) ?? [];
    const weight = targetWeight(citing.length);
    for (const source of citing) {
      if (source === self) continue;
      if (isSourcePage(source)) continue;
      if (selfSources.size > 0 && sharesSourcePage(source, selfSources, graph)) continue;
      if (alreadyLinked.has(source)) continue;
      if (opts.exclude?.has(source)) continue;
      const entry = shared.get(source);
      if (entry) {
        entry.count += 1;
        entry.weight += weight;
      } else {
        shared.set(source, { count: 1, weight });
      }
    }
  }

  // Total order, and each key earns its place:
  //   1. how many targets are shared — the amount of evidence.
  //   2. how much those targets say — the rarity. This is what replaces the
  //      alphabetical tie-break: with it, an equal-score group is ordered by a
  //      fact about the vault rather than by the first letter of a filename.
  //   3. the path, as a **last resort only** — reached when two candidates share
  //      the same count *and* the same weight, where any order is as good and the
  //      only requirement is that it is the same one every run.
  const ranked = [...shared.entries()]
    .filter(([, entry]) => entry.count >= minShared)
    .sort(
      (a, b) =>
        b[1].count - a[1].count ||
        b[1].weight - a[1].weight ||
        (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0),
    )
    .map(([path]) => path);

  return opts.limit === undefined ? ranked : ranked.slice(0, Math.max(0, opts.limit));
}
