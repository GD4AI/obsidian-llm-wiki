import { describe, it, expect } from 'vitest';
import {
  findDeadLinkTarget,
  buildDeadLinkReplacement,
  replaceDeadLink,
  type PageRef,
} from '../../core/dead-link-detector';

describe('Dead Link Detector — Pure Functions', () => {
  describe('findDeadLinkTarget', () => {
    const mockPages: PageRef[] = [
      { path: 'wiki/entities/chain-of-thought.md', title: 'Chain of Thought', aliases: ['CoT', '思维链'] },
      { path: 'wiki/entities/large-language-model.md', title: 'Large Language Model', aliases: ['LLM'] },
      { path: 'wiki/concepts/attention-mechanism.md', title: 'Attention Mechanism' },
    ];

    it('finds exact title match (case-insensitive)', () => {
      const result = findDeadLinkTarget(mockPages, 'Chain of Thought');
      expect(result).toBeDefined();
      expect(result?.title).toBe('Chain of Thought');
    });

    it('finds case-insensitive title match', () => {
      const result = findDeadLinkTarget(mockPages, 'chain of thought');
      expect(result?.title).toBe('Chain of Thought');
    });

    it('finds alias match (exact case)', () => {
      const result = findDeadLinkTarget(mockPages, 'CoT');
      expect(result?.title).toBe('Chain of Thought');
    });

    it('finds alias match (case-insensitive)', () => {
      const result = findDeadLinkTarget(mockPages, 'cot');
      expect(result?.title).toBe('Chain of Thought');
    });

    it('finds CJK alias match', () => {
      const result = findDeadLinkTarget(mockPages, '思维链');
      expect(result?.title).toBe('Chain of Thought');
    });

    it('handles path in target (extracts basename)', () => {
      // #308: the basename is still extracted; it now also resolves, because
      // "attention-mechanism" and "Attention Mechanism" are the slugified and
      // the unslugified form of the same name. Before #308 this returned
      // undefined and the caller paid an LLM round trip for it.
      const result = findDeadLinkTarget(mockPages, 'concepts/attention-mechanism');
      expect(result?.title).toBe('Attention Mechanism');
    });

    it('extracts the basename and does not match the folder part', () => {
      const result = findDeadLinkTarget(mockPages, 'attention-mechanism/nonexistent');
      expect(result).toBeUndefined();
    });

    it('prefers title match over alias match', () => {
      // If target matches both title and alias, title should win
      const pagesWithOverlap: PageRef[] = [
        { path: 'wiki/entities/llm.md', title: 'LLM', aliases: ['Large Language Model'] },
        { path: 'wiki/concepts/llm-basics.md', title: 'LLM Basics', aliases: ['LLM'] },
      ];
      const result = findDeadLinkTarget(pagesWithOverlap, 'LLM');
      // First match wins: "LLM" (title)
      expect(result?.title).toBe('LLM');
    });

    it('returns undefined when no match', () => {
      const result = findDeadLinkTarget(mockPages, 'NonExistent');
      expect(result).toBeUndefined();
    });

    it('returns undefined for empty pages array', () => {
      const result = findDeadLinkTarget([], 'Any');
      expect(result).toBeUndefined();
    });

    it('handles pages without aliases', () => {
      const result = findDeadLinkTarget(mockPages, 'Attention Mechanism');
      expect(result?.title).toBe('Attention Mechanism');
    });

    it('matches first occurrence when multiple alias matches', () => {
      const pages: PageRef[] = [
        { path: 'wiki/entities/page1.md', title: 'Page 1', aliases: ['Shared'] },
        { path: 'wiki/entities/page2.md', title: 'Page 2', aliases: ['Shared'] },
      ];
      const result = findDeadLinkTarget(pages, 'Shared');
      expect(result?.title).toBe('Page 1');
    });

    // #308: a wiki link carries the slugified name, a title or alias carries the
    // written one. The pre-check compared them raw, so hyphen never met space.
    describe('slug-normalized matching (#308)', () => {
      const slugPages: PageRef[] = [
        {
          path: 'wiki/concepts/systemische-inflammation.md',
          title: 'Systemische-Inflammation',
          aliases: ['Systemische Inflammation'],
        },
        { path: 'wiki/entities/nervus-vagus.md', title: 'Nervus vagus' },
        {
          path: 'wiki/concepts/kurzkettige-fettsäuren.md',
          title: 'Kurzkettige Fettsäuren',
          aliases: ['SCFA'],
        },
        { path: 'wiki/entities/chain-of-thought.md', title: 'Chain of Thought' },
      ];

      it.each([
        // link target                  | expected page title        | why
        ['systemische-inflammation', 'Systemische-Inflammation'], // exact title, unchanged
        ['Systemische-Inflammation', 'Systemische-Inflammation'], // case-insensitive title, unchanged
        ['nervus-vagus', 'Nervus vagus'], // hyphen vs. space in the title
        ['Nervus-Vagus', 'Nervus vagus'], // hyphen vs. space, different case
        ['kurzkettige-fettsäuren', 'Kurzkettige Fettsäuren'], // umlaut survives slugify
        ['chain-of-thought', 'Chain of Thought'], // multi-word English case
        ['SCFA', 'Kurzkettige Fettsäuren'], // alias, exact — unchanged path
      ])('resolves %j to %j', (linkTarget, expectedTitle) => {
        expect(findDeadLinkTarget(slugPages, linkTarget)?.title).toBe(
          expectedTitle
        );
      });

      it.each([
        ['nervus-vagus-dorsalis'], // near miss, not the same name
        ['systemische'], // prefix only
        ['völlig-unbekannt'], // nothing like it in the vault
      ])('leaves %j unresolved', linkTarget => {
        expect(findDeadLinkTarget(slugPages, linkTarget)).toBeUndefined();
      });

      it('resolves a slugified link to an unslugified alias', () => {
        const pages: PageRef[] = [
          {
            path: 'wiki/concepts/scfa.md',
            title: 'SCFA',
            aliases: ['Kurzkettige Fettsäuren'],
          },
        ];
        const result = findDeadLinkTarget(pages, 'Kurzkettige-Fettsäuren');
        expect(result?.title).toBe('SCFA');
      });

      it('prefers an exact alias match over a slug title match on another page', () => {
        // Tier order matters: the exact match is the stronger evidence, so the
        // slug tiers must not overtake it just because they run over the same
        // page list.
        const pages: PageRef[] = [
          {
            path: 'wiki/concepts/other.md',
            title: 'Other',
            aliases: ['nervus-vagus'],
          },
          { path: 'wiki/entities/nervus-vagus.md', title: 'Nervus vagus' },
        ];
        const result = findDeadLinkTarget(pages, 'nervus-vagus');
        expect(result?.title).toBe('Other');
      });

      it('does not let an empty alias match a link to "untitled"', () => {
        const pages: PageRef[] = [
          { path: 'wiki/entities/page.md', title: 'Page', aliases: ['', '  '] },
        ];
        expect(findDeadLinkTarget(pages, 'untitled')).toBeUndefined();
      });

      it('does not let an empty title match a link to "untitled"', () => {
        const pages: PageRef[] = [{ path: 'wiki/entities/page.md', title: '' }];
        expect(findDeadLinkTarget(pages, 'untitled')).toBeUndefined();
      });
    });
  });

  describe('buildDeadLinkReplacement', () => {
    const mockPage: PageRef = {
      path: 'wiki/entities/chain-of-thought.md',
      title: 'Chain of Thought',
    };

    it('builds wiki link from page reference', () => {
      const result = buildDeadLinkReplacement(mockPage, 'wiki');
      expect(result).toBe('[[entities/chain-of-thought|Chain of Thought]]');
    });

    it('removes .md extension', () => {
      const result = buildDeadLinkReplacement(mockPage, 'wiki');
      expect(result).not.toContain('.md');
    });

    it('removes wiki folder prefix', () => {
      const result = buildDeadLinkReplacement(mockPage, 'wiki');
      expect(result).not.toContain('wiki/');
      expect(result).toContain('entities/chain-of-thought');
    });

    it('handles nested paths', () => {
      const nestedPage: PageRef = {
        path: 'wiki/concepts/deep/learning.md',
        title: 'Deep Learning',
      };
      const result = buildDeadLinkReplacement(nestedPage, 'wiki');
      expect(result).toBe('[[concepts/deep/learning|Deep Learning]]');
    });

    // Issue #592: `title` is the filename slug — prefer `displayTitle` (the page's real H1 or first alias) when set, since title-casing a slug can't recover punctuation, spacing, or subscripts a real heading has.
    it('prefers displayTitle over title when set', () => {
      const page: PageRef = {
        path: 'wiki/entities/haem-a3.md',
        title: 'haem-a3',
        displayTitle: 'Haem A₃',
      };
      const result = buildDeadLinkReplacement(page, 'wiki');
      expect(result).toBe('[[entities/haem-a3|Haem A₃]]');
    });

    it('falls back to title when displayTitle is absent', () => {
      const page: PageRef = {
        path: 'wiki/entities/haem-a3.md',
        title: 'haem-a3',
      };
      const result = buildDeadLinkReplacement(page, 'wiki');
      expect(result).toBe('[[entities/haem-a3|haem-a3]]');
    });
  });

  describe('replaceDeadLink', () => {
    const content = 'See [[思维链]] for details about reasoning.';

    it('replaces dead link with replacement', () => {
      const result = replaceDeadLink(content, '思维链', '[[entities/cot|Chain of Thought]]');
      expect(result).toContain('[[entities/cot|Chain of Thought]]');
      expect(result).not.toContain('[[思维链]]');
    });

    it('leaves other links unchanged', () => {
      const multiLink = 'See [[思维链]] and [[other]] for details.';
      const result = replaceDeadLink(multiLink, '思维链', '[[entities/cot|Chain of Thought]]');
      expect(result).toContain('[[other]]');
      expect(result).toContain('[[entities/cot|Chain of Thought]]');
    });

    it('handles links with display text', () => {
      const linkWithDisplay = 'See [[思维链|thinking chain]] for more.';
      const result = replaceDeadLink(linkWithDisplay, '思维链', '[[entities/cot|Chain of Thought]]');
      expect(result).toContain('[[entities/cot|Chain of Thought]]');
      expect(result).not.toContain('[[思维链|thinking chain]]');
    });

    it('handles links with section anchors', () => {
      const linkWithAnchor = 'See [[思维链#section]] for details.';
      const result = replaceDeadLink(linkWithAnchor, '思维链', '[[entities/cot|Chain of Thought]]');
      expect(result).toContain('[[entities/cot|Chain of Thought]]');
    });

    it('returns unchanged content when target not found', () => {
      const result = replaceDeadLink(content, 'nonexistent', '[[replacement]]');
      expect(result).toBe(content);
    });

    it('handles multiple occurrences of same target', () => {
      const multiOccurrence = 'See [[思维链]] and [[思维链]] again.';
      const result = replaceDeadLink(multiOccurrence, '思维链', '[[entities/cot|Chain of Thought]]');
      expect(result).toBe('See [[entities/cot|Chain of Thought]] and [[entities/cot|Chain of Thought]] again.');
    });

    it('trims whitespace in captured target', () => {
      const linkWithSpace = 'See [[  思维链  ]] for details.';
      const result = replaceDeadLink(linkWithSpace, '思维链', '[[entities/cot|Chain of Thought]]');
      expect(result).toContain('[[entities/cot|Chain of Thought]]');
    });
  });
});
