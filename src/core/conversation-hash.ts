/**
 * A short, stable hash of a conversation.
 *
 * #756: the field named `lastOfferedQueryHash` held `JSON.stringify(history)`
 * — the whole transcript, 15 KB on a real vault. The name said hash and the
 * value was a conversation. It is a change-detection key: two identical
 * conversations must hash the same, two different ones must not, and the
 * value must be short enough that `data.json` does not grow with the
 * conversation.
 *
 * FNV-1a over the UTF-8 bytes. Not cryptographic, not needed to be: the only
 * adversary is a hash collision between two conversations the user has had,
 * and 32 bits of FNV over a transcript is far past that.
 */
export function hashConversation(messages: ReadonlyArray<{ role: string; content: string }>): string {
  let h = 0x811c9dc5;
  for (const m of messages) {
    const s = `${m.role}\u0000${m.content}\u0000`;
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
