import { describe, it, expect } from 'vitest';
import { TEXTS } from '../../texts';
import { WIKI_LANGUAGES } from '../../types';
import { SECTION_LABELS } from '../../wiki/system-prompts';

/**
 * i18n parity guard.
 *
 * getText() falls back to EN_TEXTS when a key is missing in the target
 * language, so a language file with missing keys would silently degrade to
 * English at runtime with no type error (keys are typed off TEXTS.en only).
 * This test makes such gaps fail loudly at build time.
 *
 * Added alongside the Italian (it) locale so every locale stays at full parity.
 */

const EN_KEYS = Object.keys(TEXTS.en).sort();
const LOCALES = Object.keys(TEXTS) as Array<keyof typeof TEXTS>;
const CODEX_AUTH_ENGLISH = {
  codexAuthName: 'ChatGPT Plan sign-in',
  codexAuthDesc: 'Experimental Codex OAuth access using your ChatGPT plan allowance. OpenAI Platform API billing remains separate.',
  codexAuthSignedOut: 'Not signed in',
  codexAuthSignedIn: 'Signed in',
  codexAuthBrowserButton: 'Sign in with browser',
  codexAuthDeviceButton: 'Use device code',
  codexAuthDeviceInstructions: 'Enter this code on the OpenAI page: {}',
  codexAuthSignOutButton: 'Sign out',
  codexAuthBusy: 'Waiting for OpenAI authorization...',
  codexAuthRequired: 'Sign in to ChatGPT Plan before testing the connection.',
  codexAuthFailed: 'ChatGPT authorization failed: {}',
  codexAuthQuota: 'ChatGPT Codex allowance reached. Wait for the displayed reset period and try again.',
  codexAuthExperimental: 'Experimental: availability follows OpenAI Codex authentication and model policies.',
} as const;

describe('UI text parity across all locales', () => {
  it('defines the canonical English Codex authentication copy', () => {
    for (const [key, value] of Object.entries(CODEX_AUTH_ENGLISH)) expect(TEXTS.en[key as keyof typeof TEXTS.en]).toBe(value);
  });

  it.each(LOCALES)('locale "%s" defines every Codex authentication key', (locale) => {
    const texts = TEXTS[locale] as unknown as Record<string, unknown>;
    for (const key of Object.keys(CODEX_AUTH_ENGLISH)) expect(typeof texts[key], `missing ${key} in ${locale}`).toBe('string');
  });

  // The contract getText() relies on: every locale must cover every EN key,
  // otherwise it silently falls back to English at runtime. (Extra keys are
  // harmless dead entries — some pre-existing locales carry orphan keys — so
  // this guard intentionally checks only for *missing* keys here.)
  it.each(LOCALES)('locale "%s" covers every en key', (locale) => {
    const keys = Object.keys(TEXTS[locale]);
    const missing = EN_KEYS.filter((k) => !keys.includes(k));
    expect(missing, `missing keys in ${locale}`).toEqual([]);
  });

  it.each(LOCALES)('locale "%s" has no empty string values', (locale) => {
    const empties = Object.entries(TEXTS[locale])
      .filter(([, v]) => typeof v === 'string' && v.trim() === '')
      .map(([k]) => k);
    expect(empties, `empty values in ${locale}`).toEqual([]);
  });

  // Every locale (including the legacy ones) is held to strict bidirectional
  // parity: no missing keys and no extra keys versus en. Real-world hit:
  // ZH had `lintReportPageCount` as an orphan from PR #110 (status-bar
  // mirror) without an EN counterpart — exactly the bug this guard exists
  // to prevent. Italian's check is now part of this parameterization
  // (instead of a one-off) so any new locale automatically gets the same
  // strict coverage.
  it.each(LOCALES)('locale "%s" is at exact bidirectional parity with en', (locale) => {
    const keys = Object.keys(TEXTS[locale]).sort();
    expect(keys).toEqual(EN_KEYS);
  });
});

describe('Italian locale wiring', () => {
  it('exposes the Italian UI locale', () => {
    expect(TEXTS.it).toBeDefined();
    expect(TEXTS.it.languageIt).toBe('Italiano');
  });

  it('registers Italian as a selectable wiki output language', () => {
    expect(WIKI_LANGUAGES.it).toBe('Italiano');
  });

  it('provides Italian wiki section labels with full coverage', () => {
    expect(SECTION_LABELS.it).toBeDefined();
    const enLabelKeys = Object.keys(SECTION_LABELS.en).sort();
    const itLabelKeys = Object.keys(SECTION_LABELS.it).sort();
    expect(itLabelKeys).toEqual(enLabelKeys);
    for (const value of Object.values(SECTION_LABELS.it)) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });
});

// === v1.22.0: Traditional Chinese (zh-Hant) locale — 10th language ===
// BCP-47 distinguishes zh-Hans (Simplified) from zh-Hant (Traditional).
// Target users: Hong Kong / Macao / Taiwan / Malaysia / Singapore.
//
// TEXTS uses BCP-47 keys to match settings.language / WIKI_LANGUAGES exactly
// (vs. the previous CamelCase convention). This keeps every consumer
// `TEXTS[settings.language]` type-safe without per-language aliases.
describe('Traditional Chinese (zh-Hant) locale wiring', () => {
  it('exposes the Traditional Chinese UI locale (TEXTS["zh-Hant"])', () => {
    expect(TEXTS['zh-Hant']).toBeDefined();
    // Self-naming key follows the existing `languageXxx` convention.
    // Cast through `unknown` to bypass the deeply-inferred nested type
    // (TS otherwise complains about indexLabels and other sub-records).
    const hantTexts = TEXTS['zh-Hant'] as unknown as Record<string, string>;
    expect(hantTexts.languageZhHant).toBe('繁體中文');
  });

  it('registers zh-Hant as a selectable wiki output language with BCP-47 tag', () => {
    expect(WIKI_LANGUAGES['zh-Hant']).toBe('繁體中文');
  });

  it('provides Traditional Chinese wiki section labels with full coverage', () => {
    expect(SECTION_LABELS['zh-Hant']).toBeDefined();
    const enLabelKeys = Object.keys(SECTION_LABELS.en).sort();
    const hantLabelKeys = Object.keys(SECTION_LABELS['zh-Hant']).sort();
    expect(hantLabelKeys).toEqual(enLabelKeys);
    for (const value of Object.values(SECTION_LABELS['zh-Hant'])) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });
});

// === v1.26.0: Russian (ru) locale — full translation ===
// Russian i18n is the first non-Latin-script locale. Tests below pin:
//   1. TEXTS.ru exists with native self-naming key (Русский).
//   2. WIKI_LANGUAGES.ru registers for the language dropdown.
//   3. SECTION_LABELS.ru covers every EN section key with non-empty Cyrillic text.
//   4. Bidirectional parity with en (covered by parameterised test above).
describe('Russian locale wiring', () => {
  it('exposes the Russian UI locale', () => {
    expect(TEXTS.ru).toBeDefined();
    expect(TEXTS.ru.languageRu).toBe('Русский');
  });

  it('registers Russian as a selectable wiki output language', () => {
    expect(WIKI_LANGUAGES.ru).toBe('Русский');
  });

  it('provides Russian wiki section labels with full coverage', () => {
    expect(SECTION_LABELS.ru).toBeDefined();
    const enLabelKeys = Object.keys(SECTION_LABELS.en).sort();
    const ruLabelKeys = Object.keys(SECTION_LABELS.ru).sort();
    expect(ruLabelKeys).toEqual(enLabelKeys);
    for (const value of Object.values(SECTION_LABELS.ru)) {
      // Non-empty after trim; Cyrillic values pass String.trim() unchanged,
      // so this is a meaningful "translation exists" check, not just a
      // whitespace probe.
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });

  it('preserves every {placeholder} from the EN source', () => {
    // Mechanical regression guard: if a translator drops a placeholder when
    // rewriting the sentence, runtime string.replace() silently leaves the
    // {placeholder} literal in the user-visible string — this test catches it.
    const enKeys = Object.keys(TEXTS.en).sort();
    for (const key of enKeys) {
      const enVal = TEXTS.en[key as keyof typeof TEXTS.en] as unknown as string;
      const ruVal = TEXTS.ru[key as keyof typeof TEXTS.ru] as unknown as string;
      if (typeof enVal !== 'string' || typeof ruVal !== 'string') continue;
      const enPlaceholders = [...enVal.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map(m => m[1]).sort();
      const ruPlaceholders = [...ruVal.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map(m => m[1]).sort();
      expect(ruPlaceholders, `placeholder drift in key ${key}`).toEqual(enPlaceholders);
    }
  });
});

// B1 fallback-content guard (v1.26.3 PATCH follow-up): every locale's
// `fetchErrorNetwork` message must mention the API Key as a possible
// cause. The status-code classifier (settings-helpers.ts:classifyFetchError)
// catches HTTP 401/403/404/5xx and routes to a more specific category
// (fetchErrorAuth / Endpoint / Server), but true network failures
// (DNS, connection refused, timeout) still fall through to
// `fetchErrorNetwork`. Adding an "also check your API Key" hint as the
// fallback gives users a single message that covers both the network
// and the "I can't tell what went wrong" cases.
const API_KEY_HINTS: Record<string, RegExp> = {
  en:      /api\s*key/i,
  zh:      /api\s*key|密钥|秘钥|钥匙/i,
  'zh-Hant': /api\s*key|密鑰|金鑰|密鑰/i,
  ja:      /api\s*key|キー/i,
  ko:      /api\s*key|키/i,
  de:      /api[-\s]*schlüssel|key/i,
  fr:      /clé\s*api|api\s*key|key/i,
  es:      /clave\s*api|api\s*key|key/i,
  pt:      /chave[\s-]*(da\s*)?api|api\s*key|key/i,
  it:      /chiave\s*api|api\s*key|key/i,
  ru:      /api[-\s]?ключ|ключ\s*api/i,
};

describe('fetchErrorNetwork mentions API Key in every locale (B1 fallback)', () => {
  for (const [locale, pattern] of Object.entries(API_KEY_HINTS)) {
    it(`locale "${locale}" fetchErrorNetwork mentions API Key`, () => {
      const texts = TEXTS[locale as keyof typeof TEXTS] as unknown as Record<string, unknown>;
      const msg = texts.fetchErrorNetwork;
      expect(typeof msg).toBe('string');
      expect(msg as string).toMatch(pattern);
    });
  }
});

// B2.5 guard (v1.26.3 PATCH follow-up): the status-bar progress keys
// introduced for i18n (ingestBatch*, ingestCreating*, conv*, etc.) must
// preserve the EN placeholder set in every locale. If a translator drops
// or renames a placeholder, runtime getText(...).replace('{x}', ...) would
// silently leave the literal '{x}' in the user-visible string.
//
// This generalizes the existing ru-only placeholder-drift test (line 157)
// to ALL locales for the B2.5 progress keys — the user-facing strings that
// flow through composeStatusBarUpdate / onProgress every ingest run.
const B25_PROGRESS_KEYS = [
  'ingestBatchInitial',
  'ingestBatchProgress',
  'ingestBatchProcessed',
  'ingestAnalyzing',
  'ingestCreatingSummary',
  'ingestCreatingItem',
  'ingestUpdating',
  'ingestGeneratingIndex',
  'ingestItemTypeEntity',
  'ingestItemTypeConcept',
  'convAnalyzing',
  'convCheckingExisting',
  'convAlreadyExists',
  'convCreatingSummary',
  'convGeneratingSummary',
  'convSavingEntity',
  'convSavingConcept',
  'convGeneratingIndex',
] as const;

describe('B2.5 status-bar progress keys preserve EN placeholders across all locales', () => {
  it.each(LOCALES)('locale "%s" preserves every {placeholder} for B2.5 progress keys', (locale) => {
    const enTexts = TEXTS.en as unknown as Record<string, string>;
    const locTexts = TEXTS[locale] as unknown as Record<string, string>;
    for (const key of B25_PROGRESS_KEYS) {
      const enPlaceholders = [...(enTexts[key] ?? '').matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map(m => m[1]).sort();
      const locPlaceholders = [...(locTexts[key] ?? '').matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map(m => m[1]).sort();
      expect(locPlaceholders, `placeholder drift in ${locale}.${key}`).toEqual(enPlaceholders);
    }
  });

  it.each(LOCALES)('locale "%s" has non-empty B2.5 progress values', (locale) => {
    const locTexts = TEXTS[locale] as unknown as Record<string, string>;
    for (const key of B25_PROGRESS_KEYS) {
      const value = locTexts[key];
      expect(typeof value, `missing ${locale}.${key}`).toBe('string');
      expect((value ?? '').trim().length, `empty ${locale}.${key}`).toBeGreaterThan(0);
    }
  });
});

// B2.5 follow-up (v1.26.3 PATCH): the Toast keys added alongside the
// status-bar localizations — single-file ingest start, batch check, and the
// auto-lint findings phrase — feed showProgressFor → persistent Notice and
// the auto-lint completion Notice. Same placeholder-drift guard as B2.5:
// a locale dropping a {placeholder} silently leaves the literal in the
// user-visible Toast.
const TOAST_KEYS = [
  'ingestSingleFileStart',
  'ingestCheckingExisting',
  'lintFindingsSummary',
] as const;

describe('Toast keys preserve EN placeholders across all locales (B2.5 follow-up)', () => {
  it.each(LOCALES)('locale "%s" preserves every {placeholder} for Toast keys', (locale) => {
    const enTexts = TEXTS.en as unknown as Record<string, string>;
    const locTexts = TEXTS[locale] as unknown as Record<string, string>;
    for (const key of TOAST_KEYS) {
      const enPlaceholders = [...(enTexts[key] ?? '').matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map(m => m[1]).sort();
      const locPlaceholders = [...(locTexts[key] ?? '').matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map(m => m[1]).sort();
      expect(locPlaceholders, `placeholder drift in ${locale}.${key}`).toEqual(enPlaceholders);
    }
  });

  it.each(LOCALES)('locale "%s" has non-empty Toast key values', (locale) => {
    const locTexts = TEXTS[locale] as unknown as Record<string, string>;
    for (const key of TOAST_KEYS) {
      const value = locTexts[key];
      expect(typeof value, `missing ${locale}.${key}`).toBe('string');
      expect((value ?? '').trim().length, `empty ${locale}.${key}`).toBeGreaterThan(0);
    }
  });
});

describe('startupCheckDisableHint names the notice level setting in every locale', () => {
  it.each(LOCALES)('locale "%s" names the Auto Maintenance notice setting', (locale) => {
    const t = TEXTS[locale] as unknown as Record<string, string>;
    expect(t.startupCheckDisableHint).toContain(t.autoMaintainSection);
    expect(t.startupCheckDisableHint).toContain(t.startupCheckNoticeLevelName);
  });
});
