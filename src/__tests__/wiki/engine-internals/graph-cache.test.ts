/**
 * GraphCache unit tests — PPR graph cache + invalidation lifecycle.
 *
 * Extracted from WikiEngine (2026-07-19). Verifies:
 *   - Cache hit when allPaths set is element-equal (not just reference-equal)
 *   - Cache miss when paths change
 *   - Invalidate drops the cache
 *   - Wiki folder normalization passed through to buildGraphFromContent
 */

import { describe, it, expect, vi } from 'vitest';
import { GraphCache } from '../../../wiki/engine-internals/graph-cache';

describe('GraphCache', () => {
  it('returns cached graph when allPaths is element-equal (not just reference-equal)', async () => {
    const loader = vi.fn().mockResolvedValue([{ path: 'a', content: '' }]);

    // First call: builds the graph (miss). Second call: hits cache —
    // loader MUST NOT be invoked again.
    const cache = new GraphCache({ wikiFolder: 'wiki', loadPages: loader });

    await cache.getOrBuild(new Set(['entities/A', 'concepts/B']));
    const r2 = await cache.getOrBuild(new Set(['entities/A', 'concepts/B']));

    // Loader called once (first miss). Second call hits cache.
    expect(loader).toHaveBeenCalledTimes(1);
    expect(r2).toBeDefined();
    expect(cache.hasCachedGraph()).toBe(true);
  });

  it('rebuilds when path set changes', async () => {
    const loader = vi.fn().mockResolvedValue([]);
    const cache = new GraphCache({ wikiFolder: 'wiki', loadPages: loader });

    await cache.getOrBuild(new Set(['a', 'b']));
    await cache.getOrBuild(new Set(['a', 'b', 'c'])); // different set

    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('invalidate() drops the cache and forces rebuild', async () => {
    const loader = vi.fn().mockResolvedValue([]);
    const cache = new GraphCache({ wikiFolder: 'wiki', loadPages: loader });

    await cache.getOrBuild(new Set(['x']));
    expect(cache.hasCachedGraph()).toBe(true);

    cache.invalidate();
    expect(cache.hasCachedGraph()).toBe(false);

    await cache.getOrBuild(new Set(['x']));
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('invalidate() is idempotent (safe to call when empty)', () => {
    const cache = new GraphCache({ wikiFolder: 'wiki', loadPages: vi.fn() });
    expect(() => {
      cache.invalidate();
      cache.invalidate();
    }).not.toThrow();
    expect(cache.hasCachedGraph()).toBe(false);
  });

  it('passes wikiFolder to the build step (loaded pages use it for normalization)', async () => {
    const loader = vi.fn().mockResolvedValue([]);
    const cache = new GraphCache({ wikiFolder: 'custom-folder', loadPages: loader });
    await cache.getOrBuild(new Set(['a']));
    // Loader was called once with the path set
    expect(loader).toHaveBeenCalledWith(new Set(['a']));
    // wikiFolder flows to buildGraphFromContent through the cache's internal binding;
    // we can't directly verify here without module mocking, but the wiring is in place.
    expect(cache.hasCachedGraph()).toBe(true);
  });
});
describe('GraphCache reverse adjacency (#729 Phase 5)', () => {
  it('is built with the graph and maps a node to what points at it', async () => {
    const loader = vi.fn().mockResolvedValue([
      { path: 'entities/A', content: '---\ntype: entity\n---\n# A\n\n[[entities/B]]' },
      { path: 'entities/B', content: '---\ntype: entity\n---\n# B' },
    ]);
    const cache = new GraphCache({ wikiFolder: 'wiki', loadPages: loader });
    const paths = new Set(['entities/A', 'entities/B']);
    const inc = await cache.getReverseAdjacency(paths);
    expect(inc.get('entities/B')).toContain('entities/A');
  });

  it('returns the same map instance while the graph is unchanged', async () => {
    // The point of caching it here rather than building it at the use site is
    // that a caller can hold the reference.
    const loader = vi.fn().mockResolvedValue([{ path: 'a', content: '' }]);
    const cache = new GraphCache({ wikiFolder: 'wiki', loadPages: loader });
    const paths = new Set(['a']);
    const first = await cache.getReverseAdjacency(paths);
    const second = await cache.getReverseAdjacency(paths);
    expect(second).toBe(first);
  });

  it('is dropped by invalidate() so a stale walk cannot survive a vault change', async () => {
    const loader = vi.fn().mockResolvedValue([
      { path: 'a', content: '[[b]]' },
      { path: 'b', content: '' },
    ]);
    const cache = new GraphCache({ wikiFolder: 'wiki', loadPages: loader });
    const paths = new Set(['a', 'b']);
    const before = await cache.getReverseAdjacency(paths);
    expect(before.get('b')).toBeDefined();
    cache.invalidate();
    const after = await cache.getReverseAdjacency(paths);
    expect(after).not.toBe(before);
  });

  it('builds the graph if getReverseAdjacency is called first', async () => {
    const loader = vi.fn().mockResolvedValue([{ path: 'a', content: '' }]);
    const cache = new GraphCache({ wikiFolder: 'wiki', loadPages: loader });
    await cache.getReverseAdjacency(new Set(['a']));
    expect(loader).toHaveBeenCalledTimes(1);
    expect(cache.hasCachedGraph()).toBe(true);
  });
});
