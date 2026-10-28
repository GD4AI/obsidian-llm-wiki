// Measure the cost of one answer's context on a real vault.
//
// The path is the production path, in the production order:
//
//   parseIndexForPages → buildGraphFromContent → selectPprSeeds
//     → loadRelevantPagesForQuery → assembleWikiContext
//
// Nothing here re-implements an algorithm. The point is to measure what the
// plugin actually sends, so the numbers can be compared against a model's
// context window rather than against a guess.
//
// Usage:
//   npx tsx tools/dev-instrument/run-context-cost.mjs \
//     --vault "/path/to/Vault" --wiki-folder wiki --cases 30
//
//   --dump <dir>   write each case's assembled context to <dir>/<n>.txt, so a
//                  tokenizer can count the real text instead of an estimate.
//
// Token counting is deliberately NOT in this script: a tokenizer is a
// dependency the plugin does not have, and a per-character ratio is a
// different measurement than a token count. Dump the text and count it with
// the tokenizer the provider uses (`tiktoken`'s `o200k_base` for OpenAI).
//
// The LLM client is not passed to `selectPprSeeds`, so this measures the
// lexical+PPR arm. The LLM arm picks a different seed set and can load a
// different number of pages; the page count is the same cap either way.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { parseIndexForPages } from '../../src/core/index-search.ts';
import { buildGraphFromContent } from '../../src/core/build-graph.ts';
import { withBodies } from '../../src/wiki/query-engine/pipeline/read-index.ts';
import { selectPprSeeds } from '../../src/wiki/query-engine/pipeline/select-seeds.ts';
import { loadRelevantPagesForQuery } from '../../src/wiki/query-engine/pipeline/load-pages.ts';
import { assembleWikiContext } from '../../src/wiki/query-engine/pipeline/assemble-context.ts';
import { formatPageRefSummary } from '../../src/core/ppr-cascade.ts';
import { EN_TEXTS } from '../../src/texts/en.ts';
import { getSectionLabels } from '../../src/wiki/system-prompts.ts';

function flag(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const VAULT = flag('vault', null);
const WIKI_FOLDER = flag('wiki-folder', 'wiki');
const CASES = Number(flag('cases', 30)) || 30;
const DUMP = flag('dump', null);
const WIKI_LANGUAGE = flag('wiki-language', 'zh');

if (!VAULT || typeof VAULT !== 'string') {
  console.error('usage: npx tsx tools/dev-instrument/run-context-cost.mjs --vault <dir> [--wiki-folder <name>] [--cases <n>] [--dump <dir>]');
  process.exit(1);
}

const dir = join(VAULT, WIKI_FOLDER);
const indexPath = join(dir, 'index.md');
if (!existsSync(indexPath)) {
  console.error(`no wiki index at ${indexPath}`);
  process.exit(1);
}

const indexContent = readFileSync(indexPath, 'utf8');
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

// Equidistant sampling over the page list. The first n pages would be a
// biased sample of whatever the index happens to order first.
const step = Math.max(1, Math.floor(refs.length / CASES));
const targets = [];
for (let i = 0; i < refs.length && targets.length < CASES; i += step) {
  const r = refs[i];
  if (r && r.title) targets.push(r);
}

const reader = {
  async tryReadFile(p) {
    const f = join(VAULT, p);
    return existsSync(f) ? readFileSync(f, 'utf8') : null;
  },
};

// The wiki language decides the section labels the summary extractor looks
// for. A mismatch makes every page fall back to the full-text path, which is
// a different (and larger) measurement than production.
const sectionLabels = getSectionLabels({ wikiLanguage: WIKI_LANGUAGE });

const results = [];
for (const target of targets) {
  const sel = await selectPprSeeds(
    target.title,
    refs,
    graph,
    undefined,
    { model: 'none' },
    EN_TEXTS,
    undefined,
  );
  const paths = sel.matches.map(m => m.page.path);
  const pageBodies = await loadRelevantPagesForQuery(
    paths,
    WIKI_FOLDER,
    reader,
    sectionLabels,
  );
  const pageSummaryHint = pageRefs.length > 0
    ? pageRefs.slice(0, 50).map(p => formatPageRefSummary(p)).join('\n')
    : undefined;
  const ctx = assembleWikiContext({
    pageSummaryHint,
    pageBodies,
    armLabel: sel.armLabel,
    llmAugmented: sel.llmAugmented,
    pureLLM: sel.pureLLM,
    matchesCount: paths.length,
    wikiFolder: WIKI_FOLDER,
    wikiLanguage: WIKI_LANGUAGE,
  });

  if (DUMP && typeof DUMP === 'string') {
    mkdirSync(DUMP, { recursive: true });
    writeFileSync(join(DUMP, `${results.length}.txt`), ctx, 'utf8');
  }

  results.push({
    target: target.path,
    nPages: pageBodies.length,
    bodyChars: pageBodies.reduce((a, b) => a + b.length, 0),
    ctxChars: ctx.length,
  });
}

const sorted = k => results.map(r => r[k]).sort((a, b) => a - b);
const q = (arr, p) => arr[Math.min(arr.length - 1, Math.floor(arr.length * p))];
const bodyChars = sorted('bodyChars');
const ctxChars = sorted('ctxChars');

console.log(JSON.stringify({
  vault: `${VAULT}/${WIKI_FOLDER}`,
  wikiLanguage: WIKI_LANGUAGE,
  pages: refs.length,
  cases: results.length,
  pagesPerCase: {
    min: Math.min(...results.map(r => r.nPages)),
    max: Math.max(...results.map(r => r.nPages)),
  },
  bodyChars: {
    p50: q(bodyChars, 0.5), p90: q(bodyChars, 0.9), max: bodyChars[bodyChars.length - 1],
    mean: Math.round(results.reduce((a, r) => a + r.bodyChars, 0) / results.length),
  },
  ctxChars: {
    p50: q(ctxChars, 0.5), p90: q(ctxChars, 0.9), max: ctxChars[ctxChars.length - 1],
    mean: Math.round(results.reduce((a, r) => a + r.ctxChars, 0) / results.length),
  },
  perCase: results,
}, null, 1));
