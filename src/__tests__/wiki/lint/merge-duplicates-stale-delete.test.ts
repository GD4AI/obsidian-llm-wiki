// Issue #825, the stale half only.
//
// `retargetLinksToPage` counts edits it could not apply — the cache promised
// `[[Source]]` at a position that no longer holds it — and `mergeDuplicatePages`
// warned about that count and then deleted the source anyway. The references it
// could not rewrite are the ones that become dead links, so the merge was a net
// producer of them: the reporter's next lint found 14 new dead links, nearly all
// pointing at pages a merge had just removed.
//
// The frontmatter half of the same issue is NOT here. `collectResolvingReferences`
// refusing to read `frontmatterLinks` is #386's deliberate scope, restated in
// #590, and widening it changes the write behaviour of every merge. That is a
// decision (tracked in #835), not a fix.
//
// Forcing the stale count naturally, and the first attempt at this failed in a
// way worth recording. The fake vault derives `getFileCache` from the file's own
// text, so the two always agree. Replacing the cached reference's `original`
// looks like the way to break that — but `retargetLinksToPage` computes the
// replacement by substituting into `original`, so a corrupted `original` makes
// the replacement equal to it, the edit is dropped as a no-op, and `stale` stays
// 0. Shifting the recorded **position** instead is both the real cause and the
// one that reaches the guard: the cache's offset no longer holds the link it
// recorded, which is exactly what `applyEdits` refuses to guess at.

import { describe, it, expect } from 'vitest';
import { mergeDuplicatePages } from '../../../wiki/lint/merge-duplicates';
import { createMergeCtx } from '../../__support__/link-vault';

const TARGET = 'wiki/entities/Osteopontin.md';
const SOURCE = 'wiki/entities/Osteopontin-2.md';
const NOTE = 'Notizen/Knochenstoffwechsel.md';

const FILES: Record<string, string> = {
  [TARGET]: '---\ntype: entity\ntags: [other]\n---\n\n# Osteopontin\n\nBone marker.\n',
  [SOURCE]: '---\ntype: entity\ntags: [other]\n---\n\n# Osteopontin-2\n\nAlso a bone marker.\n',
  [NOTE]: 'Reguliert durch [[Osteopontin-2]].\n',
};

interface FakeCache {
  getFileCache: (file: { path: string }) => { links?: Array<Record<string, unknown>>; embeds?: Array<Record<string, unknown>> } | null;
}

function makeCtx(files: Record<string, string> = FILES) {
  return createMergeCtx(files, { captureDeletes: true });
}

/** The note's cache lags the file: its recorded offsets no longer hold the link. */
function makeStaleCtx(files: Record<string, string> = FILES) {
  const made = makeCtx(files);
  const cache = (made.ctx.app as unknown as { metadataCache: FakeCache }).metadataCache;
  const real = cache.getFileCache.bind(cache);
  cache.getFileCache = (file: { path: string }) => {
    const entry = real(file);
    if (file.path !== NOTE || !entry?.links) return entry;
    return {
      ...entry,
      links: entry.links.map(l => {
        const p = l.position as { start: { offset: number }; end: { offset: number } };
        return {
          ...l,
          position: {
            start: { offset: p.start.offset + 10 },
            end: { offset: p.end.offset + 10 },
          },
        };
      }),
    };
  };
  return made;
}

describe('mergeDuplicatePages — a stale retarget must not delete the source (#825)', () => {
  it('keeps the source and reports the count instead of deleting', async () => {
    const { ctx, deleted, fake } = makeStaleCtx();

    const summary = await mergeDuplicatePages(ctx, TARGET, SOURCE);

    // The merge still happened — the target carries the fused body.
    expect(fake.read(TARGET)).toContain('# Osteopontin');
    // The source survives, because a reference to it could not be moved.
    expect(deleted).toEqual([]);
    expect(fake.read(SOURCE)).toContain('# Osteopontin-2');
    // And the run says so, rather than reporting an unqualified merge.
    expect(summary).toMatch(/1 link/);
    expect(summary).not.toBe('merged entities/Osteopontin-2 → entities/Osteopontin');
  });

  it('deletes exactly as before when nothing was stale', async () => {
    // The faithful cache, where the note really does hold the link it promises.
    const { ctx, deleted } = makeCtx();

    const summary = await mergeDuplicatePages(ctx, TARGET, SOURCE);

    expect(deleted).toEqual([SOURCE]);
    expect(summary).toBe('merged entities/Osteopontin-2 → entities/Osteopontin (1 link retargeted in 1 file)');
  });

  it('reports a source that survived the delete instead of claiming a clean merge', async () => {
    // Production's read-tolerant / delete-exact asymmetry, seen from the merge's
    // side: `tryReadFile` normalises the path and scans directories, while
    // `deleteFile` uses an exact key and returns void when it misses. So the log can
    // say `merged` with the source still on disk, and the next lint reports the same
    // pair again. A delete that does nothing is what that looks like from here.
    const { ctx } = makeCtx();
    (ctx as unknown as { deleteFile: (p: string) => Promise<void> }).deleteFile = async () => {};

    const summary = await mergeDuplicatePages(ctx, TARGET, SOURCE);

    expect(summary).toContain('could not be deleted');
  });
});
