// package.json and package-lock.json must agree on every direct dependency.
//
// They have drifted twice. #501/#556 documented the class — npm does not read
// pnpm's lockfile, so the two carry the same dependency graph in two formats
// with nothing keeping them in step. #652 reintroduced it by bumping vitest in
// package.json and pnpm-lock.yaml while package-lock.json stayed on the old
// major, and nothing caught it: CI installs with `pnpm install
// --frozen-lockfile` and the audit step reads pnpm's lockfile, so the npm-side
// lockfile had no gate at all between releases. It surfaced eventually as two
// Dependabot advisories filed against the stale copy.
//
// The check reads what the lockfile recorded about its own inputs. A lockfile's
// root entry (`packages[""]`) carries the dependency specifiers package.json
// held when it was generated, so if a specifier has changed since, the two
// disagree and the lockfile is stale by definition.
//
// Deliberately offline and exact rather than "regenerate and diff". npm
// re-resolves ranges, so a legitimate newer patch inside a range would read as
// drift and fail a clean tree; comparing recorded specifiers cannot produce
// that false positive, needs no semver library (this repo has none), and needs
// no network.

import { readFileSync } from 'node:fs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url), 'utf8'));

const pkg = read('package.json');
const lock = read('package-lock.json');
const lockRoot = lock.packages?.[''] ?? {};

const SECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
const problems = [];

for (const section of SECTIONS) {
  const declared = pkg[section] ?? {};
  const recorded = lockRoot[section] ?? {};
  for (const name of [...new Set([...Object.keys(declared), ...Object.keys(recorded)])].sort()) {
    const want = declared[name];
    const have = recorded[name];
    if (want === have) continue;
    if (want === undefined) {
      problems.push(`${name}: in package-lock.json under ${section} as ${have}, but not declared in package.json`);
    } else if (have === undefined) {
      problems.push(`${name}: declared ${want} in package.json, absent from package-lock.json`);
    } else {
      problems.push(`${name}: package.json declares ${want}, package-lock.json was generated for ${have}`);
    }
  }
}

if (problems.length > 0) {
  console.error('package-lock.json is out of sync with package.json:');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error('\nRegenerate it with: npm install --legacy-peer-deps --package-lock-only');
  process.exit(1);
}

console.log('lockfile-sync: package-lock.json matches package.json');
