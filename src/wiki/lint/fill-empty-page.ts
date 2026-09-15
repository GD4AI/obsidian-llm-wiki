import { EngineContext } from '../../types';
import { PROMPTS } from '../../prompts';
import { TOKENS_LINT_PAGE_FIX } from '../../constants';
import {
  buildSystemPrompt,
  applySectionLabels,
  getGranularityFixLimits,
} from '../system-prompts';
import { enforceFrontmatterConstraints, parseFrontmatter } from '../../core/frontmatter';
import { activeVocabulary, activeVocabularyLists, vocabularyKindFor } from '../../core/vocabulary';
import { cleanMarkdownResponse } from '../../core/markdown';
import { resolveModelForTask } from '../../core/model-resolver';
import {
  buildEmptyPagePrompt,
  cleanWikiIndex,
  correctLinkPollution,
} from '../../core/prompt-builders';
import { normalizeFrontmatterDates, buildSectionLabelsHint, EMPTY_CONTENT_STRIP, MIN_SUBSTANTIVE_CHARS, STUB_MARKER } from './utils';
import { WIKI_SUBFOLDERS } from '../../constants';
import { localDateStamp } from '../../core/format';


export async function fillEmptyPage(
  ctx: EngineContext,
  pagePath: string,
  existingContent?: string
): Promise<string> {
  const content = (existingContent != null) ? existingContent : await ctx.tryReadFile(pagePath);
  if (content === null || content === undefined) {
    throw new Error(
      `Cannot expand empty page: file not found at "${pagePath}"`
    );
  }

  const beforeLen = content.length;

  const pageType = pagePath.includes(`/${WIKI_SUBFOLDERS.entities}/`)
    ? WIKI_SUBFOLDERS.entities
    : pagePath.includes(`/${WIKI_SUBFOLDERS.concepts}/`)
      ? WIKI_SUBFOLDERS.concepts
      : WIKI_SUBFOLDERS.sources;
  const indexPath = `${ctx.settings.wikiFolder}/index.md`;
  const rawWikiIndex = (await ctx.tryReadFile(indexPath)) || '';

  const wikiIndex = cleanWikiIndex(rawWikiIndex);
  const limits = getGranularityFixLimits(ctx.settings);

  const prompt = buildEmptyPagePrompt(PROMPTS.fillEmptyPage, {
    pageType,
    existingContent: content,
    wikiIndex,
    sectionLabelsHint: buildSectionLabelsHint(ctx.settings),
    maxEntities: limits.maxEntities,
    maxConcepts: limits.maxConcepts,
  });

  const finalPrompt = applySectionLabels(prompt, ctx.settings);

  const client = ctx.getClient();
  if (!client) throw new Error('LLM client not initialized');

  const filledContent = await client.createMessage({
    model: resolveModelForTask(ctx.settings, 'lint'),
    max_tokens: TOKENS_LINT_PAGE_FIX,
    system: await buildSystemPrompt(
      ctx.settings,
      ctx.getSchemaContext,
      'full',
      activeVocabularyLists(ctx.app, ctx.settings)
    ),
    messages: [{ role: 'user', content: finalPrompt }],
    ...(ctx.settings.disableThinking ? { enableThinking: false } : {}),
  });

  const cleaned = cleanMarkdownResponse(filledContent);
  const pollutionFree = correctLinkPollution(cleaned);

  const stubFree = pollutionFree.includes(STUB_MARKER)
    ? pollutionFree
        .split('\n')
        .filter(line => !line.includes(STUB_MARKER))
        .join('\n')
        .trim()
    : pollutionFree;

  const textBody = stubFree
    .replace(/---[\s\S]*?---/, '')
    .replace(EMPTY_CONTENT_STRIP, '')
    .trim();
  if (textBody.length < MIN_SUBSTANTIVE_CHARS) {
    console.debug(
      `fillEmptyPage: LLM output still below threshold (${textBody.length} chars), writing anyway`
    );
  }

  const dateStr = localDateStamp();
  const withDates = normalizeFrontmatterDates(stubFree, dateStr);
  const pageTypeSingular = pageType === WIKI_SUBFOLDERS.entities ? 'entity' : pageType === WIKI_SUBFOLDERS.concepts ? 'concept' : 'source';
  // Issue #388: the page being filled already exists, so its real creation date
  // is on disk. `withDates` is the model's reply and its `created:` line, if it
  // wrote one, is a transcription at best.
  const enforced = enforceFrontmatterConstraints(withDates, pageTypeSingular, ctx.settings, {
    preserveCreated: parseFrontmatter(content)?.created,
    pagePath,
    domainVocabulary: activeVocabulary(ctx.app, ctx.settings, vocabularyKindFor(pageTypeSingular)),
  });

  await ctx.createOrUpdateFile(pagePath, enforced);

  const pageRel = pagePath.replace(ctx.settings.wikiFolder + '/', '').replace('.md', '');
  return `${pageRel} (${beforeLen} → ${enforced.length} chars)`;
}
