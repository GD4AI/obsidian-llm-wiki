// Issue #916, fix B: a 2xx that the SDK turned into an error is not a
// provider error.
//
// The SDK wraps a body it could not parse in an APICallError carrying the
// HTTP status. When the request succeeded, that status is 200. The plugin
// then formatted it as `status 200: {the whole body}` — which reads as
// "the status was 200, and it failed", and pastes 725 characters of raw
// response into the UI. Reported on #916.
//
// Two things have to be true of the replacement message:
//   - it must not say `status 200`, because nothing failed at the HTTP level
//   - it must name the likely cause, because "unreadable" alone does not
//     tell a user what to do
//
// The 4xx and 5xx format is unchanged. The URL fallback reads that format
// (`core/url-fallback.ts` parses `status 404: ...`), so changing it would
// break the fallback that finds a working base URL.

import { describe, it, expect } from 'vitest';
import { APICallError } from 'ai';
import { mapAiSdkError } from '../../llm-sdk/openai-sdk-client';

function apiError(statusCode: number, responseBody: string): APICallError {
  return new APICallError({
    message: 'Invalid JSON response',
    url: 'https://gateway.test/v1/chat/completions',
    requestBodyValues: {},
    statusCode,
    responseBody,
    isRetryable: false,
  });
}

describe('mapAiSdkError on a 2xx the SDK could not parse (#916)', () => {
  it('does not present a successful status as a failed one', () => {
    const mapped = mapAiSdkError(apiError(200, '{"id":"x"}'));

    expect(mapped.message).not.toContain('status 200');
    expect(mapped.message).not.toMatch(/^status /);
  });

  it('says the request succeeded and the body could not be read', () => {
    const mapped = mapAiSdkError(apiError(200, '{"id":"x"}'));

    expect(mapped.message).toContain('200');
    expect(mapped.message.toLowerCase()).toContain('body');
  });

  it('names the event-stream cause when the body carries SSE framing', () => {
    const body = '{"id":"x","choices":[],"usage":{}}data: [DONE]';
    const mapped = mapAiSdkError(apiError(200, body));

    expect(mapped.message.toLowerCase()).toContain('stream');
  });

  it('keeps the raw body out of the message beyond a short excerpt', () => {
    const body = 'x'.repeat(5000);
    const mapped = mapAiSdkError(apiError(200, body));

    expect(mapped.message.length).toBeLessThan(600);
    expect(mapped.message).not.toContain('x'.repeat(500));
  });

  it('still carries the status code and the body on the error object', () => {
    const body = '{"id":"x"}';
    const mapped = mapAiSdkError(apiError(200, body)) as Error & { statusCode?: number; responseBody?: string };

    // `core/url-fallback.ts` and the tests read these two.
    expect(mapped.statusCode).toBe(200);
    expect(mapped.responseBody).toBe(body);
  });

  it('leaves the 4xx format alone — the URL fallback parses it', () => {
    const mapped = mapAiSdkError(apiError(404, JSON.stringify({ error: { message: 'Not found' } })));

    expect(mapped.message).toBe('status 404: Not found');
  });

  it('leaves the 429 format alone', () => {
    const mapped = mapAiSdkError(apiError(429, JSON.stringify({ error: { message: 'slow down' } })));

    expect(mapped.message).toBe('status 429: slow down');
  });

  it('leaves a plain-text 4xx body alone', () => {
    const mapped = mapAiSdkError(apiError(400, 'bad request'));

    expect(mapped.message).toBe('status 400: bad request');
  });
});
