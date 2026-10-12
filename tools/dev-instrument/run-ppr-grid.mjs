#!/usr/bin/env node
// PPR hyper-parameter grid search over the ground-truth evaluation set.
//
// Read-only. Loads a vault once, builds the corpus and graph once, then walks
// the grid. Prints one row per combination so two invocations on two vaults can
// run side by side and be compared line by line.
//
// Usage: npx tsx run-ppr-grid.mjs <vaultDir> [--out <file>]
//
// The grid covers what is actually free to choose today: the three Monte-Carlo
// walk parameters, the seed count that drives the walks, and the RRF `k` used
// where the RRF sum is still the fusion. Field weights are NOT in the grid —
// they were measured as flat on the HARD fixtures and are not calibrated.
//
// Two metrics always print together. `bridge` is the reason this branch exists.
// `selfMRR` is what it costs.

import { readFile, readdir } from 'node:fs/promises';
import { join, relative, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendFileSync, writeFileSync } from 'node:fs';
import {
  buildPageTerms, buildCorpusTerms, bm25fScore, segment, DEFAULT_FIELD_WEIGHTS,
} from '../../src/core/term-index.ts';
import { pprCascade } from '../../src/core/ppr-cascade.ts';
import { maxFuse, assembleWithCoverage } from '../../src/core/assembly.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

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
// The `sources:` frontmatter ref. Without it the coverage layer has no signal
// and passes through, which silently turns the assembly step into a no-op.
function parseSourceSlug(text) {
  const m = /^sources:\s*(?:\n\s*-\s*(.+?)\s*$|(.+?)\s*$)/m.exec(text);
  const raw = (m?.[1] ?? m?.[2] ?? '').trim().replace(/^['"]|['"]$/g, '');
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
        links: outlinks(text),
      });
    }
  };
  await walk(dir);
  return pages;
}

function buildQuestions(pages, byName) {
  const out = [];
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
      out.push({ queryTerms: q, target: b.key });
    }
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const vaultDir = args.find(a => !a.startsWith('--'));
  const outIdx = args.indexOf('--out');
  const outFile = outIdx >= 0 ? args[outIdx + 1] : null;
  if (!vaultDir) { console.error('usage: run-ppr-grid.mjs <vaultDir> [--out file]'); process.exit(1); }

  const t0 = Date.now();
  const pages = await loadVault(vaultDir);
  const byName = new Map();
  for (const p of pages) { if (!byName.has(p.name)) byName.set(p.name, p); byName.set(p.key, p); }
  const pts = pages.map(p => buildPageTerms({ title: p.title, aliases: [], summary: p.summary, text: '' }));
  const corpus = buildCorpusTerms(pts);
  const graph = {
    nodes: pages.map(p => p.key),
    edges: new Map(pages.map(p => [p.key, [...p.links].map(t => byName.get(t)?.key).filter(Boolean)])),
  };
  const bridgeQs = buildQuestions(pages, byName);
  const selfQs = pages.filter(p => p.summary.length > 0).map(p => ({
    queryTerms: segment(p.summary).filter(t => [...segment(p.summary)].includes(t)),
    target: p.key,
  }));
  const loadMs = Date.now() - t0;

  const lexRanked = (q) => {
    const s = pts.map((pt, j) => ({ item: { key: pages[j].key, sourceSlug: pages[j].sourceSlug }, score: bm25fScore(q.queryTerms, pt, corpus, DEFAULT_FIELD_WEIGHTS) }));
    s.sort((a, b) => (b.score - a.score) || (a.item.key < b.item.key ? -1 : 1));
    return s;
  };
  const lexCache = new Map();
  const lex = (q) => {
    const hit = lexCache.get(q);
    if (hit) return hit;
    const r = lexRanked(q);
    lexCache.set(q, r);
    return r;
  };
  // Production path: do NOT pass `seeds`. pprCascade derives its own from its
  // internal `lexMatch`, which is a DIFFERENT scorer from the BM25F used for the
  // fusion channel. Passing explicit seeds would silently test the LLM-seed arm
  // instead, and the numbers would not describe what ships.
  const pprRanked = (q, opts) => {
    const pprPages = pages.map(p => ({ path: p.key, title: p.title, aliases: [], summary: p.summary, score: 0 }));
    const m = pprCascade(q.queryTerms.join(' '), pprPages, {
      graph, topN: 200, pprOptions: opts,
    });
    return m.map(x => ({ item: { key: x.page.path, sourceSlug: byName.get(x.page.path)?.sourceSlug }, score: x.score }));
  };

  // The full production shape: fusion, then `assembleWithCoverage` with the
  // shipped budget of 10. Skipping the assembly step and taking the top-10 of
  // the fused list measures something that does not ship — the coverage and
  // budget logic reorders and re-selects — and the absolute numbers diverge
  // from production for exactly that reason.
  const BUDGET = 10;
  const evaluate = (qs, channels) => {
    let hits = 0, rr = 0;
    for (const q of qs) {
      const lists = channels.map((f, ci) => ({
        channel: `c${ci}`,
        candidates: f(q).map((c, i) => ({ item: c.item, rank: i + 1 })),
      }));
      const fused = maxFuse(lists);
      const r = assembleWithCoverage(fused, BUDGET, {});
      const idx = r.picked.findIndex(x => x.item.key === q.target);
      if (idx >= 0 && idx < 10) hits += 1;
      if (idx >= 0) rr += 1 / (idx + 1);
    }
    return { recall: hits / Math.max(1, qs.length), mrr: rr / Math.max(1, qs.length) };
  };

  // Grid. Each row is one configuration. The DEFAULT row is the shipped one.
  // Sized so a full sweep finishes in minutes: 4 x 3 = 12 configurations over
  // damping x maxSteps. numWalks is fixed at the shipped 3000 because it was
  // measured as saturated (500 ~ 3000 ~ 10000). The seed count is NOT in the
  // grid: pprCascade hardcodes its own lex top-3 and the explicit `seeds` option
  // is a different arm (the LLM semantic path), so tuning it here would measure
  // something that does not ship.
  const dampings = [0.05, 0.15, 0.30, 0.50];
  const steps = [10, 25, 50];
  const bridgeSample = bridgeQs;
  const selfSample = selfQs;

  const rows = [];
  const tGrid = Date.now();
  let done = 0;
  const totalCfg = dampings.length * steps.length;
  for (const damping of dampings) {
    for (const maxSteps of steps) {
      done += 1;
      const opts = { damping, maxSteps, numWalks: 3000 };
      const ppr = (q) => pprRanked(q, opts);
      const br = evaluate(bridgeSample, [lex, ppr]);
      const sf = evaluate(selfSample, [lex, ppr]);
      rows.push({ damping, maxSteps, numWalks: 3000, bridge: br.recall, selfMrr: sf.mrr, selfRecall: sf.recall });
      process.stderr.write(`  [${done}/${totalCfg}] ${damping}/${maxSteps} bridge=${br.recall.toFixed(3)} self=${sf.mrr.toFixed(3)} (${Math.round((Date.now()-tGrid)/1000)}s)\n`);
    }
  }

  const lines = [];
  lines.push(`vault=${basename(vaultDir)} pages=${pages.length} bridgeQ=${bridgeQs.length}(sampled ${bridgeSample.length}) selfQ=${selfQs.length}(sampled ${selfSample.length}) loadMs=${loadMs} gridMs=${Date.now()-tGrid}`);
  lines.push('damping  maxSteps  numWalks  bridge@10  selfMRR  selfRecall');
  for (const r of rows) {
    lines.push([
      r.damping.toFixed(2), String(r.maxSteps).padStart(6), String(r.numWalks).padStart(8),
      r.bridge.toFixed(4).padStart(9), r.selfMrr.toFixed(4).padStart(8), r.selfRecall.toFixed(4).padStart(9),
    ].join('  '));
  }
  const report = lines.join('\n');
  if (outFile) { writeFileSync(outFile, report + '\n'); }
  console.log(report);
}

main().catch(err => { console.error(err); process.exit(1); });
