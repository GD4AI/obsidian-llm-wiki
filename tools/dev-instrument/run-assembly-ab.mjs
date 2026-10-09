#!/usr/bin/env node
// A/B effect measurement for the #729 assembly step.
//
// Runs BOTH selection rules over the SAME corpus and the SAME queries, so the
// only difference is the rule. Arm A is what the code did before this work:
// score, sort, take the top N. Arm B is what it does now: RRF fusion plus the
// source-coverage greedy pick. The metric is the issue's own symptom — how many
// distinct sources the top-10 carries, and how much of it one source owns.
//
// Read-only. It never writes to the corpus.
//
// Usage: npx tsx tools/dev-instrument/run-assembly-ab.mjs <wikiDir> [query ...]

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  buildPageTerms,
  buildCorpusTerms,
  bm25fScore,
  segment,
  DEFAULT_FIELD_WEIGHTS,
} from '../../src/core/term-index.ts';
import {
  rrfFuse,
  assembleWithCoverage,
} from '../../src/core/assembly.ts';

const [, , wikiDir, ...cliQueries] = process.argv;
if (!wikiDir) {
  console.error('Usage: npx tsx tools/dev-instrument/run-assembly-ab.mjs <wikiDir> [query ...]');
  process.exit(2);
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.md')) out.push(p);
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
  const aliasMatch = fm.match(/aliases:\s*\n((?:\s+- .*\n)*)/);
  const aliases = aliasMatch
    ? aliasMatch[1].split('\n').map(l => l.replace(/^\s+- /, '').replace(/^"|"$/g, '').trim()).filter(Boolean)
    : [];
  const summary = body.split('\n').find(l => l.trim() && !l.startsWith('#') && !l.startsWith('---'))?.slice(0, 100) ?? '';
  // The wikilink sits in either frontmatter form: inline `sources: [[sources/x]]`
  // or the block form with the link on its own line. Match the link itself.
  const slug = (fm.match(/\[\[sources\/([^\]\s,|]+)/) ?? [])[1];
  return {
    key: relative(wikiDir, f),
    title, aliases, summary,
    ...(slug ? { sourceSlug: slug } : {}),
  };
});

const pageTerms = pages.map(p => buildPageTerms({
  title: p.title, aliases: p.aliases, summary: p.summary, text: '',
}));
const corpus = buildCorpusTerms(pageTerms);

const QUERIES = cliQueries.length > 0 ? cliQueries : [
  '强化学习 推理能力',
  'deepseek 模型',
  '模型 并行 训练',
  '注意力机制',
  'LSTM 架构',
  '训练 数据',
];

const K = 10;

function rrfOf(query) {
  const terms = [...new Set(segment(query))];
  const byScore = pages.map((p, i) => ({ item: p, score: bm25fScore(terms, pageTerms[i], corpus, DEFAULT_FIELD_WEIGHTS) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || (a.item.key < b.item.key ? -1 : 1));
  const rankList = byScore.map((x, i) => ({ item: x.item, rank: i + 1 }));
  return rrfFuse([{ channel: 'bm25f', candidates: rankList }]).map(f => ({ item: f.item, score: f.score }));
}

function stats(picked) {
  const per = new Map();
  let bare = 0;
  for (const p of picked) {
    const s = p.sourceSlug ?? p.item?.sourceSlug;
    if (s === undefined) { bare += 1; continue; }
    per.set(s, (per.get(s) ?? 0) + 1);
  }
  const n = picked.length || 1;
  // Two denominators, because they answer two different questions. The overall
  // share is what the user sees in the loaded set. The attributed-only share is
  // the diversity the rule can actually claim: unattributed pages are never
  // penalised by design, so letting them into the budget dilutes the first
  // number without any source being diversified at all.
  const attrN = picked.length - bare || 1;
  return {
    sources: per.size,
    dominant: per.size > 0 ? Math.max(...per.values()) / n : 0,
    dominantAttr: per.size > 0 ? Math.max(...per.values()) / attrN : 0,
    bare,
  };
}

console.log(`Corpus: ${pages.length} pages · ${pages.filter(p => p.sourceSlug).length} carry a sources: ref`);
console.log(`Queries: ${QUERIES.length} · budget top-${K}\n`);
console.log('query'.padEnd(24), 'arm'.padEnd(6), 'sources', 'dom-all', 'dom-attr', 'bare');
console.log('-'.repeat(68));

let sumA = 0, sumB = 0, domA = 0, domB = 0, domAttrA = 0, domAttrB = 0, bareA = 0, bareB = 0;
for (const q of QUERIES) {
  const fused = rrfOf(q);

  // Arm A — what the code did: sort by score, take the top N.
  const armA = [...fused].sort((a, b) => b.score - a.score || (a.item.key < b.item.key ? -1 : 1)).slice(0, K);
  // Arm B — what it does now: greedy pick with diminishing return per source.
  const armB = assembleWithCoverage(fused, K).picked;

  const a = stats(armA);
  const b = stats(armB);
  sumA += a.sources; sumB += b.sources;
  domA += a.dominant; domB += b.dominant;
  domAttrA += a.dominantAttr; domAttrB += b.dominantAttr;
  bareA += a.bare; bareB += b.bare;
  console.log(q.padEnd(24), 'A'.padEnd(6), String(a.sources).padEnd(7), ((a.dominant * 100).toFixed(0) + '%').padEnd(8), ((a.dominantAttr * 100).toFixed(0) + '%').padEnd(9), String(a.bare));
  console.log(''.padEnd(24), 'B'.padEnd(6), String(b.sources).padEnd(7), ((b.dominant * 100).toFixed(0) + '%').padEnd(8), ((b.dominantAttr * 100).toFixed(0) + '%').padEnd(9), String(b.bare));
}

const n = QUERIES.length;
console.log('-'.repeat(68));
console.log('MEAN'.padEnd(24), 'A'.padEnd(6), (sumA / n).toFixed(2).padEnd(7), ((domA / n) * 100).toFixed(0) + '%'.padEnd(8), ((domAttrA / n) * 100).toFixed(0) + '%'.padEnd(9), (bareA / n).toFixed(1));
console.log(''.padEnd(24), 'B'.padEnd(6), (sumB / n).toFixed(2).padEnd(7), ((domB / n) * 100).toFixed(0) + '%'.padEnd(8), ((domAttrB / n) * 100).toFixed(0) + '%'.padEnd(9), (bareB / n).toFixed(1));
console.log(`\nDistinct sources in the top-${K}:      ${(sumA / n).toFixed(2)} -> ${(sumB / n).toFixed(2)}`);
console.log(`Dominant share, whole picked set:   ${((domA / n) * 100).toFixed(0)}% -> ${((domB / n) * 100).toFixed(0)}%`);
console.log(`Dominant share, attributed only:    ${((domAttrA / n) * 100).toFixed(0)}% -> ${((domAttrB / n) * 100).toFixed(0)}%   <- the diversity the rule can claim`);
console.log(`Unattributed pages in the budget:   ${(bareA / n).toFixed(1)} -> ${(bareB / n).toFixed(1)}   <- never penalised by design`);
