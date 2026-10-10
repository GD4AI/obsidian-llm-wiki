#!/usr/bin/env node
/**
 * #819 P1-4 — a real evaluation set with ground truth, built without an LLM.
 *
 * A real vault has no ground truth, so every accuracy claim so far rested on
 * proxies that cannot decide the question. This builds one from the vault's own
 * link structure.
 *
 * THE SHAPE. If page A links to page B, and A's summary uses words that do NOT
 * appear in B, then "query with A's words, answer is B" is a genuine bridge
 * question. The vocabulary gap is real — the question is phrased in A's terms
 * and the answer lives under B's terms. That is exactly the gap an LLM-generated
 * question would create, and it is constructible deterministically.
 *
 * Two question kinds:
 *   bridge  — query terms come from A, ground truth is B (the link target)
 *   self    — query terms come from B's own title+summary, ground truth is B
 *             (this one has no gap; it is the sanity floor)
 *
 * METRICS.
 *   recall@K   — is the ground-truth page in the top K?  (the objective)
 *   S-recall   — source-level recall, normalised by min(1, K/|S|) so a source
 *                with 40 pages is not scored against one with 4
 *
 * Usage:
 *   npx tsx tools/dev-instrument/run-eval-set.mjs <vaultDir> [--limit N]
 */
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, basename } from 'node:path';
import { assembleWithCoverage, rrfFuse } from '../../src/core/assembly.ts';
import { pprCascade } from '../../src/core/ppr-cascade.ts';
import {
  buildPageTerms, buildCorpusTerms, bm25fScore, segment, DEFAULT_FIELD_WEIGHTS,
} from '../../src/core/term-index.ts';
import { scoreProfile } from '../../src/core/retrieval-profile.ts';

const K = 10;
const BUDGET = 10;

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
  let started = false;
  for (const line of text.split('\n')) {
    if (/^---\s*$/.test(line)) { started = started || !started; continue; }
    if (!started) continue;
    const t = line.trim();
    if (!t || t.startsWith('#') || t.startsWith('>') || t.startsWith('-') || t.startsWith('|')) continue;
    return t.slice(0, 100);
  }
  return '';
}
function outlinks(text) {
  const out = new Set();
  const re = /\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g;
  let m;
  while ((m = re.exec(text)) !== null) { const t = m[1].trim(); if (t) out.add(t); }
  return out;
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
          key: rel, name: basename(rel),
          title: titleOf(text, e.name.replace(/\.md$/, '')),
          summary: summaryOf(text),
          sourceSlug: slugFromFrontmatter(text),
          links: outlinks(text),
        });
      }
    }
  };
  await walk(dir);
  return pages;
}

const dir = process.argv[2];
if (!dir) { console.error('usage: run-eval-set.mjs <vaultDir>'); process.exit(1); }
const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg > 0 ? Number(process.argv[limitArg + 1]) : Infinity;

const pages = await loadVault(dir);
const byName = new Map();
for (const p of pages) { if (!byName.has(p.name)) byName.set(p.name, p); byName.set(p.key, p); }

const pts = pages.map(p => buildPageTerms({ title: p.title, aliases: [], summary: p.summary, text: '' }));
const corpus = buildCorpusTerms(pts);

// Term sets, for the vocabulary-gap test.
const termsOf = (p) => new Set(segment(`${p.title} ${p.summary}`));

// Build the bridge questions: A links to B, and A's terms do not cover B's.
const bridge = [];
for (const a of pages) {
  if (bridge.length >= LIMIT) break;
  for (const target of a.links) {
    const b = byName.get(target);
    if (!b || b.key === a.key) continue;
    const aTerms = termsOf(a);
    const bTerms = termsOf(b);
    if (bTerms.size === 0) continue;
    // The gap: at least a third of B's terms must NOT be in A. Otherwise there
    // is no bridge to cross and the question is a self-question in disguise.
    // Loosened from 0.5 — with 100-character summaries the stricter cut left a
    // single question and measured nothing.
    const shared = [...bTerms].filter(t => aTerms.has(t)).length;
    if (shared / bTerms.size > 0.67) continue;
    // Query terms: A's summary terms, ALL of them. An earlier version took only
    // the terms NOT in B, which made the gap total and every scorer scored zero
    // — a real question is phrased in A's vocabulary but keeps whatever overlap
    // exists. The discriminative terms are still A's, which is the gap that
    // matters.
    const queryTerms = [...termsOf({ title: '', summary: a.summary })];
    if (queryTerms.length < 1) continue;
    bridge.push({ id: `bridge:${a.key}->${b.key}`, queryTerms, truth: b.key, sourceOfTruth: b.sourceSlug, from: a.key });
    if (bridge.length >= LIMIT) break;
  }
}

// Self questions: the sanity floor. No gap.
const self = pages.filter(p => p.summary.length > 0).slice(0, Math.min(200, Number.isFinite(LIMIT) ? LIMIT : 200))
  .map(p => ({ id: `self:${p.key}`, queryTerms: segment(`${p.title} ${p.summary}`), truth: p.key, sourceOfTruth: p.sourceSlug, from: p.key }));

console.log(`\nVault ${dir}`);
console.log(`  pages ${pages.length} · bridge questions ${bridge.length} · self questions ${self.length}`);

function rankBm25f(q) {
  const scored = pts.map((pt, j) => ({ item: { key: pages[j].key, sourceSlug: pages[j].sourceSlug }, score: bm25fScore(q.queryTerms, pt, corpus, DEFAULT_FIELD_WEIGHTS) }));
  scored.sort((a, b) => b.score - a.score);
  return scored;
}
function rankLegacy(q) {
  const needles = q.queryTerms;
  const scored = pts.map((pt, j) => ({
    item: { key: pages[j].key, sourceSlug: pages[j].sourceSlug },
    score: scoreProfile({ title: pages[j].title, aliases: [], summary: pages[j].summary, text: '' }, needles).score,
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

function evaluate(label, ranker, lambda) {
  const run = (set) => {
    let hits = 0, rr = 0, sHits = 0, sNorm = 0, n = 0;
    for (const q of set) {
      const scored = ranker(q);
      const fused = rrfFuse([{ channel: 'lex', candidates: scored.map((s, i) => ({ item: s.item, rank: i + 1 })) }]);
      const r = assembleWithCoverage(fused.map(f => ({ item: f.item, score: f.score })), BUDGET, lambda === undefined ? {} : { lambda });
      const picked = r.picked.map(x => x.item.key);
      const rank = picked.indexOf(q.truth);
      if (rank >= 0) { hits += 1; rr += 1 / (rank + 1); }
      if (q.sourceOfTruth !== undefined) {
        const set = byName.get(q.truth)?.sourceSlug;
        const poolSize = pages.filter(p => p.sourceSlug === set).length;
        const ceiling = Math.min(1, BUDGET / Math.max(1, poolSize));
        sNorm += ceiling;
        if (rank >= 0) sHits += 1;
      }
      n += 1;
    }
    return { recall: hits / Math.max(1, n), mrr: rr / Math.max(1, n), sRecall: sNorm > 0 ? (sHits / sNorm) : 0, n };
  };
  const b = run(bridge);
  const s = run(self);
  console.log(`  ${label.padEnd(26)} bridge recall@${K}=${b.recall.toFixed(3)} MRR=${b.mrr.toFixed(3)} | self recall@${K}=${s.recall.toFixed(3)} MRR=${s.mrr.toFixed(3)}`);
  return { b, s };
}

console.log(`\n=== Accuracy, through rrfFuse then assembleWithCoverage (production shape) ===`);
evaluate('legacy scorer', rankLegacy, undefined);
evaluate('bm25f, no diversity', rankBm25f, 0);
evaluate('bm25f, lambda 0.25', rankBm25f, 0.25);
evaluate('bm25f, lambda 1', rankBm25f, 1);

// ---- Phase 0: does the GRAPH bridge the vocabulary gap? ----
// The runs above use the lex channel only. Production fuses lex with ppr, and
// ppr walks the link graph from the seeds. If A links to B and A is a seed —
// which it must be, since the query is phrased in A's words — the walk should
// reach B. Nobody had measured that.
const graph = {
  nodes: pages.map(p => p.key),
  edges: new Map(pages.map(p => [p.key, [...p.links].map(t => byName.get(t)?.key).filter(Boolean)])),
};

function rankPpr(q) {
  const pprPages = pages.map(p => ({
    path: p.key, title: p.title, aliases: [], summary: p.summary, score: 0,
  }));
  const matches = pprCascade(q.queryTerms.join(' '), pprPages, { graph, topN: 200 });
  return matches.map(m => ({ item: { key: m.page.path, sourceSlug: byName.get(m.page.path)?.sourceSlug }, score: m.score }));
}

function evaluateFused(label, channels, lambda) {
  const run = (set) => {
    let hits = 0, rr = 0, n = 0;
    for (const q of set) {
      const lists = channels.map((ch, ci) => {
        const ranked = ch(q);
        return { channel: `c${ci}`, candidates: ranked.map((s, i) => ({ item: s.item, rank: i + 1 })) };
      });
      const fused = rrfFuse(lists);
      const r = assembleWithCoverage(fused.map(f => ({ item: f.item, score: f.score })), BUDGET, lambda === undefined ? {} : { lambda });
      const picked = r.picked.map(x => x.item.key);
      const rank = picked.indexOf(q.truth);
      if (rank >= 0) { hits += 1; rr += 1 / (rank + 1); }
      n += 1;
    }
    return { recall: hits / Math.max(1, n), mrr: rr / Math.max(1, n) };
  };
  const b = run(bridge);
  const s = run(self);
  console.log(`  ${label.padEnd(26)} bridge recall@${K}=${b.recall.toFixed(3)} MRR=${b.mrr.toFixed(3)} | self recall@${K}=${s.recall.toFixed(3)} MRR=${s.mrr.toFixed(3)}`);
}

console.log(`\n=== Phase 0 — does the graph bridge the gap? Lex vs ppr vs both ===`);
evaluateFused('lex only', [rankBm25f], 0);
evaluateFused('ppr only', [rankPpr], 0);
evaluateFused('lex + ppr', [rankBm25f, rankPpr], 0);
evaluateFused('lex + ppr, lambda 0.25', [rankBm25f, rankPpr], 0.25);

console.log('\n  bridge = query phrased in page A\'s words, answer is the page A links to');
console.log('  self   = query phrased in the page\'s own words, answer is the page');
