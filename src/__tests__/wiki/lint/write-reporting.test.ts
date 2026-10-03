import { describe, expect, it, vi } from 'vitest';
import { createWikiEngineHarness } from '../../__support__/wiki-engine-harness';
import { DEFAULT_SETTINGS } from '../../__support__/engine-context';
import { LINT_WRITE_INTENT, RAW_WRITE_INTENT } from '../../../types';
import { runAliasCompletion, runRetagViolations } from '../../../wiki/lint/fix-runners';
import type { LintContext } from '../../../wiki/lint/types';

const path = 'wiki/entities/Alice.md';
const content = '---\ntype: entity\ntitle: Alice\naliases: []\ntags: [bogus]\n---\n\nBody of Alice.';

describe('write outcomes through the real engine', () => {
  it('reports an absent update-only target without writing or notifying', async () => {
    const h = createWikiEngineHarness();
    const written = await h.engine.writeFileWithIntent(path, content, {
      ...LINT_WRITE_INTENT, guard: true, notify: true,
    });
    expect(written).toBe(false);
    expect(h.files.has(path)).toBe(false);
    expect(h.writtenPaths).toEqual([]);
  });

  it.each([false, true])('reports a completed write when the target exists: %s', async exists => {
    const h = createWikiEngineHarness({ files: exists ? { [path]: content } : {} });
    expect(await h.engine.writeFileWithIntent(path, 'Updated body', RAW_WRITE_INTENT)).toBe(true);
    expect(h.files.get(path)).toBe('Updated body');
  });

  it('reports a recovered write as successful', async () => {
    const h = createWikiEngineHarness({ files: { [path]: content } });
    vi.spyOn(h.app.vault, 'process').mockRejectedValueOnce(new Error('File already exists'));
    expect(await h.engine.writeFileWithIntent(path, 'Recovered body', RAW_WRITE_INTENT)).toBe(true);
    expect(h.files.get(path)).toBe('Recovered body');
  });

  it('propagates write failures instead of reporting a skipped write', async () => {
    const h = createWikiEngineHarness({ files: { [path]: content } });
    vi.spyOn(h.app.vault, 'process').mockRejectedValueOnce(new Error('Write failed'));
    await expect(h.engine.writeFileWithIntent(path, 'New body', LINT_WRITE_INTENT)).rejects.toThrow('Write failed');
    expect(h.files.get(path)).toBe(content);
  });

  it('keeps the compatibility entry point void', async () => {
    const h = createWikiEngineHarness();
    await expect(h.engine.createOrUpdateFile('other/note.md', 'Body')).resolves.toBeUndefined();
    expect(h.files.get('other/note.md')).toBe('Body');
  });
});

describe('lint reporting after the target disappears during the model call', () => {
  function makeContext(response: string, removeDuringCall: boolean) {
    const settings = { ...DEFAULT_SETTINGS, pageGenerationConcurrency: 1, batchDelayMs: 0 };
    const h = createWikiEngineHarness({ files: { [path]: content }, settings });
    const createMessage = vi.fn(async () => {
      if (removeDuringCall) h.files.delete(path);
      return response;
    });
    const ctx: LintContext = {
      app: h.app,
      settings,
      wikiEngine: h.engine,
      llmClient: { createMessage },
      onAnalyzeSchema: () => {},
    };
    return { h, ctx, createMessage };
  }

  it.each([false, true])('counts aliases only when written (removed: %s)', async removed => {
    const { h, ctx, createMessage } = makeContext('{"aliases":["Ally"]}', removed);
    const result = await runAliasCompletion(ctx, undefined, [{ path, content, basename: 'Alice' }]);
    expect(createMessage).toHaveBeenCalledTimes(1);
    expect(result.filled).toBe(removed ? 0 : 1);
    if (removed) {
      expect(h.files.has(path)).toBe(false);
      expect(result.results).toEqual([]);
    } else {
      expect(h.files.get(path)).toContain('Ally');
      expect(h.files.get(path)).toContain('Body of Alice.');
      expect(result.results).toHaveLength(1);
    }
  });

  it.each([false, true])('counts retags only when written (removed: %s)', async removed => {
    const { h, ctx, createMessage } = makeContext('{"tags":["person"]}', removed);
    const result = await runRetagViolations(ctx, undefined, [{
      path, pageType: 'entity', title: 'Alice', currentTags: ['bogus'], invalidTags: ['bogus'],
    }]);
    expect(createMessage).toHaveBeenCalledTimes(1);
    expect(result.fixed).toBe(removed ? 0 : 1);
    if (removed) {
      expect(h.files.has(path)).toBe(false);
      expect(result.results).toEqual([`${path}: file not found`]);
    } else {
      expect(h.files.get(path)).toContain('person');
      expect(h.files.get(path)).toContain('Body of Alice.');
      expect(result.results[0]).toContain('[bogus] → [person]');
    }
  });
});
