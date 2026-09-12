// Module-level unit tests for page-factory/aliases.ts
//
// v1.24.1 Phase 2 refactor: `appendAliases` was lifted out of the PageFactory
// class. The tests pin its observable contract — what gets written back to
// disk for each input shape — so future refactors cannot silently change
// how aliases get added, deduplicated, or rewritten into the frontmatter.

import { describe, it, expect, vi } from 'vitest';
import { aliasClaimsFromPages, appendAliases, resolveMinAliasLength, type AliasesContext } from '../../../wiki/page-factory/aliases';

function makeContext(initial: Record<string, string>): AliasesContext & {
  written: Map<string, string>;
} {
  const files = new Map<string, string>(Object.entries(initial));
  return {
    written: files,
    async tryReadFile(path: string): Promise<string | null> {
      return files.get(path) ?? null;
    },
    async createOrUpdateFile(path: string, content: string): Promise<void> {
      files.set(path, content);
    },
  };
}

const PAGE = 'wiki/vigilanz.md';
const PAGE_NO_FM = 'wiki/no-fm.md';

function makePage(aliases?: string[]): string {
  const lines = ['---', 'title: Vigilanz', ''];
  if (aliases) {
    lines.push('aliases:');
    for (const a of aliases) lines.push(`  - "${a}"`);
    lines.push('');
  }
  lines.push('---', '', '# Vigilanz', '', 'Body text.');
  return lines.join('\n');
}

describe('appendAliases — happy path', () => {
  it('appends a new alias to a page with no existing aliases', async () => {
    const ctx = makeContext({ [PAGE]: makePage() });
    await appendAliases(ctx, PAGE, ['Überwachung']);
    const written = ctx.written.get(PAGE)!;
    expect(written).toContain('aliases:');
    expect(written).toContain('  - "Überwachung"');
    // The rest of the frontmatter survives.
    expect(written).toContain('title: Vigilanz');
    expect(written).toContain('# Vigilanz');
  });

  it('appends to the existing aliases array without dropping entries', async () => {
    const ctx = makeContext({ [PAGE]: makePage(['existing']) });
    await appendAliases(ctx, PAGE, ['new']);
    const written = ctx.written.get(PAGE)!;
    expect(written).toContain('  - "existing"');
    expect(written).toContain('  - "new"');
  });

  it('preserves the original aliases order (existing first, then new)', async () => {
    // v1.25.10 PATCH alias hardening raised the floor to 3 chars; the old
    // single-letter fixtures ('a','b','c','d') are now correctly rejected by
    // `filterRedundantAliases` before they ever reach the writer. Use
    // realistic-length aliases so the order-assumption contract still pins.
    const ctx = makeContext({ [PAGE]: makePage(['aaa', 'bbb']) });
    await appendAliases(ctx, PAGE, ['ccc', 'ddd']);
    const written = ctx.written.get(PAGE)!;
    const idxA = written.indexOf('  - "aaa"');
    const idxB = written.indexOf('  - "bbb"');
    const idxC = written.indexOf('  - "ccc"');
    const idxD = written.indexOf('  - "ddd"');
    expect(idxA).toBeGreaterThan(0);
    expect(idxA).toBeLessThan(idxB);
    expect(idxB).toBeLessThan(idxC);
    expect(idxC).toBeLessThan(idxD);
  });
});

describe('appendAliases — dedup', () => {
  it('no-op when input aliases are already present', async () => {
    const ctx = makeContext({ [PAGE]: makePage(['existing']) });
    const writeSpy = vi.spyOn(ctx, 'createOrUpdateFile');
    await appendAliases(ctx, PAGE, ['existing']);
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('no-op when ALL input aliases are redundant (match the filename)', async () => {
    const ctx = makeContext({ [PAGE]: makePage() });
    const writeSpy = vi.spyOn(ctx, 'createOrUpdateFile');
    await appendAliases(ctx, PAGE, ['vigilanz', 'Vigilanz']);
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('keeps the non-redundant input and drops the redundant one', async () => {
    const ctx = makeContext({ [PAGE]: makePage() });
    await appendAliases(ctx, PAGE, ['vigilanz', 'Surveillance']);
    const written = ctx.written.get(PAGE)!;
    expect(written).toContain('  - "Surveillance"');
    expect(written).not.toContain('  - "vigilanz"');
  });

  it('no-op when input is empty array', async () => {
    const ctx = makeContext({ [PAGE]: makePage() });
    const writeSpy = vi.spyOn(ctx, 'createOrUpdateFile');
    await appendAliases(ctx, PAGE, []);
    expect(writeSpy).not.toHaveBeenCalled();
  });
});

describe('appendAliases — edge cases', () => {
  it('no-op when the page is missing', async () => {
    const ctx = makeContext({});
    const writeSpy = vi.spyOn(ctx, 'createOrUpdateFile');
    await appendAliases(ctx, 'wiki/missing.md', ['x']);
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('no-op when the file has no frontmatter delimiters', async () => {
    // File with body but no --- / --- pair → can't safely inject.
    const ctx = makeContext({ [PAGE_NO_FM]: 'just body content, no frontmatter' });
    const writeSpy = vi.spyOn(ctx, 'createOrUpdateFile');
    await appendAliases(ctx, PAGE_NO_FM, ['x']);
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('does not mutate the body content', async () => {
    const original = makePage();
    const ctx = makeContext({ [PAGE]: original });
    await appendAliases(ctx, PAGE, ['x']);
    const written = ctx.written.get(PAGE)!;
    expect(written).toContain('# Vigilanz');
    expect(written).toContain('Body text.');
  });
});

describe('appendAliases — minAliasLength setting', () => {
  it('applies the setting as the alias floor', async () => {
    const ctx = { ...makeContext({ [PAGE]: makePage(['existing']) }), settings: { minAliasLength: 3 } };
    await appendAliases(ctx, PAGE, ['ML', 'Überwachung']);
    const written = ctx.written.get(PAGE)!;
    expect(written).toContain('  - "Überwachung"');
    expect(written).not.toContain('  - "ML"');
  });

  it('keeps the v1.25.10 floor of 2 when the setting is absent', async () => {
    const ctx = makeContext({ [PAGE]: makePage(['existing']) });
    await appendAliases(ctx, PAGE, ['ML']);
    expect(ctx.written.get(PAGE)!).toContain('  - "ML"');
  });

  it('resolveMinAliasLength falls back to the constant outside the accepted range', () => {
    expect(resolveMinAliasLength(undefined)).toBe(2);
    expect(resolveMinAliasLength({})).toBe(2);
    expect(resolveMinAliasLength({ minAliasLength: 3 })).toBe(3);
    expect(resolveMinAliasLength({ minAliasLength: 1 })).toBe(2);
    expect(resolveMinAliasLength({ minAliasLength: 7 })).toBe(2);
    expect(resolveMinAliasLength({ minAliasLength: 2.5 })).toBe(2);
  });
});

describe('appendAliases — cross-page uniqueness gate', () => {
  it('drops an alias another page already claims, keeps the rest', async () => {
    const ctx = makeContext({ [PAGE]: makePage(['existing']) });
    await appendAliases(ctx, PAGE, ['Wachheit', 'Aufmerksamkeit'], ['Aufmerksamkeit']);
    const written = ctx.written.get(PAGE)!;
    expect(written).toContain('  - "Wachheit"');
    expect(written).not.toContain('  - "Aufmerksamkeit"');
  });

  it('matches claims case-insensitively', async () => {
    const ctx = makeContext({ [PAGE]: makePage(['existing']) });
    await appendAliases(ctx, PAGE, ['wachheit'], ['Wachheit']);
    // every candidate collided — nothing to add, file untouched
    expect(ctx.written.get(PAGE)!).toBe(makePage(['existing']));
  });

  it('without the claims argument behaves as before (no cross-page gate)', async () => {
    const ctx = makeContext({ [PAGE]: makePage(['existing']) });
    await appendAliases(ctx, PAGE, ['Aufmerksamkeit']);
    expect(ctx.written.get(PAGE)!).toContain('  - "Aufmerksamkeit"');
  });
});

// The page's own aliases are the one list compared byte-exactly.
//
// `filterRedundantAliases` folds case for all three of its rules, and the
// cross-page gate above is pinned as case-insensitive. The dedup against the
// aliases already on THIS page is a plain `Array.includes`, so a candidate
// that differs from an existing entry only in case passes both stages and
// lands on the page next to it.
//
// Measured over 802 entity/concept pages: 3 carry such a pair — "NAC"/"NAc",
// "obstruktive Schlafapnoe"/"Obstruktive Schlafapnoe", "sustained
// attention"/"Sustained Attention".
describe('appendAliases — dedup against the page\'s own aliases', () => {
  it('does not add an alias that differs from an existing one only in case', async () => {
    const ctx = makeContext({ [PAGE]: makePage(['NAC']) });
    await appendAliases(ctx, PAGE, ['NAc']);
    expect(ctx.written.get(PAGE)!).toBe(makePage(['NAC']));
  });

  it('matches the own-page list with the same fold the cross-page gate uses', async () => {
    const ctx = makeContext({ [PAGE]: makePage(['sustained attention']) });
    await appendAliases(ctx, PAGE, ['Sustained Attention', 'Wachheit']);
    const written = ctx.written.get(PAGE)!;
    expect(written).toContain('  - "Wachheit"');
    expect(written).not.toContain('  - "Sustained Attention"');
  });

  it('keeps the spelling already on the page, not the incoming one', async () => {
    const ctx = makeContext({ [PAGE]: makePage(['Obstruktive Schlafapnoe']) });
    await appendAliases(ctx, PAGE, ['obstruktive Schlafapnoe']);
    expect(ctx.written.get(PAGE)!).toContain('  - "Obstruktive Schlafapnoe"');
    expect(ctx.written.get(PAGE)!).not.toContain('  - "obstruktive Schlafapnoe"');
  });

  it('still drops a batch-internal case variant (unchanged behaviour)', async () => {
    const ctx = makeContext({ [PAGE]: makePage(['existing']) });
    await appendAliases(ctx, PAGE, ['Wachheit', 'wachheit']);
    const written = ctx.written.get(PAGE)!;
    expect(written).toContain('  - "Wachheit"');
    expect(written).not.toContain('  - "wachheit"');
  });
});

describe('aliasClaimsFromPages', () => {
  const pages = [
    { path: 'wiki/entities/a.md', title: 'Alpha', aliases: ['A-Zeichen', ''] },
    { path: 'wiki/entities/b.md', title: 'Beta', aliases: undefined },
    { path: 'wiki/concepts/c.md', title: 'Gamma', aliases: ['Drittname'] },
  ];

  it('collects basenames and aliases of every OTHER page', () => {
    const claims = aliasClaimsFromPages(pages, 'wiki/entities/b.md');
    expect(claims).toContain('Alpha');
    expect(claims).toContain('A-Zeichen');
    expect(claims).toContain('Gamma');
    expect(claims).toContain('Drittname');
    expect(claims).not.toContain('Beta');
  });

  it('skips blank aliases', () => {
    const claims = aliasClaimsFromPages(pages, 'wiki/concepts/c.md');
    expect(claims).not.toContain('');
  });
});
