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
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { overrides?: unknown };
  return readPins(pkg.overrides);
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
});
