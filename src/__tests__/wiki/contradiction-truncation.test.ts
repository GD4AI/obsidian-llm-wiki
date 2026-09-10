import { describe, it, expect } from 'vitest';
import { ContradictionManager } from '../../wiki/contradictions';
import type { EngineContext } from '../../types';

// A page well past the 6,000-character prompt budget, with the overflow in its
// own `## ` sections. Before the clamp, everything after character 6,000 never
// reached the model — and the model's answer was written back over the file.
function bigPage(): string {
  return [
    '---',
    'type: entity',
    'source_page: "[[entities/Test]]"',
    '---',
    '',
    '# Test',
    '',
    '## Description',
    'D'.repeat(5800),
    '',
    '## Mentions',
    'THE-TAIL-THAT-USED-TO-VANISH ' + 'M'.repeat(2000),
  ].join('\n');
}

function makeCtx(pages: Record<string, string>, reply: string) {
  const written: Record<string, string> = {};
  let seenPrompt = '';
  const ctx = {
    settings: { wikiFolder: 'wiki', disableThinking: false },
    // the one vocabulary (vocabulary.ts) is harvested from the vault before every system prompt
    app: { vault: { getMarkdownFiles: () => [] }, metadataCache: { getFileCache: () => null } } as never,
    tryReadFile: async (p: string) => pages[p],
    createOrUpdateFile: async (p: string, c: string) => { written[p] = c; },
    getSchemaContext: async () => '',
    getClient: () => ({
      createMessage: async (params: { messages: Array<{ content: string }> }) => {
        seenPrompt = params.messages[0].content;
        return reply;
      },
    }),
  } as unknown as EngineContext;
  return { ctx, written, prompt: () => seenPrompt };
}

describe('resolveContradiction does not lose the part it could not show the model', () => {
  const record = '---\nsource_page: "[[entities/Test]]"\n---\n\n## Conflict\nA vs B.';

  it('withholds whole sections, says so in the prompt, and writes them back', async () => {
    const pages = {
      'wiki/contradictions/x.md': record,
      'wiki/entities/Test.md': bigPage(),
    };
    // The model answers with a repaired page built only from what it saw.
    const reply = '---\ntype: entity\n---\n\n# Test\n\n## Description\nRepaired.';
    const { ctx, written, prompt } = makeCtx(pages, reply);

    await new ContradictionManager(ctx).resolveContradiction('wiki/contradictions/x.md');

    // The prompt is bounded and admits what it left out.
    expect(prompt()).toMatch(/section\(s\) omitted here for length/);
    expect(prompt()).toContain('Mentions');
    expect(prompt()).not.toContain('THE-TAIL-THAT-USED-TO-VANISH');

    // The file keeps it anyway.
    const out = written['wiki/entities/Test.md'];
    expect(out).toContain('Repaired.');
    expect(out).toContain('THE-TAIL-THAT-USED-TO-VANISH');
    expect(out).toContain('## Mentions');
  });

  it('leaves a page that fits byte-identical in the prompt', async () => {
    const small = '---\ntype: entity\n---\n\n# Test\n\n## Description\nShort.';
    const pages = {
      'wiki/contradictions/x.md': record,
      'wiki/entities/Test.md': small,
    };
    const { ctx, prompt } = makeCtx(pages, '# Test\n\n## Description\nRepaired.');
    await new ContradictionManager(ctx).resolveContradiction('wiki/contradictions/x.md');
    expect(prompt()).toContain(small);
    expect(prompt()).not.toMatch(/omitted here for length/);
  });

  it('refuses to rewrite a page it cannot clamp at a section boundary', async () => {
    const pages = {
      'wiki/contradictions/x.md': record,
      'wiki/entities/Test.md': '---\ntype: entity\n---\n\n' + 'x'.repeat(9000),
    };
    const { ctx, written } = makeCtx(pages, 'anything');
    await expect(
      new ContradictionManager(ctx).resolveContradiction('wiki/contradictions/x.md'),
    ).rejects.toThrow(/no section boundary/);
    expect(written['wiki/entities/Test.md']).toBeUndefined();
  });
});
