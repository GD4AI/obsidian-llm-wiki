// v1.22.2: log.md header i18n — pure-function buildLogHeader
// The first time log.md is created, it gets a header explaining the
// log and pointing to the Operation History Panel for better visualisation.
import { describe, it, expect } from 'vitest';
import { buildLogHeader } from '../../core/log-header';
import { TEXTS } from '../../texts';

describe('buildLogHeader (v1.22.2 — log header i18n)', () => {
  it('returns English header by default', () => {
    const h = buildLogHeader('en', TEXTS.en.cmdViewHistory);
    expect(h).toMatch(/# Wiki Operation Log/);
    expect(h).toMatch(/Operation History/);
  });

  it('returns Chinese header for zh', () => {
    const h = buildLogHeader('zh', TEXTS.zh.cmdViewHistory);
    expect(h).toMatch(/# Wiki 操作日志/);
    expect(h).toMatch(/操作历史/);
  });

  it('every header mentions the View operation history command', () => {
    // Issue #793: this assertion used to be a hardcoded list of the *drifted*
    // strings — `查看操作历史`, `操作履歴` and so on — which is the very value the header
    // should not have carried. It was written to match what the code produced, so it
    // pinned the defect instead of catching it. Reading the name the locale actually
    // registers is the assertion that would have failed on the day the drift appeared.
    for (const lang of Object.keys(TEXTS) as Array<keyof typeof TEXTS>) {
      const h = buildLogHeader(lang as string, TEXTS[lang].cmdViewHistory);
      expect(h, `${String(lang)} header must name its own command`)
        .toContain(TEXTS[lang].cmdViewHistory);
    }
  });

  it('falls back to English for unknown language', () => {
    const h = buildLogHeader('xx', TEXTS.en.cmdViewHistory);
    expect(h).toMatch(/# Wiki Operation Log/);
  });

  it('header is non-empty for all supported locales', () => {
    for (const lang of ['en', 'zh', 'ja', 'ko', 'de', 'fr', 'es', 'pt', 'it', 'zh-Hant']) {
      const h = buildLogHeader(lang, TEXTS[lang as keyof typeof TEXTS].cmdViewHistory);
      expect(h.length).toBeGreaterThan(50);
      expect(h).not.toMatch(/\[missing/);
    }
  });

  it('every header embeds the detection marker for language-agnostic identification', () => {
    // The <!-- llm-wiki-log-header-start --> marker is the structural
    // fingerprint isOldFormatLogHeader() uses to recognise a new-format
    // header. It must be present in every locale's output.
    for (const lang of ['en', 'zh', 'ja', 'ko', 'de', 'fr', 'es', 'pt', 'it', 'zh-Hant']) {
      const h = buildLogHeader(lang, TEXTS[lang as keyof typeof TEXTS].cmdViewHistory);
      expect(h).toMatch(/<!-- llm-wiki-log-header-start -->/);
    }
  });
});

// Issue #793, second review. The header's language and the command palette's
// language are two different settings: `language` is the interface, and
// `wikiLanguage` is the content. The palette is registered from the interface
// language, so a header written in the wiki language that quotes a command
// name from the wiki language names a command the palette does not carry.
//
// Our own vault is that case: language en, wikiLanguage de. The palette shows
// "View operation history"; a wiki-language header says "Ingestionsverlauf
// anzeigen", which is not in the palette. The user is told to run a command
// that does not exist.
describe('buildLogHeader names the command as it is registered (#793)', () => {
  it('quotes the command name it is given, not the header language\'s own', () => {
    const h = buildLogHeader('de', TEXTS.en.cmdViewHistory);
    expect(h).toContain(TEXTS.en.cmdViewHistory);
    expect(h).not.toContain(TEXTS.de.cmdViewHistory);
  });

  it('keeps the rest of the header in the header language', () => {
    const h = buildLogHeader('de', TEXTS.en.cmdViewHistory);
    expect(h).toMatch(/# Wiki Betriebsprotokoll/);
  });

  it('the command name is required, so a caller cannot silently take the header language\'s', () => {
    // Type-level contract: `buildLogHeader` takes the registered command name
    // as a required argument. The type is the documentation, and a missing
    // argument is a compile error rather than a wrong hint in the user's file.
    expect(buildLogHeader.length).toBe(2);
  });
});
