#!/usr/bin/env node
// Parameter reality check for the #729 work.
//
// Every number this prints is measured over a corpus, not argued. It answers
// four questions the plan left open:
//
//   1. Are the BM25F field weights right, or are they the old hand-tuned ratio
//      wearing a new name? The grid search is the tool built for exactly this
//      and it had never been run.
//   2. Is the budget of 10 right? The plan inherited it; nobody checked what
//      changing it does to the thing it was chosen for.
//   3. Does the scorer behave the same across the segmentation regimes, or is
//      "language-agnostic" a claim nobody tested?
//   4. What does the query path cost, in wall-clock?
//
// Read-only.
//
// Usage: npx tsx tools/dev-instrument/run-parameter-check.mjs <wikiDir>

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  buildPageTerms,
  buildCorpusTerms,
  bm25fScore,
  segment,
  nameTierCoverage,
  DEFAULT_FIELD_WEIGHTS,
} from '../../src/core/term-index.ts';
import { rrfFuse, assembleWithCoverage } from '../../src/core/assembly.ts';
import { calibrateFieldWeights, runHarness, rankPages } from '../../src/core/recall-harness.ts';
import { builtInFixtures } from '../../src/core/recall-fixtures.ts';

const [, , wikiDir] = process.argv;
if (!wikiDir) {
  console.error('Usage: npx tsx tools/dev-instrument/run-parameter-check.mjs <wikiDir>');
  process.exit(2);
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out); else if (p.endsWith('.md')) out.push(p);
  }
  return out;
}

const files = walk(wikiDir);
const pages = files.map(f => {
  const text = readFileSync(f, 'utf8');
  const fmEnd = text.indexOf('\n---', 3);
  const fm = fmEnd > 0 ? text.slice(0, fmEnd) : '';
  const body = fmEnd > 0 ? text.slice(fmEnd + 4) : text;
  const title = (text.match(/^# (.+)$/m) ?? ['', relative(wikiDir, f)])[1].trim();
  const aliasBlock = (fm.match(/aliases:\s*\n((?:\s+- .*\n)*)/) ?? [])[1] ?? '';
  const aliases = aliasBlock.split('\n')
    .map(l => l.replace(/^\s+- /, '').replace(/^"|"$/g, '').trim()).filter(Boolean);
  const summary = body.split('\n')
    .find(l => l.trim() && !l.startsWith('#') && !l.startsWith('---'))?.slice(0, 100) ?? '';
  const slug = (fm.match(/\[\[sources\/([^\]\s,|]+)/) ?? [])[1];
  return {
    key: relative(wikiDir, f), title, aliases, summary,
    ...(slug ? { sourceSlug: slug } : {}),
  };
});

const pageTerms = pages.map(p => buildPageTerms({
  title: p.title, aliases: p.aliases, summary: p.summary, text: '',
}));
const corpus = buildCorpusTerms(pageTerms);

console.log(`Corpus: ${pages.length} pages · ${[...corpus.docFreq.keys()].length} distinct terms\n`);

// ── 1. Field-weight calibration ─────────────────────────────────────
// The calibration needs ground truth, and a real corpus has none. It runs over
// the SYNTHETIC fixture corpus, where the target pages are the pages. Running
// it against a real corpus returns MRR 0 for every cell — which is a property
// of the measurement, not of the scorer. Measured before this was split: the
// surface came back flat at 0.000 and read as "the weights do not matter".
console.log('=== 1. Field-weight calibration (synthetic corpus, ground truth exists) ===');
const { pages: synPages, fixtures: synFixtures, queryTerms: synTerms } = builtInFixtures();
const synPageTerms = synPages.map(p => buildPageTerms({
  title: p.title, aliases: p.aliases, summary: p.summary ?? '', text: '',
}));
const synCorpus = buildCorpusTerms(synPageTerms);
const cal = calibrateFieldWeights(synFixtures, synPages, synTerms, {
  values: [0, 1, 2, 3, 5], k: 10, pageTerms: synPageTerms, corpus: synCorpus,
});
console.log(`baseline DEFAULT_FIELD_WEIGHTS ${JSON.stringify(cal.baseline.weights)}  MRR ${cal.baseline.meanReciprocalRank.toFixed(3)}  recall@10 ${cal.baseline.meanRecallAtK.toFixed(3)}`);
console.log(`best on the grid                 ${JSON.stringify(cal.best.weights)}  MRR ${cal.best.meanReciprocalRank.toFixed(3)}  recall@10 ${cal.best.meanRecallAtK.toFixed(3)}`);
const distinctMrr = new Set(cal.surface.map(p => p.meanReciprocalRank.toFixed(3))).size;
console.log(`surface: ${cal.surface.length} cells, ${distinctMrr} distinct MRR values`);
const top5 = cal.surface.slice(0, 5);
console.log('top 5 cells by MRR:');
for (const p of top5) {
  console.log(`  title ${p.weights.title} alias ${p.weights.alias} summary ${p.weights.summary}  MRR ${p.meanReciprocalRank.toFixed(3)}  recall ${p.meanRecallAtK.toFixed(3)}`);
}
const baselineRank = cal.surface.findIndex(p =>
  p.weights.title === cal.baseline.weights.title
  && p.weights.alias === cal.baseline.weights.alias
  && p.weights.summary === cal.baseline.weights.summary) + 1;
console.log(`DEFAULT_FIELD_WEIGHTS ranks ${baselineRank} of ${cal.surface.length}`);
if (cal.baseline.meanReciprocalRank === cal.best.meanReciprocalRank) {
  console.log('  -> the surface is FLAT at the top: the exact weights are not identifiable from this fixture set.');
} else {
  console.log('  -> the weights are identifiable, and the default is NOT the best on this set.');
}

// ── 2. Budget sensitivity ───────────────────────────────────────────
console.log('\n=== 2. Budget sensitivity (what top-N does to source coverage) ===');
const QUERIES = ['强化学习 推理能力', 'deepseek 模型', '模型 并行 训练', '注意力机制', 'LSTM 架构', '训练 数据'];
function fusedFor(q) {
  const terms = [...new Set(segment(q))];
  const scored = pages.map((p, i) => ({ item: p, score: bm25fScore(terms, pageTerms[i], corpus, DEFAULT_FIELD_WEIGHTS) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || (a.item.key < b.item.key ? -1 : 1));
  return rrfFuse([{ channel: 'bm25f', candidates: scored.map((x, i) => ({ item: x.item, rank: i + 1 })) }])
    .map(f => ({ item: f.item, score: f.score }));
}
const fusedByQuery = new Map(QUERIES.map(q => [q, fusedFor(q)]));
console.log('budget'.padEnd(8), 'sources', 'dom-attr', 'bare/query');
for (const K of [3, 5, 10, 20, 50]) {
  let src = 0, dom = 0, bare = 0;
  for (const q of QUERIES) {
    const r = assembleWithCoverage(fusedByQuery.get(q) ?? [], K).picked;
    const per = new Map();
    let b = 0;
    for (const p of r) {
      if (p.sourceSlug === null) { b += 1; continue; }
      per.set(p.sourceSlug, (per.get(p.sourceSlug) ?? 0) + 1);
    }
    const attrN = r.length - b || 1;
    src += per.size;
    dom += per.size > 0 ? Math.max(...per.values()) / attrN : 0;
    bare += b;
  }
  console.log(String(K).padEnd(8), (src / QUERIES.length).toFixed(2).padEnd(7), ((dom / QUERIES.length) * 100).toFixed(0) + '%'.padEnd(8), (bare / QUERIES.length).toFixed(1));
}

// ── 3. Regime behaviour on the synthetic set ────────────────────────
// Same reason as above: the fixture targets live in the synthetic corpus.
console.log('\n=== 3. Per-regime retrieval (synthetic corpus) ===');
const perRegime = new Map();
for (const f of synFixtures) {
  const terms = synTerms.get(f.id) ?? [];
  const ranked = rankPages(f.query, synPages, synPageTerms, synCorpus, DEFAULT_FIELD_WEIGHTS, terms);
  const hit = ranked[0]?.page.path === f.relevant[0];
  const row = perRegime.get(f.regime) ?? { n: 0, top1: 0 };
  row.n += 1; row.top1 += hit ? 1 : 0;
  perRegime.set(f.regime, row);
}
for (const [regime, r] of perRegime) {
  console.log(`  ${regime.padEnd(14)} top-1 ${r.top1}/${r.n}`);
}

// ── 4. Wall-clock ───────────────────────────────────────────────────
console.log('\n=== 4. Wall-clock over 200 query evaluations ===');
const sampleQueries = [...fusedByQuery.keys()];
const t0 = performance.now();
for (let i = 0; i < 200; i += 1) {
  const q = sampleQueries[i % sampleQueries.length];
  const terms = [...new Set(segment(q))];
  const scored = pages.map((p, j) => ({ item: p, score: bm25fScore(terms, pageTerms[j], corpus, DEFAULT_FIELD_WEIGHTS) }))
    .filter(x => x.score > 0);
  assembleWithCoverage(scored, 10);
}
const t1 = performance.now();
console.log(`  full score + assemble: ${((t1 - t0) / 200).toFixed(2)} ms/query over ${pages.length} pages`);
const t2 = performance.now();
for (let i = 0; i < 200; i += 1) {
  nameTierCoverage([...new Set(segment(sampleQueries[i % sampleQueries.length]))], pageTerms[0], corpus);
}
const t3 = performance.now();
console.log(`  nameTierCoverage:      ${((t3 - t2) / 200).toFixed(4)} ms/query`);
