// Lint Controller — Wiki health analysis and fix orchestration.
// Extracted from main.ts to keep the plugin entry point manageable.
//
// Modular split (v1.18.3+ → v1.24.0):
//   - lint/types.ts: shared LintPhaseContext + findings interfaces
//   - lint/phases/preparation.ts: page read + double-nested fix + sources normalize
//   - lint/phases/programmatic.ts: alias/empty/orphan/tag/polluted/dead links/quote grounding
//   - lint/llm-phases/dedup-phase.ts: LLM-assisted duplicate detection (extracted v1.24.0)
//   - lint/llm-phases/contradiction-phase.ts: open-record report (extracted v1.24.0)
//   - lint/llm-phases/analysis-phase.ts: LLM health analysis (extracted v1.24.0)
//   - lint/report-builder.ts: pure-function report markdown builder
//   - lint/fix-runners.ts: per-phase fix executors
//   - lint/scanners.ts: pure-function scanners
//
// v1.24.0: dedup / contradiction / analysis phases were extracted from the
// 959-LOC runLintWiki() god function into dedicated modules under
// `llm-phases/`. Each phase receives a `LintPhaseContext` and returns a
// pure-data result, mirroring the existing preparation / programmatic
// phase pattern. runLintWiki() is now a 230-LOC orchestrator that
// sequences the phases and builds the fix-callback dispatch.

import { Notice } from 'obsidian';
import { LintFixCallbacks, LintCounts, LintReportModal, FixReportPhase } from '../../ui/modals';
import { TEXTS } from '../../texts';
import { getText } from '../../core/i18n';
import { nestReportUnderParent } from '../../core/report';
import { isPageEmpty } from './utils';
import { runAliasCompletion, runDeadLinkFixes, runEmptyPageFixes, runOrphanFixes, runDuplicateMerges, runRetagViolations, makeMirroredNotice } from './fix-runners';
import { buildLintAnalysisContext } from './lint-analysis-context';
import { buildGraphFromContent } from '../../core/build-graph';
import { runPreparationPhase } from './phases/preparation';
import { runProgrammaticPhase } from './phases/programmatic';
import { runDedupPhase } from './llm-phases/dedup-phase';
import { runContradictionPhase } from './llm-phases/contradiction-phase';
import { buildLintReport } from './report-builder';
import { LintContext, LintPhaseContext, ProgrammaticFindings } from './types';
import { NOTICE_NORMAL, NOTICE_ERROR } from '../../constants';
import { SchemaTask } from '../../schema/schema-manager';

// Re-export LintContext for back-compat — external callers (e.g. main.ts,
// ui/modals/ indirect import) still reference `LintContext` from this file.
export type { LintContext } from './types';

export async function runLintWiki(
  ctx: LintContext,
  signal?: AbortSignal,
  // v1.22.6 #204: distinguish auto (periodic / scheduled) vs manual lint
  // so the completion modal-vs-Notice dispatch can respect user intent.
  // Defaults to 'manual' for backward compatibility.
  trigger: 'auto' | 'manual' = 'manual',
): Promise<void> {
  if (!ctx.llmClient) {
    new Notice(TEXTS[ctx.settings.language].errorNoApiKey);
    return;
  }

  const checkCancelled = () => {
    if (signal?.aborted) {
      throw new DOMException('Lint cancelled by user', 'AbortError');
    }
  };

  new Notice(TEXTS[ctx.settings.language].lintWikiStart);
  const lintStartTime = Date.now();

  const stageNotice = new Notice('', 0);

  try {
    // v1.24.0 B3: closure getter so settings changes (e.g. flipping API
    // key in Settings tab during a long lint run) are picked up by the
    // next phase call. Replaces the snapshot `llmClient: ctx.llmClient`
    // that was caught by the v1.24.0 review.
    const phaseCtx: LintPhaseContext = {
      app: ctx.app,
      settings: ctx.settings,
      llmClient: () => ctx.llmClient,
      wikiEngine: ctx.wikiEngine,
      checkCancelled,
      stageNotice,
      totalPages: 0,
      // v1.24.0: expose the shared system-prompt composer so LLM-assisted
      // lint phases inject the same language directive + schema context +
      // active tag vocabulary that the fix-runners receive.
      buildSystemPrompt: (task: string) => ctx.wikiEngine.buildSystemPrompt(task as SchemaTask),
    };

    // ---- Phase 1: Preparation (read pages, fix links, normalize sources) ----
    const prep = await runPreparationPhase(phaseCtx);
    phaseCtx.totalPages = prep.wikiFiles.length;

    // ---- Build wiki-link graph (v1.23.0 P1-6, for hub-link density scanner) ----
    // Pure function: derives edges from in-memory pageMap. No IO.
    const allPaths = new Set<string>(prep.pageMap.keys());
    const loadedPages = Array.from(prep.pageMap.values()).map(p => ({
      path: p.path,
      content: p.content,
    }));
    const graph = buildGraphFromContent(loadedPages, allPaths, ctx.settings.wikiFolder);

    // ---- Phase 2: Programmatic + source-IO checks ----
    // #496: async now — cited primary notes are read here so quote grounding
    // runs against underlying documents, not generated summaries.
    const findings: ProgrammaticFindings = await runProgrammaticPhase(phaseCtx, {
      wikiFiles: prep.wikiFiles,
      pageMap: prep.pageMap,
      knownTargets: prep.knownTargets,
      knownTargetsLower: prep.knownTargetsLower,
      graph,
    });
    findings.sourcesNormalizedFiles = prep.sourcesNormalizedFiles;
    findings.sourcesNormalizedEntries = prep.sourcesNormalizedEntries;
    findings.doubleNestFixes = prep.doubleNestFixes;

    const wikiFiles = prep.wikiFiles;
    const pageMap = prep.pageMap;
    const t = TEXTS[ctx.settings.language];

    // Extract findings from programmatic phase
    const aliasDeficientPages = findings.aliasDeficientPages;
    const orphans = findings.orphans;
    const tagViolations = findings.tagViolations;
    const pollutedPages = findings.pollutedPages;
    const deadLinks = findings.deadLinks;
    const ungroundedQuotes = findings.ungroundedQuotes;
    // emptyPages initialized empty; populated below after we know duplicate paths
    const emptyPages: Array<{ path: string; content: string }> = [];

    // ---- 3. LLM-assisted checks (high latency / token cost) ----
    //
    // v1.24.0: extracted to lint/llm-phases/dedup-phase.ts.
    // Behavior is identical to the previous inline implementation; see
    // that file for the tier-classification + rate-limit details.
    //
    // v1.25.1 Phase F1 (closes controller.ts:151 TODO from v1.18.0+):
    // dedup-phase.ts already runs batches in parallel with concurrency
    // limit (see `for (let i = 0; i < batches.length; i += concurrency)`
    // + `Promise.allSettled` at dedup-phase.ts:197-282). The roadmap
    // items (a-d) below remain future work — open question for v1.26.0
    // lint perf opening (ROADMAP §v1.26.0 row 3).
    //
    // Historical TODO (now resolved for parallel batches; remaining items
    // deferred to v1.26.0):
    //   a. Hash-bucket dedup: hash titles (n-gram or phonetic) and only LLM-verify
    //      pairs that share a bucket. Reduces Tier 1 pair count by 5-10x.
    //   b. Embedding-based prefilter: use a local embedding model to compute
    //      Tier 2 candidate pairs, replace the title-similarity heuristic.
    //   c. Cache LLM verify results in a per-lint-run memo so re-runs don't
    //      re-verify unchanged pairs.
    //   d. Skip the second LLM pass if the Tier 1 confidence score is below
    //      a threshold AND no new entries appeared since the last lint.
    //
    // See ROADMAP.md "Lint performance" section for the larger picture.
    const duplicates = await runDedupPhase(
      phaseCtx,
      { wikiFiles, pageMap },
      checkCancelled,
    );

    // ---- 3.5 Build empty-page list now that duplicates are known ----
    const emptyPageDuplicates = new Set<string>();
    for (const d of duplicates) {
      emptyPageDuplicates.add(d.target);
      emptyPageDuplicates.add(d.source);
    }

    for (const { path, content } of pageMap.values()) {
      // Skip if this page is a duplicate source (will be deleted after merge)
      if (emptyPageDuplicates.has(path)) continue;
      if (isPageEmpty(content)) {
        emptyPages.push({path, content});
      }
    }

    // ---- 4. Contradiction scanning (LLM-assisted / mixed) ----
    //
    // v1.24.0: extracted to lint/llm-phases/contradiction-phase.ts.
    // Behavior is identical to the previous inline implementation; see
    // that file for the report-render details.
    //
    // v1.27.x audit (Phase 3 T3-1): the contradiction phase now runs
    // BEFORE the report is built. Historically it ran after a throwaway
    // buildLintReport call whose output was stripped (extractProgReport)
    // for the LLM analysis prompt — deleted in v1.26.4 #473. With that
    // consumer gone, the strip-then-re-add round-trip (and the duplicate
    // summaryText / aliasPre re-derivation in this file) is dead weight:
    // the builder already emits `# title + summary + aliasPre + body` in
    // one pass. One call, real elapsed time, contradictions appended.
    const findingsWithEmpty: ProgrammaticFindings = {
      ...findings,
      emptyPages,
    };
    const { report: contradictionsReport } = await runContradictionPhase(phaseCtx);

    // ---- 5. Build the full report (delegated to report-builder) ----
    // Measure elapsed wall time since runLintWiki started. Round to whole
    // seconds for the user-facing summary; sub-second precision is noise here.
    const elapsedSeconds = Math.max(1, Math.round((Date.now() - lintStartTime) / 1000));
    const fullReport = buildLintReport({
      settings: ctx.settings,
      findings: findingsWithEmpty,
      duplicates,
      contradictionsReport,
      elapsedSeconds,
      totalPages: wikiFiles.length,
    });

    // v1.24.0: removed the v1.18.0-era "Missing Concept Pages tracker" TODO
    // (24 lines of design notes that had been parked here since 2026-07 and
    // never implemented). If/when the missing-concept-pages feature is
    // designed, see ROADMAP.md for the placeholder.

    const counts: LintCounts = {
      deadLinks: deadLinks.length,
      emptyPages: emptyPages.length,
      pollutedPages: pollutedPages.length,
      orphans: orphans.length,
      duplicates: duplicates.length,
      pagesMissingAliases: aliasDeficientPages.length,
      tagViolations: tagViolations.length,
      ungroundedQuotes: ungroundedQuotes.length,
    };

    // ---- Build callbacks ----

    // Issue #94 regression: each fix phase is its own lint operation
    // lifecycle so the status-bar cancel affordance persists throughout
    // the fix. The modal closes immediately (preserving original UX);
    // the user gets a top-right progress notice from the fix runner +
    // the bottom-right status bar for cancellation.
    const runFixPhase = async (fn: (signal: AbortSignal | undefined) => Promise<void>) => {
      const signal = ctx.wikiEngine.startLintOperation();
      try {
        await fn(signal);
      } finally {
        ctx.wikiEngine.endLintOperation();
      }
    };

    const fixCallbacks: LintFixCallbacks = {};
    // v1.22.0 #97: build a compact lint analysis summary from the
    // findings so the LLM schema suggestion prompt receives real data
    // (orphan counts, dead links, etc.) instead of the hardcoded
    // string 'Wiki lint analysis'. The summary is ~100 tokens and
    // fits comfortably in the LLM's context window.
    const lintSummary = buildLintAnalysisContext({
      orphanCount: orphans.length,
      deadLinkCount: deadLinks.length,
      pollutedPageCount: pollutedPages.length,
      tagViolationCount: tagViolations.length,
      duplicateCount: duplicates.length,
      ungroundedQuoteCount: ungroundedQuotes.length,
      emptyPageCount: emptyPages.length,
      contradictionReport: contradictionsReport,
      sampleOrphans: orphans.slice(0, 5),
      sampleDeadLinks: deadLinks.slice(0, 5).map(dl => dl.target),
      sampleTagViolations: tagViolations.slice(0, 5).map(tv => tv.path),
      hubLinkDensityCount: findings.hubLinkDensityIssues.length,
      sampleHubLinkDensity: findings.hubLinkDensityIssues.slice(0, 3).map(h => h.pagePath),
      totalWikiPages: wikiFiles.length,
    });
    fixCallbacks.onAnalyzeSchema = () => { void ctx.onAnalyzeSchema(lintSummary); };

    // Polluted page repair (structural root cause — similar to aliases)
    if (pollutedPages.length > 0) {
      fixCallbacks.onFixPollutedPages = () => {
        void runFixPhase(async (signal) => {
          let fixed = 0;
          const fixNotice = makeMirroredNotice(ctx);
          try {
            for (const pp of pollutedPages) {
              if (signal?.aborted) break;
              fixNotice.setMessage(t.lintFixingPolluted
                .replace('{current}', String(fixed + 1))
                .replace('{total}', String(pollutedPages.length))
                .replace('{title}', pp.title)
                .replace('{newTitle}', pp.cleanTitle));
              try {
                await ctx.wikiEngine.fixPollutedPage(pp.path, pp.cleanTitle);
                fixed++;
              } catch (e) {
                console.error(`[Pollution Fix] Failed: ${pp.path}`, e);
              }
            }
            if (fixed > 0) {
              await ctx.wikiEngine.generateIndexFromEngine();
            }
            const msg = getText(ctx.settings.language, 'lintPollutedFixed')
              .replace('{fixed}', String(fixed))
              .replace('{total}', String(pollutedPages.length));
            new Notice(msg, NOTICE_NORMAL);
          } finally {
            fixNotice.hide();
          }
        });
      };
    }

    // Alias completion (runs first — improves duplicate detection for future Lint runs)
    if (aliasDeficientPages.length > 0) {
      fixCallbacks.onCompleteAliases = () => {
        void runFixPhase(async (signal) => {
          const { filled, results } = await runAliasCompletion(ctx, signal, aliasDeficientPages);
          if (filled > 0) {
            await ctx.wikiEngine.generateIndexFromEngine();
            await ctx.wikiEngine.logLintFix('Complete Aliases', results.join('\n'));
          }
          const msg = t.lintAliasesFilled.replace('{filled}', String(filled)).replace('{total}', String(aliasDeficientPages.length))
            + (filled > 0 ? '\n' + t.lintFixIndexUpdated : '');
          new Notice(msg, NOTICE_NORMAL);
        });
      };
    }

    if (deadLinks.length > 0) {
      fixCallbacks.onFixDeadLinks = () => {
        void runFixPhase(async (signal) => {
          const { fixed, results } = await runDeadLinkFixes(ctx, signal, deadLinks);
          if (fixed > 0) {
            await ctx.wikiEngine.generateIndexFromEngine();
            await ctx.wikiEngine.logLintFix('Fix Dead Links', results.join('\n'));
          }
          const msg = t.lintFixDeadComplete.replace('{fixed}', String(fixed)).replace('{total}', String(deadLinks.length))
            + (fixed > 0 ? '\n' + t.lintFixIndexUpdated : '');
          new Notice(msg, NOTICE_NORMAL);
        });
      };
    }

    if (emptyPages.length > 0) {
      fixCallbacks.onFillEmptyPages = () => {
        void runFixPhase(async (signal) => {
          const { filled, results } = await runEmptyPageFixes(ctx, signal, emptyPages);
          if (filled > 0) {
            await ctx.wikiEngine.generateIndexFromEngine();
            await ctx.wikiEngine.logLintFix('Expand Empty Pages', results.join('\n'));
          }
          const msg = t.lintFillComplete.replace('{filled}', String(filled)).replace('{total}', String(emptyPages.length))
            + (filled > 0 ? '\n' + t.lintFixIndexUpdated : '');
          new Notice(msg, NOTICE_NORMAL);
        });
      };
    }

    // Issue #103: independent delete action (not a fix phase) — always available
    fixCallbacks.onDeleteEmptyStubs = () => {
      void runFixPhase(async (signal) => {
        const result = await ctx.wikiEngine.deleteEmptyStubs(ctx.settings.wikiFolder);
        if (result.deleted > 0) {
          await ctx.wikiEngine.generateIndexFromEngine();
          await ctx.wikiEngine.logLintFix('Delete Empty Stubs', `Deleted ${result.deleted} empty stubs`);
        }
        // Issue #244: surface success + failure breakdown to the user.
        const parts: string[] = [];
        if (result.deleted > 0) {
          parts.push(t.lintDeleteCompleted.replace('{count}', String(result.deleted)));
        }
        if (result.failed > 0) {
          parts.push(t.lintDeleteFailed
            .replace('{failed}', String(result.failed))
            .replace('{total}', String(result.deleted + result.failed)));
        }
        if (parts.length === 0) {
          parts.push(t.lintDeleteCompleted.replace('{count}', '0'));
        }
        new Notice(parts.join('\n'), NOTICE_NORMAL);
      });
    };

    if (orphans.length > 0) {
      fixCallbacks.onLinkOrphans = () => {
        void runFixPhase(async (signal) => {
          const { linked, results } = await runOrphanFixes(ctx, signal, orphans);
          if (linked > 0) {
            await ctx.wikiEngine.generateIndexFromEngine();
            await ctx.wikiEngine.logLintFix('Link Orphan Pages', results.join('\n'));
          }
          const msg = t.lintLinkComplete.replace('{linked}', String(linked))
            + (linked > 0 ? '\n' + t.lintFixIndexUpdated : '');
          new Notice(msg, NOTICE_NORMAL);
        });
      };
    }

    if (duplicates.length > 0) {
      fixCallbacks.onMergeDuplicates = () => {
        void runFixPhase(async (signal) => {
          const { merged, results } = await runDuplicateMerges(ctx, signal, duplicates);
          if (merged > 0) {
            await ctx.wikiEngine.generateIndexFromEngine();
            await ctx.wikiEngine.logLintFix('Merge Duplicate Pages', results.join('\n'));
          }
          const msg = t.lintMergeComplete.replace('{merged}', String(merged)).replace('{total}', String(duplicates.length))
            + (merged > 0 ? '\n' + t.lintFixIndexUpdated : '');
          new Notice(msg, NOTICE_NORMAL);
        });
      };
    }

    // Issue #85 v7: LLM-assisted retag of pages whose tags fall outside
    // the active vocabulary. The user gets a single bulk button "Retag
    // N page(s) with LLM" — no per-page approval. Each violation's
    // frontmatter tags: line is rewritten in place; the body is
    // untouched. Defensive: every LLM-returned tag is re-validated
    // against the active vocabulary before write (runRetagViolations).
    if (tagViolations.length > 0) {
      fixCallbacks.onRetagViolations = () => {
        void runFixPhase(async (signal) => {
          const { fixed, results } = await runRetagViolations(ctx, signal, tagViolations);
          if (fixed > 0) {
            await ctx.wikiEngine.generateIndexFromEngine();
            await ctx.wikiEngine.logLintFix('Retag Tag Violations', results.join('\n'));
          }
          const msg = fixed > 0
            ? t.lintTagViolationFixed.replace('{fixed}', String(fixed)).replace('{total}', String(tagViolations.length))
            : t.lintTagViolationFixedNone;
          new Notice(msg, NOTICE_NORMAL);
        });
      };
    }

    const totalFixable = deadLinks.length + emptyPages.length + orphans.length + duplicates.length;
    const totalFixableIncludingAliases = totalFixable + aliasDeficientPages.length + pollutedPages.length;
    if (totalFixableIncludingAliases > 0) {
      fixCallbacks.onFixAll = () => {
        void (async () => {
          // Issue: Smart Fix All was NOT wrapped in startLintOperation/endLintOperation
          // (unlike single-phase fixes via runFixPhase). This meant the status bar
          // never appeared, so the user had no way to cancel a long-running batch.
          // Fix: wrap the entire IIFE in a single lint-operation lifecycle so the
          // status bar stays visible throughout all 6 phases.
          const signal = ctx.wikiEngine.startLintOperation();
          try {
          const allResults: string[] = [];
          const fixAllNotice = makeMirroredNotice(ctx);

          // Track per-phase counts for final summary
          let pollutedFixed = 0;
          let aliasesFilled = 0;
          let duplicatesMerged = 0;
          let deadLinksFixed = 0;
          let orphansLinked = 0;
          let emptyPagesFilled = 0;
          let tagsRetagged = 0;

          // Smart fix strategy: follow causality chain with aliases as foundation
          // Phase -1: Fix polluted pages (structural root cause before everything else)
          fixAllNotice.setMessage('Smart fix: Phase -1 — Fixing polluted pages...');
          if (pollutedPages.length > 0) {
            for (const pp of pollutedPages) {
              try {
                const result = await ctx.wikiEngine.fixPollutedPage(pp.path, pp.cleanTitle);
                console.debug(`[Pollution Fix] ${result}`);
                pollutedFixed++;
              } catch (e) {
                console.error(`[Pollution Fix] Failed: ${pp.path}`, e);
              }
            }
            if (pollutedFixed > 0) {
              allResults.push(`## Fix Polluted Pages\nFixed ${pollutedFixed}/${pollutedPages.length} polluted pages`);
            }
          }

          // Phase 0: Complete aliases (pre-flight, ensures duplicate detection accuracy)
          // → Aliases are required for Tier 1 duplicate signals (crossLang)
          // → Missing aliases → duplicate detection misses true duplicates → downstream fixes incomplete
          fixAllNotice.setMessage('Smart fix: Phase 0 — Completing aliases...');
          if (aliasDeficientPages.length > 0) {
            const { filled, results } = await runAliasCompletion(ctx, signal, aliasDeficientPages);
            aliasesFilled = filled;
            if (filled > 0) {
              allResults.push(`## Complete Aliases\n${results.join('\n')}`);
              console.debug(`Smart fix: Completed ${filled} aliases, improving duplicate detection accuracy`);
            }
          }

          // Phase 1: Merge duplicates (root cause)
          // → Eliminates redundant pages, resolves many dead links and orphans automatically via link rewriting
          // → Duplicate detection now uses complete aliases (Tier 1 crossLang signals active)
          fixAllNotice.setMessage('Smart fix: Phase 1 — Merging duplicates...');
          if (duplicates.length > 0) {
            const { merged, results } = await runDuplicateMerges(ctx, signal, duplicates);
            duplicatesMerged = merged;
            if (merged > 0) {
              allResults.push(`## Merge Duplicate Pages\n${results.join('\n')}`);
              console.debug(`Smart fix: Merged ${merged} duplicates, dead links and orphans may be auto-resolved`);
            }
          }

          // Phase 2: Fix remaining dead links
          // → Links to deleted source pages were already rewritten during merge
          // → This phase fixes any remaining dead links (pointing to non-existent pages)
          // → Dead link fallback uses aliases to find existing pages (avoiding stub creation)
          fixAllNotice.setMessage('Smart fix: Phase 2 — Fixing dead links...');
          if (deadLinks.length > 0) {
            const { fixed, results } = await runDeadLinkFixes(ctx, signal, deadLinks);
            deadLinksFixed = fixed;
            if (fixed > 0) {
              allResults.push(`## Fix Dead Links\n${results.join('\n')}`);
              console.debug(`Smart fix: Fixed ${fixed} dead links`);
            }
          }

          // Phase 3: Link remaining orphan pages
          // → Some orphans may be auto-resolved after duplicate merge (source page deleted, target page now has incoming links)
          // → This phase links any remaining orphan pages
          fixAllNotice.setMessage('Smart fix: Phase 3 — Linking orphan pages...');
          if (orphans.length > 0) {
            const { linked, results } = await runOrphanFixes(ctx, signal, orphans);
            orphansLinked = linked;
            if (linked > 0) {
              allResults.push(`## Link Orphan Pages\n${results.join('\n')}`);
              console.debug(`Smart fix: Linked ${linked} orphan pages`);
            }
          }

          // Phase 4: Expand empty pages (last, independent of other issues)
          fixAllNotice.setMessage('Smart fix: Phase 4 — Expanding empty pages...');
          if (emptyPages.length > 0) {
            const { filled, results } = await runEmptyPageFixes(ctx, signal, emptyPages);
            emptyPagesFilled = filled;
            if (filled > 0) {
              allResults.push(`## Expand Empty Pages\n${results.join('\n')}`);
              console.debug(`Smart fix: Expanded ${filled} empty pages`);
            }
          }

          // Issue #85 v7 — Phase 5: retag out-of-vocabulary tag pages.
          // LLMs may invent types that don't match the active
          // vocabulary; this phase asks the LLM to re-emit valid
          // tags using only values from the active vocabulary.
          fixAllNotice.setMessage('Smart fix: Phase 5 — Retagging out-of-vocabulary tag pages...');
          if (tagViolations.length > 0) {
            const { fixed, results } = await runRetagViolations(ctx, signal, tagViolations);
            tagsRetagged = fixed;
            if (fixed > 0) {
              allResults.push(`## Retag Tag Violations\n${results.join('\n')}`);
              console.debug(`Smart fix: Retagged ${fixed} tag violations`);
            }
          }

          fixAllNotice.hide();
          if (allResults.length > 0) {
            await ctx.wikiEngine.generateIndexFromEngine();
            await ctx.wikiEngine.logLintFix('Smart Fix All (Causality-Aware with Aliases)', allResults.join('\n\n'));
          }

          // Build phase result data for modal report
          // NOTE: must be inside the try block so the closure-captured counters
          // (pollutedFixed, aliasesFilled, etc.) are still in scope when the
          // modal renders.
          const phases: FixReportPhase[] = [];
          if (pollutedPages.length > 0) {
            phases.push({
              label: `🧹 Fix polluted pages (${pollutedPages.length})`,
              detail: `${pollutedFixed}/${pollutedPages.length}`
            });
          }
          if (aliasDeficientPages.length > 0) {
            phases.push({
              label: t.lintAliasesCompleteBtn.replace('{count}', String(aliasDeficientPages.length)),
              detail: `${aliasesFilled}/${aliasDeficientPages.length}`
            });
          }
          if (duplicates.length > 0) {
            phases.push({
              label: t.lintModalMergeDuplicates.replace('{count}', String(duplicates.length)),
              detail: `${duplicatesMerged}/${duplicates.length}`
            });
          }
          if (deadLinks.length > 0) {
            phases.push({
              label: t.lintModalFixDeadLinks.replace('{count}', String(deadLinks.length)),
              detail: `${deadLinksFixed}/${deadLinks.length}`
            });
          }
          // Issue #85 v7: tag-violation retag phase summary
          if (tagViolations.length > 0) {
            phases.push({
              label: t.lintTagViolationRetagBtn.replace('{count}', String(tagViolations.length)),
              detail: `${tagsRetagged}/${tagViolations.length}`
            });
          }
          if (orphans.length > 0) {
            phases.push({
              label: t.lintModalLinkOrphans.replace('{count}', String(orphans.length)),
              detail: `${orphansLinked}/${orphans.length}`
            });
          }
          if (emptyPages.length > 0) {
            phases.push({
              label: t.lintModalExpandEmpty.replace('{count}', String(emptyPages.length)),
              detail: `${emptyPagesFilled}/${emptyPages.length}`
            });
          }
          // v1.25.1: smarter completion summary.
          // - phasesRun = phases the user kicked off (input lengths > 0).
          // - phasesModified = phases that actually wrote changes.
          // If phasesModified === 0, every phase failed silently — surface
          // that distinctly so the user doesn't think Fix All did nothing.
          // Also: NOTICE_NORMAL (5s) instead of NOTICE_ERROR (8s) to match
          // the non-blocking convention of other fix callbacks.
          const historyHint = getText(ctx.settings.language, 'ingestionNoticeHistoryHint');
          const phasesModified = allResults.filter(r => r !== 'skipped').length;
          const summary = phasesModified === 0
            ? `${t.lintFixAllComplete}: ${t.lintFixAllNoChanges}`
            : `${t.lintFixAllComplete}: ${phasesModified} ${t.lintFixPhasesLabel}. ${historyHint}`;
          new Notice(summary, NOTICE_NORMAL);
          } finally {
            // Issue: status bar must persist throughout all 6 phases. Match the
            // startLintOperation call above so the user can click "cancel" at any point.
            ctx.wikiEngine.endLintOperation();
          }
        })();
      };
    }

    stageNotice.hide();
    // Persist the full lint report to log.md before showing the modal.
    // Issue: fullReport starts with "# Wiki Lint Report" (H1) and the log entry
    // wraps it in "## [timestamp] Wiki Lint Report" (H2). Embedding H1 inside
    // H2 is invalid markdown and renders oddly. Fix: strip the H1 and promote
    // all other headings down one level (H2 → H3, H3 → H4) so the report
    // nests correctly under the log heading.
    const logReport = nestReportUnderParent(fullReport);
    await ctx.wikiEngine.logLintFix(t.lintReportTitle, logReport);
    // v1.22.6 #204: Context-aware completion dispatch.
    //   - Manual lint → LintReportModal (existing UX).
    //   - Auto lint + autoSmartFix → Notice + run fixAll (v1.22.2 path).
    //   - Auto lint without autoSmartFix → Notice only (don't open modal
    //     for a background periodic lint that the user didn't initiate).
    if (trigger === 'auto') {
      if (ctx.settings.autoSmartFix && fixCallbacks.onFixAll) {
        new Notice(getText(ctx.settings.language, 'autoSmartFixNotice'));
        void fixCallbacks.onFixAll();
      } else {
        const historyHint = getText(ctx.settings.language, 'ingestionNoticeHistoryHint');
        // v1.22.6: sum all LintCounts fields for a single human-readable
        // summary number in the auto-lint completion Notice.
        const totalFindings = (Object.values(counts) as number[]).reduce((sum, n) => sum + n, 0);
        // B2.5 follow-up (v1.26.3 PATCH): 'findings' was hardcoded English
        // inside an otherwise-localized Notice — route the phrase through
        // getText so the count noun matches the locale.
        const findingsPhrase = getText(ctx.settings.language, 'lintFindingsSummary')
          .replace('{total}', String(totalFindings));
        new Notice(
          `${t.lintFixAllComplete}: ${findingsPhrase}. ${historyHint}`,
          NOTICE_NORMAL
        );
      }
    } else {
      new LintReportModal(ctx.app, fullReport, fixCallbacks, counts, ctx.settings.language).open();
    }
    await ctx.wikiEngine.generateIndexFromEngine();
    new Notice(TEXTS[ctx.settings.language].lintWikiComplete);

  } catch (error) {
    stageNotice?.hide();
    if (error instanceof DOMException && error.name === 'AbortError') {
      new Notice(getText(ctx.settings.language, 'ingestionCancelled'), NOTICE_NORMAL);
      console.debug('Lint cancelled by user');
      return;
    }
    const errMsg = error instanceof Error ? error.message : String(error);
    new Notice(TEXTS[ctx.settings.language].lintWikiFailed + ': ' + errMsg, NOTICE_ERROR);
    console.error(error);
  }
}
