/**
 * v1.24.1 PATCH Phase 5.5.0 (quiet path) — distinguishes "LLM returned 0 bytes"
 * from "LLM gave garbage".
 *
 * Thrown by `parseJsonResponse` when the raw LLM response length is 0
 * (optionally after stripping thinking/think tags and code fences).
 *
 * Why an exception instead of returning null:
 *  - Returning null is ambiguous: callers historically treated null as
 *    "JSON parse failed" and triggered noisy `console.error` chains.
 *  - Empty body is a distinct, recoverable condition (thinking model
 *    ran out of token budget before emitting JSON). Callers in
 *    retry-helper flows (`withTransientRetry`) want to retry; callers
 *    in alert flows want to silently skip.
 *
 * `rawLength` is the LENGTH OF THE RAW RESPONSE (before normalization).
 * It tells callers exactly how many bytes the LLM SDK returned.
 */
export class EmptyResponseError extends Error {
  readonly rawLength: number;
  constructor(rawLength: number) {
    super(`LLM returned empty response (length ${rawLength})`);
    this.name = 'EmptyResponseError';
    this.rawLength = rawLength;
  }
}

/**
 * v1.24.1 PATCH Phase 5.5.0 (quiet path) — quiet-path options for
 * `parseJsonResponse`. Both options are empty-body-only — malformed
 * non-empty JSON keeps the legacy noisy `console.error` path (operators
 * need that signal).
 *
 * Backward-compat: omitting this argument preserves v1.24.0 behavior
 * exactly. All existing callers (and the 21 tests in `json.test.ts`)
 * continue to pass without modification.
 */
export interface ParseJsonOptions {
  /**
   * Suppress `console.error` when the raw response length is 0.
   * Default: `false` (legacy noisy).
   *
   * Rationale: when the LLM returns 0 bytes, that is NOT a parse
   * failure — there is nothing to parse. Three lines of console.error
   * ("JSON parse completely failed / first 200 chars / last 200 chars")
   * are pure noise that pollutes devtools during Lint runs. Set `true`
   * for source-analyzer / seed-selector / lint-fix call sites where
   * empty body is an expected condition (thinking-model budget
   * exhaustion).
   */
  silentOnEmpty?: boolean;

  /**
   * Throw `EmptyResponseError` instead of returning `null` when the
   * raw response length is 0. Default: `false` (return `null` for
   * backward compat).
   *
   * Use this when the caller wants to distinguish "empty" (LLM ran
   * out of budget) from "malformed" (LLM gave bad JSON) — e.g., for
   * `withTransientRetry` flows where empty is retriable.
   */
  throwOnEmpty?: boolean;

  /**
   * v1.26.x PATCH follow-up (LMStudio + Qwen3.5). Field names that the
   * caller's schema (e.g. SourceAnalysisLLMSchema) expects at the top level.
   * Used by the thinking-block fallback layer to gate which JSON candidates
   * are "plausible enough" to accept when the visible text failed to parse.
   *
   * When set, fallback candidates MUST contain at least one of these keys.
   * This rejects 5-token placeholders like `{"": ""}` that some
   * reasoning-mode models emit under grammar-constrained decoding with
   * insufficient thinking budget — those contain no schema fields and would
   * silently flow into downstream code as empty objects.
   *
   * Default: `undefined` — the fallback then uses a heuristic ("at least 2
   * non-empty fields") instead of schema-field gating.
   */
  expectedSchemaFields?: string[];
}

/**
 * Issue #407 Stage 0 — why the parse outcome needs a type of its own.
 *
 * `parseJsonResponse` answers `null` for three unrelated conditions: the model
 * returned nothing, the model returned bytes that hold no recoverable JSON, and
 * the parser itself threw. The third was never visible to anyone — the catch at
 * the bottom of this file logged it and returned `null` like the rest.
 *
 * Because `null` can mean any of those, `parsed?.field || fallback` is the
 * cheapest thing to write at a call site, and it silently converts a failed
 * call into a content decision: `path-resolution.ts:220` creates a page at the
 * slug path as if the model had answered "no match", `conversation-ingest.ts:337`
 * saves a conversation as `entirely_new` with the dedup check skipped, and
 * `fix-dead-link.ts:180` walks into its stub branch as if the link were a
 * genuine forward reference.
 *
 * A flag on the old signature would fix today's call sites and leave the next
 * one to inherit the same default. This union removes the reading instead: with
 * `ok` to discriminate on, `parsed?.field || fallback` does not compile.
 *
 * `parseJsonResult` decides nothing beyond classification and logs no verdict —
 * both belong to the caller. `parseJsonResponse` below is now one such caller,
 * kept byte-for-byte compatible: the same returns, the same throws, the same
 * console lines. Stage 0 changes no behaviour anywhere on purpose, so this
 * commit can be reviewed on identity alone.
 */
export type JsonParseFailure = {
  ok: false;
  /**
   * `empty` — nothing arrived to parse (0 bytes, or whitespace / thinking
   * blocks / code fences only). Usually a reasoning model that spent its
   * budget before emitting JSON, and retriable.
   *
   * `malformed` — bytes arrived and no layer could recover JSON from them,
   * repair callback included. Operators need to see this one.
   *
   * `exception` — the parser threw where it was not expected to. Never
   * distinguishable before this type existed.
   *
   * `thinking-block-only` — visible text was empty / unparseable but the
   * reasoning block(s) contained JSON-shaped payloads that did NOT match
     the caller's `expectedSchemaFields` (or contained only a 5-token
   * placeholder like `{"": ""}`). Distinct from `empty` because the model
     * DID emit something parseable; the issue is the model's reasoning
     * mode stripped its output of schema-shaped fields. Caller should
     surface this to the user — retrying is unlikely to help until they
     disable reasoning on the backend or switch chat templates.
   */
  reason: 'empty' | 'malformed' | 'exception' | 'thinking-block-only';
  /** Length of the RAW response, before any normalization. */
  rawLength: number;
  /** The text after Layer-1 normalization; `''` for `empty`. */
  normalized: string;
  /** Set for `exception` only — the value that was thrown. */
  error?: unknown;
};

export type JsonParseResult =
  | { ok: true; value: Record<string, unknown> }
  | JsonParseFailure;

/**
 * v1.26.x PATCH follow-up (#443 LMStudio + Qwen3.5). A grammar-constrained
 * reasoning model under tight thinking budget emits the MINIMUM valid JSON
 * object that satisfies the schema — `{"": ""}` (one object, one empty key,
 * one empty value). This is a placeholder, not real content. `JSON.parse`
 * succeeds on it, so every parse-success path in parseJsonResult would
 * return it and downstream code sees `entities: undefined` — silently
 * dropping the batch.
 *
 * This gate runs on EVERY successful parse result. It rejects an object
 * whose keys are all empty strings (the 5-token placeholder shape).
 * Legitimate empty objects (`{}` from a real "no entities" answer) are
 * allowed through — they are `[]`-shaped intent, not grammar-constrained
 * artifacts.
 *
 * v1.26.3 PATCH follow-up (user E2E 2026-08-13, qwen3.5-9b on LM Studio):
 * the grammar-constrained placeholder's value shape varies by run — the
 * model bails with `{"": ""}` (empty string) OR `{"": {}}` (empty object)
 * / `{"": []}` (empty array). The empty-value predicate must treat ALL of
 * those as empty; a string-only check lets `{"": {}}` slip through to
 * downstream as a real parse result.
 */
/**
 * Empty JSON-value predicate for the placeholder gate. `''`, `null`,
 * `undefined`, or an empty container (`{}` / `[]` — the E2E 2026-08-13
 * variant). Values come from JSON.parse, so a non-null
 * `typeof v === 'object'` is a plain object or array;
 * `Object.keys(v).length === 0` is true for both `{}` and `[]`.
 */
function isEmptyJsonValue(v: unknown): boolean {
  return v === '' || v === null || v === undefined ||
    (typeof v === 'object' && Object.keys(v).length === 0);
}

function isPlaceholderObject(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entries = Object.entries(value as Record<string, unknown>);
  // `{}` (zero entries) = legitimate empty intent, not a placeholder.
  return entries.length > 0 &&
    entries.every(([k, v]) => k === '' && isEmptyJsonValue(v));
}

/**
 * Placeholder-text predicate for the SDK layer (Issue #443 follow-up —
 * per-model placeholder demotion). The SDK's `createMessageWithOutput`
 * catch branch detects a grammar-constrained `{"": ""}` placeholder
 * WITHOUT re-running the full parse pipeline: JSON.parse +
 * isPlaceholderObject, non-throwing. Returns false for non-JSON text
 * (free-text markdown callers) so the placeholder demotion never fires
 * on them.
 */
export function isPlaceholderJsonText(text: string): boolean {
  if (!text) return false;
  try {
    return isPlaceholderObject(JSON.parse(text));
  } catch {
    return false;
  }
}

/**
 * Gate a parse result through the placeholder check. Returns the result
 * unchanged unless it is a `{"": ""}`-shaped placeholder, in which case
 * null (callers treat null as "no JSON"). Used by parseJsonResult at
 * every parse-success site so a 5-token placeholder never reaches
 * downstream as real content.
 */
function gatePlaceholder(
  result: JsonParseResult,
): JsonParseResult {
  if (result.ok && isPlaceholderObject(result.value)) {
    return {
      ok: false,
      reason: 'thinking-block-only',
      rawLength: 0,
      normalized: '',
    };
  }
  return result;
}

/**
 * Classify an LLM response into parsed JSON or a named failure (#407 Stage 0).
 *
 * Same parsing layers, same order, same repair callback as `parseJsonResponse`
 * — this IS that function's body, with the three `null` returns replaced by the
 * reason that produced them. The `console.debug` breadcrumbs and the two
 * repair-failure `console.error` lines stay here because they describe parse
 * ATTEMPTS; the verdict lines moved out to the caller.
 *
 * v1.26.x PATCH follow-up: the optional `expectedSchemaFields` gates the new
 * thinking-block fallback layer (Layer 3) — when provided, only candidates
 * carrying at least one schema field are accepted. Without it, the fallback
 * uses a 2-non-empty-fields gate to reject grammar-constrained placeholders.
 */
export async function parseJsonResult(
  response: string,
  repairFn?: (malformedJson: string) => Promise<string>,
  options?: { expectedSchemaFields?: string[] },
): Promise<JsonParseResult> {
  console.debug('parseJsonResponse parsing started... response length:', response.length);

  let normalized = '';
  // Capture thinking-block inner content BEFORE stripping it (Layer 3
  // fallback — see note on Issue #443 LMStudio + Qwen3.5 follow-up).
  const thinkingBlockContents: string[] = [];
  try {
    // ===== Layer 1: Response Normalization =====
    normalized = response.trim();

    // Step 1.0: Strip reasoning/thinking blocks. Capture inner content first
    // so Layer 3 can still recover JSON-shaped payloads from them when the
    // visible text was empty. The two captures + two strips mirror the
    // extractThinkingBlocks helper in core/markdown.ts but stay local to this
    // parser to keep parseJsonResult self-contained.
    captureThinkingBlocks(normalized, thinkingBlockContents);
    normalized = normalized.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '');
    normalized = normalized.replace(/<thinking\b[^>]*>[\s\S]*?<\/thinking>/gi, '');
    normalized = normalized.trim();

    // Step 1.1: Strip markdown code fences
    normalized = normalized.replace(/^```(?:json|markdown|md)?\s*\n?/, '');
    normalized = normalized.replace(/\n?```$/, '');
    normalized = normalized.trim();

    // Step 1.1b: LaTeX commands the model left with one backslash. `\beta`,
    // `\rightarrow`, `\text` start with a valid JSON escape, so the response
    // parses — to a backspace plus "eta". Nothing downstream can tell.
    normalized = escapeLatexInMath(normalized);

    // Step 1.2: Prefill artifact correction
    if (normalized.startsWith('{{')) {
      normalized = normalized.substring(1);
      console.debug('Prefill echo "{{" detected, removing leading {');
    } else if (normalized.length > 1 && normalized[0] === '{') {
      const afterFirst = normalized.substring(1).trimStart();
      if (afterFirst.startsWith('{') || afterFirst.startsWith('```')) {
        normalized = afterFirst;
        console.debug('Newline-separated "{\\n{" detected {\\n{，removing leading {');
      }
    }

    if (normalized.length > 0 && normalized[0] !== '{') {
      const withBrace = '{' + normalized;
      try {
        console.debug("first char not '{', prepended '{' and parsed successfully");
        return gatePlaceholder({ ok: true, value: JSON.parse(withBrace) as Record<string, unknown> });
      } catch {
        console.debug("prepending '{' still failed, continuing");
      }
    }

    // Step 1.3: Trailing content detection
    try {
      return gatePlaceholder({ ok: true, value: JSON.parse(normalized) as Record<string, unknown> });
    } catch (directError) {
      const msg = directError instanceof SyntaxError ? directError.message : '';
      const afterMatch = msg.match(/after JSON at position (\d+)/);
      if (afterMatch) {
        const endPos = parseInt(afterMatch[1], 10);
        const prefix = normalized.substring(0, endPos);
        console.debug('extra content after JSON detected (position %d)，prefix extracted (length %d)', endPos, prefix.length);
        try {
          console.debug('prefix parsed successfully');
          return gatePlaceholder({ ok: true, value: JSON.parse(prefix) as Record<string, unknown> });
        } catch {
          console.debug('prefix parse failed, continuing');
        }
      }
    }

    // ===== Layer 2: JSON Extraction =====
    const firstBrace = normalized.indexOf('{');

    // Step 2.1b: one-token defects a small model leaves in otherwise sound
    // JSON — a key missing a quote, `\alpha` with one backslash, an array
    // closed with `}`. Used only where the parser would otherwise call the
    // model repair or give up, so every response the steps above and below
    // already recover comes out exactly as before. Measured on 3,893
    // extraction responses: 198 reached the model repair, which regenerates
    // the whole response to fix one character and ran to the token cap on
    // one call in five; these rules parse 176 of them.
    const known = firstBrace === -1 ? null : repairKnownDefects(normalized.substring(firstBrace));

    if (firstBrace !== -1) {
      const balanced = extractBalancedJson(normalized, firstBrace);
      if (balanced) {
        const fixed = fixCommonJsonIssues(balanced);
        try {
          return gatePlaceholder({ ok: true, value: JSON.parse(fixed) as Record<string, unknown> });
        } catch (braceError) {
          console.debug('brace-count extraction failed:', String(braceError).slice(0, 80));
        }

        if (repairFn) {
          if (known) return gatePlaceholder({ ok: true, value: known });
          try {
            const repaired = await repairFn(balanced);
            const cleanedLlm = repaired.trim()
              .replace(/^```(?:json)?\s*\n?/, '')
              .replace(/\n?```$/, '')
              .trim();
            const final = fixCommonJsonIssues(cleanedLlm);
            return gatePlaceholder({ ok: true, value: JSON.parse(final) as Record<string, unknown> });
          } catch (llmError) {
            console.error('LLM repair also failed (brace-count):', String(llmError).slice(0, 80));
          }
        }
      }
    }

    // Step 2.2: Greedy regex fallback
    const jsonMatch = normalized.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const candidate = jsonMatch[0];
      const fixed = fixCommonJsonIssues(candidate);
      try {
        return gatePlaceholder({ ok: true, value: JSON.parse(fixed) as Record<string, unknown> });
      } catch (regexError) {
        console.debug('greedy regex extraction failed:', String(regexError).slice(0, 80));
      }

      if (repairFn) {
        if (known) return gatePlaceholder({ ok: true, value: known });
        try {
          const repaired = await repairFn(candidate);
          const cleanedLlm = repaired.trim()
            .replace(/^```(?:json)?\s*\n?/, '')
            .replace(/\n?```$/, '')
            .trim();
          const final = fixCommonJsonIssues(cleanedLlm);
          return gatePlaceholder({ ok: true, value: JSON.parse(final) as Record<string, unknown> });
        } catch (llmError) {
          console.error('LLM repair also failed (greedy regex):', String(llmError).slice(0, 80));
        }
      }
    }

    // ===== Layer 3: Thinking-block fallback =====
    // Visible text was empty / unparseable. Some reasoning-mode backends
    // (LMStudio + Qwen3.5 etc., Issue #443 follow-up) route the model's
    // structured output into `reasoning_content` and leave `content` empty.
    // If we captured any thinking-block content above, try to recover a
    // schema-shaped object from it. The gate (expectedSchemaFields or
    // 2-non-empty-fields heuristic) keeps grammar-constrained placeholders
    // like `{"": ""}` out of downstream code.
    //
    // Distinguish two cases at the end so operators reading logs can tell
    // them apart:
    //   - thinking block existed AND it contained a JSON-shaped payload
    //     (but the payload did not match the caller's schema) → reason
    //     'thinking-block-only'. The model emitted structure; the issue
    //     is the schema mismatch.
    //   - thinking block existed but was free-form reasoning (no `{`)
    //     → keep the legacy 'empty' classification. The model did not
    //     emit JSON at all; same as a non-thinking model that ran out of
    //     budget. Reusing 'empty' preserves the #407 / v1.24.1 contract
    //     that source-analyzer's silentOnEmpty path already handles.
    if (thinkingBlockContents.length > 0) {
      const recovered = tryParseFromThinkingBlocks(
        thinkingBlockContents,
        options?.expectedSchemaFields,
      );
      if (recovered) {
        return gatePlaceholder({ ok: true, value: recovered });
      }
      // Did any thinking block contain a `{`? If so, the model tried to
      // emit JSON but it didn't match the schema gate. If not, the
      // thinking was free-form prose — same as the empty case.
      const anyJsonShape = thinkingBlockContents.some((b) => b.includes('{'));
      if (anyJsonShape && normalized === '') {
        return {
          ok: false,
          reason: 'thinking-block-only',
          rawLength: response.length,
          normalized,
        };
      }
    }

    // v1.24.1 PATCH Phase 5.5.0 (quiet path): detect empty-body SPECIFICALLY
    // (raw bytes trim to nothing after Layer-1 normalization — no `{` found
    // means no parseable payload). Empty body is "LLM returned nothing" —
    // distinct from "LLM gave unparseable text". The legacy noisy 3-line
    // console.error was good for malformed JSON (operators need signal)
    // but pure noise for empty (the response is "I called and got nothing
    // back" — it's right in the user's mental model).
    //
    // We use `normalized === ''` (post-trim, post-thinking-block-strip,
    // post-code-fence-strip) rather than `response.length === 0` so
    // whitespace-only responses are also classified as empty.
    if (normalized === '') {
      return { ok: false, reason: 'empty', rawLength: response.length, normalized: '' };
    }

    // Non-empty + unparseable. `normalized` travels with the failure so the
    // caller can reproduce the legacy 3-line operator signal verbatim.
    // A caller without a repair callback gets the known-defect pass as its
    // last attempt, after every step it had before.
    if (known) return gatePlaceholder({ ok: true, value: known });
    return { ok: false, reason: 'malformed', rawLength: response.length, normalized };

  } catch (error) {
    // Before #407 this branch logged and returned `null`, so an unexpected
    // throw inside the parser was indistinguishable from a model that answered
    // badly. `normalized` is whatever Layer 1 had reached when it threw.
    return { ok: false, reason: 'exception', rawLength: response.length, normalized, error };
  }
}

/**
 * Legacy null-returning wrapper over `parseJsonResult` (#407 Stage 0).
 *
 * Every existing caller keeps its exact behaviour: the three failure reasons all
 * collapse back to `null`, the empty-body branch keeps `silentOnEmpty` and
 * `throwOnEmpty`, and the verdict console lines are emitted here — same text,
 * same order, same stream as before the split.
 *
 * New call sites should use `parseJsonResult` instead: this signature cannot
 * express why a call failed, which is the defect #407 is about.
 */
export async function parseJsonResponse(
  response: string,
  repairFn?: (malformedJson: string) => Promise<string>,
  options?: ParseJsonOptions,
): Promise<Record<string, unknown> | null> {
  const result = await parseJsonResult(response, repairFn, {
    expectedSchemaFields: options?.expectedSchemaFields,
  });
  if (result.ok) return result.value;

  if (result.reason === 'empty') {
    if (options?.silentOnEmpty) {
      console.debug('parseJsonResponse: empty body (raw length %d) — silent path', result.rawLength);
    } else {
      console.error('JSON parse completely failed (raw length %d) — empty response from LLM', result.rawLength);
    }
    if (options?.throwOnEmpty) {
      throw new EmptyResponseError(result.rawLength);
    }
    return null;
  }

  if (result.reason === 'thinking-block-only') {
    // v1.26.x PATCH follow-up: thinking blocks existed but contained no
    // schema-shaped JSON. Distinct from `empty` so callers and operators
    // can tell the model DID emit something — just not the schema fields
    // expected. silentOnEmpty suppresses the noisy 3-line error since the
    // most-likely cause is a reasoning-mode model that routed its
    // output into reasoning_content (Issue #443 follow-up, LMStudio +
    // Qwen3.5). Operators who want a loud signal can pass silentOnEmpty:
    // false (legacy default).
    if (options?.silentOnEmpty) {
      console.debug(
        'parseJsonResponse: thinking-block-only (raw length %d) — model emitted reasoning but no schema-shaped JSON — silent path',
        result.rawLength,
      );
    } else {
      console.error(
        'JSON parse completely failed (length %d) — thinking-block-only (no schema-shaped JSON in reasoning blocks)',
        result.rawLength,
      );
    }
    return null;
  }

  if (result.reason === 'malformed') {
    // Legacy noisy default: operators need the signal on unparseable content.
    console.error('JSON parse completely failed (length %d)', result.rawLength);
    console.error('first 200 chars after normalization:', result.normalized.substring(0, 200));
    console.error(
      'last 200 chars after normalization:',
      result.normalized.substring(Math.max(0, result.normalized.length - 200)),
    );
    return null;
  }

  console.error('parseJsonResponse exception:', result.error);
  return null;
}

/** Extract the first balanced {…} JSON object via brace counting. */
function extractBalancedJson(text: string, startPos: number): string | null {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startPos; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        return text.substring(startPos, i + 1);
      }
    }
  }

  return null;
}

/**
 * v1.26.x PATCH follow-up (Issue #443 LMStudio + Qwen3.5). Capture inner
 * content of every `<think>...</think>` / `<thinking>...</thinking>` block
 * into `out` (in order) so the Layer-3 fallback can re-examine them when
 * the visible text was empty or unparseable. Mirrors the regex used in
 * `core/markdown.ts:extractThinkingBlocks` so callers can rely on the same
 * block definition across the codebase.
 */
function captureThinkingBlocks(text: string, out: string[]): void {
  const innerRegex = /<think(?:ing)?\b[^>]*>([\s\S]*?)<\/think(?:ing)?>/gi;
  let m: RegExpExecArray | null;
  while ((m = innerRegex.exec(text)) !== null) {
    out.push(m[1]);
  }
}

/**
 * v1.26.x PATCH follow-up. Layer-3 fallback: when Layer 1 stripped a
 * thinking block (Step 1.0) and the visible text was empty / unparseable,
 * re-examine each captured thinking-block content for a JSON-shaped
 * payload. Used to recover structured output that a reasoning-mode model
 * (LMStudio + Qwen3.5 etc.) routed into `reasoning_content` while leaving
 * `content` empty.
 *
 * Gating rules:
 *  - If caller passed `expectedSchemaFields`, the candidate MUST contain
 *    at least one of those keys.
 *  - Otherwise, the candidate MUST have at least 2 non-empty field values
 *    (rejects the grammar-constrained 5-token placeholder `{"": ""}`).
 *
 * Returns the first acceptable candidate, or null. Empty thinking blocks
 * (e.g. reasoning models that emitted nothing) return null silently.
 */
function tryParseFromThinkingBlocks(
  blocks: string[],
  expectedSchemaFields: string[] | undefined,
): Record<string, unknown> | null {
  for (const block of blocks) {
    if (!block || !block.includes('{')) continue;
    // Walk every top-level balanced object in the block; accept the first
    // one that passes the gate. The first object may be a thinking-state
    // artifact (e.g. `{"step": 1}`); later objects are usually the JSON.
    const re = /\{/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(block)) !== null) {
      const candidate = extractBalancedJson(block, m.index);
      if (!candidate) continue;
      try {
        const fixed = fixCommonJsonIssues(candidate);
        const parsed = JSON.parse(fixed) as Record<string, unknown>;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
        const keys = Object.keys(parsed);
        if (expectedSchemaFields && expectedSchemaFields.length > 0) {
          if (!expectedSchemaFields.some((f) => keys.includes(f))) continue;
        } else {
          // Heuristic: reject grammar-constrained placeholders. An empty
          // key with empty value, or all-empty values, is the 5-token shape
          // some models emit under tight thinking budget.
          const nonEmpty = keys.filter((k) => {
            const v = parsed[k];
            return v !== '' && v !== null && !(Array.isArray(v) && v.length === 0);
          });
          if (nonEmpty.length < 2) continue;
        }
        console.debug('thinking-block fallback recovered JSON (keys: %s)', keys.join(','));
        return parsed;
      } catch {
        // Try the next balanced object in this block.
      }
    }
  }
  return null;
}

function fixCommonJsonIssues(json: string): string {
  let fixed = json.replace(/,\s*\}/g, '}').replace(/,\s*\]/g, ']');
  // The missing comma first: `escapeContentQuotes` reads a quote followed by
  // another quote as text and escapes it, and the comma rule then no longer
  // finds the pair it needs.
  fixed = fixed.replace(/"\s*\n\s*"/g, '",\n"');
  fixed = escapeContentQuotes(fixed);
  fixed = fixed.replace(/,\s*\}/g, '}').replace(/,\s*\]/g, ']');
  return fixed;
}

function escapeContentQuotes(json: string): string {
  const out: string[] = [];
  let inString = false;
  let i = 0;

  while (i < json.length) {
    const ch = json[i];

    if (ch === '\\' && inString) {
      out.push(ch);
      i++;
      if (i < json.length) out.push(json[i]);
      i++;
      continue;
    }

    if (!inString && ch === '"') {
      inString = true;
      out.push(ch);
      i++;
      continue;
    }

    if (inString && ch === '"') {
      let peek = i + 1;
      while (peek < json.length && isJsonWhitespace(json[peek])) peek++;
      const nextCh = peek < json.length ? json[peek] : '';

      if (
        nextCh === ':' || nextCh === ',' || nextCh === '}' || nextCh === ']' ||
        peek >= json.length
      ) {
        inString = false;
        out.push(ch);
      } else {
        out.push('\\"');
      }
      i++;
      continue;
    }

    out.push(ch);
    i++;
  }

  return out.join('');
}

function isJsonWhitespace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
}

// ─── Known one-token defects ─────────────────────────────────────────────
//
// A small model writes pretty-printed JSON that is sound except for one
// character. Each rule below targets one defect class measured on 781
// extraction responses (gemma-4-26b, 10–11 Sep 2026) and matches only a shape
// that valid JSON cannot contain, so a response that parses is never touched
// by `repairKnownDefects` (it runs after every other deterministic step has
// failed). The model repair stays the last resort, for truncation and for
// whatever these rules do not know.

// A single backslash (an odd run) before anything JSON cannot escape:
// `$\alpha$`, `[[Page\|alias]]`, `\u` without four hex digits.
const INVALID_ESCAPE = /(?<!\\)((?:\\\\)*)\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g;

// LaTeX commands whose first letter makes `\<letter>` a valid JSON escape —
// `\beta` parses to backspace + "eta", `\rightarrow` to carriage return +
// "ightarrow". Rewritten only inside a `$…$` span and only as a whole command
// name, where a real control character has no business.
const LATEX_ESCAPE_IN_MATH = /(?<!\\)((?:\\\\)*)\\(?=(?:beta|bar|bullet|frac|forall|nabla|neq|ne|not|nu|rho|rightarrow|theta|tau|times|textbf|textit|text|tilde|top|to|triangle)(?![A-Za-z]))/g;

function escapeLatexInMath(text: string): string {
  if (!text.includes('$')) return text;
  return text.replace(/\$[^$\n]{1,200}\$/g, span => span.replace(LATEX_ESCAPE_IN_MATH, '$1\\\\'));
}

/**
 * Try to parse `text` after fixing the one-token defects a small model leaves
 * in pretty-printed JSON. Returns the parsed object, or null when the text
 * still does not parse — the caller then falls through to the model repair.
 */
function repairKnownDefects(text: string): Record<string, unknown> | null {
  const t = closeMismatchedBrackets(closeUnterminatedLines(
    text
      .replace(INVALID_ESCAPE, '$1\\\\')
      // `"name: "Psoriasis",` — the key lost its closing quote (25 of 50).
      // Before a bracket only when it ends the line: `"siehe: [[Vitamin D]] …"`
      // is a valid quote, not a key.
      .replace(/^(\s*)"([a-z_][a-z0-9_]*): (?="|[[{]\s*$)/gm, '$1"$2": ')
      // `"coverage: named",` — key and one-word value merged into one string.
      // Narrow on purpose: `"Therapie: Anti-TNF (…)."` is a valid quote in an
      // array, and a broader pattern splits it into a key and a value.
      .replace(/^(\s*)"([a-z_][a-z0-9_]*): ([a-z_]+)"(\s*,?)$/gm, '$1"$2": "$3"$4')
      // `summary: "…"`, `="mentions_in_source": [` — the key lost its opening quote.
      .replace(/^(\s*)(?![\s"])=?"?([A-Za-z_]\w*)"?:(?=\s)/gm, '$1"$2":')
      // `"summary": Ein Medikament …",` — the value lost its opening quote.
      .replace(/^(\s*"[A-Za-z_]\w*":\s*)(?!(?:true|false|null)\b)([^\s"[{\d-][^\n]*"\s*,?)$/gm, '$1"$2')
      // `|      "mentions_in_source": [` — a stray pipe opening the line.
      .replace(/^\|(?=\s*")/gm, '')
      // `(„Myelomniere")` — a German quote closed with the ASCII quote, which
      // ends the JSON string early. Only when that quote is not followed by
      // what would legitimately come after a string's end, and not when it is
      // already escaped (`„X\"`).
      .replace(/„([^"“”\n]{0,119}[^"“”\n\\])"(?!\s*[,:\]}])/g, '„$1“')
      // `"… (Leaky Gut)".` before a closing bracket — a stray full stop.
      .replace(/"\.(?=\s*\n\s*[\]},])/g, '"'),
  ));
  const candidate = extractBalancedJson(t, 0) ?? t;
  for (const attempt of [candidate, fixCommonJsonIssues(candidate)]) {
    try {
      const parsed: unknown = JSON.parse(attempt);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        console.debug('known one-token JSON defects repaired without a model call');
        return parsed as Record<string, unknown>;
      }
    } catch {
      // next attempt
    }
  }
  return null;
}

/**
 * `"Studien zeigen: … (Honorare, Beratung),` — a string that lost its closing
 * quote at the end of its line. Only a line with an odd number of unescaped
 * quotes that ends in a comma after text, followed by a line that opens the
 * next value or closes the container, gets the quote back.
 */
function closeUnterminatedLines(text: string): string {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];
    if (!/[^"\]}\d\s],\s*$/.test(line)) continue;
    if (countUnescapedQuotes(line) % 2 === 0) continue;
    if (!/^\s*["\]}]/.test(lines[i + 1])) continue;
    lines[i] = line.replace(/,\s*$/, '",');
  }
  return lines.join('\n');
}

function countUnescapedQuotes(line: string): number {
  let n = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '\\') { i++; continue; }
    if (line[i] === '"') n++;
  }
  return n;
}

/** `"domains": [ … }` — a container closed with the other bracket. */
function closeMismatchedBrackets(text: string): string {
  const out = text.split('');
  const stack: string[] = [];
  let inString = false;
  for (let i = 0; i < out.length; i++) {
    const ch = out[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' || ch === ']') {
      const open = stack.pop();
      if (open === '[' && ch === '}') out[i] = ']';
      else if (open === '{' && ch === ']') out[i] = '}';
    }
  }
  return out.join('');
}
