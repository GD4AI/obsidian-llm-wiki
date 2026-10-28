// Issue #904: the first-batch failure hint.
//
// The bug this pins: the guard's own sentence was discarded and replaced by
// context-window advice. Each case below is a message shape that reaches the
// classifier, so a future branch cannot claim a failure that a more specific
// branch already explained.

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
