// Issue #603 slice 3: the write-path contract, enforced against the source.
//
// `wiki-content-folder-guard.test.ts` documents the surrounding rule by
// **re-implementing** it, which means it keeps passing after the production code
// drifts away from it. These tests read the production tree instead, so they fail
// when a new bypass appears — which is the only version that can catch the class of
// defect #603 is about.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

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

/** Strip line and block comments, so a comment describing a bypass is not read as one. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(line => {
      const i = line.indexOf('//');
      return i === -1 ? line : line.slice(0, i);
    })
    .join('\n');
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
    .map(f => ({ rel: relative(SRC, f), code: stripComments(readFileSync(f, 'utf8')) }))
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

    // The two sites this slice converted.
    expect(code).toContain('ctx.wikiEngine.writeFileWithIntent(page.path, updated, RAW_WRITE_INTENT)');
    expect(code).toContain('ctx.wikiEngine.writeFileWithIntent(v.path, updated, RAW_WRITE_INTENT)');

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

    for (const name of ['FULL_WRITE_INTENT', 'LOG_WRITE_INTENT', 'RAW_WRITE_INTENT']) {
      expect(code, `${name} must be used by the engine`).toContain(name);
    }
  });
});
