/**
 * "Clear history" clears the history.
 *
 * #756: pressing 清空历史 emptied the conversation on screen and left the
 * records in `data.json`. The button read "forget this" and did "hide this".
 *
 * Two bugs, one symptom. `SuggestSaveModal` stored `JSON.stringify(history)`
 * in `lastOfferedQueryHash` — a field whose name says hash and whose value was
 * the entire conversation, 15 KB on a real vault. And `clearHistory` cleared
 * `queryHistory` but not that field. So the conversation the user asked to
 * forget was still on disk.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..', '..', '..');

describe('"clear history" clears the history (#756)', () => {
  it('clearHistory clears every field that holds conversation text', () => {
    const src = readFileSync(join(root, 'src', 'wiki', 'query-engine', 'QueryView-class.ts'), 'utf8');
    const fn = src.slice(src.indexOf('async clearHistory()'));
    const body = fn.slice(0, fn.indexOf('\n  }'));
    // `queryHistory` was the only field it cleared. The conversation also
    // lives in `lastOfferedQueryHash`, which is not a hash.
    expect(body).toContain('lastOfferedQueryHash');
  });

  it('the field that calls itself a hash holds a hash, not the conversation', () => {
    const src = readFileSync(join(root, 'src', 'wiki', 'query-engine', 'SuggestSaveModal-class.ts'), 'utf8');
    // `JSON.stringify(this.history.messages)` is the whole transcript.
    expect(src).not.toContain('JSON.stringify(this.history.messages)');
  });

  it('the test data agrees: the field is short', () => {
    // A hash is fixed-length. 15 KB is a conversation.
    const src = readFileSync(join(root, 'src', 'wiki', 'query-engine', 'SuggestSaveModal-class.ts'), 'utf8');
    expect(src).toMatch(/computeConversationHash|hashConversation/);
  });
});
