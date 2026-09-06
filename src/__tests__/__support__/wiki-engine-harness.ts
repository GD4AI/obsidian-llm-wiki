// Focused in-memory harness for WikiEngine.ingestSource tests.
//
// WikiEngine wraps an Obsidian App directly (not just an EngineContext), so the
// EngineContext mock isn't enough. This provides a minimal App + stub
// SchemaManager + queued LLM client, and — crucially — collects every written
// path via the engine's onFileWrite callback (every wiki write funnels through
// createOrUpdateFile, which fires onFileWrite). That lets a test assert the real
// #164 symptom: "an empty file must create ZERO wiki pages."

import { App, TFile, TFolder } from 'obsidian'; // mocked in setup.ts
import { IngestReport, LLMClient, LLMWikiSettings } from '../../types';
import { SchemaManager } from '../../schema/schema-manager';
import { WikiEngine } from '../../wiki/wiki-engine';
import { parseFrontmatter } from '../../core/frontmatter';
import { DEFAULT_SETTINGS } from './engine-context';

type LLMRequest = Parameters<LLMClient['createMessage']>[0];

export interface WikiEngineHarness {
  engine: WikiEngine;
  /** Every request handed to the LLM stub, in order. Lets a test assert on the
   *  prompt the engine built, not just on what the stub returned. */
  llmRequests: LLMRequest[];
  /** Every path written by the engine (via onFileWrite), in order. */
  writtenPaths: string[];
  /** Every IngestReport delivered to onDone, in order. */
  reports: IngestReport[];
  /** In-memory vault contents. */
  files: Map<string, string>;
  /** Mutable call stats. */
  stats: { llmCalls: number; vaultMarkdownScans: number };
  /** Filenames delivered to `onIngestionStart` (status-bar text hooks). */
  startedFilenames: string[];
  /** Paths handed to fileManager.trashFile, in order. */
  trashedPaths: string[];
  /** Progress messages delivered to `onProgress` (PDF "Reading PDF: …"). */
  progressMessages: string[];
}

export interface HarnessOptions {
  files?: Record<string, string>;
  llmResponses?: string[];
  settings?: Partial<LLMWikiSettings>;
  /** Paths where getAbstractFileByPath returns null despite the file existing.
   *  Simulates macOS NFC/NFD normalization mismatch (Issue #173 Symptom A). */
  nfcNfdPaths?: string[];
  /** Invoked before every stubbed LLM call with the 0-based call index.
   *  Throwing here simulates the SDK propagating an abort/failure mid-run. */
  beforeLLMCall?: (callIndex: number) => void;
}

function mkFile(path: string): TFile {
  const name = path.split('/').pop() || path;
  const dot = name.lastIndexOf('.');
  return Object.assign(new TFile(), {
    path,
    name,
    basename: dot > 0 ? name.slice(0, dot) : name,
    extension: dot > 0 ? name.slice(dot + 1) : 'md',
  });
}

export function createWikiEngineHarness(opts: HarnessOptions = {}): WikiEngineHarness {
  const files = new Map<string, string>(Object.entries(opts.files ?? {}));
  const llmRequests: LLMRequest[] = [];
  const writtenPaths: string[] = [];
  const reports: IngestReport[] = [];
  const stats = { llmCalls: 0, vaultMarkdownScans: 0 };
  const trashedPaths: string[] = [];
  let llmIdx = 0;

  const app = {
    vault: {
      configDir: '.obsidian',
      read: async (f: { path: string }) => files.get(f.path) ?? '',
      create: async (p: string, c: string) => { files.set(p, c); },
      process: async (f: { path: string }, fn: (d: string) => string) => {
        files.set(f.path, fn(files.get(f.path) ?? ''));
      },
      modify: async (f: { path: string }, c: string) => { files.set(f.path, c); },
      createFolder: async () => { /* no-op */ },
      getAbstractFileByPath: (p: string) => {
        if (opts.nfcNfdPaths?.includes(p)) return null;
        if (files.has(p)) return mkFile(p);
        // Return a TFolder stub for any intermediate directory path that has
        // children in the file map — needed by resolveFileInVault (Issue #173).
        const prefix = p.endsWith('/') ? p : p + '/';
        const children = [...files.keys()].filter(k => k.startsWith(prefix)).map(k =>
          files.has(k) ? mkFile(k) : null
        ).filter(Boolean) as TFile[];
        if (children.length > 0) {
          const folder = new TFolder();
          folder.path = p;
          folder.children = children;
          return folder;
        }
        return null;
      },
      getMarkdownFiles: () => { stats.vaultMarkdownScans++; return [...files.keys()].filter(p => p.endsWith('.md')).map(mkFile); },
      getFiles: () => [...files.keys()].map(mkFile),
    },
    fileManager: {
      trashFile: async (f: { path: string }) => {
        files.delete(f.path);
        trashedPaths.push(f.path);
      },
    },
    metadataCache: {
      // Reflect stored frontmatter from the in-memory vault so content-hash
      // dedup (buildIngestedHashes) behaves like the real cached metadata.
      getFileCache: (f: { path: string }) => {
        const content = files.get(f.path);
        if (content == null) return null;
        const frontmatter = parseFrontmatter(content);
        return frontmatter ? { frontmatter } : null;
      },
    },
  } as unknown as App;

  const client: LLMClient = {
    createMessage: async params => {
      opts.beforeLLMCall?.(stats.llmCalls);
      stats.llmCalls++;
      llmRequests.push(params);
      return opts.llmResponses?.[llmIdx++] ?? '{"entities":[],"concepts":[]}';
    },
  };

  const schemaManager = {
    ensureSchemaExists: async () => { /* no-op */ },
    getSchemaContext: async () => '',
  } as unknown as SchemaManager;

  const startedFilenames: string[] = [];
  const progressMessages: string[] = [];
  const engine = new WikiEngine(
    app,
    { ...DEFAULT_SETTINGS, ...opts.settings },
    () => client,
    schemaManager,
    (path: string) => { writtenPaths.push(path); }, // onFileWrite
    // v1.25.0 PR3 follow-up #7 (Bug C): capture progress messages so tests
    // can assert that the status bar / Notice channels advance during PDF
    // conversion (pre-fix the status bar stayed frozen on the initial
    // placeholder).
    (msg: string) => { progressMessages.push(msg); },
    (report: IngestReport) => { reports.push(report); }, // onDone
  );
  // Wire ingestion callbacks (onIngestionStart / onIngestionEnd). Tests
  // can read `startedFilenames` to assert the status bar text was set.
  engine.setIngestionCallbacks(
    (filename?: string) => { if (filename) startedFilenames.push(filename); },
    () => { /* onEnd: nothing to capture */ },
  );

  return { engine, llmRequests, writtenPaths, reports, files, stats, startedFilenames, progressMessages, trashedPaths };
}

/** True if any written path is a wiki entity/concept/source page (the #164 symptom). */
export function wikiPagesWritten(paths: string[]): string[] {
  return paths.filter(p => /(^|\/)wiki\/(entities|concepts|sources)\//.test(p));
}
