#!/usr/bin/env npx tsx
/**
 * run-retrieval-ab.mjs — the retrieval decisions, measured through the code
 * that ships.
 *
 * Two questions, one production entry point each:
 *
 *   1. Which scorer ranks the name tier? `lexMatchByTitleAndAliases` takes
 *      `scorer: 'bm25f' | 'legacy'`, and `select-seeds.ts` passes
 *      `settings.legacyScorer` straight through. So the A/B is the A/B a USER
 *      runs by flipping that setting — not two functions this tool invented.
 *      Measured twice: the Stage-1 ranking on its own (what the seeds are cut
 *      from) and end to end through `selectPprSeeds` (what the user gets,
 *      because a better Stage-1 ranking only matters if the walk carries it).
 *
 *   2. Where does the fusion sit? It is INSIDE `pprCascade`, which calls
 *      `maxFuse` on its lex and ppr channels (`src/core/ppr-cascade.ts`) and
 *      then `assembleWithCoverage`. There is no production setting that turns
 *      it off, so "PPR alone" is not an arm this tool can build without
 *      fabricating a score — and a fabricated score is how a wrong number
 *      looks right. The tool therefore does not measure it and says so.
 *      Answering it needs a seam in `pprCascade`, which is a code change with
 *      its own review, not a flag.
 *
 * The production input is the index, not the file tree. `read-index.ts` reads
 * `${wikiFolder}/index.md` and `parseIndexForPages` turns each line into a
 * `PageRef` whose `summary` is the index line's description — NOT the first
 * 200 characters of the body. Bodies arrive separately through `withBodies`.
 * A tool that reads the .md files directly and calls `body.slice(0, 200)` the
 * summary is measuring a different corpus than the one the plugin scores.
 *
 * Usage:
 *   npx tsx run-retrieval-ab.mjs <vaultDir> [options]
 *
 * Options:
 *   --out <file>        write the report to a file as well as stdout
 *   --exclude-asker     drop the asking page from the candidate set (#854 trap)
 *   --budget <n>        retrieval budget, default RETRIEVAL_BUDGET (20)
 *   --layer <ALL|CROSS> report only one layer
 *   --limit <n>         cap the questions, for a quick pass
 *   --mode <lex|e2e|both>
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { lexMatchByTitleAndAliases } from '../../src/core/ppr-cascade.ts';
import { segment } from '../../src/core/term-index.ts';
import { TermIndexCache } from '../../src/core/term-index-cache.ts';
import { parseIndexForPages } from '../../src/core/index-search.ts';
import { buildGraphFromContent } from '../../src/core/build-graph.ts';
import { readWikiIndex, withBodies } from '../../src/wiki/query-engine/pipeline/read-index.ts';
import { selectPprSeeds } from '../../src/wiki/query-engine/pipeline/select-seeds.ts';
import { EN_TEXTS } from '../../src/texts/en.ts';
import { RETRIEVAL_BUDGET } from '../../src/constants.ts';

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  const valueFlags = new Set(['out', 'budget', 'layer', 'limit', 'mode']);
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (valueFlags.has(key)) flags[key] = argv[++i];
      else flags[key] = true;
    } else positional.push(a);
  }
  return { vaultDir: positional[0], flags };
}

/**
 * Load the vault the way the plugin loads it: the index for the page list and
 * the summaries, the .md files for the bodies.
 *
 * `readWikiIndex` is production and needs a reader. A vault with no
 * `index.md` is not a vault the plugin can query, so the fallback here is a
 * loud one rather than a quiet guess: questions built from it are not the same
 * corpus production scores and the tool prints `index=absent`.
 */
async function loadVault(dir) {
  const reader = {
    tryReadFile: async p => (existsSync(join(dir, p)) ? readFileSync(join(dir, p), 'utf8') : null),
  };
  const indexResult = await readWikiIndex('', reader);
  const fromIndex = indexResult.pageRefs.length > 0;
  if (!fromIndex) {
    // Dev convenience for ad-hoc corpora. Production cannot run this path.
    for (const p of walkMarkdown(dir, dir)) {
      indexResult.pageRefs.push({
        path: p,
        title: p.split('/').pop(),
        aliases: [],
        summary: '',
      });
    }
    indexResult.allPaths = new Set(indexResult.pageRefs.map(p => p.path));
  }

  const bodies = new Map();
  const loaded = [];
  for (const ref of indexResult.pageRefs) {
    const file = join(dir, `${ref.path}.md`);
    if (!existsSync(file)) continue;
    const content = readFileSync(file, 'utf8');
    bodies.set(ref.path, content);
    loaded.push({ path: ref.path, content });
  }
  const graph = buildGraphFromContent(loaded, indexResult.allPaths, '');
  return { ...indexResult, bodies, graph, fromIndex };
}

function walkMarkdown(dir, root) {
  const out = [];
  const rel = p => p.slice(root.length + 1).replace(/\.md$/, '');
  const walk = d => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.md')) out.push(rel(p));
    }
  };
  walk(dir);
  return out.sort();
}

/**
 * Questions from the production graph's own edges. Deriving them from the
 * edges `buildGraphFromContent` produced is what keeps the question and the
 * measured path on the same link resolution — a question built from a
 * different resolver can ask about an edge the walk cannot take.
 *
 * A question is `(asker -> truth)` where the truth's own vocabulary is NOT in
 * the asker's, so the answer needs something other than string overlap.
 */
function buildQuestions(pages, graph) {
  const byPath = new Map(pages.map(p => [p.path, p]));
  const out = [];
  for (const [askerPath, targets] of graph.edges) {
    const a = byPath.get(askerPath);
    if (!a) continue;
    for (const truthPath of targets) {
      const b = byPath.get(truthPath);
      if (!b || b === a) continue;
      const bTerms = new Set(segment(`${b.title} ${b.summary ?? ''}`));
      if (bTerms.size === 0) continue;
      const aTerms = new Set(segment(`${a.title} ${a.summary ?? ''}`));
      const shared = [...bTerms].filter(t => aTerms.has(t)).length;
      if (shared / bTerms.size > 0.67) continue;
      const queryTerms = [...segment(a.summary ?? '')].filter(t => !bTerms.has(t));
      if (queryTerms.length < 1) continue;
      out.push({
        queryTerms,
        truthPath,
        askerPath,
        cross: a.sourceSlug !== b.sourceSlug,
      });
    }
  }
  return out;
}

/**
 * The Stage-1 channel on its own: the ranked name tier the seeds are cut from.
 * `select-seeds.ts` takes its top 5, so a channel that ranks the truth 6th
 * loses it before the walk starts.
 */
function rankStage1(query, refs, corpus, scorer) {
  const hits = lexMatchByTitleAndAliases(query, refs, {
    corpus,
    ...(scorer === 'legacy' ? { scorer: 'legacy' } : {}),
  });
  return hits.map(h => h.page.path);
}

/** The whole pipeline, no LLM client — the arm a user without a model gets. */
async function runProduction(query, refs, graph, cache, indexContent, scorer) {
  const result = await selectPprSeeds(
    query,
    refs,
    graph,
    undefined,
    { legacyScorer: scorer === 'legacy' },
    // `selectPprSeeds` formats its progress line eagerly, so this argument is
    // not optional in practice even though the type says it is. The real
    // English text, not a stand-in, so the `{count}` / `{pages}` shapes match.
    EN_TEXTS,
    undefined,
    { cache, indexContent },
  );
  return result.matches.map(m => m.page.path);
}

function tally() {
  return { ALL: [0, 0], CROSS: [0, 0] };
}

function note(t, q, ranked, budget) {
  const hit = ranked.indexOf(q.truthPath) >= 0 && ranked.indexOf(q.truthPath) < 10;
  t.ALL[1] += 1;
  if (hit) t.ALL[0] += 1;
  if (q.cross) {
    t.CROSS[1] += 1;
    if (hit) t.CROSS[0] += 1;
  }
  return hit;
}

// An empty layer must read as missing data, not as a score. `n === 0` printed
// as `0.000` is a zero the reader will quote.
const r10 = (t, layer) => (t[layer][1] === 0 ? 'n/a' : (t[layer][0] / t[layer][1]).toFixed(3));
const row = (label, t) => `  ${label} r@10 ALL = ${r10(t, 'ALL')} (n=${t.ALL[1]})   CROSS = ${r10(t, 'CROSS')} (n=${t.CROSS[1]})`;

async function main() {
  const { vaultDir, flags } = parseArgs(process.argv.slice(2));
  if (!vaultDir) {
    console.error('usage: run-retrieval-ab.mjs <vaultDir> [--out f] [--exclude-asker] [--budget n] [--layer ALL|CROSS] [--limit n] [--mode lex|e2e|both]');
    process.exit(1);
  }
  const budget = flags.budget ? Number(flags.budget) : RETRIEVAL_BUDGET;
  const excludeAsker = Boolean(flags['exclude-asker']);
  const layer = flags.layer ?? 'ALL';
  const limit = flags.limit ? Number(flags.limit) : Infinity;
  const mode = flags.mode ?? 'both';
  const out = [];

  const t0 = Date.now();
  const vault = await loadVault(vaultDir);
  let questions = buildQuestions(vault.pageRefs, vault.graph);
  if (layer === 'CROSS') questions = questions.filter(q => q.cross);
  questions = questions.slice(0, limit);

  const say = line => { console.log(line); out.push(line); };
  // `graph.edges.size` is the number of NODES, not the number of edges —
  // `buildGraphFromContent` seeds an empty array per node. Printing it as
  // "edges" makes a 351-page vault with no links at all look connected.
  const edgeCount = [...vault.graph.edges.values()].reduce((n, v) => n + v.length, 0);
  say(`vault=${basename(vaultDir)} pages=${vault.pageRefs.length} nodes=${vault.graph.nodes.length} edges=${edgeCount} questions=${questions.length} budget=${budget} excludeAsker=${excludeAsker} layer=${layer} index=${vault.fromIndex ? 'index.md' : 'ABSENT'}`);
  if (questions.length === 0) {
    say('No questions: the graph carries no resolvable edges, so there is no (asker -> truth) pair to ask about.');
    say('A vault with no index.md and no wiki-links is not a corpus this question set can measure.');
  }

  // Production name-tier tables, built once through the production cache.
  const cache = new TermIndexCache();
  const { corpus } = cache.getNameTier(vault.indexContent, vault.pageRefs);
  const retrievalRefs = withBodies(vault.pageRefs, vault.bodies);

  if (mode === 'lex' || mode === 'both') {
    say('\n=== STAGE 1: legacy scorer (A) vs BM25F (B) — seeds are the top 5 ===');
    const A = tally(); const B = tally();
    for (const q of questions) {
      const query = q.queryTerms.join(' ');
      const refs = excludeAsker
        ? retrievalRefs.filter(r => r.path !== q.askerPath)
        : retrievalRefs;
      const a = rankStage1(query, refs, corpus, 'legacy').slice(0, 5);
      const b = rankStage1(query, refs, corpus, 'bm25f').slice(0, 5);
      note(A, q, a, budget);
      note(B, q, b, budget);
    }
    say(row('A legacy', A));
    say(row('B BM25F  ', B));
  }

  if (mode === 'e2e' || mode === 'both') {
    say('\n=== END TO END through selectPprSeeds (no LLM client) ===');
    const A = tally(); const B = tally();
    for (const q of questions) {
      const query = q.queryTerms.join(' ');
      const refs = excludeAsker
        ? retrievalRefs.filter(r => r.path !== q.askerPath)
        : retrievalRefs;
      note(A, q, await runProduction(query, refs, vault.graph, cache, vault.indexContent, 'legacy'), budget);
      note(B, q, await runProduction(query, refs, vault.graph, cache, vault.indexContent, 'bm25f'), budget);
    }
    say(row('A legacy', A));
    say(row('B BM25F  ', B));
    say('Both arms are the shipped pipeline; the only difference is the setting a user flips.');
  }

  const crossQuestions = questions.filter(q => q.cross).length;
  if (crossQuestions === 0) {
    say('\nNOTE: the CROSS layer is empty. `cross` compares source slugs, and a slug');
    say('reaches PageRef only from the index line\'s `source:` marker. No index.md in');
    say('these vaults carries one, so production sees sourceSlug=undefined on every page');
    say('and `assembleWithCoverage`\'s source-diversity signal has nothing to act on.');
  }

  say('\n=== FUSION: not measured, and here is why ===');
  say('pprCascade calls maxFuse on its lex and ppr channels, then assembleWithCoverage.');
  say('No setting turns that off, so a "PPR alone" arm would need a score this tool made up.');
  say('Answering "does the lex channel help?" needs a seam in pprCascade, which is a code change.');

  say(`\nelapsed ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (flags.out) {
    writeFileSync(flags.out, out.join('\n') + '\n');
    console.error(`wrote ${flags.out}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
