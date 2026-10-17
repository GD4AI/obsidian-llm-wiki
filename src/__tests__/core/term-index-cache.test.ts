/**
 * TERM INDEX CACHE — the 200x that was not a code problem.
 *
 * `buildPageTerms` + `buildCorpusTerms` run on every query. Measured on 2,864
 * synthetic pages with bodies: 4.4 s per rebuild against 21 ms to score from a
 * prebuilt index — about 200x. The scoring was never slow. Rebuilding the same
 * table from the same pages, once per question, was.
 *
 * The cache keys on the wiki INDEX FILE, not on the path set. `QueryView` reads
 * `index.md` on every query and builds `PageRef[]` from it; when the file has
 * not changed the refs are equivalent but never identical, so pointer identity
 * would miss every time. The index content is the thing that determines the
 * terms — title, aliases and summary all come from it — so it is the right key.
 * The body is added separately and changes under the same vault writes that
 * change the index.
 *
 * Two indexes, because two callers need different fields and building the full
 * one when the caller wants the name tier is waste:
 *
 *   nameTier  title + aliases only. Stage 1's seed ranking and the coverage
 *             gate run on it, deliberately without summary or body — a seed
 *             must not be moved by prose.
 *   full      title + aliases + summary + body. The answer path's lexical
 *             channel runs on it.
 *
 * Three properties:
 *   1. The same index content returns the same instance. Pointer identity is
 *      the test — `toEqual` would pass against a cache that rebuilds.
 *   2. Changed index content rebuilds. A stale term table is worse than a slow
 *      one: it ranks on words a page no longer has.
 *   3. The name tier really excludes the body. The seed stage depends on it,
 *      and a shared cache would break it silently.
 */
import { describe, it, expect } from 'vitest';
import { TermIndexCache } from '../../core/term-index-cache';
import type { PageRef } from '../../core/ppr-cascade';

function ref(path: string, text = ''): PageRef {
  return { path, title: `title ${path}`, aliases: [`a${path}`], summary: `summary ${path}`, text };
}

describe('term index cache — build once, score many', () => {
  it('returns the same term index for the same index content', () => {
    const cache = new TermIndexCache();
    const refs = [ref('x', 'body prose x'), ref('y', 'body prose y')];

    const first = cache.getFull('idx-v1', refs);
    const second = cache.getFull('idx-v1', refs);

    expect(first).not.toBeNull();
    expect(second).toBe(first);
  });

  it('changed index content rebuilds', () => {
    const cache = new TermIndexCache();
    const refs = [ref('x', 'body prose x')];

    const before = cache.getFull('idx-v1', refs);
    const after = cache.getFull('idx-v2', refs);

    expect(after).not.toBe(before);
  });

  it('the name tier excludes the body and the full index includes it', () => {
    const cache = new TermIndexCache();
    const refs = [ref('x', 'needle in the body')];

    const name = cache.getNameTier('idx-v1', refs);
    const full = cache.getFull('idx-v1', refs);

    // The body's distinctive word must be absent from the name-tier table and
    // present in the full one. If one cache serves both, the seed stage starts
    // ranking on prose and this fails.
    expect(name.pageTerms[0].fields.text.tf.size).toBe(0);
    expect(full.pageTerms[0].fields.text.tf.size).toBeGreaterThan(0);
  });

  it('the two indexes are cached independently', () => {
    const cache = new TermIndexCache();
    const refs = [ref('x', 'body')];

    cache.getNameTier('idx-v1', refs);
    expect(cache.getFull('idx-v1', refs)).toBe(cache.getFull('idx-v1', refs));
  });

  it('a body change rebuilds — the key covers the bodies, not just the index file', () => {
    // THE STALE-INDEX BUG. The cache is keyed on the wiki index file, but the
    // full index also carries body terms and the bodies come from the graph
    // cache, not from `index.md`. `QueryView.invalidateGraph` runs on lint, not
    // on every vault write, so it cannot be the only guard: a prose edit that
    // leaves `index.md` alone must still rebuild.
    //
    // The key is therefore a content signature over the index file AND the
    // bodies. `invalidate()` still exists for callers that want to force a
    // rebuild, but correctness does not depend on remembering to call it.
    const cache = new TermIndexCache();

    const before = cache.getFull('idx-v1', [ref('x', 'alpha')]);
    const after = cache.getFull('idx-v1', [ref('x', 'omega')]);

    expect(after).not.toBe(before);
    expect(after.pageTerms[0].fields.text.tf.has('omega')).toBe(true);
    expect(after.pageTerms[0].fields.text.tf.has('alpha')).toBe(false);
  });

  it('invalidate() still forces a rebuild on an unchanged signature', () => {
    const cache = new TermIndexCache();
    const refs = [ref('x', 'same body')];

    const first = cache.getFull('idx-v1', refs);
    cache.invalidate();

    expect(cache.getFull('idx-v1', refs)).not.toBe(first);
  });
});
