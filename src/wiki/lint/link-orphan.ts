import { EngineContext } from '../../types';
import { activeVocabularyLists } from '../../core/vocabulary';
import { PROMPTS } from '../../prompts';
import { TOKENS_LINT_ORPHAN_FIX } from '../../constants';
import { buildSystemPrompt, getSectionLabels } from '../system-prompts';
import { parseJsonResponse } from '../../core/json';
import { cleanWikiIndex, normalizeLLMPath } from '../../core/prompt-builders';
import { resolveModelForTask } from '../../core/model-resolver';
import {
  buildOrphanLinkPrompt,
  validateOrphanLinkTarget,
  buildOrphanLinkUpdate,
  normalizeOrphanPagePath,
} from '../../core/orphan-matcher';
import { LinkOrphanSchema, type LinkOrphan } from '../../llm-sdk/output-schemas';

export async function linkOrphanPage(
  ctx: EngineContext,
  orphanPath: string
): Promise<string[]> {
  const orphanContent = await ctx.tryReadFile(orphanPath);
  if (!orphanContent) return [];

  const indexPath = `${ctx.settings.wikiFolder}/index.md`;
  const rawWikiIndex = (await ctx.tryReadFile(indexPath)) || '';

  const wikiIndex = cleanWikiIndex(rawWikiIndex);
  const prompt = buildOrphanLinkPrompt(PROMPTS.linkOrphanPage, {
    orphanContent,
    wikiIndex,
    wikiFolder: ctx.settings.wikiFolder,
  });

  const client = ctx.getClient();
  if (!client) return [];

  // v1.26.3 PATCH Phase B (Issue #443): typed-output path. Prefer
  // `result.output` when the client implements createMessageWithOutput
  // and the Tier 0 (json_schema) parse succeeds; fall back to
  // parseJsonResponse(text) otherwise. The downstream page-path
  // validation is unchanged — it runs on whatever shape was recovered.
  let result: LinkOrphan | null;
  if (client.createMessageWithOutput) {
    const typedResult = await client.createMessageWithOutput<LinkOrphan>({
      task: 'link-orphan',
      model: resolveModelForTask(ctx.settings, 'lint'),
      max_tokens: TOKENS_LINT_ORPHAN_FIX,
      system: await buildSystemPrompt(
        ctx.settings,
        ctx.getSchemaContext,
        'lint',
        activeVocabularyLists(ctx.app, ctx.settings)
      ),
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object', schema: LinkOrphanSchema },
      ...(ctx.settings.disableThinking ? { enableThinking: false } : {}),
    });
    result = typedResult.output && typeof typedResult.output === 'object'
      ? typedResult.output
      : await parseJsonResponse(typedResult.text);
  } else {
    const response = await client.createMessage({
      model: resolveModelForTask(ctx.settings, 'lint'),
      max_tokens: TOKENS_LINT_ORPHAN_FIX,
      system: await buildSystemPrompt(
        ctx.settings,
        ctx.getSchemaContext,
        'lint',
        activeVocabularyLists(ctx.app, ctx.settings)
      ),
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      ...(ctx.settings.disableThinking ? { enableThinking: false } : {}),
    });
    result = await parseJsonResponse(response);
  }

  if (!result?.related_pages?.length) return [];

  const linkedPages: string[] = [];
  const labels = getSectionLabels(ctx.settings);

  for (const related of result.related_pages) {
    // Defense: normalize any hardcoded "wiki/" prefix from LLM response
    related.page_path = normalizeLLMPath(related.page_path, ctx.settings.wikiFolder);
    const fullPath = normalizeOrphanPagePath(
      related.page_path,
      ctx.settings.wikiFolder
    );
    const relatedContent = await ctx.tryReadFile(fullPath);
    if (!relatedContent) continue;

    if (!validateOrphanLinkTarget(relatedContent, related.link_target)) {
      const updated = buildOrphanLinkUpdate(
        relatedContent,
        {
          pagePath: related.page_path,
          linkText: related.link_text,
          linkTarget: related.link_target,
        },
        labels.related_pages
      );
      await ctx.createOrUpdateFile(fullPath, updated);
      linkedPages.push(related.page_path);
    }
  }
  return linkedPages;
}
