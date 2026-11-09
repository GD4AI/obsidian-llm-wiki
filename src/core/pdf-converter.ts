/**
 * v1.25.0 PDF Level 1 — PDF → Markdown conversion via LLM API.
 *
 * Reads the PDF binary from the vault, hashes it for cache keying, and
 * dispatches a single LLM call with the PDF as a file content part. The
 * provider's native PDF support does the actual reading; we wrap that
 * result with deterministic cache lookup, metadata extraction, and a
 * versioned system prompt that locks in "preserve source language" behavior.
 *
 * Architecture (correctness-ordered; provider gate precedes cache lookup
 * so a user who switches from `anthropic` to `ollama` cannot silently
 * receive a cached conversion from a now-unsupported provider):
 *   1. Read PDF bytes (vault.adapter.readBinary)
 *   2. Provider capability gate (cheap, must run before cache return)
 *   3. sha256 the bytes + compose logical cache key (sha256:model:version)
 *   4. Hash the logical key to a 16-char hex file token (cross-platform safe)
 *   5. Cache hit → return cached entry (no LLM call)
 *   6. Cache miss → encryption check, metadata extract, LLM call
 *   7. Write LLM response to cache under the file token
 *
 * Provider support matrix:
 *   - anthropic / openai / bedrock-anthropic / bedrock-openai: native PDF support
 *   - custom / anthropic-compatible: requires forcePdfSupport=true (else throw)
 *   - ollama / lmstudio / deepseek / glm: never supported (throw)
 *
 * Errors are surfaced verbatim — the LLM client already wraps them in
 * the project's standard error shape. We do not add a translation layer.
 */

import {
  sha256Bytes,
  hashCacheKey,
  PDF_CONVERTER_VERSION,
  createPdfCache,
} from './pdf-cache';
import {
  parsePdfInfoDictText,
  isEncryptedPdfText,
} from './pdf-metadata';
import {
  TOKENS_PDF_CONVERSION,
  NATIVE_PDF_PROVIDER_IDS,
} from '../constants';
import { PDF_PROMPTS } from '../wiki/prompts/pdf';
import { convertPdfWithMineru } from './mineru-converter';
import type { ConversionResult, PdfConversionContext } from './pdf-conversion-types';

// Re-exported so the call sites that read these from this module keep working.
export type { ConversionResult, PdfConversionContext };

// --- public types ---



// --- errors ---

export class UnsupportedProviderError extends Error {
  constructor(public readonly provider: string) {
    super(
      `PDF conversion is not supported by provider "${provider}". ` +
        `Supported providers: anthropic, openai, bedrock-anthropic, bedrock-openai. ` +
        `For other OpenAI-compatible or Anthropic-compatible providers, enable ` +
        `"Force PDF Support" in Settings → LLM Configuration → Advanced (at your own risk).`
    );
    this.name = 'UnsupportedProviderError';
  }
}

export class EncryptedPdfError extends Error {
  constructor() {
    super(
      'PDF is encrypted. v1.25.0 cannot decrypt encrypted PDFs. ' +
        'Please decrypt the file using Adobe Acrobat, qpdf, or your PDF tool of choice, ' +
        'then ingest the decrypted file.'
    );
    this.name = 'EncryptedPdfError';
  }
}

// --- main entry point ---

/**
 * Converts a PDF to Markdown using the configured LLM provider.
 *
 * Returns the cached entry on cache hit; on miss, calls the LLM, caches
 * the result, and returns. Throws UnsupportedProviderError if the provider
 * cannot handle PDF, EncryptedPdfError if the file is encrypted, and
 * propagates LLM errors verbatim.
 */
export async function convertPdfToMarkdown(ctx: PdfConversionContext): Promise<ConversionResult> {
  if (ctx.settings.markdownConversionBackend === 'mineru') {
    return convertPdfWithMineru(ctx);
  }
  const { app, settings, pdfFile, llmClient, resolveModelForTask, subtle } = ctx;

  // 1. Read PDF bytes. readBinary returns ArrayBuffer; wrap as Uint8Array so
  // the rest of the pipeline (sha256, TextDecoder, base64) work with the same
  // shape.
  const bytes = new Uint8Array(await app.vault.adapter.readBinary(pdfFile.path));

  // 2. Provider gate FIRST (must run before cache lookup so a user switching
  // from `anthropic` to `ollama` cannot silently receive a stale cache hit).
  if (!providerSupportsPdf(settings)) {
    throw new UnsupportedProviderError(settings.provider);
  }

  // 3. Resolve model — cache key includes model so switching the ingest
  // model returns a fresh conversion rather than a cache hit from a
  // different model.
  const model = resolveModelForTask(settings, 'ingest');

  // 4. Cache lookup. The logical `cacheKey` carries the model +
  // converterVersion so cache hits distinguish "same PDF + same model +
  // same prompt" from "same PDF + different model + same prompt".
  //
  // The on-disk filename is NOT the logical key (it contains `:` and may
  // contain `/` from `provider/model` strings, which Windows forbids and
  // POSIX treats as a subpath). We hash the logical key to a 16-char hex
  // token (Git short-hash style) for filesystem safety; the logical key
  // remains implicit through the converter-version + model contract.
  const cache = createPdfCache(app);
  const logicalKey = `${await sha256Bytes(bytes, subtle)}:${model}:${PDF_CONVERTER_VERSION}`;
  const fileToken = await hashCacheKey(logicalKey, subtle);
  const cached = await cache.get(fileToken);
  if (cached) return cached;

  // 5. Miss branch — decode once, run encryption + metadata scan, then LLM.
  const text = new TextDecoder('latin1').decode(bytes);
  if (isEncryptedPdfText(text)) {
    throw new EncryptedPdfError();
  }
  const info = parsePdfInfoDictText(text);

  // 6. Encode PDF as base64 for the LLM content part
  const base64 = bytesToBase64(bytes);

  // 7. Call LLM. abortSignal is threaded through so the status-bar cancel
  // button actually interrupts the LLM HTTP request via Vercel AI SDK v6.
  // v1.25.0 PR3 follow-up #9 (prompt centralization): the verbatim
  // system prompt lives in src/wiki/prompts/pdf.ts alongside every other
  // LLM-call prompt in the project (barrel re-exported by src/prompts.ts).
  const response = await llmClient.createMessage({
    task: 'pdf-convert',
    model,
    max_tokens: TOKENS_PDF_CONVERSION,
    system: PDF_PROMPTS.systemPrompt,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: buildUserText(info) },
          {
            type: 'file',
            data: base64,
            mediaType: 'application/pdf',
            filename: pdfFile.name,
          },
        ],
      },
    ],
    ...(ctx.abortSignal ? { abortSignal: ctx.abortSignal } : {}),
  });

  // v1.25.0 PR3 follow-up #9 (output cleanup): some local / small models
  // (Qwen3.5-2B-MLX-4bit, Llama 3 8B Instruct, etc.) wrap their response
  // in ```markdown ... ``` fences despite the system prompt forbidding
  // them. The cleaner normalizes the response before we write it to
  // cache — preventing fence contamination from leaking into the wiki
  // summary generation downstream. The cleaner is conservative
  // (returns input unchanged when no rule matches) so a model that
  // emits clean Markdown passes through untouched.
  const cleanedMarkdown = PDF_PROMPTS.unwrapFencedMarkdown(response);

  // 8. Build the result entry and cache it under the file token (NOT the
  // raw logical key — see step 4 comment for why).
  const entry: ConversionResult = {
    markdown: cleanedMarkdown,
    metadata: {
      title: info.title,
      author: info.author,
      pageCount: info.pageCount,
      convertedAt: new Date().toISOString(),
      converter: `${settings.provider}/${model}`,
    },
  };
  await cache.set(fileToken, entry);
  return entry;
}

// --- helpers ---

/**
 * Provider capability gate.
 *
 * A provider can convert PDFs if EITHER:
 *   - it appears in `NATIVE_PDF_PROVIDER_IDS` (anthropic / openai /
 *     bedrock-anthropic / bedrock-openai) — the provider's built-in
 *     client handles `application/pdf` content parts natively; OR
 *   - the user has enabled the `forcePdfSupport` escape hatch in Settings.
 *     This is a UNIVERSAL override: any non-native provider that the user
 *     believes supports PDF input on their endpoint (custom / anthropic-
 *     compatible / ollama / lmstudio / deepseek / glm / kimi / gemini /
 *     openrouter / future providers) is allowed through. If the endpoint
 *     actually rejects the PDF input, the LLM error propagates to
 *     `wiki-engine.ingestPdfSource`, which surfaces a localized Notice
 *     guiding the user to disable the toggle or check their endpoint.
 *
 * Design rationale: the user is the authoritative source on what their
 * endpoint supports. A pre-flight whitelist reject violates user intent
 * (the user explicitly opted in). The trust boundary is: the user said
 * "try it" — so we try, and surface the truth if it fails.
 */
function providerSupportsPdf(settings: PdfConversionContext['settings']): boolean {
  if ((NATIVE_PDF_PROVIDER_IDS as readonly string[]).includes(settings.provider)) return true;
  if (settings.forcePdfSupport === true) return true;
  return false;
}

function bytesToBase64(bytes: Uint8Array): string {
  // Avoid Node's `Buffer` (forbidden by obsidianmd/no-node-builtin rule).
  // The naive `btoa(String.fromCharCode(...bytes))` is O(n²) because each
  // String.fromCharCode + string-concat allocates a new string of the
  // accumulator so far. For a 100 MB PDF this is ~10^16 character copies.
  // Chunked encoding keeps each concat bounded to a single ~32 KB slice.
  const CHUNK = 0x8000; // 32 KB
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK);
    // String.fromCharCode.apply with the Uint8Array works in Obsidian's
    // Chromium runtime; the cast is a typing convenience.
    binary += String.fromCharCode.apply(null, slice as unknown as number[]);
  }
  return btoa(binary);
}

function buildUserText(info: { title?: string; author?: string; pageCount?: number }): string {
  const parts: string[] = ['Convert the attached PDF to Markdown.'];
  const hints: string[] = [];
  if (info.title) hints.push(`Title (from PDF metadata): ${info.title}`);
  if (info.author) hints.push(`Author: ${info.author}`);
  if (info.pageCount !== undefined) hints.push(`Page count: ${info.pageCount}`);
  if (hints.length > 0) {
    parts.push('\nMetadata hints (from the PDF Info dict; verify against actual content):');
    for (const h of hints) parts.push(`- ${h}`);
  }
  return parts.join('\n');
}
