// domain axis stage 3 (#568): the extraction prompt names the vault's tag
// vocabulary as the allowed list for the per-item `domains` subset — in the
// static prefix, identical for every note; and not at all when no note carries
// tags, so a vault without the layer sends the prompt it always sent.

import { describe, it, expect, vi } from 'vitest';
import { createMockContext, createMockFile } from '../__support__/engine-context';
import { SourceAnalyzer } from '../../wiki/source-analyzer';
import { TFile } from 'obsidian';

const SOURCE_PATH = 'sources/zink.md';
const MARKER = '**Domain tag vocabulary of this vault:**';

const EXTRACTION_RESPONSE = JSON.stringify({
  source_title: 'Zink',
  summary: 'A trace element.',
  entities: [{ name: 'Zink', type: 'other', summary: 'trace element', mentions_in_source: [] }],
  concepts: [],
});

async function requestFor(body: string): Promise<{ prompt: string; cacheBreakpoint: number | undefined }> {
  const { ctx } = createMockContext({
    vaultFiles: { [SOURCE_PATH]: body },
    llmResponses: [EXTRACTION_RESPONSE],
    settings: { watchedFolders: ['sources'] },
  });
  const spy = vi.spyOn(ctx.getClient()!, 'createMessage');
  const analyzer = new SourceAnalyzer(ctx);
  // eslint-disable-next-line obsidianmd/no-tfile-tfolder-cast
  await analyzer.analyzeSource(createMockFile(SOURCE_PATH) as unknown as TFile);
  expect(spy).toHaveBeenCalled();
  const args = spy.mock.calls[0][0] as { messages: Array<{ content: string }>; cacheBreakpoint?: number };
  return { prompt: args.messages[0].content, cacheBreakpoint: args.cacheBreakpoint };
}

describe('SourceAnalyzer — domain context in the extraction prompt (domain axis stage 3, #568)', () => {
  it('lists the vault vocabulary as the allowed set, inside the cached static prefix', async () => {
    const { prompt, cacheBreakpoint } = await requestFor(
      '---\ntags:\n  - Sorte/Mineralstoff\n  - Thema/Ernährung\n---\n\n# Zink\n\nZink ist ein Spurenelement.\n',
    );
    const idx = prompt.indexOf(MARKER);
    expect(idx).toBeGreaterThan(-1);
    expect(prompt).toContain(`${MARKER} [Sorte/Mineralstoff, Thema/Ernährung]`);
    // The block sits before the round-specific batch context…
    expect(idx).toBeLessThan(prompt.indexOf('This is the first extraction round'));
    // …and therefore inside the prefix the cache breakpoint covers.
    expect(cacheBreakpoint).toBeDefined();
    expect(idx).toBeLessThan(cacheBreakpoint as number);
    // The per-item instruction and the output shape carry both new fields.
    expect(prompt).toContain('For coverage:');
    expect(prompt).toContain('"coverage": "defined|discussed|named"');
    expect(prompt).toContain('"domains":');
  });

  it('sends no domain block when no note carries tags — the layer is opt-in', async () => {
    const { prompt } = await requestFor('# Zink\n\nZink ist ein Spurenelement.\n');
    expect(prompt).not.toContain(MARKER);
    // The coverage instruction is not tied to the layer: it is always there.
    expect(prompt).toContain('For coverage:');
  });
});

describe('SourceAnalyzer — the type slot names the vocabulary, not the built-in taxonomy', () => {
  // The system prompt said "use one of the vocabulary values" while the JSON
  // example at the very slot the model fills still read
  // `"type": "theory|method|field|phenomenon|standard|term|other"`. Measured:
  // 259 of 444 concept pages of one rebuild carried no vocabulary type — the
  // model took the enum it was shown where it wrote the value.
  it('shows no hard-coded English type enum in the extraction prompt', async () => {
    const { prompt } = await requestFor('# Zink\n\nZink ist ein Spurenelement.\n');
    expect(prompt).not.toContain('theory|method|field|phenomenon|standard|term|other');
    expect(prompt).not.toContain('person|organization|project|product|event|place|other');
    expect(prompt).toContain('Concept types listed in the Active Tag Vocabulary section');
    expect(prompt).toContain('Entity types listed in the Active Tag Vocabulary section');
  });
});
