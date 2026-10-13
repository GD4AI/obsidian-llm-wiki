#!/usr/bin/env node
// Layered evaluation — the tool #729 actually needs.
//
// Read-only. Three things the earlier eval tool did not do, all of them required
// before any tuning claim is worth reading:
//
//   1. LAYERS. #729 is about a question whose answer lies on a page the asker
//      did NOT share a source with. On the German re-test 64% of the bridge set
//      was same-source pairs, where the two pages already share wording and
//      nothing has to be bridged. The full-set number is therefore not the
//      issue's number. Cross-source and same-source are reported separately.
//
//   2. THE TRUTH EDGE. Production PPR walks the very edge that defines the
//      truth, so an arm that "finds" the answer may only be walking the answer.
//      Every arm prints both columns and the NO-EDGE column is the result.
//
//   3. CLUSTERED UNCERTAINTY. A thousand questions from 200 pages are not a
//      thousand independent samples. The bootstrap resamples ASKING PAGES, not
//      questions, so the interval reflects how much of the number is one page
//      repeating itself.
//
// Usage: npx tsx run-layered-eval.mjs <vaultDir> [--out file]

import { readFile, readdir } from 'node:fs/promises';
import { join, relative, basename } from 'node:path';
import { writeFileSync } from 'node:fs';
import {
  buildPageTerms, buildCorpusTerms, bm25fScore, segment, DEFAULT_FIELD_WEIGHTS,
} from '../../src/core/term-index.ts';
import { pprCascade } from '../../src/core/ppr-cascade.ts';
import { maxFuse, assembleWithCoverage, rrfFuse } from '../../src/core/assembly.ts';

const BUDGET = 20;

function bodyOf(text) {
  let fences = 0;
  const out = [];
  for (const line of text.split('\n')) {
    if (/^---\s*$/.test(line)) { fences += 1; continue; }
    if (fences < 2) continue;
    out.push(line);
  }
  return out.join('\n');
}
function summaryOf(text) {
  let fences = 0;
  for (const line of text.split('\n')) {
    if (/^---\s*$/.test(line)) { fences += 1; continue; }
    if (fences < 2) continue;
    const t = line.trim();
    if (!t || t.startsWith('#') || t.startsWith('>') || t.startsWith('-') || t.startsWith('|')) continue;
    return t.slice(0, 100);
  }
  return '';
}
function parseSourceSlug(text) {
  const m = /^sources:\s*(?:\n\s*-\s*(.+?)\s*$|(.+?)\s*$)/m.exec(text);
  const raw = (m?.[1] ?? m?.[2] ?? '').trim().replace(/^['\"]|['\"]$/g, '');
  return raw === '' ? undefined : raw;
}
function outlinks(text) {
  const s = new Set();
  const re = /\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g;
  let m;
  while ((m = re.exec(text)) !== null) s.add(m[1].trim());
  return s;
}

async function loadVault(dir) {
  const pages = [];
  const walk = async (f) => {
    for (const e of await readdir(f, { withFileTypes: true })) {
      const p = join(f, e.name);
      if (e.isDirectory()) { await walk(p); continue; }
      if (!e.name.endsWith('.md')) continue;
      const text = await readFile(p, 'utf8').catch(() => '');
      pages.push({
        key: relative(dir, p).replace(/\.md$/, ''),
        name: basename(p, '.md'),
        sourceSlug: parseSourceSlug(text),
        title: (/^#\s+(.+)$/m.exec(text)?.[1] ?? '').trim(),
        summary: summaryOf(text),
        body: bodyOf(text),
        links: outlinks(text),
      });
    }
  };
  await walk(dir);
  return pages;
}

function graphWithoutTruthEdge(graph, asker, truth) {
  const edges = new Map();
  for (const [k, v] of graph.edges) edges.set(k, v.filter(t => !(k === asker && t === truth)));
  return { nodes: graph.nodes, edges };
}

// Clustered bootstrap: resample ASKING PAGES with replacement, carry all of each
// page's questions along, and take the 2.5 / 97.5 percentiles. Questions from
// the same page are not independent, so a question-level bootstrap would report
// an interval far narrower than the evidence supports.
//
// `hits` is a PRECOMPUTED array of 0/1 aligned with `qs`. Bootstrapping must not
// re-run retrieval: an earlier version passed the scorer itself and paid for a
// full PPR walk per question per iteration, which is 400 x N retrievals per arm
// per layer and made the tool unusable. Compute once, resample the cheap part.
function clusterBootstrap(qs, hits, iters = 400, seed = 12345) {
  const byAsker = new Map();
  for (let i = 0; i < qs.length; i += 1) {
    const a = qs[i].from;
    if (!byAsker.has(a)) byAsker.set(a, []);
    byAsker.get(a).push(hits[i]);
  }
  const askers = [...byAsker.keys()];
  if (askers.length === 0) return { lo: 0, hi: 0, point: 0 };
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const point = hits.reduce((a, b) => a + b, 0) / Math.max(1, hits.length);
  const stats = [];
  for (let it = 0; it < iters; it += 1) {
    let hitSum = 0, n = 0;
    for (let i = 0; i < askers.length; i += 1) {
      const a = askers[Math.floor(rnd() * askers.length)];
      for (const h of byAsker.get(a)) { hitSum += h; n += 1; }
    }
    stats.push(hitSum / Math.max(1, n));
  }
  stats.sort((a, b) => a - b);
  return { lo: stats[Math.floor(iters * 0.025)], hi: stats[Math.floor(iters * 0.975)], point };
}

async function main() {
  const args = process.argv.slice(2);
  const vaultDir = args.find(a => !a.startsWith('--'));
  const outIdx = args.indexOf('--out');
  const outFile = outIdx >= 0 ? args[outIdx + 1] : null;
  if (!vaultDir) { console.error('usage: run-layered-eval.mjs <vaultDir> [--out file]'); process.exit(1); }

  const pages = await loadVault(vaultDir);
  const byName = new Map();
  for (const p of pages) { if (!byName.has(p.name)) byName.set(p.name, p); byName.set(p.key, p); }

  const mkIndex = (withBody) => {
    const pts = pages.map(p => buildPageTerms({
      title: p.title, aliases: [], summary: p.summary, text: withBody ? p.body : '',
    }));
    return { pts, corpus: buildCorpusTerms(pts) };
  };
  const noBody = mkIndex(false);
  const withBody = mkIndex(true);

  const graph = {
    nodes: pages.map(p => p.key),
    edges: new Map(pages.map(p => [p.key, [...p.links].map(t => byName.get(t)?.key).filter(Boolean)])),
  };

  // Questions. `cross` = the two pages share no source. That layer is the issue.
  const bridgeQs = [];
  for (const a of pages) {
    for (const tgt of a.links) {
      const b = byName.get(tgt);
      if (!b || b.key === a.key) continue;
      const aTerms = new Set(segment(`${a.title} ${a.summary}`));
      const bTerms = new Set(segment(`${b.title} ${b.summary}`));
      if (bTerms.size === 0) continue;
      const shared = [...bTerms].filter(t => aTerms.has(t)).length;
      if (shared / bTerms.size > 0.67) continue;
      const q = [...segment(a.summary)].filter(t => !bTerms.has(t));
      if (q.length < 1) continue;
      bridgeQs.push({ queryTerms: q, truth: b.key, from: a.key, cross: a.sourceSlug !== b.sourceSlug });
    }
  }
  const selfQs = pages.filter(p => p.summary.length > 0).map(p => ({
    queryTerms: segment(`${p.title} ${p.summary}`), truth: p.key, from: p.key, cross: false,
  }));

  const lexWith = (idx) => (q) => {
    const s = idx.pts.map((pt, j) => ({
      item: { key: pages[j].key, sourceSlug: pages[j].sourceSlug },
      score: bm25fScore(q.queryTerms, pt, idx.corpus, DEFAULT_FIELD_WEIGHTS),
    }));
    s.sort((a, b) => (b.score - a.score) || (a.item.key < b.item.key ? -1 : 1));
    return s;
  };
  const lex = lexWith(noBody);
  const lexBody = lexWith(withBody);

  const pprWith = (opts) => (q) => {
    const g = q.withoutEdge ? graphWithoutTruthEdge(graph, q.from, q.truth) : graph;
    const pprPages = pages.map(p => ({ path: p.key, title: p.title, aliases: [], summary: p.summary, score: 0 }));
    const m = pprCascade(q.queryTerms.join(' '), pprPages, { graph: g, topN: 200, pprOptions: opts });
    return m.map(x => ({ item: { key: x.page.path, sourceSlug: byName.get(x.page.path)?.sourceSlug }, score: x.score }));
  };
  const ppr = pprWith({ damping: 0.30, maxSteps: 10 });

  // E2 — REVERSE channel. `graph.edges` are OUT-edges (A -> B means A links to
  // B). Reverse the graph so the walk follows IN-edges: "who links to X".
  // A query is ambiguous between "what does X reference" and "what references
  // X", and one direction answers only one of them. Measuring graph direction
  // showed undirected gains +0.07 on reverse questions and loses -0.06 on
  // forward ones — a 1:1 trade. So the reverse walk is its OWN channel and is
  // NOT merged into the graph: `maxFuse` picks per page, so a page reachable
  // only backwards keeps its score instead of diluting the forward walk.
  const revEdges = new Map(pages.map(p => [p.key, []]));
  for (const [src, tgts] of graph.edges) {
    for (const t of tgts) {
      if (!revEdges.has(t)) continue;
      revEdges.get(t).push(src);
    }
  }
  const revGraph = { nodes: graph.nodes, edges: revEdges };
  const pprRevWith = (opts) => (q) => {
    const g = q.withoutEdge ? graphWithoutTruthEdge(revGraph, q.from, q.truth) : revGraph;
    const pprPages = pages.map(p => ({ path: p.key, title: p.title, aliases: [], summary: p.summary, score: 0 }));
    const m = pprCascade(q.queryTerms.join(' '), pprPages, { graph: g, topN: 200, pprOptions: opts });
    return m.map(x => ({ item: { key: x.page.path, sourceSlug: byName.get(x.page.path)?.sourceSlug }, score: x.score }));
  };
  const pprRev = pprRevWith({ damping: 0.30, maxSteps: 10 });

  const fuseMax = (channels) => {
    const lists = channels.map((f, ci) => ({ channel: `c${ci}`, candidates: f.map((c, i) => ({ item: c.item, rank: i + 1 })) }));
    return maxFuse(lists).map(f => ({ item: f.item, score: f.score }));
  };
  const fuseRrf = (channels) => {
    const lists = channels.map((f, ci) => ({ channel: `c${ci}`, candidates: f.map((c, i) => ({ item: c.item, rank: i + 1 })) }));
    return rrfFuse(lists).map(f => ({ item: f.item, score: f.score }));
  };

  const arms = [
    { name: 'lex', run: (q) => fuseMax([lex(q)]) },
    { name: 'lex + body', run: (q) => fuseMax([lexBody(q)]) },
    { name: 'ppr 0.30/10', run: (q) => fuseMax([ppr(q)]) },
    { name: 'rrf lex+ppr', run: (q) => fuseRrf([lex(q), ppr(q)]) },
    { name: 'maxFuse lex+ppr', run: (q) => fuseMax([lex(q), ppr(q)]) },
    { name: 'maxFuse body+ppr', run: (q) => fuseMax([lexBody(q), ppr(q)]) },
    { name: 'maxFuse body only', run: (q) => fuseMax([lexBody(q)]) },
    { name: 'ppr rev 0.30/10', run: (q) => fuseMax([pprRev(q)]) },
    { name: 'maxFuse body+ppr+rev', run: (q) => fuseMax([lexBody(q), ppr(q), pprRev(q)]) },
    { name: 'maxFuse ppr+rev', run: (q) => fuseMax([ppr(q), pprRev(q)]) },
  ];

  const pick = (q, arm) => {
    const fused = arm.run(q);
    const r = assembleWithCoverage(fused, BUDGET, {});
    return r.picked.map(x => x.item.key).indexOf(q.truth);
  };
  const hit = (q, arm, k = 10) => { const i = pick(q, arm); return i >= 0 && i < k ? 1 : 0; };

  const layers = [
    { name: 'ALL', qs: bridgeQs },
    { name: 'CROSS-source', qs: bridgeQs.filter(q => q.cross) },
    { name: 'SAME-source', qs: bridgeQs.filter(q => !q.cross) },
    { name: 'SELF', qs: selfQs },
  ];

  const lines = [];
  lines.push(`vault=${basename(vaultDir)} pages=${pages.length} bridge=${bridgeQs.length} cross=${bridgeQs.filter(q => q.cross).length} same=${bridgeQs.filter(q => !q.cross).length} self=${selfQs.length} budget=${BUDGET}`);
  lines.push('');
  lines.push('PRIMARY COLUMN is "no truth edge". With the edge present, ppr walks the very edge that defines the truth.');
  lines.push('CI is a 95% clustered bootstrap over ASKING PAGES, not questions.');
  lines.push('');

  for (const layer of layers) {
    lines.push(`── ${layer.name} (n=${layer.qs.length}) ──`);
    lines.push('  arm                  with edge          no edge            self MRR');
    for (const arm of arms) {
      const withEdge = layer.qs.map(q => ({ ...q, withoutEdge: false }));
      const noEdge = layer.qs.map(q => ({ ...q, withoutEdge: true }));
      // Compute each question's hit ONCE, then resample the cached bits.
      const hitsWith = withEdge.map(q => hit(q, arm, 10));
      const hitsNo = noEdge.map(q => hit(q, arm, 10));
      const ciWith = clusterBootstrap(withEdge, hitsWith);
      const ciNo = clusterBootstrap(noEdge, hitsNo);
      const selfMrr = selfQs.reduce((a, q) => { const i = pick({ ...q, withoutEdge: true }, arm); return a + (i >= 0 ? 1 / (i + 1) : 0); }, 0) / Math.max(1, selfQs.length);
      lines.push(`  ${arm.name.padEnd(20)} ${ciWith.point.toFixed(3)} [${ciWith.lo.toFixed(3)},${ciWith.hi.toFixed(3)}] ${ciNo.point.toFixed(3)} [${ciNo.lo.toFixed(3)},${ciNo.hi.toFixed(3)}] ${selfMrr.toFixed(3)}`);
    }
    lines.push('');
  }

  // The floor and the ceiling, both computed on the same layers so the numbers
  // above can be read against them rather than against nothing.
  lines.push('── controls ──');
  for (const layer of layers.slice(0, 3)) {
    const n = Math.max(1, pages.length);
    const floor = 10 / n;
    lines.push(`  ${layer.name.padEnd(20)} random floor 10/N = ${floor.toFixed(4)}   ceiling (return A's links) = 1.000`);
  }

  const report = lines.join('\n');
  if (outFile) writeFileSync(outFile, report + '\n');
  console.log(report);
}

main().catch(err => { console.error(err); process.exit(1); });
