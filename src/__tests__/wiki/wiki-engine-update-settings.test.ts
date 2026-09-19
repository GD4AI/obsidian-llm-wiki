// Bug C 3.0 — Wiki-folder-transparent prompt.
//
// Root cause: chat history persists LLM responses with the wikiFolder
// string baked into [[…/entities/foo]] links. When the user changes
// wikiFolder mid-session, the history still shows the old folder, the
// LLM follows that established format, and continues emitting old-folder
// paths even after the setting change. The fix: never put the real
// wikiFolder in the prompt or in history — use the placeholder
// `__WIKI_FOLDER__` everywhere, and substitute the real folder at
// render time only.

import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULT_SETTINGS } from '../__support__/engine-context';
import { createWikiEngineHarness } from '../__support__/wiki-engine-harness';
import { assembleWikiContext } from '../../wiki/query-engine/pipeline/assemble-context';
import { normalizeWikiLinkContent } from '../../core/prompt-builders';

describe('Bug C 3.0 — wiki-folder-transparent prompt', () => {
  describe('assembleWikiContext prompt template', () => {
    it('uses __WIKI_FOLDER__ placeholder, not the real wikiFolder literal', () => {
      const prompt = assembleWikiContext({
        pageBodies: [],
        armLabel: 'PPR',
        llmAugmented: false,
        matchesCount: 0,
        wikiFolder: 'test3', // ← user's CURRENT setting, but prompt must NOT contain it
        wikiLanguage: 'en',
      });

      expect(prompt).toContain('__WIKI_FOLDER__');
      expect(prompt).not.toContain('test3');
      // The default 'wiki' literal also must not leak into the prompt.
      expect(prompt).not.toMatch(/\[\[wiki\//);
    });

    it('placeholder survives a wikiFolder change', () => {
      const before = assembleWikiContext({
        pageBodies: [], armLabel: 'PPR',
        llmAugmented: false, matchesCount: 0,
        wikiFolder: 'wiki', wikiLanguage: 'en',
      });
      const after = assembleWikiContext({
        pageBodies: [], armLabel: 'PPR',
        llmAugmented: false, matchesCount: 0,
        wikiFolder: 'test3', wikiLanguage: 'en',
      });

      // Both prompts must look identical to the LLM — only the placeholder
      // appears in both, the real folder appears in neither.
      expect(before).toBe(after);
    });
  });

  describe('normalizeWikiLinkContent — collapses current/default folder prefix to __WIKI_FOLDER__', () => {
    it('replaces [[wiki/...]] with [[__WIKI_FOLDER__/...]] when user folder differs from default', () => {
      const out = normalizeWikiLinkContent('See [[wiki/entities/llm|LLM]]', 'mywiki');
      expect(out).toContain('__WIKI_FOLDER__');
      expect(out).not.toMatch(/\[\[wiki\//);
    });

    it('replaces user-configured folder prefix when LLM echoed it back', () => {
      // The LLM has the user's current wikiFolder in the prompt template,
      // so it may legitimately output [[mywiki/...]] for the CURRENT folder.
      // We must collapse that to the placeholder so the persisted history
      // is folder-agnostic.
      const out = normalizeWikiLinkContent('See [[mywiki/entities/foo|Foo]]', 'mywiki');
      expect(out).toContain('__WIKI_FOLDER__');
      expect(out).not.toMatch(/\[\[mywiki\//);
    });

    // NOTE on backward compat: a stale history entry with a DIFFERENT,
    // older wikiFolder (e.g. user once had 'test3', then changed to 'mywiki',
    // and an old assistant message still has [[test3/entities/x]]) is NOT
    // collapsed by normalizeWikiLinkContent — that would require guessing
    // which folders the user has ever used. Such stale entries will render
    // as-is until the user clears history OR until an explicit migration
    // is implemented (tracked for v1.25.0+, see plan section 3.4).
    it('does NOT collapse unknown folder prefixes (deferred to migration)', () => {
      // The LLM echoing a folder we don't recognize: we leave it alone
      // rather than guess. This is a deliberate non-goal for v1.24.0.
      const out = normalizeWikiLinkContent('See [[test3/entities/foo|Foo]]', 'mywiki');
      // test3 path is unchanged — render-time substitute still works for
      // __WIKI_FOLDER__ (which isn't present in this string), and the
      // explicit stale path renders literally as the LLM wrote it.
      expect(out).toContain('test3/entities/foo');
    });
  });
});

describe('WikiEngine.updateSettings — Bug C 3.2 cache invalidation', () => {
  let harness: ReturnType<typeof createWikiEngineHarness>;

  beforeEach(() => {
    harness = createWikiEngineHarness({
      files: {
        'wiki/entities/a.md': '---\ntype: entity\n---\n# A',
        'wiki/concepts/b.md': '---\ntype: concept\n---\n# B',
        'test3/entities/c.md': '---\ntype: entity\n---\n# C',
      },
      settings: { wikiFolder: 'wiki' },
    });
  });

  it('returns true when wikiFolder changes', async () => {
    const engine = harness.engine as unknown as {
      pagesCache: unknown;
      ingestedHashesCache: unknown;
      buildIngestedHashes: () => unknown;
      getExistingWikiPages: () => Promise<unknown[]>;
      updateSettings: (s: unknown) => boolean;
    };

    await engine.getExistingWikiPages();
    engine.buildIngestedHashes();

    // wikiFolderChanged flag drives main.saveSettings() → leaf-walk.
    const currentSettings = (engine as unknown as { settings: Record<string, unknown> })['settings'];
    expect(engine.updateSettings({ ...currentSettings, wikiFolder: 'different' })).toBe(true);
  });

  it('returns false when wikiFolder is unchanged', async () => {
    const engine = harness.engine as unknown as {
      pagesCache: unknown;
      buildIngestedHashes: () => unknown;
      getExistingWikiPages: () => Promise<unknown[]>;
      updateSettings: (s: unknown) => boolean;
    };

    await engine.getExistingWikiPages();
    engine.buildIngestedHashes();

    const currentSettings = (engine as unknown as { settings: Record<string, unknown> })['settings'];
    expect(engine.updateSettings({ ...currentSettings, model: 'different-model' })).toBe(false);
  });

  it('drops the page index + ingestedHashesCache when wikiFolder changes', async () => {
    const engine = harness.engine as unknown as {
      pageIndex: { size: number };
      ingestedHashesCache: unknown;
      ingestedHashesCacheTime: number;
      buildIngestedHashes: () => unknown;
      getExistingWikiPages: () => Promise<unknown[]>;
      updateSettings: (s: unknown) => void;
    };

    // Force both to populate by reading them once. getExistingWikiPages fills
    // the page index as a side effect (Issue #662: the index replaced the TTL
    // snapshot, so the assertion is on what it holds, not on a null field).
    await engine.getExistingWikiPages();
    engine.buildIngestedHashes();
    expect(engine.pageIndex.size).toBeGreaterThan(0);
    expect(engine.ingestedHashesCache).not.toBeNull();

    // Switch wikiFolder — the index and the hash snapshot must drop immediately.
    engine.updateSettings({ ...DEFAULT_SETTINGS, ...harness.engine['settings'], wikiFolder: 'test3' });

    expect(engine.pageIndex.size).toBe(0);
    expect(engine.ingestedHashesCache).toBeNull();
  });

  it('preserves caches when wikiFolder is unchanged', async () => {
    const engine = harness.engine as unknown as {
      pagesCache: unknown;
      pagesCacheTime: number;
      ingestedHashesCache: unknown;
      buildIngestedHashes: () => unknown;
      getExistingWikiPages: () => Promise<unknown[]>;
      updateSettings: (s: unknown) => void;
    };

    await engine.getExistingWikiPages();
    engine.buildIngestedHashes();
    const pagesBefore = engine.pagesCache;
    const hashesBefore = engine.ingestedHashesCache;

    // Update with the same wikiFolder + a different unrelated field.
    const currentSettings = (engine as unknown as { settings: Record<string, unknown> })['settings'];
    engine.updateSettings({ ...currentSettings, model: 'different-model' });

    expect(engine.pagesCache).toBe(pagesBefore);
    expect(engine.ingestedHashesCache).toBe(hashesBefore);
  });
});