#!/usr/bin/env npx tsx
/**
 * run-answer-path-ab.mjs — does the ANSWER path's lexical channel score better
 * with BM25F than with the hand-tuned weight table?
 *
 * Two scorers, one entry point, the same query on both sides:
 *   A  selectPprSeeds WITHOUT `termIndex` — `pprCascade` gets no tables and
 *      `lexMatch` falls back to title 3 / alias 2 / summary 1 / text 1.
 *   B  selectPprSeeds WITH `termIndex` — the cache's `getFull` tables reach
 *      `lexMatch` and BM25F decides.
 *
 * Both arms run the shipped pipeline: same pages, same bodies, same graph, same
 * seeds, `RETRIEVAL_BUDGET`. The only difference is whether the tables arrive.
 *
 * The loading is production: `parseIndexForPages` for the page list and the
 * summaries, `withBodies` for the prose, `buildGraphFromContent` for the edges.
 * The wiki index carries a one-line description per page and no bodies; reading
 * the .md tree and calling `body.slice(0, 200)` the summary measures a different
 * corpus than the one the plugin scores.
 *
 * Questions are built from the production graph's own edges — (asker -> truth)
 * pairs where the truth's vocabulary is mostly absent from the asker's, so the
 * answer needs something other than string overlap. `--exclude-asker` drops the
 * asking page: the query is the asker's own summary, so leaving it in lets the
 * ranker find the question's source instead of the answer (trap six).
 *
 * Usage:
 *   npx tsx run-answer-path-ab.mjs <vaultDir> [--limit n] [--no-exclude-asker]
 *
 * Measured 2026-10-16, r@20:
 *   sample-50page        53 pages,  154 questions  0.851 -> 0.870  (+0.019)
 *   expA-main/wiki      161 pages,  300 questions  0.700 -> 0.733  (+0.033)
 *   test8               172 pages,  300 questions  0.813 -> 0.827  (+0.013)
 *
 * The Chinese vaults are the ones that matter here. `lexMatch`'s BM25F branch
 * handed it `tokenizeQuery` output, which keeps a CJK run as one token, so it
 * returned NO page at all for 深度学习 while the weight table returned the right
 * one — wiring BM25F before that fix would have been a regression. Both numbers
 * above are after the segmentation fix; @DocTpoint measured the before.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parseIndexForPages } from '../../src/core/index-search.ts';
import { buildGraphFromContent } from '../../src/core/build-graph.ts';
import { withBodies } from '../../src/wiki/query-engine/pipeline/read-index.ts';
import { selectPprSeeds } from '../../src/wiki/query-engine/pipeline/select-seeds.ts';
import { TermIndexCache } from '../../src/core/term-index-cache.ts';
import { EN_TEXTS } from '../../src/texts/en.ts';
import { segment } from '../../src/core/term-index.ts';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: run-answer-path-ab.mjs <vaultDir> [--limit n] [--no-exclude-asker]');
  process.exit(1);
}
const EXCLUDE_ASKER = !process.argv.includes('--no-exclude-asker');
const limitAt = process.argv.indexOf('--limit');
const LIMIT = limitAt >= 0 ? Number(process.argv[limitAt + 1]) : 200;
const raw = existsSync(join(dir, 'index.md')) ? readFileSync(join(dir, 'index.md'), 'utf8') : '';
const pageRefs = parseIndexForPages(raw);
const allPaths = new Set(pageRefs.map(p => p.path));
const bodies = new Map();
const loaded = [];
for (const ref of pageRefs) {
  const f = join(dir, `${ref.path}.md`);
  if (!existsSync(f)) continue;
  const c = readFileSync(f, 'utf8');
  bodies.set(ref.path, c);
  loaded.push({ path: ref.path, content: c });
}
const graph = buildGraphFromContent(loaded, allPaths, '');
const refs = withBodies(pageRefs, bodies);
const byPath = new Map(refs.map(p => [p.path, p]));

const qs = [];
for (const [from, targets] of graph.edges) {
  const a = byPath.get(from); if (!a) continue;
  for (const t of targets) {
    const b = byPath.get(t); if (!b || b === a) continue;
    const bT = new Set(segment(`${b.title} ${b.summary ?? ''}`));
    if (bT.size === 0) continue;
    const aT = new Set(segment(`${a.title} ${a.summary ?? ''}`));
    if ([...bT].filter(x => aT.has(x)).length / bT.size > 0.67) continue;
    const terms = [...segment(a.summary ?? '')].filter(x => !bT.has(x));
    if (terms.length < 1) continue;
    qs.push({ query: terms.join(' '), truth: t, asker: from });
  }
}
const questions = qs.slice(0, LIMIT);
const cache = new TermIndexCache();
let A = 0, B = 0;
for (const q of questions) {
  const use = EXCLUDE_ASKER ? refs.filter(p => p.path !== q.asker) : refs;
  const a = await selectPprSeeds(q.query, use, graph, undefined, { model: 'm' }, EN_TEXTS, undefined, undefined);
  const b = await selectPprSeeds(q.query, use, graph, undefined, { model: 'm' }, EN_TEXTS, undefined,
    { cache, indexContent: raw });
  const ha = a.matches.some(m => m.page.path === q.truth);
  const hb = b.matches.some(m => m.page.path === q.truth);
  if (ha) A++; if (hb) B++;
}
const n = questions.length;
console.log(`vault=${basename(dir)} pages=${refs.length} questions=${n}`);
console.log(`A weight table (no termIndex) r@20 = ${(A / n).toFixed(3)}`);
console.log(`B BM25F answer path             r@20 = ${(B / n).toFixed(3)}`);
console.log(`delta ${((B - A) / n).toFixed(3)}`);
