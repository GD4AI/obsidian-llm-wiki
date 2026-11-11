// Lookbehind is not a style preference. iOS before 16.4 throws when the regex
// is *parsed*, so a single `(?<=` in a production file takes the whole plugin
// down at load — on one platform, with no stack trace pointing at the regex.
//
// Two defences exist and neither is enough alone:
//
//   eslint-plugin-obsidianmd  `obsidianmd/regex-lookbehind`
//   this test                 any `(?<` in `src/**/*.ts`
//
// The lint rule was configured as `error` since 0.4.2 and **missed two live
// patterns** in `src/core/json.ts` for a whole cycle — the rule did not report
// them until the plugin moved to 0.5.1 (Issue #962). A configured rule that
// finds nothing looks exactly like a clean tree. This test does not depend on
// which plugin version is installed, so the property holds on any tree.
//
// The scan is deliberately dumb: it looks for the character sequence, not for a
// regex literal, because a lookbehind split across a string concat or built at
// runtime is the case a cleverer parser would miss. That is not hypothetical —
// `src/core/candidate-gate.ts` built its word-boundary needle with
// `new RegExp`, so `obsidianmd/regex-lookbehind` never reported it, and this
// test did on its first run.
//
// `src/__tests__/` is exempt: those files run in Node, never inside the plugin,
// and two of them legitimately use lookbehind on surrogate pairs.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = 'src';
const TESTS = join(SRC, '__tests__');
/** Built from two pieces so this file does not match its own check. */
const OPEN = '(' + '?' + '<';

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (path !== TESTS) out.push(...tsFiles(path));
    } else if (entry.name.endsWith('.ts')) out.push(path);
  }
  return out;
}

/** Lines that contain the sequence outside a comment, with the line number. */
function lookbehindLines(path: string): string[] {
  const hits: string[] = [];
  readFileSync(path, 'utf8').split('\n').forEach((line, index) => {
    const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '');
    if (code.includes(OPEN)) hits.push(`${path}:${index + 1}: ${line.trim()}`);
  });
  return hits;
}

describe('regex lookbehind is absent from shipped code (iOS < 16.4, #962)', () => {
  it('no file outside __tests__ contains a lookbehind', () => {
    const hits = tsFiles(SRC).flatMap(lookbehindLines);
    expect(hits, 'iOS before 16.4 throws when the pattern is built, so this fails at load or during ingest').toEqual([]);
  });
});
