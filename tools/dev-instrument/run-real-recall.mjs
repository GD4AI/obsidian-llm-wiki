#!/usr/bin/env node
/**
 * #819 step 4 — measure lambda on a REAL vault, using proxies for the ground
 * truth a real vault does not have.
 *
 * Synthetic scenarios prove the mechanism. They do not tell you how often the
 * scenario occurs. The review's case was "one source holds eight relevant pages
 * and lambda 1 loads one of them". Is that shape common in a real vault, or is
 * it a constructed edge case? Only a real corpus can answer.
 *
 * Two proxies, both built from the vault's own structure:
 *
 * 1. CO-CITATION SET. A page citing `[[sources/x]]` is *about* source x, so all
 *    pages citing x form a defensible relevant set. Query with one of them and
 *    measure how much of that set loads. This is a real recall@K.
 *
 * 2. SAME-SOURCE SHARE. For the same query, what fraction of the top-K shares
 *    the query page's source? If a source's pages genuinely cluster at the top,
 *    the review's scenario is real and lambda must be low. If they do not, a
 *    high lambda costs nothing.
 *
 * Usage:
 *   npx tsx tools/dev-instrument/run-real-recall.mjs <vaultDir> [queryPagePath ...]
 */
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { assembleWithCoverage } from '../../src/core/assembly.ts';
import {
  buildPageTerms, buildCorpusTerms, bm25fScore, segment, DEFAULT_FIELD_WEIGHTS,
} from '../../src/core/term-index.ts';

const LAMBDAS = [0, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5];
const BUDGET = 10;
const K = 10;

function slugFromFrontmatter(text) {
  const m = /^sources:\s*(.+)$/m.exec(text);
  if (!m) return undefined;
  const inner = /\[\[sources\/([^|\]]+)(?:\|[^\]]+)?\]\]/.exec(m[1]);
  return inner ? inner[1].trim() : undefined;
}

function titleOf(text, fallback) {
  const m = /^#\s+(.+)$/m.exec(text);
  return m ? m[1].trim() : fallback;
}

function summaryOf(text) {
  const lines = text.split('\n');
  let started = false;
  for (const line of lines) {
    if (/^---\s*$/.test(line)) { started = started || !started; continue; }
    if (!started) continue;
    const t = line.trim();
    if (!t || t.startsWith('#') || t.startsWith('>') || t.startsWith('-') || t.startsWith('|')) continue;
    return t.slice(0, 100);
  }
  return '';
}

async function loadVault(dir) {
  const pages = [];
  const walk = async (folder) => {
    for (const e of await readdir(folder, { withFileTypes: true })) {
      const p = join(folder, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.name.endsWith('.md')) {
        const text = await readFile(p, 'utf8').catch(() => '');
        const rel = relative(dir, p).replace(/\.md$/, '');
        pages.push({
          key: rel,
          title: titleOf(text, e.name.replace(/\.md$/, '')),
          summary: summaryOf(text),
          sourceSlug: slugFromFrontmatter(text),
        });
      }
    }
  };
  await walk(dir);
  return pages;
}

const dir = process.argv[2];
if (!dir) { console.error('usage: run-real-recall.mjs <vaultDir>'); process.exit(1); }

const pages = await loadVault(dir);
const attributed = pages.filter(p => p.sourceSlug !== undefined);
console.log(`\nVault ${dir}`);
console.log(`  pages ${pages.length}, attributed ${attributed.length} (${(attributed.length / pages.length * 100).toFixed(1)}%)`);

// Source -> pages, for the co-citation relevant set.
const bySource = new Map();
for (const p of attributed) {
  if (!bySource.has(p.sourceSlug)) bySource.set(p.sourceSlug, []);
  bySource.get(p.sourceSlug).push(p);
}
const multiSource = [...bySource.entries()].filter(([, ps]) => ps.length >= 4);
console.log(`  sources ${bySource.size}, with >=4 pages ${multiSource.length}`);

if (multiSource.length === 0) {
  console.log('  no source has >=4 pages; the co-citation set would be too small to measure.');
  process.exit(0);
}

const pts = pages.map(p => buildPageTerms({ title: p.title, aliases: [], summary: p.summary, text: '' }));
const corpus = buildCorpusTerms(pts);
const indexByKey = new Map(pages.map((p, i) => [p.key, i]));

// Query seeds: one page per multi-page source, capped so a huge source does not
// dominate the average.
const seeds = [];
for (const [slug, ps] of multiSource) {
  for (const p of ps.slice(0, 5)) seeds.push({ page: p, slug });
}
console.log(`  query seeds ${seeds.length}\n`);

console.log('lambda  selfTopK  coCitRecall  sameSrcShare  sources  bare/query');
console.log('------  --------  -----------  ------------  -------  ----------');
for (const lambda of LAMBDAS) {
  let selfHits = 0, coCit = 0, sameSrc = 0, sources = 0, bare = 0, n = 0;
  for (const { page, slug } of seeds) {
    const terms = segment(`${page.title} ${page.summary}`);
    if (terms.length === 0) continue;
    const scored = pts.map((pt, j) => ({
      item: { key: pages[j].key, sourceSlug: pages[j].sourceSlug },
      score: bm25fScore(terms, pt, corpus, DEFAULT_FIELD_WEIGHTS),
    }));
    scored.sort((a, b) => b.score - a.score);
    const r = assembleWithCoverage(scored, BUDGET, { lambda });
    const picked = r.picked.map(x => x.item.key);
    n += 1;

    if (picked.includes(page.key)) selfHits += 1;

    const relevant = bySource.get(slug).map(x => x.key);
    const hits = relevant.filter(k => picked.includes(k)).length;
    coCit += hits / relevant.length;

    const same = r.picked.filter(x => x.item.sourceSlug === slug).length;
    sameSrc += same / r.picked.length;

    sources += r.pickedSources;
    bare += r.picked.filter(x => x.sourceSlug === null).length;
  }
  const pad = (v, w, d = 3) => v.toFixed(d).padStart(w);
  console.log(`${String(lambda).padStart(6)}  ${pad(selfHits / n * 100, 7, 1)}%  ${pad(coCit / n, 11)}  ${pad(sameSrc / n * 100, 11, 1)}%  ${pad(sources / n, 7, 2)}  ${pad(bare / n, 10, 1)}`);
}
console.log('\n  selfTopK    — % of seeds whose own page is in the top-10');
console.log('  coCitRecall — share of the seed\'s co-citation set in the top-10 (real recall)');
console.log('  sameSrcShare— share of the top-10 from the seed\'s own source (the review\'s scenario)');
