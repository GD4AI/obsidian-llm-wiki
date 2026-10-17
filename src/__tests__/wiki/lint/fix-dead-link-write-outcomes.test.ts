import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../__support__/engine-context';
import { createWikiEngineHarness } from '../../__support__/wiki-engine-harness';
import { runDeadLinkFixes } from '../../../wiki/lint/fix-runners';
import type { LintContext } from '../../../wiki/lint/types';

const source = 'entities/referrer';
const sourcePath = `wiki/${source}.md`;
const original = '# Referrer\n\nSee [[missing-one]] and [[missing-two]].\n';
const matchingPages = {
  'wiki/entities/one.md': '---\naliases: [missing-one]\n---\n# One\n',
  'wiki/entities/two.md': '---\naliases: [missing-two]\n---\n# Two\n',
};

function makeHarness(options: Parameters<typeof createWikiEngineHarness>[0] = {}) {
  const settings = { ...DEFAULT_SETTINGS, pageGenerationConcurrency: 3, batchDelayMs: 0 };
  const h = createWikiEngineHarness({ ...options, settings: { ...settings, ...options.settings } });
  const ctx: LintContext = {
    app: h.app,
    settings: { ...settings, ...options.settings },
    wikiEngine: h.engine,
    llmClient: { createMessage: async () => '' },
    onAnalyzeSchema: () => {},
  };
  return { h, ctx };
}

describe('dead-link writes and reporting', () => {
  it('preserves every same-page correction across concurrent batches', async () => {
    const { h, ctx } = makeHarness({
      files: { [sourcePath]: original, 'wiki/entities/other.md': original, ...matchingPages },
    });
    const result = await runDeadLinkFixes(ctx, undefined, [
      { source, target: 'missing-one' },
      { source, target: 'missing-two' },
      { source: 'entities/other', target: 'missing-one' },
      { source: 'entities/other', target: 'missing-two' },
      { source, target: 'missing-one' },
    ]);

    for (const path of [sourcePath, 'wiki/entities/other.md']) {
      expect(h.files.get(path)).not.toBe(original);
      expect(h.files.get(path)).toContain('[[entities/one|One]]');
      expect(h.files.get(path)).toContain('[[entities/two|Two]]');
      expect(h.files.get(path)).not.toContain('[[missing-');
    }
    expect(result.fixed).toBe(4);
    expect(result.results).toHaveLength(4);
    expect(h.stats.llmCalls).toBe(0);
  });

  const branches = [
    { name: 'pre-check', pages: matchingPages, response: '{}' },
    { name: 'model correction', pages: {}, response: '{"action":"correct","correct_link":"entities/one"}' },
    { name: 'stub safety net', pages: matchingPages, response: '{"action":"create_stub","stub_title":"One"}' },
    { name: 'model stub', pages: {}, response: '{"action":"create_stub","stub_title":"New Page"}' },
    // #827: the 'fallback stub' branch used to live here. It created a page for
    // every unresolvable link whether or not the model asked for one, which is
    // where pages called `name` and `untitled-concept` came from. It no longer
    // exists, so its assertion moved to the dedicated test below rather than being
    // dropped from the parametrised sets.
  ];

  it.each(branches)('does not count declined writes in $name', async ({ name, pages, response }) => {
    const target = name === 'pre-check' ? 'missing-one' : 'unknown';
    const content = `# Referrer\n\nSee [[${target}]].\n`;
    const { h, ctx } = makeHarness({ files: { [sourcePath]: content, ...pages }, llmResponses: [response] });
    const write = vi.spyOn(h.engine, 'writeFileWithIntent').mockResolvedValue(false);

    const result = await runDeadLinkFixes(ctx, undefined, [{ source, target }]);

    expect(write).toHaveBeenCalledTimes(1);
    expect(h.files.get(sourcePath)).toBe(content);
    expect(h.writtenPaths).toEqual([]);
    expect(result).toEqual({ fixed: 0, results: [] });
  });

  it.each(branches)('persists successful writes and preserves aliases in $name', async ({ name, pages, response }) => {
    const target = name === 'pre-check' ? 'missing-one' : 'unknown';
    const content = `# Referrer\n\nSee [[${target}#Section|Custom label]].\n`;
    const { h, ctx } = makeHarness({ files: { [sourcePath]: content, ...pages }, llmResponses: [response] });

    const result = await runDeadLinkFixes(ctx, undefined, [{ source, target }]);

    expect(h.files.get(sourcePath)).not.toBe(content);
    expect(h.files.get(sourcePath)).not.toContain(`[[${target}#`);
    const destination = name === 'model stub' ? 'entities/new-page' : 'entities/one';
    expect(h.files.get(sourcePath)).toContain(`[[${destination}|Custom label]]`);
    expect(result.fixed).toBe(1);
    expect(result.results).toHaveLength(1);
    if (name === 'model stub') {
      expect(h.files.get(`wiki/${destination}.md`)).toContain('stub: true');
    }
  });

  // #827: replaces the 'fallback stub' branch of the two parametrised sets above.
  // The fallback used to invent a page when the model gave no usable action. The
  // judgement now belongs to the model — it reads the source page in the user's own
  // language, and the prompt gives it `action=leave` for a name that is not a real
  // thing, which no hardcoded word list can decide. So this asserts the opposite of
  // what the removed branch asserted: nothing is written, and the link stays dead.
  it('invents no page when the model gives no usable action (#827)', async () => {
    const content = `# Referrer\n\nSee [[unknown]].\n`;
    const { h, ctx } = makeHarness({ files: { [sourcePath]: content }, llmResponses: ['{}'] });

    const result = await runDeadLinkFixes(ctx, undefined, [{ source, target: 'unknown' }]);

    expect(h.files.get(sourcePath)).toBe(content);
    expect(h.writtenPaths).toEqual([]);
    expect(result).toEqual({ fixed: 0, results: [] });
  });

  it('continues same-page fixes after an earlier write fails', async () => {
    const { h, ctx } = makeHarness({ files: { [sourcePath]: original, ...matchingPages } });
    vi.spyOn(h.engine, 'writeFileWithIntent').mockRejectedValueOnce(new Error('Write failed'));

    const result = await runDeadLinkFixes(ctx, undefined, [
      { source, target: 'missing-one' },
      { source, target: 'missing-two' },
    ]);

    expect(h.files.get(sourcePath)).toContain('[[missing-one]]');
    expect(h.files.get(sourcePath)).toContain('[[entities/two|Two]]');
    expect(result.fixed).toBe(1);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toContain('[[missing-two]]');
  });

  it('stops queued same-page fixes when cancelled', async () => {
    const { h, ctx } = makeHarness({ files: { [sourcePath]: original, ...matchingPages } });
    const controller = new AbortController();
    const write = h.engine.writeFileWithIntent.bind(h.engine);
    vi.spyOn(h.engine, 'writeFileWithIntent').mockImplementation(async (...args) => {
      const written = await write(...args);
      controller.abort();
      return written;
    });

    await expect(runDeadLinkFixes(ctx, controller.signal, [
      { source, target: 'missing-one' },
      { source, target: 'missing-two' },
    ])).rejects.toMatchObject({ name: 'AbortError' });

    expect(h.files.get(sourcePath)).toContain('[[entities/one|One]]');
    expect(h.files.get(sourcePath)).toContain('[[missing-two]]');
    expect(h.writtenPaths).toEqual([sourcePath]);
  });

  it.each(branches)('does not report or write an absent link in $name', async ({ name, pages, response }) => {
    const { h, ctx } = makeHarness({ files: { [sourcePath]: '# Referrer\n', ...pages }, llmResponses: [response] });
    const target = name === 'pre-check' ? 'missing-one' : 'unknown';

    const result = await runDeadLinkFixes(ctx, undefined, [{ source, target }]);

    expect(h.files.get(sourcePath)).toBe('# Referrer\n');
    expect(h.writtenPaths).toEqual([]);
    expect(result).toEqual({ fixed: 0, results: [] });
  });

  it('does not recreate a source removed during the model call', async () => {
    const { h, ctx } = makeHarness({
      files: { [sourcePath]: original },
      llmResponses: ['{"action":"correct","correct_link":"entities/one"}'],
      beforeLLMCall: () => { h.files.delete(sourcePath); },
    });

    const result = await runDeadLinkFixes(ctx, undefined, [{ source, target: 'missing-one' }]);

    expect(h.files.has(sourcePath)).toBe(false);
    expect(h.writtenPaths).toEqual([]);
    expect(result).toEqual({ fixed: 0, results: [] });
  });

  it('does not count an unchanged model correction in a non-English UI', async () => {
    const { h, ctx } = makeHarness({
      files: { [sourcePath]: original },
      settings: { language: 'zh' },
      llmResponses: ['{"action":"correct","correct_link":"missing-one"}'],
    });

    const result = await runDeadLinkFixes(ctx, undefined, [{ source, target: 'missing-one' }]);

    expect(h.files.get(sourcePath)).toBe(original);
    expect(h.writtenPaths).toEqual([]);
    expect(result).toEqual({ fixed: 0, results: [] });
  });
});
