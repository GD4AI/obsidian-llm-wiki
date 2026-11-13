import { requestUrl } from 'obsidian';
import { unzipSync } from 'fflate';
import {
  MINERU_API_BASE_URL,
  MINERU_MAX_ARCHIVE_FILES,
  MINERU_MAX_PDF_BYTES,
  MINERU_MAX_ZIP_BYTES,
  MINERU_POLL_INTERVAL_MS,
  MINERU_TIMEOUT_MS,
  PDF_CACHE_MAX_SINGLE_ENTRY_BYTES,
} from '../constants';
import {
  createPdfCache,
  hashCacheKey,
  sha256Bytes,
} from './pdf-cache';
import type { ConversionResult, PdfConversionContext } from './pdf-conversion-types';

interface MineruEnvelope {
  code: number | string;
  msg?: string;
  data?: Record<string, unknown>;
}

/**
 * Machine-readable classification for known limit failures. Coded errors
 * are *expected* source rejections (file over a MinerU cap) and route
 * through the engine's skip pipeline with a localized Notice; uncoded
 * errors are unexpected failures and keep the throw semantics.
 */
export type MineruErrorCode = 'page-limit' | 'size-limit' | 'auth';

/**
 * Where the user renews a MinerU token. Named in the message because a 401 is the
 * one MinerU failure whose fix lives in a browser tab.
 */
const MINERU_TOKEN_URL = 'https://mineru.net/apiManage/token';

/**
 * Build the error for a non-2xx MinerU response.
 *
 * A 401 or 403 is coded `auth` and says what is most likely wrong. MinerU issues
 * tokens with an expiry of about 90 days, so "it worked last month and now it
 * answers 401" has one usual cause, and the raw status names none of it. Every
 * other status stays uncoded, because those are runtime failures rather than
 * configuration.
 */
function httpStatusError(what: string, status: number): MineruPdfError {
  if (status === 401 || status === 403) {
    return new MineruPdfError(
      `MinerU rejected the API token while ${what} (HTTP ${status}). The token has `
      + `probably expired — MinerU tokens are valid for about 90 days. Get a new one at `
      + `${MINERU_TOKEN_URL} and paste it into the MinerU API token setting.`,
      'auth',
    );
  }
  return new MineruPdfError(`MinerU ${what} failed with HTTP ${status}.`);
}

export class MineruPdfError extends Error {
  readonly code?: MineruErrorCode;
  constructor(message: string, code?: MineruErrorCode) {
    super(message);
    this.name = 'MineruPdfError';
    if (code !== undefined) this.code = code;
  }
}

// Simplification #7: phase → i18n-key lookup. Replaces the nested ternary
// that wiki-engine.ts used to inline, and gives exhaustiveness checks a
// hook if a future MinerU API state is added (TS will flag the missing
// case at the lookup site).
//
// The value is local; we export the type so callers can build their own
// lookups if they need a different i18n mapping later (e.g. a future
// HTML ingest that wants different progress strings).
export type MineruPhase = 'uploading' | 'waiting' | 'downloading';

export const MINERU_PHASE_KEY = {
  uploading: 'mineruUploadingInProgress',
  waiting: 'mineruWaitingInProgress',
  downloading: 'mineruDownloadingInProgress',
} as const satisfies Record<MineruPhase, string>;

export function extractMineruMarkdown(zipBytes: Uint8Array): string {
  let fileCount = 0;
  let markdownCount = 0;
  try {
    const files = unzipSync(zipBytes, {
      filter: file => {
        if (++fileCount > MINERU_MAX_ARCHIVE_FILES) {
          throw new MineruPdfError('MinerU result archive contains too many files.');
        }
        if (file.name.split('/').pop() !== 'full.md') return false;
        markdownCount++;
        if (markdownCount > 1) {
          throw new MineruPdfError('MinerU result must contain exactly one full.md document.');
        }
        if (file.originalSize > PDF_CACHE_MAX_SINGLE_ENTRY_BYTES) {
          throw new MineruPdfError('MinerU full.md exceeds the size limit.');
        }
        return true;
      },
    });
    if (markdownCount !== 1) {
      throw new MineruPdfError('MinerU result must contain exactly one full.md document.');
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(Object.values(files)[0]);
  } catch (error) {
    if (error instanceof MineruPdfError) throw error;
    if (error instanceof TypeError) {
      throw new MineruPdfError('MinerU full.md is not valid UTF-8.');
    }
    throw new MineruPdfError('MinerU returned an invalid result archive.');
  }
}

function abortError(): DOMException {
  return new DOMException('MinerU conversion was cancelled.', 'AbortError');
}

function withDeadline<T>(promise: Promise<T>, deadline: number, signal?: AbortSignal): Promise<T> {
  throwIfAborted(signal);
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let timeout = 0;
    const finish = (settle: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
      settle();
    };
    const onAbort = () => finish(() => reject(abortError()));
    timeout = window.setTimeout(
      () => finish(() => reject(new MineruPdfError('MinerU conversion timed out after 30 minutes.'))),
      Math.max(0, deadline - Date.now()),
    );
    signal?.addEventListener('abort', onAbort, { once: true });
    promise.then(
      value => finish(() => resolve(value)),
      error => finish(() => reject(error instanceof Error ? error : new MineruPdfError('MinerU request failed.'))),
    );
  });
}

function validateRemoteUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new MineruPdfError('MinerU returned an invalid URL.');
  }
  const host = url.hostname.toLowerCase();
  const localHost = host === 'localhost' || host.endsWith('.localhost') || host === '[::1]' ||
    /^(?:127\.|10\.|169\.254\.|192\.168\.)/.test(host) ||
    /^172\.(?:1[6-9]|2\d|3[01])\./.test(host);
  if (url.protocol !== 'https:' || url.username || url.password || localHost) {
    throw new MineruPdfError('MinerU upload and download URLs must be safe HTTPS URLs.');
  }
  return url.href;
}

export async function convertPdfWithMineru(ctx: PdfConversionContext): Promise<ConversionResult> {
  const token = ctx.mineruApiToken?.trim();
  if (!token) throw new MineruPdfError('A MinerU API token is required.');

  // Fast-fail against the file's cached `stat.size` before paying the
  // IO of `readBinary`. The byte-length check below is the authoritative
  // guard (and runs for both fast-fail-miss and cache-hit-miss paths);
  // the stat check is the no-IO path for files we've already cataloged.
  // Two checks, one shared message — defined as a constant so the wording
  // stays in lockstep if the MinerU limit changes.
  const oversizedMessage = 'MinerU accepts files up to 200 MB.';
  if (ctx.pdfFile.stat?.size !== undefined && ctx.pdfFile.stat.size > MINERU_MAX_PDF_BYTES) {
    throw new MineruPdfError(oversizedMessage, 'size-limit');
  }

  const bytes = new Uint8Array(await ctx.app.vault.adapter.readBinary(ctx.pdfFile.path));
  if (bytes.byteLength > MINERU_MAX_PDF_BYTES) {
    throw new MineruPdfError(oversizedMessage, 'size-limit');
  }

  // MinerU model version: hardcoded to 'vlm' (PR #404 default; 'pipeline'
  // and 'MinerU-HTML' are exposed by the API but the vlm model is the
  // recommended path per https://mineru.net/apiManage/docs). When the
  // surface area is clear, this becomes a settings field; for now keeping
  // it inline is consistent with PR #404's existing cache-key shape
  // (`:mineru:vlm:v1`) so existing users do not invalidate cache.
  const modelVersion = 'vlm';

  const sourceHash = await sha256Bytes(bytes, ctx.subtle);
  const cache = createPdfCache(ctx.app);
  const cacheKey = await hashCacheKey(
    `${sourceHash}:mineru:${modelVersion}:v1`,
    ctx.subtle,
  );
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const deadline = Date.now() + MINERU_TIMEOUT_MS;
  const lease = await requestUpload(token, ctx.pdfFile.name, modelVersion, deadline, ctx.abortSignal);
  ctx.onMineruPhase?.('uploading');
  await uploadPdf(lease.uploadUrl, bytes, deadline, ctx.abortSignal);
  ctx.onMineruPhase?.('waiting');
  const result = await waitForResult(token, lease.taskId, deadline, ctx.abortSignal);
  ctx.onMineruPhase?.('downloading');
  const zipBytes = await downloadResult(result, deadline, ctx.abortSignal);
  if (zipBytes.byteLength > MINERU_MAX_ZIP_BYTES) {
    throw new MineruPdfError('MinerU result archive exceeds the size limit.');
  }

  const markdown = extractMineruMarkdown(zipBytes);
  const entry: ConversionResult = {
    markdown,
    metadata: {
      convertedAt: new Date().toISOString(),
      converter: `mineru/${modelVersion}`,
    },
  };
  await cache.set(cacheKey, entry);
  return entry;
}

async function requestUpload(
  token: string,
  filename: string,
  modelVersion: 'vlm',
  deadline: number,
  signal?: AbortSignal,
): Promise<{ taskId: string; uploadUrl: string }> {
  const envelope = await mineruRequest(token, '/file-urls/batch', {
    method: 'POST',
    body: JSON.stringify({ files: [{ name: filename }], model_version: modelVersion }),
  }, deadline, signal);
  const taskId = stringValue(envelope.data?.batch_id);
  const uploadUrl = Array.isArray(envelope.data?.file_urls)
    ? stringValue(envelope.data.file_urls[0])
    : undefined;
  if (!taskId || !uploadUrl) throw new MineruPdfError('MinerU returned an invalid upload response.');
  return { taskId, uploadUrl: validateRemoteUrl(uploadUrl) };
}

async function uploadPdf(url: string, bytes: Uint8Array, deadline: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  const body = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
    ? bytes.buffer as ArrayBuffer
    : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const response = await withDeadline(requestUrl({
    url,
    method: 'PUT',
    body,
    throw: false,
  }), deadline, signal);
  if (response.status < 200 || response.status >= 300) {
    throw httpStatusError('PDF upload', response.status);
  }
}

async function waitForResult(
  token: string,
  taskId: string,
  deadline: number,
  signal?: AbortSignal,
): Promise<string> {
  while (Date.now() < deadline) {
    throwIfAborted(signal);
    const envelope = await mineruRequest(
      token,
      `/extract-results/batch/${encodeURIComponent(taskId)}`,
      { method: 'GET' },
      deadline,
      signal,
    );
    const results = envelope.data?.extract_result;
    const record = Array.isArray(results) && results.length === 1 && typeof results[0] === 'object'
      ? results[0] as Record<string, unknown>
      : undefined;
    const state = stringValue(record?.state);
    if (state === 'done') {
      const zipUrl = stringValue(record?.full_zip_url);
      if (!zipUrl) throw new MineruPdfError('MinerU returned no result archive URL.');
      return validateRemoteUrl(zipUrl);
    }
    if (state === 'failed') {
      const errMsg = stringValue(record?.err_msg);
      throw new MineruPdfError(errMsg ?? 'MinerU conversion failed.', classifyMineruFailure(errMsg));
    }
    if (!state || !['waiting-file', 'pending', 'running', 'converting'].includes(state)) {
      throw new MineruPdfError('MinerU returned an invalid task status.');
    }
    await withDeadline(new Promise(resolve => window.setTimeout(resolve, MINERU_POLL_INTERVAL_MS)), deadline, signal);
  }
  throw new MineruPdfError('MinerU conversion timed out after 30 minutes.');
}

async function downloadResult(url: string, deadline: number, signal?: AbortSignal): Promise<Uint8Array> {
  throwIfAborted(signal);
  const response = await withDeadline(requestUrl({ url, method: 'GET', throw: false }), deadline, signal);
  if (response.status < 200 || response.status >= 300) {
    throw httpStatusError('result download', response.status);
  }
  return new Uint8Array(response.arrayBuffer);
}

async function mineruRequest(
  token: string,
  path: string,
  request: { method: string; body?: string },
  deadline: number,
  signal?: AbortSignal,
): Promise<MineruEnvelope> {
  throwIfAborted(signal);
  const response = await withDeadline(requestUrl({
    url: `${MINERU_API_BASE_URL}${path}`,
    method: request.method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(request.body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(request.body ? { body: request.body } : {}),
    throw: false,
  }), deadline, signal);
  if (response.status < 200 || response.status >= 300) {
    throw httpStatusError('request', response.status);
  }
  const envelope = response.json as MineruEnvelope;
  if (!envelope || (envelope.code !== 0 && envelope.code !== '0')) {
    throw new MineruPdfError(envelope?.msg ?? 'MinerU API request failed.');
  }
  return envelope;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Map a server-side task-failure message to a limit code so the engine can
 * show a localized rejection instead of the raw English err_msg. Only the
 * observed page-cap phrasing is classified — unknown messages stay uncoded
 * and keep the pass-through error semantics.
 */
function classifyMineruFailure(message: string | undefined): MineruErrorCode | undefined {
  if (!message) return undefined;
  if (/pages?\s+exceeds\s+limit/i.test(message)) return 'page-limit';
  return undefined;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}
