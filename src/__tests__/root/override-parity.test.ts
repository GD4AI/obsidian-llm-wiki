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
 * The two package managers must resolve the same version of every package that
 * reaches `main.js`.
 *
 * Why this and not "the two builds are byte-identical" (issue #907, criterion
 * 6 as first written): the artifacts differ by 7,049 bytes, and 7,037 of them
 * are pnpm's virtual-store path embedded in esbuild's module comments and
 * `__esm` keys (`node_modules/.pnpm/ai@7.0.142_zod@4.6.7/node_modules/...`
 * against `node_modules/...`). That noise has no behaviour, so a byte compare
 * can only ever answer the wrong question.
 *
 * What was left underneath it did have behaviour. On 2026-10-29 the two trees
 * bundled **different versions of `eventsource-parser`** — 3.1.1 in the npm
 * tree that ships, 3.1.0 in the pnpm tree every gate runs — and the difference
 * was the event-id branch of the SSE parser. That is the AI SDK's SSE path,
 * which is where #916 came from. The released code was never executed by a
 * test.
 *
 * So the invariant is the versions, and the scope is the runtime closure: a
 * devDependency cannot reach the bundle, and holding it to the same version
 * would fail on tooling that legitimately drifts.
 *
 * Nothing here needs the network, `node_modules`, or a build.
 */
describe('both package managers resolve one version per runtime package', () => {
  /** Semver strings from the npm lockfile, keyed by package name. */
  function npmRuntimeVersions(): Map<string, Set<string>> {
    const lock = JSON.parse(readFileSync('package-lock.json', 'utf8')) as {
      packages?: Record<string, { version?: string; dev?: boolean }>;
    };
    const out = new Map<string, Set<string>>();
    for (const [path, entry] of Object.entries(lock.packages ?? {})) {
      if (entry.dev || !path.startsWith('node_modules/')) continue;
      const name = path.split('node_modules/').at(-1) ?? '';
      if (!out.has(name)) out.set(name, new Set());
      out.get(name)?.add(entry.version ?? '?');
    }
    return out;
  }

  /**
   * Version strings from pnpm's lockfile.
   *
   * The keys look like `  name@1.2.3:` and `  '@scope/name@1.2.3(peer@4.5.6):'`.
   * The peer suffix is part of pnpm's instance key, not part of the version, so
   * it is stripped — leaving it in makes every package with a peer dependency
   * look like it differs when both trees agree.
   */
  function pnpmVersions(): Map<string, Set<string>> {
    const text = readFileSync('pnpm-lock.yaml', 'utf8');
    const out = new Map<string, Set<string>>();
    for (const match of text.matchAll(/^ {2}'?(@?[^\s'@]+(?:\/[^\s'@]+)?)@([^\s:'(]+)/gm)) {
      const [, name, version] = match;
      if (version.startsWith('link:') || version.startsWith('file:')) continue;
      if (!out.has(name)) out.set(name, new Set());
      out.get(name)?.add(version);
    }
    return out;
  }

  it('names no runtime package at two different versions', () => {
    const npm = npmRuntimeVersions();
    const pnpm = pnpmVersions();
    const skewed = [...npm.entries()]
      .map(([name, versions]) => ({
        package: name,
        'package-lock.json (ships)': [...versions].sort(),
        'pnpm-lock.yaml (gates run here)': [...(pnpm.get(name) ?? [])].sort(),
      }))
      .filter((row) => {
        const a = row['package-lock.json (ships)'];
        const b = row['pnpm-lock.yaml (gates run here)'];
        return a.length !== 1 || b.length !== 1 || a[0] !== b[0];
      });

    expect(
      skewed,
      'A runtime package must resolve to ONE version in both lockfiles. When they differ, '
      + 'the released main.js runs code no test executed — measured on 2026-10-29 with '
      + 'eventsource-parser 3.1.1 shipping against 3.1.0 under test. Fix it with a pin in '
      + 'BOTH override maps, not by regenerating one lockfile and hoping.',
    ).toEqual([]);
  });

  it('is not vacuous — the two reads find the same set of runtime packages', () => {
    // If either parser silently returned nothing, the test above would compare
    // two empty maps and pass. The runtime closure is small (15 packages at the
    // time of writing), so the guard is the overlap rather than a count.
    const npm = npmRuntimeVersions();
    const pnpm = pnpmVersions();
    expect(npm.size).toBeGreaterThan(5);
    expect(pnpm.size).toBeGreaterThan(5);
    const shared = [...npm.keys()].filter((name) => pnpm.has(name));
    expect(shared.length, 'the two lockfiles must agree on which packages exist').toBeGreaterThan(5);
    // And the bundle's single largest dependency has to be among them, or the
    // parser is reading the wrong section.
    expect(shared).toContain('ai');
  });
});
