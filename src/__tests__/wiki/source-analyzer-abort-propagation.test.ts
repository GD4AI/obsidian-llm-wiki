// PR #867 review (green-dalii, finding 1) — a user cancellation arrives at
// the two catch-all helpers below as a DOMException AbortError (the PR's
// abort-race makes the model call reject instead of hang). The AbortError
// must propagate so the engine's cancelled branch owns it. Swallowing it
// misreports the cancellation as a provider failure. A non-abort failure
// keeps the old behaviour: log and return null.

import { describe, it, expect } from 'vitest';
import { createMockContext } from '../__support__/engine-context';
import { SourceAnalyzer } from '../../wiki/source-analyzer';

function analyzerWithThrowingClient(err: unknown) {
  const { ctx } = createMockContext({ vaultFiles: {}, llmResponses: [] });
  const client = ctx.getClient();
  if (!client) throw new Error('mock context has no client');
  client.createMessage = async () => {
    throw err;
  };
  const analyzer = new SourceAnalyzer(ctx);
  return analyzer as unknown as {
    askTypeFromVocabulary(
      kind: 'entity' | 'concept',
      name: string,
      extractedType: string,
      summary: string,
      vocab: readonly string[],
    ): Promise<string | null>;
    classifyLemmaType(name: string, summary: string): Promise<'entity' | 'concept' | null>;
  };
}

const abort = () => new DOMException('The operation was aborted.', 'AbortError');

describe('SourceAnalyzer — user cancellation propagates (PR #867 review)', () => {
  it('type repair rethrows AbortError instead of logging it as a call failure', async () => {
    const a = analyzerWithThrowingClient(abort());
    await expect(
      a.askTypeFromVocabulary('entity', 'Hepcidin', 'person', 'summary', ['Biochemie']),
    ).rejects.toThrowError(expect.objectContaining({ name: 'AbortError' }));
  });

  it('lemma classification rethrows AbortError instead of returning null', async () => {
    const a = analyzerWithThrowingClient(abort());
    await expect(a.classifyLemmaType('Klotho', 'summary')).rejects.toThrowError(
      expect.objectContaining({ name: 'AbortError' }),
    );
  });

  it('a non-abort failure still returns null (no behaviour change)', async () => {
    const a = analyzerWithThrowingClient(new Error('boom'));
    await expect(
      a.askTypeFromVocabulary('entity', 'Hepcidin', 'person', 'summary', ['Biochemie']),
    ).resolves.toBeNull();
    await expect(a.classifyLemmaType('Klotho', 'summary')).resolves.toBeNull();
  });
});
