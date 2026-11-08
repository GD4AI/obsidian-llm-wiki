// #912 (item 2 of #904's remainder): a ceiling learned from a rejected
// `max_tokens` must outlive the note that learned it.

import { describe, expect, it } from 'vitest';

import { OutputCeilingCache } from '../../core/output-ceiling-cache';

describe('OutputCeilingCache (#912)', () => {
  it('has no verdict before a probe', () => {
    expect(new OutputCeilingCache().get('http://gw', 'm1')).toBeUndefined();
  });

  it('remembers a ceiling the provider accepted', () => {
    const cache = new OutputCeilingCache();
    cache.set('http://gw', 'm1', 64_000);
    expect(cache.get('http://gw', 'm1')).toBe(64_000);
  });

  it('keeps sibling models apart, because one gateway can host both', () => {
    const cache = new OutputCeilingCache();
    cache.set('http://gw', 'small', 8_000);
    expect(cache.get('http://gw', 'small')).toBe(8_000);
    expect(cache.get('http://gw', 'large'), 'a sibling is not the same pair').toBeUndefined();
  });

  it('keeps the same model apart when the gateway URL changes', () => {
    const cache = new OutputCeilingCache();
    cache.set('http://gw-a', 'm1', 32_000);
    expect(cache.get('http://gw-b', 'm1')).toBeUndefined();
  });

  it('takes the latest verdict for a pair, not the first', () => {
    const cache = new OutputCeilingCache();
    cache.set('http://gw', 'm1', 64_000);
    cache.set('http://gw', 'm1', 32_000);
    expect(cache.get('http://gw', 'm1')).toBe(32_000);
  });

  it('clears every pair when the account or gateway is replaced', () => {
    const cache = new OutputCeilingCache();
    cache.set('http://gw-a', 'm1', 64_000);
    cache.set('http://gw-b', 'm2', 32_000);
    cache.invalidate();
    expect(cache.size).toBe(0);
  });

  it('clears one gateway without touching another', () => {
    const cache = new OutputCeilingCache();
    cache.set('http://gw-a', 'm1', 64_000);
    cache.set('http://gw-a', 'm2', 32_000);
    cache.set('http://gw-b', 'm1', 16_000);
    cache.invalidate('http://gw-a');
    expect(cache.get('http://gw-a', 'm1')).toBeUndefined();
    expect(cache.get('http://gw-a', 'm2')).toBeUndefined();
    expect(cache.get('http://gw-b', 'm1'), 'another gateway keeps its verdict').toBe(16_000);
  });

  it('does not clear a gateway whose URL merely starts the same way', () => {
    // `http://gw` is a prefix of `http://gw-2`; the separator in the key is
    // what stops one gateway's invalidation from reaching another.
    const cache = new OutputCeilingCache();
    cache.set('http://gw', 'm1', 64_000);
    cache.set('http://gw-2', 'm1', 8_000);
    cache.invalidate('http://gw');
    expect(cache.get('http://gw', 'm1')).toBeUndefined();
    expect(cache.get('http://gw-2', 'm1')).toBe(8_000);
  });
});
