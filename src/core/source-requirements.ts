// Pre-ingest requirements gate (Issue #164).
//
// Pure, zero-IO content checks run on every source file BEFORE it reaches the
// LLM. A blank file makes small/local models hallucinate entities to satisfy
// the JSON schema (the "Yinmin Zhong" bug); incompatible binaries produce
// garbage. Each check returns a SourceRejection (or null to pass); the engine
// logs the rejection and skips the file.
//
// Extensible by design: to add a new content rule (e.g. prompt-injection
// detection) write a check function and append it to CONTENT_CHECKS — the
// 'injection' reason is already in the union. Stateful checks that need the
// vault or batch context (uniqueness/dedup) live in the engine, not here.

import { isBlankSource } from './frontmatter';
import type { RejectionReason } from '../types';

export interface SourceRejection {
  reason: RejectionReason;
  /** Optional human-readable specifics for logs/UI (e.g. the offending extension). */
  detail?: string;
  /** Extra i18n placeholder substitutions beyond {filename} (e.g. the
   *  MinerU limit value behind `{limit}`), applied by the engine's skip
   *  Notice. Keys map to `placeholder name → display string`. */
  params?: Record<string, string>;
}

export interface ContentCheckInput {
  /** File extension without the leading dot (e.g. 'md'). */
  extension: string;
  /** Full raw file content. */
  content: string;
  /** Allowlist of accepted extensions (lowercase, no dot). */
  allowedExtensions: readonly string[];
}

/** Reject files with no extractable body (empty / whitespace / frontmatter-only). */
export function checkNonEmpty(input: ContentCheckInput): SourceRejection | null {
  return isBlankSource(input.content) ? { reason: 'empty' } : null;
}

/** Reject files whose extension is not in the allowlist (case-insensitive). */
export function checkCompatibleType(input: ContentCheckInput): SourceRejection | null {
  return input.allowedExtensions.includes(input.extension.toLowerCase())
    ? null
    : { reason: 'incompatible-type', detail: input.extension };
}

/**
 * Ordered registry of content checks. To add a new rule (e.g. checkInjection),
 * append it here — `checkContentRequirements` runs them in order and returns the
 * first failure.
 */
export const CONTENT_CHECKS: ReadonlyArray<(input: ContentCheckInput) => SourceRejection | null> = [
  checkNonEmpty,
  checkCompatibleType,
];

/** Run every content check in order; return the first rejection, or null if all pass. */
export function checkContentRequirements(input: ContentCheckInput): SourceRejection | null {
  for (const check of CONTENT_CHECKS) {
    const rejection = check(input);
    if (rejection) return rejection;
  }
  return null;
}

/**
 * Deterministic, whitespace-normalized fingerprint of a source body, for
 * content-level dedup. FNV-1a 32-bit (mirrors `sourceFingerprint` in
 * source-slug.ts) prefixed with the normalized length: the length prefix means
 * two bodies must match on BOTH length and hash to be treated as duplicates,
 * making accidental collisions (and the silent skip they would cause)
 * astronomically unlikely. The `-` separator keeps the value a clean YAML
 * scalar when stored in source-page frontmatter.
 */
export function hashBody(body: string): string {
  const norm = body.trim().replace(/\s+/g, ' ');
  let hash = 0x811c9dc5; // FNV-1a offset basis
  for (let i = 0; i < norm.length; i++) {
    hash ^= norm.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime, 32-bit via imul
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  return `${norm.length.toString(16)}-${hex}`;
}
