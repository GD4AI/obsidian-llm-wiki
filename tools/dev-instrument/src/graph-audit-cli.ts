// graph-audit-cli.ts — point the graph audit at a vault on disk.
//
// Dev-only, same standing as the rest of `tools/dev-instrument/`: not a
// user-facing CLI. It answers four questions about a real wiki graph so the
// #729 phases can be ordered by numbers instead of by argument.
//
// It builds the graph with the production `buildGraphFromContent`, not with a
// private parser, because the audit has to measure the graph the query path
// actually walks. A private parser would measure a different object.
//
// Bot-compliance (issue #507, same pattern as vault-fs.ts):
// - every `node:*` access goes through `loadNodeModules()`, which guards on
//   Platform.isDesktop before `await import('node:module')` + createRequire.
// - no static `node:*` import anywhere in this file.

import { loadNodeModules } from './vault-fs';
import { buildGraphFromContent } from '../../../src/core/build-graph';
import { parseFrontmatter, originNoteRefs } from '../../../src/core/frontmatter';
import { graphAudit, type GraphAuditReport } from './graph-audit';

export interface GraphAuditCliOptions {
  /** Vault root on disk — the folder that holds the wiki folder. */
  vaultRoot: string;
  /** Wiki folder name inside the vault, e.g. "wiki". */
  wikiFolder: string;
  /** How many nodes count as "the main nodes". */
  topK: number;
}

/** One page as the audit reads it: its index path and its raw content. */
export interface VaultPage {
  path: string;
  content: string;
}

/**
 * `sources/<slug>` or `sources/<slug>.md` in a frontmatter ref becomes the bare
 * slug, which is the identity a source page carries about itself. Two spellings
 * of one source must not count as two sources.
 */
export function sourceSlugOf(ref: string): string {
  const trimmed = ref.trim().replace(/^\/+|\/+$/g, '').replace(/\.md$/i, '');
  const last = trimmed.split('/').pop() ?? trimmed;
  return last;
}

async function readWikiPages(opts: GraphAuditCliOptions): Promise<VaultPage[]> {
  const { nodePath, nodeFsPromises } = await loadNodeModules();
  const root = nodePath.resolve(opts.vaultRoot, opts.wikiFolder);
  const pages: VaultPage[] = [];
  // Walked by hand rather than `readdir(root, { recursive: true })`: the
  // recursive overload is not on every @types/node this repo pins, and a
  // type error here would hide a real one later.
  const walk = async (dir: string): Promise<void> => {
    const entries = await nodeFsPromises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = nodePath.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const rel = nodePath.relative(root, full).split(nodePath.sep).join('/');
      const index = rel.replace(/\.md$/i, '');
      if (index === 'index' || index === 'log') continue;
      const content = await nodeFsPromises.readFile(full, 'utf8');
      pages.push({ path: index, content });
    }
  };
  await walk(root);
  return pages;
}

/** Every page's source identities: its own slug for a source page, else its frontmatter. */
export function sourceMapOf(pages: readonly VaultPage[]): Map<string, string[]> {
  const sourceOf = new Map<string, string[]>();
  for (const page of pages) {
    const own = page.path.startsWith('sources/') ? [sourceSlugOf(page.path)] : [];
    const fm = parseFrontmatter(page.content);
    const refs = fm ? originNoteRefs(fm) : [];
    const fromFrontmatter = refs.map(sourceSlugOf);
    const merged = [...new Set([...own, ...fromFrontmatter])];
    sourceOf.set(page.path, merged);
  }
  return sourceOf;
}

/** Build the report and render it as text, so the caller can print or assert. */
export async function auditVault(opts: GraphAuditCliOptions): Promise<{ report: GraphAuditReport; text: string }> {
  const pages = await readWikiPages(opts);
  const allPaths = new Set(pages.map(p => p.path));
  const graph = buildGraphFromContent(pages, allPaths, opts.wikiFolder);
  const sourceOf = sourceMapOf(pages);
  const report = graphAudit({ graph, sourceOf }, { topK: opts.topK });
  return { report, text: renderReport(report, opts) };
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function renderReport(r: GraphAuditReport, opts: GraphAuditCliOptions): string {
  const lines: string[] = [];
  lines.push(`# graph-audit  vault=${opts.vaultRoot}  wiki=${opts.wikiFolder}`);
  lines.push(`nodes=${r.nodeCount}  edges=${r.edgeCount}`);
  lines.push('');
  lines.push(`1. planet share (top ${r.topInDegreeShare.k} by in-degree): ${pct(r.topInDegreeShare.share)} of all in-degree`);
  lines.push(`   top: ${r.topInDegree.slice(0, 10).map(t => `${t.path}(${t.inDegree})`).join(' ')}`);
  lines.push('');
  const s = r.intraSourceEdgeShare;
  lines.push(`2. edge origin: intra-source ${s.intra}  cross-source ${s.cross}  unattributed ${s.unattributed}`);
  lines.push(`   intra share over attributed edges: ${pct(s.share)}`);
  lines.push('');
  lines.push(`3. edges among the top ${r.topNodeEdges.k}: ${r.topNodeEdges.edgesAmong} of ${r.topNodeEdges.possible} possible (density ${pct(r.topNodeEdges.density)})`);
  lines.push('');
  lines.push('4. reachability among the top nodes / across sources');
  for (const row of r.topNodeReach) {
    const cross = r.crossSourceReach.find(c => c.hops === row.hops);
    lines.push(
      `   ${row.hops} hop(s): top-nodes ${row.directed}/${row.pairs} directed, ${row.undirected}/${row.pairs} undirected`
      + `  ·  cross-source ${pct(cross?.directed ?? 0)} directed, ${pct(cross?.undirected ?? 0)} undirected`,
    );
  }
  return lines.join('\n');
}

/** argv: <vault> <wikiFolder> [topK]. Returns a process exit code. */
export async function main(argv: readonly string[]): Promise<number> {
  const [vaultRoot, wikiFolder, topKRaw] = argv;
  if (!vaultRoot || !wikiFolder) {
    process.stderr.write('usage: run-graph-audit.mjs <vault> <wikiFolder> [topK]\n');
    return 2;
  }
  const topK = topKRaw ? Number.parseInt(topKRaw, 10) : 10;
  if (!Number.isInteger(topK) || topK < 1) {
    process.stderr.write(`topK must be a positive integer, got "${topKRaw}"\n`);
    return 2;
  }
  const { text } = await auditVault({ vaultRoot, wikiFolder, topK });
  process.stdout.write(`${text}\n`);
  return 0;
}
