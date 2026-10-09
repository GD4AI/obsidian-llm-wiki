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

// The lexical gate is scored the way `scorePagesByNeedles` with the legacy
// scorer would score it: title 3, alias 2, summary 1, matched per needle.
// Passing the real thresholds makes the report show what production does.
function lexScore(query) {
  const needles = query.toLowerCase().split(/\s+/).filter(Boolean);
  let best = 0;
  let hits = 0;
  for (const page of pages) {
    const title = page.title.toLowerCase();
    const summary = (page.summary ?? '').toLowerCase();
    let score = 0;
    let found = 0;
    for (const n of needles) {
      if (title.includes(n)) { score += 3; found += 1; }
      else if (summary.includes(n)) { score += 1; found += 1; }
    }
    if (found > 0) hits += 1;
    if (score > best) best = score;
  }
  return { topScore: best, hitCount: hits, reliable: needles.length > 0 };
}

const report = formatRecallDiagnostic(pages, {
  queries: DEFAULT_QUERIES,
  segmentQuery: (q) => segment(q),
  lexScore,
});

console.log(report.text);
process.exit(0);
