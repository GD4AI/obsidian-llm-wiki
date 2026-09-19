// Mock EngineContext for unit testing.
// Provides pure in-memory vault + mock LLM client — no Obsidian runtime needed.
//
// Usage:
//   import { createMockContext } from './__mocks__/engine-context';
//
//   it('extracts entities from source', async () => {
//     const ctx = createMockContext({
//       vaultFiles: { 'sources/test.md': '# Content ...' },
//       llmResponses: [
//         JSON.stringify({ entities: [{ name: 'Foo', type: 'other', ... }], concepts: [] }),
//       ],
//     });
//     const engine = new SourceAnalyzer(ctx);
//     const file = createMockFile('sources/test.md');
//     const result = await engine.analyzeSource(file);
//     expect(result.entities).toHaveLength(1);
//   });

import { TFile } from 'obsidian'; // mocked in setup.ts
import { EngineContext, LLMClient, LLMWikiSettings } from '../../types';
import type { WikiPageRef } from '../../types';
import { getExistingWikiPages } from '../../wiki/lint/get-existing-pages';
import { parseFrontmatter } from '../../core/frontmatter';

// ── Mock File ────────────────────────────────────────────────────

export interface MockFile {
  path: string;
  basename: string;
  content: string;
}

export function createMockFile(path: string, content = ''): { path: string; basename: string } {
  const parts = path.split('/');
  return { path, basename: parts[parts.length - 1].replace('.md', '') };
}

// ── Mock Vault ───────────────────────────────────────────────────

class MockVault {
  private files = new Map<string, string>();

  constructor(initial: Record<string, string> = {}) {
    for (const [path, content] of Object.entries(initial)) {
      this.files.set(path, content);
    }
  }

  has(path: string): boolean { return this.files.has(path); }
  read(path: string): string | null { return this.files.get(path) ?? null; }
  write(path: string, content: string): void { this.files.set(path, content); }
  list(): string[] { return [...this.files.keys()]; }
  get size(): number { return this.files.size; }
}

// ── Mock LLM Client ──────────────────────────────────────────────

interface CreateMessageCall {
  enableThinking?: boolean;
  // v1.24.0 #208: model string captured at the call site — wiring tests
  // verify resolveModelForTask routed the correct domain value.
  model?: string;
  // other fields intentionally omitted for the F6 test
}

/**
 * Mock LLM client that records every createMessage call's params. Tests
 * can inspect `ctx.lastCreateMessageCall` to verify wiring (e.g. that
 * `enableThinking: false` is propagated to all production call sites —
 * Issue #99 v2 Layer A; that `model` resolves through the per-task
 * resolver — Issue #208 wiring).
 */
export function createMockClient(responses: string[]): LLMClient & { lastCreateMessageCall?: CreateMessageCall } {
  let idx = 0;
  const client: LLMClient & { lastCreateMessageCall?: CreateMessageCall } = {
    createMessage: async (params: { enableThinking?: boolean } & Record<string, unknown>) => {
      client.lastCreateMessageCall = { enableThinking: params.enableThinking, model: params.model as string | undefined };
      return responses[idx++] ?? '{"entities":[],"concepts":[],"contradictions":[],"related_pages":[],"key_points":[]}';
    },
  };
  return client;
}

// ── Default Settings ─────────────────────────────────────────────

export const DEFAULT_SETTINGS: LLMWikiSettings = {
  provider: 'mock',
  apiKey: '',
  openAICodexSecretId: '',
  providerApiKeySecretId: 'karpathywiki-provider-api-key',
  baseUrl: '',
  model: 'mock-model',
  wikiFolder: 'wiki',
  language: 'en',
  wikiLanguage: 'English',
  maxConversationHistory: 10,
  enableSchema: false,
  extractionGranularity: 'standard',
  autoWatchSources: false,
  autoWatchMode: 'notify',
  autoWatchDebounceMs: 5000,
  watchedFolders: [],
  periodicLint: 'off',
  startupCheck: false,
  autoSmartFix: false,
    autoIngestNotificationLevel: 'notice',
  pageGenerationConcurrency: 1,
  batchDelayMs: 0,
  llmReady: true,
  maxTokensPerCall: 0,
  tagVocabularyMode: 'default',
  customEntityTags: '',
  customConceptTags: '',
  slugCase: 'lower' as const,
  createWelcomeNote: true,
  startupCheckNoticeLevel: 'visible' as const,
};

// ── Mock EngineContext ───────────────────────────────────────────

export interface MockContextOptions {
  vaultFiles?: Record<string, string>;
  llmResponses?: string[];
  settings?: Partial<LLMWikiSettings>;
}

export function createMockContext(opts: MockContextOptions = {}): { ctx: EngineContext; vault: MockVault } {
  const vault = new MockVault(opts.vaultFiles);
  const client = createMockClient(opts.llmResponses ?? []);
  const settings = { ...DEFAULT_SETTINGS, ...opts.settings };

  // Build mock files array for getMarkdownFiles
  const mockFiles = Object.keys(opts.vaultFiles ?? {}).map(path => ({
    path,
    basename: path.split('/').pop()?.replace('.md', '') || '',
  }));

  const ctx: EngineContext = {
    app: {
      vault: {
        read: async (file: { path: string }) => vault.read(file.path),
        getMarkdownFiles: () => mockFiles.map(f => ({
          ...f,
          extension: 'md',
          parent: null,
        })),
        getAbstractFileByPath: (path: string) => {
          if (!vault.has(path)) return null;
          return Object.assign(new TFile(), {
            path,
            basename: path.split('/').pop()?.replace('.md', '') || '',
            extension: 'md',
          });
        },
      },
      // Issue #185: mock metadataCache so SourceAnalyzer can read the
      // source note's frontmatter `aliases:` for propagation to the
      // generated sources/<slug> page. Delegates to the production
      // `parseFrontmatter` so the mock handles every YAML shape the
      // production path does (inline `[a, b]`, block `- a\n- b`,
      // quoted strings, empty `[]`).
      metadataCache: {
        getFileCache: (file: { path: string }) => {
          const content = vault.read(file.path);
          const fm = content == null ? null : parseFrontmatter(content);
          return fm ? { frontmatter: fm } : null;
        },
      },
    } as unknown as EngineContext['app'],
    settings,
    getClient: () => client,
    createOrUpdateFile: async (path, content) => { vault.write(path, content); },
    tryReadFile: async (path) => vault.read(path),
    deleteFile: async () => {},
    buildSystemPrompt: async () => undefined,
    getSectionLabels: () => ({
      section_description: 'Description',
      section_related_entities: 'Related Entities',
      section_related_concepts: 'Related Concepts',
      section_mentions_in_source: 'Mentions in Source',
      section_definition: 'Definition',
      section_key_characteristics: 'Key Characteristics',
      section_applications: 'Applications',
      section_source: 'Source',
      section_core_content: 'Core Content',
      section_key_entities: 'Key Entities',
      section_key_concepts: 'Key Concepts',
      section_new_information: 'New Information',
      new_claim: 'New Claim',
      existing_knowledge: 'Existing Knowledge',
      resolution_suggestion: 'Resolution Suggestion',
      source_page: 'Source Page',
    }),
    // Delegates to the real reader against the mock vault. An empty list here
    // would make every test that depends on the vault holding a page pass for
    // the wrong reason.
    getExistingWikiPages(this: { app: unknown; settings: { wikiFolder: string } }) {
      return mockExistingWikiPages(this)();
    },
    getSchemaContext: async () => undefined,
    onFileWrite: undefined,
    onProgress: undefined,
    onDone: undefined,
  };

  return { ctx, vault };
}

/**
 * The page-index seam for a test context.
 *
 * Several test contexts carried this as a byte-identical copy once patch 25
 * moved the index onto the context seam. One shape here means a later change
 * to how tests supply pages is one edit, not several.
 *
 * It delegates to the real reader against the mock vault — exactly what the
 * call inlined in `related-page.ts` did before the seam. Returning an empty
 * list instead would be wrong: some mock vaults do hold pages, and the tests
 * that depend on them would pass for the wrong reason.
 */
export function mockExistingWikiPages(
  ctx: { app: unknown; settings: { wikiFolder: string } }
): () => Promise<WikiPageRef[]> {
  return () => getExistingWikiPages(ctx.app as never, ctx.settings.wikiFolder);
}
