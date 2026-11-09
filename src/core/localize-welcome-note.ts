// localize-welcome-note.ts — D8 Welcome note LLM dynamic translation
//
// v1.23.0 design (D8, user-locked 2026-06-23):
//   - Welcome content = 1 English template (no 10-locale hardcoded i18n)
//   - At write time, the plugin LLM-translates the body into the user's
//     `wikiLanguage` if the LLM is configured and reachable.
//   - On LLM failure, fall back to writing the English template (so the
//     user always gets a usable note) and surface the error so the caller
//     can show a "Run Configuration Test" Notice.
//
// Why a separate module from ensure-welcome-note:
//   - Pure translation logic with no vault dependency → easy to unit test
//   - The orchestrator (ensure-welcome-note) keeps single responsibility
//     (probe vault → tier → smoke-test → render → write)
//   - Recreate Welcome Note command can re-use the same translation
//     helper without going through the tier-detection path.
//
// Fallback chain (in this order):
//   1. targetLanguage === 'en' → return English body, no LLM call
//   2. LLM call succeeds + returns parseable JSON with `translated` → use it
//   3. LLM throws OR returns invalid/empty → fall back to English body +
//      populate `error` field so the caller can surface a Notice

import type { LLMClient } from '../types';
import { TOKENS_PAGE_GENERATION } from '../constants';
import { WelcomeTranslationLLMSchema } from './welcome-translation-schema';
import { callLlm } from './llm-dispatch';
import { parseJsonResponse } from './json';

/**
 * max_tokens for the translation LLM call. We use the ingest-scale
 * `TOKENS_PAGE_GENERATION` (8000) so the response has enough headroom
 * for the full translated markdown plus the JSON wrapper. The
 * `response_format: { type: "json_object" }` directive (the only
 * client-controlled knob we set) coerces the model into emitting a
 * parseable object.
 *
 * Why we don't pass `enableThinking` / `temperature`: the LLMClient
 * default for those matches what every other business call (ingest,
 * query, lint) uses, so the translation exercises the same code path.
 *
 * Why 8000 (not 1500 or some smaller value): the OpenAI-compat client
 * has a built-in retry that bumps max_tokens when it sees the
 * response truncated, but for a 200-300 line Welcome note the
 * translated JSON is ~2000-3000 tokens. Anything below 3000 risks
 * the retry happening, which still fails, and we silently fall back
 * to English.
 */
const TRANSLATION_MAX_TOKENS = TOKENS_PAGE_GENERATION;

export interface LocalizeArgs {
  /** English body produced by buildWelcomeNote. Will be translated if targetLanguage ≠ 'en'. */
  englishBody: string;
  /**
   * Target language code. Standard codes ('en', 'zh', 'ja', ...) or a
   * custom string (user's wikiLanguage setting). 'en' short-circuits
   * the LLM call entirely.
   */
  targetLanguage: string;
  /** LLM client to use for the translation request. Required. */
  llmClient: LLMClient;
  /** Model name to pass to the LLM. */
  model: string;
  /** Optional AbortSignal to cancel the in-flight LLM call. */
  signal?: AbortSignal;
}

export interface LocalizeResult {
  /** True if we got a usable translated body. False on LLM failure (English fallback used). */
  ok: boolean;
  /**
   * The final body to write to the vault. Either the LLM-translated
   * body (ok=true) or the original English body (ok=false).
   */
  body: string;
  /**
   * True if `body` is the LLM-translated content. False if it's the
   * English fallback. Useful for the caller's "Run Configuration Test"
   * Notice decision.
   */
  localized: boolean;
  /**
   * Set when ok=false. Human-readable reason for the failure. Used by
   * the caller to populate the "Run Configuration Test" Notice.
   */
  error?: string;
}

/**
 * Map of language codes to human-readable language names. Used to
 * instruct the LLM which language to translate into. Falls back to
 * passing the code itself for unknown / custom languages.
 */
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  zh: 'Simplified Chinese',
  'zh-Hant': 'Traditional Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  de: 'German',
  fr: 'French',
  es: 'Spanish',
  pt: 'Portuguese',
  it: 'Italian',
  ru: 'Russian',
};

/**
 * Translate an English Welcome note body into the user's wikiLanguage.
 * Falls back to the English body on any LLM failure (so the user always
 * gets a usable note).
 *
 * NEVER throws. All errors are caught and converted to LocalizeResult.
 */
export async function localizeWelcomeNote(args: LocalizeArgs): Promise<LocalizeResult> {
  const { englishBody, targetLanguage, llmClient, model, signal } = args;

  // Short-circuit: English is the source. Skip the LLM call entirely.
  if (!targetLanguage || targetLanguage === 'en') {
    return { ok: true, body: englishBody, localized: false };
  }

  const languageName = LANGUAGE_NAMES[targetLanguage] ?? targetLanguage;
  const system = [
    'You are a translation engine for a personal knowledge-management wiki plugin.',
    `Translate the user's Markdown document into ${languageName}.`,
    'Preserve all Markdown syntax verbatim: headings (##, ###), bullet lists, checkboxes (- [ ] / - [x]), blockquotes (>),',
    'horizontal rules (---), inline code (`...`), fenced code blocks (```...```), and HTML comments (<!-- ... -->).',
    'Preserve all [[wiki-links]] exactly as written (do not translate the target path).',
    'Preserve frontmatter (--- at start and end) verbatim — only translate the `title` value if present.',
    'Preserve the closing <!-- end auto-generated --> marker.',
    'Respond with a single JSON object: {"translated": "<full translated markdown>"}. No prose before or after.',
  ].join(' ');

  try {
    console.debug(`[localizeWelcomeNote] target=${targetLanguage}, model=${model}, max_tokens=${TRANSLATION_MAX_TOKENS}, bodyLen=${englishBody.length}`);
    // v1.26.3 PATCH Issue #443 expanded scope: typed-output path.
    // WelcomeTranslationLLMSchema ({translated: string}) on the wire as Tier 0
    // json_schema — LMStudio accepts, no <|channel>thought / ```json``` fence
    // wraparound to work around. The schema enforces the wire shape; the
    // legacy `extractTranslatedField` helper (regex fence stripper) is now
    // dead — parseJsonResponse handles the same variants uniformly with
    // greedy regex + repair. Single decode path for both modern and legacy
    // clients.
    const translateArgs = {
      task: 'welcome-translate' as const,
      model,
      max_tokens: TRANSLATION_MAX_TOKENS,
      system,
      messages: [{ role: 'user' as const, content: englishBody }],
      response_format: { type: 'json_object' as const, schema: WelcomeTranslationLLMSchema },
      // Issue #506: translation is a text task — reasoning budget spent
      // here is the root cause of NoOutputGeneratedError on first-run
      // onboarding (reasoning channel consumes maxOutputTokens, content
      // stays empty). Layer 1 of the four-layer doctrine; the wire shape
      // is pinned by the localize-welcome-note wire test.
      enableThinking: false as const,
      // Note: no signal param in current LLMClient interface, but caller
      // can pass signal via signal on the request and we ignore at this
      // level. Future: plumb through AbortSignal once interface widens.
      ...(signal ? {} : {}),
    };
    const raw = await callLlm(llmClient, translateArgs);
    // Two-tier decode:
    //   1. parseJsonResponse — strips ``` fences, <think>/<thinking> blocks,
    //      and extracts the first balanced JSON object. Handles the common
    //      case and the LMStudio `<|channel>thought` + ```json``` wrap.
    //   2. extractTranslatedField — key-directed fallback. parseJsonResponse
    //      returns the FIRST balanced top-level object, which can be the
    //      WRONG one when the model nests the translation (`{"result":{...}}`)
    //      or emits a preamble object. The key-directed walk finds the
    //      `"translated"` key's own object. Restored per code-review P1
    //      (2026-08-11): without it, 3 legacy response shapes regress to the
    //      English fallback on createMessage-only clients.
    const parsed = await parseJsonResponse(raw) as { translated?: unknown } | null;
    const translated = typeof parsed?.translated === 'string'
      ? parsed.translated
      : extractTranslatedField(raw);
    console.debug(`[localizeWelcomeNote] LLM returned. rawLen=${raw?.length ?? 0}, preview=${JSON.stringify((raw ?? '').slice(0, 200))}`);
    if (!translated) {
      console.warn(`[localizeWelcomeNote] translated body missing. Full raw: ${JSON.stringify(raw).slice(0, 500)}`);
      return {
        ok: false,
        body: englishBody,
        localized: false,
        error: 'LLM response did not contain a valid `translated` field',
      };
    }
    console.debug(`[localizeWelcomeNote] translated bodyLen=${translated.length}`);
    return { ok: true, body: translated, localized: true };
  } catch (e) {
    console.error(`[localizeWelcomeNote] LLM call threw:`, e);
    const message = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      body: englishBody,
      localized: false,
      error: message,
    };
  }
}

/**
 * Key-directed `translated`-field extraction, used as a fallback when
 * parseJsonResponse returns the WRONG top-level object (nested `{"result":{...}}`
 * or a preamble object). Walks from the literal `"translated"` key back to its
 * owning object's `{`, then brace-balances forward to the matching `}`.
 *
 * Why this still exists after the schema migration (code-review P1, 2026-08-11):
 * Tier 0 schema enforcement produces clean `{"translated": "..."}`, but the
 * legacy createMessage-only path (Anthropic / OpenAI / Codex) and Tier 1/2
 * demotion on local backends can still emit prose/nested/duplicated-object
 * shapes. parseJsonResponse grabs the FIRST balanced object; the key-directed
 * walk grabs the one that actually carries `translated`.
 */
function extractTranslatedField(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;

  const keyIndex = raw.indexOf('"translated"');
  if (keyIndex === -1) return null;

  // Find the `{` that starts the object containing the key — scan backwards.
  let openBrace = -1;
  for (let i = keyIndex - 1; i >= 0; i--) {
    const ch = raw[i];
    if (ch === '{') { openBrace = i; break; }
    if (ch === '}' || ch === ']' || ch === ',') return null;  // key not at object start
  }
  if (openBrace === -1) return null;

  // Brace-balance forward from openBrace, tracking string + escape state so
  // escaped quotes / braces inside the translated body don't end the match.
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = openBrace; i < raw.length; i++) {
    const ch = raw[i];
    if (escape) { escape = false; continue; }
    if (inString) {
      if (ch === '\\') { escape = true; continue; }
      if (ch === '"') { inString = false; }
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        const candidate = raw.slice(openBrace, i + 1);
        try {
          const obj: unknown = JSON.parse(candidate);
          if (obj && typeof obj === 'object' && 'translated' in obj) {
            const t = (obj as Record<string, unknown>).translated;
            if (typeof t === 'string') return t;
          }
        } catch {
          return null;
        }
        return null;
      }
    }
  }
  return null;
}
