// Issue #793 — one fact stored twice, and it drifted in ten of eleven locales.
//
// Each locale names the same command twice: `cmdViewHistory` is the name Obsidian
// actually registers, and `logHeaderShortcut` is a hint printed into the user's log
// header that quotes it again. Measured across all eleven locale files, `en` is the
// only one where the two agree. `ru` is the worst: it quotes the **English** name
// inside Russian guillemets, so a Russian user reading their own log header is told to
// look for a string their UI never shows.
//
// The second defect is the translated READMEs. Each quotes a command name next to
// `Cmd+P/Ctrl+P`, and in ten of eleven they quote the English one — a string that does
// not appear in that language's command palette. #780 corrected the English string and
// left the other ten, so for them it swapped one wrong string for another.
//
// Both halves are pinned here rather than by a convention in the docs, because both are
// mechanical mistakes a translator can make again on the next string they add.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TEXTS } from '../../texts';
import { buildLogHeader } from '../../core/log-header';

const LOCALES = Object.keys(TEXTS) as Array<keyof typeof TEXTS>;

/**
 * Render a locale's shortcut hint.
 *
 * Shape-tolerant on purpose: before the fix the field is a string that restates the
 * name, after it is a function of `cmdViewHistory`. Reading it this way lets the same
 * assertion describe the defect and the fix, so the test is a specification rather than
 * a snapshot of one implementation.
 */
function renderShortcut(locale: keyof typeof TEXTS): string {
  const t = TEXTS[locale] as unknown as { logHeaderShortcut: unknown; cmdViewHistory: string };
  const raw = t.logHeaderShortcut;
  return typeof raw === 'function'
    ? (raw as (cmd: string) => string)(t.cmdViewHistory)
    : String(raw);
}

describe('logHeaderShortcut must not restate the command name (#793)', () => {
  for (const locale of LOCALES) {
    it(`${locale}: quotes its own cmdViewHistory`, () => {
      expect(renderShortcut(locale)).toContain(TEXTS[locale].cmdViewHistory);
    });
  }

  it("no locale quotes another locale's command name", () => {
    const offences: string[] = [];
    for (const locale of LOCALES) {
      const shortcut = renderShortcut(locale);
      const own = TEXTS[locale].cmdViewHistory;
      for (const other of LOCALES) {
        if (other === locale) continue;
        const foreign = TEXTS[other].cmdViewHistory;
        // Locales that happen to share a spelling are not evidence of anything.
        if (foreign === own) continue;
        if (shortcut.includes(foreign)) offences.push(`${locale} quotes ${other}: ${foreign}`);
      }
    }
    expect(offences).toEqual([]);
  });

  it("the rendered log header carries the locale's command name", () => {
    const offences: string[] = [];
    for (const locale of LOCALES) {
      if (!buildLogHeader(locale as string).includes(TEXTS[locale].cmdViewHistory)) {
        offences.push(String(locale));
      }
    }
    expect(offences).toEqual([]);
  });
});

/**
 * The ten translated READMEs and their locale key. `docs/README.md` is the English
 * source and has no locale.
 */
const README_BY_LOCALE: Record<string, string> = {
  zh: 'docs/README_CN.md',
  'zh-Hant': 'docs/README_ZH-Hant.md',
  ja: 'docs/README_JA.md',
  ko: 'docs/README_KO.md',
  de: 'docs/README_DE.md',
  fr: 'docs/README_FR.md',
  es: 'docs/README_ES.md',
  pt: 'docs/README_PT.md',
  it: 'docs/README_IT.md',
  ru: 'docs/README_RU.md',
};

describe('a translated README must not name an English command (#793)', () => {
  // Derived from `TEXTS.en`, never hardcoded: a new command is covered the day it is
  // added, and this cannot drift from the strings the plugin actually registers.
  const enCommandEntries = Object.entries(TEXTS.en as unknown as Record<string, unknown>)
    .filter(([key, value]) => key.startsWith('cmd') && typeof value === 'string')
    .map(([key, value]) => [key, value as string] as const);

  for (const [locale, relPath] of Object.entries(README_BY_LOCALE)) {
    it(`${locale}: no English command name on a Cmd+P line`, () => {
      const text = readFileSync(resolve(process.cwd(), relPath), 'utf8');
      const localised = TEXTS[locale as keyof typeof TEXTS] as unknown as Record<string, unknown>;
      const offences: string[] = [];
      for (const line of text.split('\n')) {
        if (!line.includes('Cmd+P')) continue;
        // Scoped to the shortcut form, exactly as the issue states it
        // (`Cmd+P → "..."`). Everything before the shortcut on the same line is the
        // feature label in the table's first column, which several locales still carry
        // in English — a translation gap, and a different defect from this one. Taking
        // the tail keeps that out of scope instead of forcing a rewrite here.
        const afterShortcut = line.slice(line.indexOf('Cmd+P'));
        for (const [key, enValue] of enCommandEntries) {
          // Key-aligned, not value-aligned. A locale may legitimately register the same
          // spelling as English — Italian does for `cmdLintWiki`, which is `Lint wiki`
          // in both — and asserting "no English name" would fail a correct file. Only a
          // name that differs from *this locale's* registered string is evidence.
          const localValue = localised[key];
          if (typeof localValue === 'string' && localValue === enValue) continue;
          if (afterShortcut.includes(enValue)) offences.push(`${key}: ${enValue}`);
        }
      }
      expect(offences, `${relPath} quotes English command names`).toEqual([]);
    });
  }
});
