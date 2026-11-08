#!/usr/bin/env node
// Entry point for the exact-value survival count (dev-only, issue #910).
//
// The question: when a note states a price, a date, a specification or a model
// number, does that value reach the wiki page, and in which form — quoted
// verbatim, folded into condensed prose, or not at all?
//
// Two claims about ingest fidelity were argued from prompt text before this
// existed, and they contradicted each other ("source pages are precise" /
// "source pages contain no details"). This prints the number that settles it.
//
// Usage:
//   node tools/dev-instrument/run-value-survival.mjs <vault> <wikiFolder>
//   node tools/dev-instrument/run-value-survival.mjs --self-check
// Example:
//   node tools/dev-instrument/run-value-survival.mjs ~/vault test10
//
// `--self-check` runs the masking and harvesting over the fixture in
// `fixtures/value-survival-note.md`, so the instrument can be exercised with no
// vault and no model.
//
// Exit code: 0 = printed a report · 1 = the run threw · 2 = usage.
//
// Bundles `src/value-survival-cli.ts` with esbuild into
// dist/run-value-survival.mjs and imports it — the same shape as
// run-instrument.mjs, so the Bot's AST exemption for `node:*` is satisfied the
// same way. The dist/ output is gitignored.

const Platform = { isDesktop: true };
if (!Platform.isDesktop) throw new Error('run-value-survival is desktop-only');

const [{ Module }, { fileURLToPath }, nodePath] = await (async () => {
  if (!Platform.isDesktop) throw new Error('node:* is desktop-only');
  return Promise.all([import('node:module'), import('node:url'), import('node:path')]);
})();
const require = Module.createRequire(import.meta.url);

const CLI_DIR = nodePath.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = nodePath.resolve(CLI_DIR, '../..');
const ENTRY = nodePath.join(CLI_DIR, 'src', 'value-survival-cli.ts');
const OUT_DIR = nodePath.join(CLI_DIR, 'dist');
const OUT_PATH = nodePath.join(OUT_DIR, 'run-value-survival.mjs');
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
// eslint-disable-next-line no-unsanitized/method -- OUT_PATH is a hardcoded local constant (the bundle this script just built), not user input
const mod = await import(pathToFileURL(OUT_PATH).href);
const code = await mod.main(process.argv.slice(2));
process.exitCode = code;
