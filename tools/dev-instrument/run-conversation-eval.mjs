#!/usr/bin/env npx tsx
// Conversation-history evaluation for the retrieval pipeline.
//
// WHY THIS FILE EXISTS
//
// The history weighting was introduced to stop the conversation from outvoting
// the present: measured on the topic-switch case, plain concatenation dropped
// self-retrieval MRR from 1.000 to 0.38-0.44. The weight was computed, used to
// choose which terms the expansion adds, and then flattened — and the ranking
// path, which reads a string, cannot tell a weighted term from an unweighted
// one. So the weighting may not be doing anything at all, and the r@10
// measurements over a corpus cannot say: they measure retrieval, not
// conversation.
//
// This file measures the two conversation cases that decide it, through the
// production path:
//
//   TOPIC-SWITCH  the question asks about page P; the history is about other
//                 pages. P must stay at rank 1. This is the case the weighting
//                 exists for.
//
//   FOLLOW-UP     the question refers to the history ("and its performance?").
//                 The words that identify the page live in the history. This
//                 is the case a fix could break, because the words arrive
//                 through the history.
//
// THREE ARMS, ONE PIPELINE
//
//   none      no history reaches the query at all.
//   concat    the history is appended to the question — the behaviour before
//             the weighting existed.
//   weighted  the production behaviour: the history is weighted at 0.3.
//
// All three go through `planRetrieval` and `selectPprSeeds`, which is what
// `QueryView` calls. A tool that reimplemented the composition would be
// measuring itself; that defect has happened six times in this project, and
// `pipeline/retrieval-plan.ts` exists because of it.
//
// The verdict is the comparison, not any single number: if `weighted` and
// `concat` land on the same MRR for the topic-switch family, the weighting has
// no effect on the ranking, whatever the expansion added.
//
// USAGE
//
//   node tools/dev-instrument/run-conversation-eval.mjs <vault-dir> [options]
//
//   --cases <file>     JSON case file. See CASES FORMAT below.
//   --derive           auto-derive topic-switch cases from the vault's pages.
//   --derive-followup  auto-derive follow-up cases: the question names
//                      nothing, the history carries the target's title.
//   --followup-phrase  the anaphoric question a derived follow-up asks.
//                      Several, separated by `|`. Default: 那它呢？
//   --limit <n>        cap the number of cases per family AND per source
//                      (evenly sampled, never the head).
//   --family <name>    topic-switch | follow-up | all  (default: all)
//   --rounds <n>       history rounds (default: the production constant)
//   --weights <list>   the history weights to sweep, comma-separated.
//                      Default: the production value alone (0.3).
//   --bootstrap <n>    bootstrap iterations for the confidence intervals
//                      (default: 2000; 0 turns them off)
//   --out <file>       write the report to a file
//
// CASES FORMAT
//
//   {
//     "cases": [
//       {
//         "name": "sleep-and-insulin",
//         "family": "follow-up",
//         "question": "and its effect on sleep?",
//         "history": ["user: Insulin resistance and sleep duration", "..."],
//         "expected": "entities/insulin-resistance.md"
//       }
//     ]
//   }
//
// `expected` is a page path relative to the vault, without the extension.
// `history` entries are strings; a "user: " prefix is stripped, and anything
// else is treated as a user turn.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseIndexForPages } from '../../src/core/index-search.ts';
import { buildGraphFromContent } from '../../src/core/build-graph.ts';
import { withBodies } from '../../src/wiki/query-engine/pipeline/read-index.ts';
import { selectPprSeeds } from '../../src/wiki/query-engine/pipeline/select-seeds.ts';
import { planRetrieval } from '../../src/wiki/query-engine/pipeline/retrieval-plan.ts';
import { TermIndexCache } from '../../src/core/term-index-cache.ts';
import { ExpansionTermsCache, DEFAULT_EXPANSION } from '../../src/core/query-expansion.ts';
import { EN_TEXTS } from '../../src/texts/en.ts';
import { makeSeededRng } from '../../src/core/monte-carlo-ppr.ts';
import {
  segment,
  buildPageTerms,
  nameTierCoverage,
} from '../../src/core/term-index.ts';
import {
  lexMatchByTitleAndAliases,
  tokenizeQuery,
} from '../../src/core/ppr-cascade.ts';
import { RETRIEVAL_HISTORY_ROUNDS } from '../../src/constants.ts';

const args = process.argv.slice(2);

// The options that take a value. Their VALUES are not positionals, and
// treating one as the vault directory makes the whole run measure an empty
// index: `--cases <file>` puts a path that does not start with `--` into the
// argument list, and "the first argument that is not an option" then names the
// case file, not the vault.
//
// That is not a hypothetical. This file ran for a while with `--cases` on the
// command line and reported six follow-up cases at MRR 0.000 with a coverage
// of 0.000 — a plausible-looking result, measured on nothing. The check that
// would have caught it is the one below: a vault directory that has no
// `index.md` is an error, not an empty measurement.
const OPTIONS_WITH_VALUE = new Set([
  'cases', 'family', 'followup-phrase', 'limit', 'rounds', 'out', 'weights', 'bootstrap', 'vault',
]);

const positionals = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith('--')) {
    const name = a.slice(2);
    if (OPTIONS_WITH_VALUE.has(name) && args[i + 1] !== undefined && !args[i + 1].startsWith('--')) i++;
    continue;
  }
  positionals.push(a);
}

const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  if (i >= 0 && args[i + 1] !== undefined && !args[i + 1].startsWith('--')) return args[i + 1];
  return dflt;
};

const dir = flag('vault', positionals[0]);
if (!dir) {
  console.error('usage: npx tsx tools/dev-instrument/run-conversation-eval.mjs <vault-dir> [--cases <file>] [--derive] [--limit n] [--family name] [--rounds n] [--weights list] [--bootstrap n] [--out file]');
  process.exit(1);
}
const CASES_FILE = flag('cases', null);
const DERIVE = args.includes('--derive');
const DERIVE_FOLLOWUP = args.includes('--derive-followup');
/**
 * The anaphoric question a derived follow-up asks.
 *
 * It carries no content words, so the words that identify the page can only
 * come from the history. The production vault is Chinese, so that is the
 * default; `--followup-phrase` overrides it for another vault, and the flag
 * takes several phrases separated by `|`.
 */
const FOLLOWUP_PHRASES = (flag('followup-phrase', '那它呢？') || '那它呢？').split('|').map(s => s.trim()).filter(Boolean);
const LIMIT = Number(flag('limit', 0)) || 0;
const FAMILY = flag('family', 'all');
const ROUNDS = Number(flag('rounds', RETRIEVAL_HISTORY_ROUNDS)) || RETRIEVAL_HISTORY_ROUNDS;
const WEIGHTS = (flag('weights', '0.3') || '0.3').split(',').map(s => s.trim()).filter(Boolean).map(Number);
const BOOTSTRAP = Number(flag('bootstrap', 2000)) || 0;
const OUT = flag('out', null);

const say = console.log;
const lines = [];
const emit = line => { say(line); lines.push(line); };

// ---------------------------------------------------------------- load vault

const indexPath = join(dir, 'index.md');
// A missing index is an ERROR, not an empty measurement. Every metric in this
// file is a ratio over the cases, and a run against an empty index produces
// zeros that look like a finding: "the follow-up arm scores 0.000" is a
// sentence, and it is also what a mis-pointed vault directory produces.
if (!existsSync(indexPath)) {
  console.error(`no wiki index at ${indexPath}`);
  console.error('the first argument must be the directory that CONTAINS index.md — the wiki folder itself.');
  process.exit(2);
}
const indexContent = readFileSync(indexPath, 'utf8');
const pageRefs = parseIndexForPages(indexContent);
if (pageRefs.length === 0) {
  console.error(`the index at ${indexPath} lists no pages`);
  process.exit(2);
}
const bodies = new Map();
const loaded = [];
for (const ref of pageRefs) {
  const f = join(dir, `${ref.path}.md`);
  if (!existsSync(f)) continue;
  const c = readFileSync(f, 'utf8');
  bodies.set(ref.path, c);
  loaded.push({ path: ref.path, content: c });
}
const graph = buildGraphFromContent(loaded, new Set(pageRefs.map(p => p.path)), '');
const refs = withBodies(pageRefs, bodies);
const byPath = new Map(refs.map(p => [p.path, p]));

// ------------------------------------------------------------------- cases

/** A history turn. "user: " is stripped; anything else counts as a user turn. */
function toTurns(history) {
  return history.map(h => {
    const text = h.startsWith('user: ') ? h.slice('user: '.length) : h;
    return { role: 'user', content: text };
  });
}

/**
 * Auto-derive the target pages from the vault's own pages.
 *
 * A target is a page with a title. For each target, the pages whose titles
 * share no vocabulary with it are collected as the "unrelated" set — a
 * topic-switch history is built from those, and a follow-up history is built
 * from the target's own title.
 *
 * The two families are built from the SAME targets, so the difference between
 * them is the question and nothing else: the topic-switch question is the
 * target's own title (self-sufficient), the follow-up question is an
 * anaphora that names nothing (so the identifying words can only come from
 * the history). That is the comparison the cut-or-keep decision needs.
 */
function deriveTargets() {
  const titles = refs
    .map(r => ({ path: r.path, title: (r.title ?? '').trim() }))
    .filter(x => x.title.length > 3);
  const out = [];
  for (const target of titles) {
    const targetTerms = new Set(segment(target.title));
    if (targetTerms.size === 0) continue;
    const others = [];
    for (const cand of titles) {
      if (cand.path === target.path) continue;
      const candTerms = segment(cand.title);
      if (candTerms.length === 0) continue;
      if (candTerms.some(t => targetTerms.has(t))) continue; // unrelated
      others.push(cand);
    }
    if (others.length < 4) continue;
    // Evenly spaced picks, so the history is not the first four pages.
    const stride = Math.max(1, Math.floor(others.length / 4));
    const history = [0, 1, 2, 3].map(k => others[k * stride]?.title).filter(Boolean);
    if (history.length < 4) continue;
    out.push({ target, history });
  }
  return out;
}

/** The topic-switch case for one target: the question names the page. */
function topicSwitchCase({ target, history }) {
  return {
    name: `topic-switch:${target.path}`,
    family: 'topic-switch',
    source: 'derived',
    question: target.title,
    history,
    expected: target.path,
  };
}

/**
 * The follow-up case for one target: the question names nothing.
 *
 * The history is the target's own title and the anaphora, which is the shape
 * of a real follow-up: the words that identify the page were said in the
 * previous turn. There is no unrelated turn here on purpose — this family
 * isolates the signal ("the history carries the identifying words"), and the
 * topic-switch family measures the cost of the noise.
 */
function followUpCase({ target }, phrase) {
  return {
    name: `follow-up:${target.path}`,
    family: 'follow-up',
    source: 'derived',
    question: phrase,
    history: [`user: ${target.title}`, `user: ${phrase}`],
    expected: target.path,
  };
}

let cases = [];
if (CASES_FILE) {
  const parsed = JSON.parse(readFileSync(CASES_FILE, 'utf8'));
  cases = Array.isArray(parsed) ? parsed : (parsed.cases ?? []);
  // The hand-written cases and the derived ones are different shapes, and
  // they answer different questions: the hand-written ones carry an aspect
  // word ("its VRAM requirement"), the derived ones name nothing at all. The
  // report splits them, so a number is never a blend of two populations.
  for (const c of cases) if (!c.source) c.source = 'hand-written';
}
if (DERIVE || DERIVE_FOLLOWUP) {
  const targets = deriveTargets();
  if (DERIVE) cases = cases.concat(targets.map(topicSwitchCase));
  if (DERIVE_FOLLOWUP) {
    for (const t of targets) {
      for (const phrase of FOLLOWUP_PHRASES) cases.push(followUpCase(t, phrase));
    }
  }
}
if (FAMILY !== 'all') cases = cases.filter(c => c.family === FAMILY);
// The limit applies PER FAMILY AND PER SOURCE. Applied to the combined list
// it would change which cases each group contributes, and two runs would
// stop being comparable — the number a report quotes has to be the number a
// re-run reproduces. The source is part of the key because the hand-written
// cases and the derived ones are different populations: a limit applied to
// the family alone samples the derived list, and the hand-written cases sit
// in front of it, so they are almost all skipped.
if (LIMIT > 0) {
  const byGroup = new Map();
  for (const c of cases) {
    const key = `${c.family}|${c.source ?? 'hand-written'}`;
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key).push(c);
  }
  cases = [];
  for (const [, group] of byGroup) {
    if (group.length <= LIMIT) { cases.push(...group); continue; }
    const stride = Math.floor(group.length / LIMIT);
    cases.push(...group.filter((_, i) => i % stride === 0).slice(0, LIMIT));
  }
}

emit(`vault=${basename(dir)} pages=${refs.length} nodes=${graph.nodes.length} cases=${cases.length} rounds=${ROUNDS} family=${FAMILY}`);
if (cases.length === 0) {
  say('No cases: pass --cases <file>, --derive, or both.');
  process.exit(0);
}

// ------------------------------------------------------------------- arms

const termCache = new TermIndexCache();
const expansionCache = new ExpansionTermsCache();

// The name tier is the same table Stage 1 of the production pipeline reads:
// title and aliases, no summary, no body. The question statistics below come
// from it, so the number this tool prints is the number the pipeline computes.
const nameTier = termCache.getNameTier(indexContent, refs);
const corpusTerms = nameTier.corpus;

/**
 * The question's own lexical standing, computed by the production functions.
 *
 * This is the statistic the two conversation families differ on. A topic-switch
 * question names its page, so the name tier covers most of the query's IDF; a
 * follow-up question names nothing, so the coverage is near zero and the
 * identifying words can only come from the history. A rule that could serve
 * both families at once would read this number, so the tool measures it.
 */
function questionStats(question) {
  const hits = lexMatchByTitleAndAliases(question, refs, { corpus: corpusTerms });
  const queryTerms = tokenizeQuery(question).flatMap(t => segment(t));
  const topPageTerms = hits.length > 0
    ? buildPageTerms({
        title: hits[0].page.title,
        aliases: hits[0].page.aliases,
        summary: '',
        text: '',
      })
    : null;
  const coverage = topPageTerms
    ? nameTierCoverage(queryTerms, topPageTerms, corpusTerms)
    : 0;
  return { count: hits.length, coverage };
}

// The production seed selection logs a Stage-1 line per query through
// `console.debug`, which in Node is `console.log`. Silenced here so the report
// is readable; the production code is not touched.
const realDebug = console.debug;
const silence = () => { console.debug = () => {}; };
const unsilence = () => { console.debug = realDebug; };

/** The ranked page paths for one plan, through the production seed selection. */
async function rank(plan) {
  const out = await selectPprSeeds(
    plan.expandedQuery,
    refs,
    graph,
    undefined,
    { model: 'm' },
    EN_TEXTS,
    undefined,
    { cache: termCache, indexContent },
    plan.llmQuery,
    plan.gateQuery,
  );
  return out.matches.map(m => m.page.path);
}

/** 1-based rank of the expected page, or 0 when it is not in the list. */
function rankOf(ranked, expected) {
  const i = ranked.indexOf(expected);
  return i < 0 ? 0 : i + 1;
}

const ARMS = ['none', 'concat', 'weighted'];
const results = { none: [], concat: [], weighted: [] };
const plans = { none: null, concat: null, weighted: null };
// One rank list per swept weight. The production weight (0.3) is the `weighted`
// arm itself; the sweep asks whether it is the right value, which a single
// number cannot answer.
const weightScan = new Map();
const qStats = [];
let shown = 0;

for (const c of cases) {
  const turns = toTurns(c.history ?? []);
  const historyText = turns.map(t => t.content).join(' ');

  // Arm A — no history reaches the query.
  const planNone = planRetrieval({
    current: c.question,
    history: [],
    historyRounds: 0,
    retrievalRefs: refs,
    indexContent,
    expansionCache,
    opts: DEFAULT_EXPANSION,
  });
  // Arm B — the history appended to the question: the behaviour before the
  // weighting existed, through the same pipeline.
  const planConcat = planRetrieval({
    current: `${c.question} ${historyText}`.trim(),
    history: [],
    historyRounds: 0,
    retrievalRefs: refs,
    indexContent,
    expansionCache,
    opts: DEFAULT_EXPANSION,
  });
  // Arm C — the production behaviour: the history, weighted at the production
  // value. The sweep below runs the same arm at the other weights.
  const planWeighted = planRetrieval({
    current: c.question,
    history: turns,
    historyRounds: ROUNDS,
    retrievalRefs: refs,
    indexContent,
    expansionCache,
    opts: DEFAULT_EXPANSION,
    historyWeight: 0.3,
  });

  for (const [arm, plan] of [['none', planNone], ['concat', planConcat], ['weighted', planWeighted]]) {
    silence();
    const ranked = await rank(plan);
    unsilence();
    results[arm].push(rankOf(ranked, c.expected));
    if (arm === 'weighted') plans[arm] = plan;
  }

  // The weight sweep. Each weight is the production arm with one number
  // changed, through the same pipeline — not a parallel implementation.
  for (const w of WEIGHTS) {
    const key = w.toFixed(3);
    if (!weightScan.has(key)) weightScan.set(key, []);
    if (Math.abs(w - 0.3) < 1e-9) {
      weightScan.get(key).push(results.weighted.at(-1));
      continue;
    }
    const plan = planRetrieval({
      current: c.question,
      history: turns,
      historyRounds: ROUNDS,
      retrievalRefs: refs,
      indexContent,
      expansionCache,
      opts: DEFAULT_EXPANSION,
      historyWeight: w,
    });
    silence();
    const ranked = await rank(plan);
    unsilence();
    weightScan.get(key).push(rankOf(ranked, c.expected));
  }
  qStats.push(questionStats(c.question));
  if (shown < 3) {
    shown += 1;
    const st = qStats.at(-1);
    emit(`\n[${c.name}] family=${c.family}`);
    emit(`  question : ${c.question}`);
    emit(`  history  : ${(c.history ?? []).join(' | ')}`);
    emit(`  expected : ${c.expected}`);
    emit(`  question's own lexical standing: name-tier hits=${st.count} coverage=${st.coverage.toFixed(3)}`);
    emit(`  weighted expandedQuery the scorer received:`);
    emit(`    ${plans.weighted.expandedQuery}`);
    emit(`  ranks    : none=${results.none.at(-1)} concat=${results.concat.at(-1)} weighted=${results.weighted.at(-1)}`);
  }
}

// ----------------------------------------------------------------- report

function mrr(ranks) {
  if (ranks.length === 0) return 'n/a';
  let acc = 0;
  for (const r of ranks) acc += r === 0 ? 0 : 1 / r;
  return (acc / ranks.length).toFixed(3);
}
/**
 * Recall at k: the share of cases whose expected page is in the top k.
 *
 * A rank of 0 means the page was not in the list at all, so it is a miss at
 * every k. The list the pipeline returns is at most `RETRIEVAL_BUDGET` (20)
 * long, so r@20 is "in the list" and r@10 is a real cut inside it.
 */
function recallAt(ranks, k) {
  if (ranks.length === 0) return 'n/a';
  const hit = ranks.filter(r => r > 0 && r <= k).length;
  return (hit / ranks.length).toFixed(3);
}
function missed(ranks) {
  return ranks.filter(r => r === 0).length;
}
/** The range of a family's question coverage, for the separation line. */
function coverageRange(values) {
  if (values.length === 0) return 'n/a';
  const sorted = [...values].sort((a, b) => a - b);
  return `min=${sorted[0].toFixed(3)} med=${sorted[Math.floor(sorted.length / 2)].toFixed(3)} max=${sorted.at(-1).toFixed(3)}`;
}

/**
 * A bootstrap confidence interval for one metric over one case set.
 *
 * Why this exists. A difference between two arms on 30 cases is a number, and
 * a number without an interval is a claim the reader has to trust. The
 * third-party audit asked for intervals on the expansion's +0.030 for exactly
 * this reason, and the same argument applies here: `weighted` at 0.967 and
 * `concat` at 0.367 is a large gap, and `0.615` against `0.600` is not.
 *
 * The resampling is over CASES, and the metric is recomputed on each
 * resample. The seed is fixed, so two runs of this harness report the same
 * interval — an interval that moved between runs would be a second source of
 * noise on top of the one being measured.
 *
 * The interval is a percentile interval (2.5% to 97.5%). It says what the
 * metric would be if the cases were a sample from the same population, which
 * is the assumption a 30-case set makes whether or not it holds.
 */
function bootstrapCI(ranks, metric, iterations, seedText) {
  if (!iterations || ranks.length === 0) return null;
  const rng = makeSeededRng(seedText);
  const stats = [];
  const n = ranks.length;
  for (let it = 0; it < iterations; it++) {
    const sample = new Array(n);
    for (let i = 0; i < n; i++) sample[i] = ranks[Math.floor(rng() * n)];
    stats.push(metric(sample));
  }
  stats.sort((a, b) => a - b);
  const q = (p) => stats[Math.min(stats.length - 1, Math.max(0, Math.floor(stats.length * p)))];
  return { lo: q(0.025), hi: q(0.975) };
}

/** MRR over a rank list, as a number (not a string) so it can be averaged. */
const mrrOf = ranks => ranks.reduce((a, r) => a + (r === 0 ? 0 : 1 / r), 0) / ranks.length;
/** Recall@k over a rank list, as a number. */
const recallOf = (ranks, k) => ranks.filter(r => r > 0 && r <= k).length / ranks.length;

/** `0.615 [0.512, 0.720]` — the point estimate with its interval. */
function withCI(ranks, metric, label, seedText) {
  const point = metric(ranks);
  const ci = bootstrapCI(ranks, metric, BOOTSTRAP, seedText);
  const pointStr = point.toFixed(3);
  if (!ci) return `${label}=${pointStr}`;
  return `${label}=${pointStr} [${ci.lo.toFixed(3)}, ${ci.hi.toFixed(3)}]`;
}

emit('\n=== CONVERSATION: three arms, one pipeline ===');
emit('  none      = no history reaches the query. This is the arm that stands for');
emit('              what `main` ships: on main the retrieval query is the question');
emit('              alone, so `none` is `main` plus this branch\'s expansion.');
emit('  concat    = the history appended to the question.');
emit('  weighted  = the production behaviour: the history weighted at 0.3.');
emit('');
emit('  A derived follow-up is a CONSTRUCTED case, not a sample of real ones: its');
emit('  question names nothing at all ("那它呢？"), so "no history answers it" is');
emit('  close to built in. It shows the history CAN carry a follow-up; it does');
emit('  NOT say how many real follow-ups there are. The hand-written follow-ups');
emit('  are the closer shape (they carry an aspect word) and there are six of');
emit('  them, which is why the break-even mix is quoted as a range.');
const families = [...new Set(cases.map(c => c.family))];
for (const family of families) {
  const famIdx = cases.map((c, i) => ({ c, i })).filter(x => x.c.family === family).map(x => x.i);
  emit(`\n  family: ${family}  (n=${famIdx.length})`);
  const sources = [...new Set(famIdx.map(i => cases[i].source ?? 'hand-written'))];
  for (const source of sources) {
    const idx = famIdx.filter(i => (cases[i].source ?? 'hand-written') === source);
    const pad = sources.length > 1 ? '      ' : '    ';
    if (sources.length > 1) emit(`    source: ${source}  (n=${idx.length})`);
    for (const arm of ARMS) {
      const ranks = idx.map(i => results[arm][i]);
      const seedText = `${family}|${source}|${arm}`;
      emit(`${pad}${arm.padEnd(8)} ${withCI(ranks, mrrOf, 'MRR', seedText)}  ${withCI(ranks, x => recallOf(x, 10), 'r@10', seedText + '|r10')}  r@20=${recallAt(ranks, 20)}  not-in-list=${missed(ranks)}`);
    }
    const cov = idx.map(i => qStats[i].coverage);
    emit(`${pad}question's own name-tier coverage: ${coverageRange(cov)}`);
  }
  const w = mrr(famIdx.map(i => results.weighted[i]));
  const k = mrr(famIdx.map(i => results.concat[i]));
  const same = w === k;
  emit(`    VERDICT  weighted vs concat: ${same ? 'IDENTICAL — the weighting does not change the ranking' : 'different — the weighting reaches the ranking'}`);
}

// The weight sweep. 0.3 came out of a corpus measurement; this asks whether
// that number is the right one on this vault with these cases. A weight that
// cannot be varied cannot be checked.
if (weightScan.size > 1) {
  emit('\n=== HISTORY WEIGHT SWEEP ===');
  emit('  The production arm with one number changed, through the same pipeline.');
  for (const family of families) {
    const famIdx = cases.map((c, i) => ({ c, i })).filter(x => x.c.family === family).map(x => x.i);
    emit(`\n  family: ${family}  (n=${famIdx.length})`);
    for (const [w, ranks] of weightScan) {
      const r = famIdx.map(i => ranks[i]);
      const seedText = `sweep|${family}|${w}`;
      emit(`    weight=${w.padEnd(6)} ${withCI(r, mrrOf, 'MRR', seedText)}  ${withCI(r, x => recallOf(x, 10), 'r@10', seedText + '|r10')}  r@20=${recallAt(r, 20)}  not-in-list=${missed(r)}`);
    }
  }
  emit('');
  emit('  The production weight is 0.3. A row that is best at another weight is');
  emit('  a finding, not a change — the weight is a product decision until a');
  emit('  measurement says otherwise.');
}

// The per-case table. The aggregate says which arm wins; this says which
// cases, and it is where a family that behaves differently from its own
// average shows up.
emit('\n=== PER CASE ===');
cases.forEach((c, i) => {
  const st = qStats[i];
  emit(`  ${(c.source ?? 'hand-written').padEnd(12)} ${c.family.padEnd(12)} cov=${st.coverage.toFixed(3)} hits=${String(st.count).padStart(4)}  none=${results.none[i]} concat=${results.concat[i]} weighted=${results.weighted[i]}  ${c.expected}`);
});

if (OUT) {
  writeFileSync(OUT, lines.join('\n') + '\n');
  console.error(`wrote ${OUT}`);
}