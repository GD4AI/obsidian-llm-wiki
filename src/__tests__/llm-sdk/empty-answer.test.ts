// Issue #916, fix C: an answer that arrives empty must say so.
//
// The plugin prefers a streaming request when the provider offers one. When
// the gateway's frames are unusable — the #916 case, where the first frame
// arrived without its `data: ` prefix — the SSE parser drops it, keeps only
// the terminator, and the stream ends with no text and no exception. The
// query pane then renders a blank answer with no error anywhere.
//
// That is a plugin-side gap on any provider: an empty answer is never a
// useful answer, and silently rendering nothing is the same failure class as
// #914 (an error that never reaches the UI).
//
// The existing `assertNotReasoningOnly` guard does not cover it: it fires
// when the model spent its budget on reasoning and left no answer, and it
// deliberately stays silent when the finish reason is anything other than
// `length`. An empty body with a `stop` finish reason is a different thing
// — nothing came back at all.

import { describe, it, expect } from 'vitest';
import { assertNotEmptyAnswer } from '../../llm-sdk/empty-answer';

describe('assertNotEmptyAnswer (#916)', () => {
  it('rejects an empty answer', () => {
    expect(() => assertNotEmptyAnswer('', 'the provider')).toThrow();
  });

  it('rejects a whitespace-only answer', () => {
    expect(() => assertNotEmptyAnswer('   \n\t ', 'the provider')).toThrow();
  });

  it('says what happened', () => {
    let message = '';
    try {
      assertNotEmptyAnswer('', 'the provider');
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toContain('empty');
    expect(message).toContain('the provider');
  });

  it('accepts an answer with content', () => {
    expect(() => assertNotEmptyAnswer('Connection successful.', 'the provider')).not.toThrow();
  });

  it('accepts an answer that is only whitespace around content', () => {
    expect(() => assertNotEmptyAnswer('  ok  ', 'the provider')).not.toThrow();
  });
});
