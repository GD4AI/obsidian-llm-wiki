import { describe, it, expect, vi } from 'vitest';
import { createMockContext, createMockFile } from '../__support__/engine-context';
import { SourceAnalyzer } from '../../wiki/source-analyzer';
import { TFile } from 'obsidian';

// We can't instantiate TFile without Obsidian, so we test SourceAnalyzer
// by mocking its dependencies through createMockContext.
// Tests pass mock file objects as unknown as TFile — the SourceAnalyzer only
// reads file.path and file.basename from the parameter, which our mock provides.

const TEST_PATH = 'sources/test.md';
const GLOSSARY_PATH = 'sources/glossary.md';
const THEORY_PATH = 'sources/theory.md';
const DOC_PATH = 'sources/doc.md';
const EMPTY_PATH = 'sources/empty.md';

function mockAnalyze(
  vaultFiles: Record<string, string>,
  llmResponses: string[]
): SourceAnalyzer {
  const { ctx } = createMockContext({ vaultFiles, llmResponses });
  return new SourceAnalyzer(ctx);
}

function run(
  analyzer: SourceAnalyzer,
  path: string
): Promise<import('../../types').SourceAnalysis | null> {
  // The SourceAnalyzer only reads file.path and file.basename from the TFile.
  // Our mock provides both fields, so the cast is safe for testing.
  // eslint-disable-next-line obsidianmd/no-tfile-tfolder-cast
  return analyzer.analyzeSource(createMockFile(path) as unknown as TFile);
}

describe('SourceAnalyzer', () => {
  it('analyzes resolved local embeds before text extraction without re-uploading images', async () => {
    const { ctx } = createMockContext({
      vaultFiles: { [TEST_PATH]: 'Before chart\n\n![[assets/chart.png]]\n\nAfter chart' },
      settings: { analyzeEmbeddedImages: true },
      llmResponses: [
        JSON.stringify({ images: [{ index: 1, visible_text: 'Chart title', description: 'A line chart.', context_relevance: 'Explains the surrounding chart discussion.' }] }),
        JSON.stringify({ entities: [], concepts: [] }),
      ],
    });
    const app = ctx.app as unknown as {
      metadataCache: { getFirstLinkpathDest: (target: string, sourcePath: string) => { path: string } | null };
      vault: { adapter: { readBinary: (path: string) => Promise<ArrayBuffer>; stat: (path: string) => Promise<{ size: number } | null> } };
    };
    app.metadataCache.getFirstLinkpathDest = (target, sourcePath) =>
      target === 'assets/chart.png' && sourcePath === TEST_PATH ? { path: target } : null;
    app.vault.adapter = { readBinary: async () => new Uint8Array([1, 2, 3]).buffer, stat: async () => ({ size: 3 }) };
    const client = ctx.getClient()!;
    const spy = vi.spyOn(client, 'createMessage');

    await run(new SourceAnalyzer(ctx), TEST_PATH);

    const visionContent = spy.mock.calls[0][0].messages[0].content;
    expect(visionContent).toEqual([
      expect.objectContaining({ type: 'text' }),
      { type: 'image', image: 'AQID', mediaType: 'image/png' },
    ]);
    expect((visionContent[0] as { text: string }).text).toContain('Text before image: Before chart');
    expect((visionContent[0] as { text: string }).text).toContain('Text after image: After chart');
    const extractionContent = spy.mock.calls[1][0].messages[0].content;
    expect(extractionContent).toContain('## Embedded Image Visual Evidence');
    expect(extractionContent).toContain('Chart title');
    expect(extractionContent).toContain('Context relevance: Explains the surrounding chart discussion.');
    expect(spy.mock.calls[1][0].cacheBreakpoint).toBeDefined();
  });

  it('continues with text extraction when the endpoint rejects image input', async () => {
    const { ctx } = createMockContext({
      vaultFiles: { [TEST_PATH]: '# Test\n![[assets/chart.png]]' },
      settings: { analyzeEmbeddedImages: true },
    });
    const app = ctx.app as unknown as {
      metadataCache: { getFirstLinkpathDest: () => { path: string } | null };
      vault: { adapter: { readBinary: () => Promise<ArrayBuffer>; stat: () => Promise<{ size: number }> } };
    };
    app.metadataCache.getFirstLinkpathDest = () => ({ path: 'assets/chart.png' });
    app.vault.adapter = { readBinary: async () => new Uint8Array([1]).buffer, stat: async () => ({ size: 1 }) };
    const client = ctx.getClient()!;
    const spy = vi.spyOn(client, 'createMessage')
      .mockRejectedValueOnce(new Error('400 image input not supported'))
      .mockResolvedValueOnce(JSON.stringify({ entities: [], concepts: [] }));

    const result = await run(new SourceAnalyzer(ctx), TEST_PATH);

    expect(result?.embedded_image_analysis?.failedPackages).toBe(1);
    expect(result?.embedded_image_analysis?.evidence[0]).toMatchObject({ status: 'failed', reason: 'vision-input-rejected' });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[1][0].messages[0].content).not.toContain('Embedded Image Visual Evidence');
  });

  it('propagates non-vision image-analysis errors', async () => {
    const { ctx } = createMockContext({
      vaultFiles: { [TEST_PATH]: '# Test\n![[assets/chart.png]]' },
      settings: { analyzeEmbeddedImages: true },
    });
    const app = ctx.app as unknown as {
      metadataCache: { getFirstLinkpathDest: () => { path: string } | null };
      vault: { adapter: { readBinary: () => Promise<ArrayBuffer>; stat: () => Promise<{ size: number }> } };
    };
    app.metadataCache.getFirstLinkpathDest = () => ({ path: 'assets/chart.png' });
    app.vault.adapter = { readBinary: async () => new Uint8Array([1]).buffer, stat: async () => ({ size: 1 }) };
    vi.spyOn(ctx.getClient()!, 'createMessage').mockRejectedValueOnce(new Error('network unavailable'));

    await expect(run(new SourceAnalyzer(ctx), TEST_PATH)).rejects.toThrow('network unavailable');
  });

  it('returns null when first batch is unusable (no entities/concepts)', async () => {
    const a = mockAnalyze(
      { [TEST_PATH]: '# Test\nContent here.' },
      ['{"source_title": "Test", "summary": "Some summary"}']
    );
    expect(await run(a, TEST_PATH)).toBeNull();
  });

  // v1.26.x PATCH follow-up (#443 LMStudio + Qwen3.5): a reasoning-mode
  // model under grammar constraint emits `{"": ""}` (placeholder) when its
  // thinking budget is tight. The parseJsonResponse placeholder gate
  // rejects it (returns null), but the model sometimes emits a complete
  // JSON on a second generation pass. SourceAnalyzer's first batch gets
  // ONE bounded retry without halving before giving up. These tests pin
  // that retry: first call returns placeholder (→ null via gate), second
  // returns complete JSON (→ success).
  it('retries first batch once when parse returns null (placeholder gate) then succeeds', async () => {
    const a = mockAnalyze(
      { [TEST_PATH]: '# Test\nContent here.' },
      [
        '{"": ""}', // first attempt → placeholder gate → null → retry
        JSON.stringify({
          source_title: 'Test',
          summary: 'Some summary',
          entities: [{ name: 'EntityA', type: 'other', summary: 'A', mentions_in_source: ['Content here.'] }],
          concepts: [],
        }),
      ]
    );
    const result = await run(a, TEST_PATH);
    expect(result).not.toBeNull();
    expect(result!.entities).toHaveLength(1);
    expect(result!.entities[0].name).toBe('EntityA');
  });

  it('does not retry when first batch has real content that is merely unusable (no entities/concepts keys)', async () => {
    // A non-placeholder object (has source_title + summary but no
    // entities/concepts) is NOT a placeholder — the parse succeeds and
    // normalizeBatchResponse reports validity='unusable'. The first-batch
    // `return null` path (round 1 unusable) fires, not the placeholder
    // retry. This pins that the retry is ONLY for parse-null (placeholder).
    const a = mockAnalyze(
      { [TEST_PATH]: '# Test\nContent here.' },
      ['{"source_title": "Test", "summary": "Some summary"}']
    );
    expect(await run(a, TEST_PATH)).toBeNull();
  });

  it('proceeds when first batch has only entities (glossary case, PR #61)', async () => {
    const a = mockAnalyze(
      { [GLOSSARY_PATH]: '# Glossary\nTerm definitions here.' },
      [JSON.stringify({
        source_title: 'Glossary',
        summary: 'A glossary of terms.',
        entities: [{ name: 'TermA', type: 'other', summary: 'A term', mentions_in_source: [] }],
      })]
    );
    const result = await run(a, GLOSSARY_PATH);
    expect(result).not.toBeNull();
    expect(result!.entities).toHaveLength(1);
    expect(result!.entities[0].name).toBe('TermA');
    expect(result!.concepts).toHaveLength(0);
  });

  it('proceeds when first batch has only concepts', async () => {
    const a = mockAnalyze(
      { [THEORY_PATH]: '# Theory\nContent.' },
      [JSON.stringify({
        source_title: 'Theory',
        summary: 'A theory document.',
        concepts: [{ name: 'TheoryX', type: 'theory', summary: 'A theory', mentions_in_source: [] }],
      })]
    );
    const result = await run(a, THEORY_PATH);
    expect(result).not.toBeNull();
    expect(result!.concepts).toHaveLength(1);
    expect(result!.entities).toHaveLength(0);
  });

  it('extracts source_title and summary from first batch', async () => {
    const a = mockAnalyze(
      { [DOC_PATH]: '# Doc\nBody.' },
      [JSON.stringify({
        source_title: 'My Document',
        summary: 'This document covers important topics.',
        entities: [],
        concepts: [],
      })]
    );
    const result = await run(a, DOC_PATH);
    expect(result).not.toBeNull();
    expect(result!.source_title).toBe('My Document');
  });

  it('handles LLM returning empty arrays for both categories', async () => {
    const a = mockAnalyze(
      { [EMPTY_PATH]: '# Empty\nNothing useful here.' },
      [JSON.stringify({
        source_title: 'Empty',
        summary: 'No entities or concepts found.',
        entities: [],
        concepts: [],
      })]
    );
    const result = await run(a, EMPTY_PATH);
    expect(result).not.toBeNull();
  });

  it('returns null and never calls the LLM for blank / frontmatter-only sources (#164)', async () => {
    // Reproduction of the "Yinmin Zhong" bug: a blank prompt made small/local
    // models fabricate entities to satisfy the JSON schema. The guard must
    // short-circuit BEFORE any LLM call, for empty, whitespace-only, and
    // frontmatter-only files alike.
    for (const blank of ['', '   \n\n\t ', '---\ntags: [draft]\n---']) {
      const { ctx } = createMockContext({
        vaultFiles: { [EMPTY_PATH]: blank },
        llmResponses: [JSON.stringify({
          source_title: 'Hallucinated',
          summary: 'fabricated from nothing',
          entities: [{ name: 'Yinmin Zhong', type: 'person', summary: 'who?', mentions_in_source: [] }],
        })],
      });
      const spy = vi.spyOn(ctx.getClient()!, 'createMessage');
      const analyzer = new SourceAnalyzer(ctx);
      // eslint-disable-next-line obsidianmd/no-tfile-tfolder-cast
      const result = await analyzer.analyzeSource(createMockFile(EMPTY_PATH) as unknown as TFile);
      expect(result).toBeNull();
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it('hard-caps entities and concepts to customEntityLimit / customConceptLimit (#120)', async () => {
    // LLM returns 5 entities and 5 concepts, but limits are set to 2/2.
    // The hard cap must slice the accumulation before buildSourceAnalysis —
    // the prompt instruction alone is not enough since LLMs may ignore it.
    const { ctx } = createMockContext({
      vaultFiles: { [DOC_PATH]: '# Dense\nMany organisms and pathways.' },
      llmResponses: [JSON.stringify({
        source_title: 'Dense',
        summary: 'Many items.',
        entities: [
          { name: 'Alpha', type: 'other', summary: 'a', mentions_in_source: [] },
          { name: 'Beta',  type: 'other', summary: 'b', mentions_in_source: [] },
          { name: 'Gamma', type: 'other', summary: 'c', mentions_in_source: [] },
          { name: 'Delta', type: 'other', summary: 'd', mentions_in_source: [] },
          { name: 'Epsilon', type: 'other', summary: 'e', mentions_in_source: [] },
        ],
        concepts: [
          { name: 'One',   type: 'term', summary: '1', mentions_in_source: [], related_concepts: [] },
          { name: 'Two',   type: 'term', summary: '2', mentions_in_source: [], related_concepts: [] },
          { name: 'Three', type: 'term', summary: '3', mentions_in_source: [], related_concepts: [] },
          { name: 'Four',  type: 'term', summary: '4', mentions_in_source: [], related_concepts: [] },
          { name: 'Five',  type: 'term', summary: '5', mentions_in_source: [], related_concepts: [] },
        ],
      })],
      settings: { extractionGranularity: 'custom', customEntityLimit: 2, customConceptLimit: 2 },
    });
    const analyzer = new SourceAnalyzer(ctx);
    // eslint-disable-next-line obsidianmd/no-tfile-tfolder-cast
    const result = await analyzer.analyzeSource(createMockFile(DOC_PATH) as unknown as TFile);
    expect(result).not.toBeNull();
    expect(result!.entities).toHaveLength(2);
    expect(result!.concepts).toHaveLength(2);
    expect(result!.entities[0].name).toBe('Alpha');
    expect(result!.concepts[0].name).toBe('One');
  });
});

// Issue #482 stage 1: the extraction prompt carries no vault-side payload.
// This replaces the #116 slug-list tests — the list is gone, and what needs
// pinning now is its absence, whatever the vault contains.
describe('analyzeSource payload (#482)', () => {
  it('sends no page catalog, no matter how many pages exist', async () => {
    const { ctx } = createMockContext({
      vaultFiles: {
        'sources/test.md': '# Test\nContent.',
        'wiki/entities/Existing-Page.md': '# Existing Page',
        'wiki/concepts/Another-Page.md': '# Another Page',
      },
      llmResponses: [JSON.stringify({
        source_title: 'Test',
        summary: 'A test.',
        entities: [{ name: 'Foo', type: 'other', summary: 'bar', mentions_in_source: [] }],
      })],
    });
    const spy = vi.spyOn(ctx.getClient()!, 'createMessage');
    const analyzer = new SourceAnalyzer(ctx);
    // eslint-disable-next-line obsidianmd/no-tfile-tfolder-cast
    await analyzer.analyzeSource(createMockFile('sources/test.md') as unknown as TFile);
    expect(spy).toHaveBeenCalled();
    const prompt = spy.mock.calls[0][0].messages[0].content as string;
    expect(prompt).not.toContain('entities/Existing-Page');
    expect(prompt).not.toContain('concepts/Another-Page');
    expect(prompt).not.toContain('Existing Wiki pages');
    // The note itself and its path still travel.
    expect(prompt).toContain('Content.');
    expect(prompt).toContain('sources/test.md');
  });

  it('renders an identical prefix for two notes in different vault states', async () => {
    const render = async (extraPages: Record<string, string>) => {
      const { ctx } = createMockContext({
        vaultFiles: {
          'sources/test.md': '# Test\nContent.',
          ...extraPages,
        },
        llmResponses: [JSON.stringify({
          source_title: 'Test',
          summary: 'A test.',
          entities: [{ name: 'Foo', type: 'other', summary: 'bar', mentions_in_source: [] }],
        })],
      });
      const spy = vi.spyOn(ctx.getClient()!, 'createMessage');
      const analyzer = new SourceAnalyzer(ctx);
      // eslint-disable-next-line obsidianmd/no-tfile-tfolder-cast
      await analyzer.analyzeSource(createMockFile('sources/test.md') as unknown as TFile);
      return spy.mock.calls[0][0].messages[0].content as string;
    };

    const empty = await render({});
    const populated = await render({
      'wiki/entities/One.md': '# One',
      'wiki/concepts/Two.md': '# Two',
      'wiki/concepts/Three.md': '# Three',
    });
    expect(populated).toBe(empty);
  });
});

// === Token dedup — #328 Phase 1 follow-up ===
// source-analyzer user-layer no longer appends Active Tag Vocabulary section
// (system layer injects once via buildSystemPrompt).
describe('SourceAnalyzer — user-layer tag-vocab dedup (#328 Phase 1 follow-up)', () => {
  it('does NOT append the Active Tag Vocabulary section in the user prompt', async () => {
    const { ctx } = createMockContext({
      vaultFiles: { 'sources/dedup.md': '# Dedup\nSome content.' },
      llmResponses: [JSON.stringify({
        source_title: 'Dedup',
        summary: 'A test summary.',
        entities: [{ name: 'Foo', type: 'other', summary: 'bar', mentions_in_source: [] }],
        concepts: [],
      })],
    });
    const spy = vi.spyOn(ctx.getClient()!, 'createMessage');
    const analyzer = new SourceAnalyzer(ctx);
    // eslint-disable-next-line obsidianmd/no-tfile-tfolder-cast
    await analyzer.analyzeSource(createMockFile('sources/dedup.md') as unknown as TFile);
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0].messages[0].content).not.toContain('## Active Tag Vocabulary');
  });
});

// === typed-output migration (v1.26.3 PATCH Issue #443 expanded scope) ===
// Phase B established the createMessageWithOutput path for 6 P0 callers;
// this section extends the same pattern to source-analyzer (extract +
// extract-retry). The mock client from engine-context does not implement
// createMessageWithOutput, so existing tests exercise the legacy fallback
// branch (`if (client.createMessageWithOutput)` guard). The tests below
// pin the wire shape + the typed-output path.
describe('SourceAnalyzer — typed-output migration (#443 expanded scope)', () => {
  it('passes the SourceAnalysisLLMSchema on the wire via response_format.schema (legacy client)', async () => {
    const { ctx } = createMockContext({
      vaultFiles: { 'sources/test.md': '# Test\nSome content.' },
      llmResponses: [JSON.stringify({
        source_title: 'Test',
        summary: 'A test.',
        entities: [{ name: 'Foo', type: 'other', summary: 'bar', mentions_in_source: [] }],
      })],
    });
    const spy = vi.spyOn(ctx.getClient()!, 'createMessage');
    const analyzer = new SourceAnalyzer(ctx);
    // eslint-disable-next-line obsidianmd/no-tfile-tfolder-cast
    await analyzer.analyzeSource(createMockFile('sources/test.md') as unknown as TFile);
    expect(spy).toHaveBeenCalled();
    const call = spy.mock.calls[0][0] as { response_format?: { schema?: unknown } };
    expect(call.response_format?.schema).toBeDefined();
    // Schema must round-trip a valid SourceAnalysis payload (sanity check)
    const parsed = (call.response_format?.schema as { parse: (v: unknown) => unknown }).parse({
      source_title: 'x',
      entities: [{ name: 'a', type: 'person' }],
      concepts: [],
    });
    expect(parsed).toBeDefined();
  });

  it('uses createMessageWithOutput when the client implements it (Tier 0 path)', async () => {
    const { ctx } = createMockContext({
      vaultFiles: { 'sources/test.md': '# Test\nSome content.' },
      // lemma-classify is NOT migrated in this commit — the source-analyzer
      // also calls it later for each new entity. Provide a 2nd response.
      llmResponses: [
        JSON.stringify({
          source_title: 'Test',
          summary: 'A test.',
          entities: [{ name: 'Foo', type: 'other', summary: 'bar', mentions_in_source: [] }],
        }),
        '{"kind": "entity"}',
      ],
    });
    const client = ctx.getClient()!;
    // Add createMessageWithOutput to the mock client — simulates a modern
    // OpenAICompatSdkClient that has the typed-output method (Phase B).
    let extractCalls = 0;
    (client as unknown as { createMessageWithOutput: () => Promise<{ text: string; output?: unknown; outputMode: string; finishReason: string }> }).createMessageWithOutput =
      async () => {
        extractCalls++;
        return {
          text: JSON.stringify({
            source_title: 'Test',
            summary: 'A test.',
            entities: [{ name: 'Foo', type: 'other', summary: 'bar', mentions_in_source: [] }],
          }),
          output: {
            source_title: 'Test',
            summary: 'A test.',
            entities: [{ name: 'Foo', type: 'other', summary: 'bar', mentions_in_source: [] }],
          },
          outputMode: 'json_schema',
          finishReason: 'stop',
        };
      };
    const withOutputSpy = vi.spyOn(client as unknown as { createMessageWithOutput: () => Promise<unknown> }, 'createMessageWithOutput');
    const legacySpy = vi.spyOn(client, 'createMessage');

    const analyzer = new SourceAnalyzer(ctx);
    // eslint-disable-next-line obsidianmd/no-tfile-tfolder-cast
    const result = await analyzer.analyzeSource(createMockFile('sources/test.md') as unknown as TFile);

    // extract went through typed path; lemma-classify still uses legacy
    expect(withOutputSpy).toHaveBeenCalled();
    expect(extractCalls).toBeGreaterThanOrEqual(1);
    // Commit 3: lemma-classify also goes through createMessageWithOutput now,
    // so legacy createMessage is no longer called by either path. Free-text
    // callers (analysis-phase, contradictions, etc.) remain on legacy but
    // they are NOT invoked during analyzeSource.
    expect(legacySpy).not.toHaveBeenCalled();
    expect(result).not.toBeNull();
    expect(result!.entities).toHaveLength(1);
    expect(result!.entities[0].name).toBe('Foo');
  });

  it('falls back to createMessage + parseJsonResponse when the client lacks createMessageWithOutput', async () => {
    // The default mock client does NOT implement createMessageWithOutput
    // (this is the legacy Anthropic / OpenAI / Codex client shape). The
    // code guard `if (client.createMessageWithOutput)` should route the
    // call to createMessage so existing behavior is preserved.
    const { ctx } = createMockContext({
      vaultFiles: { 'sources/test.md': '# Test\nSome content.' },
      llmResponses: [JSON.stringify({
        source_title: 'Test',
        summary: 'A test.',
        entities: [{ name: 'Foo', type: 'other', summary: 'bar', mentions_in_source: [] }],
      })],
    });
    const client = ctx.getClient()!;
    expect((client as unknown as { createMessageWithOutput?: unknown }).createMessageWithOutput).toBeUndefined();
    const legacySpy = vi.spyOn(client, 'createMessage');
    const analyzer = new SourceAnalyzer(ctx);
    // eslint-disable-next-line obsidianmd/no-tfile-tfolder-cast
    const result = await analyzer.analyzeSource(createMockFile('sources/test.md') as unknown as TFile);

    expect(legacySpy).toHaveBeenCalled();
    expect(result).not.toBeNull();
    expect(result!.entities[0].name).toBe('Foo');
  });

  it('extract-retry repair callback also passes the SourceAnalysisLLMSchema on the wire', async () => {
    // Forces a repair path: first call returns malformed JSON, second call
    // (the repair) must use the same schema as the parent call.
    const { ctx } = createMockContext({
      vaultFiles: { 'sources/test.md': '# Test\nSome content.' },
      llmResponses: [
        // lemma-classify (not migrated in this commit) — kind=entity
        '{"kind": "entity"}',
      ],
    });
    const client = ctx.getClient()!;
    let repairCall: unknown = undefined;
    let firstExtractCalled = false;
    // Modern client — both extract and extract-retry go through createMessageWithOutput
    (client as unknown as { createMessageWithOutput: (params: unknown) => Promise<{ text: string; output?: unknown; outputMode?: string; finishReason?: string }> }).createMessageWithOutput =
      async (params: unknown) => {
        const p = params as { task?: string };
        if (p.task === 'extract') {
          firstExtractCalled = true;
          // Malformed-but-closed JSON: braces balance so extractBalancedJson
          // returns a candidate, but JSON.parse fails on the missing comma,
          // routing through parseJsonResult → repair callback (NOT the
          // halve-and-retry branch which only fires on finish_reason='length').
          return {
            text: '{"source_title": "Test" "summary": "missing comma" "entities": []}',
            outputMode: 'text_prompt',
            finishReason: 'stop',
          };
        }
        if (p.task === 'extract-retry') {
          repairCall = params;
          return {
            text: JSON.stringify({
              source_title: 'Test',
              summary: 'Repaired.',
              entities: [{ name: 'Foo', type: 'other', summary: 'bar', mentions_in_source: [] }],
            }),
            output: {
              source_title: 'Test',
              summary: 'Repaired.',
              entities: [{ name: 'Foo', type: 'other', summary: 'bar', mentions_in_source: [] }],
            },
            outputMode: 'json_schema',
            finishReason: 'stop',
          };
        }
        // lemma-classify (not migrated) — uses legacy path
        return { text: '{"kind": "entity"}', outputMode: 'text_prompt', finishReason: 'stop' };
      };
    const analyzer = new SourceAnalyzer(ctx);
    // eslint-disable-next-line obsidianmd/no-tfile-tfolder-cast
    const result = await analyzer.analyzeSource(createMockFile('sources/test.md') as unknown as TFile);
    expect(firstExtractCalled).toBe(true);
    expect(result).not.toBeNull();
    expect(result!.entities[0].name).toBe('Foo');
    // The repair call must carry the schema
    const repairArgs = repairCall as { response_format?: { schema?: unknown }; task?: string };
    expect(repairArgs).toBeDefined();
    expect(repairArgs.task).toBe('extract-retry');
    expect(repairArgs.response_format?.schema).toBeDefined();
  });
});
// Issue #524: a repetition loop in the response is treated like truncation.
// Under grammar-constrained decoding the loop can end in finish_reason=stop
// with schema-valid JSON around it — a handful of items, the loop inside a
// string — and every other guard accepts that as a successful batch. The
// analyzer must halve and retry instead of merging the damaged batch.
describe('SourceAnalyzer — repetition loop guard (#524)', () => {
  const LOOPED = JSON.stringify({
    source_title: 'Test',
    summary: 'A test.',
    entities: [{ name: 'Damaged', type: 'other', summary: 'Sauerteig ' + 'Sauerteig, '.repeat(60), mentions_in_source: ['x'] }],
    concepts: [],
  });
  const CLEAN = JSON.stringify({
    source_title: 'Test',
    summary: 'A test.',
    entities: [{ name: 'Intact', type: 'other', summary: 'fine', mentions_in_source: ['Content here.'] }],
    concepts: [{ name: 'Idea', type: 'other', summary: 'fine', mentions_in_source: ['Content here.'] }],
  });
  const LONG_NOTE = '# Test\n' + 'Content here. '.repeat(400);

  it('halves and retries when the first batch carries a loop, and keeps the clean retry', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const a = mockAnalyze({ [TEST_PATH]: LONG_NOTE }, [LOOPED, CLEAN, '{"kind": "entity"}', '{"kind": "concept"}']);
      const result = await run(a, TEST_PATH);
      expect(result).not.toBeNull();
      const names = [...result!.entities.map(e => e.name), ...result!.concepts.map(c => c.name)];
      expect(names).toContain('Intact');
      expect(names).not.toContain('Damaged');
      expect(warn.mock.calls.some(c => String(c[0]).includes('Repetition loop'))).toBe(true);
      expect(warn.mock.calls.some(c => String(c[0]).includes('repetition loop'))).toBe(true);
    } finally {
      warn.mockRestore();
    }
  });

  it('leaves a clean first batch alone', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const a = mockAnalyze({ [TEST_PATH]: LONG_NOTE }, [CLEAN, '{"kind": "entity"}', '{"kind": "concept"}']);
      const result = await run(a, TEST_PATH);
      expect(result).not.toBeNull();
      expect(warn.mock.calls.some(c => String(c[0]).includes('Repetition loop'))).toBe(false);
    } finally {
      warn.mockRestore();
    }
  });

  // #525 review: the exhaustion arm had no coverage. Only one halve is
  // available per batch (`canHalveBatch` is false once `retryingBatch` is
  // set), so a loop that survives the retry reaches the end of the guard.
  // What happens then is the safety property users actually rely on: the
  // batch is parsed and merged rather than dropped, and the log says so. A
  // future change that turned this into `return null` would lose the whole
  // source on one damaged batch without a single test going red.
  it('parses and merges the damaged batch once the halve budget is spent, and says so', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const a = mockAnalyze({ [TEST_PATH]: LONG_NOTE }, [LOOPED, LOOPED, '{"kind": "entity"}', '{"kind": "concept"}']);
      const result = await run(a, TEST_PATH);
      expect(result).not.toBeNull();
      expect(result!.entities.map(e => e.name)).toContain('Damaged');
      expect(warn.mock.calls.some(c => String(c[0]).includes('No retry budget left'))).toBe(true);
    } finally {
      warn.mockRestore();
    }
  });
});

// #525 review: a note that repeats a phrase itself produces a faithful echo
// that the detector cannot tell from degeneracy. Halving changes how many
// items are asked for, never the note, so the retry is spent on a certainty
// and the same batch is merged afterwards anyway.
describe('SourceAnalyzer — source-borne repetition (#525 review)', () => {
  const REFRAIN = 'Und täglich grüßt das Murmeltier. ';
  // The note itself states the refrain far more often than the detector's
  // Four consecutive occurrences at the start (#542: scattered mentions are
  // not a refrain — the new contract requires back-to-back occurrences, like
  // the response detector's `LOOP_RE` `\1{3,}`). The trailing scattered
  // mentions remain to confirm the count-based path is no longer the
  // trigger; only the consecutive run at the head of the note is.
  const REFRAIN_NOTE = '# Refrain\n' + REFRAIN.repeat(4)
    + ' Dazwischen steht anderer Text. '
    + (REFRAIN + 'Dazwischen steht anderer Text. ').repeat(30);
  const ECHO = JSON.stringify({
    source_title: 'Refrain',
    summary: 'A refrain.',
    entities: [{ name: 'Murmeltier', type: 'other', summary: REFRAIN.repeat(20), mentions_in_source: ['Und täglich grüßt das Murmeltier.'] }],
    concepts: [],
  });

  it('does not spend the retry when the note repeats the loop unit itself', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    try {
      const a = mockAnalyze({ [TEST_PATH]: REFRAIN_NOTE }, [ECHO, '{"kind": "entity"}', '{"kind": "concept"}']);
      const result = await run(a, TEST_PATH);
      expect(result).not.toBeNull();
      expect(result!.entities.map(e => e.name)).toContain('Murmeltier');
      // Pin that a loop WAS detected and classified as an echo — without this
      // the test would also pass if the detector had simply found nothing.
      expect(debug.mock.calls.some(c => String(c[0]).includes('mirrors the source note'))).toBe(true);
      expect(warn.mock.calls.some(c => String(c[0]).includes('treating the batch as damaged'))).toBe(false);
      expect(warn.mock.calls.some(c => String(c[0]).includes('halving batch size'))).toBe(false);
    } finally {
      warn.mockRestore();
      debug.mockRestore();
    }
  });

  it('still treats a loop the note does not contain as damage', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const foreign = JSON.stringify({
        source_title: 'Refrain',
        summary: 'A refrain.',
        entities: [{ name: 'Damaged', type: 'other', summary: 'Sauerteig, '.repeat(60), mentions_in_source: ['x'] }],
        concepts: [],
      });
      const a = mockAnalyze({ [TEST_PATH]: REFRAIN_NOTE }, [foreign, ECHO, '{"kind": "entity"}', '{"kind": "concept"}']);
      const result = await run(a, TEST_PATH);
      expect(result).not.toBeNull();
      expect(warn.mock.calls.some(c => String(c[0]).includes('treating the batch as damaged'))).toBe(true);
    } finally {
      warn.mockRestore();
    }
  });
});
