// Shared types for the lint pipeline.
// These are internal to src/wiki/lint/. LintController is the only public
// entry point.
//
// History:
//   - v1.18.3: extracted LintContext here so fix-runners.ts can stop
//     importing from lint-controller.ts (cycle risk).

import type { App } from 'obsidian';
import { LLMWikiSettings, LLMClient } from '../../types';
import { WikiEngine } from '../wiki-engine';

// Public ctx for the entire lint run. The controller creates one of these
// and passes it down to every phase (preparation, programmatic, llm-assisted,
// fix-runners) and to report-builder / fix-callback assembly.
export interface LintContext {
  app: App;
  settings: LLMWikiSettings;
  llmClient: LLMClient | null;
  wikiEngine: WikiEngine;
  onAnalyzeSchema: (context?: string) => void;
  /**
   * #328 Phase 1 follow-up: shared composer used by fix-runners to
   * build the `system` field of their LLM calls. Returns undefined when
   * there is nothing to inject. Pre-Phase-1 only the `LintPhaseContext`
   * carried this getter; it was lifted to `LintContext` when retag
   * (the one remaining user-layer tag-vocab injection path) was
   * migrated to the system layer.
   */
  buildSystemPrompt?: (task: string) => Promise<string | undefined>;
}

export interface LintPhaseContext {
  app: {
    vault: {
      getMarkdownFiles: () => Array<{ path: string; basename: string }>;
      read: (file: { path: string }) => Promise<string>;
      getAbstractFileByPath: (path: string) => unknown;
      process: (file: unknown, fn: (data: string) => string | Promise<string>) => Promise<string>;
    };
    workspace: {
      onLayoutReady: (cb: () => void) => void;
    };
    metadataCache: {
      on: (event: string, cb: unknown) => unknown;
    };
  };
  settings: LLMWikiSettings;
  /**
   * v1.24.0: added for the LLM-assisted phases (dedup / analysis) extracted
   * from controller.ts:runLintWiki into `llm-phases/`. The LLM was previously
   * read off `LintContext`; phases now consume it via this phase ctx field so
   * the phase functions are self-contained and can be unit-tested by injecting
   * a stub LLMClient without standing up a full LintContext.
   *
   * B3 fix (v1.24.0 review): typed as a getter closure (NOT a direct ref)
   * so settings changes mid-lint (e.g. user flips API key in Settings during
   * a long dedup run) are observed on the next phase LLM call. The OLD
   * controller.ts inlined `ctx.llmClient.createMessage(...)` at each LLM
   * call site, which had this liveness for free. The phase extraction
   * initially captured a snapshot, which is the wrapper-correctness defect
   * the v1.24.0 review caught.
   *
   * May return null — the dedup-phase and analysis-phase treat null as
   * a fast-skip signal.
   */
  llmClient: () => LLMClient | null;
  wikiEngine: {
    updateStatusBar: (text: string) => void;
    getExistingWikiPages: () => Promise<Array<{ path: string }>>;
    tryReadFile: (path: string) => Promise<string | null>;
    getOpenContradictions: () => Promise<Array<{ path: string; status: string; claim: string }>>;
  };
  checkCancelled: () => void;
  stageNotice: {
    setMessage: (message: string) => void;
  } | null;
  totalPages: number;
  /**
   * v1.24.0: compose the `system` prompt for LLM-assisted lint phases.
   * Mirrors `EngineContext.buildSystemPrompt` — the shared composer that
   * injects the language directive + schema context + active tag vocabulary.
   * Phases call it (e.g. with 'lint') and use the result as the `system`
   * field, matching fill-empty-page / fix-dead-link / link-orphan /
   * merge-duplicates. Returns undefined when there is nothing to inject.
   */
  buildSystemPrompt: (task: string) => Promise<string | undefined>;
}

export interface ScannerPage {
  path: string;
  content: string;
  basename: string;
}

export interface ProgrammaticFindings {
  aliasDeficientPages: ScannerPage[];
  emptyPages: Array<{ path: string; content: string }>;
  orphans: string[];
  tagViolations: import('./scanners').TagViolation[];
  pollutedPages: Array<{ path: string; title: string; cleanTitle: string }>;
  deadLinks: Array<{ source: string; target: string }>;
  ungroundedQuotes: import('./scanners').QuoteGroundingIssue[];
  /** v1.23.0 P1-6 — hub pages with redundant links in ## Related (Issue #157 / #175). */
  hubLinkDensityIssues: import('./scanners').HubLinkDensityIssue[];
  /** Issue #220 Tier 0 (read half) — source pages whose origin note changed since ingest. */
  sourceDriftIssues: import('./scanners').SourceDriftIssue[];
  /** #575 read half — pages carrying the triage-stamped `contradictions:` marker. */
  contradictionMarkerIssues: import('./scanners').ContradictionMarkerIssue[];
  sourcesNormalizedFiles: number;
  sourcesNormalizedEntries: number;
  doubleNestFixes: number;
}

export interface DuplicateResult {
  target: string;
  source: string;
  reason: string;
}

export interface LlmAssistedResults {
  duplicates: DuplicateResult[];
  contradictionsReport: string;
  llmReport: string;
}
