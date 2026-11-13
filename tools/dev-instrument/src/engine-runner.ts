// UPSTREAM DEV-ONLY INSTRUMENT — engine wiring.
//
// Drives the real `WikiEngine.ingestSource` against a vault on disk with
// no Obsidian runtime. The measurement primitive is the shared
// `recordTaskUsage` accumulator at `src/core/llm-task-usage.ts` (wired
// by `wrapWithAdvancedSettings` in `src/llm-client-wrapper.ts` for every
// LLMClient returned by `createLLMClient`). The dev-instrument snapshots
// before the run and diffs after — `taskUsageSince(before)` returns the
// per-step breakdown.
//
// v1.27.0 MINOR migration per issue #507 + simplify findings:
// - All `node:*` access via vault-fs's exported `loadNodeModules` (single
//   source for the Platform.isDesktop-guarded `await import('node:module')`
//   + `createRequire` chain).
// - `withUsageAccounting` removed; per-step calls/millis now come from the
//   shared module-level accumulator (the old wrapper double-recorded the
//   same data with `wrapWithAdvancedSettings`).
// - Per-task tokens still tracked here (the shared accumulator only counts
//   calls and millis, not tokens). Wrapper is now a thin onFinish hook.
// - printSummary collapsed from 18 process.stdout.write calls to one.
// - Measurement arms (`WIKI_THINKING_MODE` / `WIKI_TEMP` / `WIKI_TOP_P`)
//   arrive via env (positional-only CLI cannot express them); applied to
//   `settings` before snapshotting so per-step metrics reflect the arm, and
//   echoed in the `[cli]` header so the log names which arm produced the
//   table that follows (Issue #507 DocTpoint comment). Unknown values throw
//   (`measurement-arms.ts`) — the header must never name an unapplied arm.
// - The process exit code follows the ingest report (`exit-code.ts`): 0 when
//   the engine reports success, 1 when it reports failure / emits no report /
//   throws, 2 when the positionals are missing (Issue #417 secondary).
import { Platform } from './shim';
import { DEFAULT_CONFIG_DIR, PLUGIN_ID } from './shim';
import { loadNodeModules, createVaultApp, type VaultWriteRecord } from './vault-fs';
import { applyMeasurementArms } from './measurement-arms';
import { EXIT_USAGE, exitCodeForReport } from './exit-code';
import { type App, TFile, normalizePath } from 'obsidian';
import { WikiEngine } from '../../../src/wiki/wiki-engine';
import { SchemaManager } from '../../../src/schema/schema-manager';
import { createLLMClient } from '../../../src/llm-sdk/create-plugin-llm-client';
import { preloadLLMClientModules } from '../../../src/llm-sdk/create-llm-client';
import { applySettingsMigrations } from '../../../src/core/settings-migrations';
import { isLocalNoKeyProvider } from '../../../src/core/local-no-key-provider';
import { formatTaskPolicyMap, resolveTaskPolicy, type TaskPolicyMap } from '../../../src/core/task-policy';
import type { IngestReport, LLMClient, LLMWikiSettings } from '../../../src/types';
import type { LLMFinishMeta } from '../../../src/types/llm';
import {
  snapshotTaskUsage,
  taskUsageSince,
  type TaskUsage,
} from '../../../src/core/llm-task-usage';

const API_KEY_ENV = 'WIKI_API_KEY';

async function loadSettings(vaultRoot: string): Promise<LLMWikiSettings> {
  const { nodePath, nodeFs } = await loadNodeModules();
  const configDir = process.env.OBSIDIAN_CONFIG_DIR ?? DEFAULT_CONFIG_DIR;
  const dataPath = nodePath.join(vaultRoot, configDir, 'plugins', PLUGIN_ID, 'data.json');
  let raw: string;
  try {
    raw = nodeFs.readFileSync(dataPath, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `Plugin data not found at ${dataPath}.\n` +
        `Open the vault in Obsidian once and run the plugin to write data.json, then re-run the instrument.`,
        { cause: err },
      );
    }
    throw err;
  }
  let savedData: Partial<LLMWikiSettings> | null;
  try {
    savedData = JSON.parse(raw) as Partial<LLMWikiSettings> | null;
  } catch (err) {
    throw new Error(
      `Plugin data at ${dataPath} is not valid JSON: ${(err as Error).message}\n` +
      `The file exists but cannot be parsed. Inspect it manually or re-create it via the Obsidian settings tab.`,
      { cause: err },
    );
  }
  const { settings } = applySettingsMigrations(savedData);
  return settings;
}

async function resolveApiKey(provider: string): Promise<string> {
  const raw = (process.env[API_KEY_ENV] ?? '').trim();
  if (raw) return raw;
  if (isLocalNoKeyProvider(provider)) return '';
  throw new Error(
    `No API key in ${API_KEY_ENV} env var.\n` +
    `Provider "${provider}" requires a key. Set ${API_KEY_ENV} before running the instrument.\n` +
    `For local providers (ollama, lmstudio) any non-empty placeholder works.`,
  );
}

/**
 * Wraps the LLMClient to total up input/output tokens across all three
 * LLMClient methods (`createMessage`, `createMessageWithOutput`,
 * `createMessageStream`). Per v1.26.3 PATCH Phase B expanded-scope
 * migration, the engine routes the vast majority of its calls through
 * `callLlm` → `createMessageWithOutput` (`src/core/llm-dispatch.ts:55-63`);
 * wrapping only `createMessage` would silently under-report tokens for
 * every modern client (Anthropic / OpenAI / OpenAI-compat).
 *
 * Call counts and millis come from the shared `recordTaskUsage`
 * accumulator (`src/core/llm-task-usage.ts`, wired by
 * `wrapWithAdvancedSettings`), so this wrapper only needs to read
 * `meta.usage` from the onFinish hook.
 */
// Minimal shape: every LLMClient method has a params object with an
// optional onFinish callback. We splice our own onFinish that increments
// totals and delegates to the caller's onFinish.
//
// The meta type is imported, never redeclared (#1022). A local copy drifted
// once `LLMFinishMeta` gained a required `finishReason` field, and because no
// job ran this tsconfig the breakage sat unnoticed: `spliceOnFinish` then
// failed to satisfy the very clients it wraps.
interface LLMCallParams {
  onFinish?: (meta: LLMFinishMeta) => void;
}

function spliceOnFinish<P extends LLMCallParams>(
  params: P,
  totals: { in: number; out: number },
): P {
  const callerOnFinish = params.onFinish;
  return {
    ...params,
    onFinish: meta => {
      totals.in += meta.usage?.inputTokens ?? 0;
      totals.out += meta.usage?.outputTokens ?? 0;
      callerOnFinish?.(meta);
    },
  };
}

function withTokenTracking(client: LLMClient, totals: { in: number; out: number }): LLMClient {
  // Bind to `client` first so methods don't lose `this` binding
  // (the `unbound-method` Bot rule rejects detached method references).
  const createMessage = client.createMessage.bind(client);
  const createMessageWithOutput = client.createMessageWithOutput?.bind(client);
  const createMessageStream = client.createMessageStream?.bind(client);

  const w = Object.create(client) as LLMClient;
  w.createMessage = params => createMessage(spliceOnFinish(params, totals));
  if (createMessageWithOutput) {
    w.createMessageWithOutput = params => createMessageWithOutput(spliceOnFinish(params, totals));
  }
  if (createMessageStream) {
    w.createMessageStream = params => createMessageStream(spliceOnFinish(params, totals));
  }
  return w;
}

function resolveSourceFile(app: Awaited<ReturnType<typeof createVaultApp>>, sourcePath: string): TFile {
  const path = normalizePath(sourcePath);
  const file = app.vault.getAbstractFileByPath(path);
  if (file instanceof TFile) return file;
  throw new Error(`Source not found in vault index: ${path}`);
}

interface PrintSummaryInput {
  byTask: Array<[string, TaskUsage]>;
  tokens: { in: number; out: number };
  report: IngestReport | null;
  writes: VaultWriteRecord[];
  elapsedMs: number;
  /** data.json per-step policies (#490) — resolved per row below. */
  policies?: TaskPolicyMap;
}

function printSummary(input: PrintSummaryInput): void {
  const { byTask, tokens, report, writes, elapsedMs, policies } = input;
  const lines: string[] = [];

  lines.push('', '=== Writes ===');
  const pageWrites = writes.filter(w => w.action !== 'mkdir');
  if (pageWrites.length === 0) {
    lines.push('  (no file writes)');
  } else {
    for (const w of pageWrites) {
      lines.push(`  ${w.action.padEnd(6)} ${w.path}`);
    }
  }

  lines.push('', '=== Summary ===');
  if (!report) {
    lines.push('  no ingest report was emitted (the engine returned before onDone)');
  } else {
    const fields: Array<[string, string | number | boolean]> = [];
    fields.push(['source', report.sourceFile]);
    fields.push(['success', report.success]);
    if (report.skipped) fields.push(['skipped', JSON.stringify(report.rejectedFiles ?? [])]);
    if (report.errorMessage) fields.push(['error', report.errorMessage]);
    fields.push(['new entity pages', report.entitiesCreated]);
    fields.push(['new concept pages', report.conceptsCreated]);
    fields.push(['pages created', report.createdPages.length]);
    fields.push(['pages updated', report.updatedPages.length]);
    fields.push(['contradictions', report.contradictionsFound]);
    fields.push(['failed items', report.failedItems.length]);
    for (const [key, value] of fields) {
      lines.push(`  ${key.padEnd(18)} ${value}`);
    }
  }

  const totalCalls = byTask.reduce((sum, [, u]) => sum + u.calls, 0);
  lines.push(
    `  llm calls         ${totalCalls}`,
    `  tokens in         ${tokens.in}`,
    `  tokens out        ${tokens.out}`,
  );

  lines.push('', '=== Where the time went ===');
  // mode / think = the policy each step RESOLVED (specific → wildcard →
  // default), so a run with data.json taskPolicies (#490) is distinguishable
  // from an identical one without them (PR #511 review, DocTpoint finding 3).
  lines.push('  step               calls   seconds   share  mode         think');
  const wall = byTask.reduce((sum, [, u]) => sum + u.millis, 0) || 1;
  for (const [name, usage] of byTask) {
    const policy = resolveTaskPolicy(policies, name);
    lines.push(
      `  ${name.padEnd(18)} ${String(usage.calls).padStart(5)}`
      + ` ${(usage.millis / 1000).toFixed(1).padStart(10)}`
      + ` ${(100 * usage.millis / wall).toFixed(0).padStart(6)}%`
      + ` ${policy.outputMode.padEnd(12)} ${policy.thinking}`,
    );
  }
  lines.push(`  elapsed           ${(elapsedMs / 1000).toFixed(1)}s`);

  process.stdout.write(lines.join('\n') + '\n');
}

export async function runIngest(vaultRoot: string, sourcePath: string): Promise<IngestReport | null> {
  if (!Platform.isDesktop) throw new Error('runIngest is desktop-only');
  const { nodeFs } = await loadNodeModules();

  let vaultStat: import('node:fs').Stats;
  try {
    vaultStat = nodeFs.statSync(vaultRoot);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Vault does not exist: ${vaultRoot}`, { cause: err });
    }
    throw err;
  }
  if (!vaultStat.isDirectory()) {
    throw new Error(`Vault is not a directory: ${vaultRoot}`);
  }

  const settings = await loadSettings(vaultRoot);
  settings.apiKey = await resolveApiKey(settings.provider);

  // Measurement arms — env-only (positional CLI cannot express them); applied
  // to settings before snapshotting so per-step metrics reflect the arm, and
  // echoed in the `[cli]` header so the log names which arm produced the
  // table that follows (Issue #507 DocTpoint comment 2). Unknown values THROW
  // rather than no-op — an arm must never silently not-run while its header
  // claims it did (PR #511 review, DocTpoint finding 3).
  const thinkingMode = process.env.WIKI_THINKING_MODE;
  applyMeasurementArms(settings, process.env);

  const app = await createVaultApp(vaultRoot);
  const sourceFile = resolveSourceFile(app, sourcePath);

  await preloadLLMClientModules();
  const tokens = { in: 0, out: 0 };
  const client = withTokenTracking(createLLMClient(settings), tokens);
  const getClient = (): LLMClient => client;

  const engineApp = app as unknown as App;
  const schemaManager = new SchemaManager(engineApp, settings, getClient);

  let report: IngestReport | null = null;
  const engine = new WikiEngine(
    engineApp,
    settings,
    getClient,
    schemaManager,
    path => process.stdout.write(`[write] ${path}\n`),
    message => process.stdout.write(`[progress] ${message}\n`),
    finished => { report = finished; },
    crypto.subtle,
  );

  // Header names the EFFECTIVE state, not the raw env: `thinking-arm` is what
  // was requested, `disable-thinking` is what the engine will do, and
  // `task-policies` is the data.json per-step map (#490) — two runs that
  // differ only in data.json must not produce identical headers (PR #511
  // review, DocTpoint finding 3).
  const policiesText = settings.taskPolicies && Object.keys(settings.taskPolicies).length > 0
    ? formatTaskPolicyMap(settings.taskPolicies)
    : '-';
  process.stdout.write(
    `[cli] vault=${vaultRoot}\n` +
    `[cli] source=${sourceFile.path}\n` +
    `[cli] provider=${settings.provider} model=${settings.model} baseUrl=${settings.baseUrl}\n` +
    `[cli] thinking-arm=${thinkingMode ?? 'unset'} disable-thinking=${settings.disableThinking}\n` +
    `[cli] temp=${settings.extractionTemperature ?? 'server default'} top-p=${settings.extractionTopP ?? 'server default'}\n` +
    `[cli] task-policies=${policiesText}\n`,
  );

  const taskUsageBefore = snapshotTaskUsage();
  const startedAt = Date.now();
  try {
    await engine.ingestSource(sourceFile, { interactive: false });
  } finally {
    printSummary({
      byTask: taskUsageSince(taskUsageBefore),
      tokens,
      report,
      writes: app.vault.writes,
      elapsedMs: Date.now() - startedAt,
      policies: settings.taskPolicies,
    });
  }
  return report;
}

export async function main(argv: string[]): Promise<number> {
  const [vault, source] = argv;
  if (!vault || !source) {
    process.stderr.write(
      `Usage: ./run-instrument.mjs <vault> <source>\n` +
      `  Positional: <vault> <source> (in-vault path to the note to ingest).\n` +
      `  Env arms: WIKI_API_KEY (required for non-local providers)\n` +
      `            WIKI_THINKING_MODE=data-json|plugin-off|server-default\n` +
      `            WIKI_TEMP=<number>  WIKI_TOP_P=<number>\n` +
      `            OBSIDIAN_CONFIG_DIR (override .obsidian default)\n\n` +
      `This is the UPSTREAM DEV-ONLY INSTRUMENT — production CLI is:\n` +
      `  npx karpathywiki-cli ingest --sources <path> --wiki <path> --provider <id> --key <key>\n` +
      `See https://github.com/green-dalii/obsidian-llm-wiki-cli\n`,
    );
    return EXIT_USAGE;
  }
  const report = await runIngest(vault, source);
  return exitCodeForReport(report);
}