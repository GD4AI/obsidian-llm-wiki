#!/usr/bin/env node
// Entry point for the recall diagnostic (dev-only, issue #729 phase 3).
//
// Answers four questions about a real vault: how concentrated is term
// frequency, how many sources does the candidate window hold against what
// actually loads, how often does the lexical gate send the query to the LLM,
// and does the scorer agree with ground truth. The last one has no answer on a
// real vault and says so rather than printing a zero.
//
// Usage:
//   node tools/dev-instrument/run-recall-harness.mjs <vault> <wikiFolder> [query ...]
// Example:
//   node tools/dev-instrument/run-recall-harness.mjs ~/vault wiki "强化学习 推理能力"
//
// Exit code: 0 = printed a report · 1 = the run threw · 2 = usage.
//
// Bundles `src/recall-diagnostic-cli.ts` with esbuild into dist/, the same
// shape as run-graph-audit.mjs and run-instrument.mjs, so the Bot's AST
// exemption for `node:*` is satisfied the same way. The dist/ output is
// gitignored.

const Platform = { isDesktop: true };
if (!Platform.isDesktop) throw new Error('run-recall-harness is desktop-only');

const [{ Module }, { fileURLToPath }, nodePath] = await (async () => {
  if (!Platform.isDesktop) throw new Error('node:* is desktop-only');
  return Promise.all([import('node:module'), import('node:url'), import('node:path')]);
})();
const require = Module.createRequire(import.meta.url);

const CLI_DIR = nodePath.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = nodePath.resolve(CLI_DIR, '../..');
const ENTRY = nodePath.join(CLI_DIR, 'src', 'recall-diagnostic-cli.ts');
const OUT_DIR = nodePath.join(CLI_DIR, 'dist');
const OUT_PATH = nodePath.join(OUT_DIR, 'run-recall-harness.mjs');
const SHIM = nodePath.join(CLI_DIR, 'src', 'shim.ts');

const esbuild = require('esbuild');

const obsidianShimPlugin = {
  name: 'obsidian-shim',
  setup(build) {
    build.onResolve({ filter: /^obsidian$/ }, () => ({ path: SHIM }));
  },
};

await esbuild.build({
  entryPoints: [ENTRY],
  outfile: OUT_PATH,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: 'inline',
  logLevel: 'warning',
  absWorkingDir: PLUGIN_ROOT,
  plugins: [obsidianShimPlugin],
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module';\nconst require = __createRequire(import.meta.url);",
  },
});

const [, , vaultArg, wikiFolderArg, ...queries] = process.argv;
if (!vaultArg || !wikiFolderArg) {
  console.error('Usage: node tools/dev-instrument/run-recall-harness.mjs <vault> <wikiFolder> [query ...]');
  process.exit(2);
}

const { readdirSync, readFileSync, statSync } = await import('node:fs');
const { join, relative } = nodePath;

const wikiRoot = join(vaultArg, wikiFolderArg);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.md')) out.push(full);
  }
  return out;
}

function frontmatterOf(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  return m ? m[1] : '';
}

function bodyOf(text) {
  const m = text.match(/^---\n[\s\S]*?\n---\n?/);
  return m ? text.slice(m[0].length) : text;
}

function firstBodyLine(text) {
  return bodyOf(text)
    .split('\n')
    .find(l => l.trim() && !l.startsWith('#') && !l.startsWith('---'))
    ?.slice(0, 100) ?? '';
}

function sourceSlugOf(fm) {
  // Matches the wikilink wherever it sits, not the line shape. The frontmatter
  // has two written forms — inline `sources: [[sources/x]]` and the block form
  // `sources:\n  - "[[sources/x]]"` — and matching `sources:` plus the target
  // on one line reported 100 % unattributed on a corpus that is 97 %
  // attributed. Measured before the fix.
  const m = fm.match(/\[\[sources\/([^\]\s,|]+)/);
  return m ? m[1] : undefined;
}

const files = walk(wikiRoot);
const pages = files.map((file) => {
  const text = readFileSync(file, 'utf8');
  const fm = frontmatterOf(text);
  const title = (text.match(/^# (.+)$/m) ?? ['', relative(wikiRoot, file)])[1].trim();
  return {
    path: relative(vaultArg, file),
    title,
    aliases: [],
    summary: firstBodyLine(text),
    body: bodyOf(text),
    ...(sourceSlugOf(fm) ? { sourceSlug: sourceSlugOf(fm) } : {}),
  };
});

const { formatRecallDiagnostic, segment } = await import(OUT_PATH);

const DEFAULT_QUERIES = queries.length > 0 ? queries : [
  '强化学习 推理能力',
  'model parallel training',
  'deepseek',
];

// The lexical gate is scored the way production scores it now: the name tier's
// share of the query's total IDF, which is a ratio in [0, 1] and has no scale
// to drift against. The old version of this block computed title 3 / summary 1
// and reported 100 % escalation on this corpus — which was true of the old gate
// and became misleading the moment production moved.
function lexScore(query) {
  const terms = segment(query);
  const unique = [...new Set(terms)];
  const df = new Map();
  for (const page of pages) {
    const seen = new Set(segment(`${page.title} ${(page.aliases ?? []).join(' ')} ${page.summary ?? ''}`));
    for (const t of seen) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const N = pages.length || 1;
  let best = 0;
  let hits = 0;
  for (const page of pages) {
    const nameTier = new Set(segment(`${page.title} ${(page.aliases ?? []).join(' ')}`));
    let total = 0;
    let matched = 0;
    for (const t of unique) {
      const d = df.get(t) ?? 0;
      if (d === 0) continue;
      const idf = Math.log(1 + (N - d + 0.5) / (d + 0.5));
      total += idf;
      if (nameTier.has(t)) matched += idf;
    }
    const coverage = total > 0 ? matched / total : 0;
    if (coverage > 0) hits += 1;
    if (coverage > best) best = coverage;
  }
  return { strength: best, hitCount: hits, reliable: unique.length > 0 };
}

const report = formatRecallDiagnostic(pages, {
  queries: DEFAULT_QUERIES,
  segmentQuery: (q) => segment(q),
  lexScore,
});

console.log(report.text);
process.exit(0);
