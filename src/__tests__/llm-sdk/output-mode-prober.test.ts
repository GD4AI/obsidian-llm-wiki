// output-mode-prober.test.ts
//
// v1.26.3 PATCH Phase A2: replaces json-object-strip-probe.ts with a
// 3-tier output-mode state machine. The probes per-tier:
//
//   isJsonSchemaFieldError — catches 400s that say "response_format.type
//   must NOT be 'json_schema'" (or similar) — i.e. the server does not
//   accept our strongest mode and we should demote Tier 0 → Tier 1.
//
//   isJsonObjectFieldError — existing json-object-strip-probe classifier
//   (kept verbatim so its regressions stay guarded) — catches 400s that
//   say "json_object / response_format not accepted" — i.e. server does
//   not accept Tier 1 either and we should demote Tier 1 → Tier 2.
//
// The cache contract:
//   - getMode(baseURL, model) returns the current tier for a baseURL +
//     model pair. Default = 'json_schema' (assume strongest, demote on
//     failure). Per-model granularity is REQUIRED for placeholder-driven
//     demotion (Issue #443 follow-up): a reasoning model that emits
//     `{"": ""}` on one baseURL must not demote a working model on the
//     same gateway. 400-driven demotion (backend rejects the wire format)
//     is per-baseURL in nature but shares the same key space harmlessly —
//     worst case a sibling model re-probes once.
//   - markMode(baseURL, model, mode) writes the tier to the cache.
//     Called AFTER retry success (not before — transient retry failure
//     must not permanently downgrade a model).
//
// Test matrix pins:
//   1. Default mode = 'json_schema'
//   2. markMode + getMode round-trip per (baseURL, model) — no cross-model
//      leak on the SAME baseURL (Issue #443 follow-up: Qwen placeholder
//      demotion must not demote gemma on the same LM Studio gateway)
//   3. isJsonSchemaFieldError: catches 'json_schema' rejection
//      (e.g. Cloudflare / Anthropic-via-proxy hypothetical response)
//   7. isJsonSchemaFieldError: does NOT match bare 'json' / model names
//   8. isJsonObjectFieldError: matches the LM Studio 400 body verbatim
//      (regression guard — preserves the v1.26.2 fix)
//   9. input must be responseBody, not message — same shape contract as
//      reasoning-strip-probe.test.ts 'Classifier input contract'

import { describe, it, expect } from 'vitest';
import { APICallError } from 'ai';
import { OutputModeProber, type OutputMode } from '../../llm-sdk/output-mode-prober';

describe('OutputModeProber — cache & promotion', () => {
  it('default mode is json_schema (assume strongest, demote on failure)', () => {
    const prober = new OutputModeProber();
    expect(prober.getMode('https://api.deepseek.com/v1', 'deepseek-chat')).toBe('json_schema');
    expect(prober.getMode('https://api.example.com/v1', 'some-model')).toBe('json_schema');
  });

  it('markMode + getMode round-trip per (baseURL, model)', () => {
    const prober = new OutputModeProber();
    prober.markMode('https://api.deepseek.com/v1', 'deepseek-chat', 'json_object');
    expect(prober.getMode('https://api.deepseek.com/v1', 'deepseek-chat')).toBe('json_object');
    // Different baseURL unaffected
    expect(prober.getMode('https://api.openai.com/v1', 'deepseek-chat')).toBe('json_schema');
  });

  it('per-model isolation: same baseURL, different models do not leak (Issue #443 follow-up)', () => {
    // The core reason per-model granularity is required: LM Studio gateway
    // 127.0.0.1:1234 serves Qwen3.5 (placeholder-demoted) AND gemma-4-12b
    // (healthy) on the SAME baseURL. A per-baseURL cache would demote gemma
    // too — the exact regression the E2E log (2026-08-11) warned about.
    const prober = new OutputModeProber();
    const baseURL = 'http://localhost:1234/v1';
    prober.markMode(baseURL, 'qwen3.5-9b', 'text_prompt');
    expect(prober.getMode(baseURL, 'qwen3.5-9b')).toBe('text_prompt');
    // gemma on the same gateway must stay at the strongest tier.
    expect(prober.getMode(baseURL, 'gemma-4-12b')).toBe('json_schema');
  });

});

describe('OutputModeProber.isJsonSchemaFieldError — two-marker classifier for Tier 0 demotion', () => {
  it('matches Anthropic-style: unsupported + json_schema field', () => {
    expect(
      OutputModeProber.isJsonSchemaFieldError(
        "Field 'response_format.json_schema' is not supported by this endpoint",
      ),
    ).toBe(true);
  });

  it('matches Gemini-style: invalid value + json_schema field', () => {
    expect(
      OutputModeProber.isJsonSchemaFieldError(
        "Invalid value for 'response_format.json_schema': schema not allowed",
      ),
    ).toBe(true);
  });

  it('does NOT match when only the verb is present (no field marker)', () => {
    expect(OutputModeProber.isJsonSchemaFieldError('Invalid value for max_tokens')).toBe(false);
    expect(OutputModeProber.isJsonSchemaFieldError('Unsupported model')).toBe(false);
  });

  it('does NOT match when only the field marker is present (no rejection verb)', () => {
    expect(OutputModeProber.isJsonSchemaFieldError('request body contains json_schema')).toBe(false);
  });

  it('does NOT match bare "json" alone (would collide with content-type / model name)', () => {
    expect(OutputModeProber.isJsonSchemaFieldError('Invalid json content')).toBe(false);
  });

  it('is case-insensitive on both verb and field', () => {
    expect(OutputModeProber.isJsonSchemaFieldError('UNSUPPORTED JSON_SCHEMA')).toBe(true);
  });

  it('handles empty / whitespace input safely', () => {
    expect(OutputModeProber.isJsonSchemaFieldError('')).toBe(false);
    expect(OutputModeProber.isJsonSchemaFieldError('   ')).toBe(false);
  });
});

describe('OutputModeProber.isJsonObjectFieldError — two-marker classifier for Tier 1 demotion (regression-guard)', () => {
  // Mirrors the v1.26.2 contract from json-object-strip-probe.ts:
  // same REJECTION_VERBS + FIELD_MARKERS list. If the classifier changes,
  // the contract test below will catch it.

  it('matches LM Studio 400 body verbatim (real-world case)', () => {
    expect(
      OutputModeProber.isJsonObjectFieldError(
        `'response_format.type' must be 'json_schema' or 'text'`,
      ),
    ).toBe(true);
  });

  it('matches OpenAI-style: unsupported + response_format field', () => {
    expect(
      OutputModeProber.isJsonObjectFieldError(
        "Unsupported value: 'response_format.type' = 'json_object'",
      ),
    ).toBe(true);
  });

  it('is case-insensitive on both verb and field', () => {
    expect(OutputModeProber.isJsonObjectFieldError('UNSUPPORTED RESPONSE_FORMAT')).toBe(true);
  });

  it('does NOT match when only the verb is present', () => {
    expect(OutputModeProber.isJsonObjectFieldError('Invalid value for max_tokens')).toBe(false);
  });

  it('does NOT match when only the field marker is present', () => {
    expect(OutputModeProber.isJsonObjectFieldError('response_format supplied')).toBe(false);
  });

  it('does NOT match unrelated 400s (status-only filters handled by TokenKeyProber)', () => {
    expect(OutputModeProber.isJsonObjectFieldError('Request too large')).toBe(false);
    expect(OutputModeProber.isJsonObjectFieldError('Invalid API key')).toBe(false);
    expect(OutputModeProber.isJsonObjectFieldError('Rate limit exceeded')).toBe(false);
  });
});

// v1.26.3 PATCH follow-up — REGRESSION GUARD for the bug surfaced by
// real E2E on LM Studio 0.4.20 (2026-08-10):
//
// AI SDK's APICallError.message is a FIXED template string
// ("Provider returned error") — it does NOT include the provider's
// actual error body. The provider body lives in `err.responseBody`.
// Both classifiers must be called with `err.responseBody`, NOT
// `err.message`. This test simulates the real shape and pins the
// contract (same pattern as reasoning-strip-probe.test.ts).
describe('Classifier input contract: responseBody vs message', () => {
  it('isJsonObjectFieldError matches the responseBody (LM Studio json_object 400)', () => {
    const err = new APICallError({
      message: 'Provider returned error',  // ← AI SDK template (NOT the real body)
      statusCode: 400,
      responseHeaders: {},
      url: 'http://localhost:1234/v1/chat/completions',
      requestBodyValues: {},
      responseBody: '{"error":"\'response_format.type\' must be \'json_schema\' or \'text\'"}',
    });

    // The bug: classifier was called with err.message — "Provider returned
    // error" — no field-rejection marker → false.
    expect(OutputModeProber.isJsonObjectFieldError(err.message ?? '')).toBe(false);
    // The fix: classifier is called with err.responseBody — real body
    // contains "must be" + "response_format" → true.
    expect(OutputModeProber.isJsonObjectFieldError(err.responseBody ?? '')).toBe(true);
  });
});
describe('OutputModeProber.isStrictSchemaRejection — Tier 0 → Tier 0-strict (Issue #658)', () => {
  it('matches the #658 endpoint body verbatim (no REJECTION_VERBS phrase in it)', () => {
    expect(
      OutputModeProber.isStrictSchemaRejection(
        `Invalid schema for response_format 'response': In context=(), 'required' is required to be supplied and to be an array including every key in properties. Missing 'action'.`,
      ),
    ).toBe(true);
  });

  it('matches an additionalProperties complaint', () => {
    expect(OutputModeProber.isStrictSchemaRejection('additionalProperties must be false in strict mode')).toBe(true);
  });

  it('does NOT match the field rejections that drive Tier 1 / Tier 2', () => {
    expect(OutputModeProber.isStrictSchemaRejection(`'response_format.type' must be 'json_schema' or 'text'`)).toBe(false);
    expect(OutputModeProber.isStrictSchemaRejection("Unsupported parameter: 'response_format.json_schema'")).toBe(false);
  });

  it('does NOT match an unrelated 400', () => {
    expect(OutputModeProber.isStrictSchemaRejection('model not found')).toBe(false);
    expect(OutputModeProber.isStrictSchemaRejection('')).toBe(false);
  });
});
