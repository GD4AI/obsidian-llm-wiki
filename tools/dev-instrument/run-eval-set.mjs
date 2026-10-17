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
import { assembleWithCoverage, rrfFuse, maxFuse } from '../../src/core/assembly.ts';
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
  // Count the frontmatter fences and read only after the CLOSING one. The
  // previous `started = started || !started` flipped to true at the FIRST fence
  // and stayed there, so every page's "summary" was its first frontmatter line.
  // Caught by @DocTpoint on a 2831-page German vault, 2026-10-10.
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
          body: bodyOf(text),
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
// The same corpus with the page BODY indexed as the `text` field. The query path
// passes `text: ''` today, so this field is dark in production. Measuring it is
// the point: 99% of bridge questions have their query terms in the target's
// body and nowhere else, so in principle this is where the answer lives.
const ptsText = pages.map(p => buildPageTerms({ title: p.title, aliases: [], summary: p.summary, text: p.body }));
const corpusText = buildCorpusTerms(ptsText);

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
function rankBm25fWithText(q) {
  const scored = ptsText.map((pt, j) => ({ item: { key: pages[j].key, sourceSlug: pages[j].sourceSlug }, score: bm25fScore(q.queryTerms, pt, corpusText, DEFAULT_FIELD_WEIGHTS) }));
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

// Track 3 — the co-citation projection (#781's design). Two pages that cite the
// same source are about that source, so they get an edge between them. This
// gives ppr paths it does not have through explicit links alone.
const coCitEdges = new Map(graph.nodes.map(k => [k, []]));
{
  const bySource = new Map();
  for (const p of pages) {
    if (p.sourceSlug === undefined) continue;
    if (!bySource.has(p.sourceSlug)) bySource.set(p.sourceSlug, []);
    bySource.get(p.sourceSlug).push(p.key);
  }
  for (const [, members] of bySource) {
    for (const a of members) {
      for (const b of members) {
        if (a !== b && !coCitEdges.get(a).includes(b)) coCitEdges.get(a).push(b);
      }
    }
  }
}
const graphCoCit = {
  nodes: graph.nodes,
  edges: new Map([...graph.edges].map(([k, v]) => [k, [...new Set([...v, ...(coCitEdges.get(k) ?? [])])]])),
};

function rankPprCoCit(q) {
  const pprPages = pages.map(p => ({ path: p.key, title: p.title, aliases: [], summary: p.summary, score: 0 }));
  const matches = pprCascade(q.queryTerms.join(' '), pprPages, { graph: graphCoCit, topN: 200 });
  return matches.map(m => ({ item: { key: m.page.path, sourceSlug: byName.get(m.page.path)?.sourceSlug }, score: m.score }));
}

function rankPpr(q) {
  const pprPages = pages.map(p => ({
    path: p.key, title: p.title, aliases: [], summary: p.summary, score: 0,
  }));
  const matches = pprCascade(q.queryTerms.join(' '), pprPages, { graph, topN: 200 });
  return matches.map(m => ({ item: { key: m.page.path, sourceSlug: byName.get(m.page.path)?.sourceSlug }, score: m.score }));
}
function rankPprWith(pprOptions, topN) {
  return (q) => {
    const pprPages = pages.map(p => ({
      path: p.key, title: p.title, aliases: [], summary: p.summary, score: 0,
    }));
    const matches = pprCascade(q.queryTerms.join(' '), pprPages, { graph, topN: topN ?? 200, pprOptions });
    return matches.map(m => ({ item: { key: m.page.path, sourceSlug: byName.get(m.page.path)?.sourceSlug }, score: m.score }));
  };
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

// CONTROL 1 — the random baseline. Ten random pages hit the truth with
// probability 10/N. Any recall below this is worse than guessing. @DocTpoint's
// point: the buggy-summary numbers sat UNDER it on all three vaults.
{
  let hits = 0, n = 0;
  for (const q of bridge) {
    // The pool MUST include the truth. The floor is 10/N, which only holds when
    // every page is in the draw. An earlier version filtered the truth out first
    // and the arm printed 0.000 on every vault, which is not a floor — it is a
    // control that cannot hit and therefore says nothing.
    const pool = pages.map(p => p.key);
    const picked = [];
    for (let i = 0; i < Math.min(K, pool.length); i += 1) {
      picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    if (picked.includes(q.truth)) hits += 1;
    n += 1;
  }
  console.log(`  ${'random 10 pages'.padEnd(26)} bridge recall@${K}=${(hits / Math.max(1, n)).toFixed(3)}   <- the floor to beat`);
}

// CONTROL 2 — the truth edge. The truth is defined as "A links to B" and ppr
// walks that same edge, so part of ppr's gain is circular. Removing the A->B
// edge before the walk separates the real bridging from the tautology.
function rankPprWithoutTruthEdge(q) {
  const from = q.from;
  const stripped = {
    nodes: graph.nodes,
    edges: new Map([...graph.edges].map(([k, v]) => [k, k === from ? v.filter(t => byName.get(t)?.key !== q.truth) : v])),
  };
  const pprPages = pages.map(p => ({ path: p.key, title: p.title, aliases: [], summary: p.summary, score: 0 }));
  const matches = pprCascade(q.queryTerms.join(' '), pprPages, { graph: stripped, topN: 200 });
  return matches.map(m => ({ item: { key: m.page.path, sourceSlug: byName.get(m.page.path)?.sourceSlug }, score: m.score }));
}

// CONTROL 3 — what the set rewards by construction. Any ranker that simply
// returns A's own links scores near 1.0. That is the ceiling, not a result.
{
  let hits = 0, n = 0;
  for (const q of bridge) {
    const a = byName.get(q.from);
    const links = a ? [...a.links].map(t => byName.get(t)?.key).filter(Boolean) : [];
    if (links.includes(q.truth)) hits += 1;
    n += 1;
  }
  console.log(`  ${'return A\'s own links'.padEnd(26)} bridge recall@${K}=${(hits / Math.max(1, n)).toFixed(3)}   <- the ceiling by construction`);
}

evaluateFused('lex only', [rankBm25f], 0);
evaluateFused('ppr only', [rankPpr], 0);
evaluateFused('ppr, truth edge removed', [rankPprWithoutTruthEdge], 0);
evaluateFused('lex + ppr (rrf)', [rankBm25f, rankPpr], 0);
evaluateFused('lex + ppr, lambda 0.25', [rankBm25f, rankPpr], 0.25);

// ---- Candidate fusion rules, measured not argued ----
// A' MAX FUSION. Take each channel's normalised score and keep the larger. When
// ppr ranks B third and lex ranks it 200th, B keeps ppr's score instead of
// having it averaged away. This is the failure the rrf sum has.
function evaluateMax(label, channels) {
  const run = (set) => {
    let hits = 0, rr = 0, n = 0;
    for (const q of set) {
      const per = channels.map(ch => ch(q));
      // P0 post-review: use the PRODUCTION `maxFuse`, not a local copy. The local
      // one normalised raw scores; the shipped one consumes per-channel ranks and
      // breaks ties on the earlier channel. On the German re-test the local arm
      // returned exactly the ppr-only numbers in every column, so lex never
      // changed a pick and everything measured "under MAX" was measured on ppr
      // alone. Never re-implement the thing being measured.
      const lists = per.map((ranked, ci) => ({
        channel: `c${ci}`,
        candidates: ranked.map((s, i) => ({ item: s.item, rank: i + 1 })),
      }));
      const fused = maxFuse(lists).map(f => ({
        item: { key: f.item.key, sourceSlug: byName.get(f.item.key)?.sourceSlug }, score: f.score,
      }));
      const r = assembleWithCoverage(fused, BUDGET, {});
      const rank = r.picked.map(x => x.item.key).indexOf(q.truth);
      if (rank >= 0) { hits += 1; rr += 1 / (rank + 1); }
      n += 1;
    }
    return { recall: hits / Math.max(1, n), mrr: rr / Math.max(1, n) };
  };
  const b = run(bridge), s = run(self);
  console.log(`  ${label.padEnd(26)} bridge recall@${K}=${b.recall.toFixed(3)} MRR=${b.mrr.toFixed(3)} | self recall@${K}=${s.recall.toFixed(3)} MRR=${s.mrr.toFixed(3)}`);
}

// Same as evaluateMax but with an explicit budget, so the recall-vs-budget curve
// can be measured. The shipped budget is 10; the curve says whether that is the
// right place to sit.
function evaluateMaxWith(label, channels, budget) {
  const run = (set) => {
    let hits = 0, rr = 0, n = 0;
    for (const q of set) {
      const per = channels.map(ch => ch(q));
      const normMax = per.map(ranked => (ranked.length ? ranked[0].score : 1) || 1);
      const byKey = new Map();
      for (let ci = 0; ci < per.length; ci += 1) {
        for (const s of per[ci]) {
          const v = s.score / normMax[ci];
          const prev = byKey.get(s.item.key);
          if (prev === undefined || v > prev) byKey.set(s.item.key, v);
        }
      }
      const fused = [...byKey.entries()].map(([key, score]) => ({
        item: { key, sourceSlug: byName.get(key)?.sourceSlug }, score,
      }));
      const r = assembleWithCoverage(fused, budget, {});
      const rank = r.picked.map(x => x.item.key).indexOf(q.truth);
      if (rank >= 0) { hits += 1; rr += 1 / (rank + 1); }
      n += 1;
    }
    return { recall: hits / Math.max(1, n), mrr: rr / Math.max(1, n) };
  };
  const br = run(bridge);
  const sf = run(self);
  console.log(`    ${label.padEnd(22)} bridge recall@${budget}=${br.recall.toFixed(3)} MRR=${br.mrr.toFixed(3)} | self recall@${budget}=${sf.recall.toFixed(3)} MRR=${sf.mrr.toFixed(3)}`);
}

// C' QUOTA UNION. No fusion at all: take the top k from each channel and union
// them. Guarantees both channels contribute, and nothing is averaged away.
function evaluateQuota(label, channels, perChannel) {
  const run = (set) => {
    let hits = 0, rr = 0, n = 0;
    for (const q of set) {
      const picked = [];
      for (const ch of channels) {
        for (const s of ch(q).slice(0, perChannel)) {
          if (!picked.includes(s.item.key)) picked.push(s.item.key);
        }
      }
      const rank = picked.slice(0, BUDGET).indexOf(q.truth);
      if (rank >= 0) { hits += 1; rr += 1 / (rank + 1); }
      n += 1;
    }
    return { recall: hits / Math.max(1, n), mrr: rr / Math.max(1, n) };
  };
  const b = run(bridge), s = run(self);
  console.log(`  ${label.padEnd(26)} bridge recall@${K}=${b.recall.toFixed(3)} MRR=${b.mrr.toFixed(3)} | self recall@${K}=${s.recall.toFixed(3)} MRR=${s.mrr.toFixed(3)}`);
}

// ---- P0 post-review: the cross-source subset. #729 is about a question whose
// answer lies on a page the asker did NOT share a source with. The full bridge
// set is 64% same-source pairs on the measured German vault, where the two pages
// already share wording and nothing has to be bridged. Only the no-shared-source
// pairs test the actual issue.
console.log(`\n=== Cross-source subset (no shared source between A and B) ===`);
{
  const crossQs = bridge.filter(q => {
    const a = byName.get(q.from);
    const b = byName.get(q.truth);
    return a && b && a.sourceSlug !== b.sourceSlug;
  });
  console.log(`  (${crossQs.length} of ${bridge.length} bridge pairs have no shared source)`);
  const prev = bridge.slice();
  bridge.splice(0, bridge.length, ...crossQs);
  evaluateFused('lex only', [rankBm25f], 0);
  evaluateFused('ppr 0.30/10', [rankPprWith({ damping: 0.30, maxSteps: 10 })], 0);
  evaluateMax('maxFuse', [rankBm25f, rankPprWith({ damping: 0.30, maxSteps: 10 })]);
  bridge.splice(0, bridge.length, ...prev);
}

evaluateMax('A\' MAX fusion', [rankBm25f, rankPpr]);
evaluateQuota("C' QUOTA 5+5", [rankBm25f, rankPpr], 5);
evaluateQuota("C' QUOTA 3+7", [rankBm25f, rankPpr], 3);
evaluateQuota("C' QUOTA 7+3", [rankBm25f, rankPpr], 7);

// ---- Track 1: the `text` field is dark in the query path. Does lighting it
// close the vocabulary gap? The diagnostic says 99% of bridge questions have
// their query terms in the target's body and nowhere else.
console.log(`\n=== Track 1 — indexing the page BODY as the text field ===`);
evaluateFused('lex, body indexed', [rankBm25fWithText], 0);
evaluateMax('MAX, body indexed', [rankBm25fWithText, rankPpr]);
evaluateMax('MAX, body NOT indexed', [rankBm25f, rankPpr]);

// ---- Track 3: does the co-citation projection give ppr more to walk? ----
console.log(`\n=== Track 3 — co-citation edges in the graph ===`);
evaluateFused('ppr, links only', [rankPpr], 0);
evaluateFused('ppr, + co-citation', [rankPprCoCit], 0);
evaluateMax('MAX, links only', [rankBm25f, rankPpr]);
evaluateMax('MAX, + co-citation', [rankBm25f, rankPprCoCit]);
evaluateMax('MAX, body + co-citation', [rankBm25fWithText, rankPprCoCit]);

// ---- Track 1b: the PPR walk parameters. Zero new mechanism, and the measured
// ceiling is ppr's link-graph reachability, so this is the direct lever. The
// defaults are numWalks=3000, maxSteps=50, damping=0.05.
console.log(`\n=== PPR walk parameter sweep ===`);
for (const d of [0.01, 0.05, 0.15, 0.30]) {
  evaluateFused(`  damping ${d}`, [rankPprWith({ damping: d })], 0);
}
for (const s of [10, 50, 200]) {
  evaluateFused(`  maxSteps ${s}`, [rankPprWith({ maxSteps: s })], 0);
}
for (const w of [500, 3000, 10000]) {
  evaluateFused(`  numWalks ${w}`, [rankPprWith({ numWalks: w })], 0);
}
console.log(`\n=== PPR parameter COMBINATIONS under MAX fusion ===`);
evaluateMax('  damping 0.05 + steps 50 DEFAULT', [rankBm25f, rankPprWith({ damping: 0.05, maxSteps: 50 })]);
evaluateMax('  damping 0.30 + steps 10', [rankBm25f, rankPprWith({ damping: 0.30, maxSteps: 10 })]);
evaluateMax('  damping 0.15 + steps 10', [rankBm25f, rankPprWith({ damping: 0.15, maxSteps: 10 })]);
evaluateMax('  damping 0.30 + steps 50', [rankBm25f, rankPprWith({ damping: 0.30, maxSteps: 50 })]);
evaluateMax('  damping 0.15 + steps 50', [rankBm25f, rankPprWith({ damping: 0.15, maxSteps: 50 })]);

// ---- First principles: where does recall get lost? Two caps sit on the path.
// `topN` cuts the candidate pool before fusion. `budget` cuts the picked set
// after it. Neither was measured against recall before.
console.log(`\n=== Recall vs BUDGET (how many pages the reader gets) ===`);
for (const b of [5, 10, 20, 30, 50]) {
  evaluateMaxWith(`  budget ${b}`, [rankBm25f, rankPpr], b);
}
console.log(`\n=== Recall vs topN (candidate pool cap before fusion) ===`);
for (const n of [50, 200, 500, 2000]) {
  evaluateMax(`  topN ${n}`, [rankBm25f, rankPprWith({ damping: 0.30, maxSteps: 10 }, n)]);
}

console.log('\n  bridge = query phrased in page A\'s words, answer is the page A links to');
console.log('  self   = query phrased in the page\'s own words, answer is the page');
