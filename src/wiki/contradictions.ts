// Contradiction detection, tracking, and resolution — extracted from WikiEngine.

import { EngineContext, ContradictionInfo } from '../types';
import { activeVocabularyLists } from '../core/vocabulary';
import { parseFrontmatter } from '../core/frontmatter';
import { cleanMarkdownResponse } from '../core/markdown';
import { renderTemplate } from '../core/template-renderer';
import { TOKENS_CONTRADICTION } from '../constants';
import { clampPageSections, restoreWithheldSections } from '../core/clamp-page-sections';
import { PROMPTS } from '../prompts';
import { resolveModelForTask } from '../core/model-resolver';
import {
  getSectionLabels,
  applySectionLabels,
  buildSystemPrompt,
} from './system-prompts';
import { isInFolderScope } from '../core/folder-scope';
import { getExistingWikiPages } from './lint/get-existing-pages';
import { appendContradictedByMarker } from '../core/contradicted-marker';
import {
  buildContradictionRecord,
  resolveContradictionTarget,
  ResolvedContradictionTarget,
} from '../core/contradiction-record';
import { localDateStamp } from '../core/format';

export class ContradictionManager {
  constructor(private ctx: EngineContext) {}

  async noteContradiction(
    contradiction: ContradictionInfo,
    sourceNotePath: string
  ): Promise<void> {
    // `source_page` is unvalidated model output. Resolve it against the
    // real page index; what does not resolve is discarded and reported,
    // never written — string surgery on the raw value once turned a
    // bracket-less value into a write path into a user's note.
    const pages = await getExistingWikiPages(
      this.ctx.app,
      this.ctx.settings.wikiFolder
    );
    const target = resolveContradictionTarget(
      contradiction.source_page,
      pages,
      this.ctx.settings.wikiFolder
    );
    if (!target) {
      console.warn(
        `Contradiction discarded — source_page did not resolve to an existing wiki page: "${contradiction.source_page}"`
      );
      return;
    }

    // The affected page carries the marker (the index); the prose lives
    // in the record file. No body block: it is unknown to the section
    // schema and falls to stripUnknownSections on the next rewrite.
    const existingContent = await this.ctx.tryReadFile(target.path);
    if (existingContent) {
      const stamped = appendContradictedByMarker(existingContent, sourceNotePath);
      if (stamped !== existingContent) {
        await this.ctx.createOrUpdateFile(target.path, stamped);
      }
    }
    await this.trackContradiction(contradiction, target, sourceNotePath);
  }

  private async trackContradiction(
    contradiction: ContradictionInfo,
    target: ResolvedContradictionTarget,
    sourceNotePath: string
  ): Promise<void> {
    const contradictionsDir = `${this.ctx.settings.wikiFolder}/contradictions`;
    try {
      await this.ctx.app.vault.createFolder(contradictionsDir);
    } catch {
      // folder already exists
    }

    const date = localDateStamp();
    const record = buildContradictionRecord(
      {
        claim: contradiction.claim,
        existingView: contradiction.contradicted_by,
        resolution: contradiction.resolution,
        pageRelPath: target.relPath,
        sourceNotePath,
        date,
      },
      getSectionLabels(this.ctx.settings)
    );
    const filePath = `${contradictionsDir}/${record.fileName}`;

    if (await this.ctx.tryReadFile(filePath)) {
      console.debug('Contradiction already tracked:', filePath);
      return;
    }

    await this.ctx.createOrUpdateFile(filePath, record.content);
    console.debug('Contradiction tracked:', filePath);
  }

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

  async updateContradictionStatus(
    filePath: string,
    newStatus: string
  ): Promise<void> {
    const content = await this.ctx.tryReadFile(filePath);
    if (!content) {
      console.debug('Contradiction file not found:', filePath);
      return;
    }
    const updated = content.replace(/^status:\s*\S+/m, `status: ${newStatus}`);
    if (newStatus === 'resolved') {
      const resolvedDate = localDateStamp();
      if (updated.includes('resolved:')) {
        const final = updated.replace(
          /^resolved:\s*\S*/m,
          `resolved: ${resolvedDate}`
        );
        await this.ctx.createOrUpdateFile(filePath, final);
      } else {
        const final = updated.replace(
          /^(detected:\s*\S+)/m,
          `$1\nresolved: ${resolvedDate}`
        );
        await this.ctx.createOrUpdateFile(filePath, final);
      }
    } else {
      await this.ctx.createOrUpdateFile(filePath, updated);
    }
    console.debug(
      `Contradiction status updated: ${filePath} → ${newStatus}`
    );
  }

  async resolveContradiction(contradictionPath: string): Promise<void> {
    const contradictionContent = await this.ctx.tryReadFile(contradictionPath);
    if (!contradictionContent)
      throw new Error('Contradiction file not found');

    const fm = parseFrontmatter(contradictionContent);
    const sourcePage = (fm?.source_page as string) || '';
    const pagePath = sourcePage.replace(
      /\[\[(.+)\]\]/,
      `${this.ctx.settings.wikiFolder}/$1.md`
    );

    const existingContent = await this.ctx.tryReadFile(pagePath);
    if (!existingContent) throw new Error('Affected wiki page not found');

    // The page is clamped in whole `##` sections rather than characters, and
    // what is withheld comes back after the rewrite. The prompt tells the model
    // to output the complete page and the result is written over the file, so a
    // blind cut here is not a smaller prompt — it is content deleted from disk.
    const page = clampPageSections(existingContent, 6000);
    if (page.hardCut) {
      throw new Error(
        'Affected wiki page exceeds the prompt budget and has no section boundary to '
        + 'clamp at; refusing to rewrite it, because the model cannot be shown the part '
        + 'it would be asked to preserve.',
      );
    }
    const record = clampPageSections(contradictionContent, 3000);

    const prompt = renderTemplate(PROMPTS.resolveContradiction, {
      existing_content: page.text,
      contradiction_content: record.text,
    });

    const finalPrompt = applySectionLabels(prompt, this.ctx.settings);

    const client = this.ctx.getClient();
    if (!client) throw new Error('LLM client not initialized');

    const fixedContent = await client.createMessage({
      model: resolveModelForTask(this.ctx.settings, 'lint'),
      max_tokens: TOKENS_CONTRADICTION,
      system: await buildSystemPrompt(
        this.ctx.settings,
        this.ctx.getSchemaContext,
        'full',
        activeVocabularyLists(this.ctx.app, this.ctx.settings)
      ),
      messages: [{ role: 'user', content: finalPrompt }],
      ...(this.ctx.settings.disableThinking ? { enableThinking: false } : {}),
    });

    const cleaned = restoreWithheldSections(
      cleanMarkdownResponse(fixedContent),
      page.withheld,
    );
    await this.ctx.createOrUpdateFile(pagePath, cleaned);
    console.debug('Contradiction resolved:', contradictionPath);
  }
}
