// Issue #826: dedup can pair a page with itself, and the merge path carries no
// `target !== source` guard — so the run writes the page and then deletes the
// same path. The chain is longer than the report says, and the last step is the
// one that loses the page:
//
//   `dedup-phase` filters only that target and source are non-empty strings.
//   `normalizeLLMPath` runs in the `.map()` AFTER that filter, so two different
//   strings that resolve to one page pass it. `mergeDuplicatePages(A, A)` reads
//   the same file twice — both reads succeed, so the existing not-found guard
//   does not fire — writes `targetPath`, then calls `retargetLinksToPage(A, A)`,
//   which returns `{…, stale: 0}` from `link-retarget.ts:147`. Because the stale
//   count is zero, the `stale > 0` branch does not fire and `deleteFile(sourcePath)`
//   deletes the target. The log then reports `merged A → A`.
//
// Measured, not assumed: `normalizeLLMPath` collapses a literally identical pair
// AND a pair that differs only by the `wiki/` prefix. It does NOT collapse
// `./entities/A.md`, which becomes `wiki/./entities/A.md` — a malformed path, a
// different defect, and not the one under test here.
//
// This is why #825's fix cannot cover #826: in the self-pair case `stale` is
// exactly 0, so "do not delete when stale > 0" never triggers. The guards have
// to be independent, which is why this ships first.

import { describe, it, expect, vi } from 'vitest';
import { mergeDuplicatePages, canonicalPagePath } from '../../../wiki/lint/merge-duplicates';
import { runDuplicateMerges } from '../../../wiki/lint/fix-runners';
import type { LintContext } from '../../../wiki/lint/types';
import { createMergeCtx } from '../../__support__/link-vault';

const PAGE = 'wiki/entities/Ferritin.md';
const OTHER = 'wiki/entities/Ferritin-2.md';
const PAGE_CONTENT = '---\ntype: entity\ntags: [substance]\n---\n\n# Ferritin\n\nIron store.\n';
const OTHER_CONTENT = '---\ntype: entity\ntags: [substance]\n---\n\n# Ferritin-2\n\nAlso the iron store.\n';

/** Minimal LintContext — only the fields `runDuplicateMerges` reads. */
function makeLintCtx(): LintContext {
  return {
    app: {} as LintContext['app'],
    settings: {
      wikiFolder: 'wiki',
      language: 'en',
      pageGenerationConcurrency: 1,
      batchDelayMs: 0,
      model: 'test-model',
    } as unknown as LintContext['settings'],
    llmClient: null,
    wikiEngine: {
      mergeDuplicatePages: vi.fn().mockResolvedValue('merged'),
    } as unknown as LintContext['wikiEngine'],
    onAnalyzeSchema: vi.fn(),
  } as unknown as LintContext;
}

describe('mergeDuplicatePages — a self-pair must be refused (#826)', () => {
  it('refuses target === source, and writes and deletes nothing', async () => {
    const { ctx, fake, deleted } = createMergeCtx(
      { [PAGE]: PAGE_CONTENT },
      { captureDeletes: true },
    );
    const before = fake.read(PAGE);

    await expect(mergeDuplicatePages(ctx, PAGE, PAGE)).rejects.toThrow(/same page|itself/i);

    // The page survives verbatim — no rewritten frontmatter, no delete.
    expect(fake.read(PAGE)).toBe(before);
    expect(deleted).toEqual([]);
  });

  it('still merges a genuine pair, so the guard is not a blanket refusal', async () => {
    const { ctx, fake, deleted } = createMergeCtx(
      { [PAGE]: PAGE_CONTENT, [OTHER]: OTHER_CONTENT },
      { captureDeletes: true },
    );

    await mergeDuplicatePages(ctx, PAGE, OTHER);

    expect(fake.read(PAGE)).toContain('# Ferritin');
    // The source is deleted, which is the behaviour the guard must preserve.
    expect(deleted).toEqual([OTHER]);
  });
});

describe('runDuplicateMerges — a self-pair must never reach the merge (#826)', () => {
  it('drops the self-pair instead of calling mergeDuplicatePages with it', async () => {
    const ctx = makeLintCtx();

    const { merged, results } = await runDuplicateMerges(ctx, undefined, [
      { target: PAGE, source: PAGE, reason: 'self' },
    ]);

    expect(ctx.wikiEngine.mergeDuplicatePages).not.toHaveBeenCalled();
    expect(merged).toBe(0);
    expect(results).toEqual([]);
  });

  it('drops only the self-pair when a genuine pair shares the run', async () => {
    const ctx = makeLintCtx();

    const { merged } = await runDuplicateMerges(ctx, undefined, [
      { target: PAGE, source: PAGE, reason: 'self' },
      { target: PAGE, source: OTHER, reason: 'genuine' },
    ]);

    expect(ctx.wikiEngine.mergeDuplicatePages).toHaveBeenCalledTimes(1);
    expect(ctx.wikiEngine.mergeDuplicatePages).toHaveBeenCalledWith(PAGE, OTHER);
    expect(merged).toBe(1);
  });

  it('drops a self-pair that differs only in spelling', async () => {
    // The runner is the second line of defence: without the canonical comparison
    // this pair reaches `mergeDuplicatePages`, is refused there, and is reported to
    // the user as a failure. Dropping it here is quiet and correct.
    const ctx = makeLintCtx();

    const { merged, results } = await runDuplicateMerges(ctx, undefined, [
      { target: PAGE, source: './wiki//entities/Ferritin', reason: 'same page, different spelling' },
    ]);

    expect(ctx.wikiEngine.mergeDuplicatePages).not.toHaveBeenCalled();
    expect(merged).toBe(0);
    expect(results).toEqual([]);
  });
});

// Issue #826's acceptance criterion is "whenever both sides resolve to the same
// file", and the first fix compared strings — which caught a repeated path and a
// missing `wiki/` prefix, and nothing else. These are the variants that survived
// it. NFC/NFD is the one that costs data: `tryReadFile` normalises and scans
// directories so both spellings read one file, while `deleteFile` uses an exact
// key, so the self-pair either deleted the only copy or silently did nothing while
// the log reported a merge.
describe('canonicalPagePath — the spellings that denote one file (#826)', () => {
  const CANONICAL = 'wiki/entities/Ferritin.md';

  it.each([
    ['wiki/entities/Ferritin.md', 'literally repeated'],
    ['./wiki/entities/Ferritin.md', './ prefix'],
    ['wiki//entities/Ferritin.md', 'doubled slash'],
    ['wiki/entities/Ferritin', 'no .md suffix'],
    ['wiki/entities/ferritin.md', 'different case'],
    ['WIKI/ENTITIES/FERRITIN.MD', 'different case throughout'],
  ])('treats %s as the same page (%s)', other => {
    expect(canonicalPagePath(other)).toBe(canonicalPagePath(CANONICAL));
  });

  // A missing `wiki/` prefix is NOT in the list above, and that is a boundary
  // rather than an oversight: `canonicalPagePath` is not told the wiki folder, so
  // it cannot add one. Prefixing is `normalizeLLMPath`'s job in `dedup-phase`, and
  // by the time a pair reaches the merge both sides have been through it. Widening
  // this helper to guess the folder would mean guessing, which is the failure mode
  // it exists to remove.
  it('does not invent a wiki prefix, because it is not told the folder', () => {
    expect(canonicalPagePath('entities/Ferritin.md')).toBe('entities/ferritin');
  });

  it('folds the NFC/NFD spellings of one name together', () => {
    expect(canonicalPagePath('wiki/entities/Cafe\u0301.md'))
      .toBe(canonicalPagePath('wiki/entities/Caf\u00e9.md'));
  });

  it('keeps two genuinely different pages apart', () => {
    expect(canonicalPagePath('wiki/entities/Ferritin-2.md'))
      .not.toBe(canonicalPagePath(CANONICAL));
  });

  it('is deliberately case-insensitive, and that is the safe direction', () => {
    // On a case-sensitive filesystem this refuses a merge that would have been
    // legitimate: a duplicate stays, visible in the next lint. The other direction
    // deletes a page and says nothing.
    expect(canonicalPagePath('wiki/entities/Foo.md')).toBe(canonicalPagePath('wiki/entities/foo.md'));
  });

  it('refuses the NFC/NFD pair at the merge, not only in the filter', async () => {
    const { ctx, deleted } = createMergeCtx(
      { 'wiki/entities/Cafe\u0301.md': PAGE_CONTENT },
      { captureDeletes: true },
    );
    await expect(
      mergeDuplicatePages(ctx, 'wiki/entities/Caf\u00e9.md', 'wiki/entities/Cafe\u0301.md'),
    ).rejects.toThrow(/same page/i);
    expect(deleted).toEqual([]);
  });
});
