import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { zipSync } from 'fflate';

const requestUrlMock = vi.hoisted(() => vi.fn());
const cacheStore = vi.hoisted(() => new Map<string, { markdown: string; metadata: { convertedAt: string; converter: string } }>());

vi.mock('obsidian', () => ({ requestUrl: requestUrlMock }));

vi.mock('../../core/pdf-cache', async () => {
  const actual = await vi.importActual<typeof import('../../core/pdf-cache')>('../../core/pdf-cache');
  return {
    ...actual,
    sha256Bytes: vi.fn(async () => 'source-hash'),
    hashCacheKey: vi.fn(async (key: string) => key),
    createPdfCache: () => ({
      get: async (key: string) => cacheStore.get(key) ?? null,
      set: async (key: string, value: { markdown: string; metadata: { convertedAt: string; converter: string } }) => {
        cacheStore.set(key, value);
      },
    }),
  };
});

import { convertPdfToMarkdown } from '../../wiki/pdf-converter';
import { MineruPdfError, convertPdfWithMineru, extractMineruMarkdown } from '../../core/mineru-converter';

function context(overrides: Record<string, unknown> = {}) {
  return {
    app: { vault: { adapter: { readBinary: vi.fn(async () => new Uint8Array([1, 2, 3])) } } } as never,
    settings: { provider: 'anthropic', apiKey: '', model: '', markdownConversionBackend: 'mineru' as const },
    mineruApiToken: 'token',
    pdfFile: { path: 'paper.pdf', name: 'paper.pdf' } as never,
    llmClient: { createMessage: vi.fn() },
    resolveModelForTask: vi.fn(),
    subtle: {} as SubtleCrypto,
    ...overrides,
  };
}

function mockLeaseAndUpload(): void {
  requestUrlMock
    .mockResolvedValueOnce({ status: 200, json: { code: 0, data: { batch_id: 'task-1', file_urls: ['https://upload.example'] } } })
    .mockResolvedValueOnce({ status: 200, json: {} });
}

describe('extractMineruMarkdown', () => {
  beforeEach(() => {
    requestUrlMock.mockReset();
    cacheStore.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('extracts the single full.md document from a MinerU result', () => {
    const archive = zipSync({
      'result/full.md': new TextEncoder().encode('# Parsed PDF\n'),
      'result/unused.png': new Uint8Array([1, 2, 3]),
    });

    expect(extractMineruMarkdown(archive)).toBe('# Parsed PDF\n');
  });

  it('rejects archives without exactly one full.md document', () => {
    expect(() => extractMineruMarkdown(zipSync({ 'result/page.md': new Uint8Array() })))
      .toThrow(/exactly one full\.md/);
  });

  it('rejects archives with duplicate full.md documents', () => {
    const archive = zipSync({
      'first/full.md': new Uint8Array(),
      'second/full.md': new Uint8Array(10 * 1024 * 1024 + 1),
    });

    expect(() => extractMineruMarkdown(archive)).toThrow(/exactly one full\.md/);
  });

  it('rejects invalid UTF-8 in full.md', () => {
    const archive = zipSync({ 'result/full.md': new Uint8Array([0xff]) });

    expect(() => extractMineruMarkdown(archive)).toThrow(/valid UTF-8/);
  });

  it('rejects full.md larger than the cache single-entry limit', () => {
    const archive = zipSync({
      'result/full.md': new Uint8Array(10 * 1024 * 1024 + 1),
    });

    expect(() => extractMineruMarkdown(archive)).toThrow(/full\.md exceeds/);
  });

  it('rejects archives with too many entries without extracting them', () => {
    const files: Record<string, Uint8Array> = {};
    for (let i = 0; i <= 10_000; i++) files[`result/${i}.txt`] = new Uint8Array();

    expect(() => extractMineruMarkdown(zipSync(files))).toThrow(/too many files/);
  });

  it('dispatches through the public converter with VLM and never invokes the LLM', async () => {
    const pdfBuffer = new Uint8Array([1, 2, 3]).buffer;
    const archive = zipSync({ 'result/full.md': new TextEncoder().encode('# From MinerU') });
    requestUrlMock
      .mockResolvedValueOnce({ status: 200, json: { code: 0, data: { batch_id: 'task-1', file_urls: ['https://upload.example'] } } })
      .mockResolvedValueOnce({ status: 200, json: {} })
      .mockResolvedValueOnce({ status: 200, json: { code: 0, data: { extract_result: [{ state: 'done', full_zip_url: 'https://download.example' }] } } })
      .mockResolvedValueOnce({ status: 200, arrayBuffer: archive.buffer });

    const phases = vi.fn();
    const ctx = context({
      app: { vault: { adapter: { readBinary: vi.fn(async () => pdfBuffer) } } },
      onMineruPhase: phases,
    });
    const result = await convertPdfToMarkdown(ctx);

    expect(result.markdown).toBe('# From MinerU');
    expect(ctx.llmClient.createMessage).not.toHaveBeenCalled();
    expect(requestUrlMock).toHaveBeenCalledTimes(4);
    expect(requestUrlMock.mock.calls[0][0]).toMatchObject({ method: 'POST' });
    const createRequest = requestUrlMock.mock.calls[0]?.[0] as { body: string };
    const createBody = JSON.parse(createRequest.body) as { model_version?: unknown };
    expect(createBody.model_version).toBe('vlm');
    const uploadRequest = requestUrlMock.mock.calls[1]?.[0] as { method?: string; body?: unknown };
    expect(uploadRequest.method).toBe('PUT');
    expect(uploadRequest.body).toBe(pdfBuffer);
    expect((phases.mock.calls as Array<[string]>).map(([phase]) => phase)).toEqual(['uploading', 'waiting', 'downloading']);
    expect([...cacheStore.keys()]).toEqual(['source-hash:mineru:vlm:v1']);
  });

  it('returns a cache hit without making network or LLM requests', async () => {
    cacheStore.set('source-hash:mineru:vlm:v1', {
      markdown: '# Cached',
      metadata: { convertedAt: '2026-08-03T00:00:00Z', converter: 'mineru/vlm' },
    });
    const ctx = context();

    const result = await convertPdfWithMineru(ctx);

    expect(result.markdown).toBe('# Cached');
    expect(requestUrlMock).not.toHaveBeenCalled();
    expect(ctx.llmClient.createMessage).not.toHaveBeenCalled();
  });

  it('rejects an oversized PDF before reading it into memory', async () => {
    const readBinary = vi.fn();
    const ctx = context({
      app: { vault: { adapter: { readBinary } } },
      pdfFile: { path: 'large.pdf', name: 'large.pdf', stat: { size: 200 * 1024 * 1024 + 1 } },
    });

    await expect(convertPdfWithMineru(ctx)).rejects.toThrow(/up to 200 MB/);
    expect(readBinary).not.toHaveBeenCalled();
  });

  it('rejects non-HTTPS upload URLs before sending the PDF', async () => {
    requestUrlMock.mockResolvedValueOnce({
      status: 200,
      json: { code: 0, data: { batch_id: 'task-1', file_urls: ['http://upload.example'] } },
    });

    await expect(convertPdfWithMineru(context())).rejects.toThrow(/HTTPS/);
    expect(requestUrlMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces MinerU authentication failures', async () => {
    requestUrlMock.mockResolvedValueOnce({ status: 401, json: {} });

    await expect(convertPdfWithMineru(context())).rejects.toThrow(/HTTP 401/);
  });

  it('surfaces a failed MinerU conversion task', async () => {
    mockLeaseAndUpload();
    requestUrlMock.mockResolvedValueOnce({
      status: 200,
      json: { code: 0, data: { extract_result: [{ state: 'failed', err_msg: 'quota exceeded' }] } },
    });

    await expect(convertPdfWithMineru(context())).rejects.toThrow(/quota exceeded/);
  });

  it('codes a server-side page-limit failure for localized display', async () => {
    mockLeaseAndUpload();
    requestUrlMock.mockResolvedValueOnce({
      status: 200,
      json: {
        code: 0,
        data: {
          extract_result: [{
            state: 'failed',
            err_msg: 'number of pages exceeds limit (200 pages), please split the file and try again',
          }],
        },
      },
    });

    const error = await convertPdfWithMineru(context()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MineruPdfError);
    expect((error as MineruPdfError).code).toBe('page-limit');
  });

  it('leaves unknown server-side failures uncoded (raw pass-through)', async () => {
    mockLeaseAndUpload();
    requestUrlMock.mockResolvedValueOnce({
      status: 200,
      json: { code: 0, data: { extract_result: [{ state: 'failed', err_msg: 'quota exceeded' }] } },
    });

    const error = await convertPdfWithMineru(context()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MineruPdfError);
    expect((error as MineruPdfError).code).toBeUndefined();
  });

  it('codes the client-side size rejection for localized display', async () => {
    const ctx = context({
      pdfFile: { path: 'large.pdf', name: 'large.pdf', stat: { size: 200 * 1024 * 1024 + 1 } },
    });

    const error = await convertPdfWithMineru(ctx).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MineruPdfError);
    expect((error as MineruPdfError).code).toBe('size-limit');
  });

  it('fails fast on an unknown MinerU task state', async () => {
    mockLeaseAndUpload();
    requestUrlMock.mockResolvedValueOnce({
      status: 200,
      json: { code: 0, data: { extract_result: [{ state: 'mystery' }] } },
    });

    await expect(convertPdfWithMineru(context())).rejects.toThrow(/invalid task status/);
    expect(requestUrlMock).toHaveBeenCalledTimes(3);
  });

  it('rejects unsafe result URLs before downloading', async () => {
    mockLeaseAndUpload();
    requestUrlMock.mockResolvedValueOnce({
      status: 200,
      json: { code: 0, data: { extract_result: [{ state: 'done', full_zip_url: 'https://127.0.0.1/result.zip' }] } },
    });

    await expect(convertPdfWithMineru(context())).rejects.toThrow(/safe HTTPS/);
    expect(requestUrlMock).toHaveBeenCalledTimes(3);
  });

  it('returns promptly with AbortError when a request is still pending', async () => {
    const controller = new AbortController();
    requestUrlMock.mockReturnValueOnce(new Promise(() => undefined));
    const conversion = convertPdfWithMineru(context({ abortSignal: controller.signal }));
    await vi.waitFor(() => expect(requestUrlMock).toHaveBeenCalledTimes(1));

    controller.abort();
    const result: unknown = await Promise.race([
      conversion.then<unknown, unknown>(() => 'resolved', (error: unknown) => error),
      new Promise(resolve => window.setTimeout(() => resolve('still-pending'), 50)),
    ]);

    expect(result).toMatchObject({ name: 'AbortError' });
  });

  it('times out while a MinerU request remains pending', async () => {
    vi.useFakeTimers();
    requestUrlMock.mockReturnValueOnce(new Promise(() => undefined));
    const conversion = convertPdfWithMineru(context());
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(requestUrlMock).toHaveBeenCalledTimes(1);
    const rejection = expect(conversion).rejects.toThrow(/timed out after 30 minutes/);

    await vi.advanceTimersByTimeAsync(30 * 60 * 1000);

    await rejection;
  });
});
