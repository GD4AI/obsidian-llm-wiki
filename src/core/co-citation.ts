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
  /**
   * The subject's own source page(s), when the caller knows them better than the
   * graph does. A page being written has no graph entry yet, so `sourcesOf` finds
   * nothing and the same-note exclusion (#1017) cannot fire on its first ingest —
   * the re-ingest of a note that newly extracts an entity is exactly that case.
   * Unioned with the graph-derived set, never a replacement.
   */
  selfSources?: ReadonlySet<string>;
  /** Bound on the returned list. Absent means all of them, ranked. */
  limit?: number;
  /**
   * The subject's own outgoing targets, when the caller knows them better than the
   * graph does.
   *
   * A page being written does not exist in the vault yet, so `graph.outgoing` has no
   * entry for it and the projection would find no candidates at all — which is what
   * a rebuild looked like: every page new, every projection empty (#1018). The
   * shaper knows the names the page is about to link, so it passes them here.
   */
  selfTargets?: readonly string[];
  /**
   * Shared targets a page needs before it is offered at all. Defaults to 2.
   *
   * One shared target is not a relation. On the 2,110-page vault the review
   * measured, a single hub produced 16.5 % of all candidate pairs, and every one
   * of those pairs had exactly one piece of evidence — the hub. A caller whose
   * vault is too sparse to reach two can lower this, and then it has said so.
   */
  minShared?: number;
  /**
   * How widely cited a shared target may be and still count — Issue #1028, step 2.
   *
   * With this set, a target cited by `specificity` or more pages is not evidence: it
   * is dropped from the count, from the weight, and from the rarest-target key. One
   * remaining target is enough to offer the pair, so this **replaces** the count floor
   * rather than adding to it — `minShared = 2` asks how much evidence there is, and
   * the gate asks whether any of it is specific.
   *
   * The reason is measured: on a 3,071-page vault, 50.3 % of chosen entries rested on
   * at least one target cited by 50 or more pages, because a hub is shared by nearly
   * everything. With the gate at 25 the hub-rest share fell to 5.3 % while coverage
   * rose from 1,023 pages to 1,973.
   *
   * Absent means today's floor, exactly — every existing caller and test is unaffected.
   */
  specificity?: number;
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
 * Add or replace one page's edges in a graph that is already built.
 *
 * Issue #1018: the projection's graph is built once per run and cached, because
 * rebuilding per note reads every page body per note — ≈526,000 reads on the design
 * record's reference vault, the regression class #662 removed. But a graph frozen at
 * the run's first note means a rebuild projects nothing: the first note sees an empty
 * vault and every later note sees a graph without the pages the run has written.
 *
 * So the cached copy follows writes instead of being dropped. Cost is O(links) per
 * written page, and the build stays once per run.
 *
 * Re-adding a page replaces its edges rather than appending, so an ingest that
 * rewrites a page cannot leave its previous targets behind in the reverse index.
 * `graph` is treated as mutable here and nowhere else; callers hold it as
 * `ReadonlyMap` and this is the one writer.
 */
export function addCoCitationPage(
  graph: CoCitationGraph,
  page: string,
  targets: readonly string[],
): void {
  const outgoing = graph.outgoing as Map<string, readonly string[]>;
  const incoming = graph.incoming;

  const previous = outgoing.get(page) ?? [];
  for (const target of previous) {
    const citing = incoming.get(target);
    if (!citing) continue;
    const at = citing.indexOf(page);
    if (at >= 0) citing.splice(at, 1);
    if (citing.length === 0) incoming.delete(target);
  }

  const next = [...new Set(targets)].filter(t => t !== page);
  outgoing.set(page, next);
  for (const target of next) {
    const citing = incoming.get(target);
    if (citing) citing.push(page);
    else incoming.set(target, [page]);
  }
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
  // Both sources are real and neither replaces the other: a page being written has
  // its planned links and no graph entry; a page being re-ingested has its body's
  // links in the graph, and its note-grounded names may add to them.
  const targets = [...new Set([...(opts.selfTargets ?? []), ...(graph.outgoing.get(self) ?? [])])];
  if (targets.length === 0) return [];

  // The gate replaces the floor: with it, one specific target is the whole bar.
  const minShared = opts.specificity !== undefined ? 1 : (opts.minShared ?? DEFAULT_MIN_SHARED);
  const alreadyLinked = new Set(targets);
  const selfSources = new Set([...sourcesOf(self, graph), ...(opts.selfSources ?? [])]);
  /**
   * Per candidate: how many targets it shares, how much they say, the citing count of
   * the rarest of them, and its own out-degree. The last two are the comparator keys
   * #1028 added; both are facts about the pair that the pair itself cannot supply.
   */
  const shared = new Map<string, { count: number; weight: number; rarest: number; degree: number }>();
  for (const target of targets) {
    if (isSourcePage(target)) continue;
    const citing = graph.incoming.get(target) ?? [];
    // A target the whole vault cites says "these two pages are wiki pages". It is not
    // evidence, and it must not reach the count, the weight, or the rarest key.
    if (opts.specificity !== undefined && citing.length >= opts.specificity) continue;
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
        if (citing.length < entry.rarest) entry.rarest = citing.length;
      } else {
        shared.set(source, {
          count: 1,
          weight,
          rarest: citing.length,
          // #1028: source pages are the notes the vault was built from, not subjects.
          // A candidate that links three of them is not broader than one that links
          // none, and counting them would rank a note's own scaffolding as reach.
          degree: (graph.outgoing.get(source) ?? []).filter(target => !isSourcePage(target)).length,
        });
      }
    }
  }

  // Total order, and each key earns its place:
  //   1. how many targets are shared — the amount of evidence.
  //   2. how much those targets say — the rarity. This is what replaces the
  //      alphabetical tie-break: with it, an equal-score group is ordered by a
  //      fact about the vault rather than by the first letter of a filename.
  //   3. how rare the **rarest** shared target is (#1028). Summed weight is a float
  //      that ties often, and a tie there means two candidates whose evidence is
  //      equally strong on average — but "one target only two pages cite" is a
  //      sharper claim than "two targets every third page cites". @DocTpoint measured
  //      the need for it: in 96–98 % of path-decided cuts the pair's whole evidence
  //      was identical, so no fact about the pair could separate them.
  //   4. the candidate's own degree (#1028), which is the first key that is not about
  //      the pair at all: of two equally supported candidates, the narrower page is
  //      the safer addition to a bounded list. It is a heuristic, not a principle.
  //   5. the path, as a **last resort only** — reached when two candidates agree on
  //      everything above, where any order is as good and the only requirement is
  //      that it is the same one every run.
  //
  // Measured on the 3,071-page vault: the path's share of cuts fell from 60.9 % to
  // 22.4 % and the "A" title share from 11.2 % to 9.1 % against a 7.5 % base.
  const ranked = [...shared.entries()]
    .filter(([, entry]) => entry.count >= minShared)
    .sort(
      (a, b) =>
        b[1].count - a[1].count ||
        b[1].weight - a[1].weight ||
        a[1].rarest - b[1].rarest ||
        a[1].degree - b[1].degree ||
        (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0),
    )
    .map(([path]) => path);

  return opts.limit === undefined ? ranked : ranked.slice(0, Math.max(0, opts.limit));
}
