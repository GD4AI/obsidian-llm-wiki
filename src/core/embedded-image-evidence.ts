import type { EmbeddedImageAnalysisReport } from '../types';

const START = '<!-- embedded-image-evidence:start -->';
const END = '<!-- embedded-image-evidence:end -->';

function stripSection(content: string): string {
  return content.replace(new RegExp(`\\n*${START}[\\s\\S]*?${END}\\n*`), '\n\n').trimEnd();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function evidenceBlock(label: string, text: string): string {
  return text ? `<h4>${escapeHtml(label)}</h4>\n<pre><code>${escapeHtml(text)}</code></pre>` : '';
}

/** Replaces the generated visual-evidence section without asking an LLM to preserve it. */
export function injectEmbeddedImageEvidenceSection(
  content: string,
  report: EmbeddedImageAnalysisReport | undefined,
  sectionLabel: string,
): string {
  const withoutPrevious = stripSection(content);
  if (!report?.evidenceSaved || !sectionLabel.trim()) return withoutPrevious;

  const entries = report.evidence.map(item => {
    const details = [
      `<h3>Image ${item.index}</h3>`,
      `<p><code>${escapeHtml(item.path)}</code></p>`,
      evidenceBlock('Before', item.contextBefore),
      evidenceBlock('After', item.contextAfter),
      evidenceBlock('Visible text', item.visibleText ?? ''),
      evidenceBlock('Description', item.description ?? ''),
      evidenceBlock('Before relevance', item.beforeRelevance ?? ''),
      evidenceBlock('After relevance', item.afterRelevance ?? ''),
      evidenceBlock('Context interpretation', item.contextInterpretation ?? ''),
      item.status === 'no-evidence' ? '<p><em>No non-empty visual evidence returned.</em></p>' : '',
      item.status === 'skipped' ? `<p><em>Skipped: ${escapeHtml(item.reason ?? 'unknown')}</em></p>` : '',
      item.status === 'failed' ? `<p><em>Analysis failed: ${escapeHtml(item.reason ?? 'unknown')}</em></p>` : '',
    ].filter(Boolean).join('\n');
    return details;
  });
  const skipped = report.skipped
    .filter(item => !report.evidence.some(evidence => evidence.path === item.path && evidence.status === 'skipped'))
    .map(item => `<li><code>${escapeHtml(item.path)}</code> — ${escapeHtml(item.reason)}</li>`);
  if (skipped.length > 0) entries.push(`<h3>Skipped</h3>\n<ul>\n${skipped.join('\n')}\n</ul>`);

  const section = [
    START,
    '<details>',
    `<summary>${escapeHtml(sectionLabel)} (${report.evidence.length})</summary>`,
    '<div>',
    ...entries,
    '</div>',
    '</details>',
    END,
  ].join('\n');
  return `${withoutPrevious}\n\n${section}`;
}
