// v1.24.0 #251: Custom Query Instructions — injection-site integration test.
//
// The pure helper (`appendCustomQueryInstructions`) is covered exhaustively
// in custom-instructions.test.ts. This test verifies the structural
// guarantee that the helper is wired into the 3 QueryView send sites:
//
//   1. streaming          (line ~489)
//   2. non-stream fallback (line ~521)
//   3. non-stream main    (line ~606)
//
// …and NOT wired into other LLM consumers (seed-selector, lint dedup,
// source-analyzer, page-factory, etc.) — per the strict scope guardrail
// documented in the plan.
//
// This is a static check rather than a runtime integration test because
// the QueryView ItemView scaffolding is heavy to set up in jsdom; the
// helper itself is the only runtime-relevant code, and its behavior is
// fully covered by custom-instructions.test.ts.

import { describe, it, expect } from 'vitest';
// Test-environment only — Node fs/path APIs are not used in production
// code (CLAUDE.md Obsidian Bot rule forbids Node builtins).
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'node:url';

/** Resolve paths from this test file (uses Node fs/path — test only). */
const SRC_ROOT = fileURLToPath(new URL('../../..', import.meta.url));

const queryViewPath = resolve(SRC_ROOT, 'wiki/query-engine/QueryView-class.ts');
const helperImportPath = resolve(SRC_ROOT, 'wiki/query-engine/custom-instructions.ts');

const queryViewSource = readFileSync(queryViewPath, 'utf8');
const helperSource = readFileSync(helperImportPath, 'utf8');

describe('appendCustomQueryInstructions — wired into 3 QueryView send sites', () => {
  it('QueryView imports the helper', () => {
    expect(queryViewSource).toContain(
      "import { appendCustomQueryInstructions, logCustomInstructionsInjectionContext } from './custom-instructions';",
    );
  });

  it('QueryView calls the helper exactly 3 times (one per send site)', () => {
    const callCount = (queryViewSource.match(/appendCustomQueryInstructions\(/g) || []).length;
    expect(callCount).toBe(3);
  });

  it('each send site passes the user setting from plugin.settings', () => {
    // All 3 call sites must pass `this.plugin.settings.customQueryInstructions`
    // as the second arg. Any deviation would silently break the feature.
    const occurrences = queryViewSource.match(
      /appendCustomQueryInstructions\([^)]+\)/g,
    ) || [];
    expect(occurrences.length).toBe(3);
    for (const call of occurrences) {
      expect(call).toContain('this.plugin.settings.customQueryInstructions');
    }
  });

  it('strict scope guardrail: helper is NOT called in seed-selector', () => {
    const seedSelectorPath = resolve(SRC_ROOT, 'wiki/query-engine/pipeline/seed-selector.ts');
    const seedSelectorSource = readFileSync(seedSelectorPath, 'utf8');
    expect(seedSelectorSource).not.toContain('appendCustomQueryInstructions');
  });

  it('strict scope guardrail: helper is NOT called in lint dedup phase', () => {
    const dedupPath = resolve(SRC_ROOT, 'wiki/lint/llm-phases/dedup-phase.ts');
    const dedupSource = readFileSync(dedupPath, 'utf8');
    expect(dedupSource).not.toContain('appendCustomQueryInstructions');
  });

  it('strict scope guardrail: helper is NOT called in source-analyzer', () => {
    const sourceAnalyzerPath = resolve(SRC_ROOT, 'wiki/source-analyzer.ts');
    const sourceAnalyzerSource = readFileSync(sourceAnalyzerPath, 'utf8');
    expect(sourceAnalyzerSource).not.toContain('appendCustomQueryInstructions');
  });

  it('strict scope guardrail: helper is NOT called in page-factory', () => {
    // v1.24.1 Phase 2: page-factory.ts was split into a directory of
    // module-level files under src/wiki/page-factory/. Scan every file in
    // that directory to assert the helper is not imported or referenced.
    const dir = resolve(SRC_ROOT, 'wiki/page-factory');
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.ts')) continue;
      const src = readFileSync(resolve(dir, entry.name), 'utf8');
      expect(src, `${entry.name} must not reference appendCustomQueryInstructions`).not.toContain('appendCustomQueryInstructions');
    }
  });

  it('helper module exports a stable header constant', () => {
    expect(helperSource).toContain(
      "export const CUSTOM_INSTRUCTIONS_HEADER = '# User Custom Query Instructions';",
    );
  });
});
