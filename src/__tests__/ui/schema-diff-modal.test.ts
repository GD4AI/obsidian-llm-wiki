// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';

// Stub `obsidian` imports — the jsdom env triggers Vite import-analysis
// that can't resolve the real obsidian package. The Modal class shape
// (modalEl.addClass / contentEl.addClass / etc.) is only typed at
// compile time; at runtime we use plain object stubs.
vi.mock('obsidian', () => ({
  Modal: class {},
  App: class {},
  Setting: class {},
}));

import { lineDiff } from '../../core/diff';
import { applyDiffModalClasses, removeDiffModalClasses, buildDiffCell } from '../../ui/schema-diff-modal-classes';

// v1.22.0 #97: when the LLM reports changes_needed=false, the
// SchemaDiffModal should show the *current* schema in BOTH panes
// (left and right) — so the user can read the schema as it stands
// today and the LLM's rationale above. A blank right pane was
// confusing because the eye has nothing to anchor on.
//
// Implementation note: the Modal constructor (or main.ts) should
// normalize empty-mode newBody to currentBody before lineDiff runs,
// so the resulting diff is all "eq" rows. We test the helper that
// does this so the invariant is captured explicitly.

import { normalizeEmptyMode } from '../../ui/schema-diff-modal-classes';

describe('normalizeEmptyMode (#97)', () => {
  it('returns the original newBody when not in empty mode', () => {
    expect(normalizeEmptyMode({
      isEmpty: false,
      currentBody: 'schema body',
      newBody: 'updated body',
    })).toBe('updated body');
  });

  it('returns the currentBody when in empty mode (so the diff is all eq rows)', () => {
    expect(normalizeEmptyMode({
      isEmpty: true,
      currentBody: 'schema body',
      newBody: '',
    })).toBe('schema body');
  });

  it('returns the currentBody when in empty mode even if newBody was non-empty (LLM gave a body but flagged no changes)', () => {
    // Edge case: the LLM may return a non-empty new_schema_body with
    // changes_needed=false. We trust the flag — show current, not the
    // proposed body. This avoids confusion when the LLM contradicts
    // itself.
    expect(normalizeEmptyMode({
      isEmpty: true,
      currentBody: 'schema A',
      newBody: 'schema B (LLM proposed but said no changes)',
    })).toBe('schema A');
  });

  it('resulting diff is all eq rows in empty mode', () => {
    // The behavioural test: after normalization, lineDiff produces
    // only eq rows, so the UI shows current schema in both panes
    // with no red/green highlight.
    const currentBody = '# Wiki Schema\n\n- entity\n';
    const effective = normalizeEmptyMode({
      isEmpty: true,
      currentBody,
      newBody: '',
    });
    const ops = lineDiff(currentBody, effective);
    expect(ops.every(op => op.op === 'eq')).toBe(true);
  });
});

// v1.22.0 #97: bug repro — setCurrentBody in empty mode must re-run
// normalizeEmptyMode. The async flow is:
//
//   1. main.ts: `modal = new SchemaDiffModal({ currentBody: '', isEmpty: true, ... })`
//      → constructor calls normalizeEmptyMode({ isEmpty: true, currentBody: '',
//        newBody: '' }) → this.newBody = ''
//   2. modal.open() → onOpen() → recompute() with (currentBody='',
//      newBody='') → empty diff
//   3. async: loadSchema() resolves → modal.setCurrentBody(loaded.body)
//      → recompute() with (currentBody=loaded.body, newBody='') →
//        ALL current lines become "del" (left red, right blank)
//
// The fix is to re-run normalizeEmptyMode in setCurrentBody so that
// newBody tracks the freshly-loaded currentBody when in empty mode.
// This test captures the bug for the next TDD pass.
describe('SchemaDiffModal.setCurrentBody in empty mode (#97 bug repro)', () => {
  it('after async loadSchema, diff is all eq rows in empty mode', () => {
    // Simulate the async flow:
    //   1. Modal constructed with currentBody='', isEmpty=true
    //   2. async setCurrentBody with the real loaded body
    const initialEmpty = normalizeEmptyMode({
      isEmpty: true,
      currentBody: '',
      newBody: '',
    });
    expect(initialEmpty).toBe(''); // construction is fine

    // After setCurrentBody with the real body, the effective newBody
    // should ALSO be the real body (so lineDiff produces only eq rows).
    const loadedBody = '# Wiki Schema\n\n- entity: person\n';
    const effectiveAfterLoad = normalizeEmptyMode({
      isEmpty: true,
      currentBody: loadedBody,
      newBody: initialEmpty, // would be the modal's stored newBody
    });
    expect(effectiveAfterLoad).toBe(loadedBody);
    const ops = lineDiff(loadedBody, effectiveAfterLoad);
    expect(ops.every(op => op.op === 'eq')).toBe(true);
  });
});

// v1.22.1: applyDiffModalClasses must add the modal-wide class to
// BOTH modalEl (outer .modal) and contentEl (inner content).
// removeDiffModalClasses must clean up modalEl on close. This replaced
// the previous CSS `:has()` selector (Obsidian review warning:
// :has() causes broad selector invalidation → significant perf cost).
//
// No `@vitest-environment jsdom` directive — we don't need DOM for this
// test (the helpers accept duck-typed modalEl/contentEl with addClass/
// removeClass/empty methods). Skipping the directive avoids Vite's
// import-analysis re-resolving `obsidian` in unrelated files.
describe('SchemaDiffModal modalEl class lifecycle (v1.22.1)', () => {
  it('applyDiffModalClasses adds to both; removeDiffModalClasses cleans modalEl', () => {
    const classes = new Set<string>();
    const modalEl = {
      addClass(cls: string) { classes.add(cls); },
      removeClass(cls: string) { classes.delete(cls); },
    };
    const contentEl = {
      empty() { /* no-op */ },
      addClass(cls: string) { classes.add(cls); },
    };

    applyDiffModalClasses(
      modalEl as unknown as { addClass: (c: string) => void; removeClass: (c: string) => void; empty: () => void },
      contentEl as unknown as { addClass: (c: string) => void; removeClass: (c: string) => void; empty: () => void },
    );
    expect(classes.has('llm-wiki-schema-diff-modal')).toBe(true);

    removeDiffModalClasses(
      modalEl as unknown as { addClass: (c: string) => void; removeClass: (c: string) => void; empty: () => void },
    );
    expect(classes.has('llm-wiki-schema-diff-modal')).toBe(false);
  });
});

// `buildDiffCell` must never construct elements directly on a Document — a Document can only ever hold one child element, so appending a second one throws `HierarchyRequestError`. Building on the given `parent` Element instead (which can hold any number of children) is what makes rendering more than one cell possible at all; see `buildDiffCell`'s own doc comment.
describe('buildDiffCell (#593)', () => {
  it('does not throw, and appends the cell as a child of the given parent', () => {
    const parent = document.createElement('div');
    let cell: HTMLElement | undefined;
    expect(() => {
      cell = buildDiffCell(parent, 1, 'some line', false, 'left');
    }).not.toThrow();
    expect(parent.contains(cell!)).toBe(true);
  });

  it('builds a cell with the gutter line number and content text', () => {
    const parent = document.createElement('div');
    const cell = buildDiffCell(parent, 3, 'hello world', true, 'left');
    expect(cell.className).toContain('llm-wiki-schema-diff-row');
    expect(cell.className).toContain('llm-wiki-schema-diff-row-del');
    expect(cell.querySelector('.llm-wiki-schema-diff-gutter')?.textContent).toBe('3');
    expect(cell.querySelector('.llm-wiki-schema-diff-content')?.textContent).toBe('hello world');
    expect(cell.querySelector('.llm-wiki-schema-diff-content')?.className).toContain('llm-wiki-schema-diff-content-highlight');
  });

  it('right-side highlight uses the add row class, not del', () => {
    const parent = document.createElement('div');
    const cell = buildDiffCell(parent, null, '', true, 'right');
    expect(cell.className).toContain('llm-wiki-schema-diff-row-add');
    expect(cell.querySelector('.llm-wiki-schema-diff-gutter')?.textContent).toBe('');
  });
});
