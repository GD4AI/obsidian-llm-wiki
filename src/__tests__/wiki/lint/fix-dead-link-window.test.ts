// Fix Dead Links: the page list in the prompt is the candidate window, not
// the vault in iteration order cut at 3,000 characters.
//
// Before: `existing_pages` was every page, rendered in `getMarkdownFiles()`
// order and truncated by `substring(0, 3000)` — on a 2,800-page wiki an
// arbitrary ~2 % in which the prompt was then told to look for "semantic
// similarity". Whether the true target was in it was a matter of file order.
// Now the list is the shared window (`core/candidate-window.ts`), ranked
// against the link's target name and the text around the link.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fixDeadLink } from '../../../wiki/lint/fix-dead-link';
import * as getExistingPages from '../../../wiki/lint/get-existing-pages';
import type { EngineContext, LLMClient } from '../../../types';
import { CANDIDATE_WINDOW_TOP_K } from '../../../constants';

type ExistingPage = Awaited<ReturnType<typeof getExistingPages.getExistingWikiPages>>[number];

function makeCtx(client: LLMClient, sourceContent: string): EngineContext {
  return {
    // the one vocabulary (vocabulary.ts) is harvested from the vault before every system prompt
    app: { vault: { getMarkdownFiles: () => [] }, metadataCache: { getFileCache: () => null } } as never,
    settings: { wikiFolder: 'wiki', wikiLanguage: 'de', disableThinking: false, slugCase: 'preserve' },
    getClient: () => client,
    getSchemaContext: () => ({}),
    tryReadFile: async (): Promise<string | null> => sourceContent,
    createOrUpdateFile: async (): Promise<void> => {},
  } as unknown as EngineContext;
}

function wikiPage(i: number, title: string, text: string): ExistingPage {
  return {
    path: `wiki/entities/${title}.md`,
    title,
    wikiLink: `[[entities/${title}|${title}]]`,
    aliases: undefined,
    ctime: i,
    text,
  };
}

const SOURCE =
  '# Quelle\n\n' +
  'Die Achse zwischen Darm und Gehirn — siehe [[Darm-Hirn-Verbindung]] — läuft über den Vagusnerv ' +
  'und mikrobielle Metaboliten wie kurzkettige Fettsäuren.\n';

describe('fixDeadLink — existing_pages is the ranked candidate window', () => {
  // 80 pages whose titles share nothing with the link; only one of them
  // describes the same thing in its prose. It sits at position 75 — at
  // ~47 rendered characters a line, beyond the 3,000-char cut of the old
  // list, which ended around line 63.
  const pool: ExistingPage[] = Array.from({ length: 80 }, (_, i) =>
    wikiPage(i, `Fachbegriff-${i}`, `eintrag nummer ${i} ohne inhaltlichen bezug.`),
  );
  pool[75] = wikiPage(75, 'Darm-Hirn-Achse',
    'bidirektionale verbindung zwischen darm und gehirn über den vagusnerv, das immunsystem und mikrobielle metaboliten.');

  let prompt = '';
  beforeEach(() => {
    vi.spyOn(getExistingPages, 'getExistingWikiPages').mockResolvedValue(pool);
    prompt = '';
  });
  afterEach(() => vi.restoreAllMocks());

  it('puts the page that describes the link first and sends at most K pages', async () => {
    const createMessage = vi.fn(async (args: { messages: Array<{ content: string }> }) => {
      prompt = args.messages[0].content;
      return JSON.stringify({ action: 'correct', correct_link: '[[entities/Darm-Hirn-Achse|Darm-Hirn-Achse]]' });
    });
    const ctx = makeCtx({ createMessage } as unknown as LLMClient, SOURCE);

    const out = await fixDeadLink(ctx, 'wiki/sources/Quelle.md', 'Darm-Hirn-Verbindung');

    expect(out).toContain('corrected');
    const listed = prompt.split('\n').filter(l => l.startsWith('- [[entities/'));
    expect(listed.length).toBe(CANDIDATE_WINDOW_TOP_K);
    expect(listed[0]).toContain('[[entities/Darm-Hirn-Achse|Darm-Hirn-Achse]]');
  });
});
