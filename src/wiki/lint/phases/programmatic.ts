import { activeVocabularyLists } from '../../../core/vocabulary';
import { detectAliasDeficiency, scanOrphans, scanTagViolations, scanDeadLinks, scanQuoteGrounding, scanHubLinkDensity, scanSourceDrift, scanContradictionMarkers, collectCitedRawNoteTargets } from '../scanners';
import { detectPollutedPages } from '../utils';
import { parseFrontmatter } from '../../../core/frontmatter';
import { getText } from '../../../core/i18n';
import { getSectionLabels } from '../../system-prompts';
import type { Graph } from '../../../core/monte-carlo-ppr';
import { LintPhaseContext, ProgrammaticFindings, ScannerPage } from '../types';

export interface ProgrammaticInput {
  wikiFiles: Array<{ path: string; basename: string }>;
  pageMap: Map<string, ScannerPage>;
  knownTargets: Set<string>;
  knownTargetsLower: Set<string>;
  /** v1.23.0 P1-6 — wiki-link graph for hub detection and PPR. */
  graph: Graph;
}

/**
 * Run the fast-programmatic and source-IO programmatic checks.
 *
 * Order (preserves causality-awareness from the original lint-controller):
 *   1. alias deficiency (fast, no IO)
 *   2. orphans (fast, no IO)
 *   3. tag violations (fast, no IO)
 *   4. polluted pages (fast, no IO)
 *   5. dead links (no extra IO — uses pageMap)
 *   6. quote grounding (reuses already-read source pages + bounded read of cited raw notes)
 *
 * emptyPages is initialized empty here; it gets populated in the LLM phase
 * after we know which pages are duplicate sources (to exclude from empty-page list).
 */
export async function runProgrammaticPhase(
  ctx: LintPhaseContext,
  input: ProgrammaticInput,
): Promise<ProgrammaticFindings> {
  // 1. Alias deficiency
  const aliasDeficientPages = detectAliasDeficiency(input.wikiFiles, input.pageMap);
  console.debug(`lintWiki: ${aliasDeficientPages.length} entity/concept pages missing aliases`);

  // 2. Orphan pages
  const orphans = scanOrphans(input.pageMap, ctx.settings.wikiFolder);

  // 3. Tag vocabulary violations
  const tagViolations = scanTagViolations(input.pageMap, ctx.settings, activeVocabularyLists(ctx.app as never, ctx.settings));

  // 4. Polluted pages
  const allPages = Array.from(input.pageMap.values()).map(({ path, basename }) => ({
    path, title: basename
  }));
  const pollutedPages = detectPollutedPages(allPages);
  if (pollutedPages.length > 0) {
    console.warn(`[Lint] Detected ${pollutedPages.length} polluted page(s):`);
    for (const pp of pollutedPages) {
      console.warn(`  - ${pp.path} → should be "${pp.cleanTitle}"`);
    }
  }

  // 5. Dead links
  ctx.stageNotice?.setMessage(getText(ctx.settings.language, 'lintScanningLinks'));
  ctx.wikiEngine.updateStatusBar(getText(ctx.settings.language, 'lintStageProgrammatic'));
  console.debug('lintWiki: scanning dead links');
  const deadLinks = scanDeadLinks(
    input.pageMap, input.knownTargets, input.knownTargetsLower, ctx.settings.wikiFolder
  );
  ctx.stageNotice?.setMessage(
    getText(ctx.settings.language, 'lintScanningLinksProgress')
      .replace('{current}', String(input.wikiFiles.length))
      .replace('{total}', String(input.wikiFiles.length))
  );

  // 6. Quote grounding (Issue #126) — reuses already-read source pages.
  const sourceMap = new Map<string, ScannerPage>();
  for (const [path, page] of input.pageMap) {
    if (path.includes('/sources/')) {
      sourceMap.set(path, page);
    }
  }
  // Issue #496 (the issue's "unrequested finding", now load-bearing): Mentions
  // citations point at PRIMARY source notes (#244 style), and the #496
  // summary-page route cites them programmatically — a wiki-only map would
  // flag every legitimately captured quote as ungrounded on re-lint, and
  // grounding would run against generated summaries instead of underlying
  // documents. Read each cited primary note once; unreadable notes stay out
  // and their quotes keep being flagged (honest signal).
  const mentionsLabel = getSectionLabels(ctx.settings).mentions_in_source;
  for (const target of collectCitedRawNoteTargets(input.pageMap, ctx.settings.wikiFolder, mentionsLabel)) {
    if (sourceMap.has(target) || input.pageMap.has(target)) continue;
    // Blocker fix (DocTpoint review): hold the TFile — vault.read takes a
    // TFile, not a plain { path: string }. The previous duck-typed object
    // was caught by the per-note catch and silently swallowed if any
    // Obsidian version stopped tolerating it, causing grounding to
    // mis-flag legit verbatim quotes as ungrounded.
    const abstract = ctx.app.vault.getAbstractFileByPath(target);
    if (!abstract) continue;
    try {
      const content = await (ctx.app.vault as unknown as { read: (f: unknown) => Promise<string> }).read(abstract);
      sourceMap.set(target, {
        path: target,
        basename: target.split('/').pop()?.replace(/\.md$/, '') || target,
        content,
      });
    } catch {
      /* unreadable note — quote stays flagged */
    }
  }
  const ungroundedQuotes = scanQuoteGrounding(input.pageMap, sourceMap, ctx.settings.wikiFolder, mentionsLabel);
  console.debug(`lintWiki: ${ungroundedQuotes.length} ungrounded quote(s)`);

  // 7. Hub link density (Issue #157 / #175, v1.23.0 P1-6) — detects hub
  // pages whose ## Related links are mutually redundant in graph
  // structure. Pure PPR-based scoring, zero IO, zero LLM.
  const hubLinkDensityIssues = scanHubLinkDensity(input.pageMap, input.graph, {
    wikiFolder: ctx.settings.wikiFolder,
  });
  console.debug(`lintWiki: ${hubLinkDensityIssues.length} hub pages with link density issues`);

  // 8. Source drift (Issue #220 Tier 0, read half) — every `sources/` page
  // carries a `contentHash` of the note body it was built from (#164), but
  // nothing reads it back. Read each origin note once (same bounded-read
  // pattern as the quote-grounding notes above) and flag pages whose note
  // has changed since ingest. Report-only: re-ingest is additive, so the
  // finding routes to the user, not to an automatic action.
  const driftNoteContents = new Map<string, string>();
  for (const [path, page] of input.pageMap) {
    if (!path.startsWith(`${ctx.settings.wikiFolder}/sources/`)) continue;
    const fm = parseFrontmatter(page.content);
    if (!fm) continue;
    // Same field precedence as scanSourceDrift: scalar `source_file:`
    // (canonical on sources/ pages) plus any `sources:` list entries.
    const refs: string[] = [];
    const sourceFile = (fm as Record<string, unknown>).source_file;
    if (typeof sourceFile === 'string') refs.push(sourceFile);
    if (Array.isArray(fm.sources)) refs.push(...fm.sources.map(s => String(s)));
    for (const s of refs) {
      const trimmed = s.trim();
      const notePath = trimmed.startsWith('[[') && trimmed.endsWith(']]')
        ? trimmed.slice(2, -2).trim()
        : trimmed;
      if (!notePath || driftNoteContents.has(notePath)) continue;
      const abstract = ctx.app.vault.getAbstractFileByPath(notePath);
      if (!abstract) continue;
      try {
        const content = await (ctx.app.vault as unknown as { read: (f: unknown) => Promise<string> }).read(abstract);
        driftNoteContents.set(notePath, content);
      } catch {
        /* unreadable note — stays out; absence of evidence is not drift */
      }
    }
  }
  const sourceDriftIssues = scanSourceDrift(input.pageMap, driftNoteContents, ctx.settings.wikiFolder);
  console.debug(`lintWiki: ${sourceDriftIssues.length} source page(s) with drifted origin notes`);

  // 9. Contradiction markers (#575 read half) — pages the merge triage
  // stamped with `contradictions:` when it routed a conflicted rewrite.
  // Pure frontmatter read, zero IO, zero LLM; complements the
  // contradiction-phase folder records, which only cover conflicts the
  // lint's own LLM pass detected.
  const contradictionMarkerIssues = scanContradictionMarkers(input.pageMap);
  console.debug(`lintWiki: ${contradictionMarkerIssues.length} page(s) carrying a contradictions: marker`);

  return {
    aliasDeficientPages,
    emptyPages: [],
    orphans,
    tagViolations,
    pollutedPages,
    deadLinks,
    ungroundedQuotes,
    hubLinkDensityIssues,
    sourceDriftIssues,
    contradictionMarkerIssues,
    sourcesNormalizedFiles: 0, // populated by preparation phase caller
    sourcesNormalizedEntries: 0,
    doubleNestFixes: 0,
  };
}
