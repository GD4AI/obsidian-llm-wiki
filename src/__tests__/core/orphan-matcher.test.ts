import { describe, it, expect, vi } from 'vitest';
import {
  buildOrphanLinkPrompt,
  validateOrphanLinkTarget,
  buildOrphanLinkUpdate,
  normalizeOrphanPagePath,
  retargetOrphanLinkTarget,
  type OrphanContext,
  type OrphanLinkSuggestion,
} from '../../core/orphan-matcher';

describe('Orphan Matcher — Pure Functions', () => {
  // Issue #824's acceptance criterion is that the orphan gains an inbound link.
  // Rebuilding the target from the orphan's own path is the only repair available
  // without a second model call, and it cannot be wrong: the page is there by
  // definition. The model's readable text is kept as the display label, because the
  // `_f7bbee` suffix is an ingester artefact the user should not have to read.
  describe('retargetOrphanLinkTarget', () => {
    const ORPHAN = 'wiki/sources/paste-rules_f7bbee.md';

    it('replaces an unresolvable bare target and keeps the guess as the label', () => {
      expect(retargetOrphanLinkTarget('[[sources/paste-rules]]', ORPHAN, 'wiki'))
        .toBe('[[sources/paste-rules_f7bbee|sources/paste-rules]]');
    });

    it('keeps an existing display label and changes only the target', () => {
      expect(retargetOrphanLinkTarget('[[sources/paste-rules|Paste Rules]]', ORPHAN, 'wiki'))
        .toBe('[[sources/paste-rules_f7bbee|Paste Rules]]');
    });

    it('builds a link when the model supplied no wikilink at all', () => {
      expect(retargetOrphanLinkTarget('paste rules', ORPHAN, 'wiki'))
        .toBe('[[sources/paste-rules_f7bbee]]');
    });

    it('drops a wiki prefix the model put on the target', () => {
      expect(retargetOrphanLinkTarget('[[wiki/sources/x|X]]', 'wiki/sources/x.md', 'wiki'))
        .toBe('[[sources/x|X]]');
    });

    it('handles an orphan outside the wiki folder', () => {
      // The resolver registers both forms, so this case must not grow a prefix.
      expect(retargetOrphanLinkTarget('[[X]]', 'sources/x.md', 'wiki'))
        .toBe('[[sources/x|X]]');
    });

    it('is idempotent on its own output', () => {
      const once = retargetOrphanLinkTarget('[[sources/paste-rules]]', ORPHAN, 'wiki');
      expect(retargetOrphanLinkTarget(once, ORPHAN, 'wiki')).toBe(once);
    });

    it('leaves a target that already names the page unchanged', () => {
      expect(retargetOrphanLinkTarget('[[sources/paste-rules_f7bbee]]', ORPHAN, 'wiki'))
        .toBe('[[sources/paste-rules_f7bbee]]');
    });
  });

  describe('buildOrphanLinkPrompt', () => {
    const mockContext: OrphanContext = {
      orphanContent: '# Orphan Page\n\nThis page needs links.',
      wikiIndex: '- [[entities/test|Test]]\n- [[concepts/example|Example]]',
      wikiFolder: 'wiki',
    };

    it('replaces all placeholders', () => {
      const template = 'Content: {{orphan_content}}\nIndex: {{wiki_index}}';
      const result = buildOrphanLinkPrompt(template, mockContext);

      expect(result).toContain('Content: # Orphan Page');
      expect(result).toContain('Index: - [[entities/test|Test]]');
    });

    it('handles empty template', () => {
      const result = buildOrphanLinkPrompt('', mockContext);
      expect(result).toBe('');
    });

    it('truncates orphan content to 2000 chars', () => {
      const longContent = 'x'.repeat(3000);
      const context: OrphanContext = { ...mockContext, orphanContent: longContent };
      const result = buildOrphanLinkPrompt('{{orphan_content}}', context);

      expect(result.length).toBeLessThan(2100);
    });

    it('truncates wiki index to 3000 chars', () => {
      const longIndex = 'y'.repeat(4000);
      const context: OrphanContext = { ...mockContext, wikiIndex: longIndex };
      const result = buildOrphanLinkPrompt('{{wiki_index}}', context);

      expect(result.length).toBeLessThan(3100);
    });

    it('preserves content under limits', () => {
      const shortContext: OrphanContext = {
        orphanContent: 'Short',
        wikiIndex: 'Brief',
        wikiFolder: 'wiki',
      };
      const result = buildOrphanLinkPrompt('{{orphan_content}} {{wiki_index}}', shortContext);
      expect(result).toBe('Short Brief');
    });

    it('replaces {{wikiFolder}} placeholder in template', () => {
      const template = 'Path: {{wikiFolder}}/entities/test.md';
      const context: OrphanContext = {
        orphanContent: 'content',
        wikiIndex: 'index',
        wikiFolder: 'mywiki',
      };
      const result = buildOrphanLinkPrompt(template, context);
      expect(result).toBe('Path: mywiki/entities/test.md');
    });

    it('replaces {{wikiFolder}} with default wiki value', () => {
      const template = 'Path: {{wikiFolder}}/entities/test.md';
      const result = buildOrphanLinkPrompt(template, mockContext);
      expect(result).toBe('Path: wiki/entities/test.md');
    });

    it('handles multiple occurrences of different placeholders', () => {
      const template = '{{orphan_content}} | {{wikiFolder}}/test | {{wiki_index}}';
      const result = buildOrphanLinkPrompt(template, mockContext);
      expect(result).toContain('# Orphan Page');
      expect(result).toContain('wiki/test');
      expect(result).toContain('- [[entities/test|Test]]');
    });

    it('handles special characters in content', () => {
      const specialContext: OrphanContext = {
        orphanContent: 'Special <>&"\' chars',
        wikiIndex: 'Index with [brackets]',
        wikiFolder: 'wiki',
      };
      const result = buildOrphanLinkPrompt('{{orphan_content}} {{wiki_index}}', specialContext);
      expect(result).toContain('Special <>&"\' chars');
      expect(result).toContain('Index with [brackets]');
    });

    it('handles multi-line content', () => {
      const multiLineContext: OrphanContext = {
        orphanContent: 'Line 1\nLine 2\nLine 3',
        wikiIndex: 'Index line',
        wikiFolder: 'wiki',
      };
      const result = buildOrphanLinkPrompt('{{orphan_content}}', multiLineContext);
      expect(result).toContain('Line 1\nLine 2\nLine 3');
    });
  });

  describe('validateOrphanLinkTarget', () => {
    it('returns true when target exists in content', () => {
      const content = 'This content has [[entities/target|Target]] link.';
      const result = validateOrphanLinkTarget(content, '[[entities/target|Target]]');
      expect(result).toBe(true);
    });

    it('returns false when target does not exist', () => {
      const content = 'This content has no matching link.';
      const result = validateOrphanLinkTarget(content, '[[missing|Missing]]');
      expect(result).toBe(false);
    });

    it('returns true for partial match', () => {
      const content = 'Content with [[entities/test|Test]]';
      const result = validateOrphanLinkTarget(content, '[[entities/test|Test]]');
      expect(result).toBe(true);
    });

    it('handles empty content', () => {
      const result = validateOrphanLinkTarget('', '[[any|Any]]');
      expect(result).toBe(false);
    });

    it('handles empty target', () => {
      const content = 'Some content';
      const result = validateOrphanLinkTarget(content, '');
      expect(result).toBe(true); // empty string is in any string
    });

    it('is case sensitive', () => {
      const content = 'Content with [[Test]]';
      const result = validateOrphanLinkTarget(content, '[[test]]');
      expect(result).toBe(false);
    });

    // Issue #824: the append decision must also consider whether the target is a
    // page at all. The model supplies a display-derived guess — measured on a real
    // vault as `[[sources/paste-rules]]` where the page is
    // `sources/paste-rules_f7bbee` — and appending it links into nothing. The
    // third parameter is optional, so every call above keeps its behaviour.
    describe('with a target resolver (#824)', () => {
      it('reports skip when the target resolves to no page', () => {
        expect(validateOrphanLinkTarget('no links here', '[[sources/paste-rules]]', () => false)).toBe(true);
      });

      it('falls back to the content check when the target does resolve', () => {
        expect(validateOrphanLinkTarget('no links here', '[[sources/paste-rules]]', () => true)).toBe(false);
        expect(validateOrphanLinkTarget('has [[sources/paste-rules]]', '[[sources/paste-rules]]', () => true)).toBe(true);
      });

      it('passes the raw link_target to the resolver', () => {
        const resolver = vi.fn(() => true);
        validateOrphanLinkTarget('x', '[[sources/a|A]]', resolver);
        expect(resolver).toHaveBeenCalledWith('[[sources/a|A]]');
      });
    });
  });

  describe('buildOrphanLinkUpdate', () => {
    // Issue #824: `link_text` is a sentence the model writes, and it sometimes
    // already ends with the link. Appending `link_target` unconditionally then
    // produces `[[X|Y]]. [[X|Y]]` on one line — measured on a real vault.
    it('does not append a second copy when link_text already carries the link', () => {
      const result = buildOrphanLinkUpdate(
        '# Related topic\n\nBody.',
        { pagePath: 'entities/r.md', linkText: 'See [[orphans/o|Orphan]]', linkTarget: '[[orphans/o|Orphan]]' },
        'Related Pages'
      );
      const occurrences = result.split('[[orphans/o|Orphan]]').length - 1;
      expect(occurrences).toBe(1);
    });

    it('still appends when link_text is prose, so the guard is not a blanket drop', () => {
      const result = buildOrphanLinkUpdate(
        '# Related topic\n\nBody.',
        { pagePath: 'entities/r.md', linkText: 'See also', linkTarget: '[[orphans/o|Orphan]]' },
        'Related Pages'
      );
      expect(result).toContain('- See also [[orphans/o|Orphan]]');
    });

    const mockSuggestion: OrphanLinkSuggestion = {
      pagePath: 'entities/related.md',
      linkText: '- See also',
      linkTarget: '[[orphans/orphan|Orphan Page]]',
    };

    it('adds link to existing section', () => {
      const content = '# Related\n\n## Related Pages\n- Existing link';
      const result = buildOrphanLinkUpdate(content, mockSuggestion, 'Related Pages');

      expect(result).toContain('## Related Pages');
      expect(result).toContain('- Existing link');
      expect(result).toContain('- See also [[orphans/orphan|Orphan Page]]');
    });

    it('creates new section if not exists', () => {
      const content = '# Related\n\nSome content.';
      const result = buildOrphanLinkUpdate(content, mockSuggestion, 'Related Pages');

      expect(result).toContain('## Related Pages');
      expect(result).toContain('Some content.');
      expect(result).toContain('- See also [[orphans/orphan|Orphan Page]]');
    });

    it('handles empty content', () => {
      const result = buildOrphanLinkUpdate('', mockSuggestion, 'Related');
      expect(result).toContain('## Related');
      expect(result).toContain('- See also');
    });

    it('handles different section headers', () => {
      const content = 'Content';
      const result = buildOrphanLinkUpdate(content, mockSuggestion, 'See Also');
      expect(result).toContain('## See Also');
    });

    it('preserves existing format', () => {
      const content = '# Title\n\nBody text.';
      const result = buildOrphanLinkUpdate(content, mockSuggestion, 'Links');
      expect(result.startsWith('# Title\n\nBody text.')).toBe(true);
      expect(result).toContain('## Links');
    });
  });

  describe('normalizeOrphanPagePath', () => {
    it('returns full path as-is', () => {
      const result = normalizeOrphanPagePath('wiki/entities/page.md', 'wiki');
      expect(result).toBe('wiki/entities/page.md');
    });

    it('adds wiki folder prefix to relative path', () => {
      const result = normalizeOrphanPagePath('entities/page.md', 'wiki');
      expect(result).toBe('wiki/entities/page.md');
    });

    it('does not treat sibling folders sharing a name prefix as absolute (issue #383)', () => {
      // Unanchored startsWith('wiki') wrongly treated wiki-concepts/... as already absolute.
      const result = normalizeOrphanPagePath('wiki-concepts/page.md', 'wiki');
      expect(result).toBe('wiki/wiki-concepts/page.md');
    });

    it('handles root-level paths', () => {
      const result = normalizeOrphanPagePath('page.md', 'wiki');
      expect(result).toBe('wiki/page.md');
    });

    it('handles nested paths', () => {
      const result = normalizeOrphanPagePath('a/b/c/page.md', 'wiki');
      expect(result).toBe('wiki/a/b/c/page.md');
    });

    it('handles empty path', () => {
      const result = normalizeOrphanPagePath('', 'wiki');
      expect(result).toBe('wiki/');
    });
  });
});
