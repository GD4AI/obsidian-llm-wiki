import { RETIREMENT_HUB_TOP_N } from '../../constants';
import { TEXTS } from '../../texts';
import { LLMWikiSettings } from '../../types';
import {
  ProgrammaticFindings, DuplicateResult
} from './types';
import type { HubLinkDensityIssue } from './scanners';

export interface ReportInput {
  settings: LLMWikiSettings;
  findings: ProgrammaticFindings;
  duplicates: DuplicateResult[];
  contradictionsReport: string;
  elapsedSeconds: number;
  totalPages: number;
}

/**
 * Build the user-facing Lint report (header + summary + per-section bodies).
 *
 * Pure function: no I/O, no LLM. Easy to unit test by passing fixture findings.
 */
export function buildLintReport(input: ReportInput): string {
  const { settings, findings, duplicates, contradictionsReport, elapsedSeconds, totalPages } = input;
  const t = TEXTS[settings.language];
  const folder = settings.wikiFolder;

  const aliasDeficientPages = findings.aliasDeficientPages;
  const deadLinks = findings.deadLinks;
  const emptyPages = findings.emptyPages;
  const orphans = findings.orphans;
  const pollutedPages = findings.pollutedPages;
  const tagViolations = findings.tagViolations;
  const ungroundedQuotes = findings.ungroundedQuotes;
  const hubLinkDensityIssues: HubLinkDensityIssue[] = findings.hubLinkDensityIssues;
  const { sourcesNormalizedFiles, sourcesNormalizedEntries, sourceDriftIssues, contradictionMarkerIssues } = findings;

  // Compute deadLinkFromDup / orphanFromDup counts
  const duplicatePaths = new Set<string>();
  for (const d of duplicates) {
    duplicatePaths.add(d.target);
    duplicatePaths.add(d.source);
  }
  let deadLinkFromDup = 0;
  for (const dl of deadLinks) {
    const sourcePath = `${folder}/${dl.source}.md`;
    const targetPath = `${folder}/${dl.target}.md`;
    if (duplicatePaths.has(sourcePath) || duplicatePaths.has(targetPath)) deadLinkFromDup++;
  }
  let orphanFromDup = 0;
  for (const op of orphans) {
    if (duplicatePaths.has(op)) orphanFromDup++;
  }

  // Build per-section bodies
  let progReport = '';

  // 0. Missing aliases
  if (aliasDeficientPages.length > 0) {
    progReport += `## ${t.lintAliasesSection.replace('{count}', String(aliasDeficientPages.length))}\n\n`;
    for (const p of aliasDeficientPages) {
      const rel = p.path.replace(folder + '/', '').replace('.md', '');
      progReport += t.lintAliasesItem.replace('{page}', rel) + '\n';
    }
    progReport += '\n';
  }

  // 1. Duplicates
  if (duplicates.length > 0) {
    progReport += `## ${t.lintDuplicateSection.replace('{count}', String(duplicates.length))}\n\n`;
    for (const d of duplicates) {
      const targetRel = d.target.replace(folder + '/', '').replace('.md', '');
      const sourceRel = d.source.replace(folder + '/', '').replace('.md', '');
      progReport += t.lintDuplicateItem
        .replace('{target}', targetRel)
        .replace('{source}', sourceRel)
        .replace('{reason}', d.reason) + '\n';
    }
    progReport += '\n';
  }

  // 2. Dead links
  if (deadLinks.length > 0) {
    const lines: string[] = [];
    for (const dl of deadLinks) {
      const sourcePath = `${folder}/${dl.source}.md`;
      const targetPath = `${folder}/${dl.target}.md`;
      const involvesDup = duplicatePaths.has(sourcePath) || duplicatePaths.has(targetPath);
      const dupFlag = involvesDup ? t.lintDeadLinkAffectedByDup : '';
      lines.push(t.lintDeadLinkItem
        .replace('{source}', dl.source)
        .replace('{target}', dl.target)
        .replace('{dupFlag}', dupFlag));
    }
    progReport += `## ${t.lintDeadLinkSection.replace('{count}', String(deadLinks.length))}\n\n${lines.join('\n')}\n\n`;
  }

  // 3. Ungrounded quotes
  if (ungroundedQuotes.length > 0) {
    progReport += `## ${t.lintQuoteGroundingSection.replace('{count}', String(ungroundedQuotes.length))}\n\n`;
    for (const q of ungroundedQuotes) {
      const pageRel = q.pagePath.replace(folder + '/', '').replace('.md', '');
      const sourceRel = q.sourcePath
        ? q.sourcePath.replace(folder + '/', '').replace('.md', '')
        : '';
      const sourceHint = q.hasSourceLink ? ` → [[${sourceRel}]]` : '';
      progReport += t.lintQuoteGroundingItem
        .replace('{page}', pageRel)
        .replace('{source}', sourceRel)
        .replace('{quote}', q.quote)
        .replace('{sourceHint}', sourceHint) + '\n';
    }
    progReport += '\n';
  }

  // 4. Empty pages
  if (emptyPages.length > 0) {
    progReport += `## ${t.lintEmptyPageSection.replace('{count}', String(emptyPages.length))}\n\n`;
    for (const ep of emptyPages) {
      const rel = ep.path.replace(folder + '/', '').replace('.md', '');
      progReport += t.lintEmptyPageItem.replace('{page}', rel) + '\n';
    }
    progReport += '\n';
  }

  // 5. Tag violations
  if (tagViolations.length > 0) {
    progReport += `## ${t.lintTagViolationSection.replace('{count}', String(tagViolations.length))}\n\n`;
    for (const v of tagViolations) {
      const rel = v.path.replace(folder + '/', '').replace('.md', '');
      progReport += t.lintTagViolationItem
        .replace('{path}', rel)
        .replace('{tags}', v.invalidTags.join(', ')) + '\n';
    }
    progReport += '\n';
  }

  // 6. Polluted pages
  if (pollutedPages.length > 0) {
    progReport += `## ${t.lintPollutedSection.replace('{count}', String(pollutedPages.length))}\n\n`;
    for (const pp of pollutedPages) {
      const rel = pp.path.replace(folder + '/', '').replace('.md', '');
      progReport += t.lintPollutedItem
        .replace('{page}', rel)
        .replace('{clean}', pp.cleanTitle) + '\n';
    }
    progReport += '\n';
  }

  // 7. Sources normalized
  if (sourcesNormalizedFiles > 0) {
    progReport += `## ${t.lintSourcesNormalizedSection}\n\n`;
    progReport += t.lintSourcesNormalizedItem
      .replace('{files}', String(sourcesNormalizedFiles))
      .replace('{entries}', String(sourcesNormalizedEntries)) + '\n\n';
  }

  // 8. Orphans
  if (orphans.length > 0) {
    progReport += `## ${t.lintOrphanSection.replace('{count}', String(orphans.length))}\n\n`;
    for (const op of orphans) {
      const rel = op.replace(folder + '/', '').replace('.md', '');
      const isDup = duplicatePaths.has(op);
      const dupFlag = isDup ? t.lintOrphanIsDuplicate : '';
      progReport += t.lintOrphanItem
        .replace('{page}', rel)
        .replace('{dupFlag}', dupFlag) + '\n';
    }
    progReport += '\n';
  }

  // 8b. Hub link density (v1.23.0 P1-6, Issue #157 / #175)
  //
  // Reported: `strip` and `review`. A `keep` verdict is not a finding, and printing it
  // would have listed six healthy hubs per run on a 2,141-page vault — invisible until
  // #1034, because the scanner could not read any page's Related section and this
  // branch never ran. `runHubLinkFixes` filters the same two verdicts.
  const actionableHubs = hubLinkDensityIssues.filter(h => h.recommendation !== 'keep');
  if (actionableHubs.length > 0) {
    const stripCount = actionableHubs.filter(h => h.recommendation === 'strip').length;
    const reviewCount = actionableHubs.filter(h => h.recommendation === 'review').length;
    progReport += `## ${t.lintHubLinkDensitySection.replace('{count}', String(actionableHubs.length))}\n\n`;
    // #1025: the reader is standing here when this list and the crystallized list
    // disagree, so the distinction belongs here rather than in either section's
    // heading. The two measure different properties — out-links versus neighbour
    // interlinking — and neither implies the other.
    progReport += `${t.lintHubLinkDensityIntro}\n\n`;
    for (const h of actionableHubs) {
      const rel = h.pagePath.replace(folder + '/', '').replace('.md', '');
      const actionLabel = h.recommendation === 'strip'
        ? t.lintHubLinkDensityStrip
        : h.recommendation === 'review'
          ? t.lintHubLinkDensityReview
          : t.lintHubLinkDensityKeep;
      const lowTargets = h.lowDistinctivenessTargets
        .map(t2 => t2.replace(folder + '/', '').replace('.md', ''))
        .join(', ');
      progReport += t.lintHubLinkDensityItem
        .replace('{page}', rel)
        .replace('{inDegree}', String(h.inDegree))
        .replace('{relatedCount}', String(h.totalRelatedLinks))
        .replace('{distinctiveness}', h.distinctivenessScore.toFixed(2))
        .replace('{recommendation}', actionLabel)
        .replace('{lowTargets}', lowTargets) + '\n';
    }
    if (stripCount > 0 || reviewCount > 0) {
      progReport += '\n' + t.lintHubLinkDensitySummary
        .replace('{strip}', String(stripCount))
        .replace('{review}', String(reviewCount)) + '\n';
    }
    progReport += '\n';
  }

  // 8c. Source drift (Issue #220 Tier 0, read half) — origin notes edited
  // since their source page was built. Report-only: re-ingest is additive,
  // so the decision what to do with a revision stays editorial.
  if (sourceDriftIssues.length > 0) {
    progReport += `## ${t.lintSourceDriftSection.replace('{count}', String(sourceDriftIssues.length))}\n\n`;
    for (const d of sourceDriftIssues) {
      const rel = d.sourcePage.replace(folder + '/', '').replace('.md', '');
      progReport += t.lintSourceDriftItem
        .replace('{page}', rel)
        .replace('{note}', d.note.replace('.md', '')) + '\n';
    }
    progReport += '\n';
  }

  // 8d. Contradiction markers (#575 read half) — pages stamped by the merge
  // triage. Shown next to the contradiction-phase records so the two
  // detection paths (merge-time vs. lint-time) land in one review surface.
  if (contradictionMarkerIssues.length > 0) {
    progReport += `## ${t.lintContradictionMarkerSection.replace('{count}', String(contradictionMarkerIssues.length))}\n\n`;
    for (const c of contradictionMarkerIssues) {
      const rel = c.path.replace(folder + '/', '').replace('.md', '');
      const src = c.sources.map(s2 => `[[${s2.replace('.md', '')}]]`).join(', ');
      progReport += t.lintContradictionMarkerItem
        .replace('{page}', rel)
        .replace('{sources}', src) + '\n';
    }
    progReport += '\n';
  }

  progReport += renderCrystallizedHubs(findings.crystallizedHubs, t, folder);

  // 9. No issues message
  if (!duplicates.length && !deadLinks.length && !emptyPages.length && !orphans.length && !ungroundedQuotes.length && !hubLinkDensityIssues.length && !sourceDriftIssues.length && !contradictionMarkerIssues.length) {
    progReport += `${t.lintNoIssuesFound}\n\n`;
  }

  // Build summary
  const summaryText = t.lintReportSummary
    .replace('{total}', String(totalPages))
    .replace('{aliasesMissing}', String(aliasDeficientPages.length))
    .replace('{duplicates}', String(duplicates.length))
    .replace('{deadLinks}', String(deadLinks.length))
    .replace('{deadLinkFromDup}', String(deadLinkFromDup))
    .replace('{orphans}', String(orphans.length))
    .replace('{orphanFromDup}', String(orphanFromDup))
    .replace('{emptyPages}', String(emptyPages.length))
    .replace('{ungroundedQuotes}', String(ungroundedQuotes.length))
    .replace('{tagViolations}', String(tagViolations.length))
    .replace('{elapsedSeconds}', String(elapsedSeconds));

  // Prepend aliases deficiency section
  if (aliasDeficientPages.length > 0) {
    const aliasPre = `> ${t.lintAliasesMissing.replace('{count}', String(aliasDeficientPages.length))}\n\n`;
    progReport = aliasPre + progReport;
  }

  // v1.26.4 PATCH #473 follow-up: the LLM analysis section was removed
  // from the LintReportModal entirely (Karpathy first principles —
  // see controller.ts comment block). The LintReportBody is therefore
  // pure programmatic findings + contradictions, with no LLM section.
  return `# ${t.lintReportTitle}\n\n> ${summaryText}\n\n${progReport}${contradictionsReport}`;
}

/**
 * Issue #954 — the crystallized-hub section, extracted so `buildLintReport` stays
 * inside the size ratchet rather than raising the ceiling for it.
 *
 * Returns the empty string when there is no candidate: an empty heading reads as
 * a finding that fired and found nothing, which is worse than silence.
 */
function renderCrystallizedHubs(
  hubs: import('./scanners').CrystallizedHub[] | undefined,
  t: (typeof TEXTS)[keyof typeof TEXTS],
  folder: string,
): string {
  if (!hubs || hubs.length === 0) return '';
  let out = `## ${t.lintCrystallizedHubsSection.replace('{count}', String(hubs.length))}\n\n`;
  out += `${t.lintCrystallizedHubsIntro.replace('{topN}', String(RETIREMENT_HUB_TOP_N))}\n\n`;
  for (const hub of hubs) {
    const rel = hub.path.replace(folder + '/', '').replace('.md', '');
    out += `- ${t.lintCrystallizedHubRow
      .replace('{path}', rel)
      .replace('{degree}', String(hub.degree))
      .replace('{percentile}', String(Math.round(hub.clusteringPercentile * 100)))}\n`;
  }
  return out + '\n';
}
