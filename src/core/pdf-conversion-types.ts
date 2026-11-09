// Conversion types shared by the PDF and MinerU paths.
//
// Split out by #929: `pdf-converter` and `mineru-converter` imported each
// other for these alone, which made a two-file cycle.

import type { App, TFile } from 'obsidian';
import type { LLMClient } from '../types';
import type { PdfCacheEntry } from './pdf-cache';

/** What the caller hands us. Kept narrow so test mocks stay simple. */
export interface PdfConversionContext {
  app: App;
  settings: {
    provider: string;
    apiKey: string;
    baseUrl?: string;
    model: string;
    forcePdfSupport?: boolean;
    markdownConversionBackend?: 'native' | 'mineru';
    [k: string]: unknown;
  };
  /** Resolved at the WikiEngine boundary from Obsidian SecretStorage. */
  mineruApiToken?: string;
  onMineruPhase?: (phase: 'uploading' | 'waiting' | 'downloading') => void;
  pdfFile: TFile;
  llmClient: LLMClient;
  /** Returns the resolved model for the conversion task. */
  resolveModelForTask: (settings: PdfConversionContext['settings'], task: string) => string;
  /** SubtleCrypto implementation; injected so the gate runs against the
   *  popout-window-aware `activeWindow.crypto.subtle` rather than the
   *  banned `window` global. */
  subtle?: SubtleCrypto;
  /** v1.25.0 PR3 follow-up #8 (Bug D, e2e 2026-07-17): cancellation signal
   *  for the LLM call. When the user clicks the status bar during PDF
   *  conversion, this signal flips to aborted and Vercel AI SDK v6
   *  propagates the cancellation to the underlying HTTP request,
   *  returning early instead of letting the LLM call run to completion.
   *  Legacy clients ignore unknown params and run as before — graceful
   *  degradation, no behavior change for them. */
  abortSignal?: AbortSignal;
}

/** What we return on success. */
export type ConversionResult = PdfCacheEntry;
