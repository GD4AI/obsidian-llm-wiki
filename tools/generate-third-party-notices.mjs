// Issue #699 — generate THIRD-PARTY-NOTICES.md from the shipped bundle.
//
// Mechanical on purpose. A hand-maintained list drifts, and the drift is silent:
// the file stays present and plausible while a new transitive dependency goes
// unattributed. Counting by hand for this repository gave ten packages; the
// artifact carries twelve, and the two missed (`@vercel/oidc`,
// `eventsource-parser`) are transitive two levels down from anything
// `package.json` names.
//
// **The bundle is the authority.** `esbuild.config.mjs` marks `obsidian`,
// `electron`, the CodeMirror/Lezer packages and Node builtins as external, but
// which of the rest reaches `main.js` is decided by what the entry point imports
// — so the set is read from the markers esbuild emits into the artifact rather
// than re-derived from the manifest. Run `pnpm build` first.
//
//   node tools/generate-third-party-notices.mjs          # write the file
//   node tools/generate-third-party-notices.mjs --check  # fail if it is stale

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..');

/**
 * pnpm encodes a package into one directory name under `.pnpm/`:
 * `@scope+name@version`, optionally followed by `_<peer-suffix>`. The version
 * separator is the **last** `@` before the first `_`; the leading one belongs to
 * the scope.
 *
 * Parsing this rather than listing the directory's children matters: that
 * directory holds the package **and symlinks to its dependencies**, so anything
 * that takes "the entry inside it" can return a dependency instead. Reading
 * `@ai-sdk/provider`'s version that way yields `0.4.0` and an
 * `(AFL-2.1 OR BSD-3-Clause)` licence — a different package's.
 */
export function parsePnpmDir(dir) {
  const head = dir.split('_')[0];
  const at = head.lastIndexOf('@');
  return { name: head.slice(0, at).replace('+', '/'), version: head.slice(at + 1) };
}

/** The `.pnpm/<dir>/...` markers esbuild emits before each inlined module. */
export function bundledPackageDirs(source) {
  return [...new Set([...source.matchAll(/^\/\/ node_modules\/\.pnpm\/([^/]+)\//gm)].map(m => m[1]))];
}

const LICENCE_FILES = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'LICENSE-MIT', 'LICENSE-APACHE'];

/** Where a package lives inside the virtual store, from its encoded dir name. */
function packageDirIn(root, dir, name) {
  const base = join(root, 'node_modules', '.pnpm', dir, 'node_modules', name);
  return existsSync(join(base, 'package.json')) ? base : null;
}

function readLicenceText(pkgDir) {
  for (const candidate of LICENCE_FILES) {
    const path = join(pkgDir, candidate);
    if (existsSync(path)) return trimTrailingBlank(replaceCrlf(readFileSync(path, 'utf8')));
  }
  return null;
}

const replaceCrlf = s => s.replace(/\r\n/g, '\n');
const trimTrailingBlank = s => s.replace(/\s+$/, '') + '\n';

/** Every bundled package with its version, SPDX identifier and licence text. */
export function collectPackages(root = REPO_ROOT) {
  const bundle = join(root, 'main.js');
  if (!existsSync(bundle)) {
    throw new Error('main.js not found — run `pnpm build` before generating notices.');
  }

  const entries = [];
  const shipping = [];
  for (const dir of bundledPackageDirs(readFileSync(bundle, 'utf8')).sort()) {
    const { name, version } = parsePnpmDir(dir);
    const pkgDir = packageDirIn(root, dir, name);
    if (!pkgDir) {
      throw new Error(`bundled package ${name}@${version} has no directory at .pnpm/${dir}`);
    }
    const manifest = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
    const declared = manifest.license;
    const spdx =
      typeof declared === 'string'
        ? declared
        : declared && typeof declared === 'object'
          ? declared.type || 'see licence text'
          : 'see licence text';
    const text = readLicenceText(pkgDir);
    const entry = { name, version, spdx, text, textFrom: null };
    if (text) shipping.push(entry);
    entries.push(entry);
  }

  for (const entry of entries) {
    if (entry.text) continue;
    // `@ai-sdk/provider-utils@4.0.40` is the live case: it declares Apache-2.0 and
    // ships no licence file. Failing the whole document over one upstream
    // omission would leave every other package unattributed, and omitting the
    // entry would leave that one unattributed — neither is what §4(a) asks for,
    // which is that recipients get a copy of the License. The text for a standard
    // SPDX id is the same document whichever package carries it, so a sibling in
    // this bundle that ships the same id supplies it — and the entry says so, so
    // the substitution is visible rather than implied.
    const donor =
      shipping.find(s => s.spdx === entry.spdx && s.spdx !== 'see licence text') ||
      shipping.find(s => s.spdx === entry.spdx);
    if (!donor) {
      throw new Error(
        `bundled package ${entry.name}@${entry.version} ships no licence file, and no other ` +
          `bundled package carries ${entry.spdx} to reproduce it from`
      );
    }
    entry.text = donor.text;
    entry.textFrom = `${donor.name} ${donor.version}`;
  }

  return entries;
}

/**
 * The full Apache-2.0 text, from a bundle package that ships it.
 *
 * Seven of the nine Apache-2.0 packages in this bundle ship only the SPDX
 * short-form notice — "Copyright 2023 Vercel, Inc." plus "You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0". Reproducing
 * those alone does not satisfy §4(a), which puts the obligation on the
 * distributor ("You must give any other recipients of the Work or Derivative
 * Works a copy of this License"); the pointer is where a copy may be obtained,
 * not the copy. So the full text goes in once, for everyone.
 *
 * MIT needs no appendix: its "Permission is hereby granted…" paragraph is the
 * whole licence, and each MIT package here ships it with its own copyright line.
 */
function apacheText(entries) {
  const donor = entries.find(e => e.spdx.startsWith('Apache-2.0') && e.text.includes('Version 2.0, January 2004'));
  if (!donor) {
    // Not fatal for the document, but it means §4(a) is unmet for every
    // Apache-2.0 package, so it is worth failing over rather than shipping.
    throw new Error('no bundled package carries the full Apache-2.0 text, and it cannot be invented');
  }
  return { text: donor.text, from: `${donor.name} ${donor.version}` };
}

/** The notices document. Pure, so the test can compare it against the committed file. */
export function renderNotices(entries) {
  const counts = new Map();
  for (const e of entries) counts.set(e.spdx, (counts.get(e.spdx) || 0) + 1);
  const summary = [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([spdx, n]) => `- ${spdx} — ${n} package${n === 1 ? '' : 's'}`)
    .join('\n');

  const sections = entries
    .map(e => {
      const notes = [];
      if (e.textFrom) {
        notes.push(
          `This package's distribution ships no licence file. The text below is the one
carried by \`${e.textFrom}\`, under the same licence.`
        );
      } else if (e.spdx.startsWith('Apache-2.0') && !e.text.includes('Version 2.0, January 2004')) {
        notes.push(
          `This package ships the short-form Apache-2.0 notice rather than the licence
text. It is reproduced as shipped; the full licence follows this section.`
        );
      }
      return `## ${e.name} ${e.version}

Declared licence: ${e.spdx}${notes.length ? `\n\n${notes.join('\n\n')}` : ''}

\`\`\`text
${e.text}\`\`\``;
    })
    .join('\n\n');

  const apache = apacheText(entries);
  const apacheCount = entries.filter(e => e.spdx.startsWith('Apache-2.0')).length;

  return `# Third-party notices

The plugin's \`main.js\` bundles the packages below. Their licences require that
these notices travel with it: MIT requires the copyright and permission notice to
accompany copies, and Apache-2.0 §4(a) and §4(b) require recipients of a
derivative work to receive a copy of the License and to retain attribution.

This file is generated from the built bundle — the artifact decides which packages
are in it, not \`package.json\`, because transitive dependencies no direct
dependency names are bundled too. Regenerate with:

\`\`\`bash
pnpm build && node tools/generate-third-party-notices.mjs
\`\`\`

A test asserts it matches the bundle, so a dependency change that is not reflected
here fails CI rather than shipping unattributed.

## Summary

${summary}

---

${sections}

---

## Apache License, Version 2.0, full text

${apacheCount} of the packages above are Apache-2.0. §4(a) requires that recipients
receive a copy of the License, and a pointer to where one may be obtained is not a
copy — so the full text is reproduced here once, from \`${apache.from}\`, which
carries it.

\`\`\`text
${apache.text}\`\`\``;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const target = join(REPO_ROOT, 'THIRD-PARTY-NOTICES.md');
  const rendered = renderNotices(collectPackages());
  const check = process.argv.includes('--check');

  if (check) {
    const current = existsSync(target) ? readFileSync(target, 'utf8') : '';
    if (current !== rendered) {
      console.error('THIRD-PARTY-NOTICES.md is stale. Run: node tools/generate-third-party-notices.mjs');
      process.exit(1);
    }
    console.log('THIRD-PARTY-NOTICES.md is current.');
  } else {
    writeFileSync(target, rendered);
    console.log(`Wrote ${target} (${collectPackages().length} packages).`);
  }
}
