// v1.24.0: contradiction-phase extracted from controller.ts:runLintWiki
// (lines 372-407).
//
// This phase performs the contradiction-tracking step:
//   1. Fetch all open contradictions from the wiki engine.
//   2. Render them into a markdown section that the controller appends
//      to the Lint report.
//
// The phase once auto-resolved records in `review_ok` status through a
// model rewrite of the affected page. Nothing ever produced that status —
// records are written as `detected`, and the only writers afterwards were
// the phase's own transitions (`resolved`, `pending_fix`) — so the branch
// filtered an always-empty set and was removed with its statuses (#604).
// Open records are reviewed by hand; a review command, when it exists,
// attaches to the record file.
//
// Pure helper (`formatContradictionReport`) is exported for unit testing;
// `runContradictionPhase` is the integration entrypoint.

import { TEXTS } from '../../../texts';
import { getText } from '../../../core/i18n';
import type { LintPhaseContext } from '../types';

export interface ContradictionItem {
  path: string;
  status: string;
  claim: string;
}

export interface ContradictionTexts {
  lintContradictionSection: string;
  lintContradictionOpen: string;
  lintContradictionStatusDetected: string;
  lintContradictionItem: string;
}

export interface ContradictionPhaseResult {
  /** Markdown report; empty when nothing to report. */
  report: string;
  /** Number of open contradictions. */
  remaining: number;
}

/**
 * Pure helper: render the contradiction section markdown.
 *
 * Returns empty string when `remaining` is empty. Otherwise produces a
 * `## <section>` header + bullet list.
 */
export function formatContradictionReport(
  remaining: ContradictionItem[],
  t: ContradictionTexts,
  wikiFolder: string,
): string {
  if (remaining.length === 0) return '';

  const lines: string[] = [];
  lines.push(`## ${t.lintContradictionSection}`);
  lines.push('');
  lines.push(`- ${t.lintContradictionOpen.replace('{count}', String(remaining.length))}`);
  lines.push('');
  for (const c of remaining) {
    const relPath = c.path.replace(wikiFolder + '/', '').replace('.md', '');
    const statusLabel = c.status === 'detected' ? t.lintContradictionStatusDetected : c.status;
    lines.push(t.lintContradictionItem
      .replace('{status}', statusLabel)
      .replace('{page}', relPath)
      .replace('{claim}', c.claim.substring(0, 80)));
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Run the contradiction-tracking phase. Returns a structured result; the
 * caller is responsible for appending `result.report` to the Lint report.
 */
export async function runContradictionPhase(
  ctx: LintPhaseContext,
): Promise<ContradictionPhaseResult> {
  // v1.25.11 PATCH #169: status bar carries the fine-grained stage label
  // for the contradiction phase. Previously the status bar stayed on
  // "Linting… (click to cancel)" throughout; the new key surfaces
  // "Detecting contradictions" in the bottom-right.
  ctx.wikiEngine.updateStatusBar(getText(ctx.settings.language, 'lintStageContradiction'));
  const remaining: ContradictionItem[] = await ctx.wikiEngine.getOpenContradictions();
  const lang = ctx.settings.language;
  const t = TEXTS[lang] as unknown as ContradictionTexts;
  const report = formatContradictionReport(remaining, t, ctx.settings.wikiFolder);

  return { report, remaining: remaining.length };
}
