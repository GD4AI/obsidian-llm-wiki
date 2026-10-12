// tools/dev-instrument/src/recall-diagnostic-cli.ts — #729 Phase 3, the report.
//
// Formatting only. The measurements live in `recall-diagnostic.ts`, which is
// pure and tested; this turns them into text a reader can act on. Keeping the
// two apart means the numbers can be asserted without parsing a report, and the
// report can change wording without touching a measurement.
//
// One rule governs the output: a number this command cannot know is printed as
// unavailable, never as zero. Rank inversions need ground truth and a real
// vault has none, so that section says so instead of printing a clean-looking
// 0. A diagnostic that lies by omission is worse than one that does not run.

import {
  dfTail,
  poolReport,
  rankInversions,
  escalationReport,
  prepare,
  type DiagnosticPage,
} from './recall-diagnostic';
import { builtInFixtures } from '../../../src/core/recall-fixtures';
import type { Fixture } from '../../../src/core/recall-harness';
import {
  LEX_MATCH_MIN_COUNT,
} from '../../../src/constants';
import { segment, LEX_COVERAGE_MIN } from '../../../src/core/term-index';

// Re-exported so the runner can inject the same segmenter production uses,
// without reaching into src/ from the .mjs entry point.
export { segment };

export interface RecallDiagnosticOptions {
  /** Queries to run the pool and escalation reports over. */
  readonly queries: readonly string[];
  /** K for what actually loads. Default 10. */
  readonly k?: number;
  /** Size of the candidate window. Default 50. */
  readonly poolK?: number;
  /** Lexical gate thresholds, so a reader can see what the constants do. */
  readonly minStrength?: number;
  readonly minCount?: number;
  /** Segment a query into index terms. Injected so the CLI stays pure. */
  readonly segmentQuery: (q: string) => string[];
  /** Score one query the way the lexical stage does. `strength` is unitless:
   *  the name tier's share of the query's total IDF. */
  readonly lexScore: (q: string) => { strength: number; hitCount: number; reliable: boolean };
}

export interface RecallDiagnosticReport {
  readonly text: string;
  readonly hasGroundTruth: boolean;
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)} %`;
}

function fixed(x: number): string {
  return x.toFixed(3);
}

/** Build the report. Pure — all IO is the caller's. */
export function formatRecallDiagnostic(
  pages: readonly DiagnosticPage[],
  options: RecallDiagnosticOptions,
): RecallDiagnosticReport {
  const k = options.k ?? 10;
  const poolK = options.poolK ?? 50;
  const minStrength = options.minStrength ?? LEX_COVERAGE_MIN;
  const minCount = options.minCount ?? LEX_MATCH_MIN_COUNT;

  const { pageTerms, corpus } = prepare(pages);
  const tail = dfTail(pages);

  // Fixtures carry ground truth. On a real vault the caller passes none, and
  // that is a different question with a different answer — not a zero.
  const { fixtures, queryTerms } = builtInFixtures();
  const hasGroundTruth = fixtures.length > 0;

  const queryTermsById = new Map<string, string[]>();
  const queryFixtures: Fixture[] = options.queries.map((q, i) => {
    const terms = options.segmentQuery(q);
    const id = `q${i}`;
    queryTermsById.set(id, terms);
    return { id, query: q, relevant: [], regime: 'latin' };
  });

  const pools = poolReport(queryFixtures, pages, queryTermsById, {
    k, poolK, pageTerms, corpus,
  });
  const escalation = escalationReport(options.queries, options.lexScore, minStrength, minCount);
  const inversions = rankInversions(fixtures, [...pages], queryTerms, {
    pageTerms: undefined, corpus: undefined,
  });

  const lines: string[] = [];
  lines.push('=== Recall diagnostic ===');
  lines.push('');
  lines.push(`Pages: ${tail.docCount} · distinct terms: ${tail.termCount}`);
  lines.push(`Pages with no sources: ref: ${pct(tail.unattributedShare)} — the assembly layer is blind to these`);
  lines.push('');
  lines.push('--- DF tail ---');
  lines.push(`median df ${fixed(tail.medianDf)} · p90 df ${fixed(tail.p90Df)} · hapax terms ${tail.hapaxCount}`);
  if (tail.highDfTerms.length > 0) {
    lines.push('terms in more than half the pages (the stop-word candidates):');
    for (const t of tail.highDfTerms.slice(0, 12)) {
      lines.push(`  ${t.term}  df ${fixed(t.df)}`);
    }
  } else {
    lines.push('no term reaches df 0.5 on this corpus — stop-word suppression has little to suppress');
  }
  lines.push('');
  lines.push(`--- Candidate pool (top ${poolK} against top ${k}) ---`);
  for (const p of pools) {
    const flag = p.unattributedWindow
      ? '  [no source refs in window: the layer cannot see, which is not the same as a narrow window]'
      : p.singleSourceWindow
        ? '  [single-source window: assembly cannot diversify it]'
        : '';
    lines.push(`  ${p.query}`);
    lines.push(`    window ${p.poolSources} sources · loaded ${p.loadedSources} · dominant ${pct(p.dominantShare)}${flag}`);
  }
  const windows = pools.filter(p => p.poolSources > 1);
  const meanWindow = windows.length > 0
    ? windows.reduce((a, b) => a + b.poolSources, 0) / windows.length : 0;
  const meanLoaded = windows.length > 0
    ? windows.reduce((a, b) => a + b.loadedSources, 0) / windows.length : 0;
  lines.push(`  mean over multi-source windows: ${meanWindow.toFixed(1)} available, ${meanLoaded.toFixed(1)} loaded`);
  lines.push(`  single-source windows: ${pools.filter(p => p.singleSourceWindow).length} of ${pools.length}`);
  lines.push(`  unattributed windows: ${pools.filter(p => p.unattributedWindow).length} of ${pools.length}`);
  lines.push('');
  lines.push(`--- Lexical gate (coverage >= ${minStrength}, count >= ${minCount}) ---`);
  for (const d of escalation.details) {
    lines.push(`  ${d.query}  coverage ${fixed(d.strength)} · name-tier pages ${d.hitCount}${d.needsLLM ? '  -> escalates' : ''}`);
  }
  lines.push(`queries that would call the LLM: ${escalation.needsLLM} of ${escalation.total} (${pct(escalation.ratio)})`);
  if (escalation.ratio >= 0.99) {
    lines.push('  every query escalates. Check the per-query line above to see which clause fails:');
    lines.push('  a low coverage means the name tier misses the query, a low page count means the');
    lines.push('  corpus has few pages carrying those terms in a title or alias at all.');
  }
  lines.push('');
  lines.push('--- Rank inversions ---');
  if (!hasGroundTruth) {
    lines.push('unavailable: inversions need ground truth and a real vault has none.');
    lines.push('The synthetic layer reports this; a zero here would not mean clean.');
  } else {
    const totalInv = inversions.reduce((a, b) => a + b.inversions, 0);
    const totalPairs = inversions.reduce((a, b) => a + b.pairs, 0);
    lines.push(`synthetic fixtures: ${totalInv} inversions over ${totalPairs} comparable pairs`);
    if (totalPairs === 0) {
      lines.push('  no comparable pairs — that is not a clean result, it is an empty one.');
    }
  }
  return { text: lines.join('\n'), hasGroundTruth };
}
