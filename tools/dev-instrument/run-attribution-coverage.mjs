#!/usr/bin/env node
/**
 * #819 step 5 — measure, do not implement.
 *
 * The hypothesis: an unattributed wiki page that a `sources/` page links to can
 * inherit that source. The old vault's star shape means source pages have real
 * outlinks, and an outlink is evidence rather than a guess.
 *
 * This measures the coverage of that evidence before anyone builds on it. Two
 * numbers decide whether the idea is worth an implementation:
 *
 *   coverage  — share of unattributed pages with at least one source-page inlink
 *   ambiguity — among those, the share with inlinks from MORE THAN ONE source
 *
 * High coverage and low ambiguity means the back-fill is a real fix. Low
 * coverage means it changes little. High ambiguity means it would invent
 * groupings, which is the thing the `sources:` marker deliberately refuses to
 * do.
 *
 * Usage:
 *   npx tsx tools/dev-instrument/run-attribution-coverage.mjs <wikiDir>
 */
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, basename } from 'node:path';

function slugFromFrontmatter(text) {
  const m = /^sources:\s*(.+)$/m.exec(text);
  if (!m) return undefined;
  const inner = /\[\[sources\/([^|\]]+)(?:\|[^\]]+)?\]\]/.exec(m[1]);
  return inner ? inner[1].trim() : undefined;
}

/** Every [[target]] in the body, as a bare name. */
function outlinks(text) {
  const out = new Set();
  const re = /\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const t = m[1].trim();
    if (t) out.add(t);
  }
  return out;
}

async function load(dir) {
  const pages = [];
  const walk = async (folder) => {
    for (const e of await readdir(folder, { withFileTypes: true })) {
      const p = join(folder, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.name.endsWith('.md')) {
        const text = await readFile(p, 'utf8').catch(() => '');
        const rel = relative(dir, p).replace(/\.md$/, '');
        pages.push({
          key: rel,
          name: basename(rel),
          isSource: rel.replace(/\\/g, '/').startsWith('sources/'),
          sourceSlug: slugFromFrontmatter(text),
          links: outlinks(text),
        });
      }
    }
  };
  await walk(dir);
  return pages;
}

const dir = process.argv[2];
if (!dir) { console.error('usage: run-attribution-coverage.mjs <wikiDir>'); process.exit(1); }

const pages = await load(dir);
const attributed = pages.filter(p => p.sourceSlug !== undefined);
const unattributed = pages.filter(p => p.sourceSlug === undefined);
const sourcePages = pages.filter(p => p.isSource);

console.log(`\nVault ${dir}`);
console.log(`  pages ${pages.length} · attributed ${attributed.length} (${(attributed.length / pages.length * 100).toFixed(1)}%) · unattributed ${unattributed.length} · source pages ${sourcePages.length}`);

// source-page name -> the slug it stands for. A page under sources/ is its own
// slug by filename, which is the convention the ingest path writes.
const slugOfSourcePage = (p) => p.key.split('/').pop();

// Build the reverse index: wiki-page name -> set of source slugs linking to it.
const inlinks = new Map();
for (const sp of sourcePages) {
  const slug = slugOfSourcePage(sp);
  for (const target of sp.links) {
    if (!inlinks.has(target)) inlinks.set(target, new Set());
    inlinks.get(target).add(slug);
  }
}

let covered = 0, ambiguous = 0, unique = 0, total = 0;
const buckets = new Map();
for (const p of unattributed) {
  total += 1;
  const srcs = inlinks.get(p.name) ?? inlinks.get(p.key);
  if (!srcs || srcs.size === 0) continue;
  covered += 1;
  buckets.set(srcs.size, (buckets.get(srcs.size) ?? 0) + 1);
  if (srcs.size > 1) ambiguous += 1;
  else unique += 1;
}

console.log('\n=== Coverage of the source-page inlink evidence ===');
console.log(`  unattributed pages measured   ${total}`);
console.log(`  with >=1 source-page inlink   ${covered}  (${total ? (covered / total * 100).toFixed(1) : '0.0'}%)`);
console.log(`    exactly one source          ${unique}  (${covered ? (unique / covered * 100).toFixed(1) : '0.0'}% of covered)`);
console.log(`    more than one source        ${ambiguous}  (${covered ? (ambiguous / covered * 100).toFixed(1) : '0.0'}% of covered)  <- would invent a grouping`);
console.log('\n  inlink-count distribution among covered pages:');
for (const [k, v] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
  console.log(`    ${String(k).padStart(2)} source(s): ${v}`);
}

// Body citations. A page whose body quotes `[[sources/x]]` — the "Mentions in
// Source" block the ingest writes — is citing its source directly. That is
// stronger evidence than a source page's outlink. Measuring it here decides
// which back-fill is worth building.
let bodyUnique = 0, bodyAmbig = 0, bodyNone = 0;
for (const p of unattributed) {
  const text = await readFile(join(dir, `${p.key}.md`), 'utf8').catch(() => '');
  const found = new Set();
  const re2 = /\[\[sources\/([^|\]]+)(?:\|[^\]]+)?\]\]/g;
  let mm;
  while ((mm = re2.exec(text)) !== null) found.add(mm[1].trim());
  if (found.size === 0) bodyNone += 1;
  else if (found.size === 1) bodyUnique += 1;
  else bodyAmbig += 1;
}
console.log('\n=== Evidence in the page BODY — `[[sources/x]]` citations ===');
console.log(`  exactly one source          ${bodyUnique}  (${total ? (bodyUnique / total * 100).toFixed(1) : '0.0'}% of unattributed)`);
console.log(`  more than one source        ${bodyAmbig}  (${total ? (bodyAmbig / total * 100).toFixed(1) : '0.0'}%)  <- would invent a grouping`);
console.log(`  no citation                 ${bodyNone}  (${total ? (bodyNone / total * 100).toFixed(1) : '0.0'}%)`);

// The whole-vault impact: what would attribution reach if the back-fill ran?
const reachBody = attributed.length + bodyUnique;
const reachBoth = attributed.length + Math.max(unique, bodyUnique);
console.log('\n=== If the back-fill ran, accepting only single-source evidence ===');
console.log(`  attributed today              ${attributed.length}  (${(attributed.length / pages.length * 100).toFixed(1)}%)`);
console.log(`  + source-page inlinks         ${attributed.length + unique}  (${((attributed.length + unique) / pages.length * 100).toFixed(1)}%)`);
console.log(`  + body citations              ${reachBody}  (${(reachBody / pages.length * 100).toFixed(1)}%)`);
console.log(`  + both                        ${reachBoth}  (${(reachBoth / pages.length * 100).toFixed(1)}%)`);
console.log(`  still unknown                 ${pages.length - reachBoth}  (${((pages.length - reachBoth) / pages.length * 100).toFixed(1)}%)`);
