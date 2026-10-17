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
import { mergeDuplicatePages } from '../../../wiki/lint/merge-duplicates';
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
});
