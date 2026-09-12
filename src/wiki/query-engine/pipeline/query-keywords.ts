/**
 * v1.24.1 PATCH Phase 5.5.1: query keyword generation.
 *
 * Stage 1.5a in the 5-stage seed selection pipeline. When Stage 1 (lex)
 * returns 0 hits on a 2000+ page vault, we cannot feed all pageRefs to
 * the LLM (token overflow on free-tier models: 2137 pageRefs × 50 chars
 * ≈ 30K tokens just for the page list). Instead:
 *
 *   1. Ask the LLM to extract 5-10 candidate keywords from the user's
 *      natural-language question.
 *   2. Do a local substring scan of all pageRefs (title + aliases) with
 *      those keywords — O(n) but in milliseconds, zero tokens.
 *   3. Use the matching pages as seeds for Stage 3 PPR.
 *
 * If keyword generation fails (LLM error, malformed JSON, too few
 * keywords) → return [] → caller falls back to Stage FALLBACK' (pure
 * LLM knowledge-base answer, no wiki sources).
 *
 * Per first-principles (2026-07-13, user direction): the keyword
 * prompt must be language-AGNOSTIC. Hardcoding "Chinese ↔ English"
 * breaks i18n users (e.g. Japanese, Korean, French primary speakers).
 * The LLM auto-detects the query's primary language and produces
 * keywords in BOTH that language AND English (English is the universal
 * cross-language fallback for i18n wikis that may have mixed-language
 * aliases).
 */
import { parseJsonResponse } from '../../../core/json';
import { TOKENS_QUERY_KEYWORDS } from '../../../constants';
import { QueryKeywordsSchema } from '../../../llm-sdk/output-schemas';
import type { z } from 'zod';

/** Minimal LLMClient surface — typed-output is OPTIONAL. Test mocks may not
 *  implement `createMessageWithOutput` (they pre-date v1.26.3 PATCH Phase B).
 *  The helper falls back to `createMessage` + parseJsonResponse when the
 *  typed method is missing.
 */
export interface KeywordGenClient {
  createMessage(params: {
    model: string;
    max_tokens: number;
    system?: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    response_format?: { type: 'json_object' | 'text' };
    enableThinking?: boolean;
  }): Promise<string>;
  createMessageWithOutput?<T = unknown>(params: {
    model: string;
    max_tokens: number;
    system?: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    response_format?: { type: 'json_object'; schema?: Record<string, unknown> | z.ZodType };
    enableThinking?: boolean;
  }): Promise<{ text: string; output?: T; outputMode: 'json_schema' | 'json_schema_strict' | 'json_object' | 'text_prompt' }>;
}

/** Settings surface — model + disableThinking only. */
export interface KeywordGenSettings {
  model: string;
  disableThinking?: boolean;
}

/**
 * v1.24.1 PATCH Phase 5.5.1: language-agnostic keyword extraction prompt.
 *
 * Key design points (per first-principles, user direction 2026-07-13):
 * - NO hardcoded "Chinese ↔ English" rule (would break i18n).
 * - LLM auto-detects the query's primary language.
 * - English is included as the universal fallback (i18n wikis often
 *   have English aliases for cross-language search).
 * - Output is a plain JSON array — no language categories.
 */
const KEYWORD_EXTRACTION_SYSTEM_PROMPT = `You are a multilingual query keyword extractor for a personal wiki search system.

The user has a wiki (Obsidian vault) with pages covering topics in their own language(s). The wiki page titles and aliases are written in the user's language(s). To find relevant pages via substring matching, you need to convert the user's natural-language question into a set of searchable keywords.

Your task:
1. Detect the primary language of the user's question automatically (it can be any language — Chinese, English, Japanese, Korean, French, mixed, etc.).
2. Generate 5-10 candidate keywords that would substring-match wiki page titles or aliases.
3. Always include English equivalents or translations when the concept has a recognized English term. English is the universal cross-language fallback language — many i18n wikis carry English aliases for the same concept.
4. Include synonyms, abbreviations, and domain-specific terms in the same language(s) the user used.
5. Prefer concrete nouns or short noun phrases over abstract verbs (e.g. "对比学习" or "contrastive learning", NOT "什么叫对比学习" or "what is contrastive learning").
6. If the question references a specific named concept, include that exact term verbatim.
7. Do NOT add language codes or category prefixes — just the keyword string.

Output format (strict JSON):
{
  "keywords": ["keyword1", "keyword2", "keyword3", ...]
}

Constraints:
- 5 <= keywords.length <= 10
- Each keyword should be 1-5 words/tokens, not a full sentence
- Output ONLY the JSON object, no other text
- Order keywords by relevance (most specific keyword first)
- Do NOT wrap individual keywords in quotes inside the string values (just plain strings)`;

const KEYWORD_EXTRACTION_USER_PROMPT = (query: string) => `User question: "${query}"\n\nExtract 5-10 searchable keywords for the wiki as JSON.`;

const MAX_KEYWORDS_RETURNED = 10;
// Per first-principles: even 1 useful keyword is enough to scan the
// wiki (1 keyword × 2137 pageRefs = 2137 substring checks, all local,
// milliseconds). 3 is too strict — LLM may dedupe to 1-2 high-quality
// terms which is still better than nothing.
const MIN_KEYWORDS_USEFUL = 1;
const MAX_KEYWORD_TOKEN_COUNT = 5; // 1-5 words/tokens per keyword

/**
 * Post-process the parsed keywords: dedupe (case-insensitive) + filter
 * by length + cap to MAX_KEYWORDS_RETURNED. Shared by the typed-output
 * path (Zod-validated array) and the legacy path (parseJsonResponse).
 * Non-string elements are silently skipped (Tier 1/2 tolerance), never
 * fatal — a single bad element must not drop the whole keyword list.
 */
function normalizeKeywords(rawKeywords: unknown): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const list = Array.isArray(rawKeywords) ? rawKeywords : [];
  for (const raw of list) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (trimmed.length === 0) continue;
    // Filter out sentences (count tokens by spaces)
    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount > MAX_KEYWORD_TOKEN_COUNT) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= MAX_KEYWORDS_RETURNED) break;
  }
  return out;
}

/**
 * v1.26.3 PATCH Phase B (Issue #443): typed-output path for keyword
 * generation. Uses `createMessageWithOutput` if the client implements
 * it; falls back to `createMessage` + parseJsonResponse for legacy
 * clients.
 *
 * Both paths return [] on failure — the caller falls back to Stage
 * FALLBACK' (pure LLM KB answer), so keyword generation is best-effort
 * and must never throw out of this function.
 */
async function generateKeywordsWithTypedOutput(
  client: KeywordGenClient,
  query: string,
  settings: KeywordGenSettings,
): Promise<string[]> {
  const userPrompt = KEYWORD_EXTRACTION_USER_PROMPT(query);

  // OPT-IN path: client implements the typed-output method.
  if (client.createMessageWithOutput) {
    const result = await client.createMessageWithOutput<{ keywords?: string[] }>({
      model: settings.model,
      max_tokens: TOKENS_QUERY_KEYWORDS,
      system: KEYWORD_EXTRACTION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      response_format: { type: 'json_object', schema: QueryKeywordsSchema },
      ...(settings.disableThinking ? { enableThinking: false } : {}),
    });
    // Tier 0 success: `output` is populated by SDK parse.
    if (result.output && Array.isArray(result.output.keywords)) {
      const out = normalizeKeywords(result.output.keywords);
      return out.length >= MIN_KEYWORDS_USEFUL ? out : [];
    }
    // Tier 1 / Tier 2 success: `output` undefined → parse raw text.
    const parsed = await parseJsonResponse(result.text) as { keywords?: unknown } | null;
    if (!parsed || !Array.isArray(parsed.keywords)) return [];
    const out = normalizeKeywords(parsed.keywords);
    return out.length >= MIN_KEYWORDS_USEFUL ? out : [];
  }

  // LEGACY path: client doesn't implement createMessageWithOutput.
  const response = await client.createMessage({
    model: settings.model,
    max_tokens: TOKENS_QUERY_KEYWORDS,
    system: KEYWORD_EXTRACTION_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
    response_format: { type: 'json_object' },
    ...(settings.disableThinking ? { enableThinking: false } : {}),
  });
  const parsed = await parseJsonResponse(response) as { keywords?: unknown } | null;
  if (!parsed || !Array.isArray(parsed.keywords)) return [];
  const out = normalizeKeywords(parsed.keywords);
  return out.length >= MIN_KEYWORDS_USEFUL ? out : [];
}

/**
 * Extract 5-10 candidate keywords from a natural-language query via LLM.
 * The returned keywords are intended for local substring scanning
 * against wiki pageRefs (title + aliases), NOT for direct LLM input.
 *
 * Returns:
 * - 3-10 keywords on success (deduplicated, length-validated)
 * - [] on any failure (LLM error, parse fail, too few keywords,
 *   no client) — caller falls back to LLM knowledge-base answer.
 */
export async function generateQueryKeywords(
  query: string,
  client: KeywordGenClient | undefined,
  settings: KeywordGenSettings,
): Promise<string[]> {
  if (!client) return [];
  if (!query || query.trim().length === 0) return [];

  try {
    return await generateKeywordsWithTypedOutput(client, query, settings);
  } catch (error) {
    console.debug('[generateQueryKeywords] failed:', error);
    return [];
  }
}