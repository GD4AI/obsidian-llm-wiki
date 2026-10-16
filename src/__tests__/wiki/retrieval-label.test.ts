/**
 * The retrieval label tells the user what the pipeline actually did.
 *
 * #756 follow-up: the label read `🔍 20 pages · 🔗 LLM + PPR` after the
 * pipeline was rewritten around BM25F, two-stage Rocchio and history
 * weighting. It named an arm that no longer fired and hid the ones that did.
 *
 * The design is layered. The default line carries the two things a user asks
 * when the answer looks wrong: how much was retrieved and which path
 * retrieved it. The source count is there because coverage is what the
 * assembly step optimises and a single-source answer is a different kind of
 * wrong from a wrong page. Everything else — expansion words, history rounds,
 * fusion rule — belongs on the hover, where someone debugging can reach it
 * and nobody else has to read it.
 *
 * LLM is named only when it fired. Naming it always made "LLM + PPR" the
 * answer to "what happened", when the lexical channel and the graph channel
 * did the work and the model sat idle.
 */
import { describe, it, expect } from 'vitest';
import { armDisplayLayered, buildRetrievalLabel } from '../../wiki/query-engine/renderers/retrieval-label';

describe('the retrieval label describes the pipeline (#756 follow-up)', () => {
  it('names the lexical channel as BM25F, not LLM', () => {
    expect(armDisplayLayered('lex+ppr')).toContain('BM25F');
    expect(armDisplayLayered('lex+ppr')).not.toContain('LLM');
  });

  it('names LLM only when LLM fired', () => {
    expect(armDisplayLayered('LLM')).toContain('LLM');
    expect(armDisplayLayered('LLM+PPR')).toContain('LLM');
  });

  it('marks the expansion when the expansion added words', () => {
    expect(armDisplayLayered('lex+ppr', { expansionWords: 12 })).toContain('Exp');
    expect(armDisplayLayered('lex+ppr', { expansionWords: 0 })).not.toContain('Exp');
  });

  it('shows the source count on the default line', () => {
    const label = buildRetrievalLabel({ count: 20, arm: 'lex+ppr', sourceCount: 3 });
    expect(label.text).toContain('3 sources');
  });

  it('the hover detail carries the expansion, the history and the fusion', () => {
    const label = buildRetrievalLabel({
      count: 20,
      arm: 'lex+ppr',
      sourceCount: 3,
      expansionWords: 12,
      historyRounds: 3,
    });
    expect(label.detail).toContain('Rocchio');
    expect(label.detail).toContain('12');
    expect(label.detail).toContain('3');
    expect(label.detail).toContain('maxFuse');
  });

  it('a single source reads as singular', () => {
    const label = buildRetrievalLabel({ count: 1, arm: 'lex+ppr', sourceCount: 1 });
    expect(label.text).toContain('1 source');
    expect(label.text).not.toContain('1 sources');
  });
});
