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
