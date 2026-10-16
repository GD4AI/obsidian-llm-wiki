/**
 * Load the synthetic wiki at `src/__tests__/fixtures/wikis/sample-50page`.
 *
 * Why this exists. The project ships a synthetic wiki fixture: sixty pages of
 * medical concepts with frontmatter, aliases and wiki-links. It is the right
 * input for tests that need a graph and a vocabulary, because it is synthetic
 * (no contributor's vault can break it), it is English (readable to every
 * contributor), and it is already in the repo (nothing to download).
 *
 * This loader turns those markdown files into the `ExpansionPage` shape the
 * query-expansion code reads. Tests that only need the expansion machinery
 * should prefer the small synthetic fixtures in `expansion-fixtures.ts`, which
 * describe a property in four pages; tests that need a realistic graph and
 * vocabulary should use this one.
 *
 * The loader is deterministic: the same fixture directory always produces the
 * same page order, so a test that asserts on a rank can rely on it.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { ExpansionPage } from '../../core/query-expansion';

export interface WikiPage extends ExpansionPage {
  readonly path: string;
  readonly aliases: readonly string[];
  readonly links: readonly string[];
  readonly sourceSlug: string;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.name.endsWith('.md')) out.push(p);
  }
  return out.sort();
}

function parseFrontmatter(raw: string): { body: string; fm: Record<string, string> } {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return { body: raw, fm: {} };
  const fm: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z][A-Za-z0-9_]*):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return { body: raw.slice(m[0].length), fm };
}

function parseAliases(fmBlock: string): string[] {
  return [...fmBlock.matchAll(/^\s*-\s*(.+)$/gm)].map(m => m[1].replace(/^["']|["']$/g, ''));
}

/**
 * Load every page under `fixtureRoot`. The default root is the sample wiki
 * that ships with the repo; a caller can pass any directory of markdown files
 * with frontmatter, so the loader works on a contributor's own fixture too.
 */
export function loadWikiFixture(fixtureRoot?: string): WikiPage[] {
  const root = fixtureRoot ?? join(__dirname, '..', 'fixtures', 'wikis', 'sample-50page');
  const files = walk(root);
  return files.map(f => {
    const raw = readFileSync(f, 'utf8');
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n/);
    const fmBlock = fmMatch ? fmMatch[1] : '';
    const { body, fm } = parseFrontmatter(raw);
    const rel = f.slice(root.length + 1);
    const title = fm.title ?? rel.split('/').pop()!.replace(/\.md$/, '');
    const aliases = parseAliases(fmBlock.match(/^aliases:\s*\n((?:\s*-\s*.+\n?)*)/m)?.[1] ?? '');
    const links = [...body.matchAll(/\[\[([^\]|#]+)/g)].map(m => m[1].trim());
    // The path is relative to the fixture root and keeps the `.md`, so a
    // wiki-link written `[[concepts/Myocardial Infarction]]` resolves by
    // stripping the extension. The absolute path is not what the fixture's
    // links use.
    return {
      key: rel,
      path: rel,
      title,
      summary: body.slice(0, 200),
      text: body,
      aliases,
      links,
      sourceSlug: fm.sourceSlug ?? fm.sources ?? 'default',
    };
  });
}

/**
 * The shape `pprCascade` and the graph builder expect. Kept separate from
 * `ExpansionPage` because the PPR path wants paths and links while the
 * expansion path wants text.
 */
export function toPprPages(pages: readonly WikiPage[]): Array<{ path: string; title: string; aliases: readonly string[]; text: string }> {
  return pages.map(p => ({ path: p.path, title: p.title, aliases: p.aliases, text: p.text }));
}

/** Build the link graph the PPR cascade walks. */
export function buildLinkGraph(pages: readonly WikiPage[]): { nodes: string[]; edges: Map<string, string[]> } {
  // The fixture's wiki-links are written as `[[concepts/Myocardial Infarction]]`
  // — the path relative to the fixture root, without the `.md`. Index the
  // pages by that form and by the bare title, so a link written either way
  // resolves. A link that resolves to nothing is dropped: the fixture and the
  // graph must agree or the test that walks the graph is testing the wrong
  // thing.
  const byKey = new Map<string, string>();
  for (const p of pages) {
    byKey.set(p.path.replace(/\.md$/, ''), p.path);
    byKey.set(p.title, p.path);
  }
  const edges = new Map<string, string[]>();
  for (const p of pages) {
    const targets = p.links.map(t => byKey.get(t)).filter((t): t is string => Boolean(t));
    if (targets.length) edges.set(p.path, targets);
  }
  return { nodes: pages.map(p => p.path), edges };
}
