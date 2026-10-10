#!/usr/bin/env node
/**
 * #819 step 4 — calibrate the assembly layer's coverage penalty strength.
 *
 * `assembleWithCoverage` divides a page's score by `1 + lambda * takenFromItsSource`.
 * The form is fixed but its strength is set implicitly by the score scale, so
 * lambda is a real constant and it must be measured rather than assumed.
 *
 * This scans lambda and reports BOTH sides of the trade-off:
 *
 *   - evidence-page recall@K — does the right page still load?  (synthetic only)
 *   - distinct sources / dominant share — did the diversity actually move?
 *
 * A lambda that maximises source count while destroying recall is not a win.
 * That is the measurement error the review caught: the rule optimises source
 * count, and I measured source count.
 *
 * Usage:
 *   npx tsx tools/dev-instrument/run-lambda-scan.mjs                 # synthetic
 *   npx tsx tools/dev-instrument/run-lambda-scan.mjs <wikiDir>       # real vault
 */
import { hardFixtures, builtInFixtures } from '../../src/core/recall-fixtures.ts';
import { assembleWithCoverage } from '../../src/core/assembly.ts';
import {
  buildPageTerms, buildCorpusTerms, bm25fScore, segment,
  DEFAULT_FIELD_WEIGHTS,
} from '../../src/core/term-index.ts';
import { readWikiIndex } from '../../src/wiki/query-engine/pipeline/read-index.ts';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Source slug from a page's own frontmatter. The wiki index carries a
 * `source:` marker only when it was written by the current generator, so a vault
 * indexed earlier reports every page as unattributed and the scan measures
 * nothing. Reading the page is the honest fallback until that index is
 * regenerated.
 */
function slugFromFrontmatter(text) {
  const m = /^sources:\s*(.+)$/m.exec(text);
  if (!m) return undefined;
  const inner = /\[\[sources\/([^\]|]+)(?:\|[^\]]+)?\]\]/.exec(m[1]);
  return inner ? inner[1].trim() : undefined;
}

async function loadSlugs(dir) {
  const slugs = new Map();
  const walk = async (folder) => {
    for (const e of await readdir(folder, { withFileTypes: true })) {
      const p = join(folder, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.name.endsWith('.md')) {
        const slug = slugFromFrontmatter(await readFile(p, 'utf8').catch(() => ''));
        if (slug !== undefined) slugs.set(p, slug);
      }
    }
  };
  await walk(dir);
  return slugs;
}

const LAMBDAS = [0, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5];
// The synthetic corpora hold 13 and 6 pages. A budget of 10 takes everything
// and the scan reports recall 1.000 for every lambda, which measures nothing.
// The budget must be small enough that the pick is a choice.
const SYNTH_BUDGET = 3;
const BUDGET = 10;

function scanSynthetic(label, fixFn) {
  const { pages, fixtures } = fixFn();
  const pts = pages.map(p => buildPageTerms({
    title: p.title, aliases: p.aliases, summary: p.summary ?? '', text: '',
  }));
  const corpus = buildCorpusTerms(pts);

  // Per query, rank by BM25F and hand the ranked list to the assembly layer.
  const perQuery = fixtures.map((f, i) => {
    const terms = segment(f.query);
    const scored = pts.map((pt, j) => ({ item: { key: pages[j].path, sourceSlug: pages[j].sourceSlug }, score: bm25fScore(terms, pt, corpus, DEFAULT_FIELD_WEIGHTS) }));
    scored.sort((a, b) => b.score - a.score);
    return { fixture: f, candidates: scored };
  });

  console.log(`\n=== ${label} — synthetic, ${fixtures.length} queries, budget ${SYNTH_BUDGET} ===`);
  console.log(`lambda  recall@${SYNTH_BUDGET}  sources  dom-attr`);
  console.log('------  ---------  -------  --------');
  for (const lambda of LAMBDAS) {
    let recall = 0, sources = 0, dom = 0;
    for (const { fixture, candidates } of perQuery) {
      const r = assembleWithCoverage(candidates, SYNTH_BUDGET, { lambda });
      const pickedPaths = r.picked.map(p => p.item.key);
      const hits = fixture.relevant.filter(x => pickedPaths.includes(x)).length;
      recall += fixture.relevant.length > 0 ? hits / fixture.relevant.length : 0;
      sources += r.pickedSources;
      dom += r.dominantShare;
    }
    const n = perQuery.length;
    console.log(`${String(lambda).padStart(6)}  ${(recall / n).toFixed(3).padStart(9)}  ${(sources / n).toFixed(2).padStart(7)}  ${(dom / n * 100).toFixed(0).padStart(6)}%`);
  }
}

async function scanVault(dir) {
  const reader = { tryReadFile: (p) => readFile(p, 'utf8').catch(() => null) };
  const { pageRefs } = await readWikiIndex(dir, reader);
  if (pageRefs.length === 0) { console.log('  no index found'); return; }

  // Fill sourceSlug from page frontmatter where the index has none.
  const slugs = await loadSlugs(dir);
  let attributed = 0;
  for (const p of pageRefs) {
    if (p.sourceSlug === undefined) {
      const s = slugs.get(join(dir, `${p.path}.md`));
      if (s !== undefined) p.sourceSlug = s;
    }
    if (p.sourceSlug !== undefined) attributed += 1;
  }
  console.log(`  attribution: ${attributed}/${pageRefs.length} pages (${(attributed / pageRefs.length * 100).toFixed(1)}%)`);

  const pts = pageRefs.map(p => buildPageTerms({ title: p.title, aliases: p.aliases, summary: p.summary ?? '', text: '' }));
  const corpus = buildCorpusTerms(pts);
  const queries = ['强化学习 推理能力', 'deepseek 模型', '模型 并行 训练', '注意力机制', 'LSTM 架构', '训练 数据'];

  console.log(`\n=== ${dir} — ${pageRefs.length} pages, budget ${BUDGET} ===`);
  console.log('lambda  sources  dom-attr  bare/query');
  console.log('------  -------  --------  ----------');
  for (const lambda of LAMBDAS) {
    let sources = 0, dom = 0, bare = 0;
    for (const q of queries) {
      const terms = segment(q);
      const scored = pts.map((pt, j) => ({ item: { key: pageRefs[j].path, sourceSlug: pageRefs[j].sourceSlug }, score: bm25fScore(terms, pt, corpus, DEFAULT_FIELD_WEIGHTS) }));
      scored.sort((a, b) => b.score - a.score);
      const r = assembleWithCoverage(scored, BUDGET, { lambda });
      sources += r.pickedSources;
      dom += r.dominantShare;
      bare += r.picked.filter(p => p.sourceSlug === null).length;
    }
    const n = queries.length;
    console.log(`${String(lambda).padStart(6)}  ${(sources / n).toFixed(2).padStart(7)}  ${(dom / n * 100).toFixed(0).padStart(7)}%  ${(bare / n).toFixed(1).padStart(10)}`);
  }
}

const arg = process.argv[2];
if (arg) {
  await scanVault(arg);
} else {
  scanSynthetic('HARD', hardFixtures);
  scanSynthetic('EASY', builtInFixtures);
}
