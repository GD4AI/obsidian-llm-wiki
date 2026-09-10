// Fix runners — batch execution helpers for each lint fix phase.
// Extracted from lint-controller.ts to keep the orchestrator focused on
// detection, reporting, and callback wiring.

import { Notice, TFile } from 'obsidian';
import { LintContext } from './types';
import { TEXTS } from '../../texts';
import { PROMPTS } from '../../prompts';
import { parseJsonResponse } from '../../core/json';
import { detectRateLimitFailures, formatRateLimitNotice } from '../../core/rate-limit';
import { resolveModelForTask } from '../../core/model-resolver';
import { getActiveSourceTags } from '../../core/tag-vocab';
import { activeVocabulary, domainVocabulary } from '../../core/vocabulary';
import { mergeFrontmatterArrayField, replaceFrontmatterArrayField, parseFrontmatter } from '../../core/frontmatter';
import { renderTemplate } from '../../core/template-renderer';
import { TOKENS_LINT_ALIAS_BATCH, NOTICE_ERROR, NOTICE_RATE_LIMIT } from '../../constants';
import { buildWikiLanguageDirective } from '../system-prompts';
import { TagViolation } from './scanners';
import { AliasGenerationLLMSchema, TagFixLLMSchema } from '../../llm-sdk/output-schemas';
import { callLlm } from '../../core/llm-dispatch';

// Issue #94: Status bar "click to cancel" already exists, but the fix-runner
// functions in this module previously never received the AbortSignal. Each
// runner must check `signal.aborted` at entry and inside its loop. Without
// this, users could click the status bar during a long fix phase and the
// LLM calls inside the runners would keep running to completion.
function checkCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new DOMException('Lint cancelled by user', 'AbortError');
  }
}

// Returns a Notice-like object whose setMessage() also mirrors the text to the
// status bar. Keeps popup and status bar in sync without manual updateStatusBar
// calls at every progress site.
export function makeMirroredNotice(ctx: LintContext): { setMessage: (msg: string) => void; hide: () => void } {
  const notice = new Notice('', 0);
  return {
    setMessage(msg: string) {
      notice.setMessage(msg);
      ctx.wikiEngine.updateStatusBar(msg);
    },
    hide() { notice.hide(); ctx.wikiEngine.updateStatusBar(''); }
  };
}

export async function runAliasCompletion(
  ctx: LintContext,
  signal: AbortSignal | undefined,
  aliasDeficientPages: Array<{ path: string; content: string; basename: string }>,
): Promise<{ filled: number; results: string[] }> {
  checkCancelled(signal);
  const client = ctx.llmClient;
  if (!client) return { filled: 0, results: [] };

  const t = TEXTS[ctx.settings.language];
  const concurrency = ctx.settings.pageGenerationConcurrency ?? 1;
  const totalBatches = Math.ceil(aliasDeficientPages.length / concurrency);
  console.debug(`[Alias] Starting alias completion — ${aliasDeficientPages.length} pages, concurrency=${concurrency}, batches=${totalBatches}`);

  let filled = 0;
  const results: string[] = [];
  const fixNotice = new Notice('', 0);
  const aliasStartTime = Date.now();
  const aliasFailures: Array<{ name: string; reason: string }> = [];

  try {
    for (let i = 0; i < aliasDeficientPages.length; i += concurrency) {
    checkCancelled(signal);
    const batch = aliasDeficientPages.slice(i, i + concurrency);
    const batchNum = Math.floor(i / concurrency) + 1;
    const batchStartTime = Date.now();

    console.debug(`[Alias batch ${batchNum}/${totalBatches}] Processing ${batch.length} pages: ${batch.map(p => p.basename).join(', ')}`);

    const batchResults = await Promise.allSettled(
      batch.map(async (page) => {
        const pageRel = page.path.replace(ctx.settings.wikiFolder + '/', '').replace('.md', '');
        fixNotice.setMessage(t.lintAliasesFilling
          .replace('{current}', String(Math.min(i + batch.length, aliasDeficientPages.length)))
          .replace('{total}', String(aliasDeficientPages.length))
          .replace('{page}', page.basename));

        try {
          const bodyMatch = page.content.match(/^---[\s\S]*?\n---\n?([\s\S]*)/);
          const body = bodyMatch ? bodyMatch[1].trim() : '';

          const prompt = renderTemplate(PROMPTS.generateAliases, {
            title: page.basename,
            body: body.substring(0, 2000),
          });

          const aliasArgs = {
            task: 'lint-alias' as const,
            model: resolveModelForTask(ctx.settings, 'lint'),
            max_tokens: TOKENS_LINT_ALIAS_BATCH,
            system: buildWikiLanguageDirective(ctx.settings),
            messages: [{ role: 'user' as const, content: prompt }],
            // v1.26.3 PATCH Issue #443 expanded scope: typed-output path.
            // AliasGenerationLLMSchema ({aliases?: string[]}) on the wire as
            // Tier 0 json_schema — LMStudio accepts, no parse-error fallback
            // to empty alias list.
            response_format: { type: 'json_object' as const, schema: AliasGenerationLLMSchema },
          };
          const response = await callLlm(client, aliasArgs);

          // v1.24.0: Bug 3 — log provider + raw response shape BEFORE
          // parseJsonResponse so an empty / unparseable result is
          // attributable to either the provider (empty text) or our
          // parser (rejected text). Without this, the user only sees
          // "JSON parse completely failed (length 0)" with no context.
          console.debug(
            `[Alias] ${page.basename}: response type=${typeof response} ` +
            `length=${typeof response === 'string' ? response.length : 'N/A'} | ` +
            `provider=${client.constructor?.name ?? typeof client} | ` +
            `first200=${JSON.stringify((typeof response === 'string' ? response : '').slice(0, 200))}`
          );

          const parsed = await parseJsonResponse(response, undefined, { silentOnEmpty: true }) as { aliases?: string[] } | null;
          if (parsed?.aliases?.length) {
            console.debug(`[Alias] ${page.basename}: generated ${parsed.aliases.length} aliases → [${parsed.aliases.join(', ')}]`);

            // v1.24.0: Bug 2 — use the shared merge helper so we never
            // produce duplicate `aliases:` lines (the previous string-
            // splice approach inserted a second `aliases:` even when
            // the page already had `aliases: []`).
            const fmBefore = parseFrontmatter(page.content);
            const existingAliases = Array.isArray(fmBefore?.aliases) ? fmBefore.aliases : [];
            const updated = mergeFrontmatterArrayField(page.content, 'aliases', parsed.aliases);
            const fmAfter = parseFrontmatter(updated);
            const mergedAliases = Array.isArray(fmAfter?.aliases) ? fmAfter.aliases : [];
            const newAliases = mergedAliases.length - existingAliases.length;

            await ctx.app.vault.adapter.write(page.path, updated);
            results.push(`- [[${pageRel}]]: added ${newAliases} aliases (total ${mergedAliases.length})`);
            return { success: true, name: page.basename, count: newAliases };
          }
          // v1.24.0 Bug 3: when parseJsonResponse fails to extract aliases,
// surface the page basename + raw response shape via console.error
// (not just console.debug). The user needs to see which page failed
// without grepping through hundreds of LLM call logs.
const respStr = typeof response === 'string' ? response : '';
console.error(
  `[Alias] ${page.basename}: no aliases extracted | ` +
  `response length=${respStr.length} | ` +
  `provider=${client.constructor?.name ?? typeof client} | ` +
  `first100=${JSON.stringify(respStr.slice(0, 100))}`
);
return { success: false, name: page.basename, reason: 'No aliases generated' };
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          // Note: `response` is in the outer try scope, so we can't
          // reference it here. The pre-fix code already logged the
          // page name in console.error. The richer diagnostic (provider
          // name + raw response) is logged inside the try block above.
          console.error(`[Alias] ${page.basename}: generation failed — ${errMsg}`);
          new Notice(t.lintAliasesFillFailed.replace('{page}', page.basename).replace('{error}', errMsg), NOTICE_ERROR);
          return { success: false, name: page.basename, reason: errMsg };
        }
      })
    );

    let batchSuccess = 0;
    let batchFail = 0;
    for (const r of batchResults) {
      if (r.status === 'fulfilled' && r.value.success) {
        filled++;
        batchSuccess++;
      } else {
        batchFail++;
        const failureName = r.status === 'fulfilled' ? String(r.value.name || 'unknown') : 'promise-rejected';
        const failureReason = r.status === 'fulfilled' ? String(r.value.reason || 'unknown') :
          r.reason instanceof Error ? r.reason.message : String(r.reason || 'unknown');
        aliasFailures.push({ name: failureName, reason: failureReason });
        if (r.status === 'rejected') {
          console.error(`[Alias batch ${batchNum}] Promise rejected:`, r.reason);
        }
      }
    }

    const batchTime = Date.now() - batchStartTime;
    console.debug(`[Alias batch ${batchNum}/${totalBatches}] Done — success=${batchSuccess}, fail=${batchFail}, time=${batchTime}ms`);

    if (i + concurrency < aliasDeficientPages.length && (ctx.settings.batchDelayMs ?? 300) > 0) {
      await new Promise(resolve => window.setTimeout(resolve, ctx.settings.batchDelayMs ?? 300));
    }
  }
  } finally {
    fixNotice.hide();
  }

  // Rate-limit detection for alias completion
  const aliasRateInfo = detectRateLimitFailures(aliasFailures, concurrency, ctx.settings.batchDelayMs ?? 300);
  if (aliasRateInfo) {
    console.warn(`[Alias Rate Limit] ${aliasRateInfo.count} alias generation(s) failed with 429, ` +
      `suggested concurrency=${aliasRateInfo.suggestedConcurrency}, delay=${aliasRateInfo.suggestedDelay}ms`);
    new Notice(formatRateLimitNotice(aliasRateInfo, ctx.settings.language), NOTICE_RATE_LIMIT);
  }

  const totalTime = Date.now() - aliasStartTime;
  console.debug(`[Alias] All done — success=${filled}, fail=${aliasDeficientPages.length - filled}, totalTime=${totalTime}ms`);
  return { filled, results };
}

export async function runDeadLinkFixes(
  ctx: LintContext,
  signal: AbortSignal | undefined,
  deadLinks: Array<{ source: string; target: string }>,
): Promise<{ fixed: number; results: string[] }> {
  checkCancelled(signal);
  const t = TEXTS[ctx.settings.language];
  const seen = new Set<string>();
  const unique = deadLinks.filter(dl => {
    const key = `${dl.source}::${dl.target}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  let fixed = 0;
  const results: string[] = [];
  const fixNotice = new Notice('', 0);
  // v1.25.10 PATCH Issue #367 P0-1 — batch with the same concurrency
  // setting as the alias runner so the wall-clock on a 2000-page vault
  // drops roughly by `(n / concurrency)`. Each batch runs the items
  // through `Promise.allSettled` so a single failure never poisons the
  // rest. The for-loop shape (vs a flat Promise.all) keeps progress
  // notices bound to a single batch at a time, matching alias runner.
  const concurrency = Math.max(1, ctx.settings.pageGenerationConcurrency ?? 1);
  const totalBatches = Math.ceil(unique.length / concurrency);
  console.debug(`[DeadLink] Starting dead-link fix — ${unique.length} links, concurrency=${concurrency}, batches=${totalBatches}`);
  try {
    for (let i = 0; i < unique.length; i += concurrency) {
      checkCancelled(signal);
      const batch = unique.slice(i, i + concurrency);
      const batchStart = i;
      const batchResults = await Promise.allSettled(batch.map(async (dl, idx) => {
        const batchIdx = batchStart + idx;
        fixNotice.setMessage(t.lintFixProgress.replace('{current}', String(batchIdx + 1)).replace('{total}', String(unique.length)).replace('{target}', dl.target));
        console.debug(`lintFix: dead link ${batchIdx + 1}/${unique.length}: ${dl.source} -> ${dl.target}`);
        const sourcePath = `${ctx.settings.wikiFolder}/${dl.source}.md`;
        const result = await ctx.wikiEngine.fixDeadLink(sourcePath, dl.target);
        console.debug(`Dead link fix: ${dl.source} -> ${dl.target}: ${result}`);
        if (!result.includes(t.lintFixNoAction) && !result.startsWith('left as dead link')) {
          return { source: dl.source, target: dl.target, result };
        }
        return null;
      }));
      for (let j = 0; j < batchResults.length; j++) {
        const r = batchResults[j];
        if (r.status === 'fulfilled' && r.value) {
          fixed++;
          results.push(`- [[${r.value.source}]]: \`[[${r.value.target}]]\` → ${r.value.result}`);
        } else if (r.status === 'rejected') {
          const dl = batch[j];
          console.error(`Failed to fix dead link: ${dl.source} -> ${dl.target}`, r.reason);
          const errMsg = r.reason instanceof Error ? r.reason.message : String(r.reason);
          new Notice(t.lintFixItemFailed.replace('{target}', dl.target).replace('{error}', errMsg), NOTICE_ERROR);
        }
      }
    }
  } finally {
    // Simplify Phase 1.3: dismiss the persistent Notice even on AbortError,
    // otherwise it stays on the status bar forever (zero-timeout Notice).
    fixNotice.hide();
  }
  return { fixed, results };
}

export async function runEmptyPageFixes(
  ctx: LintContext,
  signal: AbortSignal | undefined,
  emptyPages: Array<{ path: string; content: string }>,
): Promise<{ filled: number; results: string[] }> {
  checkCancelled(signal);
  const t = TEXTS[ctx.settings.language];
  let filled = 0;
  const results: string[] = [];
  const fixNotice = new Notice('', 0);
  // v1.25.10 PATCH Issue #367 P0-1 — mirror runAliasCompletion batch:
  // slice into chunks of pageGenerationConcurrency and resolve each
  // batch through Promise.allSettled so a single failure never poisons
  // the rest. concurrency=1 (default) preserves v1.25.9 behaviour.
  const concurrency = Math.max(1, ctx.settings.pageGenerationConcurrency ?? 1);
  const totalBatches = Math.ceil(emptyPages.length / concurrency);
  console.debug(`[EmptyPage] Starting empty-page fix — ${emptyPages.length} pages, concurrency=${concurrency}, batches=${totalBatches}`);
  try {
    for (let i = 0; i < emptyPages.length; i += concurrency) {
      checkCancelled(signal);
      const batch = emptyPages.slice(i, i + concurrency);
      const batchIdx = i;
      const batchResults = await Promise.allSettled(batch.map(async (ep, idx) => {
        const currentIdx = batchIdx + idx;
        fixNotice.setMessage(t.lintFillProgress
          .replace('{current}', String(currentIdx + 1))
          .replace('{total}', String(emptyPages.length))
          .replace('{page}', ep.path));
        console.debug(`lintFix: fill empty page ${currentIdx + 1}/${emptyPages.length}: ${ep.path}`);
        const summary = await ctx.wikiEngine.fillEmptyPage(ep.path, ep.content);
        return { ep, summary };
      }));
      for (let j = 0; j < batchResults.length; j++) {
        const r = batchResults[j];
        if (r.status === 'fulfilled') {
          filled++;
          results.push(`- ${r.value.summary}`);
        } else {
          const ep = batch[j];
          const errMsg = r.reason instanceof Error ? r.reason.message : String(r.reason);
          console.error(`Failed to expand empty page: ${ep.path}`, r.reason);
          new Notice(t.lintFillFailed.replace('{page}', ep.path).replace('{error}', errMsg), NOTICE_ERROR);
        }
      }
    }
  } finally {
    fixNotice.hide();
  }
  return { filled, results };
}

export async function runOrphanFixes(
  ctx: LintContext,
  signal: AbortSignal | undefined,
  orphans: string[],
): Promise<{ linked: number; results: string[] }> {
  checkCancelled(signal);
  const t = TEXTS[ctx.settings.language];
  const results: string[] = [];
  const fixNotice = new Notice('', 0);
  // v1.25.10 PATCH Issue #367 P0-1 — see runEmptyPageFixes above.
  const concurrency = Math.max(1, ctx.settings.pageGenerationConcurrency ?? 1);
  const totalBatches = Math.ceil(orphans.length / concurrency);
  console.debug(`[Orphan] Starting orphan link fix — ${orphans.length} pages, concurrency=${concurrency}, batches=${totalBatches}`);
  try {
    for (let i = 0; i < orphans.length; i += concurrency) {
      checkCancelled(signal);
      const batch = orphans.slice(i, i + concurrency);
      const batchIdx = i;
      const batchResults = await Promise.allSettled(batch.map(async (orphan, idx) => {
        const currentIdx = batchIdx + idx;
        const opRel = orphan.replace(ctx.settings.wikiFolder + '/', '').replace('.md', '');
        fixNotice.setMessage(t.lintLinkProgress
          .replace('{current}', String(currentIdx + 1))
          .replace('{total}', String(orphans.length))
          .replace('{page}', opRel));
        console.debug(`lintFix: link orphan ${currentIdx + 1}/${orphans.length}: ${orphan}`);
        const linkedPages = await ctx.wikiEngine.linkOrphanPage(orphan);
        return { orphan, opRel, linkedPages };
      }));
      for (let j = 0; j < batchResults.length; j++) {
        const r = batchResults[j];
        if (r.status === 'fulfilled') {
          const { opRel, linkedPages } = r.value;
          if (linkedPages.length > 0) {
            results.push(`- [[${opRel}]] linked from: ${linkedPages.map(p => `[[${p}]]`).join(', ')}`);
          } else {
            results.push(`- [[${opRel}]]: no suitable linking targets found`);
          }
        } else {
          const orphan = batch[j];
          const opRel = orphan.replace(ctx.settings.wikiFolder + '/', '').replace('.md', '');
          const errMsg = r.reason instanceof Error ? r.reason.message : String(r.reason);
          console.error(`Failed to link orphan: ${orphan}`, r.reason);
          new Notice(t.lintLinkItemFailed.replace('{page}', opRel).replace('{error}', errMsg), NOTICE_ERROR);
        }
      }
    }
  } finally {
    fixNotice.hide();
  }
  return { linked: results.length, results };
}

export async function runDuplicateMerges(
  ctx: LintContext,
  signal: AbortSignal | undefined,
  duplicates: Array<{ target: string; source: string; reason: string }>,
): Promise<{ merged: number; results: string[] }> {
  checkCancelled(signal);
  const t = TEXTS[ctx.settings.language];
  let merged = 0;
  const results: string[] = [];
  const fixNotice = new Notice('', 0);
  // v1.25.10 PATCH Issue #367 P0-1 — see runEmptyPageFixes above.
  const concurrency = Math.max(1, ctx.settings.pageGenerationConcurrency ?? 1);
  const totalBatches = Math.ceil(duplicates.length / concurrency);
  console.debug(`[DuplicateMerge] Starting duplicate merges — ${duplicates.length} pairs, concurrency=${concurrency}, batches=${totalBatches}`);
  try {
    for (let i = 0; i < duplicates.length; i += concurrency) {
      checkCancelled(signal);
      const batch = duplicates.slice(i, i + concurrency);
      const batchIdx = i;
      const batchResults = await Promise.allSettled(batch.map(async (d, idx) => {
        const currentIdx = batchIdx + idx;
        const sourceRel = d.source.replace(ctx.settings.wikiFolder + '/', '').replace('.md', '');
        const targetRel = d.target.replace(ctx.settings.wikiFolder + '/', '').replace('.md', '');
        fixNotice.setMessage(t.lintMergeProgress
          .replace('{current}', String(currentIdx + 1))
          .replace('{total}', String(duplicates.length))
          .replace('{source}', sourceRel)
          .replace('{target}', targetRel));
        console.debug(`lintFix: merge duplicates ${currentIdx + 1}/${duplicates.length}: ${d.source} → ${d.target}`);
        const result = await ctx.wikiEngine.mergeDuplicatePages(d.target, d.source);
        return { d, result };
      }));
      for (let j = 0; j < batchResults.length; j++) {
        const r = batchResults[j];
        if (r.status === 'fulfilled') {
          const { d, result } = r.value;
          merged++;
          results.push(`- ${d.source} → ${d.target}: ${result}`);
        } else {
          const d = batch[j];
          const sourceRel = d.source.replace(ctx.settings.wikiFolder + '/', '').replace('.md', '');
          const targetRel = d.target.replace(ctx.settings.wikiFolder + '/', '').replace('.md', '');
          const errMsg = r.reason instanceof Error ? r.reason.message : String(r.reason);
          console.error(`Failed to merge duplicates: ${d.source} → ${d.target}`, r.reason);
          new Notice(t.lintMergeItemFailed.replace('{source}', sourceRel).replace('{target}', targetRel).replace('{error}', errMsg), NOTICE_ERROR);
        }
      }
    }
  } finally {
    fixNotice.hide();
  }
  return { merged, results };
}

// ── runRetagViolations (Issue #85 v7) ────────────────────────────

/**
 * Issue #85 v7: LLM-assisted retag for pages whose frontmatter `tags`
 * array contains values outside the active vocabulary. The LLM is
 * given the page's name + first paragraph (summary) + the active
 * vocabulary, and asked to return a new `tags: string[]` that
 * best describes the page using ONLY values from the vocabulary.
 * Body is never touched — only the `tags:` line in the frontmatter
 * is rewritten via enforceFrontmatterConstraints.
 *
 * The LLM call goes through the shared `ctx.buildSystemPrompt('lint')`
 * composer (when available) so the system layer carries the language
 * directive + Active Tag Vocabulary section, matching every other
 * lint LLM call site. Pre-#328-Phase-1-follow-up the helper
 * `appendTagVocabularyToPrompt()` injected the section into the user
 * prompt here; #328 Phase 1 follow-up (PRX-A2) deduplicated the
 * injection by moving it to the system layer.
 *
 * Per-page loop (not batched). Each retag is a small, independent
 * LLM call. Issue #94 cancel propagation: the runner checks
 * `signal.aborted` before each iteration and at the top of every
 * await.
 */
export async function runRetagViolations(
  ctx: LintContext,
  signal: AbortSignal | undefined,
  violations: TagViolation[],
): Promise<{ fixed: number; results: string[] }> {
  if (signal?.aborted) {
    throw new DOMException('Lint fix cancelled by user', 'AbortError');
  }
  if (!ctx.llmClient) {
    return { fixed: 0, results: ['LLM client not initialized; retag skipped.'] };
  }
  const t = TEXTS[ctx.settings.language];
  const llmClient = ctx.llmClient;
  const fixNotice = new Notice(t.lintTagViolationFiring
    .replace('{current}', '0')
    .replace('{total}', String(violations.length))
    .replace('{path}', ''), 0);

  const results: string[] = [];
  let fixed = 0;
  // v1.25.10 PATCH Issue #367 P0-1 — mirror the other fix-runners.
  // Even though retag fans out to one LLM call per violation, those
  // calls are independent and `ctx.buildSystemPrompt` is async-cache-
  // friendly. Slicing into concurrency-sized chunks keeps the LLM
  // token-budget ceiling per batch predictable (the 256-token output
  // cap on each LLM call means peak inflight scales with
  // pageGenerationConcurrency, not with the violation count).
  const concurrency = Math.max(1, ctx.settings.pageGenerationConcurrency ?? 1);
  const totalBatches = Math.ceil(violations.length / concurrency);
  console.debug(`[Retag] Starting retag — ${violations.length} violations, concurrency=${concurrency}, batches=${totalBatches}`);
  try {
    for (let i = 0; i < violations.length; i += concurrency) {
      checkCancelled(signal);
      const batch = violations.slice(i, i + concurrency);
      const batchIdx = i;
      const batchResults = await Promise.allSettled(batch.map(async (v, idx) => {
        const currentIdx = batchIdx + idx;
        fixNotice.setMessage(t.lintTagViolationFiring
          .replace('{current}', String(currentIdx + 1))
          .replace('{total}', String(violations.length))
          .replace('{path}', v.path));

        // Read the current page content. The Obsidian API is
        // `Vault.read(file: TFile)` — TFile itself does not have a
        // `read()` method (this is a common mistake; TFile extends
        // TAbstractFile which has only metadata, not content). The
        // previous code called `tfile.read()` and produced
        // "tfile.read is not a function" at runtime, which is what
        // blew up the user's "Retag" button. The mock tests in
        // fix-runners.test.ts passed because the mock provided its
        // own `.read()` — a textbook shell test that did not
        // exercise the real production code path. The fix is the
        // correct call below; the new shell-test guard
        // ("TFile.read mock does not match real Obsidian TFile") is
        // added to fix-runners.test.ts to prevent regression.
        const file = ctx.app.vault.getAbstractFileByPath(v.path);
        if (!file) {
          return { v, kind: 'missing' as const };
        }
        // TFile is the concrete subclass of TAbstractFile that holds
        // vault-readable content. Use instanceof TFile to distinguish
        // TFile from TFolder — this satisfies the obsidianmd/
        // no-tfile-tfolder-cast lint rule while being type-safe.
        // Real Obsidian TFile passes this check in production;
        // the test mock (new TFile() with Object.assign) also passes
        // because vitest hoists TFile to the same class reference.
        if (!(file instanceof TFile)) {
          return { v, kind: 'notfile' as const };
        }
        // Read via ctx.app.vault.read(file) — the correct Obsidian API
        // for reading a file by TFile. vault.cachedRead() is also
        // available but we want fresh content (the LLM must see
        // the current frontmatter, not a cached snapshot from a
        // prior render).
        const content = await ctx.app.vault.read(file);
        // Body preview for the LLM: only the first ~400 chars of the
        // post-frontmatter body, so we don't waste tokens on a long wiki
        // page. The LLM just needs the gist to pick the right tags.
        const fmEnd = content.indexOf('\n---\n', 3);
        const body = fmEnd === -1 ? content : content.substring(fmEnd + 5);
        const bodyPreview = body.slice(0, 400).replace(/\n+/g, ' ').trim();

        // Active vocabulary for the page's type
        // One vocabulary (vocabulary.ts) — the same list the system prompt
        // below renders and the write gate enforces. A source page carries
        // the closed form list next to the `Group/Value` view of it; the flat
        // identity types belong to entity and concept pages.
        const validVocab = v.pageType === 'entity' || v.pageType === 'concept'
          ? activeVocabulary(ctx.app, ctx.settings, v.pageType)
          : [...getActiveSourceTags(ctx.settings), ...domainVocabulary(ctx.app, ctx.settings)];

        // #328 Phase 1 follow-up: the active tag vocabulary section is now
        // injected exactly once per LLM call at the system layer (by the
        // shared buildSystemPrompt composer) — mirroring every other
        // lint LLM call. The previous user-layer `appendTagVocabularyToPrompt`
        // produced a double-inject with the system layer (see PR #332),
        // and was the helper's last remaining caller.
        const prompt = `You are retagging a wiki page whose current tags fall outside the active vocabulary.

Page name: ${v.title}
Page type: ${v.pageType}
Current tags (some are invalid): [${v.currentTags.join(', ')}]
Invalid tags: [${v.invalidTags.join(', ')}]

Page summary (first 400 chars of body):
${bodyPreview}

Task: Return a JSON object with a single field "tags" that is an array of strings.
- Each value MUST be one of the allowed values listed in the Active Tag Vocabulary section of the system prompt.
- The values should be the closest valid matches for what this page is actually about.
- Do NOT include any other fields. Do NOT include any explanatory text.
- If the page is genuinely about nothing in the vocabulary, return an empty array.
`;

        const systemPrompt = ctx.buildSystemPrompt ? await ctx.buildSystemPrompt('lint') : undefined;
        const tagArgs = {
          task: 'lint-tag-fix' as const,
          model: resolveModelForTask(ctx.settings, 'lint'),
          max_tokens: 256,
          ...(systemPrompt ? { system: systemPrompt } : {}),
          messages: [{ role: 'user' as const, content: prompt }],
          // v1.26.3 PATCH Issue #443 expanded scope: typed-output path.
          // TagFixLLMSchema ({tags?: string[]}) on the wire as Tier 0
          // json_schema. The caller still filters against the active tag
          // vocab post-parse; the schema only constrains the wire shape.
          response_format: { type: 'json_object' as const, schema: TagFixLLMSchema },
        };
        const response = await callLlm(llmClient, tagArgs);
        if (signal?.aborted) {
          throw new DOMException('Lint fix cancelled by user', 'AbortError');
        }
        const parsed = await parseJsonResponse(response, undefined, { silentOnEmpty: true }) as { tags?: string[] } | null;
        const newTags = Array.isArray(parsed?.tags)
          ? parsed.tags.map(t => String(t).trim()).filter(t => t.length > 0)
          : [];
        // Final safety: every returned tag MUST be in the active vocab.
        // (LLM may occasionally slip a non-vocab value.)
        const safeNewTags = newTags.filter(t => validVocab.includes(t));

        if (safeNewTags.length === 0) {
          return { v, kind: 'noop' as const, message: `${v.path}: LLM kept no tags (no valid match)` };
        }
        if (safeNewTags.length === v.currentTags.length &&
            safeNewTags.every(t => v.currentTags.includes(t))) {
          // No-op: the LLM returned the same tags we already had.
          return { v, kind: 'noop' as const, message: `${v.path}: no change` };
        }

        // v1.24.0: use the shared REPLACE helper (full replacement
        // semantic — retag rewrites the entire tags array, doesn't
        // append). The previous regex `/tags:\s*\[[^\]]*\]/` only
        // matched inline-style tags — block-style tags
        // (`tags:\n  - x`) were silently not rewritten, leaving the
        // LLM's retag un-applied. The replace helper also handles the
        // block-style case correctly.
        const updated = replaceFrontmatterArrayField(content, 'tags', safeNewTags);
        await ctx.app.vault.adapter.write(v.path, updated);
        return {
          v,
          kind: 'fixed' as const,
          message: `${v.path}: [${v.currentTags.join(', ')}] → [${safeNewTags.join(', ')}]`,
        };
      }));
      for (let j = 0; j < batchResults.length; j++) {
        const r = batchResults[j];
        if (r.status === 'rejected') {
          const v = batch[j];
          const e: unknown = r.reason;
          if (e instanceof DOMException && e.name === 'AbortError') throw e;
          const errMsg = e instanceof Error ? e.message : String(e);
          // console.error so the user sees the full stack in DevTools
          // (Ctrl+Shift+I). Notice alone truncates the error message
          // and gives no recovery info — that was the bug reported
          // when "Retag failed for X: tfile.read is not a function"
          // appeared with no other diagnostic output. We include the
          // page type + violation context for debugging.
          console.error(
            `[runRetagViolations] ${v.path} (${v.pageType}) failed:`,
            e
          );
          results.push(`${v.path}: ${errMsg}`);
          new Notice(t.lintTagViolationFailed.replace('{path}', v.path).replace('{error}', errMsg), NOTICE_ERROR);
          continue;
        }
        const val = r.value;
        if (val.kind === 'missing') {
          results.push(`${val.v.path}: file not found`);
        } else if (val.kind === 'notfile') {
          results.push(`${val.v.path}: not a regular file`);
        } else if (val.kind === 'noop') {
          results.push(val.message);
        } else {
          // kind === 'fixed'
          fixed++;
          results.push(val.message);
        }
      }
    }
  } finally {
    fixNotice.hide();
  }
  return { fixed, results };
}
