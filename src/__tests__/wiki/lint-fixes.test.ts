import { describe, it, expect } from 'vitest';
import { isPageEmpty, detectPollutedPages, fixDoubleNestedWikiLinks, escapeRegex, normalizeFrontmatterDates } from '../../wiki/lint/utils';

describe('fixDoubleNestedWikiLinks', () => {
  it('fixes double-nested with display text', () => {
    const { fixed, content } = fixDoubleNestedWikiLinks('Some text [[[[entities/Foo|Foo]]]] more text');
    expect(fixed).toBe(1);
    expect(content).toBe('Some text [[entities/Foo|Foo]] more text');
  });

  it('fixes double-nested without display text', () => {
    const { fixed, content } = fixDoubleNestedWikiLinks('See [[[[concepts/Bar]]]] here');
    expect(fixed).toBe(1);
    expect(content).toBe('See [[concepts/Bar]] here');
  });

  it('fixes multiple double-nested links', () => {
    const { fixed, content } = fixDoubleNestedWikiLinks('[[[[a|b]]]] and [[[[c]]]]');
    expect(fixed).toBe(2);
    expect(content).toBe('[[a|b]] and [[c]]');
  });

  it('does not affect normal wiki-links', () => {
    const text = 'Normal [[entities/Foo|Foo]] link and [[Bar]] too';
    const { fixed, content } = fixDoubleNestedWikiLinks(text);
    expect(fixed).toBe(0);
    expect(content).toBe(text);
  });

  it('handles content with no wiki-links', () => {
    const text = 'Plain text without any brackets';
    const { fixed, content } = fixDoubleNestedWikiLinks(text);
    expect(fixed).toBe(0);
    expect(content).toBe(text);
  });
});

describe('isPageEmpty', () => {
  it('detects stub marker as empty', () => {
    const content = '---\ntype: entity\ntags: [other]\n---\n\n> Auto-generated stub page — referenced by [[sources/some-file]].\n';
    expect(isPageEmpty(content)).toBe(true);
  });

  it('detects content under 50 characters as empty', () => {
    const content = '---\ntype: entity\n---\n\nShort text';
    expect(isPageEmpty(content)).toBe(true);
  });

  it('detects content over 50 characters as not empty', () => {
    const content = '---\ntype: entity\n---\n\n' + 'A'.repeat(60);
    expect(isPageEmpty(content)).toBe(false);
  });

  it('handles content without frontmatter', () => {
    const content = 'Bare markdown content that is long enough to pass the threshold test reliably.';
    expect(isPageEmpty(content)).toBe(false);
  });

  it('detects empty content as not empty when comment strip leaves many chars', () => {
    const content = '---\ntype: entity\n---\n\nThis is a real paragraph with enough characters to pass the check without any doubt.';
    expect(isPageEmpty(content)).toBe(false);
  });
});

describe('detectPollutedPages', () => {
  it('detects polluted basename with CJK characters', () => {
    const pages = [
      { path: 'wiki/concepts/concepts布局优化.md', title: 'concepts布局优化' },
    ];
    const result = detectPollutedPages(pages);
    expect(result).toHaveLength(1);
    expect(result[0].cleanTitle).toBe('布局优化');
  });

  it('detects polluted basename with ASCII letters', () => {
    const pages = [
      { path: 'wiki/entities/entities张三.md', title: 'entities张三' },
    ];
    const result = detectPollutedPages(pages);
    expect(result).toHaveLength(1);
    expect(result[0].cleanTitle).toBe('张三');
  });

  it('ignores clean basenames with separators', () => {
    const pages = [
      { path: 'wiki/concepts/Concepts-of-ML.md', title: 'Concepts-of-ML' },
      { path: 'wiki/concepts/Sources-list.md', title: 'Sources-list' },
    ];
    const result = detectPollutedPages(pages);
    expect(result).toHaveLength(0);
  });

  it('returns empty for clean pages', () => {
    const pages = [
      { path: 'wiki/entities/Qwen.md', title: 'Qwen' },
      { path: 'wiki/concepts/Attention.md', title: 'Attention' },
    ];
    const result = detectPollutedPages(pages);
    expect(result).toHaveLength(0);
  });

  it('handles empty input', () => {
    const result = detectPollutedPages([]);
    expect(result).toHaveLength(0);
  });

  it('filters polluted from mixed pages', () => {
    const pages = [
      { path: 'wiki/entities/Qwen.md', title: 'Qwen' },
      { path: 'wiki/concepts/concepts布局优化.md', title: 'concepts布局优化' },
      { path: 'wiki/sources/sources张三.md', title: 'sources张三' },
    ];
    const result = detectPollutedPages(pages);
    expect(result).toHaveLength(2);
    expect(result[0].cleanTitle).toBe('布局优化');
    expect(result[1].cleanTitle).toBe('张三');
  });
});

// ── escapeRegex ────────────────────────────────────────────────

describe('escapeRegex', () => {
  it('escapes special regex characters', () => {
    const result = escapeRegex('[.*+?^${}()|]');
    expect(result).toBe('\\[\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\]');
    // Verify it's a valid regex
    expect(() => new RegExp(result)).not.toThrow();
  });

  it('passes through regular text unchanged', () => {
    expect(escapeRegex('hello world')).toBe('hello world');
  });

  it('handles empty string', () => {
    expect(escapeRegex('')).toBe('');
  });

  // #931 sank this into `core/` because three core modules imported it from
  // this layer. The repo held three copies of the same body before that: one
  // here, one in `core/section-extractor.ts`, one in the core caller. This
  // assertion is what stops a fourth appearing — a second implementation that
  // keeps the same behaviour would pass every other test in this block.
  it('is one implementation, not a copy per layer', async () => {
    const core = await import('../../core/regex-escape');
    expect(core.escapeRegex).toBe(escapeRegex);
  });
});

// ── normalizeFrontmatterDates ───────────────────────────────────

describe('normalizeFrontmatterDates', () => {
  it('updates existing updated date', () => {
    const input = '---\ntype: entity\nupdated: 2025-01-01\n---\n\nBody';
    const result = normalizeFrontmatterDates(input, '2026-05-28');
    expect(result).toContain('updated: 2026-05-28');
    expect(result).not.toContain('2025-01-01');
  });

  it('adds updated field when missing', () => {
    const input = '---\ntype: entity\n---\n\nBody';
    const result = normalizeFrontmatterDates(input, '2026-05-28');
    expect(result).toContain('updated: 2026-05-28');
  });

  it('preserves other frontmatter fields', () => {
    const input = '---\ntype: concept\ntags: [method]\nupdated: 2025-06-01\n---\n\nBody';
    const result = normalizeFrontmatterDates(input, '2026-05-28');
    expect(result).toContain('type: concept');
    expect(result).toContain('tags: [method]');
  });

  it('returns content unchanged when no frontmatter exists', () => {
    const input = '# Just markdown\n\nNo frontmatter here';
    expect(normalizeFrontmatterDates(input, '2026-05-28')).toBe(input);
  });
});
