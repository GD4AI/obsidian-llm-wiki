// v1.22.2: log.md old-format auto-migration
// Pure-function logic: detect old-format header, replace with new format
// (wrapped in <!-- llm-wiki-log-header-start --> marker) while preserving
// all existing ## [date time] entries.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
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
    expect(needsLogHeaderMigration(noHeader, 'en', TEXTS.en.cmdViewHistory)).toBe(true);  // caller can still skip via other checks
  });

  it('does NOT flag empty/null content', () => {
    expect(isOldFormatLogHeader('', 'en')).toBe(false);
    expect(isOldFormatLogHeader(null, 'en')).toBe(false);
  });

  it('needsLogHeaderMigration returns true for old format, false otherwise', () => {
    const current = TEXTS.en.cmdViewHistory;
    expect(needsLogHeaderMigration('# Wiki Operation Log\n\n', 'en', current)).toBe(true);
    expect(needsLogHeaderMigration(buildLogHeader('en', current) + '## entry', 'en', current)).toBe(false);
    expect(needsLogHeaderMigration('', 'en', current)).toBe(false);
    expect(needsLogHeaderMigration(null, 'en', current)).toBe(false);
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

// Issue #876: the hint line names a command, and the name moves when the
// interface language changes. The old predicate only asked "is this the legacy
// single-line format?", so a file already in the new format was never looked at
// again — every vault that had been migrated kept the name it was migrated with.
//
// Three questions have to stay separate, and the tests are grouped that way:
//   1. is this the legacy format?          structural, marker-based
//   2. does the header block still match?  byte equality with buildLogHeader
//   3. can the block be delimited at all?  if not, DO NOT touch the file
//
describe('the header is refreshed when the command name moves (#876)', () => {
  const entries = [
    '## [2026-06-15 10:00] Ingest | notes.md',
    '',
    '**Created pages**: 5',
    '',
    '## [2026-06-16 11:30] Lint | full',
    '',
    'Some lint details',
    '',
  ].join('\n');

  /** A new-format header written under a different interface language. */
  const headerWithWrongName = buildLogHeader('en', TEXTS.de.cmdViewHistory);

  it('rewrites a current-format header whose command name is stale', () => {
    const content = headerWithWrongName + entries;
    const migrated = migrateLogHeader(content, 'en', TEXTS.en.cmdViewHistory)!;

    expect(migrated).toContain(TEXTS.en.cmdViewHistory);
    expect(migrated).not.toContain(TEXTS.de.cmdViewHistory);
  });

  it('preserves every entry byte-for-byte when only the header is rewritten', () => {
    const content = headerWithWrongName + entries;
    const migrated = migrateLogHeader(content, 'en', TEXTS.en.cmdViewHistory)!;

    // The assertion that matters: not 'the entries are still mentioned', but
    // 'the tail is the same string'. A cut that starts one byte late would
    // still satisfy a `toContain` and would corrupt the first entry.
    expect(migrated.endsWith(entries)).toBe(true);
    expect(migrated.length).toBe(buildLogHeader('en', TEXTS.en.cmdViewHistory).length + entries.length);
  });

  it('rewrites when only the header language moved, not the command name', () => {
    const content = buildLogHeader('de', TEXTS.en.cmdViewHistory) + entries;
    const migrated = migrateLogHeader(content, 'en', TEXTS.en.cmdViewHistory)!;

    expect(migrated.endsWith(entries)).toBe(true);
    expect(migrated.startsWith(buildLogHeader('en', TEXTS.en.cmdViewHistory))).toBe(true);
  });

  it('leaves an up-to-date header untouched, and says so', () => {
    const content = buildLogHeader('en', TEXTS.en.cmdViewHistory) + entries;

    expect(needsLogHeaderMigration(content, 'en', TEXTS.en.cmdViewHistory)).toBe(false);
    expect(migrateLogHeader(content, 'en', TEXTS.en.cmdViewHistory)).toBe(content);
  });

  it('is idempotent: a second pass changes nothing', () => {
    const first = migrateLogHeader(headerWithWrongName + entries, 'en', TEXTS.en.cmdViewHistory)!;
    const second = migrateLogHeader(first, 'en', TEXTS.en.cmdViewHistory)!;

    expect(second).toBe(first);
  });

  it('reports the need when only the command name differs', () => {
    expect(needsLogHeaderMigration(headerWithWrongName + entries, 'en', TEXTS.en.cmdViewHistory)).toBe(true);
    expect(needsLogHeaderMigration(headerWithWrongName + entries, 'en', TEXTS.de.cmdViewHistory)).toBe(false);
  });

  describe('fail closed: a file we cannot delimit is a file we do not touch', () => {
    it('leaves a header with no closing rule alone', () => {
      // The marker is there but the `---` that ends the block is not. Cutting
      // from the marker to the end of the file would delete every entry.
      const truncated = '<!-- llm-wiki-log-header-start -->\n# Title\n\nno terminator\n' + entries;

      expect(migrateLogHeader(truncated, 'en', TEXTS.en.cmdViewHistory)).toBe(truncated);
    });

    it('leaves the file alone when the marker is quoted inside an entry body', () => {
      // A user pastes a log header into a note, so a second marker appears.
      // Rewriting from THAT offset to the next rule would truncate the log.
      const quoted =
        '# my own heading\n\n## [2026-06-15] entry\n\n' +
        '<!-- llm-wiki-log-header-start -->\n\n---\n\nmore entries\n';

      expect(migrateLogHeader(quoted, 'en', TEXTS.en.cmdViewHistory)).toBe(quoted);
    });
  });

  it('still migrates the legacy single-line format', () => {
    // The new predicate must not swallow the case it was written for.
    const legacy = '# Wiki Operation Log\n\n' + entries;

    expect(needsLogHeaderMigration(legacy, 'en', TEXTS.en.cmdViewHistory)).toBe(true);
    const migrated = migrateLogHeader(legacy, 'en', TEXTS.en.cmdViewHistory)!;
    expect(migrated.endsWith(entries)).toBe(true);
    expect(migrated).toContain('<!-- llm-wiki-log-header-start -->');
  });
});

// A freshness check turns a one-shot migration into a standing comparison. That
// comparison is only correct if the migration asks the same question the writer
// answers, so the two languages have to be split here exactly as they are in
// `log-writer.ts` — header in the wiki's content language, command name in the
// interface language. If they are not, the migration rewrites the engine's
// header into the interface language on EVERY startup.
describe('the migration path asks the same question the log writer answers (#876)', () => {
  const source = readFileSync(new URL('../../schema/auto-maintain.ts', import.meta.url), 'utf-8');

  it('takes the header language from the wiki language, not the interface language', () => {
    expect(source).toMatch(/const headerLang = this\.settings\.wikiLanguage \?\? '';/);
  });

  it('takes the command name from the interface language', () => {
    expect(source).toMatch(/const commandName = \(TEXTS\[this\.settings\.language\] \|\| TEXTS\.en\)\.cmdViewHistory;/);
  });

  it('passes both into the decision and the rewrite', () => {
    expect(source).toMatch(/needsLogHeaderMigration\(existingLog, headerLang, commandName\)/);
    expect(source).toMatch(/migrateLogHeader\(existingLog, headerLang, commandName\)/);
  });
});
