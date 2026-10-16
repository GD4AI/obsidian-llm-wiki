#!/usr/bin/env npx tsx
/**
 * run-expansion-eval.mjs — does the two-stage Rocchio expansion earn its cost,
 * measured through the code that ships?
 *
 * The previous version of this tool had its own `rank()`: `bm25fScore` over all
 * fields, `pprCascade` with no seeds, and the two fused by hand. That is not
 * the query path. @DocTpoint's second review (#855, point 5) named it, and the
 * history here is worth reading before changing anything in this file:
 *
 *   - The question construction, not the mechanism, produced one "null result".
 *   - `--exclude-asker` was parsed and then ignored (`loadVault(dir, false)`
 *     with a filter that was `p => true` in both branches), so every figure it
 *     printed was link-following wearing retrieval's coat.
 *   - The expansion was fed segmented bigrams while production fed it
 *     `tokenizeQuery(retrievalQuery)`, which keeps a CJK run as ONE token. The
 *     scorer's tables are keyed by `segment`, so the uncut run matched nothing
 *     and `twoStageExpand` returned its input verbatim. Every number the
 *     expansion had was measured against an input the plugin never produces.
 *
 * None of that is reimplemented here. Both arms go through:
 *
 *   planRetrieval(...)   the ONE composition — three query strings, the
 *                        expansion, the page term mapping. `QueryView` calls it.
 *   selectPprSeeds(...)  the production entry, seeds, gate, fusion and
 *                        assembly included.
 *
 * Arm A passes `expand: false`, which is the product minus one step — not a
 * parallel baseline. Arm B is the product. There is no third code path in this
 * file to drift, which is the only reason its numbers are worth quoting.
 *
 * Usage:
 *   npx tsx run-expansion-eval.mjs <vaultDir> [options]
 *
 * Options:
 *   --out <file>        also write the report to a file
 *   --exclude-asker     drop the asking page (default ON; --no-exclude-asker to turn off)
 *   --limit <n>         cap the questions, for a quick pass
 *   --layer <ALL|CROSS> report one layer
 *   --index <path>      use this index.md instead of the vault's own
 *
 * `--index` exists because a vault's committed `index.md` can be STALE —
 * generated before a generator change landed. test8's is: it has no `source:`
 * marker on any line, so `PageRef.sourceSlug` is `undefined` everywhere, the
 * CROSS layer has zero questions, and every cross-source figure quoted for it is
 * `n=0`. Regenerate with `run-regenerate-index.mjs` and pass the result here.
 */
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

const args = process.argv.slice(2);
const dir = args.find(a => !a.startsWith('--'));
if (!dir) {
  console.error('usage: run-expansion-eval.mjs <vaultDir> [--out f] [--limit n] [--layer ALL|CROSS] [--no-exclude-asker]');
  process.exit(1);
}
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const EXCLUDE_ASKER = !args.includes('--no-exclude-asker');
const LIMIT = Number(flag('limit', '1000000'));
const LAYER = flag('layer', 'ALL');
const OUT = flag('out', null);
const INDEX_OVERRIDE = flag('index', null);

// Production loading. The wiki index carries the page list and a one-line
// description per page; the bodies come from the files, as `withBodies` does.
const indexPath = INDEX_OVERRIDE ?? join(dir, 'index.md');
const indexContent = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : '';
const pageRefs = parseIndexForPages(indexContent);
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

// Questions from the production graph's own edges, so the question and the
// measured path resolve links the same way. `(asker -> truth)` where the
// truth's vocabulary is mostly absent from the asker's.
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
    all.push({ query, truthPath, askerPath, cross: a.sourceSlug !== b.sourceSlug });
  }
}
const questions = (LAYER === 'CROSS' ? all.filter(q => q.cross) : all).slice(0, LIMIT);

const say = console.log;
say(`vault=${basename(dir)} pages=${refs.length} nodes=${graph.nodes.length} questions=${questions.length} budget=${RETRIEVAL_BUDGET} excludeAsker=${EXCLUDE_ASKER} layer=${LAYER} index=${INDEX_OVERRIDE ? basename(INDEX_OVERRIDE) : 'vault index.md'}`);
// The CROSS layer is only populated by the `source:` marker on index lines. Say
// so rather than reporting an empty layer as a score.
const indexedSources = new Set(pageRefs.map(p => p.sourceSlug).filter(s => s !== undefined));
if (indexedSources.size === 0) {
  say(`NOTE: no page carries a sourceSlug (no \`source:\` marker on any index line), so CROSS is empty and any cross-source figure here is meaningless. Regenerate with run-regenerate-index.mjs and pass --index.`);
} else {
  say(`sourceSlugs: ${indexedSources.size} distinct across ${pageRefs.filter(p => p.sourceSlug !== undefined).length} of ${pageRefs.length} pages`);
}
if (questions.length === 0) {
  say('No questions: the graph carries no resolvable (asker -> truth) pair.');
  process.exit(0);
}

const termCache = new TermIndexCache();
const expansionCache = new ExpansionTermsCache();
const tally = () => ({ ALL: [0, 0], CROSS: [0, 0] });
const score = (t, q, ranked) => {
  const hit = ranked.indexOf(q.truthPath) >= 0 && ranked.indexOf(q.truthPath) < 10;
  t.ALL[1] += 1;
  if (hit) t.ALL[0] += 1;
  if (q.cross) {
    t.CROSS[1] += 1;
    if (hit) t.CROSS[0] += 1;
  }
};
const r10 = (t, layer) => (t[layer][1] === 0 ? 'n/a' : (t[layer][0] / t[layer][1]).toFixed(3));
const row = (label, t) => `  ${label} r@10 ALL = ${r10(t, 'ALL')} (n=${t.ALL[1]})   CROSS = ${r10(t, 'CROSS')} (n=${t.CROSS[1]})`;

const lines = [];
const emit = line => { say(line); lines.push(line); };

const A = tally();
const B = tally();
let addedTotal = 0;
let addedMin = Infinity;
let noop = 0;
const t0 = Date.now();

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

  // The self-check that matters: if the expansion adds nothing, this run is
  // measuring nothing and the numbers below are the baseline twice.
  addedTotal += planB.addedTerms;
  if (planB.addedTerms < addedMin) addedMin = planB.addedTerms;
  if (planB.expandedQuery === planB.retrievalQuery) noop += 1;

  const arm = async plan => (await selectPprSeeds(
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

  score(A, q, await arm(planA));
  score(B, q, await arm(planB));
}

emit('\n=== EXPANSION: product minus one step (A) vs the product (B) ===');
emit(row('A no expansion', A));
emit(row('B expansion   ', B));
const dAll = A.ALL[1] ? ((B.ALL[0] - A.ALL[0]) / A.ALL[1]).toFixed(3) : 'n/a';
const dCross = A.CROSS[1] ? ((B.CROSS[0] - A.CROSS[0]) / A.CROSS[1]).toFixed(3) : 'n/a';
emit(`  delta ALL = ${dAll}   CROSS = ${dCross}`);

emit('\n=== SELF-CHECK: did the expansion actually run? ===');
emit(`  words added per query: mean ${(addedTotal / questions.length).toFixed(1)}, min ${addedMin === Infinity ? 'n/a' : addedMin}`);
emit(`  queries where it added nothing: ${noop} of ${questions.length} (${((noop / questions.length) * 100).toFixed(1)}%)`);
emit(`  A no-op rate above 0 means this run cannot speak to the mechanism.`);

emit(`\nelapsed ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (OUT) {
  writeFileSync(OUT, lines.join('\n') + '\n');
  console.error(`wrote ${OUT}`);
}
