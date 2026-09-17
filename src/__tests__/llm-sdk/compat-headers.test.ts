// compat-headers.test.ts — Issue #723
//
// The helper is the only place the three header sources are ordered, so the
// precedence rules live here rather than in the client: plugin identity first,
// then the provider preset's defaults with `{sessionId}` filled in, then the
// user's own, which win.

import { describe, it, expect } from 'vitest';
import { compatHeaders, parseCustomHeaders, SESSION_ID_PLACEHOLDER } from '../../llm-sdk/compat-headers';

describe('parseCustomHeaders', () => {
  it('reads one `Name: value` per line', () => {
    const { headers, invalid } = parseCustomHeaders('X-One: 1\nX-Two: 2');
    expect(headers).toEqual({ 'X-One': '1', 'X-Two': '2' });
    expect(invalid).toBe(0);
  });

  it('skips blank lines and `#` comments', () => {
    const { headers, invalid } = parseCustomHeaders('# a note\n\nX-One: 1\n   \n# another');
    expect(headers).toEqual({ 'X-One': '1' });
    expect(invalid).toBe(0);
  });

  it('splits on the FIRST colon only, so a value may contain one', () => {
    // A URL or a `Bearer`-prefixed token is the common case; splitting on the
    // last colon would mangle both.
    const { headers } = parseCustomHeaders('X-Url: https://example.com:8443/x');
    expect(headers['X-Url']).toBe('https://example.com:8443/x');
  });

  it('allows an empty value but rejects a missing name', () => {
    expect(parseCustomHeaders('X-Empty:').headers).toEqual({ 'X-Empty': '' });
    expect(parseCustomHeaders(': novalue').invalid).toBe(1);
    expect(parseCustomHeaders('no colon here').invalid).toBe(1);
  });

  it('counts invalid lines rather than turning a typo into a header', () => {
    // The point of counting: a malformed line must not silently become a header
    // named after whatever preceded the colon.
    const { headers, invalid } = parseCustomHeaders('good: 1\nbroken\n  : x\nanother: 2');
    expect(headers).toEqual({ good: '1', another: '2' });
    expect(invalid).toBe(2);
  });

  it('rejects a name that is not an RFC 7230 token', () => {
    // Review finding 2 (@aisahpA, #736): `My Header: v` used to pass the colon
    // test, then `Headers.set` threw inside the fetch wrapper — an opaque
    // request failure with no hint at the line that caused it.
    const { headers, invalid } = parseCustomHeaders('My Header: v\nX-Good: ok');
    expect(headers).toEqual({ 'X-Good': 'ok' });
    expect(invalid).toBe(1);
  });

  it('rejects a control character in the value but allows TAB', () => {
    const { headers, invalid } = parseCustomHeaders('X-Bad: a\u0000b\nX-Tab: a\tb');
    expect(headers).toEqual({ 'X-Tab': 'a\tb' });
    expect(invalid).toBe(1);
  });

  it('accepts the full token character set', () => {
    // `!#$%&'*+-.^_`|~` are all legal, and real gateways use some of them.
    const { headers, invalid } = parseCustomHeaders("X-Odd!#$%&'*+-.^_`|~: v");
    expect(invalid).toBe(0);
    expect(headers["X-Odd!#$%&'*+-.^_`|~"]).toBe('v');
  });

  it('tolerates undefined and empty input', () => {
    expect(parseCustomHeaders(undefined).headers).toEqual({});
    expect(parseCustomHeaders('').headers).toEqual({});
  });
});

describe('compatHeaders', () => {
  it('always identifies the plugin, whichever provider is in use', () => {
    // Not a response to any provider's requirement — a statement about which
    // client this is. The AI SDK would otherwise send its own generic name.
    expect(compatHeaders({ version: '1.2.3' })?.['User-Agent']).toBe('karpathywiki/1.2.3');
    expect(compatHeaders({})?.['User-Agent']).toBe('karpathywiki/unknown');
  });

  it('fills the session placeholder in a preset header', () => {
    const headers = compatHeaders({
      version: '1.0.0',
      presetHeaders: { 'x-opencode-session': SESSION_ID_PLACEHOLDER },
      sessionId: () => 'sess-42',
    });
    expect(headers?.['x-opencode-session']).toBe('sess-42');
  });

  it('leaves a preset header without the placeholder untouched', () => {
    const headers = compatHeaders({
      version: '1.0.0',
      presetHeaders: { 'X-Static': 'v' },
      sessionId: () => 'sess-42',
    });
    expect(headers?.['X-Static']).toBe('v');
  });

  it('lets a user header win over both the identity and the preset', () => {
    // The AI SDK adds `Authorization` from `apiKey` before the custom map and
    // documents the map as overriding, so this ordering is what reaches the wire.
    const headers = compatHeaders({
      version: '1.0.0',
      presetHeaders: { 'x-opencode-session': SESSION_ID_PLACEHOLDER, 'X-Preset': 'preset' },
      sessionId: () => 'sess-42',
      customHeadersRaw: 'User-Agent: my-own-agent\nX-Preset: overridden',
    });
    expect(headers?.['User-Agent']).toBe('my-own-agent');
    expect(headers?.['X-Preset']).toBe('overridden');
    expect(headers?.['x-opencode-session']).toBe('sess-42');
  });

  it('never returns an empty object — the identity header alone is enough', () => {
    const headers = compatHeaders({});
    expect(headers).toBeDefined();
    expect(Object.keys(headers ?? {})).toEqual(['User-Agent']);
  });
});
