// Issue #904: the first-batch failure hint.
//
// The bug this pins: the guard's own sentence was discarded and replaced by
// context-window advice. Each case below is a message shape that reaches the
// classifier, so a future branch cannot claim a failure that a more specific
// branch already explained.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { buildIngestErrorHint } from '../../wiki/ingest-error-hint';
import { REASONING_ONLY_ERROR_CODE } from '../../llm-sdk/finish-reason';

const CTX = { provider: 'minimax', model: 'MiniMax-M3.1-Flash-Preview' };

/** The message the user actually saw in the v1.29.0 e2e run. */
const REAL_REASONING_MESSAGE =
  'The model returned empty content after spending 16000 of 16000 output tokens '
  + 'on reasoning. Disable thinking for this model, or raise the token limit '
  + '(max_tokens) so the answer fits after it.';

describe('buildIngestErrorHint — most specific first', () => {
  it('keeps the reasoning explanation for the message from the bug report', () => {
    const hint = buildIngestErrorHint(REAL_REASONING_MESSAGE, new Error(REAL_REASONING_MESSAGE), CTX);
    expect(hint).toContain('reasoning');
    expect(hint).not.toContain('context window is too large');
    expect(hint).not.toContain('source file is too large');
  });

  it('detects it by code even when the text has been reworded', () => {
    // A client that re-wraps the error keeps the marker and loses the sentence.
    const error = Object.assign(new Error('provider call failed'), { code: REASONING_ONLY_ERROR_CODE });
    const hint = buildIngestErrorHint('provider call failed', error, CTX);
    expect(hint).toContain('reasoning');
    expect(hint).not.toContain('source file is too large');
  });

  it('still recognises the inline-reasoning wording', () => {
    const msg = 'The model returned only its reasoning and no answer.';
    expect(buildIngestErrorHint(msg, new Error(msg), CTX)).toContain('reasoning');
  });

  it('keeps genuine context-overflow advice, so the fix did not just swap branches', () => {
    const msg = 'This model\'s maximum context length is 8192 tokens, however you requested 40000 tokens.';
    const hint = buildIngestErrorHint(msg, new Error(msg), CTX);
    expect(hint).toContain('context window');
    expect(hint).not.toContain('on reasoning');
  });

  it('does not route a max_tokens rejection into the context branch', () => {
    // `max_tokens` messages often say "tokens" too; they have their own fix.
    const msg = 'Invalid value for max_tokens: must be less than or equal to 8192';
    const hint = buildIngestErrorHint(msg, new Error(msg), CTX);
    expect(hint).toContain('Max output tokens per call');
    expect(hint).not.toContain('source file is too large');
  });

  it('keeps the auth and rate-limit branches reachable', () => {
    expect(buildIngestErrorHint('HTTP 401 Unauthorized', new Error('401'), CTX)).toContain('Authentication');
    expect(buildIngestErrorHint('HTTP 429 Too Many Requests', new Error('429'), CTX)).toContain('Rate limit');
  });

  it('names no settings path that does not exist', () => {
    // The v1.29.0 hint pointed at "Settings → LLM Configuration → Context
    // Window". There has never been such a control (types.ts has carried only
    // maxTokensPerCall across its whole history). A wrong path is worse than
    // no path: the user looks, does not find it, and trusts the rest less.
    const messages = [
      REAL_REASONING_MESSAGE,
      'Invalid value for max_tokens',
      'maximum context length is 8192 tokens',
      'HTTP 400 Bad Request',
      'HTTP 401 Unauthorized',
      'HTTP 429 Too Many Requests',
      'connect ECONNREFUSED',
    ];
    for (const msg of messages) {
      const hint = buildIngestErrorHint(msg, new Error(msg), CTX);
      // Case-sensitive on purpose: the real advice says "a larger context
      // window" in lower case. The phantom was a capitalised menu path.
      expect(hint).not.toMatch(/Context Window/);
      expect(hint).not.toMatch(/LLM Configuration/);
    }
  });
});

describe('a timeout names the platform cause (#980)', () => {
  // #980's Proposal item 3. The transport fix stops the plugin from creating
  // this failure on its own, but the user still needs to know what a silent
  // timeout means, because a proxy or a non-flushing provider can reproduce it.
  const TIMEOUT = 'The request timed out.';
  const mobile = { ...CTX, isMobile: true };

  it('says mobile, not iOS alone, because Android also has a mobile limit (#980)', () => {
    const hint = buildIngestErrorHint(TIMEOUT, new Error(TIMEOUT), mobile);

    // `Platform.isMobile` is true for the Capacitor app on Android too, so a hint
    // that names iOS as THE limit is wrong on a device where this fires. Only iOS
    // has a measured 60 seconds; the others have their own, unmeasured, limits.
    expect(hint.toLowerCase()).toContain('mobile platform');
    expect(hint).not.toContain('the iOS limit');
  });

  it('gives numbered steps the user can act on', () => {
    const hint = buildIngestErrorHint(TIMEOUT, new Error(TIMEOUT), mobile);

    // "Brief guidance" is the requirement: three steps, in the order to try them.
    expect(hint).toContain('(1)');
    expect(hint).toContain('(2)');
    expect(hint).toContain('(3)');
  });

  it('names the 60-second limit on mobile', () => {
    const hint = buildIngestErrorHint(TIMEOUT, new Error(TIMEOUT), mobile);

    // The number is the whole point: "timed out" alone sends the user to check
    // their connection, which is not the cause.
    expect(hint).toContain('60 seconds');
    expect(hint).toMatch(/iOS|iPadOS/);
  });

  it('points at what still causes it, now that ingest streams', () => {
    const hint = buildIngestErrorHint(TIMEOUT, new Error(TIMEOUT), mobile);

    // A hint that only says "the platform did it" would be true and useless.
    // After #980 the plugin streams, so a silent gap means something upstream
    // held the answer back.
    expect(hint).toContain('stream');
    expect(hint.toLowerCase()).toContain('buffer');
  });

  it('does not claim a 60-second limit on desktop, which has none', () => {
    const hint = buildIngestErrorHint(TIMEOUT, new Error(TIMEOUT), { ...CTX, isMobile: false });

    expect(hint).not.toContain('60 seconds');
    expect(hint).not.toMatch(/iOS|iPadOS/);
  });

  it('still explains a timeout when the caller states no platform', () => {
    // The context field is optional, so an older call site keeps a usable hint
    // rather than an empty branch.
    const hint = buildIngestErrorHint(TIMEOUT, new Error(TIMEOUT), CTX);

    expect(hint.length).toBeGreaterThan(0);
    expect(hint).toContain('stream');
  });

  it('does not swallow a more specific failure that merely mentions time', () => {
    // Order is the design of this module. A message carrying both a timeout and
    // a rejection must keep the rejection's advice.
    const mixed = 'HTTP 401 Unauthorized after the request timed out';
    const hint = buildIngestErrorHint(mixed, new Error(mixed), mobile);

    expect(hint).toContain('Authentication failed');
  });
});

describe('the platform reaches the hint from the call site (#980)', () => {
  it('passes the live platform, so the mobile branch is reachable', () => {
    // A branch only a unit test exercises is the #974 failure shape: coverage
    // that reports green for code production never runs. The classifier takes
    // the flag as data to stay pure, which moves the wiring risk here.
    const source = readFileSync(join(__dirname, '..', '..', 'wiki', 'source-analyzer.ts'), 'utf8');

    expect(source).toContain('isMobile: Platform.isMobile');
    expect(source).toMatch(/import \{[^}]*Platform[^}]*\} from 'obsidian'/);
  });
});
