// Issue #888: the legacy migration path deletes the first entry when the file
// does not start with an H1.
//
// The legacy branch removes a line — the H1 — and then prepends the new header.
// That is only a header removal if the file STARTS with an H1. When nothing
// matches, the cut index stays at 0 and the loop below advances past line 0,
// which is then an entry. The result is silent data loss: `AutoMaintain` Phase
// 4.5 writes the returned string back, and the entry is simply gone.
//
// These tests are in their own file rather than added to the migration suite so
// that a change to the header-block handling cannot mask a change to the legacy
// cut. The two paths share a predicate and nothing else.
import { describe, it, expect } from 'vitest';
import { migrateLogHeader } from '../../core/log-header';
import { TEXTS } from '../../texts';

const HEADER = '<!-- llm-wiki-log-header-start -->';
const cmd = TEXTS.en.cmdViewHistory;

/** A file nobody gave a header to, but which is still a log. */
const entriesOnly = [
  '## [2026-06-15 10:00] Ingest | notes.md',
  '',
  '**Created pages**: 5',
  '',
  '## [2026-06-16 11:30] Lint | full',
  '',
].join('\n');

describe('the legacy cut runs only on the legacy shape (#888)', () => {
  it('returns a headerless file of entries unchanged', () => {
    const out = migrateLogHeader(entriesOnly, 'en', cmd);

    // The assertion that matters: the first entry is still there.
    expect(out).toContain('## [2026-06-15 10:00] Ingest | notes.md');
    expect(out).toBe(entriesOnly);
  });

  it('returns free text without a heading unchanged', () => {
    const text = 'just some text\n';
    expect(migrateLogHeader(text, 'en', cmd)).toBe(text);
  });

  it('does not touch a file whose first non-blank line is not a heading', () => {
    const indented = '\n\nsome intro paragraph\n\n# A heading much later\n';
    expect(migrateLogHeader(indented, 'en', cmd)).toBe(indented);
  });

  it('still migrates the real legacy shape', () => {
    const legacy = '# Wiki Operation Log\n\n' + entriesOnly;
    const out = migrateLogHeader(legacy, 'en', cmd)!;

    expect(out).toContain(HEADER);
    expect(out).toContain('View operation history');
    // The heading survives inside the new header, so the check is that it
    // appears exactly once — a duplicated H1 is what a wrong cut looks like.
    expect(out.split('# Wiki Operation Log').length).toBe(2);
    expect(out.endsWith(entriesOnly)).toBe(true);
  });

  it('still migrates a legacy file that opens with blank lines', () => {
    const legacy = '\n# Wiki Operation Log\n\n' + entriesOnly;
    const out = migrateLogHeader(legacy, 'en', cmd)!;

    expect(out.startsWith(HEADER)).toBe(true);
    expect(out.endsWith(entriesOnly)).toBe(true);
  });

  it('is a no-op on a file that already carries the current header', () => {
    // Built by the same function, so this doubles as the idempotency guard for
    // the shape check: a migrated file must not look "headerless" afterwards.
    const migrated = migrateLogHeader('# Wiki Operation Log\n\n' + entriesOnly, 'en', cmd)!;

    expect(migrateLogHeader(migrated, 'en', cmd)).toBe(migrated);
  });
});
