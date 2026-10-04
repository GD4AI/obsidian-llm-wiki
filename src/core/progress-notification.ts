/**
 * Semantic progress-notification channel selection.
 *
 * No user-facing setting. The decision is driven by the operation type,
 * whether the user explicitly triggered it, and whether it is long-running.
 *
 * Display channels:
 * - 'notice+status-bar' → persistent Notice + status bar. For user-triggered
 *   short ops (manual ingest, manual lint, manual smart-fix). User expects
 *   feedback because they clicked a button / ran a command.
 * - 'status-bar-only'   → status bar only. For background ops (watch-mode
 *   auto-ingest, periodic lint, startup auto-maintenance). No blocking Notice
 *   because the user did not initiate the action.
 */

export enum ProgressScope {
  IngestManual = 'ingest-manual',
  IngestAutoWatch = 'ingest-auto-watch',
  LintManual = 'lint-manual',
  LintPeriodic = 'lint-periodic',
  SmartFixManual = 'smart-fix-manual',
  AutoMaintenance = 'auto-maintenance',
}

export interface ProgressDisplayDecision {
  display: 'notice+status-bar' | 'status-bar-only';
  reason: string;
}

const BACKGROUND_SCOPES = new Set<string>([
  ProgressScope.IngestAutoWatch,
  ProgressScope.LintPeriodic,
  ProgressScope.AutoMaintenance,
]);

export function decideProgressDisplay(
  scope: ProgressScope,
  isLong: boolean,
  hasUserAction: boolean,
): ProgressDisplayDecision {
  if (BACKGROUND_SCOPES.has(scope)) {
    return {
      display: 'status-bar-only',
      reason: `${scope} is background/auto-triggered; do not show persistent Notice`,
    };
  }

  if (!hasUserAction) {
    return {
      display: 'status-bar-only',
      reason: `operation was not triggered by user; stay in status bar`,
    };
  }

  const longHint = isLong ? ' long-running' : '';
  return {
    display: 'notice+status-bar',
    reason: `user-triggered${longHint} operation; show persistent Notice + status bar`,
  };
}

/**
 * The line an open progress Notice shows while the engine reports a stage.
 * A user-triggered ingest opens the Notice with its own line (the file, or a
 * batch's "[3/10] file"); the engine's stage messages were routed as a
 * watcher ingest and never reached it, so a single ingest showed its start
 * line until the end. The stage now stands beside the opened line.
 */
export function noticeWithStage(opened: string, stage: string): string {
  return stage ? `${opened} · ${stage}` : opened;
}
