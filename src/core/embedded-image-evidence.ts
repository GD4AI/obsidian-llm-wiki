import type { EmbeddedImageAnalysisReport } from '../types';

const START = '<!-- embedded-image-evidence:start -->';
const END = '<!-- embedded-image-evidence:end -->';

function stripSection(content: string): string {
  return content.replace(new RegExp(`\\n*${START}[\\s\\S]*?${END}\\n*`), '\n\n').trimEnd();
}

function escapeCode(text: string): string {
  return text.replace(/```/g, '\\`\\`\\`');
}

function codeBlock(label: string, text: string): string {
  return text ? `**${label}**\n\n\`\`\`text\n${escapeCode(text)}\n\`\`\`` : '';
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
      `### Image ${item.index}`,
      `\`${item.path}\``,
      codeBlock('Before', item.contextBefore),
      codeBlock('After', item.contextAfter),
      codeBlock('Visible text', item.visibleText ?? ''),
      codeBlock('Description', item.description ?? ''),
      codeBlock('Context relevance', item.contextRelevance ?? ''),
      item.status === 'no-evidence' ? '_No non-empty visual evidence returned._' : '',
      item.status === 'skipped' ? `_Skipped: ${item.reason ?? 'unknown'}_` : '',
      item.status === 'failed' ? `_Analysis failed: ${item.reason ?? 'unknown'}_` : '',
    ].filter(Boolean).join('\n\n');
    return details;
  });
  const skipped = report.skipped
    .filter(item => !report.evidence.some(evidence => evidence.path === item.path && evidence.status === 'skipped'))
    .map(item => `- \`${item.path}\` — ${item.reason}`);
  if (skipped.length > 0) entries.push(`### Skipped\n\n${skipped.join('\n')}`);

  const section = [
    START,
    `<details><summary>${sectionLabel} (${report.evidence.length})</summary>`,
    '',
    ...entries,
    '',
    '</details>',
    END,
  ].join('\n');
  return `${withoutPrevious}\n\n${section}`;
}
