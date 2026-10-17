#!/usr/bin/env npx tsx
/**
 * run-regenerate-index.mjs — rebuild a vault's `index.md` with the production
 * generator, so the retrieval tools can measure against the index the plugin
 * would produce today.
 *
 * WHY THIS EXISTS. #855's cross-source measurement was reported as missing and I
 * first described it as needing a generator change. It does not. The generator
 * writes the `` `source: <slug>` `` marker into every index line
 * (`index-generator.ts`, from `parseSourceSlug`, which reads
 * `[[sources/<slug>]]` out of page frontmatter), and all 129 of test8's concept
 * pages carry that frontmatter across 10 distinct sources. Its `index.md` is
 * simply STALE — generated before that wiring landed.
 *
 * A stale index means `PageRef.sourceSlug` is `undefined` on every page, so
 * `assembleWithCoverage`'s source-diversity signal has nothing to act on and the
 * CROSS layer has zero questions. Every cross-source figure quoted for these
 * vaults is therefore `n=0` — not a score, and not evidence either way.
 *
 * THE GENERATOR IS THE PRODUCTION ONE. `IndexGenerator` is constructed directly.
 * The only shim is the `TFile` argument: the class reads exactly two fields off
 * it, `path` and `basename`, so the shim is an Obsidian API object shaped to
 * what the class actually touches — not a reimplementation of the rendering.
 * Reimplementing that is the drift this track just spent a session removing.
 *
 * The vault is never written to. `writeFile` is intercepted and the index goes
 * to `--out`, so measuring a corpus cannot mutate it.
 *
 * Usage:
 *   npx tsx run-regenerate-index.mjs <vaultDir> --out <indexPath>
 *       [--wiki-folder <name>]   default '' (pages live at the vault root)
 *       [--language <code>]      default 'en'
 *
 * Then:
 *   npx tsx run-expansion-eval.mjs <vaultDir> --index <indexPath> --layer CROSS
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { IndexGenerator } from '../../src/wiki/engine-internals/index-generator.ts';

const args = process.argv.slice(2);
const vaultDir = args.find(a => !a.startsWith('--'));
const valueOf = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const outPath = valueOf('out', null);
const wikiFolder = valueOf('wiki-folder', '');
const wikiLanguage = valueOf('language', 'en');

if (!vaultDir || !outPath) {
  console.error('usage: run-regenerate-index.mjs <vaultDir> --out <indexPath> [--wiki-folder n] [--language code]');
  process.exit(1);
}

// The two fields `IndexGenerator` reads. Obsidian supplies the rest, and a
// plain object with these two keys is what the class actually touches.
const root = wikiFolder ? join(vaultDir, wikiFolder) : vaultDir;

function collect(folder) {
  const dir = join(root, folder);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter(e => e.isFile() && e.name.endsWith('.md'))
    .map(e => ({
      // Vault-relative with the extension, which is what `readFile` is given
      // and what the generator caches on.
      path: wikiFolder ? join(wikiFolder, folder, e.name) : join(folder, e.name),
      // Obsidian's `basename` is the filename without its extension.
      basename: e.name.replace(/\.md$/, ''),
    }))
    .sort((a, b) => (a.path < b.path ? -1 : 1));
}

const entities = collect('entities');
const concepts = collect('concepts');
const sources = collect('sources');

let written = '';
const generator = new IndexGenerator({
  wikiFolder,
  wikiLanguage,
  readFile: async file => readFileSync(join(vaultDir, file.path), 'utf8'),
  // Intercepted: the vault is never touched.
  writeFile: async (_path, content) => { written = content; },
});

await generator.generateFlatIndex(entities, concepts, sources);

writeFileSync(outPath, written);

// The self-check that matters. A regenerated index with no `source:` marker
// leaves every page's `sourceSlug` undefined, the CROSS layer empty, and any
// number reported against it meaningless — which is exactly the state that was
// mistaken for "unmeasurable".
const lines = written.split('\n').filter(l => l.startsWith('- [['));
const withSource = lines.filter(l => /`source:\s*[^`]+`/.test(l));
const slugs = new Set(
  withSource.map(l => /`source:\s*([^`]+)`/.exec(l)?.[1]?.trim()).filter(Boolean),
);

console.log(`vault=${basename(vaultDir)} wikiFolder=${wikiFolder || '(root)'}`);
console.log(`pages: entities=${entities.length} concepts=${concepts.length} sources=${sources.length} total=${lines.length}`);
console.log(`index lines carry \`source:\`: ${withSource.length} of ${lines.length} (${((withSource.length / Math.max(1, lines.length)) * 100).toFixed(1)}%)`);
console.log(`distinct source slugs: ${slugs.size}`);
console.log(`wrote ${outPath}`);
if (withSource.length === 0) {
  console.log('WARNING: no source markers. The CROSS layer will have zero questions and any figure against this index is meaningless.');
}
