#!/usr/bin/env npx tsx
/**
 * run-expansion-eval.mjs — the two-stage Rocchio expansion, measured through
 * the production path.
 *
 * Why this exists. The +0.040 / +0.051 r@10 for two-stage Rocchio was measured
 * with a standalone script in /tmp that reimplemented the scorer. #855 review
 * point 5: no tool in the repo called `twoStageExpand`, so the number could not
 * be reproduced from the repo. The project's own rule — the path that is
 * measured is the path that ships — was broken. This tool is the fix.
 *
 * It imports `twoStageExpand`, `buildExpansionTerms` and `DEFAULT_EXPANSION`
 * from `src/core/query-expansion.ts`, and `bm25fScore`,
 * `DEFAULT_FIELD_WEIGHTS` and `tokenizeQuery` from the modules the shipped
 * scorer uses. No parallel implementation. Whatever this prints, the shipped
 * code does.
 *
 * Usage:
 *   npx tsx run-expansion-eval.mjs <vaultDir> [options]
 *
 * Options:
 *   --out <file>        write the report to a file as well as stdout
 *   --exclude-asker     drop the asker from the page set (the #854 trap)
 *   --budget <n>        retrieval budget, default 20 (the production RETRIEVAL_BUDGET)
 *   --k1 <n> --m1 <n> --k2 <n> --m2 <n>
 *                       two-stage expansion parameters (default 5/10/5/10)
 *   --layer <ALL|CROSS> report only one layer
 *   --limit <n>         cap the questions, for a quick pass
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { twoStageExpand, buildExpansionTerms, DEFAULT_EXPANSION } from '../../src/core/query-expansion.ts';
import { buildCorpusTerms, buildInvertedIndex, bm25fScore, DEFAULT_FIELD_WEIGHTS, segment } from '../../src/core/term-index.ts';
import { tokenizeQuery, pprCascade } from '../../src/core/ppr-cascade.ts';
import { maxFuse } from '../../src/core/assembly.ts';

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  const valueFlags = new Set(['out', 'budget', 'k1', 'm1', 'k2', 'm2', 'layer', 'limit', 'prefilter']);
  const USE_INDEX = argv.includes('--index');
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (valueFlags.has(key)) flags[key] = argv[++i];
      else flags[key] = true;
    } else positional.push(a);
  }
  return { vaultDir: positional[0], flags };
}

function loadVault(dir, excludeAsker) {
  const pages = [];
  const rel = (p) => p.slice(dir.length + 1);
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.md')) {
        const raw = readFileSync(p, 'utf8');
        const fm = raw.match(/^---\n([\s\S]*?)\n---\n/);
        const body = fm ? raw.slice(fm[0].length) : raw;
        const fmText = fm ? fm[1] : '';
        const title = (fmText.match(/^title:\s*(.+)$/m)?.[1] ?? e.name.replace(/\.md$/, '')).replace(/^["']|["']$/g, '');
        // The slug lives in the `sources:` list, not a `sourceSlug:` key.
        // Matching the reference parser: the first entry of the list, or the
        // scalar value if it is written inline.
        const sm = /^sources:\s*(?:\n\s*-\s*(.+?)\s*$|(.+?)\s*$)/m.exec(fmText);
        const sourceSlug = (sm?.[1] ?? sm?.[2] ?? '').trim().replace(/^['"]|['"]$/g, '') || 'default';
        const aliasesRaw = fmText.match(/^aliases:\s*\n((?:\s*-\s*.+\n?)*)/m)?.[1] ?? '';
        const aliases = [...aliasesRaw.matchAll(/^\s*-\s*(.+)$/gm)].map(m => m[1].replace(/^["']|["']$/g, ''));
        const links = [...body.matchAll(/\[\[([^\]|#]+)/g)].map(m => m[1].trim());
        pages.push({ key: rel(p), path: rel(p), title, aliases, text: body, sourceSlug, links, summary: body.slice(0, 200) });
      }
    }
  };
  walk(dir);
  return excludeAsker ? pages.filter(p => true) : pages;
}

function buildQuestions(pages) {
  // Wiki-links are written `[[concepts/Myocardial Infarction]]` — the path
  // relative to the vault root without the `.md` — or `[[Bare Title]]`. Index
  // both forms so a link written either way resolves.
  const byKey = new Map();
  for (const p of pages) {
    byKey.set(p.title, p);
    byKey.set(p.path.replace(/\.md$/, ''), p);
  }
  // Question construction, matching the reference measurement. For each link
  // `a -> b`, the question is the words `a` carries that `b` does not. That
  // simulates "the user asks about a topic and the answer lives on a page
  // whose vocabulary is disjoint from the question" — the cross-vocabulary
  // gap the expansion is supposed to bridge. Using `a`'s title as the query
  // would measure something else entirely.
  //
  // Two filters keep the questions honest:
  //   * `shared / bTerms <= 0.67` — if `a` already says most of what `b`
  //     says, there is no gap and nothing to measure.
  //   * `queryTerms.length >= 1` — a question with no words is not a question.
  const out = [];
  for (const a of pages) {
    for (const target of a.links) {
      const b = byKey.get(target);
      if (!b || b === a) continue;
      const aTerms = new Set(segment(`${a.title} ${a.summary}`));
      const bTerms = new Set(segment(`${b.title} ${b.summary}`));
      if (bTerms.size === 0) continue;
      const shared = [...bTerms].filter(t => aTerms.has(t)).length;
      if (shared / bTerms.size > 0.67) continue;
      const queryTerms = [...segment(a.summary)].filter(t => !bTerms.has(t));
      if (queryTerms.length < 1) continue;
      out.push({ queryTerms, truth: b, asker: a, cross: a.sourceSlug !== b.sourceSlug });
    }
  }
  return out;
}

function rank(terms, pts, corpus, budget, pprPages, graph, pageIndex) {
  // Production shape: the lexical channel is `bm25fScore`, the graph channel
  // is `pprCascade`, and `maxFuse` combines them. #855 review point 5: this
  // must be the path the shipped code runs, or the number means nothing.
  const lex = pts
    .map((pt, i) => ({ i, score: bm25fScore(terms, pt, corpus, DEFAULT_FIELD_WEIGHTS) }))
    .sort((x, y) => y.score - x.score || (x.i < y.i ? -1 : 1));
  const wrap = (i) => ({ key: String(i), idx: i });
  const lexList = { channel: 'lex', candidates: lex.slice(0, budget).map((e, r) => ({ item: wrap(e.i), rank: r + 1 })) };
  const pprMatches = pprCascade(terms.join(' '), pprPages, { graph, topN: budget });
  const pprList = {
    channel: 'ppr',
    candidates: pprMatches.map((m, r) => ({ item: wrap(pageIndex.get(m.page.path) ?? -1), rank: r + 1 })).filter(c => c.item.idx >= 0),
  };
  const fused = maxFuse([lexList, pprList]);
  return fused.slice(0, budget).map(f => f.item.idx);
}

function main() {
  const { vaultDir, flags } = parseArgs(process.argv.slice(2));
  if (!vaultDir) {
    console.error('usage: run-expansion-eval.mjs <vaultDir> [--out f] [--exclude-asker] [--budget n] [--k1 n] [--m1 n] [--k2 n] [--m2 n] [--layer ALL|CROSS] [--limit n] [--index] [--prefilter n]');
    process.exit(1);
  }

  const BUDGET = flags.budget ? Number(flags.budget) : 20;
  const EXCLUDE_ASKER = Boolean(flags['exclude-asker']);
  const LAYER = flags.layer ?? 'ALL';
  const LIMIT = flags.limit ? Number(flags.limit) : Infinity;
  const USE_INDEX = Boolean(flags.index);
  const PREFILTER_N = flags.prefilter ? Number(flags.prefilter) : 0;
  const opts = {
    k1: flags.k1 ? Number(flags.k1) : DEFAULT_EXPANSION.k1,
    m1: flags.m1 ? Number(flags.m1) : DEFAULT_EXPANSION.m1,
    k2: flags.k2 ? Number(flags.k2) : DEFAULT_EXPANSION.k2,
    m2: flags.m2 ? Number(flags.m2) : DEFAULT_EXPANSION.m2,
  };

  const t0 = Date.now();
  let expScoringMs = 0;
  // #854: with `--exclude-asker`, the asker is dropped from the CANDIDATE set
  // for each question, not from the whole vault. The whole-vault filter was
  // wrong: almost every page has an outgoing link, so it emptied the vault.
  // The exclusion is per question — the asker is what the question was built
  // from, and leaving it in lets the ranker find the question's own source
  // rather than the answer.
  const pages = loadVault(vaultDir, false);
  let questions = buildQuestions(pages);
  if (LAYER === 'CROSS') questions = questions.filter(q => q.cross);
  questions = questions.slice(0, LIMIT);
  console.log(`vault=${basename(vaultDir)} pages=${pages.length} questions=${questions.length} budget=${BUDGET} excludeAsker=${EXCLUDE_ASKER} layer=${LAYER}`);

  // Production path: the tables are built once per index file and reused.
  const expansionPages = pages.map(p => ({ key: p.key, title: p.title, summary: p.summary, text: p.text }));
  const pprPages = pages.map(p => ({ path: p.path, title: p.title, aliases: p.aliases, text: p.text }));
  const edges = new Map();
  const byPath = new Map(pages.map(p => [p.title, p.path]));
  for (const p of pages) {
    const targets = p.links.map(t => byPath.get(t)).filter(Boolean);
    if (targets.length) edges.set(p.path, targets);
  }
  const graph = { nodes: pages.map(p => p.path), edges };
  const pageIndex = new Map(pages.map((p, i) => [p.path, i]));
  const buildStart = Date.now();
  const terms = buildExpansionTerms(expansionPages);
  const corpus = buildCorpusTerms(terms);
  const index = USE_INDEX ? buildInvertedIndex(terms) : undefined;
  console.log(`built page terms + corpus${USE_INDEX ? ' + inverted index' : ''} in ${Date.now() - buildStart} ms`);

  const scores = {
    base: { ALL: [0, 0], CROSS: [0, 0] },
    exp: { ALL: [0, 0], CROSS: [0, 0] },
  };

  for (const q of questions) {
    const baseTerms = q.queryTerms;
    const tExp = Date.now();
    const expTerms = twoStageExpand(baseTerms, expansionPages, corpus, opts, terms, index, PREFILTER_N);
    expScoringMs += Date.now() - tExp;
    for (const [arm, tt] of [['base', baseTerms], ['exp', expTerms]]) {
      let ranked = rank(tt, terms, corpus, BUDGET, pprPages, graph, pageIndex);
      if (EXCLUDE_ASKER) ranked = ranked.filter(i => i !== pageIndex.get(q.asker.path));
      const truthIdx = pages.indexOf(q.truth);
      const pos = ranked.indexOf(truthIdx);
      const hit = pos >= 0 && pos < 10;
      scores[arm].ALL[1] += 1;
      if (hit) scores[arm].ALL[0] += 1;
      if (q.cross) {
        scores[arm].CROSS[1] += 1;
        if (hit) scores[arm].CROSS[0] += 1;
      }
    }
  }

  const r = (h, n) => (n === 0 ? 0 : h / n);
  const lines = [];
  lines.push(`vault=${basename(vaultDir)} pages=${pages.length} questions=${questions.length} budget=${BUDGET} excludeAsker=${EXCLUDE_ASKER} layer=${LAYER}`);
  lines.push(`opts=${JSON.stringify(opts)} useIndex=${USE_INDEX} prefilterN=${PREFILTER_N} buildMs=${Date.now() - t0} expansionScoringMs=${expScoringMs}`);
  lines.push('');
  lines.push('arm  layer  r@10    n');
  for (const arm of ['base', 'exp']) {
    for (const layer of ['ALL', 'CROSS']) {
      const [h, n] = scores[arm][layer];
      if (n === 0) continue;
      lines.push(`${arm.padEnd(4)} ${layer.padEnd(6)} ${r(h, n).toFixed(3)}  ${n}`);
    }
  }
  const dAll = r(scores.exp.ALL[0], scores.exp.ALL[1]) - r(scores.base.ALL[0], scores.base.ALL[1]);
  const dCross = r(scores.exp.CROSS[0], scores.exp.CROSS[1]) - r(scores.base.CROSS[0], scores.base.CROSS[1]);
  lines.push('');
  lines.push(`delta ALL   r@10 = ${dAll >= 0 ? '+' : ''}${dAll.toFixed(3)}`);
  lines.push(`delta CROSS r@10 = ${dCross >= 0 ? '+' : ''}${dCross.toFixed(3)}`);

  const report = lines.join('\n');
  console.log('\n' + report);
  if (flags.out) writeFileSync(flags.out, report + '\n');
}

main();
