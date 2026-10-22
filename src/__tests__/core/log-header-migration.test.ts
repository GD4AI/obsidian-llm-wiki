// v1.22.2: log.md old-format auto-migration
// Pure-function logic: detect old-format header, replace with new format
// (wrapped in <!-- llm-wiki-log-header-start --> marker) while preserving
// all existing ## [date time] entries.
import { describe, it, expect } from 'vitest';
import {
  needsLogHeaderMigration,
  migrateLogHeader,
  isOldFormatLogHeader,
  buildLogHeader,
} from '../../core/log-header';
import { TEXTS } from '../../texts';

describe('log.md header migration (v1.22.2 — non-destructive, language-agnostic)', () => {
  it('detects old-format English header (single-line)', () => {
    const old = '# Wiki Operation Log\n\n';
    expect(isOldFormatLogHeader(old, 'en')).toBe(true);
  });

  it('detects old-format Chinese header (single-line)', () => {
    const old = '# Wiki 操作日志\n\n';
    expect(isOldFormatLogHeader(old, 'zh')).toBe(true);
  });

  it('detects old format in ANY language (German, Japanese, etc.)', () => {
    const oldDe = '# Wiki Betriebsprotokoll\n\n## [2026-06-15] Ingest\n';
    const oldJa = '# Wiki 操作ログ\n\n## [2026-06-15] Ingest\n';
    expect(isOldFormatLogHeader(oldDe, 'de')).toBe(true);
    expect(isOldFormatLogHeader(oldJa, 'ja')).toBe(true);
  });

  it('detects old format even when entry body contains common short phrases', () => {
    // Regression: a log entry that mentions "操作历史" or "View operation history"
    // in its body must not fool detection into thinking the header is new.
    const withPhraseInBody = [
      '# Wiki 操作日志',
      '',
      '## [2026-06-15 10:00] Ingest | 操作历史记录',
      '',
      '详细说明 ... 操作历史',
      '',
    ].join('\n');
    expect(isOldFormatLogHeader(withPhraseInBody, 'zh')).toBe(true);

    const withEnglishPhraseInBody = [
      '# Wiki Operation Log',
      '',
      '## [2026-06-15 10:00] Ingest | view operation history test',
      '',
    ].join('\n');
    expect(isOldFormatLogHeader(withEnglishPhraseInBody, 'en')).toBe(true);
  });

  it('does NOT flag new-format header (real header from buildLogHeader)', () => {
    // Use the actual buildLogHeader output — this is what the production
    // code generates, including the <!-- llm-wiki-log-header-start --> marker.
    const realNew = buildLogHeader('en', TEXTS.en.cmdViewHistory) + '## [2026-06-15] entry\n';
    expect(isOldFormatLogHeader(realNew, 'en')).toBe(false);
  });

  it('detects new-format header regardless of language (real buildLogHeader output)', () => {
    for (const lang of ['en', 'zh', 'zh-Hant', 'ja', 'ko', 'de', 'fr', 'es', 'pt', 'it']) {
      const realNew = buildLogHeader(lang, TEXTS[lang as keyof typeof TEXTS].cmdViewHistory) + '## [2026-06-15] Ingest\n';
      expect(isOldFormatLogHeader(realNew, lang)).toBe(false);
    }
  });

  it('treats content without marker as old format (regardless of H1 presence)', () => {
    // Detection only checks for the marker. Any content without the marker
    // — even content without an H1 — is treated as old format; needsLogHeaderMigration
    // guards the empty/null case.
    const noHeader = 'just some text without a header\n';
    expect(isOldFormatLogHeader(noHeader, 'en')).toBe(true);
    expect(needsLogHeaderMigration(noHeader, 'en')).toBe(true);  // caller can still skip via other checks
  });

  it('does NOT flag empty/null content', () => {
    expect(isOldFormatLogHeader('', 'en')).toBe(false);
    expect(isOldFormatLogHeader(null, 'en')).toBe(false);
  });

  it('needsLogHeaderMigration returns true for old format, false otherwise', () => {
    expect(needsLogHeaderMigration('# Wiki Operation Log\n\n', 'en')).toBe(true);
    expect(needsLogHeaderMigration(buildLogHeader('en', TEXTS.en.cmdViewHistory) + '## entry', 'en')).toBe(false);
    expect(needsLogHeaderMigration('', 'en')).toBe(false);
    expect(needsLogHeaderMigration(null, 'en')).toBe(false);
  });

  it('migrateLogHeader replaces old header while preserving all entries', () => {
    const old = [
      '# Wiki Operation Log',
      '',
      '## [2026-06-15 10:00] Ingest | notes.md',
      '',
      '**Created pages**: 5',
      '',
      '## [2026-06-16 11:30] Lint | full',
      '',
      'Some lint details',
      '',
    ].join('\n');
    const migrated = migrateLogHeader(old, 'en', TEXTS.en.cmdViewHistory)!;
    // New format contains Operation History hint
    expect(migrated).toMatch(/View operation history/);
    // The marker is embedded so detection stays robust
    expect(migrated).toMatch(/<!-- llm-wiki-log-header-start -->/);
    // Old entries preserved
    expect(migrated).toMatch(/## \[2026-06-15 10:00\] Ingest \| notes\.md/);
    expect(migrated).toMatch(/## \[2026-06-16 11:30\] Lint \| full/);
    expect(migrated).toMatch(/\*\*Created pages\*\*: 5/);
    expect(migrated).toMatch(/Some lint details/);
  });

  it('migrateLogHeader is idempotent on real new-format content', () => {
    // First pass: old → new
    const firstPass = migrateLogHeader('# Wiki Operation Log\n\n## [2026-06-15] entry\n', 'en', TEXTS.en.cmdViewHistory)!;
    // Second pass: new → new (must be a no-op, no duplicate header)
    const secondPass = migrateLogHeader(firstPass, 'en', TEXTS.en.cmdViewHistory);
    expect(secondPass).toBe(firstPass);
    expect(firstPass.match(/<!-- llm-wiki-log-header-start -->/g)?.length).toBe(1);
  });

  it('migrateLogHeader handles edge case: file with just header and no entries', () => {
    const onlyHeader = '# Wiki Operation Log\n\n';
    const migrated = migrateLogHeader(onlyHeader, 'en', TEXTS.en.cmdViewHistory)!;
    expect(migrated).toMatch(/View operation history/);
    expect(migrated).toMatch(/# Wiki Operation Log/);
    expect(migrated).toMatch(/<!-- llm-wiki-log-header-start -->/);
  });

  it('migrateLogHeader is a no-op on empty/null input', () => {
    expect(migrateLogHeader('', 'en', TEXTS.en.cmdViewHistory)).toBe('');
    expect(migrateLogHeader(null, 'en', TEXTS.en.cmdViewHistory)).toBe(null);
  });
});
