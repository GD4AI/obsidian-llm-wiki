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
//   --limit <n>        cap the number of cases (evenly sampled, never the head).
//   --family <name>    topic-switch | follow-up | all  (default: all)
//   --rounds <n>       history rounds (default: the production constant)
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
import { segment } from '../../src/core/term-index.ts';
import { RETRIEVAL_HISTORY_ROUNDS } from '../../src/constants.ts';

const args = process.argv.slice(2);
const dir = args.find(a => !a.startsWith('--'));
if (!dir) {
  console.error('usage: node tools/dev-instrument/run-conversation-eval.mjs <vault-dir> [--cases <file>] [--derive] [--limit n] [--family name] [--rounds n] [--out file]');
  process.exit(1);
}
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : dflt;
};
const CASES_FILE = flag('cases', null);
const DERIVE = args.includes('--derive');
const LIMIT = Number(flag('limit', 0)) || 0;
const FAMILY = flag('family', 'all');
const ROUNDS = Number(flag('rounds', RETRIEVAL_HISTORY_ROUNDS)) || RETRIEVAL_HISTORY_ROUNDS;
const OUT = flag('out', null);

const say = console.log;
const lines = [];
const emit = line => { say(line); lines.push(line); };

// ---------------------------------------------------------------- load vault

const indexPath = join(dir, 'index.md');
const indexContent = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : '';
const pageRefs = parseIndexForPages(indexContent);
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
 * Auto-derive topic-switch cases from the vault's own pages.
 *
 * The question is the page's own title, so the page is retrievable in
 * principle; the history is built from OTHER pages' titles, chosen so they
 * share no vocabulary with it. That is the switch: the history is on a
 * different subject, and the question's page must still come first.
 */
function deriveTopicSwitch() {
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
    out.push({
      name: `topic-switch:${target.path}`,
      family: 'topic-switch',
      question: target.title,
      history,
      expected: target.path,
    });
  }
  return out;
}

let cases = [];
if (CASES_FILE) {
  const parsed = JSON.parse(readFileSync(CASES_FILE, 'utf8'));
  cases = Array.isArray(parsed) ? parsed : (parsed.cases ?? []);
}
if (DERIVE) cases = cases.concat(deriveTopicSwitch());
if (FAMILY !== 'all') cases = cases.filter(c => c.family === FAMILY);
// The limit applies PER FAMILY. Applied to the combined list it would change
// which cases each family contributes, and two runs would stop being
// comparable — the number a report quotes has to be the number a re-run
// reproduces.
if (LIMIT > 0) {
  const byFamily = new Map();
  for (const c of cases) {
    if (!byFamily.has(c.family)) byFamily.set(c.family, []);
    byFamily.get(c.family).push(c);
  }
  cases = [];
  for (const [, group] of byFamily) {
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
  // Arm C — the production behaviour: the history, weighted at 0.3.
  const planWeighted = planRetrieval({
    current: c.question,
    history: turns,
    historyRounds: ROUNDS,
    retrievalRefs: refs,
    indexContent,
    expansionCache,
    opts: DEFAULT_EXPANSION,
  });

  for (const [arm, plan] of [['none', planNone], ['concat', planConcat], ['weighted', planWeighted]]) {
    silence();
    const ranked = await rank(plan);
    unsilence();
    results[arm].push(rankOf(ranked, c.expected));
    if (arm === 'weighted') plans[arm] = plan;
  }
  if (shown < 3) {
    shown += 1;
    emit(`\n[${c.name}] family=${c.family}`);
    emit(`  question : ${c.question}`);
    emit(`  history  : ${(c.history ?? []).join(' | ')}`);
    emit(`  expected : ${c.expected}`);
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
function hit1(ranks) {
  if (ranks.length === 0) return 'n/a';
  return (ranks.filter(r => r === 1).length / ranks.length).toFixed(3);
}
function missed(ranks) {
  return ranks.filter(r => r === 0).length;
}

emit('\n=== CONVERSATION: three arms, one pipeline ===');
const families = [...new Set(cases.map(c => c.family))];
for (const family of families) {
  const idx = cases.map((c, i) => ({ c, i })).filter(x => x.c.family === family).map(x => x.i);
  emit(`\n  family: ${family}  (n=${idx.length})`);
  for (const arm of ARMS) {
    const ranks = idx.map(i => results[arm][i]);
    emit(`    ${arm.padEnd(8)} MRR=${mrr(ranks)}  hit@1=${hit1(ranks)}  not-in-list=${missed(ranks)}`);
  }
  const w = mrr(idx.map(i => results.weighted[i]));
  const k = mrr(idx.map(i => results.concat[i]));
  const same = w === k;
  emit(`    VERDICT  weighted vs concat: ${same ? 'IDENTICAL — the weighting does not change the ranking' : 'different — the weighting reaches the ranking'}`);
}

if (OUT) {
  writeFileSync(OUT, lines.join('\n') + '\n');
  console.error(`wrote ${OUT}`);
}
