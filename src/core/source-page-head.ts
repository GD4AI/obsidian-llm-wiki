// The head of a sources/ page — its H1 and its Source section — holds only
// what the code knows: the source's title, the note's path and the ingest
// date. The model used to copy all three from the template, and a copy could
// come back wrong: `[[Notizen/Zytokines.md]]` for `Notizen/Zytokine.md`, a
// file path as the title, the English "Summary" suffix on a German page.
// Same route as the Mentions section (#244): what the model wrote there is
// replaced, not trusted.

import { stripMentionsSection } from './mentions-parser';
import type { SourcePageHeadLabels } from '../wiki/system-prompts';

export interface SourcePageHead {
  title: string;
  sourcePath: string;
  date: string;
}

/**
 * Replace the H1 (when it opens the body) and the `## <labels.source>` section
 * (wherever it sits) with the code-rendered head, placed right after the
 * frontmatter. Every other section is left as written.
 */
export function stampSourcePageHead(
  content: string,
  head: SourcePageHead,
  labels: SourcePageHeadLabels & { source: string },
): string {
  const fmEnd = content.startsWith('---') ? content.indexOf('\n---', 3) : -1;
  const frontmatter = fmEnd === -1 ? '' : content.slice(0, fmEnd + 4);
  const body = (fmEnd === -1 ? content : content.slice(fmEnd + 4)).replace(/^\s*# [^\n]*\n?/, '');
  // The section stripper is label-generic despite its name.
  const rest = stripMentionsSection(body, labels.source).trimStart();

  const stamped = `# ${head.title} - ${labels.summary}\n\n## ${labels.source}\n\n`
    + `- ${labels.original_file}: [[${head.sourcePath}]]\n- ${labels.ingested}: ${head.date}\n`;
  return `${frontmatter ? `${frontmatter}\n\n` : ''}${stamped}${rest ? `\n${rest}` : ''}`;
}
