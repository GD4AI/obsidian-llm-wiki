// PR #3 split: Pure-renderer unit tests for the split-from-QueryView helpers.
// These cover the small extracted utilities (thinking-extract / wiki-link-clicks
// / retrieval-label) — the rest of QueryView's surface stays covered by the
// existing query-thinking-ui.test.ts (7 cases) and query-view-graph-invalidation.test.ts
// (4 cases).
//
// Test environment follows existing pattern: jsdom + global activeDocument stub.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { extractThinkingPanel } from '../../wiki/query-engine/renderers/thinking-extract';
import { bindWikiLinkClicks } from '../../wiki/query-engine/renderers/wiki-link-clicks';
import { renderRetrievalLabel } from '../../wiki/query-engine/renderers/retrieval-label';
import type { RetrievalLabelData } from '../../wiki/query-engine/types';
import { installObsidianDomHelpers } from '../__support__/dom-helpers';

beforeEach(() => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  const doc = dom.window.document;
  // eslint-disable-next-line obsidianmd/no-global-this
  globalThis.document = doc;
  // eslint-disable-next-line obsidianmd/no-global-this
  (globalThis as Record<string, unknown>).activeDocument = doc;
  // eslint-disable-next-line obsidianmd/no-global-this
  globalThis.HTMLElement = dom.window.HTMLElement;
  installObsidianDomHelpers(
    { HTMLElement: dom.window.HTMLElement, Document: dom.window.Document },
    doc,
  );
});

afterEach(() => {
  // eslint-disable-next-line obsidianmd/no-global-this
  delete (globalThis as Record<string, unknown>).document;
  // eslint-disable-next-line obsidianmd/no-global-this
  delete (globalThis as Record<string, unknown>).activeDocument;
  // eslint-disable-next-line obsidianmd/no-global-this
  delete (globalThis as Record<string, unknown>).HTMLElement;
});

describe('extractThinkingPanel', () => {
  // v1.25.2 PATCH: extractThinkingPanel takes a `parent` HTMLElement so
  // the extracted <details> is built against the parent's createEl
  // (avoiding Obsidian runtime's "Only one element on document"
  // auto-attach bug).
  const makeParent = (): HTMLElement => activeDocument.body.createDiv();

  it('returns null thinkingEl + visible content identical to input when no think tags', () => {
    const result = extractThinkingPanel('Hello world. Markdown content.', 'en', 'wiki', makeParent());
    expect(result.thinkingEl).toBeNull();
    expect(result.normalized).toBe('Hello world. Markdown content.');
  });

  it('extracts a thinking block and returns a details DOM element', () => {
    const tagOpen = String.fromCharCode(60) + 'think' + String.fromCharCode(62); // 'think' open
    const tagClose = String.fromCharCode(60) + '/think' + String.fromCharCode(62); // 'think' close
    const input = 'Hello. ' + tagOpen + 'thinking-content' + tagClose + ' done.';
    const result = extractThinkingPanel(input, 'en', 'wiki', makeParent());
    expect(result.thinkingEl).not.toBeNull();
    expect(result.thinkingEl?.tagName).toBe('DETAILS');
    expect(result.normalized).not.toContain('thinking-content');
  });
});

describe('bindWikiLinkClicks', () => {
  it('attaches click listeners to every .internal-link inside the container', () => {
    const doc = activeDocument;
    const container = doc.createElement('div');
    const a = doc.createElement('a');
    a.className = 'internal-link';
    a.setAttribute('data-href', 'wiki/entities/foo');
    container.appendChild(a);

    const calls: string[] = [];
    const app = {
      workspace: {
        openLinkText: (path: string) => {
          calls.push(path);
          return Promise.resolve();
        },
      },
    } as unknown as import('obsidian').App;

    bindWikiLinkClicks(container, app, 'wiki');

    // Simulate click
    a.click();

    expect(calls).toEqual(['wiki/entities/foo']);
  });

  it('does not throw if a link has no data-href or href attribute', () => {
    const doc = activeDocument;
    const container = doc.createElement('div');
    const a = doc.createElement('a');
    a.className = 'internal-link';
    container.appendChild(a);

    const app = {
      workspace: { openLinkText: () => Promise.resolve() },
    } as unknown as import('obsidian').App;

    expect(() => bindWikiLinkClicks(container, app, 'wiki')).not.toThrow();
    expect(() => a.click()).not.toThrow();
  });
});

describe('renderRetrievalLabel', () => {
  it('creates a label container with the formatted arm text and inline detail pages', () => {
    const doc = activeDocument;
    const parent = doc.createElement('div');
    const retrieval: RetrievalLabelData = {
      arm: 'PPR+LLM',
      count: 2,
      topPaths: ['wiki/entities/foo.md', 'wiki/concepts/bar.md'],
    };

    renderRetrievalLabel(parent, retrieval, 'wiki');

    const label = parent.querySelector('.llm-wiki-query-retrieval-label');
    expect(label).not.toBeNull();
    expect(label?.textContent).toContain('2');
    expect(label?.textContent).toContain('PPR');
    expect(label?.textContent).toContain('LLM');

    const detail = parent.querySelector('.llm-wiki-query-retrieval-detail');
    expect(detail).not.toBeNull();
    const pages = detail!.querySelectorAll('.llm-wiki-query-retrieval-page');
    expect(pages.length).toBe(2);
    expect(pages[0].textContent).toContain('foo');
    expect(pages[1].textContent).toContain('bar');
  });

  it('handles empty topPaths and "none" arm gracefully', () => {
    const doc = activeDocument;
    const parent = doc.createElement('div');
    const retrieval: RetrievalLabelData = {
      arm: 'none',
      count: 0,
      topPaths: [],
    };

    renderRetrievalLabel(parent, retrieval, 'wiki');

    const label = parent.querySelector('.llm-wiki-query-retrieval-label');
    expect(label).not.toBeNull();
    const detail = parent.querySelector('.llm-wiki-query-retrieval-detail');
    expect(detail!.children.length).toBe(0);
  });

  // ── Text legibility (v1.24.0) ───────────────────────────────────
  // User feedback 2026-07-07: `🔍 1 page(s) · 📇 index` is too cryptic.
  // - 'page(s)' should be 'page' (count=1) or 'pages' (count>1)
  // - 'index' is a misleading translation of the 'lex' arm (lexical
  //   fallback, not the index file)
  // - 'none' arm should say "No specific source" not just "—"
  describe('text legibility (v1.24.0)', () => {
    it('uses singular "page" when count is exactly 1', () => {
      const doc = activeDocument;
      const parent = doc.createElement('div');
      renderRetrievalLabel(parent, {
        arm: 'PPR',
        count: 1,
        topPaths: ['wiki/entities/Foo.md'],
      }, 'wiki');
      const label = parent.querySelector('.llm-wiki-query-retrieval-label');
      expect(label?.textContent).toContain('1 page');
      expect(label?.textContent).not.toContain('1 pages');
      expect(label?.textContent).not.toContain('page(s)');
    });

    it('uses plural "pages" when count is 2+', () => {
      const doc = activeDocument;
      const parent = doc.createElement('div');
      renderRetrievalLabel(parent, {
        arm: 'PPR',
        count: 3,
        topPaths: ['wiki/a.md', 'wiki/b.md', 'wiki/c.md'],
      }, 'wiki');
      const label = parent.querySelector('.llm-wiki-query-retrieval-label');
      expect(label?.textContent).toContain('3 pages');
      expect(label?.textContent).not.toContain('page(s)');
    });

    it('translates "lex" arm as "Lexical" (NOT "index")', () => {
      const doc = activeDocument;
      const parent = doc.createElement('div');
      renderRetrievalLabel(parent, {
        arm: 'lex',
        count: 1,
        topPaths: ['wiki/entities/Foo.md'],
      }, 'wiki');
      const label = parent.querySelector('.llm-wiki-query-retrieval-label');
      // "lex" arm should be "Lexical", not "index" (which is misleading)
      expect(label?.textContent).toContain('BM25F');
      expect(label?.textContent).not.toContain('📇 index');
    });

    it('shows "No specific source" when arm is "none"', () => {
      const doc = activeDocument;
      const parent = doc.createElement('div');
      renderRetrievalLabel(parent, {
        arm: 'none',
        count: 1,
        topPaths: ['wiki/entities/Foo.md'],
      }, 'wiki');
      const label = parent.querySelector('.llm-wiki-query-retrieval-label');
      // "none" should be human-readable, not a dash
      expect(label?.textContent).toContain('No specific source');
    });

    it('shows "No specific source" when arm is empty string', () => {
      const doc = activeDocument;
      const parent = doc.createElement('div');
      renderRetrievalLabel(parent, {
        arm: '',
        count: 1,
        topPaths: ['wiki/entities/Foo.md'],
      }, 'wiki');
      const label = parent.querySelector('.llm-wiki-query-retrieval-label');
      expect(label?.textContent).toContain('No specific source');
    });

    it('renders mixed arms PPR/lex as "PPR · Lexical" (not "PPR · index")', () => {
      // PPR cascade + lexical fallback both contributed.
      const doc = activeDocument;
      const parent = doc.createElement('div');
      renderRetrievalLabel(parent, {
        arm: 'PPR/lex',
        count: 2,
        topPaths: ['wiki/a.md', 'wiki/b.md'],
      }, 'wiki');
      const label = parent.querySelector('.llm-wiki-query-retrieval-label');
      expect(label?.textContent).toContain('PPR');
      expect(label?.textContent).toContain('BM25F');
      expect(label?.textContent).not.toContain('📇 index');
    });

    it('renders PPR+LLM arm with both tokens separated', () => {
      const doc = activeDocument;
      const parent = doc.createElement('div');
      renderRetrievalLabel(parent, {
        arm: 'PPR+LLM',
        count: 1,
        topPaths: ['wiki/entities/Foo.md'],
      }, 'wiki');
      const label = parent.querySelector('.llm-wiki-query-retrieval-label');
      expect(label?.textContent).toContain('PPR');
      expect(label?.textContent).toContain('LLM');
    });

    // v1.24.0 follow-up: select-seeds.ts emits 'index' as the
    // fallback arm identifier (NOT 'lex'). Translate it to a
    // human-readable form — not the raw "🔎 index" leakage.
    it('translates "index" arm as "Index" (not raw "🔎 index")', () => {
      const doc = activeDocument;
      const parent = doc.createElement('div');
      renderRetrievalLabel(parent, {
        arm: 'index',
        count: 3,
        topPaths: ['wiki/a.md', 'wiki/b.md', 'wiki/c.md'],
      }, 'wiki');
      const label = parent.querySelector('.llm-wiki-query-retrieval-label');
      // "index" arm should be translated to "Index" (with a clear
      // glyph) — the raw "🔎 index" leakage confuses users into
      // thinking the wiki index file was searched.
      expect(label?.textContent).toContain('BM25F');
      expect(label?.textContent).not.toBe('🔎 index');
    });

    it('translates "PPR/index" mixed arm cleanly', () => {
      const doc = activeDocument;
      const parent = doc.createElement('div');
      renderRetrievalLabel(parent, {
        arm: 'PPR/index',
        count: 2,
        topPaths: ['wiki/a.md', 'wiki/b.md'],
      }, 'wiki');
      const label = parent.querySelector('.llm-wiki-query-retrieval-label');
      expect(label?.textContent).toContain('PPR');
      expect(label?.textContent).toContain('BM25F');
    });
  });
});
