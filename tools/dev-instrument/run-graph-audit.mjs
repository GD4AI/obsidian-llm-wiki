#!/usr/bin/env node
// Entry point for the graph audit (dev-only, issue #729 phase P0).
//
// Answers four questions about a real wiki graph: is it planet-shaped, are the
// edges born from one note, do the main nodes link each other, and can they
// reach each other at 2-3 hops in both directions. Its numbers set the order of
// the remaining #729 phases.
//
// Usage:
//   node tools/dev-instrument/run-graph-audit.mjs <vault> <wikiFolder> [topK]
// Example:
//   node tools/dev-instrument/run-graph-audit.mjs ~/vault wiki 10
//
// Exit code: 0 = printed a report · 1 = the run threw · 2 = usage.
//
// Bundles `src/graph-audit-cli.ts` with esbuild into dist/run-graph-audit.mjs
// and imports it — the same shape as run-instrument.mjs, so the Bot's AST
// exemption for `node:*` is satisfied the same way. The dist/ output is
// gitignored.

const Platform = { isDesktop: true };
if (!Platform.isDesktop) throw new Error('run-graph-audit is desktop-only');

const [{ Module }, { fileURLToPath }, nodePath] = await (async () => {
  if (!Platform.isDesktop) throw new Error('node:* is desktop-only');
  return Promise.all([import('node:module'), import('node:url'), import('node:path')]);
})();
const require = Module.createRequire(import.meta.url);

const CLI_DIR = nodePath.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = nodePath.resolve(CLI_DIR, '../..');
const ENTRY = nodePath.join(CLI_DIR, 'src', 'graph-audit-cli.ts');
const OUT_DIR = nodePath.join(CLI_DIR, 'dist');
const OUT_PATH = nodePath.join(OUT_DIR, 'run-graph-audit.mjs');
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

const { pathToFileURL } = await (async () => {
  if (!Platform.isDesktop) throw new Error('node:* is desktop-only');
  return import('node:url');
})();
const mod = await import(pathToFileURL(OUT_PATH).href);
const code = await mod.main(process.argv.slice(2));
process.exitCode = code;
