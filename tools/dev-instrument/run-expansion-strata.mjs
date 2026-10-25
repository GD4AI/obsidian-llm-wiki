// Stratified expansion measurement.
//
// The question this answers: when the expansion gains, does it gain on cases
// where the first stage ALREADY had the answer near the top, or on cases where
// the first stage missed it entirely?
//
// Why it matters. Two readings of a small delta on a vault are live, and they
// have different fixes:
//
//   1. The question set is degenerate. The expansion builds its query from the
//      asker page's index `summary`. On a vault where 24 % of pages share a
//      summary with another page ("- Type: product" x56), those questions are
//      identical, so there is nothing distinctive to expand from.
//   2. The baseline is too low for the expansion to help. The expansion adds
//      words taken from the pages the ranking ALREADY found. If the first stage
//      does not surface the answer at all, there is nothing right to amplify.
//
// The discriminator is the same for both: stratify by arm A's rank of the
// truth page.
//
//   REACHED   A put the truth in the top-20 (the pipeline's own budget).
//   MISSED    A did not. The expansion has to pull it in from outside.
//
// A large gain inside REACHED and none inside MISSED means the expansion is a
// re-ranker: it improves the order of what was found, and cannot find what was
// not. That is a true statement about the mechanism, and it makes the low-baseline
// vault a different problem from the expansion.
//
// Usage:
//   npx tsx tools/dev-instrument/run-expansion-strata.mjs --vault <dir> \
//     [--wiki-folder wiki] [--limit n] [--bootstrap 2000]
//
// Every arm goes through the production path: `planRetrieval` -> `selectPprSeeds`.

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
import { RETRIEVAL_BUDGET } from '../../src/constants.ts';
import { makeSeededRng } from '../../src/core/monte-carlo-ppr.ts';

function flag(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const VAULT = flag('vault', null);
const WIKI_FOLDER = flag('wiki-folder', null);
const LIMIT = Number(flag('limit', 0)) || 0;
const BOOTSTRAP = Number(flag('bootstrap', 2000)) || 0;
const OUT = flag('out', null);
const EXCLUDE_ASKER = !process.argv.includes('--no-exclude-asker');

if (!VAULT || typeof VAULT !== 'string') {
  console.error('usage: npx tsx tools/dev-instrument/run-expansion-strata.mjs --vault <dir> [--wiki-folder <name>] [--limit n] [--bootstrap n]');
  process.exit(1);
}

const dir = WIKI_FOLDER && typeof WIKI_FOLDER === 'string' ? join(VAULT, WIKI_FOLDER) : VAULT;
const indexPath = join(dir, 'index.md');
if (!existsSync(indexPath)) {
  console.error(`no wiki index at ${indexPath}`);
  process.exit(2);
}
const indexContent = readFileSync(indexPath, 'utf8');
const pageRefs = parseIndexForPages(indexContent);
if (pageRefs.length === 0) {
  console.error(`the index at ${indexPath} lists no pages`);
  process.exit(2);
}

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

// How many pages share each asker's summary. This is the "degenerate question
// set" measure, kept per question so the strata can be crossed with it.
const summaryCounts = new Map();
for (const r of pageRefs) {
  const s = (r.summary ?? '').trim();
  if (s) summaryCounts.set(s, (summaryCounts.get(s) ?? 0) + 1);
}

// Questions from the production graph's own edges — the same construction as
// `run-expansion-eval.mjs`, so the two tools answer the same question about the
// same population.
const all = [];
for (const [askerPath, targets] of graph.edges) {
  const a = byPath.get(askerPath);
  if (!a) continue;
  for (const truthPath of targets) {
    const b = byPath.get(truthPath);
    if (!b || b === a) continue;
    const bTerms = new Set(segment(`${b.title} ${b.summary ?? ''}`));
    if (bTerms.size === 0) continue;
    const aTerms = new Set(segment(`${a.title} ${a.summary ?? ''}`));
    if ([...bTerms].filter(t => aTerms.has(t)).length / bTerms.size > 0.67) continue;
    const query = [...segment(a.summary ?? '')].filter(t => !bTerms.has(t)).join(' ');
    if (!query) continue;
    const summaryText = (a.summary ?? '').trim();
    all.push({
      query,
      truthPath,
      askerPath,
      sharedSummary: summaryText ? (summaryCounts.get(summaryText) ?? 1) - 1 : 0,
    });
  }
}

const stride = LIMIT > 0 && LIMIT < all.length ? Math.floor(all.length / LIMIT) : 1;
const questions = stride > 1
  ? all.filter((_, i) => i % stride === 0).slice(0, LIMIT)
  : [...all];

const say = console.log;
const lines = [];
const emit = line => { say(line); lines.push(line); };

emit(`vault=${basename(dir)} pages=${refs.length} questions=${questions.length} budget=${RETRIEVAL_BUDGET} excludeAsker=${EXCLUDE_ASKER}`);
if (stride > 1) emit(`sampled evenly from ${all.length} available questions, stride=${stride} (NOT the first ${questions.length})`);
if (questions.length === 0) {
  emit(all.length === 0
    ? 'No questions: the graph carries no resolvable (asker -> truth) pair.'
    : `No questions in the sample: ${all.length} were available and the sampling returned none.`);
  process.exit(all.length === 0 ? 0 : 2);
}

const termCache = new TermIndexCache();
const expansionCache = new ExpansionTermsCache();

async function arm(plan, use) {
  return (await selectPprSeeds(
    plan.expandedQuery,
    use,
    graph,
    undefined,
    { model: 'm' },
    EN_TEXTS,
    undefined,
    { cache: termCache, indexContent },
    plan.llmQuery,
    plan.gateQuery,
  )).matches.map(m => m.page.path);
}

const rows = [];
for (const q of questions) {
  const use = EXCLUDE_ASKER ? refs.filter(p => p.path !== q.askerPath) : refs;
  const common = {
    current: q.query,
    history: [],
    historyRounds: 5,
    retrievalRefs: use,
    indexContent,
    expansionCache,
    opts: DEFAULT_EXPANSION,
  };
  const planA = planRetrieval({ ...common, expand: false });
  const planB = planRetrieval({ ...common, expand: true });
  const aRanked = await arm(planA, use);
  const bRanked = await arm(planB, use);
  const aIdx = aRanked.indexOf(q.truthPath);
  const bIdx = bRanked.indexOf(q.truthPath);
  rows.push({
    aRank: aIdx,
    bRank: bIdx,
    aHit10: aIdx >= 0 && aIdx < 10,
    bHit10: bIdx >= 0 && bIdx < 10,
    reached: aIdx >= 0,          // arm A put it in the list at all (top-20)
    sharedSummary: q.sharedSummary,
  });
}

// ---------------------------------------------------------------- statistics

const hit10 = r => (r.aHit10 ? 1 : 0);
const rate = rs => rs.length === 0 ? null : rs.reduce((a, r) => a + hit10(r), 0) / rs.length;

function pairedCI(rs, iterations, seedText) {
  if (!iterations || rs.length === 0) return null;
  const rng = makeSeededRng(seedText);
  const n = rs.length;
  const stats = [];
  for (let it = 0; it < iterations; it++) {
    let a = 0, b = 0;
    for (let i = 0; i < n; i++) {
      const r = rs[Math.floor(rng() * n)];
      if (r.aHit10) a++;
      if (r.bHit10) b++;
    }
    stats.push((b - a) / n);
  }
  stats.sort((x, y) => x - y);
  const qq = p => stats[Math.min(stats.length - 1, Math.max(0, Math.floor(stats.length * p)))];
  return { lo: qq(0.025), hi: qq(0.975), crossesZero: qq(0.025) <= 0 && qq(0.975) >= 0 };
}

function line(label, rs) {
  if (rs.length === 0) {
    emit(`  ${label.padEnd(34)} n=0    n/a`);
    return;
  }
  const a = rate(rs);
  const b = rs.reduce((acc, r) => acc + (r.bHit10 ? 1 : 0), 0) / rs.length;
  const ci = pairedCI(rs, BOOTSTRAP, `strata|${label}`);
  const ciText = ci ? `[${ci.lo >= 0 ? '+' : ''}${ci.lo.toFixed(3)}, ${ci.hi >= 0 ? '+' : ''}${ci.hi.toFixed(3)}]${ci.crossesZero ? ' crosses 0' : ''}` : 'n/a';
  emit(`  ${label.padEnd(34)} n=${String(rs.length).padStart(5)}  A=${a.toFixed(3)}  B=${b.toFixed(3)}  delta=${(b - a >= 0 ? '+' : '') + (b - a).toFixed(3)}  ${ciText}`);
}

emit('');
emit('=== STRATA: did arm A already find the answer? ===');
emit('  REACHED = arm A had the truth in the top-20 (the pipeline budget).');
emit('  MISSED  = it did not, so the expansion has to pull it in from outside.');
line('ALL', rows);
line('REACHED (A had it in top-20)', rows.filter(r => r.reached));
line('MISSED  (A did not)', rows.filter(r => !r.reached));

emit('');
emit('=== STRATA x DEGENERATE QUESTION SET ===');
emit('  "shared" counts how many OTHER pages carry the same index summary.');
line('summary unique to this page', rows.filter(r => r.sharedSummary === 0));
line('summary shared by 1+ other page', rows.filter(r => r.sharedSummary > 0));

emit('');
emit('=== WHERE THE GAIN COMES FROM ===');
const gained = rows.filter(r => r.bHit10 && !r.aHit10);
const lost = rows.filter(r => r.aHit10 && !r.bHit10);
emit(`  gained a top-10 hit: ${gained.length}   (of which A had it in the list already: ${gained.filter(r => r.reached).length})`);
emit(`  lost a top-10 hit:   ${lost.length}`);
emit(`  REACHED share of all questions: ${(100 * rows.filter(r => r.reached).length / rows.length).toFixed(1)}%`);
emit('');
emit('  Reading, and it is not the reading this tool first printed.');
emit('  The first version said a gain concentrated in REACHED would mean the');
emit('  expansion only re-ranks what the first stage found. On test8 (n=688) the');
emit('  opposite happened: MISSED gained +0.159 and REACHED gained +0.075 — the');
emit('  expansion is twice as effective on cases the first stage did NOT reach.');
emit('  So it does find what stage 1 missed, and a low baseline does not make a');
emit('  low delta arithmetically unavoidable. A vault whose delta is near zero');
emit('  with a low baseline therefore needs another explanation, and the strata');
emit('  above are where to look for it.');
emit('');
emit('  The candidate that remains: if MISSED gains here too, the expansion works');
emit('  and the delta is suppressed by what the questions can express. If MISSED');
emit('  gains nothing, the expansion has nothing on this corpus to work from.');
emit(`\nwrote ${rows.length} questions`);
if (OUT && typeof OUT === 'string') {
  writeFileSync(OUT, lines.join('\n') + '\n');
  console.error(`wrote ${OUT}`);
}
