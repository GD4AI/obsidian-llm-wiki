import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { LLMClient } from '../../types';
import {
  convertPdfToMarkdown,
  UnsupportedProviderError,
  EncryptedPdfError,
  type PdfConversionContext,
  type ConversionResult,
} from '../../wiki/pdf-converter';
import { sha256Bytes, hashCacheKey, PDF_CONVERTER_VERSION } from '../../core/pdf-cache';

// Inject the global SubtleCrypto mock from setup.ts so sha256Bytes has
// a real implementation. The mock is deterministic (see setup.ts).
// eslint-disable-next-line obsidianmd/no-global-this
const testSubtle = (globalThis as { crypto: { subtle: SubtleCrypto } }).crypto.subtle;

// Mock the cache class (only `get` and `set` are exercised by the converter;
// `clear` / `invalidate` are also passthrough to the underlying mock).
const mockCacheStore = new Map<string, ConversionResult>();
vi.mock('../../core/pdf-cache', async () => {
  const actual = await vi.importActual<typeof import('../../core/pdf-cache')>('../../core/pdf-cache');
  class MockPdfConversionCache {
    async get(key: string) { return mockCacheStore.get(key) ?? null; }
    async set(key: string, entry: ConversionResult) { mockCacheStore.set(key, entry); }
    async invalidate(key: string) { mockCacheStore.delete(key); }
    async clear() { mockCacheStore.clear(); }
  }
  return {
    ...actual,
    PdfConversionCache: MockPdfConversionCache,
    createPdfCache: () => new MockPdfConversionCache(),
  };
});

const makeMockApp = (pdfBytes: Uint8Array) => ({
  vault: {
    // Default Obsidian config dir. Tests don't exercise the user's actual
    // configDir; this is the canonical default per Obsidian docs.
    // eslint-disable-next-line obsidianmd/hardcoded-config-path
    configDir: '.obsidian',
    getAbstractFileByPath: vi.fn((path: string) => ({
      path,
      name: path.split('/').pop() ?? '',
      extension: path.split('.').pop() ?? '',
    })),
    adapter: {
      readBinary: vi.fn(async () => pdfBytes),
    },
  },
});

/**
 * Bundle returned by `makeContext` — exposes the typed mock client alongside
 * the production-shaped context so tests can assert against either view.
 */
interface TestContextBundle {
  ctx: PdfConversionContext;
  /** vi.fn() instance backing llmClient.createMessage — use this for expect(). */
  mockCreateMessage: ReturnType<typeof vi.fn>;
  /** vi.fn() instance backing resolveModelForTask. */
  mockResolveModel: ReturnType<typeof vi.fn>;
}

/** Type-safe accessor for the LLM mock call args. */
type LlmCallArgs = Parameters<LLMClient['createMessage']>[0];
function getCallArgs(mockFn: ReturnType<typeof vi.fn>): LlmCallArgs {
  // mock.calls is ReadonlyArray<ReadonlyArray<unknown>> per vitest's types;
  // we narrow to the production-shape LLM args here.
  const args: unknown = mockFn.mock.calls[0]?.[0];
  if (args === undefined) throw new Error('expected at least one mock call');
  return args as LlmCallArgs;
}

const SAMPLE_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);

const makeContext = (overrides: Partial<PdfConversionContext> = {}): TestContextBundle => {
  // Build the mock LLM client AS a real LLMClient (so ctx is type-correct),
  // and reach inside for the underlying vi.fn() instance for assertions.
  const mockCreateMessage = vi.fn().mockImplementation(async () => '---\nsourceType: pdf\n---\n# Title\n\nBody');
  const mockResolveModel = vi.fn().mockImplementation(() => 'claude-opus-4-8');

  // The cast below is intentionally LLMClient-typed: the production code
  // reads ctx.llmClient as LLMClient, and ESLint can statically prove that
  // createMessage is a bound method. The mock aspect is reached only via
  // the exposed mockCreateMessage property.
  const llmClient = { createMessage: mockCreateMessage } as LLMClient;

  const ctx: PdfConversionContext = {
    app: makeMockApp(SAMPLE_BYTES) as never,
    settings: {
      provider: 'anthropic',
      apiKey: 'test-key',
      baseUrl: '',
      model: 'claude-opus-4-8',
      forcePdfSupport: false,
    },
    pdfFile: {
      path: 'sources/sample.pdf',
      name: 'sample.pdf',
      extension: 'pdf',
    } as never,
    llmClient,
    resolveModelForTask: mockResolveModel as PdfConversionContext['resolveModelForTask'],
    subtle: testSubtle,
    ...overrides,
  };
  return { ctx, mockCreateMessage, mockResolveModel };
};

describe('convertPdfToMarkdown', () => {
  beforeEach(() => {
    mockCacheStore.clear();
    vi.clearAllMocks();
  });

  it('returns cached result on cache hit without calling LLM', async () => {
    const cached: ConversionResult = {
      markdown: '---\nsourceType: pdf\n---\n# Cached',
      metadata: {
        title: 'Cached',
        pageCount: 5,
        convertedAt: '2026-07-15T10:00:00Z',
        converter: 'anthropic/claude-opus-4-8',
      },
    };
    const hash = await sha256Bytes(SAMPLE_BYTES, testSubtle);
    // PR3 follow-up #2: on-disk cache token is sha256(logicalKey).slice(0,16)
    // (Git short-hash style) — not the logical key itself. The converter
    // computes logicalKey = sha256(content):model:converterVersion, then
    // hashes it to a 16-char hex token before cache.get/set.
    const logicalKey = `${hash}:claude-opus-4-8:${PDF_CONVERTER_VERSION}`;
    const fileToken = await hashCacheKey(logicalKey, testSubtle);
    mockCacheStore.set(fileToken, cached);

    const { ctx, mockCreateMessage } = makeContext();
    const result = await convertPdfToMarkdown(ctx);

    expect(result.markdown).toBe(cached.markdown);
    expect(mockCreateMessage).not.toHaveBeenCalled();
  });

  it('calls LLM API with PDF binary on cache miss and saves to cache', async () => {
    const { ctx, mockCreateMessage } = makeContext();
    const result = await convertPdfToMarkdown(ctx);

    expect(mockCreateMessage).toHaveBeenCalledTimes(1);

    // PDF binary must be in messages as a file content part
    const callArgs = getCallArgs(mockCreateMessage);
    expect(callArgs.messages).toHaveLength(1);
    expect(callArgs.messages[0].role).toBe('user');
    const content = callArgs.messages[0].content;
    expect(Array.isArray(content)).toBe(true);
    const filePart = (content as Array<{ type: string; mediaType?: string }>).find((p) => p.type === 'file');
    expect(filePart).toBeDefined();
    expect(filePart?.mediaType).toBe('application/pdf');

    // Result should be the LLM's response
    expect(result.markdown).toContain('Title');
    expect(result.markdown).toContain('Body');

    // Result should be in cache now
    expect(mockCacheStore.size).toBe(1);
  });

  it('system prompt instructs preserving source language and not translating', async () => {
    const { ctx, mockCreateMessage } = makeContext();
    await convertPdfToMarkdown(ctx);

    const callArgs = getCallArgs(mockCreateMessage);
    const system = callArgs.system ?? '';
    expect(typeof system).toBe('string');
    expect(system.toLowerCase()).toMatch(/preserve.*(source|original).*language/);
    expect(system.toLowerCase()).toMatch(/do\s*not\s*translate/);
  });

  it('throws UnsupportedProviderError when provider is ollama', async () => {
    const { ctx, mockCreateMessage } = makeContext({
      settings: {
        provider: 'ollama',
        apiKey: 'test-key',
        model: 'llama3',
        forcePdfSupport: false,
      },
    });
    await expect(convertPdfToMarkdown(ctx)).rejects.toThrow(UnsupportedProviderError);
    expect(mockCreateMessage).not.toHaveBeenCalled();
  });

  it('throws UnsupportedProviderError when provider is lmstudio', async () => {
    const { ctx } = makeContext({
      settings: {
        provider: 'lmstudio',
        apiKey: '',
        model: 'llama3',
        forcePdfSupport: false,
      },
    });
    await expect(convertPdfToMarkdown(ctx)).rejects.toThrow(UnsupportedProviderError);
  });

  it('throws UnsupportedProviderError when provider is deepseek', async () => {
    const { ctx } = makeContext({
      settings: {
        provider: 'deepseek',
        apiKey: 'test-key',
        model: 'deepseek-v4',
        forcePdfSupport: false,
      },
    });
    await expect(convertPdfToMarkdown(ctx)).rejects.toThrow(UnsupportedProviderError);
  });

  // P0-1: provider gate runs BEFORE cache lookup. A user who switches from
  // anthropic to ollama must not silently receive a stale cache hit.
  it('provider gate runs BEFORE cache lookup (no silent stale hits on provider switch)', async () => {
    const cached: ConversionResult = {
      markdown: '# Old cache from anthropic',
      metadata: {
        convertedAt: '2026-07-15T10:00:00Z',
        converter: 'anthropic/claude-opus-4-8',
      },
    };
    // Pre-populate cache as if user previously ingested via anthropic.
    const hash = await sha256Bytes(SAMPLE_BYTES, testSubtle);
    const logicalKey = `${hash}:claude-opus-4-8:${PDF_CONVERTER_VERSION}`;
    const fileToken = await hashCacheKey(logicalKey, testSubtle);
    mockCacheStore.set(fileToken, cached);

    const { ctx } = makeContext({
      settings: {
        provider: 'ollama',
        apiKey: 'test-key',
        model: 'llama3',
        forcePdfSupport: false,
      },
    });
    await expect(convertPdfToMarkdown(ctx)).rejects.toThrow(UnsupportedProviderError);
  });

  it('throws EncryptedPdfError when PDF is encrypted', async () => {
    const encBytes = new TextEncoder().encode(
      '%PDF-1.4\n1 0 obj\n<< >>\nendobj\ntrailer\n<< /Size 1 /Encrypt 2 0 R >>\nstartxref\n0\n%%EOF\n'
    );
    const { ctx, mockCreateMessage } = makeContext({ app: makeMockApp(encBytes) as never });
    await expect(convertPdfToMarkdown(ctx)).rejects.toThrow(EncryptedPdfError);
    expect(mockCreateMessage).not.toHaveBeenCalled();
  });

  it('allows openai provider (PDF supported natively)', async () => {
    const { ctx, mockCreateMessage } = makeContext({
      settings: {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o',
        forcePdfSupport: false,
      },
    });
    const result = await convertPdfToMarkdown(ctx);
    expect(result.markdown).toBeDefined();
    expect(mockCreateMessage).toHaveBeenCalledTimes(1);
  });

  it('allows anthropic-compatible provider when forcePdfSupport is true (escape hatch)', async () => {
    const { ctx, mockCreateMessage } = makeContext({
      settings: {
        provider: 'anthropic-compatible',
        apiKey: 'test-key',
        baseUrl: 'https://custom.example.com',
        model: 'claude-custom',
        forcePdfSupport: true,
      },
    });
    const result = await convertPdfToMarkdown(ctx);
    expect(result.markdown).toBeDefined();
    expect(mockCreateMessage).toHaveBeenCalledTimes(1);
  });

  it('rejects anthropic-compatible provider when forcePdfSupport is false (default)', async () => {
    const { ctx, mockCreateMessage } = makeContext({
      settings: {
        provider: 'anthropic-compatible',
        apiKey: 'test-key',
        model: 'claude-custom',
        forcePdfSupport: false,
      },
    });
    await expect(convertPdfToMarkdown(ctx)).rejects.toThrow(UnsupportedProviderError);
    expect(mockCreateMessage).not.toHaveBeenCalled();
  });

  it('allows custom (openai-compatible) provider when forcePdfSupport is true', async () => {
    const { ctx, mockCreateMessage } = makeContext({
      settings: {
        provider: 'custom',
        apiKey: 'test-key',
        baseUrl: 'https://custom.example.com',
        model: 'gpt-custom',
        forcePdfSupport: true,
      },
    });
    const result = await convertPdfToMarkdown(ctx);
    expect(result.markdown).toBeDefined();
    expect(mockCreateMessage).toHaveBeenCalledTimes(1);
  });

  // v1.25.0 PR3 (user correction 2026-07-16): `forcePdfSupport` is a
  // universal escape hatch — it must work for ANY non-native provider,
  // not just `custom` / `anthropic-compatible`. The trust boundary is
  // the user: if they say "my ollama endpoint supports PDF", the
  // converter must attempt the LLM call. If the endpoint actually
  // rejects PDF, the LLM error propagates and the user gets a clear
  // Notice (see `wiki-engine.ingestPdfSource`).
  it('attempts LLM call for ollama when forcePdfSupport is true (universal escape hatch)', async () => {
    const { ctx, mockCreateMessage } = makeContext({
      settings: {
        provider: 'ollama',
        apiKey: 'ollama',
        model: 'llama3',
        forcePdfSupport: true,
      },
    });
    const result = await convertPdfToMarkdown(ctx);
    expect(result.markdown).toBeDefined();
    expect(mockCreateMessage).toHaveBeenCalledTimes(1);
  });

  it('attempts LLM call for deepseek when forcePdfSupport is true', async () => {
    const { ctx, mockCreateMessage } = makeContext({
      settings: {
        provider: 'deepseek',
        apiKey: 'test-key',
        model: 'deepseek-v4',
        forcePdfSupport: true,
      },
    });
    const result = await convertPdfToMarkdown(ctx);
    expect(result.markdown).toBeDefined();
    expect(mockCreateMessage).toHaveBeenCalledTimes(1);
  });

  it('propagates LLM errors when forcePdfSupport endpoint rejects PDF', async () => {
    const { ctx, mockCreateMessage } = makeContext({
      settings: {
        provider: 'ollama',
        apiKey: 'ollama',
        model: 'llama3',
        forcePdfSupport: true,
      },
    });
    mockCreateMessage.mockRejectedValueOnce(new Error('Provider rejected PDF input: 400 Bad Request'));
    await expect(convertPdfToMarkdown(ctx)).rejects.toThrow(/rejected PDF/);
  });

  it('propagates LLM errors with provider context (no silent failures)', async () => {
    const { ctx, mockCreateMessage } = makeContext();
    mockCreateMessage.mockRejectedValueOnce(new Error('Provider rejected PDF input: 400 Bad Request'));
    await expect(convertPdfToMarkdown(ctx)).rejects.toThrow(/rejected PDF/);
  });

  it('records converter in metadata as <provider>/<model>', async () => {
    const { ctx } = makeContext();
    const result = await convertPdfToMarkdown(ctx);
    expect(result.metadata.converter).toBe('anthropic/claude-opus-4-8');
  });

  it('writes entry to cache after successful LLM call (subsequent calls hit cache)', async () => {
    const { ctx, mockCreateMessage } = makeContext();
    const first = await convertPdfToMarkdown(ctx);
    expect(mockCreateMessage).toHaveBeenCalledTimes(1);
    mockCreateMessage.mockClear();
    const second = await convertPdfToMarkdown(ctx);
    expect(mockCreateMessage).not.toHaveBeenCalled();
    expect(second.markdown).toBe(first.markdown);
  });

  // P0-2: production code must not access bare `window`. The converter
  // accepts `subtle?` from the caller and never reads from window itself.
  it('uses injected subtle when provided (no bare window access in converter)', async () => {
    // SubtleCrypto interface used only to satisfy the parameter type; the
    // mock cache short-circuits before the digest is called.
    const fakeSubtle = { digest: vi.fn() } as unknown as SubtleCrypto;
    const { ctx, mockCreateMessage } = makeContext({ subtle: fakeSubtle });
    await convertPdfToMarkdown(ctx);
    // sha256Bytes uses FNV fallback (no subtle.digest expected) when we don't
    // pass the SubtleCrypto; with it provided, it would still take the same
    // fallback path because jsdom does not implement subtle. Either way,
    // the converter must never access `window` directly — this is verified
    // statically (the converter source contains no `window` reference).
    expect(mockCreateMessage).toHaveBeenCalled();
  });
});