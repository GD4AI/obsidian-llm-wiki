// Contradiction records ("case files") — listing, extracted from WikiEngine.
//
// Records are written by the merge triage (`page-factory/merge-page.ts`),
// the one lane that sees both the source and the page it conflicts with.
// The extraction lane's `contradictions[]` and the `review_ok` auto-resolve
// rewrite were removed (#666, #604): the first named pages it was never
// shown, the second waited for a status nothing produced.

import { EngineContext } from '../types';
import { parseFrontmatter } from '../core/frontmatter';
import { isInFolderScope } from '../core/folder-scope';

export class ContradictionManager {
  constructor(private ctx: EngineContext) {}

  async getOpenContradictions(): Promise<
    Array<{ path: string; status: string; claim: string; sourcePage: string }>
  > {
    const contradictionsDir = `${this.ctx.settings.wikiFolder}/contradictions`;
    const files = this.ctx.app.vault
      .getMarkdownFiles()
      .filter(f => isInFolderScope(f.path, contradictionsDir, false));

    const results: Array<{
      path: string;
      status: string;
      claim: string;
      sourcePage: string;
    }> = [];

    for (const file of files) {
      const content = await this.ctx.app.vault.read(file);
      const fm = parseFrontmatter(content);
      const status = (fm?.status as string) || 'detected';

      if (status === 'resolved' || status === 'suppressed') continue;

      const headerBlocks = content.split(/\n## /);
      const claimText =
        headerBlocks.length > 1
          ? headerBlocks[1].replace(/^[^\n]+\n/, '').trim()
          : '';
      const sourcePageText =
        headerBlocks.length > 4
          ? headerBlocks[4].replace(/^[^\n]+\n/, '').trim()
          : '';

      results.push({
        path: file.path,
        status,
        claim: claimText || file.basename,
        sourcePage: sourcePageText,
      });
    }

    return results;
  }
}
