// Issue #892: error normalization keyed off `instanceof`, so a second copy of
// `@ai-sdk/provider` in the bundle silently disabled it.
//
// The failure is worth stating plainly because the test has to reproduce it
// without installing two copies. `instanceof` compares class identity, and class
// identity across module boundaries is only stable while exactly one copy of the
// package is installed. `ai` 7.0.142 added a third copy, and the check stopped
// matching an object that WAS an `APICallError` — so `mapAiSdkError` returned it
// untouched, the `status 403: ...` prefix disappeared, and `statusCode` and
// `responseBody` were never attached.
//
// The SDK ships a static `isInstance` on each error class for exactly this
// reason: it checks a registered symbol on the value rather than the prototype
// chain. A plain object carrying those symbols is the smallest faithful
// reproduction of "the class came from somewhere else", and it is what these
// tests build.
import { describe, it, expect } from 'vitest';
import { APICallError, InvalidPromptError, NoSuchModelError } from 'ai';
import { mapAiSdkError } from '../../llm-sdk/openai-sdk-client';

/**
 * A value the SDK's own `isInstance` recognises but `instanceof` does not.
 *
 * `errorName` is the class's own `name` in the SDK's namespace, which is what
 * the marker symbol is derived from.
 */
function foreignSdkError(errorName: string, properties: Record<string, unknown>): Error {
  const error = Object.assign(new Error(String(properties.message ?? '')), properties, {
    name: errorName,
  });
  const markers = error as unknown as Record<symbol, unknown>;
  markers[Symbol.for('vercel.ai.error')] = true;
  markers[Symbol.for(`vercel.ai.error.${errorName}`)] = true;
  return error;
}

/** Its own identity is `instanceof`-visible, which is why the tests above need it. */
function assertNotInstance(foreign: Error, ctor: { isInstance: (e: unknown) => boolean; new (...a: never[]): unknown }) {
  expect(ctor.isInstance(foreign)).toBe(true);
  expect(foreign instanceof (ctor as unknown as new () => object)).toBe(false);
}

// A real quota failure, reported on 2026-10-30 during an end-to-end run. The
// provider's sentence is the whole error: there is no HTTP status in it, and the
// SDK surfaced the gateway's own code `(2067)` inside the message.
//
// Two things this pins. **Every** non-2xx takes the pass-through branch — there
// is no 429/4xx allow-list to miss — and a missing `statusCode` must not be
// rendered as `status 0:`, which invents a fact and buries the sentence a user
// needs.
describe('an error with no HTTP status is passed through as the provider wrote it', () => {
  const QUOTA = '当前已达到 Token Plan 用量上限。为避免调用中断，请升级 Token Plan 套餐，或购买积分补充用量并开启积分自动消耗。 (2067)';

  it('does not invent `status 0` when statusCode is absent', () => {
    const foreign = foreignSdkError('AI_APICallError', {
      message: QUOTA,
      url: 'https://gateway.example/v1/chat/completions',
      requestBodyValues: {},
      isRetryable: false,
    });

    const mapped = mapAiSdkError(foreign);

    expect(mapped.message).toBe(QUOTA);
    expect(mapped.message).not.toContain('status 0');
    expect(mapped.message).not.toContain('undefined');
  });

  it('keeps the `status <code>:` shape when the provider did send one', () => {
    // `core/url-fallback.ts` parses `status 404:` to find a working base URL, so
    // a real status must keep its prefix.
    const foreign = foreignSdkError('AI_APICallError', {
      message: 'quota exceeded',
      url: 'https://gateway.example/v1/chat/completions',
      requestBodyValues: {},
      statusCode: 429,
      responseBody: JSON.stringify({ error: { message: 'quota exceeded' } }),
      isRetryable: false,
    });

    expect(mapAiSdkError(foreign).message).toBe('status 429: quota exceeded');
  });

  it('passes a non-quota 4xx through the same branch', () => {
    // 401 is not special-cased anywhere; this is the assertion that says so.
    const foreign = foreignSdkError('AI_APICallError', {
      message: 'invalid api key',
      url: 'https://gateway.example/v1/chat/completions',
      requestBodyValues: {},
      statusCode: 401,
      responseBody: JSON.stringify({ error: { message: 'invalid api key' } }),
      isRetryable: false,
    });

    expect(mapAiSdkError(foreign).message).toBe('status 401: invalid api key');
  });
});

describe('mapAiSdkError classifies by the SDK marker, not by class identity (#892)', () => {
  it('normalizes an APICallError that came from another copy of the SDK', () => {
    const foreign = foreignSdkError('AI_APICallError', {
      message: 'Request denied',
      url: 'https://api.openai.com/v1/responses',
      requestBodyValues: {},
      statusCode: 403,
      responseBody: JSON.stringify({ error: { message: 'Request denied' } }),
      isRetryable: false,
    });
    assertNotInstance(foreign, APICallError);

    const mapped = mapAiSdkError(foreign) as Error & { statusCode?: number; responseBody?: string };

    // The three things the plugin's UI and the URL fallback actually read.
    expect(mapped.message).toBe('status 403: Request denied');
    expect(mapped.statusCode).toBe(403);
    expect(mapped.responseBody).toBe(JSON.stringify({ error: { message: 'Request denied' } }));
  });

  it('normalizes a NoSuchModelError from another copy', () => {
    const foreign = foreignSdkError('AI_NoSuchModelError', {
      message: 'No such model: gpt-x',
      modelId: 'gpt-x',
      modelType: 'languageModel',
    });
    assertNotInstance(foreign, NoSuchModelError);

    expect(mapAiSdkError(foreign).message).toBe('Unknown model: gpt-x (No such model: gpt-x)');
  });

  it('normalizes an InvalidPromptError from another copy', () => {
    const foreign = foreignSdkError('AI_InvalidPromptError', { message: 'bad prompt' });
    assertNotInstance(foreign, InvalidPromptError);

    expect(mapAiSdkError(foreign).message).toBe('Invalid prompt: bad prompt');
  });

  it('still normalizes a real instance', () => {
    const real = new APICallError({
      message: 'Request denied',
      url: 'https://api.openai.com/v1/responses',
      requestBodyValues: {},
      statusCode: 403,
      responseBody: JSON.stringify({ error: { message: 'Request denied' } }),
      isRetryable: false,
    });

    const mapped = mapAiSdkError(real) as Error & { statusCode?: number };
    expect(mapped.message).toBe('status 403: Request denied');
    expect(mapped.statusCode).toBe(403);
  });

  it('passes an unrelated error through unchanged', () => {
    const plain = new Error('socket hang up');
    expect(mapAiSdkError(plain)).toBe(plain);
  });

  it('stringifies a non-Error throw', () => {
    expect(mapAiSdkError('teapot').message).toBe('teapot');
  });
});
