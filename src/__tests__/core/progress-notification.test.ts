import { describe, it, expect } from 'vitest';
import { decideProgressDisplay, noticeWithStage, ProgressScope } from '../../core/progress-notification';

describe('decideProgressDisplay', () => {
  it('shows notice+status for manual user-triggered short operations', () => {
    const result = decideProgressDisplay(ProgressScope.IngestManual, false, true);
    expect(result.display).toBe('notice+status-bar');
  });

  it('shows notice+status for manual user-triggered long operations', () => {
    const result = decideProgressDisplay(ProgressScope.IngestManual, true, true);
    expect(result.display).toBe('notice+status-bar');
  });

  it('shows status-only for watch-mode auto-ingest', () => {
    const result = decideProgressDisplay(ProgressScope.IngestAutoWatch, false, false);
    expect(result.display).toBe('status-bar-only');
  });

  it('shows status-only for periodic lint', () => {
    const result = decideProgressDisplay(ProgressScope.LintPeriodic, false, false);
    expect(result.display).toBe('status-bar-only');
  });

  it('shows notice+status for manual lint', () => {
    const result = decideProgressDisplay(ProgressScope.LintManual, false, true);
    expect(result.display).toBe('notice+status-bar');
  });

  it('shows notice+status for manual smart fix', () => {
    const result = decideProgressDisplay(ProgressScope.SmartFixManual, false, true);
    expect(result.display).toBe('notice+status-bar');
  });

  it('shows status-only for startup auto-maintenance', () => {
    const result = decideProgressDisplay(ProgressScope.AutoMaintenance, false, false);
    expect(result.display).toBe('status-bar-only');
  });

  it('flags unknown long user ops for notice+status', () => {
    const result = decideProgressDisplay('unknown' as ProgressScope, true, true);
    expect(result.display).toBe('notice+status-bar');
  });
});

describe('noticeWithStage', () => {
  it('keeps the line the Notice was opened with and adds the engine stage', () => {
    expect(noticeWithStage('Ingesting: Vitamin D', 'Step 3/6: writing pages')).toBe('Ingesting: Vitamin D · Step 3/6: writing pages');
  });

  it('keeps a batch counter in front of the stage', () => {
    expect(noticeWithStage('[3/10] Vitamin D', 'Step 3/6: writing pages')).toBe('[3/10] Vitamin D · Step 3/6: writing pages');
  });

  it('shows the opened line alone for an empty stage', () => {
    expect(noticeWithStage('[3/10] Vitamin D', '')).toBe('[3/10] Vitamin D');
  });
});
