// page-factory/path-resolution.ts — resolve the file path for a new entity/
// concept page and build the LLM candidate list shown to dedup prompts.
//
// Extracted from the original page-factory.ts god-class so the slug-vs-LLM
// resolution logic and the LLM candidate-list shape are independently
// testable.
//
// Behavior (v1.24.1 Phase 2 refactor — preserved verbatim):
//   - resolvePagePath: exact-slug fast path → ConflictResolver (same-type
//     slug/alias match) → LLM semantic dedup fallback. Issue #472 both ways:
//     the opposite folder never decides deterministically — in neither
//     direction. A cross-folder slug/alias hit routes the resolution through
//     the semantic dedup call with that page in the candidate list: merging on
//     it blindly mistakes a shared designator for a shared referent (the KHK
//     case), ignoring it blindly mints a twin page whenever the extraction
//     types the same referent differently across notes (measured: 18 twin
//     pairs in one 83-note batch, every one the same referent).
//   - buildPagesListForPrompt: filters out sources/ by default (#234) and
//     polluted basenames (L2); caps at MAX_PAGES=50 with entity/concept
//     bias based on includePaths; emits a "(truncated)" suffix when the cap
//     fires; optionally appends includePaths that aren't already in the
//     list.

import { MIN_DEDUP_NAME_LENGTH, WIKI_SUBFOLDERS, TOKENS_DEDUP_RESOLUTION, DEDUP_CANDIDATE_TOP_K } from '../../constants';
import { slugify } from '../../core/slug';
import { ConflictResolver } from '../../core/conflict-resolver';
import { selectCandidateWindow } from '../../core/candidate-window';
import { getExistingWikiPages } from '../lint/get-existing-pages';
import { PROMPTS } from '../../prompts';
import { parseJsonResult } from '../../core/json';
import { normalizeLLMPath } from '../../core/prompt-builders';
import { renderTemplate } from '../../core/template-renderer';
import { resolveModelForTask } from '../../core/model-resolver';
import { appendAliases, aliasClaimsFromPages, type AliasesContext } from './aliases';
import { parseFrontmatter } from '../../core/frontmatter';
import { PathResolutionLLMSchema } from '../../llm-sdk/output-schemas';
import { callLlm } from '../../core/llm-dispatch';

/** Page shape consumed by the dedup candidate pre-filter. */
export interface DedupCandidatePage {
  path: string;
  title: string;
  aliases?: string[];
  /** The page's prose, lower-cased — ranks the window by what the page says. */
  text?: string;
}

/**
 * Pre-filter the same-type page list before it is rendered into the
 * semantic dedup prompt: the top-K of the shared candidate window
 * (`core/candidate-window.ts`), ranked on title, aliases AND the page's own
 * prose against the candidate's name and summary.
 *
 * This used to fall back to the FULL same-type list whenever the name shared
 * no token with any title — "recall over cost", on the reasoning that a
 * missed duplicate becomes a duplicate page. Measured, the fallback fired on
 * 61 % of entity candidates (41 % of concepts) at ~40K prompt tokens each,
 * and the model found a synonym's target in that list 0 of 18 times while it
 * found the same targets 9 of 9 times in a 30-entry window that contained
 * them. The list held the target; it did not deliver it. The prose signal is
 * what moves the target into the window: 42 % of hidden-alias trials against
 * 25 % for the name gate, and 7 of 10 synonym cases against 2 of 10.
 */
export function selectDedupCandidates(
  name: string,
  summary: string,
  sameTypePages: DedupCandidatePage[],
): DedupCandidatePage[] {
  return selectCandidateWindow({ name, context: summary }, sameTypePages, DEDUP_CANDIDATE_TOP_K);
}

/** Mirrors the subset of PageCreationResult we return. */
export interface ResolvedPathResult {
  path: string | null;
}

/**
 * Minimal context contract required by `resolvePagePath` and
 * `buildPagesListForPrompt`. Production callers pass the real EngineContext;
 * tests inject a mock with the same shape. Accepts the full `LLMWikiSettings`
 * shape (no index signature) since production callers want type-safe access
 * to other settings (provider, model, etc.).
 */
export interface PathResolutionContext extends AliasesContext {
  app: unknown;
  settings: import('../../types').LLMWikiSettings;
  getClient(): {
    createMessage: (...args: unknown[]) => Promise<string>;
    // v1.26.3 PATCH Issue #443 expanded scope: typed-output path. Optional
    // so legacy clients (Anthropic/OpenAI/Codex) and test mocks without the
    // method still type-check; the call site falls back to createMessage.
    createMessageWithOutput?: (...args: unknown[]) => Promise<{ text: string }>;
  } | null;
  buildSystemPrompt(mode: 'full' | 'compact' | 'merge' | 'index'): Promise<string>;
}

/**
 * Determine the actual file path for a new entity/concept, using slug-based
 * matching first and falling back to LLM semantic resolution.
 *
 * Issue #472 both ways: the opposite folder never decides deterministically.
 * A cross-folder slug/alias claim routes the resolution through the semantic
 * dedup call, which decides identity — and, on a confirmed cross-folder
 * match, re-decides the entity/concept classification against the vault's
 * Classification Rules (see `applyClassificationDecision`).
 */
// #661: the length floor applies to names written in scripts whose letters are
// not words on their own. A two-character Han, Kana or Hangul name is a complete
// word and keeps its model call; a name mixing in anything else is left alone too.
const ALPHABETIC_NAME = /^[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{N}\p{M}\p{P}\s]+$/u;

export async function resolvePagePath(
  ctx: PathResolutionContext,
  name: string,
  pageType: 'entity' | 'concept',
  summary: string,
  tags?: string[],
): Promise<ResolvedPathResult> {
  const folder = pageType === 'entity' ? WIKI_SUBFOLDERS.entities : WIKI_SUBFOLDERS.concepts;
  const slug = slugify(name, ctx.settings.slugCase === 'preserve');
  const slugPath = `${ctx.settings.wikiFolder}/${folder}/${slug}.md`;

  // Issue #446: what this call falls back to when it reaches no decision.
  // `slugPath` (create a new page) for the ordinary case; for an ambiguous
  // designator the matching pages demonstrably exist, so a new page is the one
  // answer that is certainly wrong — it is replaced by the top-ranked
  // candidate below, which is also what the pre-#446 code merged into, minus
  // the dependency on vault iteration order.
  let fallbackPath = slugPath;

  // The ambiguous fallback deliberately does NOT latch the designator as an
  // alias on the page it falls back to. The latch is the pre-#446 behaviour of
  // the *decided* merge paths and stays there; on an ambiguous designator it
  // cannot do what it does on a decided match, because ConflictResolver matches
  // over slug keys (`slugMatchKeys`): an alias whose slug the page already
  // carries adds no key, `slugMatches.length > 1` still holds, and the next
  // ingest reaches this same fallback. What it would do is write the designator
  // onto whichever candidate ranked first this time — and onto the next one
  // when the ranking moves — so an unanswered question would spread as a global
  // claim across the candidates. See the ConflictResolver test for the
  // measurement.

  // Fast path: exact slug match (same type folder)
  const existing = await ctx.tryReadFile(slugPath);
  if (existing !== null) {
    // Issue #472: a page in the opposite folder that happens to carry the same
    // letters is a different designator, not a duplicate of this one. It is
    // neither read nor written here — the previous code bridged the two with an
    // alias, which wrote this name into the other type's namespace and made the
    // two pages match each other on every later ingest.
    return { path: slugPath };
  }

  // Fast path 2 + Slow path: share sameTypePages across slug-match and LLM resolution
  try {
    const allPages = await getExistingWikiPages(ctx.app as never, ctx.settings.wikiFolder);

    // Use ConflictResolver for deterministic slug/alias matching before LLM fallback.
    const resolver = new ConflictResolver(ctx.settings.wikiFolder, allPages);
    const cr = resolver.resolve({ name, slug, pageType, tags });

    // Issue #472 both ways: opposite-folder pages carrying the designator.
    // The resolver reports slug/alias claims from the page index; the direct
    // file probe backstops it for a page created moments ago in this same run
    // that the index may not list yet — the measured twins include pairs born
    // seconds apart from one note.
    const oppositeFolder = pageType === 'entity' ? WIKI_SUBFOLDERS.concepts : WIKI_SUBFOLDERS.entities;
    const oppositeSlugPath = `${ctx.settings.wikiFolder}/${oppositeFolder}/${slug}.md`;
    const crossCandidates: DedupCandidatePage[] = [...(cr.crossFolderCandidates ?? [])];
    if (
      !crossCandidates.some(p => p.path === oppositeSlugPath) &&
      (await ctx.tryReadFile(oppositeSlugPath)) !== null
    ) {
      crossCandidates.push({ path: oppositeSlugPath, title: name });
    }

    if (cr.action === 'merge') {
      if (crossCandidates.length === 0) {
        // f9a680e's cross-page gate, fed for the first time: `allPages` is
        // already in scope, so the name is only appended when no OTHER page's
        // basename or alias claims it — a duplicated claim would silently merge
        // every future occurrence of the name into whichever page matches first.
        await appendAliases(ctx, cr.targetPath, [name], aliasClaimsFromPages(allPages, cr.targetPath));
        return { path: cr.targetPath };
      }
      // The designator lives in BOTH folders (#472's damaging case): the
      // deterministic same-type match may be about something else entirely, so
      // the question goes to the semantic call with both sides seeded. On
      // no-decision the same-type target stands — that is the pre-existing
      // behaviour, kept so a failure never crosses the folder on its own.
      fallbackPath = cr.targetPath;
      console.debug(
        `Entity resolution: "${name}" matches ${cr.targetPath} but ${crossCandidates[0].path} also carries the designator — routing to semantic dedup`,
      );
    }

    // Issue #446: more than one same-type page carries this designator. The
    // deterministic gate cannot say which one is meant — tags rank the
    // candidates, they never decide identity — so the question goes to the
    // semantic dedup below with the ranked candidates at the head of the
    // list. Before this, `find` returned whichever page the vault happened to
    // yield first and the ambiguity left no trace.
    const ambiguous = cr.action === 'disambiguate' ? cr.candidates ?? [] : [];
    if (ambiguous.length > 0) {
      fallbackPath = cr.targetPath;
      console.debug(`Entity resolution: ${cr.reason}`);
    }

    // Pages that demonstrably carry the designator lead the rendered list:
    // the same-type merge target when a cross-folder claim forced it here,
    // the ranked ambiguous candidates, then the cross-folder claims. For a
    // create-with-cross-claim the fallback stays `slugPath`: only a positive
    // match from the model crosses the folder, a failure to decide creates the
    // page in its own folder where the miss is at least visible as a twin.
    const seeded: DedupCandidatePage[] = [
      ...(cr.action === 'merge' ? allPages.filter(p => p.path === cr.targetPath) : []),
      ...ambiguous,
      ...crossCandidates,
    ].filter((p, i, arr) => arr.findIndex(q => q.path === p.path) === i);

    // #661: no page carries this name and it is too short to infer identity
    // from (see `MIN_DEDUP_NAME_LENGTH`). The deterministic answers are all in
    // `seeded` by now; what would follow is a lexical window and a model call,
    // so the create fallback is taken before either is built.
    if (seeded.length === 0 && ALPHABETIC_NAME.test(name.trim()) && [...name.trim()].length < MIN_DEDUP_NAME_LENGTH) {
      console.debug(
        `Entity resolution: "${name}" is shorter than ${MIN_DEDUP_NAME_LENGTH} code points and no page carries it — creating, not asking the model`,
      );
      return { path: fallbackPath };
    }

    // Both wiki folders feed the window (#472 both ways): the folder is the
    // extraction's guess, not a property of the referent, so a near-name twin
    // in the opposite folder must be able to reach the model too.
    const wikiPages = allPages
      .filter(
        p =>
          p.path.includes(`/${WIKI_SUBFOLDERS.entities}/`) ||
          p.path.includes(`/${WIKI_SUBFOLDERS.concepts}/`),
      )
      .filter(p => {
        // Purge polluted entries from LLM input (L2)
        const bn = p.title || '';
        return !/^(entities|concepts|sources)([^\s\-_a-zA-Z0-9])/.test(bn);
      })
      // Append-only ordering (ctime ascending): pages created during a run
      // join the rendered list at the END, so consecutive dedup calls keep a
      // byte-identical prefix and a local KV prefix cache can reuse it.
      // Alphabetical or vault-iteration order inserts new pages mid-list and
      // re-pays the prefill from the insertion point. Stable sort: pages
      // without ctime keep their relative order.
      .sort((a, b) => (a.ctime ?? 0) - (b.ctime ?? 0));

    // Same-type slug/alias match is handled above by ConflictResolver.
    // Remaining path: LLM-based semantic dedup for pages that don't match by slug/alias.

    if (wikiPages.length === 0 && seeded.length === 0) return { path: fallbackPath };

    const selected = selectDedupCandidates(name, summary, wikiPages);
    // The pages that actually carry the designator lead the list; the lexical
    // pre-filter supplies the rest as context.
    const pagesList = [...seeded, ...selected.filter(p => !seeded.some(c => c.path === p.path))]
      .map(p => {
        const aliasBlock = p.aliases?.length
          ? `\n  aliases: ${p.aliases.join(', ')}`
          : '';
        return `- path: ${p.path}\n  title: ${p.title}${aliasBlock}`;
      })
      .join('\n');

    const client = ctx.getClient();
    if (!client) return { path: fallbackPath };

    const prompt = renderTemplate(PROMPTS.resolveEntityDedup, {
      wikiFolder: ctx.settings.wikiFolder,
      entity_name: name,
      entity_type: pageType,
      entity_summary: summary.substring(0, 300),
      page_type: pageType,
      existing_pages: pagesList,
    });

    const resolveArgs = {
      task: 'dedup' as const,
      model: resolveModelForTask(ctx.settings, 'ingest'),
      max_tokens: TOKENS_DEDUP_RESOLUTION,
      // Slim selector: the dedup decision is same-type and the matching
      // criteria are fully stated in the user prompt — only the Wiki
      // Structure section is load-bearing here. 'full' (~8.5K chars of
      // templates/naming/maintenance) added pure prefill cost per call.
      system: await ctx.buildSystemPrompt('index'),
      messages: [{ role: 'user' as const, content: prompt }],
      // v1.26.3 PATCH Issue #443 expanded scope: typed-output path.
      // PathResolutionLLMSchema ({match?: boolean, path?: string|null}) on the
      // wire as Tier 0 json_schema — LMStudio accepts, no parse-error fallback
      // to slugPath.
      response_format: { type: 'json_object' as const, schema: PathResolutionLLMSchema },
      ...(ctx.settings.disableThinking ? { enableThinking: false } : {}),
    };
    const response = await callLlm(client, resolveArgs);

    const parsed = await parseJsonResult(response);

    if (!parsed.ok) {
      // #407 Stage 1. Until now this path returned `null` and joined the
      // `match === false` branch below, so an unreadable reply was recorded as
      // "no existing page matches" and a new page was written for an entity
      // that may already have one — without leaving a trace, because the
      // `catch` further down only sees thrown errors.
      //
      // The fallback is deliberately unchanged: this function must return a
      // path, and `slugPath` is still it. What changes is that the fallback is
      // now taken as a failure to read the reply, not as an answer to the
      // question. What to do about it beyond reporting — retry on `empty`,
      // surface the uncertainty to the caller — needs a return channel this
      // signature does not have, and is left to the later stages.
      const detail =
        parsed.reason === 'exception'
          ? `exception: ${String(parsed.error)}`
          : `${parsed.reason}, raw length ${parsed.rawLength}`;
      console.error(
        `Entity resolution for "${name}": dedup reply unreadable (${detail}) — using ${fallbackPath}, no match decided`,
      );
      return { path: fallbackPath };
    }

    const result = parsed.value as {
      match?: boolean;
      path?: string | null;
      classification?: string;
    };

    if (result.match && result.path) {
      const normalizedPath = normalizeLLMPath(result.path, ctx.settings.wikiFolder);
      console.debug(`Entity resolution: "${name}" matched existing page "${normalizedPath}"`);
      // On a cross-folder-routed match the reply also re-decided the
      // entity/concept classification; act on it (possibly moving the page)
      // before the alias append, which must target the final address.
      let finalPath = normalizedPath;
      if (crossCandidates.length > 0) {
        finalPath = await applyClassificationDecision(ctx, normalizedPath, result.classification);
      }
      // Append the new name as an alias to the existing page to prevent future
      // duplicates — through the same cross-page gate as the deterministic
      // merge above (`allPages` is still in scope here; the claims are
      // computed against the pre-move address, the one `allPages` lists).
      await appendAliases(ctx, finalPath, [name], aliasClaimsFromPages(allPages, normalizedPath));
      return { path: finalPath };
    }
  } catch (error) {
    console.debug(`Entity resolution for "${name}" failed, using ${fallbackPath}:`, error);
  }

  // Also the `match === false` exit: for an ambiguous designator this is the
  // one place where "neither candidate is it" would create a third page for a
  // name that is already an alias twice, so it resolves to the top-ranked
  // candidate instead. For every other call `fallbackPath` is `slugPath`.
  return { path: fallbackPath };
}

/**
 * #472 both ways, second half: a cross-folder match re-decides the
 * entity/concept classification once. The matched page's folder is the first
 * ingest's draw — made from whatever context that call happened to have, on a
 * page that may have been born from a passing mention — not a fact about the
 * referent. The dedup call answers the classification question against the
 * vault's Classification Rules (delivered via the 'index' schema context)
 * with both summaries in view.
 *
 * Ratchet: the answer is written back as `type_confirmed: true`, so the
 * question is asked at most once per page and the page cannot ping-pong
 * between the folders on later draws. A page already confirmed keeps its
 * address unconditionally.
 *
 * The move goes through `app.fileManager.renameFile`, which rewrites inbound
 * links (Obsidian in production; a CLI host must provide the same contract).
 * Deliberately NOT moved — and marked instead: when the decided folder
 * differs but the target address is occupied (an existing twin: healing that
 * is a merge, not a move) or the host offers no link-safe rename, the page
 * gets `type_conflict: <classification>` in its frontmatter. The conflict is
 * then a greppable artifact for a lint or a later pass, not a log line that
 * scrolled away — and `type_confirmed` stays absent, so the question is
 * re-asked once the obstacle is gone.
 */
async function applyClassificationDecision(
  ctx: PathResolutionContext,
  pagePath: string,
  classification: string | undefined,
): Promise<string> {
  const content = await ctx.tryReadFile(pagePath);
  if (!content) return pagePath;
  // parseFrontmatter coerces only `reviewed` to a boolean; every other value
  // stays a string, so the ratchet must accept both spellings.
  const fm = parseFrontmatter(content);
  if (fm && (fm.type_confirmed === true || fm.type_confirmed === 'true')) return pagePath;
  if (classification !== 'entity' && classification !== 'concept') return pagePath;

  const decidedFolder =
    classification === 'entity' ? WIKI_SUBFOLDERS.entities : WIKI_SUBFOLDERS.concepts;
  const currentFolder = pagePath.includes(`/${WIKI_SUBFOLDERS.entities}/`)
    ? WIKI_SUBFOLDERS.entities
    : WIKI_SUBFOLDERS.concepts;

  if (decidedFolder === currentFolder) {
    await writeTypeDecision(ctx, pagePath, content, { type: classification, confirmed: true });
    return pagePath;
  }

  const newPath = pagePath.replace(`/${currentFolder}/`, `/${decidedFolder}/`);
  if ((await ctx.tryReadFile(newPath)) !== null) {
    console.debug(
      `Entity resolution: "${pagePath}" is classified as ${classification} but ${newPath} already exists — marking the conflict, leaving both for a merge pass`,
    );
    await writeTypeDecision(ctx, pagePath, content, { conflict: classification });
    return pagePath;
  }

  const app = ctx.app as {
    vault?: { getAbstractFileByPath?: (p: string) => unknown };
    fileManager?: { renameFile?: (file: unknown, newPath: string) => Promise<void> };
  };
  const file = app.vault?.getAbstractFileByPath?.(pagePath);
  const rename = app.fileManager?.renameFile;
  if (!file || !rename) {
    console.debug(
      `Entity resolution: "${pagePath}" is classified as ${classification} but the host offers no link-safe rename — marking the conflict, leaving the page in place`,
    );
    await writeTypeDecision(ctx, pagePath, content, { conflict: classification });
    return pagePath;
  }

  await rename.call(app.fileManager, file, newPath);
  const moved = await ctx.tryReadFile(newPath);
  if (moved === null) {
    console.error(
      `Entity resolution: rename of "${pagePath}" to "${newPath}" reported success but the target is unreadable — resolving to the original path`,
    );
    return pagePath;
  }
  await writeTypeDecision(ctx, newPath, moved, { type: classification, confirmed: true });
  console.debug(
    `Entity resolution: moved "${pagePath}" → "${newPath}" per classification decision`,
  );
  return newPath;
}

/**
 * Line-based frontmatter update in the appendAliases style: only the named
 * lines change, everything else in the file is untouched. No-op on a page
 * without frontmatter delimiters (corrupt file).
 */
async function writeTypeDecision(
  ctx: PathResolutionContext,
  pagePath: string,
  content: string,
  decision: { type?: 'entity' | 'concept'; confirmed?: boolean; conflict?: 'entity' | 'concept' },
): Promise<void> {
  const lines = content.split('\n');
  if (lines[0]?.trim() !== '---') return;
  const end = lines.indexOf('---', 1);
  if (end === -1) return;

  const upserts: Array<[RegExp, string]> = [];
  if (decision.type) upserts.push([/^type:/, `type: ${decision.type}`]);
  if (decision.confirmed) upserts.push([/^type_confirmed:/, 'type_confirmed: true']);
  if (decision.conflict) upserts.push([/^type_conflict:/, `type_conflict: ${decision.conflict}`]);

  const toInsert: string[] = [];
  for (const [pattern, line] of upserts) {
    let found = false;
    for (let i = 1; i < end; i++) {
      if (pattern.test(lines[i])) {
        lines[i] = line;
        found = true;
        break;
      }
    }
    if (!found) toInsert.push(line);
  }
  lines.splice(end, 0, ...toInsert);
  await ctx.createOrUpdateFile(pagePath, lines.join('\n'));
}
