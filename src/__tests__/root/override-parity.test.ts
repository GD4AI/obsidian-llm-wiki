// The dependency pins live in two files, and nothing enforced that they agree.
//
// Why two files (Issue #907): npm reads `overrides` from `package.json`, and
// pnpm has not read that field since it moved its own settings out of
// `package.json` — commit `bd992f8c` (#557) documents the move, and pnpm 11 no
// longer reads the `pnpm` field at all. So the two package managers have two
// separate homes by construction:
//
//   package.json        overrides        -> the npm tree, which CI builds the
//                                          released `main.js` from
//   pnpm-workspace.yaml overrides        -> the pnpm tree, which Gate 1 runs on
//
// Until this test existed the only enforcement was a comment in
// `pnpm-workspace.yaml` asking the next person to keep the lists in step. A
// comment does not fail. The failure it fails to catch is silent in both
// directions: add a pin to the yaml only and the release build ships the
// vulnerable version; add it to `package.json` only and Gate 1 passes on a tree
// that still has it. Neither shows up until someone reads both files.
//
// Nothing here checks that a pin is *correct* — only that the two declarations
// are the same declaration.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

const NPM_SIDE = 'package.json (npm tree, built by .github/workflows/release.yml)';
const PNPM_SIDE = 'pnpm-workspace.yaml (pnpm tree, what Gate 1 runs on)';

type Pins = Record<string, string>;

/**
 * Read one side's `overrides` map, normalised to strings.
 *
 * `yaml` parses `1.2` as a number, so a value written unquoted in one file and
 * quoted in the other would compare unequal for no real reason. Both sides are
 * compared as strings for that reason alone.
 */
function readPins(raw: unknown): Pins {
  if (!raw || typeof raw !== 'object') return {};
  const out: Pins = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    out[key] = String(value);
  }
  return out;
}

function npmPins(): Pins {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { overrides?: unknown; pnpm?: unknown; resolutions?: unknown };
  return readPins(pkg.overrides);
}

/**
 * The two homes above are the two that work. Others exist and look plausible:
 * `pnpm.overrides` was the documented place until pnpm 11 stopped reading it,
 * and `resolutions` is the Yarn spelling. A pin written into either of those is
 * invisible to the comparisons above — it would be applied to nothing, and the
 * two tests that matter would report parity between the maps that do work.
 */
function thirdHomes(): string[] {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { pnpm?: unknown; resolutions?: unknown };
  const found: string[] = [];
  const nested = pkg.pnpm as { overrides?: unknown } | undefined;
  if (nested && typeof nested === 'object' && nested.overrides) found.push('package.json -> pnpm.overrides');
  if (pkg.resolutions) found.push('package.json -> resolutions');
  return found;
}

function pnpmPins(): Pins {
  const workspace = parseYaml(readFileSync('pnpm-workspace.yaml', 'utf8')) as { overrides?: unknown } | null;
  return readPins(workspace?.overrides);
}

describe('dependency overrides are declared once per package manager, identically', () => {
  it('names the same packages on both sides', () => {
    const npm = npmPins();
    const pnpm = pnpmPins();
    const onlyNpm = Object.keys(npm).filter((k) => !(k in pnpm));
    const onlyPnpm = Object.keys(pnpm).filter((k) => !(k in npm));

    // Reported together and by name, because "the maps differ" sends the reader
    // to diff two files by eye.
    expect(
      { missingFromPnpmWorkspace: onlyPnpm, missingFromPackageJson: onlyNpm },
      `A pin must be declared in both ${NPM_SIDE} and ${PNPM_SIDE}. `
      + 'A pin present in only one of them is applied to one dependency tree and '
      + 'silently absent from the other: the npm tree is what the release is built '
      + 'from, and the pnpm tree is what every local gate runs on.',
    ).toEqual({ missingFromPnpmWorkspace: [], missingFromPackageJson: [] });
  });

  it('pins each package to the same version on both sides', () => {
    const npm = npmPins();
    const pnpm = pnpmPins();
    const differing = Object.keys(npm)
      .filter((k) => k in pnpm && npm[k] !== pnpm[k])
      .map((k) => ({ package: k, [NPM_SIDE]: npm[k], [PNPM_SIDE]: pnpm[k] }));

    expect(differing, 'Both sides must pin the same version, or the two trees carry different code.').toEqual([]);
  });

  it('is not vacuous — both sides actually carry pins', () => {
    // A rename that silently yields `{}` on one side would make the two tests
    // above pass while comparing nothing. This is the guard on the guard.
    expect(Object.keys(npmPins()).length).toBeGreaterThan(0);
    expect(Object.keys(pnpmPins()).length).toBeGreaterThan(0);
  });

  it('declares no pin in a field that no package manager reads', () => {
    // `pnpm.overrides` stopped being read by pnpm 11; `resolutions` is Yarn's.
    // Either one accepts a pin silently, applies it to nothing, and leaves the
    // two real maps in perfect agreement — the exact failure this file exists
    // to catch, one field to the left.
    expect(
      thirdHomes(),
      'A pin under `pnpm.overrides` or `resolutions` is applied to no tree. Move it to '
      + '`overrides` in package.json and pnpm-workspace.yaml.',
    ).toEqual([]);
  });
});

/**
 * A pin is only a pin once the shipped tree resolves to it.
 *
 * The two declarations being equal (above) says nothing about whether npm
 * actually applied either one. `package-lock.json` is what the shipped
 * artifact is built from: the community store scanner rebuilds each release
 * The lockfile is what the release build resolves against: `release.yml`
 * installs the npm tree, and `.npmrc` exists because a lockfile resolved
 * against the wrong registry produced a `main.js` whose hash differed from the
 * published one. So the pin has to be visible in `package-lock.json`, not only
 * in the two `overrides` maps.
 *
 * Nothing checked that before this block. `scripts/check-lockfile-sync.mjs`
 * compares the four dependency sections of `packages[""]` and does not read
 * `overrides` at all, which was verified by mutation on 2026-10-29: setting
 * `node_modules/undici` back to 8.10.2 in the lockfile while the pin says
 * 8.12.3 still printed `lockfile-sync: package-lock.json matches package.json`.
 * So a pin that never reached the lockfile failed nothing.
 *
 * **What this block does NOT claim.** `release.yml` runs `npm install`, which
 * reconciles `package.json` into the lockfile, so the release build would pick
 * up a new pin even from a stale lockfile. The harm this prevents is the
 * committed lockfile disagreeing with the pins — which is what makes a frozen
 * install reproducible, and what the store scanner rebuilds from.
 *
 * This block is offline and exact: it reads what the lockfile recorded, and
 * needs no registry.
 */
describe('every pin is applied by the npm tree', () => {
  type LockEntry = { version?: string; resolved?: string; dev?: boolean };

  /**
   * Parse once. Six pins against a 6,800-line JSON is six parses otherwise,
   * and a per-pin read is how a reviewer ends up not trusting a cost note.
   */
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8')) as {
    packages?: Record<string, LockEntry>;
  };
  const entries = Object.entries(lock.packages ?? {});

  /** Every `packages` key that installs `pkg`: the top level plus nested copies. */
  function pathsFor(pkg: string): Array<[string, LockEntry]> {
    return entries.filter(
      ([path]) => path === `node_modules/${pkg}` || path.endsWith(`/node_modules/${pkg}`),
    );
  }

  it('installs each pinned package once, at the pinned version', () => {
    const pins = npmPins();
    const wrong = Object.entries(pins)
      .map(([name, want]) => {
        const found = pathsFor(name);
        return {
          package: name,
          pinned: want,
          // Versions are listed WITHOUT deduping: two copies at the same version
          // are still two module instances, and that is the failure mode this
          // condition exists for. `new Set` here would hide it — this repo's own
          // lockfile has `@eslint/core` 0.17.0 under two different parents.
          copies: found.length,
          versions: found.map(([, entry]) => entry.version ?? '?').sort(),
        };
      })
      .filter((row) => row.copies !== 1 || row.versions[0] !== row.pinned);

    expect(
      wrong,
      'The npm tree must install every pinned package exactly once, at its pin. '
      + '`copies > 1` means npm could not collapse the graph — the duplicate-class '
      + 'problem that made `instanceof` stop matching across AI SDK copies, and it is two '
      + 'copies even when both are the same version. `copies === 0` or a different '
      + 'version means the pin never reached this lockfile: regenerate it with '
      + '`npm install --legacy-peer-deps --package-lock-only`.',
    ).toEqual([]);
  });

  it('resolves each pin to a tarball of that version, not only a version field', () => {
    // `version` is one field in a record the build trusts three of. A hand-edited
    // version with an untouched `resolved` would satisfy the test above while the
    // tarball it installs is the old one, so the URL has to agree.
    const pins = npmPins();
    const mismatched = Object.entries(pins)
      .flatMap(([name, want]) =>
        pathsFor(name)
          .filter(([, entry]) => {
            const resolved = entry.resolved ?? '';
            // `resolved` is absent for a link/bundled entry; only judge what has one.
            return resolved !== '' && !resolved.endsWith(`-${want}.tgz`);
          })
          .map(([path, entry]) => ({ package: name, pinned: want, path, resolved: entry.resolved })),
    );

    expect(
      mismatched,
      'A pinned entry must resolve to the tarball for the pinned version. A `version` '
      + 'that says one thing while `resolved` points at another installs the old bytes '
      + 'and passes a version-only check.',
    ).toEqual([]);
  });

  it('is not vacuous — the lockfile parses and reads as a lockfile', () => {
    // A renamed `packages` gives `pathsFor` an empty result for every pin, which
    // the first test already catches — so this guards the readable-lockfile
    // premise rather than duplicating the assertion. The threshold is loose on
    // purpose: it should notice a truncated or wrong-format file, not fail on
    // a dependency removal. This tree carries 436 entries at lockfileVersion 3.
    expect(entries.length).toBeGreaterThan(100);
    expect(entries.some(([path]) => path === 'node_modules/typescript')).toBe(true);
    expect(lock.packages?.['']).toBeDefined();
  });
});
