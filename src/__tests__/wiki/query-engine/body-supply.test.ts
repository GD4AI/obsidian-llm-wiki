/**
 * BODY SUPPLY — the second half of "the body is wired".
 *
 * The first half made `lexMatch` read `PageRef.text`. The second is getting a
 * body INTO the ref: `readWikiIndex` builds refs from the wiki index, which
 * carries a summary line and no prose, while the graph cache loads every page's
 * full content to build the graph and then throws the content away. The comment
 * on `PageRef.text` already says "the graph cache is what holds them" — this
 * test is what makes that sentence true.
 *
 * Two properties:
 *   1. `GraphCache` retains the bodies it loaded and exposes them by path.
 *   2. `withBodies` is pure: it returns NEW refs with `text` set and leaves the
 *      caller's refs untouched. A shared PageRef array is passed to
 *      `selectPprSeeds` and to the page-summary hint; mutating it would leak
 *      bodies into a prompt that expects one line per page.
 */
import { describe, it, expect } from 'vitest';
import { GraphCache } from '../../../wiki/engine-internals/graph-cache';
import { withBodies } from '../../../wiki/query-engine/pipeline/read-index';
import type { PageRef } from '../../../core/ppr-cascade';

describe('body supply — the graph cache holds what the answer path reads', () => {
  it('GraphCache keeps the loaded page bodies and exposes them by path', async () => {
    const cache = new GraphCache({
      wikiFolder: 'wiki',
      loadPages: async (paths) => [...paths].map(p => ({ path: p, content: `# ${p}\n\nbody prose for ${p}` })),
    });

    await cache.getOrBuild(new Set(['a', 'b']));
    const bodies = cache.getPageBodies();

    expect(bodies.get('a')).toContain('body prose for a');
    expect(bodies.get('b')).toContain('body prose for b');
  });

  it('withBodies sets text on NEW refs and does not mutate the caller array', () => {
    const refs: PageRef[] = [
      { path: 'a', title: 'A', aliases: [], summary: 'sa' },
      { path: 'b', title: 'B', aliases: [], summary: 'sb' },
    ];
    const before = refs.map(r => ({ ...r }));

    const out = withBodies(refs, new Map([['a', 'prose a'], ['b', 'prose b']]));

    expect(out[0].text).toBe('prose a');
    expect(out[1].text).toBe('prose b');
    // Purity: the caller's refs are byte-identical to before.
    expect(refs).toEqual(before);
    expect(out[0]).not.toBe(refs[0]);
  });

  it('withBodies leaves a page with no cached body without a text field', () => {
    const refs: PageRef[] = [{ path: 'a', title: 'A', aliases: [], summary: 'sa' }];
    const out = withBodies(refs, new Map());
    expect(out[0].text).toBeUndefined();
  });
});
