/**
 * The retrieval label: what the pipeline actually did.
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

import type { RetrievalLabelData } from '../types';

/**
 * Translate the internal arm identifier to a user-facing glyph + text segment.
 *
 * The old identifiers ("Lex+PPR", "LLM+PPR", "LLM+KB", "Lex++PPR", "PPR",
 * "PPR+LLM", "PPR+", "lex", "index", "none") are still emitted by callers.
 * What changed is the display: the lexical channel is BM25F now, and LLM is
 * named only when the model actually fired.
 */
export function armDisplay(arm: string): string {
  if (arm === 'none' || arm === '') {
    return '🚫 No specific source';
  }
  if (arm === 'LLM+KB') return '🌐 LLM Knowledge Base';
  return arm;
}

/**
 * #756 follow-up: the layered arm display. BM25F is the lexical channel now.
 * `expansionWords` marks the expansion when it added words.
 */
export function armDisplayLayered(arm: string, opts: { expansionWords?: number } = {}): string {
  if (arm === 'none' || arm === '') return '🚫 No specific source';
  const hasLlm = /LLM/i.test(arm);
  const hasPpr = /ppr/i.test(arm);
  const parts: string[] = ['BM25F'];
  if (hasPpr) parts.push('PPR');
  if (opts.expansionWords && opts.expansionWords > 0) parts.push('Exp');
  if (hasLlm) parts.push('LLM');
  return parts.join('+');
}

export interface RetrievalLabelInput {
  readonly count: number;
  readonly arm: string;
  readonly sourceCount?: number;
  readonly expansionWords?: number;
  readonly historyRounds?: number;
}

export interface RetrievalLabel {
  readonly text: string;
  readonly detail: string;
}

export function buildRetrievalLabel(input: RetrievalLabelInput): RetrievalLabel {
  const pageWord = input.count === 1 ? 'page' : 'pages';
  const sourceCount = input.sourceCount ?? 0;
  const sourceWord = sourceCount === 1 ? 'source' : 'sources';
  const arm = armDisplayLayered(input.arm, { expansionWords: input.expansionWords });

  let text = '🔍 ' + String(input.count) + ' ' + pageWord + ' · ⚡ ' + arm;
  if (sourceCount > 0) {
    text += ' · 📚 ' + String(sourceCount) + ' ' + sourceWord;
  }

  const detailParts: string[] = ['lexical: BM25F'];
  if (/ppr/i.test(input.arm)) detailParts.push('graph: PPR');
  if (input.expansionWords && input.expansionWords > 0) {
    detailParts.push('expansion: Rocchio +' + String(input.expansionWords) + ' words (k1=5,m1=10,k2=5,m2=10)');
  }
  if (input.historyRounds && input.historyRounds > 0) {
    detailParts.push('history: ' + String(input.historyRounds) + ' rounds (weight 0.3)');
  }
  detailParts.push('fusion: maxFuse');
  detailParts.push('assembly: ' + String(sourceCount) + ' ' + sourceWord);

  return { text, detail: detailParts.join('\n') };
}

/**
 * Render the label into a container. The default line is the layered text;
 * the hover carries the diagnostic detail. The DOM shape — a clickable label
 * and a detail panel listing the retrieved pages — is what the existing tests
 * and the click-to-expand behaviour expect.
 */
export function renderRetrievalLabel(
  messageWrapper: HTMLElement,
  retrieval: RetrievalLabelData & { sourceCount?: number; expansionWords?: number; historyRounds?: number },
  wikiFolder: string,
  onClick?: (label: HTMLElement, detail: HTMLElement) => void,
): void {
  const r = retrieval;
  const label = messageWrapper.createDiv({ cls: 'llm-wiki-query-retrieval-label' });
  const layered = buildRetrievalLabel(r);
  label.setText(layered.text);
  label.setAttribute('title', layered.detail);

  const detail = messageWrapper.createDiv({ cls: 'llm-wiki-query-retrieval-detail' });
  r.topPaths.forEach(p => {
    const rel = p.replace(wikiFolder + '/', '').replace('.md', '');
    const pageDiv = detail.createDiv({ cls: 'llm-wiki-query-retrieval-page' });
    pageDiv.setText('📄 [[' + rel + ']]');
  });

  label.addClass('llm-wiki-query-retrieval-label-clickable');
  label.addEventListener('click', (evt) => {
    evt.stopPropagation();
    if (onClick) {
      onClick(label, detail);
    } else {
      detail.classList.toggle('llm-wiki-query-retrieval-detail-open');
    }
  });
}
