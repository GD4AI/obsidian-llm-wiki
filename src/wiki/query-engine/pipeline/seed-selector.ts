// PR #3 split: Tier 2 LLM-based semantic seed selection extracted from
// query-engine.ts (1340-1372).
//
// Called when the Tier 1 lex fast path returns no hits or weak signals.
// Sends the user's query + a compact list of (path, summary) pairs to
// the LLM, which returns up to 3 page paths as seeds. The LLM is the
// primary semantic matcher here — handles synonyms, cross-language
// aliases, and abstract queries that pure string matching can't reach.
//
// On failure (LLM unavailable, parse error, network timeout, persistent
// empty), returns [] and the caller falls back to whatever the lex
// fast path returned. See transient-retry.ts for the Bug B retry policy.

import { PageRef, formatPageRefSummary } from '../../../core/ppr-cascade';
import { parseJsonResponse } from '../../../core/json';
import { withTransientRetry } from '../../../core/transient-retry';
import {
  SEED_SELECTION_SYSTEM_PROMPT,
  buildSeedSelectionUserPrompt,
} from '../../prompts/seed-selection';
import { resolveModelForTask } from '../../../core/model-resolver';
import { TOKENS_QUERY_SEED_SELECT, QUERY_SEED_LLM_MAX_CANDIDATES } from '../../../constants';
import { SeedSelectorSchema, type SeedSelector } from '../../../llm-sdk/output-schemas';
import type { z } from 'zod';

/** Minimal LLMClient surface — typed-output is OPTIONAL. Test mocks may not
 *  implement `createMessageWithOutput` (they pre-date v1.26.3 PATCH Phase B).
 *  The helper falls back to `createMessage` + parseJsonResponse when the
 *  typed method is missing.
 */
export interface SeedLLMClient {
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

/** Settings surface used by seed selector — disableThinking / model only.
 *  v1.24.0 #208: per-task `queryModel` override is read via
 *  `resolveModelForTask(settings, 'query')`. The seed selector runs
 *  inside the Query Wiki flow, so it uses the 'query' domain. The
 *  interface declares only the fields the helper reads so call sites
 *  with partial settings (e.g. test fixtures) still type-check.
 */
export interface SeedSelectorSettings {
  model: string;
  queryModel?: string;
  disableThinking?: boolean;
}

/**
 * v1.26.3 PATCH Phase B (Issue #443): typed-output path for seed
 * selection. Uses `createMessageWithOutput` if the client implements
 * it; falls back to `createMessage` + parseJsonResponse for legacy
 * clients (Anthropic / OpenAI / Codex / pre-Phase-B mocks).
 *
 * Returns the parsed `seeds` array — empty array is a valid answer
 * (the prompt's task 4 says "no relevant pages → []"). Throws on
 * shape mismatch so `withTransientRetry` can retry.
 */
async function selectSeedsWithTypedOutput(
  client: SeedLLMClient,
  model: string,
  system: string,
  userPrompt: string,
  disableThinking: boolean | undefined,
): Promise<string[]> {
  // Debug log: response length + first 100 chars AFTER the call.
  // Critical for diagnosing empty-body / truncated / unexpected-shape
  // responses that previously caused silent seed-selector failures.
  // JSON.stringify escapes control chars (matches fix-runners.ts style).
  const logResponse = (response: string) => {
    console.debug(
      `[LLM response] Seed selection: length=${response.length}, ` +
      `first100=${JSON.stringify(response.slice(0, 100))}`,
    );
  };

  // OPT-IN path: client implements the typed-output method.
  if (client.createMessageWithOutput) {
    const result = await client.createMessageWithOutput<SeedSelector>({
      model,
      max_tokens: TOKENS_QUERY_SEED_SELECT,
      system,
      messages: [{ role: 'user', content: userPrompt }],
      response_format: { type: 'json_object', schema: SeedSelectorSchema },
      ...(disableThinking ? { enableThinking: false } : {}),
    });
    // Tier 0 success: `output` is populated by SDK parse.
    if (result.output && Array.isArray(result.output.seeds)) {
      logResponse(result.text);
      return result.output.seeds;
    }
    // Tier 1 / Tier 2 success: `output` is undefined, fall back to
    // parsing the raw text. This is the same code path the legacy
    // createMessage flow takes — it MUST stay identical so behavior
    // is unchanged for callers that haven't migrated.
    logResponse(result.text);
    const parsed = await parseJsonResponse(result.text, undefined, {
      silentOnEmpty: true,
      throwOnEmpty: true,
    }) as SeedSelector | null;
    if (!parsed || !Array.isArray(parsed.seeds)) {
      throw new Error('parseJsonResponse returned null or non-array seeds');
    }
    return parsed.seeds;
  }

  // LEGACY path: client doesn't implement createMessageWithOutput.
  // Identical to pre-Phase-B behavior — Tier 1 (json_object) wire shape,
  // caller-side parseJsonResponse.
  const response = await client.createMessage({
    model,
    max_tokens: TOKENS_QUERY_SEED_SELECT,
    system,
    messages: [{ role: 'user', content: userPrompt }],
    response_format: { type: 'json_object' },
    ...(disableThinking ? { enableThinking: false } : {}),
  });
  logResponse(response);
  const parsed = await parseJsonResponse(response, undefined, {
    silentOnEmpty: true,
    throwOnEmpty: true,
  }) as SeedSelector | null;
  if (!parsed || !Array.isArray(parsed.seeds)) {
    throw new Error('parseJsonResponse returned null or non-array seeds');
  }
  return parsed.seeds;
}

/**
 * Pure function — no `this`, no plugin reference. Caller (QueryView.buildWikiContext)
 * passes the LLMClient (which may be undefined → returns []) + settings.
 *
 * Validates returned paths against the input pageRefs so an LLM that
 * hallucinates paths gets dropped before they reach the cascade.
 */
export async function selectSeedsWithLLM(
  query: string,
  pageRefs: PageRef[],
  client: SeedLLMClient | undefined,
  settings: SeedSelectorSettings,
): Promise<string[]> {
  if (!client) return [];
  if (pageRefs.length === 0) return [];

  // v1.24.1 PATCH Phase 5.5.0: feed the LLM `path + title + aliases`,
  // NOT `path + summary`. User vault pages frequently lack `summary`
  // frontmatter (e.g. entities/Janus.md has no summary field but rich
  // aliases), so summary-only input caused the persistent empty-seed
  // bug. Aliases carry the curated "what is this page" signal — they
  // are stable, short, and explicitly written by the user/ingestion.
  // Page list is capped at QUERY_SEED_LLM_MAX_CANDIDATES (50)
  // to keep the prompt bounded; lex-ranked candidates are passed in
  // by the caller (see select-seeds.ts Stage 1.5).
  const pagesList = pageRefs
    .slice(0, QUERY_SEED_LLM_MAX_CANDIDATES)
    .map(p => formatPageRefSummary(p))
    .join('\n');

  // Bug B+ fix: split into system + user. DeepSeek in JSON mode returns
  // empty body if no system message is provided (status 200, body='').
  // Keeping the role instructions in the system field forces a proper
  // response from the LLM.
  //
  // Wrap the LLM call + JSON parse in withTransientRetry so a
  // transient empty-string response or malformed JSON is retried.
  // The `fn` performs both steps so parse failures naturally surface
  // as thrown errors caught by the retry helper. We do NOT pass
  // `isTransientEmpty` because an empty `seeds` array is a valid
  // answer per the prompt's task 4 ("no relevant pages" → []).
  const retryResult = await withTransientRetry({
    fn: async () => {
      // v1.24.0 #208: log resolved query model for e2e verification.
      const queryModel = resolveModelForTask(settings, 'query');
      console.debug('[selectSeedsWithLLM] query model:', queryModel);
      const userPrompt = buildSeedSelectionUserPrompt(query, pagesList);
      return selectSeedsWithTypedOutput(
        client,
        queryModel,
        SEED_SELECTION_SYSTEM_PROMPT,
        userPrompt,
        settings.disableThinking,
      );
    },
    label: 'Seed selection',
    isAuthError: (error) => {
      const statusCode = (error as { statusCode?: number }).statusCode;
      return statusCode === 401 || statusCode === 403;
    },
    isRateLimitError: (error) => {
      const statusCode = (error as { statusCode?: number }).statusCode;
      return statusCode === 429;
    },
  });

  if (retryResult.error) {
    return [];
  }

  const rawSeeds = retryResult.value ?? [];

  // Validate against pageRefs — drop any paths that don't exist.
  const validPaths = new Set(pageRefs.map(p => p.path));
  return rawSeeds.filter(s => validPaths.has(s));
}
