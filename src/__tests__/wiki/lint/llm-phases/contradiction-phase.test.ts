// v1.24.0: contradiction-phase extraction from controller.ts:runLintWiki.
//
// The phase does two things:
//   1. Fetch open contradictions
//   2. Render the contradiction section of the Lint report
//
// The `review_ok` auto-resolve step that once sat between them had no
// producer for that status and was removed (#604).
//
// This phase extracts the work into a single async function returning a
// structured result. The pure helper `formatContradictionReport` is
// testable in isolation; the integration tests use a stub wikiEngine.

import { describe, it, expect, vi } from 'vitest';
import {
  formatContradictionReport,
  runContradictionPhase,
  type ContradictionPhaseResult,
} from '../../../../wiki/lint/llm-phases/contradiction-phase';
import type { LintPhaseContext } from '../../../../wiki/lint/types';

// ── Pure helper: formatContradictionReport ──────────────────────

describe('formatContradictionReport', () => {
  const t = {
    lintContradictionSection: 'Contradictions (detected)',
    lintContradictionOpen: 'Open contradictions: {count}',
    lintContradictionStatusDetected: 'Detected',
    lintContradictionItem: '- [{status}] {page} — {claim}',
  };

  it('returns empty string when there are no remaining contradictions', () => {
    const result = formatContradictionReport([], t, 'wiki');
    expect(result).toBe('');
  });

  it('renders a single contradiction as a markdown bullet', () => {
    const result = formatContradictionReport(
      [{ path: 'wiki/entities/foo.md', status: 'detected', claim: 'this contradicts something' }],
      t,
      'wiki',
    );
    expect(result).toContain('## Contradictions');
    expect(result).toContain('Open contradictions: 1');
    expect(result).toContain('Detected');
    expect(result).toContain('foo');
    expect(result).toContain('this contradicts something');
  });

  it('renders multiple contradictions, one bullet per line', () => {
    const result = formatContradictionReport(
      [
        { path: 'wiki/entities/a.md', status: 'detected', claim: 'claim 1' },
        { path: 'wiki/entities/b.md', status: 'detected', claim: 'claim 2' },
      ],
      t,
      'wiki',
    );
    expect(result).toContain('Open contradictions: 2');
    expect(result).toContain('entities/a');
    expect(result).toContain('entities/b');
  });

  it('truncates claim to 80 characters', () => {
    const longClaim = 'x'.repeat(120);
    const result = formatContradictionReport(
      [{ path: 'wiki/entities/foo.md', status: 'detected', claim: longClaim }],
      t,
      'wiki',
    );
    // 80 chars + 1 whitespace = 81 chars of 'x' in the claim portion
    const xMatch = result.match(/x+/);
    expect(xMatch).not.toBeNull();
    expect(xMatch![0].length).toBe(80);
  });

  it('strips wikiFolder prefix from path to produce a relPath', () => {
    const result = formatContradictionReport(
      [{ path: 'wiki/entities/foo.md', status: 'detected', claim: 'c' }],
      t,
      'wiki',
    );
    expect(result).not.toContain('wiki/entities/foo.md');
    expect(result).toContain('entities/foo');
  });
});

// ── runContradictionPhase integration tests ─────────────────────

function makeLintPhaseContext(wikiEngine: LintPhaseContext['wikiEngine']): LintPhaseContext {
  return {
    app: {} as LintPhaseContext['app'],
    settings: { wikiFolder: 'wiki', language: 'en' } as LintPhaseContext['settings'],
    llmClient: () => null,
    wikiEngine,
    checkCancelled: () => {},
    stageNotice: { setMessage: () => {} },
    totalPages: 0,
    buildSystemPrompt: async () => undefined,
  };
}

describe('runContradictionPhase', () => {
  it('returns empty result when there are no open contradictions', async () => {
    const wikiEngine = {
      getOpenContradictions: vi.fn().mockResolvedValue([]),
      // v1.25.11 PATCH #169: contradiction phase now mirrors the stage
      // label to the status bar via ctx.wikiEngine.updateStatusBar.
      updateStatusBar: vi.fn(),
    } as unknown as LintPhaseContext['wikiEngine'];
    const ctx = makeLintPhaseContext(wikiEngine);
    const result: ContradictionPhaseResult = await runContradictionPhase(ctx);
    expect(result).toEqual({ report: '', remaining: 0 });
  });

  it('renders every open record and touches none of them', async () => {
    const open = [
      { path: 'wiki/entities/a.md', status: 'detected', claim: 'c1' },
      { path: 'wiki/entities/b.md', status: 'detected', claim: 'c2' },
    ];
    const getOpen = vi.fn().mockResolvedValue(open);
    const wikiEngine = {
      getOpenContradictions: getOpen,
      updateStatusBar: vi.fn(),
    } as unknown as LintPhaseContext['wikiEngine'];
    const ctx = makeLintPhaseContext(wikiEngine);
    const result = await runContradictionPhase(ctx);
    expect(getOpen).toHaveBeenCalledTimes(1);
    expect(result.remaining).toBe(2);
    expect(result.report).toContain('## Contradictions');
    expect(result.report).toContain('Open contradictions: 2');
    expect(result.report).toContain('entities/a');
    expect(result.report).toContain('entities/b');
  });
});
