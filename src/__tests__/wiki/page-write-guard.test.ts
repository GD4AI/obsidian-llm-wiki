// Issue #603 slice 1: `applyPageGuard` as a pure function.
//
// These cover the half of the old write gate that corrects content. They are
// vault-free by construction — that is the point of extracting it — and the
// regression they exist to catch is behavioural equivalence with the inline
// form, not new features.

import { describe, it, expect, vi } from 'vitest';
import { applyPageGuard } from '../../wiki/page-write-guard';

const base = { wikiFolder: 'wiki', preserveCase: false, isWikiContentPage: true };

describe('applyPageGuard — link pollution (concerns 1a / 1b)', () => {
  it('collapses display-name pollution: [[entities/X|entities/X]] → [[entities/X|X]]', () => {
    const { content, corrections } = applyPageGuard(
      'See [[entities/Qwen|entities/Qwen]] for detail.',
      base
    );

    expect(content).toBe('See [[entities/Qwen|Qwen]] for detail.');
    expect(corrections.displayNamePollution).toBe(true);
  });

  it('collapses path-prefix duplication: [[concepts/X|…]] → [[concepts/…]]', () => {
    const { content, corrections } = applyPageGuard(
      'See [[concepts/concepts布局优化|布局优化]].',
      base
    );

    expect(content).toBe('See [[concepts/布局优化|布局优化]].');
    expect(corrections.pathPrefixPollution).toBe(true);
  });

  it('leaves a legitimate slug alone: concepts-of-ML keeps its hyphen', () => {
    // The '-' separator is what distinguishes a real slug from the duplicated
    // folder prefix, and the original inline regex relied on it.
    const { content, corrections } = applyPageGuard('[[concepts/concepts-of-ML|ML]]', base);

    expect(content).toBe('[[concepts/concepts-of-ML|ML]]');
    expect(corrections.pathPrefixPollution).toBe(false);
  });

  it('fixes pollution on every call, not every other call', () => {
    // The regression this pins: both patterns carry the `g` flag, and
    // `RegExp.prototype.test` advances `lastIndex` on a global regex. Had they
    // been hoisted to module scope instead of being rebuilt per call, the second
    // invocation would see a non-zero `lastIndex`, skip the correction, and the
    // third would work again — alternating between fixed and broken writes.
    const input = '[[entities/Qwen|entities/Qwen]]';

    for (let i = 0; i < 4; i++) {
      const { content } = applyPageGuard(input, base);
      expect(content, `call ${i + 1} must still correct`).toBe('[[entities/Qwen|Qwen]]');
    }
  });

  it('reports no corrections for clean content', () => {
    const { content, corrections } = applyPageGuard('# Clean\n\n[[entities/Qwen|Qwen]]', base);

    expect(content).toBe('# Clean\n\n[[entities/Qwen|Qwen]]');
    expect(corrections.displayNamePollution).toBe(false);
    expect(corrections.pathPrefixPollution).toBe(false);
    expect(corrections.sourcesEntries).toBe(0);
  });
});

describe('applyPageGuard — sources field (concern 1c)', () => {
  it('normalizes a polluted sources field and reports the entry count', () => {
    const { content, corrections } = applyPageGuard(
      '---\ntype: entity\nsources:\n  - "[[Notizen/Foo.md]]"\n---\n\nBody',
      base
    );

    expect(corrections.sourcesEntries).toBeGreaterThan(0);
    expect(content).not.toContain('[[Notizen/Foo.md]]');
  });

  it('reports zero entries when the sources field is already clean', () => {
    // The clean form is a bare name. `[[Note]]` is *not* clean — it is
    // normalized to `[[sources/note]]`, which the round-trip below pins.
    const { content, corrections } = applyPageGuard(
      '---\ntype: entity\nsources:\n  - Note\n---\n\nBody',
      base
    );

    expect(corrections.sourcesEntries).toBe(0);
    expect(content).toContain('sources:');
  });

  it('leaves a bare sources entry byte-identical', () => {
    const input = '---\nsources:\n  - Note\n---\n\nBody';
    const { content } = applyPageGuard(input, base);

    expect(content).toBe(input);
  });
});

describe('applyPageGuard — normalization (concern 2)', () => {
  it('normalizes heading spacing and provenance only for wiki content pages', () => {
    const messy = '# Heading\nBody text[^p]\n\n[^p]: source\n';

    const asPage = applyPageGuard(messy, base);
    expect(asPage.corrections.normalizedWikiPage).toBe(true);
    // Something changed: the spacing pass inserts a blank line after the heading.
    expect(asPage.content).not.toBe(messy);

    const asOther = applyPageGuard(messy, { ...base, isWikiContentPage: false });
    expect(asOther.corrections.normalizedWikiPage).toBe(false);
    // A log or a sidecar passes through untouched.
    expect(asOther.content).toBe(messy);
  });

  it('does not log — the caller owns the messages', () => {
    // The engine keeps the exact strings it had before the split, so the split
    // is invisible in the console. A logger here would double every warning.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    applyPageGuard('[[entities/Qwen|entities/Qwen]]', base);

    expect(warn).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });
});
