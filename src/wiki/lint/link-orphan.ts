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
  orphanLinkSpellings,
  retargetOrphanLinkTarget,
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
  // The spellings the orphan can be linked by. A link to the same page under
  // any of them is the same link, and the label is only presentation.
  const orphanSpellings = orphanLinkSpellings(orphanPath, ctx.settings.wikiFolder);

  for (const related of result.related_pages) {
    // Defense: normalize any hardcoded "wiki/" prefix from LLM response
    related.page_path = normalizeLLMPath(related.page_path, ctx.settings.wikiFolder);
    const fullPath = normalizeOrphanPagePath(
      related.page_path,
      ctx.settings.wikiFolder
    );
    const relatedContent = await ctx.tryReadFile(fullPath);
    if (!relatedContent) continue;

    // Issue #824's acceptance criterion is that the orphan gains an inbound link.
    // The link's purpose is to make the orphan reachable, so the target is the
    // orphan by definition. The model cannot know the orphan's real path — it
    // sees the orphan's content and the index, never its file name — so it
    // guesses one from the display name. The guess is a guess about a path, and
    // it is replaced unconditionally: keeping it when it happens to name
    // *another* existing page linked that page instead, left the orphan
    // orphaned, and reported success while doing it.
    const linkTarget = retargetOrphanLinkTarget(
      related.link_target,
      orphanPath,
      ctx.settings.wikiFolder
    );
    // A `link_text` that already ends with the dead link would otherwise keep that
    // link and gain the repaired one beside it, so the dead copy is replaced first.
    const linkText = related.link_text.includes(related.link_target)
      ? related.link_text.replace(related.link_target, linkTarget)
      : related.link_text;

    if (!validateOrphanLinkTarget(relatedContent, linkTarget, orphanSpellings)) {
      const updated = buildOrphanLinkUpdate(
        relatedContent,
        {
          pagePath: related.page_path,
          linkText,
          linkTarget,
        },
        labels.related_pages
      );
      await ctx.createOrUpdateFile(fullPath, updated);
      linkedPages.push(related.page_path);
    }
  }
  return linkedPages;
}
