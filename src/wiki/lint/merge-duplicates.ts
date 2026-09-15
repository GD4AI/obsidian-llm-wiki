import { EngineContext } from '../../types';
import { PROMPTS } from '../../prompts';
import { TOKENS_LINT_PAGE_FIX, WIKI_SUBFOLDERS } from '../../constants';
import { buildSystemPrompt } from '../system-prompts';
import { parseFrontmatter, enforceFrontmatterConstraints, serializeFrontmatter, extractPassthroughLines } from '../../core/frontmatter';
import { parseJsonResponse } from '../../core/json';
import { reassertH1 } from '../../core/section-header-canonicalizer';
import { cleanMarkdownResponse } from '../../core/markdown';
import { renderTemplate } from '../../core/template-renderer';
import { resolveModelForTask } from '../../core/model-resolver';
import { retargetLinksToPage } from '../../core/link-retarget';
import { localDateStamp } from '../../core/format';
import { activeVocabulary, activeVocabularyLists, vocabularyKindFor } from '../../core/vocabulary';

export async function mergeDuplicatePages(
  ctx: EngineContext,
  targetPath: string,
  sourcePath: string
): Promise<string> {
  const targetContent = await ctx.tryReadFile(targetPath);
  const sourceContent = await ctx.tryReadFile(sourcePath);
  if (!targetContent || !sourceContent) {
    throw new Error(`Cannot merge: target or source page not found (target=${targetPath}, source=${sourcePath})`);
  }

  const sourceFm = parseFrontmatter(sourceContent);
  const targetFm = parseFrontmatter(targetContent);
  const sourceTitle = sourcePath.split('/').pop()?.replace('.md', '') || '';

  const targetSources = Array.isArray(targetFm?.sources) ? targetFm.sources : [];
  const sourceSources = Array.isArray(sourceFm?.sources) ? sourceFm.sources : [];
  const mergedSourcesSet = new Set<string>();
  const mergedSourcesList: string[] = [];
  for (const s of [...targetSources, ...sourceSources]) {
    const key = s.trim().toLowerCase();
    if (!mergedSourcesSet.has(key)) {
      mergedSourcesSet.add(key);
      mergedSourcesList.push(s);
    }
  }

  const targetAliases = Array.isArray(targetFm?.aliases) ? targetFm.aliases : [];
  const sourceAliases = Array.isArray(sourceFm?.aliases) ? sourceFm.aliases : [];

  const extractH1 = (content: string): string | null => {
    const bodyMatch = content.match(/^---[\s\S]*?\n---\n?([\s\S]*)/);
    if (!bodyMatch) return null;
    const h1Match = bodyMatch[1].trim().match(/^#\s+(.+?)(?:\n|$)/);
    return h1Match ? h1Match[1].trim() : null;
  };
  const sourceH1 = extractH1(sourceContent);
  const targetH1 = extractH1(targetContent);

  const allAliases = [...targetAliases, sourceTitle, ...sourceAliases];
  if (sourceH1 && sourceH1 !== sourceTitle) {
    allAliases.push(sourceH1);
  }
  const targetFilename = targetPath.split('/').pop()?.replace('.md', '') || '';
  if (targetH1 && targetH1 !== targetFilename && !targetAliases.includes(targetH1)) {
    allAliases.unshift(targetH1);
  }

  const wikiSubfolders = [WIKI_SUBFOLDERS.entities, WIKI_SUBFOLDERS.concepts, WIKI_SUBFOLDERS.sources];
  const cleanAliases = allAliases.filter(a => {
    if (!a) return false;
    for (const folder of wikiSubfolders) {
      if (a.startsWith(folder) && a.length > folder.length) return false;
    }
    return true;
  });

  const targetTitle = targetFm?.title as string || targetFilename;
  let dedupedAliases = cleanAliases.filter((a, i) =>
    a && a !== targetTitle && cleanAliases.indexOf(a) === i
  );

  const targetBodyMatch = targetContent.match(/^---[\s\S]*?\n---\n?([\s\S]*)/);
  const sourceBodyMatch = sourceContent.match(/^---[\s\S]*?\n---\n?([\s\S]*)/);
  const targetBody = targetBodyMatch ? targetBodyMatch[1].trim() : targetContent;
  const sourceBody = sourceBodyMatch ? sourceBodyMatch[1].trim() : sourceContent;

  const client = ctx.getClient();
  let mergedBody = '';
  let llmMergeSucceeded = false;
  if (client) {
    try {
      const prompt = renderTemplate(PROMPTS.mergeDuplicatePages, {
        target_content: targetBody,
        source_content: sourceBody,
      });

      const mergedContent = await client.createMessage({
        model: resolveModelForTask(ctx.settings, 'lint'),
        max_tokens: TOKENS_LINT_PAGE_FIX,
        system: await buildSystemPrompt(
          ctx.settings,
          ctx.getSchemaContext,
          'merge',
          activeVocabularyLists(ctx.app, ctx.settings)
        ),
        messages: [{ role: 'user', content: prompt }],
        ...(ctx.settings.disableThinking ? { enableThinking: false } : {}),
      });

      const cleaned = cleanMarkdownResponse(mergedContent);
      if (cleaned && cleaned.length > 100) {
        let parsed: { body?: string; aliases?: string[] } | null = null;
        try {
          parsed = await parseJsonResponse(cleaned, undefined, { silentOnEmpty: true });
        } catch (parseErr) {
          console.error(`mergeDuplicatePages: JSON parse failed for ${sourcePath} → ${targetPath}`, parseErr);
        }
        if (parsed?.body) {
          // #435 Item 2: this path hands the model a body and adopts its answer,
          // exactly like the merge and related-page paths in #419 — and the
          // title line is inside that window with no layer owning it. Softer
          // here (the surviving page's title is already captured into
          // `aliases:` above, so identity survives a lost H1) but the same
          // class, and the same deterministic repair applies.
          mergedBody = reassertH1(targetBody, parsed.body.trim());
          llmMergeSucceeded = true;
        } else if (!parsed) {
          console.warn(`mergeDuplicatePages: JSON parse returned null for ${sourcePath} → ${targetPath}, falling back to programmatic merge`);
        } else {
          console.warn(`mergeDuplicatePages: LLM response missing 'body' field for ${sourcePath} → ${targetPath}, falling back to programmatic merge`);
        }
        if (parsed?.aliases && Array.isArray(parsed.aliases)) {
          for (const a of parsed.aliases) {
            if (a && a !== targetTitle && !dedupedAliases.includes(a)) {
              dedupedAliases.push(a);
            }
          }
        }
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error(`LLM merge failed for ${sourcePath} → ${targetPath}: ${errMsg}. Using programmatic merge.`, e);
    }
  }

  if (!mergedBody) {
    if (llmMergeSucceeded) {
      console.warn(`mergeDuplicatePages: LLM returned empty body for ${sourcePath} → ${targetPath}, using programmatic merge`);
    }
    mergedBody = targetBody;
    if (sourceBody) {
      mergedBody += '\n\n## From ' + sourceTitle + '\n\n' + sourceBody;
    }
  }

  const today = localDateStamp();
  const newContent = serializeFrontmatter(
    {
      type: targetFm?.type,
      created: targetFm?.created || today,
      updated: today,
      sources: mergedSourcesList,
      tags: Array.isArray(targetFm?.tags) ? targetFm.tags : [],
      reviewed: targetFm?.reviewed,
      aliases: dedupedAliases,
    },
    // Issue #356 parity: every other frontmatter writer passes unknown
    // top-level fields through; this one re-serialized from the parsed object
    // alone, so a duplicate merge dropped every user-owned field of the
    // surviving page (`redirect_to:`, `parent_org:`, ...). Same helper, same
    // semantics as mergeFrontmatter: the survivor's lines, verbatim.
    { tagStyle: 'block', passthroughLines: extractPassthroughLines(targetContent) }
  ) + '\n\n' + mergedBody;
  const pageType = targetPath.includes(`/${WIKI_SUBFOLDERS.entities}/`)
    ? 'entity'
    : targetPath.includes(`/${WIKI_SUBFOLDERS.concepts}/`)
      ? 'concept'
      : 'source';

  // Issue #388: `newContent` was serialized from `targetFm` a few lines up, but
  // the caller is the one that read the target page — pass the date explicitly
  // rather than relying on it surviving a round trip through the serializer.
  const enforced = enforceFrontmatterConstraints(newContent, pageType, ctx.settings, {
    preserveCreated: targetFm?.created,
    pagePath: targetPath,
    domainVocabulary: activeVocabulary(ctx.app, ctx.settings, vocabularyKindFor(pageType)),
  });
  await ctx.createOrUpdateFile(targetPath, enforced);

  // Issue #386: retarget every link that resolves to the source page, vault-wide
  // and in every link form, BEFORE the page is deleted. The previous rewrite
  // visited only files inside the wiki folder and searched only for the
  // wiki-relative form, so an ordinary user note linking `[[Foo]]` kept a link
  // into nothing — and after the delete that reference is no longer findable.
  const wikiFolder = ctx.settings.wikiFolder;
  const sourceRel = sourcePath.replace(wikiFolder + '/', '').replace('.md', '');
  const targetRel = targetPath.replace(wikiFolder + '/', '').replace('.md', '');
  const retargeted = await retargetLinksToPage(ctx.app, sourcePath, targetPath);
  if (retargeted.stale > 0) {
    console.warn(
      `mergeDuplicatePages: ${retargeted.stale} link(s) to ${sourceRel} could not be retargeted ` +
      `(file changed since it was indexed) and will be dead after the merge`
    );
  }

  await ctx.deleteFile(sourcePath);
  const linkNote = retargeted.linksRewritten > 0
    ? ` (${retargeted.linksRewritten} link${retargeted.linksRewritten === 1 ? '' : 's'} retargeted in ${retargeted.filesChanged} file${retargeted.filesChanged === 1 ? '' : 's'})`
    : '';
  return `merged ${sourceRel} → ${targetRel}${linkNote}`;
}
