// build-graph.ts — v1.23.0 Graph Engine: wiki-link graph builder
//
// Pure function. Scans wiki page bodies for [[wiki-folder/path/to/page]] links
// and builds a { nodes, edges } Graph for use with pprCascade / Monte Carlo
// PPR. Zero IO, no side effects.
//
// The graph contains ALL known pages as nodes (allPaths), even those whose
// content was not loaded. Edges are derived only from the loaded page bodies.
// Pages with no outgoing links get an empty edge array.
//
// Strips fragment identifiers ([[path#section]]) and display text ([[path|text]])
// from wiki links. Deduplicates edges. Skips self-links.

import type { Graph } from './monte-carlo-ppr';

export type { Graph };

/**
 * Loaded page content for graph construction.
 */
export interface LoadedPage {
  path: string;
  content: string;
}

/**
 * Wiki-link regex: matches [[wiki-folder/path/to/page]] constructs.
 * Supports:
 *   - [[wiki/entities/page]] or [[wiki/concepts/name]]
 *   - [[wiki/entities/page|Display Text]]
 *   - [[wiki/entities/page#section|Text]]
 *   - [[wiki/entities/page#^block-id]]
 *
 * Group 1: the full wiki-link target (path + optional fragment)
 * Group 2: the raw path without fragment (entities/page)
 * Group 3: optional display text after `|`
 */
const WIKI_LINK_RE = /\[\[([^\]|#]+?)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g;

/**
 * Build a Graph from loaded page content.
 *
 * @param loadedPages — pages whose body content is available (may be empty).
 * @param allPaths — set of ALL known wiki page paths (nodes to include).
 * @param wikiFolder — the wiki folder prefix to strip from links (e.g. "wiki").
 * @returns a Graph with all paths as nodes and edges derived from loaded content.
 */
export function buildGraphFromContent(
  loadedPages: LoadedPage[],
  allPaths: Set<string>,
  wikiFolder: string,
): Graph {
  const nodes = [...allPaths];
  const edges = new Map<string, string[]>();

  // Initialize empty edge arrays for all known paths.
  for (const path of nodes) {
    edges.set(path, []);
  }

  for (const page of loadedPages) {
    edges.set(page.path, edgesForPage(page.content, page.path, allPaths, wikiFolder));
  }

  return { nodes, edges };
}

/**
 * The outgoing edges one page's body produces.
 *
 * Extracted from `buildGraphFromContent` on 2026-11-13 (#1018) so the incremental
 * path and the full build cannot disagree about what a link means. The incremental
 * path needs it alone: when a page is written during an ingest run, its edges are
 * added to the run's cached graph, and re-deriving them with a second regex would
 * be a second definition of "resolves to".
 *
 * Pure. Same inputs, same output, and the target order is the order the links
 * appear in the body.
 */
export function edgesForPage(
  content: string,
  sourcePath: string,
  allPaths: Set<string>,
  wikiFolder: string,
): string[] {
  const prefix = wikiFolder.endsWith('/') ? wikiFolder : wikiFolder + '/';
  const pathBySlug = new Map<string, string>();
  for (const p of allPaths) pathBySlug.set(p.split('/').pop() || p, p);

  const seen = new Set<string>();
  const out: string[] = [];
  WIKI_LINK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = WIKI_LINK_RE.exec(content)) !== null) {
    const rawTarget = match[1]; // e.g. "wiki/entities/dog"
    const fullTarget = rawTarget.startsWith(prefix) ? rawTarget.slice(prefix.length) : rawTarget;
    const resolvedPath =
      allPaths.has(fullTarget)
        ? fullTarget
        : allPaths.has(rawTarget)
          ? rawTarget
          : pathBySlug.get(fullTarget) && allPaths.has(pathBySlug.get(fullTarget)!)
            ? pathBySlug.get(fullTarget)!
            : null;
    if (resolvedPath === null || resolvedPath === sourcePath) continue;
    if (seen.has(resolvedPath)) continue;
    seen.add(resolvedPath);
    out.push(resolvedPath);
  }
  return out;
}
