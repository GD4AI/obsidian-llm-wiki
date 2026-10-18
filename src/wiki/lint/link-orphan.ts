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
  retargetOrphanLinkTarget,
} from '../../core/orphan-matcher';
import { LinkOrphanSchema, type LinkOrphan } from '../../llm-sdk/output-schemas';

/**
 * Issue #824: does `link_target` name a page that exists?
 *
 * Resolution is deliberately narrow — each markdown file's vault path, its
 * wiki-relative form, and its declared aliases. That is the "page index / alias
 * map" the report asks for. It is not a re-implementation of Obsidian's link
 * resolution, and where it is uncertain it resolves rather than refuses: skipping
 * a legitimate link leaves the orphan orphaned, which is the defect being fixed.
 */
function makeOrphanLinkTargetResolver(
  ctx: EngineContext
): (linkTarget: string) => boolean {
  const wikiFolder = ctx.settings.wikiFolder;
  const known = new Set<string>();
  for (const file of ctx.app.vault.getMarkdownFiles()) {
    const rel = file.path.startsWith(`${wikiFolder}/`)
      ? file.path.slice(wikiFolder.length + 1)
      : file.path;
    for (const form of [file.path, rel]) {
      known.add(form);
      known.add(form.replace(/\.md$/, ''));
    }
    const cache = ctx.app.metadataCache.getFileCache(file);
    const frontmatter: Record<string, unknown> | undefined = cache?.frontmatter;
    const aliases: unknown = frontmatter?.aliases;
    if (Array.isArray(aliases)) {
      for (const alias of aliases) {
        if (typeof alias === 'string' && alias) known.add(alias);
      }
    }
  }
  return (linkTarget: string) => {
    const match = linkTarget.match(/\[\[\s*([^\]|]+)(?:\|[^\]]*)?\]\]/);
    const inner = (match ? match[1] : linkTarget).trim().replace(/\.md$/, '');
    return inner.length > 0 && known.has(inner);
  };
}

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
  const resolvesTarget = makeOrphanLinkTargetResolver(ctx);

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
    // Skipping an unresolvable target kept it orphaned and re-reported on every run.
    // The orphan's own path is known, so the link is rebuilt from it rather than
    // dropped — the model's readable text survives as the display label.
    const resolves = resolvesTarget(related.link_target);
    const linkTarget = resolves
      ? related.link_target
      : retargetOrphanLinkTarget(related.link_target, orphanPath, ctx.settings.wikiFolder);
    // A `link_text` that already ends with the dead link would otherwise keep that
    // link and gain the repaired one beside it, so the dead copy is replaced first.
    const linkText = related.link_text.includes(related.link_target)
      ? related.link_text.replace(related.link_target, linkTarget)
      : related.link_text;

    if (!validateOrphanLinkTarget(relatedContent, linkTarget, resolvesTarget)) {
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
