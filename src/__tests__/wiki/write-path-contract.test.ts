// Issue #603 slice 3: the write-path contract, enforced against the source.
//
// `wiki-content-folder-guard.test.ts` documents the surrounding rule by
// **re-implementing** it, which means it keeps passing after the production code
// drifts away from it. These tests read the production tree instead, so they fail
// when a new bypass appears — which is the only version that can catch the class of
// defect #603 is about.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SRC = join(__dirname, '..', '..');

function productionFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === '__mocks__') continue;
      out.push(...productionFiles(full));
    } else if (entry.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Strip line and block comments without cutting through string literals.
 *
 * The previous form took `line.indexOf('//')` and dropped the rest of the line,
 * which also cuts an inline URL — everything after the `//` in `'https://…'` —
 * and takes any bypass on that line with it. A scanner whose failure mode is
 * "silently reports a clean tree" is worse than no scanner, so this walks the
 * source once and only treats `//` and block openings as comments when they are
 * outside a quote.
 */
function stripComments(source: string): string {
  let out = '';
  let i = 0;
  let quote: string | null = null;
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (quote !== null) {
      if (ch === '\\') {
        out += source.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/**
 * Repo-relative POSIX path.
 *
 * `relative` yields `core\disk-cache.ts` on win32, and every name in
 * `OUT_OF_CONTRACT` below is written in POSIX form, so a raw comparison makes the
 * waiver miss on Windows alone — the one platform the CI never runs. Normalising
 * here means the guard means the same thing everywhere, which is the only way it
 * is worth having.
 */
function relPosix(file: string): string {
  return relative(SRC, file).split(sep).join('/');
}

const files = productionFiles(SRC);

/**
 * Deliberately outside the write contract, each for a stated reason.
 *
 * `core/disk-cache.ts` is a generic cache over an **injected** adapter; it writes
 * cache entries, not vault documents, and going through the engine's gate would
 * require it to know about the engine. The #603 design pass placed it in tier C —
 * out of contract, documented and left. Naming it here rather than widening the
 * pattern means a *new* waiver costs a deliberate edit to this list.
 */
const OUT_OF_CONTRACT = new Set(['core/disk-cache.ts']);

function callersOf(pattern: RegExp): string[] {
  return files
    .map(f => ({ rel: relPosix(f), code: stripComments(readFileSync(f, 'utf8')) }))
    .filter(({ rel, code }) => !OUT_OF_CONTRACT.has(rel) && pattern.test(code))
    .map(({ rel }) => rel);
}

describe('#603 — no production write bypasses Obsidian’s event layer', () => {
  it('finds no `vault.adapter.write` call outside tests', () => {
    // `adapter.write` goes below `vault.modify` / `vault.process`, so
    // `vault.on('modify')` never fires and the metadata cache keeps the old
    // frontmatter. After slice 3 both `fix-runners.ts` sites use the engine's
    // declared-intent entry instead. A new occurrence means a writer has quietly
    // gone back around the contract.
    expect(callersOf(/\.adapter\s*\.\s*write\s*\(/)).toEqual([]);
  });

  it('finds no `vault.adapter` write outside tests (broader guard)', () => {
    // Catches the neighbouring idioms too: `adapter.append`, `adapter.remove`.
    expect(callersOf(/\.adapter\s*\.\s*(write|append|remove|rename|trash)\s*\(/)).toEqual([]);
  });

  it('the waiver list stays minimal', () => {
    // A growing waiver list is how this kind of guard dies. If this needs
    // raising, the new entry owes a reason in the #603 record too.
    expect(OUT_OF_CONTRACT.size).toBe(1);
    expect([...OUT_OF_CONTRACT]).toEqual(['core/disk-cache.ts']);
  });
});

describe('#603 — every writer names the layers it wants', () => {
  it('the lint fixers write through the declared-intent entry, not createOrUpdateFile', () => {
    // They are surgical frontmatter edits: no guard over the body, no
    // notification (the lint run owns its own refresh). Using the legacy
    // shorthand would silently give them both.
    const src = readFileSync(join(SRC, 'wiki', 'lint', 'fix-runners.ts'), 'utf8');
    const code = stripComments(src);

    const declared = code.match(/writeFileWithIntent\s*\(/g) ?? [];
    expect(declared.length).toBeGreaterThanOrEqual(2);

    // The two sites this slice converted. The intent is the lint one, and that is
    // the whole point of it: the cancel owner is the lint's own controller, so a
    // lint write is stopped by the lint's stop button and not by an overlapping
    // ingest's.
    expect(code).toContain('ctx.wikiEngine.writeFileWithIntent(page.path, updated, LINT_WRITE_INTENT)');
    expect(code).toContain('ctx.wikiEngine.writeFileWithIntent(v.path, updated, LINT_WRITE_INTENT)');

    // And the lint fixers must not reach for the full gate.
    expect(code).not.toContain('createOrUpdateFile');
  });

  it('the engine supplies a named intent at every internal write', () => {
    // A bare `{ guard: true, notify: false }` object literal would compile and
    // work, but it would put the reasoning at the call site instead of next to
    // the constant's explanation, and it is the shape that made #603 hard to
    // read in the first place. Every intent here is a named constant.
    const code = stripComments(readFileSync(join(SRC, 'wiki', 'wiki-engine.ts'), 'utf8'));

    // No inline intent objects anywhere on the write path.
    expect(code).not.toMatch(/writeFileWithIntent\([\s\S]{0,120}?\{\s*guard:/);

    for (const name of [
      'FULL_WRITE_INTENT',
      'LOG_WRITE_INTENT',
      'RAW_WRITE_INTENT',
      'STAMP_WRITE_INTENT',
    ]) {
      expect(code, `${name} must be used by the engine`).toContain(name);
    }
    // `LINT_WRITE_INTENT` is the fix runners' — the engine must not reach for it.
    expect(code).not.toContain('LINT_WRITE_INTENT');
  });

  it('a write that may not create says so', () => {
    // The one layer of `WriteIntent` that is a correctness requirement rather
    // than a preference. `markPageComplete` is un-awaited, so it races the cancel
    // cleanup that deletes the page it is stamping — and a stamp that can create
    // writes the page back with `generation_complete: true`, which is the state
    // #582/#583 exist to prevent. Read as a declaration rather than inferred from
    // the call site, so removing it is a deliberate edit.
    const engine = stripComments(readFileSync(join(SRC, 'wiki', 'wiki-engine.ts'), 'utf8'));
    const types = stripComments(readFileSync(join(SRC, 'types.ts'), 'utf8'));

    expect(engine).toContain('await this.rawWrite(path, flipped, STAMP_WRITE_INTENT)');
    expect(types).toMatch(/STAMP_WRITE_INTENT[\s\S]{0,200}create: false/);
    // And the stamp must not have gone back to a full-gate write.
    expect(engine).not.toMatch(/markPageComplete[\s\S]{0,400}rawWrite\(path, flipped\),/);
  });
});
