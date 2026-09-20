// Issue #699 — the shipped bundle carries third-party packages and, before this,
// no licence notices at all: zero hits for `copyright`, `@license` or any licence
// text in the released `main.js`, and a `NOTICE` that listed contributors only.
//
// **The bundle is the authority on what is bundled.** `esbuild.config.mjs` marks
// only `obsidian`, `electron`, the CodeMirror/Lezer packages and Node builtins as
// external, but which of the rest actually reaches `main.js` is decided by what
// the entry point imports — and the resolved set includes transitive packages no
// direct dependency names. Counting by hand for this repository gave ten; the
// artifact contains twelve, and the two it missed (`@vercel/oidc`,
// `eventsource-parser`) are exactly the ones a hand-maintained list keeps missing.
//
// The assertions below call the generator rather than re-deriving its rules, so
// there is one implementation of "which packages are bundled" and one of "what the
// document looks like". A drift fails here instead of shipping unattributed.
//
// The obligation, per the licences involved: MIT requires its copyright and
// permission notice to travel with copies, and a minified copy inside `main.js` is
// a copy; Apache-2.0 §4(a) requires recipients of a derivative work to receive a
// copy of the License, and §4(b) that attribution notices be retained. The plugin
// is distributed through the Obsidian community marketplace, which is
// distribution.

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
// The generator is a tool, not production code — it reads the artifact, so it
// runs after a build. `gate:1` orders build before test, and
// `openai-codex-loopback-flow.test.ts` already reads `main.js` the same way.
import { collectPackages, renderNotices } from '../../../tools/generate-third-party-notices.mjs';

// Same depth as `readme-links.test.ts` in this directory: root is three levels up.
const ROOT = join(__dirname, '..', '..', '..');
const NOTICES = join(ROOT, 'THIRD-PARTY-NOTICES.md');

describe('#699 — third-party notices travel with the bundle', () => {
  it('has a notices file', () => {
    expect(existsSync(NOTICES), 'THIRD-PARTY-NOTICES.md must exist').toBe(true);
  });

  it('matches the bundle exactly, so a dependency change cannot drift', () => {
    expect(existsSync(join(ROOT, 'main.js')), 'main.js must exist — run `pnpm build` first').toBe(true);
    const entries = collectPackages(ROOT);
    expect(entries.length, 'no inlined packages found — did the build change?').toBeGreaterThan(0);
    expect(readFileSync(NOTICES, 'utf8')).toBe(renderNotices(entries));
  });

  it('names every bundled package with the version that is actually inlined', () => {
    const notices = readFileSync(NOTICES, 'utf8');
    const entries = collectPackages(ROOT);
    for (const e of entries) {
      // Name and version on one line, so an entry for a different version of the
      // same package cannot satisfy this.
      const line = notices.split('\n').find(l => l.startsWith(`## ${e.name} `));
      expect(line, `${e.name} must have its own section`).toBe(`## ${e.name} ${e.version}`);
    }
  });

  it('carries the licence text, not just an identifier', () => {
    const notices = readFileSync(NOTICES, 'utf8');
    // MIT's permission paragraph is the whole licence and each MIT package ships
    // it with its own copyright line.
    expect(notices).toContain('Permission is hereby granted, free of charge');
    // Apache-2.0 §4(a): §4(a) asks for a copy of the License, and the short-form
    // notice seven of these packages ship is a pointer to one, not one.
    expect(notices).toContain('Apache License');
    expect(notices).toContain('Version 2.0, January 2004');
    expect(notices).toContain('TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION');
  });

  it('says so when a package ships no licence file, instead of inventing one', () => {
    const notices = readFileSync(NOTICES, 'utf8');
    // `@ai-sdk/provider-utils` declares Apache-2.0 and ships no licence file; its
    // text is taken from a sibling under the same licence and the entry says which.
    const silent = collectPackages(ROOT).filter(e => e.textFrom);
    for (const e of silent) {
      const section = notices.slice(notices.indexOf(`## ${e.name} `));
      expect(section.slice(0, 600)).toContain('ships no licence file');
      expect(section.slice(0, 600)).toContain(e.textFrom);
    }
  });

  it('is referenced from NOTICE, so the repository record points at it', () => {
    expect(readFileSync(join(ROOT, 'NOTICE'), 'utf8')).toContain('THIRD-PARTY-NOTICES.md');
  });

  it('is referenced from every README locale', () => {
    // All eleven, not just the canonical one: the licence line is a user-visible
    // claim and the locales are held to i18n parity.
    const files = [
      'README.md',
      'docs/README_CN.md',
      'docs/README_ZH-Hant.md',
      'docs/README_JA.md',
      'docs/README_KO.md',
      'docs/README_FR.md',
      'docs/README_ES.md',
      'docs/README_PT.md',
      'docs/README_IT.md',
      'docs/README_RU.md',
      'docs/README_DE.md',
    ];
    for (const rel of files) {
      expect(readFileSync(join(ROOT, rel), 'utf8'), `${rel} must reference the notices`).toContain(
        'THIRD-PARTY-NOTICES.md'
      );
    }
  });
});
