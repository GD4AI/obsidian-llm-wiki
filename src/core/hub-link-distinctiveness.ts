// hub-link-distinctiveness.ts — v1.23.0 P1-6 Lint integration
//
// Closes Issue #157 / #175: when a hub page (high in-degree) has many
// `[[links]]` in its ## Related section, the links are often mutually
// redundant — the wiki-link graph structure shows that the targets are
// tightly interconnected, so they provide little information beyond
// each other.
//
// This module gives Lint a way to flag such pages so the user can
// decide whether to strip the redundant links.
//
// Algorithm (per P1-6 design, 2026-06-29):
//   1. detectHubs(graph) → hub pages.
//   2. For each hub, parse ## Related section → list of [[link]] targets.
//   3. For each target t, compute redundancy = mean(PPR(t) from seed=u)
//      for u in other targets. Higher redundancy = lower distinctiveness.
//   4. distinctiveness(t) = 1 - normalized(redundancy).
//   5. Mean distinctiveness → recommendation tier.
//
// Pure functions, no IO, no LLM. Cost: O(hubs × targets²) PPR runs at
// default 500 walks each — for typical 5-10 hub × 5-10 targets ≈ 50ms.
//
// Why PPR-based (not just in-degree clustering): the link
// distinctiveness question is "are these targets informative about
// different aspects of the hub?" — graph distance via PPR captures
// this. Two targets with high mutual reachability are providing
// overlapping information; two targets with low mutual reachability
// are providing distinct aspects.

import { personalizedPageRank, seededRngFrom, type Graph, type PPROptions } from './monte-carlo-ppr';
import { detectHubs } from './hub-detection';

export type { Graph };

export type Recommendation = 'strip' | 'review' | 'keep';

export interface HubLinkDensityIssue {
  pagePath: string;
  inDegree: number;
  totalRelatedLinks: number;
  /** Mean distinctiveness across all targets in [0, 1]. */
  distinctivenessScore: number;
  recommendation: Recommendation;
  /** Targets whose distinctiveness < reviewThreshold. */
  lowDistinctivenessTargets: string[];
}

export interface HubLinkDensityOptions extends PPROptions {
  minInDegree?: number;
  /** Below this mean distinctiveness → 'strip'. Default 0.3. */
  stripThreshold?: number;
  /** Below this mean distinctiveness → 'review' (else 'keep'). Default 0.5. */
  reviewThreshold?: number;
  /** Wiki folder prefix used to strip when parsing ## Related links. */
  wikiFolder?: string;
  /**
   * Section headings that hold the Related list, already localized (#1034).
   *
   * The write path emits `Related Entities` / `Related Concepts` from
   * `SECTION_LABELS` (`system-prompts.ts:21`), or the localized pair. This scanner
   * matched `related` / `see also` / `related pages` only, so it read nothing on any
   * vault the plugin wrote — in English too, because the heading carries a suffix.
   * Callers pass `getSectionLabels(settings)` here.
   *
   * Defaults to the legacy headings, so a hand-written or older page still reads.
   */
  relatedHeadings?: readonly string[];
}

/**
 * Headings a Related list has been written under: the legacy names plus the two the
 * current write path uses in English. A caller with settings should pass the localized
 * pair; this default keeps a page that predates localization, or one written by hand,
 * readable.
 */
const DEFAULT_RELATED_HEADINGS: readonly string[] = [
  'related',
  'see also',
  'related pages',
  'related entities',
  'related concepts',
];

/**
 * The legacy headings PLUS whatever the caller passes.
 *
 * Union, not replacement: a vault written by an older version, or by hand, can carry
 * `## Related` on one page and the localized pair on another, and both are the same
 * list. Two Related sections on one page are also both Related lists, so reading every
 * match is the right rule either way.
 */
function headingSet(headings: readonly string[] | undefined): Set<string> {
  const all = [...DEFAULT_RELATED_HEADINGS, ...(headings ?? [])];
  return new Set(all.map(h => h.trim().toLowerCase()).filter(Boolean));
}

const DEFAULT_STRIP_THRESHOLD = 0.3;
const DEFAULT_REVIEW_THRESHOLD = 0.5;

/**
 * Score distinctiveness of each target relative to other targets.
 *
 * For each target t, computes mean(PPR(t) | seed=u) for u in the other
 * targets. Higher mean → more redundant (other targets reach t
 * through the graph) → lower distinctiveness. Returns a map
 * target → distinctiveness in [0, 1].
 *
 * If the target list has fewer than 2 entries, all targets get
 * distinctiveness = 1 (no comparison set).
 */
export function scoreHubLinkDistinctiveness(
  graph: Graph,
  hubNode: string,
  relatedTargets: string[],
  options: PPROptions = {},
): Map<string, number> {
  const result = new Map<string, number>();

  if (relatedTargets.length === 0) return result;
  if (relatedTargets.length === 1) {
    result.set(relatedTargets[0], 1.0);
    return result;
  }

  // Step 1: For each target, run PPR to get its score from the hub.
  // (Used for fallback if the redundancy map is degenerate.)
  // Step 2: For each target t, compute mean PPR(t | seed=u) for u in others.
  //
  // The PPR walk from `u` depends only on `u`. It used to sit inside the `t`
  // loop and was recomputed for every pair — n*(n-1) walks instead of n. On a
  // hub with 20 related links that is 380 walks instead of 20. Hoisted. The
  // algorithm is unchanged and so is every number it produces; only the number
  // of walks changes.
  const pprBySeed = new Map<string, ReadonlyMap<string, number>>();
  for (const u of relatedTargets) {
    // The rng is seeded from the walk's own seed when the caller supplies
    // none, so the same graph gives the same score every time. It used to be
    // `Math.random`, so a page's distinctiveness — and with it the
    // recommendation that can strip a link — was a different number on every
    // run.
    pprBySeed.set(u, personalizedPageRank(graph, u, {
      ...options,
      rng: options.rng ?? seededRngFrom(u, [u]),
    }));
  }
  const redundancyByTarget = new Map<string, number>();
  for (const t of relatedTargets) {
    let total = 0;
    let count = 0;
    for (const u of relatedTargets) {
      if (t === u) continue;
      // PPR from u: t's score reflects how "visible" t is from u.
      total += pprBySeed.get(u)?.get(t) ?? 0;
      count++;
    }
    const mean = count > 0 ? total / count : 0;
    redundancyByTarget.set(t, mean);
  }

  // Step 3: Normalize redundancy to [0, 1] within the target set.
  // If max is 0 (all targets are isolated from each other), assign
  // distinctiveness = 1 to all.
  const maxRed = Math.max(...redundancyByTarget.values(), 0.0001);
  if (maxRed <= 0.0001) {
    for (const t of relatedTargets) result.set(t, 1.0);
    return result;
  }

  for (const t of relatedTargets) {
    const red = redundancyByTarget.get(t) ?? 0;
    const distinctiveness = 1 - red / maxRed;
    result.set(t, distinctiveness);
  }

  return result;
}

/**
 * Parse the ## Related section of a page body and return [[link]] targets.
 *
 * Splits the body on `^## ` headings and extracts the ## Related (or
 * "相关"/"Verwandt"/etc. — but we use the English convention per the
 * wiki-engine contract) section. Returns the empty array if the
 * section is missing.
 */
function parseRelatedTargets(content: string, wikiFolder: string, headings: Set<string>): string[] {
  // Split on `## ` headings, and keep EVERY section whose heading names a Related
  // list. The write path uses two of them — entities and concepts — and treats both as
  // one deduped list, so stopping at the first section would read half of it.
  const sections = content.split(/^##\s+/m);
  const relatedSections: string[] = [];
  for (const sec of sections) {
    const headingEnd = sec.indexOf('\n');
    const heading = (headingEnd === -1 ? sec : sec.slice(0, headingEnd)).trim().toLowerCase();
    if (headings.has(heading)) relatedSections.push(sec);
  }
  if (relatedSections.length === 0) return [];

  // Extract [[link]] targets, one entry per target across both sections.
  const linkRegex = /\[\[([^\]|#]+)(?:[|#][^\]]+)?\]\]/g;
  const targets: string[] = [];
  const seen = new Set<string>();
  const prefix = wikiFolder.endsWith('/') ? wikiFolder : wikiFolder + '/';
  for (const relatedSection of relatedSections) {
    let match: RegExpExecArray | null;
    while ((match = linkRegex.exec(relatedSection)) !== null) {
      const raw = match[1].trim();
      // Strip wiki folder prefix.
      const target = raw.startsWith(prefix) ? raw.slice(prefix.length) : raw;
      if (!seen.has(target)) {
        seen.add(target);
        targets.push(target);
      }
    }
  }
  return targets;
}

/**
 * Remove low-distinctiveness links from a page's Related section.
 *
 * Pure. No IO. Returns the new content and how many links were removed, so a
 * fix runner can report what it did and a test can assert the mutation rather
 * than just the count.
 *
 * The removal is by line, not by substring: a bullet that names the target
 * goes, a bullet that names something else stays even if the two share a word.
 * Prose outside the Related section is never touched — a name may be discussed
 * in the body where it is content, and stripping it there would be editing the
 * author's argument.
 */
export function stripLowDistinctivenessLinks(
  content: string,
  targets: readonly string[],
  wikiFolder: string,
  relatedHeadings?: readonly string[],
): { content: string; removed: number } {
  if (targets.length === 0) return { content, removed: 0 };
  const strip = new Set(targets.map(t => t.trim()));
  const prefix = wikiFolder.endsWith('/') ? wikiFolder : wikiFolder + '/';
  // Same heading rule as the scanner (#1034): a section the scanner cannot read is a
  // section this cannot rewrite, and both were matching English without the suffix.
  const headings = headingSet(relatedHeadings);
  const sections = content.split(/^(?=##\s+)/m);
  let removed = 0;
  const linkRegex = /\[\[([^\]|#]+)(?:[|#][^\]]+)?\]\]/g;
  const rewritten = sections.map(sec => {
    const headingEnd = sec.indexOf('\n');
    const heading = (headingEnd === -1 ? sec : sec.slice(0, headingEnd))
      .replace(/^##\s+/, '').trim().toLowerCase();
    if (!headings.has(heading)) return sec;
    return sec.split('\n').filter(line => {
      let m: RegExpExecArray | null;
      linkRegex.lastIndex = 0;
      while ((m = linkRegex.exec(line)) !== null) {
        const raw = m[1].trim();
        const target = raw.startsWith(prefix) ? raw.slice(prefix.length) : raw;
        if (strip.has(target)) { removed += 1; return false; }
      }
      return true;
    }).join('\n');
  });
  return { content: rewritten.join(''), removed };
}

/**
 * Scan a pageMap for hub pages with low link distinctiveness in
 * their ## Related section.
 */
export function scanHubLinkDensity(
  pageMap: Map<string, { path: string; content: string }>,
  graph: Graph,
  options: HubLinkDensityOptions = {},
): HubLinkDensityIssue[] {
  const stripThreshold = options.stripThreshold ?? DEFAULT_STRIP_THRESHOLD;
  const reviewThreshold = options.reviewThreshold ?? DEFAULT_REVIEW_THRESHOLD;
  const wikiFolder = options.wikiFolder ?? '';
  const headings = headingSet(options.relatedHeadings);

  if (graph.nodes.length === 0 || pageMap.size === 0) return [];

  const hubs = detectHubs(graph, {
    minInDegree: options.minInDegree,
    pprOptions: options,
  });

  const hubSet = new Set(hubs.map(h => h.node));
  const inDegreeByNode = new Map<string, number>();
  for (const h of hubs) inDegreeByNode.set(h.node, h.inDegree);

  const issues: HubLinkDensityIssue[] = [];
  for (const [path, page] of pageMap) {
    if (!hubSet.has(path)) continue;
    const targets = parseRelatedTargets(page.content, wikiFolder, headings);
    if (targets.length === 0) continue;

    // Score distinctiveness for each target.
    const distinctiveness = scoreHubLinkDistinctiveness(
      graph,
      path,
      targets,
      options,
    );

    // Compute mean distinctiveness.
    let totalDis = 0;
    for (const [, d] of distinctiveness) totalDis += d;
    const mean = targets.length > 0 ? totalDis / targets.length : 1;

    // Identify low-distinctiveness targets (below reviewThreshold).
    const lowDis: string[] = [];
    for (const t of targets) {
      if ((distinctiveness.get(t) ?? 0) < reviewThreshold) {
        lowDis.push(t);
      }
    }

    let recommendation: Recommendation;
    if (mean < stripThreshold) recommendation = 'strip';
    else if (mean < reviewThreshold) recommendation = 'review';
    else recommendation = 'keep';

    issues.push({
      pagePath: path,
      inDegree: inDegreeByNode.get(path) ?? 0,
      totalRelatedLinks: targets.length,
      distinctivenessScore: mean,
      recommendation,
      lowDistinctivenessTargets: lowDis,
    });
  }

  return issues;
}
