/**
 * The dependency bundle handed to every engine sub-module.
 *
 * Split out of `types.ts` by #929. The functions on it return the latest
 * state at call time rather than a snapshot at construction time, on purpose:
 * the LLM client can change when the user edits settings without a restart.
 */
import type { App } from 'obsidian';
import type { ContradictionInfo, IngestReport } from './ingest';
import type { LLMClient } from './llm';
import type { LLMWikiSettings } from './settings';
import type { WikiPageRef } from './write';
// EngineContext — shared dependencies injected into sub-modules.
// Functions (getClient, tryReadFile) return the latest state at call time,
// not a snapshot at construction time. This is intentional: the LLM client
// can change when the user updates settings without restarting the plugin.
//
// Core (required by all sub-modules):
//   getClient — runtime accessor for LLM client, reflects settings changes
//   getExistingWikiPages — reads frontmatter from all wiki/*.md files
//   createOrUpdateFile — the write gate: pageGuard + rawWrite + notify
// Integration (consumed by auto-maintain and ingestion pipeline):
//   onFileWrite — notifies file watcher of writes for change detection
//   onProgress / onDone — ingestion progress → UI modal
export interface EngineContext {
  app: App;
  settings: LLMWikiSettings;
  getClient: () => LLMClient | null;
  /**
   * The legacy shorthand: the full gate (`FULL_WRITE_INTENT`). Its meaning is
   * frozen so the call sites that predate `WriteIntent` keep behaving exactly as
   * they did. A caller that wants a subset declares it through
   * `WikiEngine.writeFileWithIntent` instead (Issue #603 slice 3).
   */
  createOrUpdateFile: (path: string, content: string) => Promise<void>;
  tryReadFile: (path: string) => Promise<string | null>;
  deleteFile: (path: string) => Promise<void>;
  buildSystemPrompt: (task: string) => Promise<string | undefined>;
  getSectionLabels: () => Record<string, string>;
  getExistingWikiPages: () => Promise<WikiPageRef[]>;
  getSchemaContext: (task: string) => Promise<string | undefined>;
  getAbortSignal?: () => AbortSignal | undefined;
  /**
   * SubtleCrypto from Obsidian's popout-window-aware `activeWindow.crypto`.
   * Used by the PDF cache to derive a content-addressed key without
   * accessing the bare `window` global (CLAUDE.md `obsidianmd/no-global-this`).
   * Undefined only in tests that don't stub SubtleCrypto.
   */
  subtle?: SubtleCrypto;
  onFileWrite?: (path: string) => void;
  /**
   * Fired for every contradiction the merge triage records against an
   * existing page (item-level `kind: 'contradictory'` and the page-level
   * `strategy: 'contradictory'`). Without this callback the records are
   * invisible to the ingest log and the report count.
   */
  onContradiction?: (contradiction: ContradictionInfo) => void;
  onProgress?: (message: string) => void;
  onDone?: (report: IngestReport) => void;
}
