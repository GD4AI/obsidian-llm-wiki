import { EngineContext } from '../../types';
import { activeVocabularyLists } from '../../core/vocabulary';
import { PROMPTS } from '../../prompts';
import { TOKENS_LINT_PAGE_FIX, WIKI_SUBFOLDERS, CANDIDATE_WINDOW_TOP_K } from '../../constants';
import { buildSystemPrompt } from '../system-prompts';
import { renderTemplate } from '../../core/template-renderer';
import { parseJsonResponse } from '../../core/json';
import { slugify } from '../../core/slug';
import { resolveModelForTask } from '../../core/model-resolver';
import {
  findDeadLinkTarget,
  buildDeadLinkReplacement,
  replaceDeadLink,
} from '../../core/dead-link-detector';
import { getExistingWikiPages } from './get-existing-pages';
import { selectCandidateWindow, contextAround } from '../../core/candidate-window';
import { FixDeadLinkSchema, type FixDeadLink } from '../../llm-sdk/output-schemas';
import { localDateStamp } from '../../core/format';

/** Characters to each side of the dead link that describe what it points to (300 in all, the dedup summary length). */
const DEAD_LINK_CONTEXT_RADIUS = 150;

const PLURAL_MAP: Record<string, string> = {
  entity: WIKI_SUBFOLDERS.entities,
  concept: WIKI_SUBFOLDERS.concepts,
};

function makeRelPath(path: string, wikiFolder: string): string {
  return path.replace(wikiFolder + '/', '').replace(/\.md$/i, '');
}

function replaceTargetLink(sourceContent: string, targetName: string, newLink: string): string {
  const linkRegex = /\[\[([^\]|#]+)(?:[|#][^\]]+)?\]\]/g;
  return sourceContent.replace(
    linkRegex,
    (fullMatch: string, capturedTarget: string) => {
      if (capturedTarget.trim() === targetName) return newLink;
      return fullMatch;
    }
  );
}

// ────────────────────────────────────────────────────────────────────────────
// #197 stub-content builders — honest placeholders, NOT LLM-filled stubs.
//
// Why these are pure functions: the LLM-stub-creating branch of fixDeadLink
// used to call fillEmptyPage() after writing the empty stub. fillEmptyPage
// runs the LLM against an empty page + a wiki index and asks for a fully
// formed entity/concept page. With no real source note to anchor the
// generation, the LLM fabricates alias claims, related-link targets, and a
// summary that looks authoritative but is unsourced.
//
// Reintroduces the empty-source hallucination class that #164/#174 explicitly
// gates in the ingest path. The lint path was a back door around the gate.
//
// v1.22.1 fix: stubs are honest placeholders. They carry the
// `generation_complete: false` marker so #170's incomplete-cleaner recognises
// them, and the placeholder body explicitly says the page is referenced but
// not yet backed by a real source. A future real ingest fills the stub
// through the normal ingest path, which IS gated by #164/#174.
//
// v1.23.0 extension: PPR engine will distinguish hub-in-waiting vs leaf-never-
// hub dead links and decide whether to keep the stub, escalate to a full
// ingest, or remove the stub and leave the dead link. The conservative
// placeholder shape below does not block that evolution.
// ────────────────────────────────────────────────────────────────────────────

export interface StubContentParams {
  title: string;
  stubType: 'entity' | 'concept';
  wikiFolder: string;
  /** Relative path inside the wiki folder of the page that referenced the target. */
  referringPageRel: string;
}

export function buildStubContent(params: StubContentParams): string {
  const { title, stubType, referringPageRel } = params;
  const today = localDateStamp();
  const defaultTag = stubType === 'entity' ? 'other' : 'term';
  // Emit `sources:` as block-style so the v1.25.11 provenance-stamp
  // writer in create-page.ts's `appendSourceSlugToFrontmatter` (which
  // only detects `^sources:\s*$`) merges into it instead of inserting
  // a duplicate top-level `sources:` key. Duplicate keys are invalid
  // YAML and break Obsidian's Properties render. See issue #399.
  //
  // Wikilink value MUST be double-quoted. Unquoted `- [[x]]` is parsed
  // by YAML 1.2 as a nested flow sequence `[["x"]]` — not a string —
  // which makes Obsidian's Properties panel drop the property type and
  // the value becomes literal text (no link chip, no backlink, no graph
  // edge). Match `yamlStringify()` in src/core/frontmatter.ts (line 104).
  // S135: `stub: true` is the marker that actually carries "this is a stub" —
  // `generation_complete: false` cannot (createOrUpdateFile flips it to `true`
  // right after the write, and unflipped it would hand the page to the startup
  // Phase-3 cleaner). merge-page.ts reads it to keep a stub from being
  // skip-frozen, and strips it when a treating source fills the page.
  return `---\ntype: ${stubType}\ncreated: ${today}\nsources:\n  - "[[${referringPageRel}]]"\ntags: [${defaultTag}]\nstub: true\ngeneration_complete: false\n---\n# ${title}\n\n> Stub created by Fix Dead Links — referenced by [[${referringPageRel}]]. Will be filled by next ingest of an actual source that defines this entity.\n`;
}

/**
 * Policy gate for #197. The lint path MUST NOT hand a stub to fillEmptyPage()
 * for an unresolvable dead link — that re-introduces the empty-source
 * hallucination that #164/#174 was designed to prevent in the ingest path.
 *
 * Both branches return false today. The function exists as a single,
 * greppable switch so any future PR that wants to re-introduce auto-fabrication
 * has to change this gate explicitly (rather than slipping it past a review
 * by editing a deep `await fillEmptyPage(...)` line).
 */
export function shouldFabricateStubForUnresolvableLink(_opts: {
  branch: 'llm-create-stub' | 'deterministic-fallback';
}): boolean {
  return false;
}

/**
 * Issue #485: the second decision an unresolvable link faces. #197's gate
 * above answers "may an LLM FILL the stub?" (never); this one answers
 * "is the stub PAGE written at all?". Default ON — existing vaults keep the
 * current outcome; `createStubsForUnresolvableLinks: false` opts out, and
 * the link stays as it is, still surfacing in every lint report. Ingest
 * never depended on a pre-existing stub to create the page, so nothing
 * downstream changes. Kept as a single greppable switch for the same
 * reason its sibling is: both creation sites route through here.
 */
export function shouldCreateStubForUnresolvableLink(
  settings: Pick<EngineContext['settings'], 'createStubsForUnresolvableLinks'> | undefined,
): boolean {
  return settings?.createStubsForUnresolvableLinks !== false;
}

export async function fixDeadLink(
  ctx: EngineContext,
  sourcePath: string,
  targetName: string
): Promise<string> {
  const existingPages = await getExistingWikiPages(
    ctx.app,
    ctx.settings.wikiFolder
  );

  // ---- Pre-check: deterministic title + alias match ----
  const sourceContent =
    (await ctx.tryReadFile(sourcePath)) || '(empty)';
  const targetBasename = targetName.includes('/')
    ? targetName.split('/').pop()!
    : targetName;

  const preMatch = findDeadLinkTarget(existingPages, targetBasename);

  if (preMatch) {
    const newLink = buildDeadLinkReplacement(preMatch, ctx.settings.wikiFolder);
    const updatedContent = replaceDeadLink(sourceContent, targetName, newLink);
    await ctx.createOrUpdateFile(sourcePath, updatedContent);
    return `pre-check corrected (alias match): ${newLink}`;
  }

  // ---- LLM path: semantic matching with alias-aware prompt ----
  // The pages the model sees are the shared candidate window
  // (`core/candidate-window.ts`), ranked against the link's target name and
  // the text around the link. Before this the list was every page in vault
  // iteration order, cut at 3,000 rendered characters — on a 2,800-page wiki
  // an arbitrary 2–3 % that the prompt then searched for "semantic
  // similarity", and the target's presence in it was a matter of file order.
  const pool = existingPages.filter(p => {
    const bn = p.title || '';
    const hasPollutedBasename = /^(entities|concepts|sources)([^\s\-_a-zA-Z0-9])/.test(bn);
    return !hasPollutedBasename;
  });
  const linkContext = contextAround(sourceContent, [`[[${targetName}`, targetBasename], DEAD_LINK_CONTEXT_RADIUS);
  const pagesList = selectCandidateWindow({ name: targetBasename, context: linkContext }, pool, CANDIDATE_WINDOW_TOP_K)
    .map(p => {
      const aliasSuffix = p.aliases?.length ? ` \`aliases: ${p.aliases.join(', ')}\`` : '';
      return `- ${p.wikiLink}${aliasSuffix}`;
    }).join('\n');

  const prompt = renderTemplate(PROMPTS.fixDeadLink, {
    source_content: sourceContent.substring(0, 2000),
    target_name: targetName,
    existing_pages: pagesList,
  });

  const client = ctx.getClient();
  if (!client) return 'no action taken (no client)';

  const model = resolveModelForTask(ctx.settings, 'lint');
  const systemPrompt = await buildSystemPrompt(
    ctx.settings,
    ctx.getSchemaContext,
    'lint',
    activeVocabularyLists(ctx.app, ctx.settings)
  );
  const disableThinking = ctx.settings.disableThinking;

  // v1.26.3 PATCH Phase B (Issue #443): typed-output path. Prefer
  // `result.output` when the client implements createMessageWithOutput
  // and the Tier 0 (json_schema) parse succeeds; fall back to
  // parseJsonResponse(text). The empty-response retry (without JSON
  // mode) below is preserved verbatim — it runs when the typed path
  // returns an empty text too.
  let result: FixDeadLink | null;
  if (client.createMessageWithOutput) {
    let typedResult = await client.createMessageWithOutput<FixDeadLink>({
      task: 'fix-dead-link',
      model,
      max_tokens: TOKENS_LINT_PAGE_FIX,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object', schema: FixDeadLinkSchema },
      ...(disableThinking ? { enableThinking: false } : {}),
    });

    // v1.26.3 PATCH Phase B note: the typed path's Tier 0 output is
    // preferred when present; but the empty-response retry is kept on
    // the createMessage (legacy) arm only. A typed Tier 0 success
    // guarantees a parsed object; a Tier 1/2 success with empty text
    // falls through to parseJsonResponse which throws/returns null on
    // empty — the caller below handles null as "no action".
    result = typedResult.output && typeof typedResult.output === 'object'
      ? typedResult.output
      : await parseJsonResponse(typedResult.text);
  } else {
    let response = await client.createMessage({
      model,
      max_tokens: TOKENS_LINT_PAGE_FIX,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      ...(disableThinking ? { enableThinking: false } : {}),
    });

    if (!response) {
      console.debug(
        `fixDeadLink: empty response for target "${targetName}", retrying without JSON mode`
      );
      response = await client.createMessage({
        model,
        max_tokens: TOKENS_LINT_PAGE_FIX,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
        ...(disableThinking ? { enableThinking: false } : {}),
      });
    }

    result = await parseJsonResponse(response);
  }

  if (result?.action === 'correct' && result.correct_link) {
    let newLink = result.correct_link.trim();
    if (!newLink.startsWith('[[')) {
      newLink = `[[${newLink}]]`;
    }

    const updatedContent = replaceTargetLink(sourceContent, targetName, newLink);
    await ctx.createOrUpdateFile(sourcePath, updatedContent);
    return `corrected: ${newLink}`;
  }

  if (result?.action === 'create_stub' && result.stub_title) {
    const sanitizedTitle = result.stub_title.replace(/^(entities|concepts|sources)([^\s\-_a-zA-Z0-9])/, '$2');

    // Safety net: re-check aliases before creating a stub.
    const stubTitleLower = sanitizedTitle.toLowerCase();
    const safetySlug = slugify(sanitizedTitle).toLowerCase();
    const aliasMatch = existingPages.find(p =>
      p.title.toLowerCase() === stubTitleLower ||
      p.aliases?.some(a => a.toLowerCase() === stubTitleLower) ||
      slugify(p.title).toLowerCase() === safetySlug ||
      p.aliases?.some(a => slugify(a).toLowerCase() === safetySlug)
    );
    if (aliasMatch) {
      const newLink = `[[${makeRelPath(aliasMatch.path, ctx.settings.wikiFolder)}|${aliasMatch.title}]]`;
      const updatedContent = replaceTargetLink(sourceContent, targetName, newLink);
      await ctx.createOrUpdateFile(sourcePath, updatedContent);
      return `safety-net corrected (alias match for stub): ${newLink}`;
    }

    // #485: the leave-it outcome. Correction has already had its chance
    // (pre-check + safety net above); past this point the only action is
    // creating a page, and the user can decline that.
    if (!shouldCreateStubForUnresolvableLink(ctx.settings)) {
      return 'left as dead link (stub creation disabled by createStubsForUnresolvableLinks)';
    }

    const stubType = result.stub_type || 'entity';
    const stubDir = PLURAL_MAP[stubType] || `${stubType}s`;
    const stubSlug = slugify(sanitizedTitle, ctx.settings.slugCase === 'preserve');
    const stubPath = `${ctx.settings.wikiFolder}/${stubDir}/${stubSlug}.md`;
    const sourceRel = makeRelPath(sourcePath, ctx.settings.wikiFolder);
    // #197: stub is an honest placeholder, NOT LLM-filled. See buildStubContent
    // for rationale. This prevents the empty-source hallucination class that
    // #164/#174 gates in the ingest path.
    const stubContent = buildStubContent({
      title: sanitizedTitle,
      stubType: stubType as 'entity' | 'concept',
      wikiFolder: ctx.settings.wikiFolder,
      referringPageRel: sourceRel,
    });

    await ctx.createOrUpdateFile(stubPath, stubContent);
    // #197: deliberately do NOT call fillEmptyPage here. See
    // shouldFabricateStubForUnresolvableLink for the policy gate.

    const newLink = `[[${stubDir}/${stubSlug}|${sanitizedTitle}]]`;
    const updatedContent = replaceTargetLink(sourceContent, targetName, newLink);
    await ctx.createOrUpdateFile(sourcePath, updatedContent);
    return `stub created (unfilled): ${stubPath} — will be filled by next ingest of a real source`;
  }

  // ---- Deterministic fallback when LLM fails ----
  const lowerTarget = targetBasename.toLowerCase();
  const targetSlug = slugify(targetBasename).toLowerCase();
  let match = existingPages.find(p =>
    p.title.toLowerCase() === lowerTarget ||
    slugify(p.title).toLowerCase() === targetSlug
  );

  if (!match) {
    match = existingPages.find(p =>
      p.aliases?.some(a =>
        a.toLowerCase() === lowerTarget ||
        slugify(a).toLowerCase() === targetSlug
      )
    );
  }

  if (match) {
    const newLink = `[[${makeRelPath(match.path, ctx.settings.wikiFolder)}|${match.title}]]`;
    const updatedContent = replaceTargetLink(sourceContent, targetName, newLink);
    await ctx.createOrUpdateFile(sourcePath, updatedContent);
    return `fallback corrected: ${newLink}`;
  }

  // No match — create an honest placeholder stub. Do NOT expand it via LLM.
  // #485: same leave-it gate as the LLM create_stub branch above.
  if (!shouldCreateStubForUnresolvableLink(ctx.settings)) {
    return 'left as dead link (stub creation disabled by createStubsForUnresolvableLinks)';
  }
// #197: a dead link that doesn't resolve to any existing page is an honest
// forward-reference. The user will eventually ingest a real source note that
// defines the target, and at that point the normal ingest path (gated by
// #164/#174) fills the stub through correct channels. Handing the stub to
// fillEmptyPage() here would let the LLM fabricate alias claims and related
// links against zero source content.
const cleanBasename = targetBasename.replace(/^(entities|concepts|sources)([^\s\-_a-zA-Z0-9])/, '$2');
const stubType: 'entity' | 'concept' = targetName.includes('/entities/') ? 'entity' : 'concept';
const stubDir = stubType === 'entity' ? WIKI_SUBFOLDERS.entities : WIKI_SUBFOLDERS.concepts;
const stubSlug = slugify(cleanBasename, ctx.settings.slugCase === 'preserve');
const stubPath = `${ctx.settings.wikiFolder}/${stubDir}/${stubSlug}.md`;
const sourceRel = makeRelPath(sourcePath, ctx.settings.wikiFolder);
const stubContent = buildStubContent({
  title: cleanBasename,
  stubType,
  wikiFolder: ctx.settings.wikiFolder,
  referringPageRel: sourceRel,
});

await ctx.createOrUpdateFile(stubPath, stubContent);
// #197: deliberately do NOT call fillEmptyPage here.

const newLink = `[[${stubDir}/${stubSlug}|${cleanBasename}]]`;
const updatedContent = replaceTargetLink(sourceContent, targetName, newLink);
await ctx.createOrUpdateFile(sourcePath, updatedContent);
return `fallback stub created (unfilled): ${stubPath} — will be filled by next ingest of a real source`;
}
