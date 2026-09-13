# LLM Wiki Plugin Project Development Standards

**Last Updated:** 2026-08-27

**Current state pointer:** see [ROADMAP.md](./ROADMAP.md#current-status) for active development phase + [CHANGELOG.md](./CHANGELOG.md) for shipped history. This file (AGENTS.md) carries process standards only — and is the single canonical source. The historical mirror at `CLAUDE.md` is now a pointer stub to this file; all new content goes here. **Latest shipped:** v1.27.0 MINOR (2026-08-27, 3677 tests / 260 files).

---

## 🛡️ Six-Gate Quality Closure

| Gate | Constraint | How |
|------|-----------|-----|
| **1. Code correct** | `pnpm lint` 0/0 + `npx tsc --noEmit` 0/0 + `pnpm build` clean + `pnpm test` all pass + `pnpm css-lint` 0 | Five-Gate script (build BEFORE test — see §"Gate 1: Five-Gate automated") |
| **2. No side effects** | Call-site audit + data flow + state mutation + error propagation | Structured review |
| **3. No breaking changes** | API/Schema/File format/Default behavior/Command IDs/Obsidian API | Breaking-change matrix |
| **4. No performance regression** | CPU/memory/IO/network/token — 5-dim written assessment | simplify + code-review + Gate 4 table |
| **5. Docs complete** | 10 READMEs + ROADMAP + AGENTS + CHANGELOG + memory | pre-release-gate |
| **6. Release clean** | Supersets 1-5 + TOC + i18n + Release Notes + Contributors + git hygiene | pre-release-gate |

### Gate 1: Five-Gate automated

```bash
pnpm lint && npx tsc --noEmit && pnpm build && pnpm test && pnpm css-lint
```

All five must pass. ESLint checks style, TypeScript checks types, css-lint checks Obsidian review compliance — three complementary checks, single tool passing is insufficient. No `@ts-ignore` / `eslint-disable` to silence failures.

**Order is non-negotiable**: `pnpm build` MUST run before `pnpm test`. The test suite contains build-artifact verifications (e.g. `src/__tests__/llm-sdk/openai-codex-loopback-flow.test.ts:39` reads `main.js` to assert the esbuild bundle shape), so a test-first run fails with ENOENT on a fresh clone. Local Gate 1 typically has `main.js` on disk from a prior `pnpm build:dev`, which is why this ordering bug was missed before PR #487's first CI run on 2026-08-18.

**Bot alignment (pre-release):** local `pnpm lint` ≠ Obsidian review bot. Bot runs newer `eslint-plugin-obsidianmd`. Before each release:
```bash
LOCAL=$(node -p "require('./node_modules/eslint-plugin-obsidianmd/package.json').version")
LATEST=$(npm view eslint-plugin-obsidianmd version)
[ "$LOCAL" != "$LATEST" ] && pnpm add -D "eslint-plugin-obsidianmd@$LATEST" && rm -f pnpm-lock.yaml && pnpm install && npm install --legacy-peer-deps --package-lock-only && pnpm lint
```

### Gate 2: No Side Effects

For each modified function, trace: **call-site audit** (`grep -rn "<fn>" src/`) → **data flow** (input origin → output destination → side effects) → **state mutation** (concurrent safety? overwrite vs append?) → **error propagation** (new error paths caught by all callers?). Deliverable: 3-5 sentence assessment.

### Gate 3: No Breaking Changes

| Dimension | Check | Pass criteria |
|-----------|-------|---------------|
| API signature | `git diff` + `grep` | All call-sites updated; no new required params without defaults |
| Settings schema | `types.ts` + `settings.ts` | New fields have defaults; removed fields ignored |
| File format | Generation templates | Old files load without error |
| Default behavior | Constructor / config init | Old behavior preserved unless opted in |
| Command/setting IDs | `grep` for IDs | IDs unchanged |
| Obsidian API | `manifest.json` | `minAppVersion` >= current |

Deliverable: "None detected" or specific migration plan.

### Gate 4: No Performance Regression

Procedure: (1) Run `simplify` (3 parallel agents); (2) Run `code-review` (max effort); (3) Walk through 5 dimensions below; (4) If regression → mitigate or escalate; (5) If N/A → state so.

| # | Dimension | Project-specific signal |
|---|-----------|-------------------------|
| 1 | CPU | `O(n²) candidate generation` is known risk — do not regress |
| 2 | Memory | `thinkingControlCache` bounded by user count; `Map<string, PageMeta>` in `generateDuplicateCandidates` holds all pages |
| 3 | IO | `vault.read()` per page in loops is expensive |
| 4 | Network | `OpenAICompatibleClient.createMessage` should cache 400-fallback (Issue #245); lint dedup budget 500 |
| 5 | Token | Ingest 1-3K; lint dedup 100 × ~30 = 3K/batch; retries = full prompt |

**Deliverable** (mandatory in commit body):
```
## Gate 4: Performance

| Dim | Status | Notes |
|-----|--------|-------|
| CPU | ✅/⚠️/N/A | ... |
| Memory | ✅/⚠️/N/A | ... |
| IO | ✅/⚠️/N/A | ... |
| Network | ✅/⚠️/N/A | ... |
| Token | ✅/⚠️/N/A | ... |
```
Bare "no regression" is **not acceptable**.

### Gate 5 + Gate 6

Gate 6 supersets Gates 1-5 plus release hygiene. `pre-release-gate` skill (release Step 4a) re-runs Gate 1 + all Gate 4 dimensions (Gate 6 must re-verify perf at release time, not trust commit-time).

### ⚠️ Anti-patterns

- "The tests pass, so it's fine" → Tests only cover what you thought to test
- "It's just a one-line change" → Most dangerous
- "I'll add tests later" → Tests must accompany change
- "The PR review will catch it" → Reviewer has less context than you
- "ESLint passes, TypeScript errors are fine" → ESLint does NOT check type safety

---

## 🧪 Development Quality Closure (TDD + Planning)

Mandatory loop for every code change. This is a closure, not a checklist — each step depends on the previous.

```
1. Deep thinking    → What is the problem? Edge cases? Failure modes?
2. Plan             → Files to change, function signatures, side effects
3. Write test       → Failing test that defines expected behavior
4. Confirm RED      → Run test, verify it fails for the right reason
5. Implement        → Minimum code to make the test pass
6. Confirm GREEN    → Run test, verify it passes
7. Refactor         → Clean up; tests must still pass
8. 4-Gate verify    → lint + tsc + test + build + css-lint all clean
9. Six-Gate review  → side effects + breaking + performance + doc + release
```

**Tests required** for: new exported function/class/module, new behavior branch (any new if/else), **bug fixes** (test reproduces bug; fix makes test pass), refactor with observable behavior change. Tests optional for: pure config, type-only, docs. Pre-existing code with zero tests: add at least one test for the changed path first.

**Shell-test anti-pattern (2026-06-02, Issue #81):** tests that pass without verifying real behavior are **worse than no test**. Rules:
1. Cover ALL production code paths (inline vs multi-line, JSON vs YAML, etc.)
2. Assert content mutation, not just return values (`output !== input` AND `output` contains new content)
3. Re-scan assertion for idempotency tests (re-invoke detector on output)
4. Inspect actual output during debugging — don't trust GREEN without seeing it

Reference: [[feedback_tdd_standard]].

---

## 🔀 Git Branch Workflow (enforced since v1.20.2)

**Core principle:** Never develop directly on main. Main only accepts PR merges.

```
main (protected) ────► tag → release
  │
  ├── feat/xxx ── PR → review → merge
  └── fix/xxx  ── PR → review → merge
```

**Per-fix E2E handoff + explicit push approval (added 2026-08-14, post #456 incident):**

1. Branch from main (`git checkout -b feat/xxx` or `fix/xxx`)
2. RED test → GREEN fix → 4-Gate green (per TDD closure)
3. **Local commit** (`git commit`, no push yet)
4. **`pnpm build:dev`** → verify artifacts (`tail -1 main.js` ends with sourcemap; `console.debug` preserved; 3 output files exist)
5. **Report to user** — root cause + file:line + diff + test delta + 6-Gate table
6. **Wait for explicit "可以 push" / "push it" / "ship it"** before `git push` + `gh pr create`
7. **Wait for explicit "merge it" / "合并"** before `gh pr merge`

**Prohibited:** committing directly on main · pushing PR without user confirmation · mixing unrelated changes · fragmented commits (amend instead) · **`git push` + `gh pr create` immediately after Gate 1 passes** (must do E2E handoff + explicit approval first) · **`gh pr merge` after PR created** (must wait for explicit signal).

**When to amend vs new commit:** fixing a problem in previous commit → `--amend`; new feature/fix → new commit; pre-release doc updates → can amend into version bump commit.

### ⚠️ Git Safety Protocol

- **NEVER commit or push without explicit user permission.** Non-negotiable.
- **NEVER auto-merge PRs.** Not even when Gate 1 passed in CI, or the fix looks "obviously correct", or user said "handle it".
- **Mandatory pre-merge workflow:** (1) user explicit "merge it" / "合并" required before `gh pr merge` / cherry-pick / PR-creation; (2) `simplify` skill runs on PR diff (4 angles); (3) `code-review` skill runs (8 angles, max effort); (4) report findings as `file:line + concrete issue + suggested fix` — do NOT modify the PR; (5) wait for approval before any destructive action.
- **Anti-patterns:** "the PR is small, let me cherry-pick to local main first while we discuss" (violates workflow, creates commits ahead of approval); "Gate 1 passes, so I can `git push` + `gh pr create` immediately" (skips E2E handoff — see #456 incident above).

### Per-PR discipline

For contributor PRs that need rebase after base-branch move: use `gh pr update-branch --rebase` — NEVER locally fork + push + create a new PR. See [[feedback_pr_merge_credit_preservation]].

**Mandatory merge sequence (added 2026-08-18):** every merge MUST follow this exact order. Skipping any step is a procedural miss even when content review passed:

```
gh pr view <N> --json title,body --jq '.title, .body' | grep -inE '\b(closes?|closed|fix(es|ed)?|resolve[sd]?)\s+#[0-9]+'   # ← scan FIRST; every hit must be an issue you mean to close
gh pr review <N> --body "<file>"   # ← MANDATORY. Formal review event lands on the PR.
gh pr merge <N> --admin --squash --delete-branch   # ← ONLY after user said "merge it"
```

- **Scan the body before merging.** A closing keyword needs no intent and does
  not have to aim at an issue. Writing the fix reference as prose — "its fix
  #684" — parsed as `fix #684` and closed **PR #684** one second after the PR
  carrying that sentence merged. The author never touched it, and the ROI
  board merged in that same PR listed #684 as an unblock-first item. Recover
  with `gh pr reopen <N>`; see MEMORY.md §"Issue close keyword".

- **`gh pr review --approve` (or `--request-changes`) MUST be posted BEFORE `gh pr merge`.** This lands the formal review verdict on the PR timeline; downstream tooling (release notes, contributor credit, audit trail) reads from that event, not from comments.
- For architect-level contributor PRs (e.g. @DocTpoint), per [[feedback_reply_brevity_for_architect_contributors]]: review body should be **decision + ≤5 sentences** + concrete `file:line` findings, not a long-form audit.
- **Post-merge audit trail:** if a `gh pr merge` was executed without the matching `--approve` event (procedural miss, not content miss), immediately post `gh pr comment <N> --body <audit-note>` recording what was skipped. Don't rebase, don't re-merge, don't amend — the merge commit hash stands; only the audit trail is patched. Incident reference: PR #478 (2026-08-18, merge `2806d24`).
- Anti-pattern: "`gh pr merge --admin` doesn't enforce reviews, so I can skip --approve." Wrong — `--admin` bypasses the **requirement** rule, not the **review event** rule. Two separate audit surfaces.

---

## 📦 Development Workflow

```bash
pnpm gate:1                    # Gate 1: lint + typecheck + test + build + css-lint (preferred)
pnpm lint && pnpm test && pnpm typecheck && pnpm build && pnpm css-lint   # WRONG ORDER — see §"Gate 1: Five-Gate automated"; build must precede test
```

`pnpm gate:1` is a composite alias added 2026-08-18; both forms are equivalent. Prefer `pnpm gate:1` for one-shot local verification.

### Gate 1 CI (added 2026-08-18)

`.github/workflows/pr-ci.yml` runs the full Five-Gate on every PR to `main` and on every push to `main` (the second trigger added 2026-09-12: a PR is green against the base it branched from, so a break that exists only in the merged pair is invisible until a later PR reports it). Status check: `Gate 1 / Five-Gate`. Branch protection requires it (`strict: false`, `require_last_push_approval: false`).

CI is a **defense-in-depth** layer on top of the per-fix E2E handoff manual Gate 1 (which is still required before `git push`). CI does NOT enable auto-merge — explicit "merge it" / "合并" still required per §"⚠️ Git Safety Protocol".

Obsidian Bot review remains a separate pipeline (not a GitHub status check); CI green ≠ Bot-approved. See `feedback_obsidian_bot_double_lint` for the double-lint invariant.

Lockfile-pinned install (`pnpm install --frozen-lockfile`) prevents `eslint-plugin-obsidianmd` drift between local Gate 1 and CI; the Bot alignment step at release time remains the final word on plugin version per "Bot alignment (pre-release)" under §"Gate 1: Five-Gate automated". `npm ci` is intentionally NOT used (project pins `pnpm@10.14.0`; pnpm `overrides` are flat and npm cannot honor them per `feedback_pnpm_vs_npm_overrides_incompatibility`).

### Build modes

- `pnpm build` — **production** build (console.debug stripped, no sourcemap). For release.
- `pnpm build:dev` — **debug** build (inline sourcemap + console.debug preserved). When user requests local test build.
- `pnpm dev` — **watch** mode.

When user says "build local debug file for testing":
1. Run `pnpm build:dev` → outputs `main.js`, `manifest.json`, `styles.css`
2. Verify `main.js` ends with `//# sourceMappingURL=data:application/json;base64,...`
3. Confirm `console.debug` is NOT replaced

For full release workflow (commit + push + tag + release notes), use the `obsidian-plugin-release` skill. Canonical path under Pi: `~/.pi/skills/obsidian-plugin-release/SKILL.md`. Legacy alias `~/.claude/skills/obsidian-plugin-release/SKILL.md` still works under Claude Code sessions. **Main branch is protected** — direct pushes rejected with `GH013`.

---

## ✅ Pre-Release Checklist

Use `obsidian-plugin-release` skill for the full workflow (Steps 1-8). Gate 1 must all pass before any commit. Pre-release hardening (lockfile regen, CI consistency, AI-SDK drift): [[feedback_build_verification_root_cause]]. Doc review sweep: `doc-review` skill (PASS/WARN/FAIL).

---

## ⚠️ Development Protocol: Plan First, Then Execute

**Before any significant change** (refactoring, new modules, prompt modification, architectural decisions, anything touching core engine files):

1. Present your plan — explain what, why, how
2. Wait for explicit user approval before writing code or committing
3. For multi-phase work: pause and report after each phase

**Exceptions** (no prior approval needed): trivial one-line fixes, running lint/test/build, reading files, documenting existing code.

Full protocol: [[feedback_development_protocol]].

---

## ⚠️ Editor Discipline — No Bulk Scripts for Code or Documents

Every change via `Read` + `Edit` — no sed/awk/python for code or document editing. (2026-06-11: a brace-matching Python script broke 3 sites that 4-Gate passed — wrong lexical block in `query-engine.ts`, unsafe `this: any` in lint modules.)

**Document editing rules (2026-06-24 post-mortem):**
- **Read before Edit — always.** Know exact 5+ lines context before constructing `old_string`.
- **Verify with `git diff`** after every multi-file edit pass (check unintended deletions).
- **grep alone is NOT sufficient** — grep tells you *where* a pattern exists, not what surrounds it. Always Read full context before Edit.
- **Verify idempotency** — surrounding content intact, no swallowed bullets, no broken headings.

---

## 📋 Karpathy Philosophy Compliance

- **Knowledge compounds** — query results flow back into wiki
- **Human-in-the-loop** — LLM suggests, user decides
- **Three-layer architecture** — Sources → Wiki → Schema
- **Incremental accumulation** — wiki is persistent, not one-shot

## 🎯 Python Zen Design Principles

- **Simple > Complex** — comment not framework
- **Flat > Nested** — linear code beats micro-methods
- **Solve when it hurts** — don't optimize before measuring
- **Explicit > Implicit** — function types ARE documentation

## 🌍 Internationalization

- **UI**: 11 locales (EN canonical + 10 translations: ZH/ZH-Hant/JA/KO/DE/FR/ES/PT/IT/RU), 277+ fields per locale. Locale list lives in `src/texts/`.
- **Wiki output**: 11 languages independent of UI + custom input option
- **Code**: English only, minimal comments
- **User-facing strings** = user language, not implementation language

## 📋 Git Commit Standards

English, conventional commits: `feat:` `fix:` `docs:` `refactor:` `test:` `chore:`

**Auto-close:** append `Closes #N` (or `Fixes #N` / `Resolves #N`) to commit body. NEVER use `gh issue close` or UI close — let the commit message do it.

**Author identity:** canonical `green-dalii <654534332@qq.com>`. NEW commits (incl. `--amend` and squash) MUST use lowercase canonical form. **Maintainer commits DO NOT include any AI-generated trailer** — no `Co-Authored-By:`, no `Generated with`, no equivalent marker from **any** AI agent (Claude Code, Codex, Cursor, Pi, …). AI tooling may legitimately assist authoring, but the commit's audit trail must read as a single human author (per [[feedback_co_authored_by_format]]). External contributors write their own trailers — preserve verbatim on merge.

---

## 🔑 Key Design Decisions (rules + pointers)

The following rules are documented as **canonical references** (memory files / specific commits). Brief statement here; full detail in pointer.

### 🚫 Dead-code-as-docs policy (v1.26.0 Batch 4)

Dead code (exported symbols with zero production importers) has a **half-life of one release cycle**. Wire or delete before the next MINOR ships. Do not ship dead code across two releases. `pre-release-gate` Phase 2g enforces this. Hard rule: "ship it dead, wire it next release" = you've already lost — file the wire-up in the same PR or wait. Memory: [[feedback_dead_code_as_docs]].

### ⚠️ Settings panel scope rule (v1.26.0 Batch 2 lesson)

Two settings panels:
1. **LLM Advanced section** (`src/ui/settings-sections/advanced-section.ts`, gated by `advancedSettingsMode`) — `temperature`, `repetitionPenalty`, `forcePdfSupport`, `taskPolicies` (per-task output-mode/thinking spec, PR #525) ONLY.
2. **Bottom "Advanced settings" panel** (`src/ui/settings-sections/advanced-settings-section.ts`, gated by `showAdvancedSettings`) — lint dedup thresholds, `maxConversationHistory`, `writePdfMarkdownToVault`, `slugCase`, `createWelcomeNote`, `lintDedupIncludeSources`, all per-source-file/UI/storage toggles.

**Hard rule:** when adding a setting toggle, decide FIRST which scope. LLM Advanced = LLM sampling + provider overrides ONLY. Everything else → bottom panel. Post-mortem: [[feedback_settings_panel_naming_collision]].

### ⚠️ Force-disable thinking (v1.26.0 Batches 2/6/7 + PR #411)

Use `enableThinking: false` on `createMessage` call. Layer 1 (`reasoningEffort: 'none'`) + Layer 3 (400-retry via `reasoning-strip-probe.ts`) + Layer 4 (prompt-level "do not reason step by step") cover all known backends. **Never write `thinking.type` or `chat_template_kwargs` into provider options on the openai-compat path today** — AI SDK zod silently drops them. Wire-body regression test: `openai-compat-request-body.test.ts` asserts `reasoning_effort: 'none'` IS on the body.

Per-call policy (PR #411 F5-B): source-analyzer parent (`source-analyzer.ts:386`) honors; **JSON-repair (`source-analyzer.ts:417`) does NOT honor** — repair needs reasoning budget to understand broken-JSON semantics, disabling produces structurally-valid-but-wrong content. Regression guard in `source-analyzer-thinking.test.ts` (inverted).

Full post-mortem chain (979s → 365s → 151s on 2141-page vault): [[feedback_force_disable_thinking_openai_compat_noop]] + [[feedback_force_disable_thinking_dedup_wiring]] + [[feedback_dedup_phase_halving_dead_code]] + [[feedback_dedup_phase_truncation_vs_empty_conflation]].

### ⚠️ LLM empty-response retry

v1.26.0 Batch 2 added empty-response retry + transient concurrency halving inline in `runDedupPhase`. Mechanism is provider-agnostic (200 + 0-byte body under burst load). User-facing Toast uses reusable i18n key `llmRetryRecoveredToast`. **Extract on second use** — every future LLM business path needs retry + backoff + halving + log + Notice, not re-implemented. Current inline form is ~80 LOC. Extraction plan: [[feedback_llm_retry_extraction]] → `src/core/llm-retry.ts` with `callLlmWithRetry<T>(client, args, opts)` and `LlmRetryOptions { maxAttempts, delayMs, inScanConcurrencyFloor, onRetry, onRecovered }`.

### ⚠️ Obsidian Plugin Submission Rules — `document` is forbidden

`document` (the bare global) is **strictly forbidden** in production code. Obsidian is multi-window — `document` may refer to the wrong window. Only valid reference: **`activeDocument`**. `obsidianmd/prefer-active-doc` is no-disable in the Obsidian Community Plugin review pipeline — the review bot will reject regardless of `// eslint-disable-next-line` comment.

Test-environment differences must be solved in test setup, not production code. Stub `activeDocument` in `src/__tests__/__support__/setup.ts`:
```typescript
(globalThis as Record<string, unknown>).activeDocument = globalThis.document;
```
Production code uses `activeDocument` directly — no fallback, no eslint-disable comments.

### ⚠️ Codex OAuth provider architecture

- `openai` = OpenAI Platform API-key provider (separate billing).
- `openai-codex` = **ChatGPT Plan (Codex OAuth)** — experimental third-party compatibility, NOT an OpenAI partnership.
- Desktop supports OpenAI-hosted browser flow via loopback callback on `127.0.0.1:1455`; desktop + mobile support device-code login. Node `http` loading MUST stay behind `Platform.isDesktop` guard.
- **OAuth credentials remain in Obsidian SecretStorage only.** Never in settings, `data.json`, logs, Notices, docs, test fixtures, copied examples. Sign-out overwrites the plugin-owned secret with empty value + clears in-memory state.
- Provider uses dedicated Codex Responses client + synchronizes picker-visible models from authenticated Codex `/models` catalog with sanitized metadata caching + minimal fallback.
- Lifecycle commands: `main-commands/codex-auth-commands.ts`. Shared model selection policy: `core/openai-codex-model-policy.ts`. Codex request adapter intentionally omits client-side `max_output_tokens` (backend doesn't support it).
- SecretStorage requires Obsidian 1.11.4 — `manifest.json`/badges/prerequisites must NOT advertise older minimum. Plugin stays `isDesktopOnly: false` (device-code login is mobile path).

### ⚠️ Obsidian Bot compliance invariant

Hard-won rules (applies to ALL future code):

1. **Bot runs independent `obsidianmd/recommended` ruleset** — your local `eslint.config.mjs` cannot turn off Bot's hard barriers.
2. **`obsidianmd/*` is no-disable by default** — specifically `no-nodejs-modules`, `settings-tab/prefer-setting-definitions`, `no-global-this`, `prefer-active-doc`. Local config may try to relax; Bot rejects inline `eslint-disable`.
3. **`@typescript-eslint/no-unsafe-*` propagates through function boundaries** — `const x: T = require(...)` does NOT satisfy the linter (inspects expression return types, not annotations).
4. **Standard Node.js API patterns that work:**
   - Node built-ins: `await import('node:module')` (dynamic) inside `if (!Platform.isDesktop) throw ...` guard. Static `import` of node built-ins unconditionally rejected.
   - Type-safe require: `module.createRequire(__filename)` (Node 15+ official API) — use for typed `node:http` etc. instead of bare `require()`.
   - `__filename` / `__dirname` need inline `eslint-disable no-undef` (legal per-line, not in Bot's no-restricted-disable list).
5. **`obsidianmd/no-nodejs-modules` exemption = `Platform.isDesktop` AST guard**, NOT "dynamic import" — read the rule source. Canonical form: **function-start `if (!Platform.isDesktop) throw`** (mirror `src/llm-sdk/openai-codex/loopback-flow.ts`). Never use `await import(<computed>)` to dodge — yields `any` → `no-unsafe-call` Error (worse than warning). See [[feedback_obsidianmd_no_nodejs_guard_detection]].
6. **Bot scans the whole repo `.ts` tree, not just `src/`** — local `pnpm lint` is `eslint src/`; root `tsconfig.json` includes only `src/**`. Both blind to `tools/`. v1.26.2 (PR #442) closed the blocking Error + type-safety items; remaining tools/ warnings are **accepted-structural** (static `node:fs/path/...` imports, `console.log`, `globalThis` shim, `.obsidian` literal). Run `pnpm lint:tools-bot` (v1.26.2+, informational, exits 0) to see Bot's view locally.

Memory: [[feedback_obsidian_bot_double_lint]] + [[feedback_obsidian_bot_tools_cli_warnings]] + [[feedback_obsidianmd_no_nodejs_guard_detection]].

### ⚠️ Per-step LLM accounting

`createMessage` takes an optional `task`, read in one place (`wrapWithAdvancedSettings`) and accumulated in `core/llm-task-usage.ts`. A call site that omits it is filed under `'untagged'` rather than dropped — an unlabelled call still costs time, and a table that hid it would under-report the run it exists to explain. So `'untagged'` is a hole in that table, not a default to settle for: **a new `createMessage` call site picks a label**, named for the step rather than the module.

### ⚠️ SecretStorage / plaintext wipe ordering (Issue #339, v1.25.4 invariant)

When migrating a value from plaintext into an external store (SecretStorage, keychain, OS credential manager), the plaintext MUST survive until IO succeeds. Two-phase: (1) detect + stash plaintext on a transient field (no wipe), (2) wipe plaintext ONLY after IO write returns success. `flushApiKey`-style helpers return `boolean` and calling UI (`PluginSettingTab.hide()`, etc.) MUST skip the commit step on failure. Silent-skip on IO failure = "both stores empty" = user locked out. Memory: [[feedback_secret_storage_platform_failure_pattern]].

### ⚠️ Schema 三层分离 (Issue #328, Phase 1 active 2026-07-22 — Option A)

Knowledge-conservation principle (anti-drift). Each layer owns its half, **never overlap, can never conflict**:

| Layer | Owned by | What it is |
|---|---|---|
| **User domain knowledge** | You | `schema/config.md` — page templates, content rules, naming conventions, merge policies |
| **Runtime parameters** | Plugin (Settings) | Tag vocabulary, folder layout, output language, page-type registration — **never written into schema file**, always injected at call time via `getSchemaContext()` |
| **Engine facts** | Code | Model name, API key, thinking mode, `WIKI_SUBFOLDERS` — shipped with the plugin |

**Hard rule:** schema file MUST NOT bake runtime parameters. MUST remain pure user domain knowledge. Adding/expanding the runtime injection layer (`buildActiveTagVocabularySection` and future `buildActiveFolderLayoutSection`) is the only legitimate home for things the Settings panel controls. Violating reintroduces the dual-source problem (Phase 1 was approved specifically to eliminate this drift class).

Rationale: [[feedback-schema-phase1-option-a-decision]] + Issue #328 + [[feedback-schema-template-programmatic-injection]].

### ⚠️ Complementary memory model (v1.26.0 design anchor — #358)

Plugin exposes a **complementary query surface**, not fidelity-to-source maximization. Source notes = episodic memory (verbatim, lossy-never-intended); wiki pages = semantic memory (consolidated, graph-traversable).

**Hard rule:** plugin MUST NOT attempt to make wiki pages win every query. When a user complains "the raw note beats the wiki for query X", the answer is *"that is the division of labour — the wiki serves a different query"*, not "fix the wiki to win X". **Practical implications:** "self-improving over time" = periodic consolidation pass with LLM judgement on past decisions, NOT a smarter ingest path. Smallest kernel of Karpathy cycle = Preview-Confirm gate + identity ambiguity record + stable mutation interface, NOT an agent framework refactor.

Planning: [ROADMAP §v1.27.0 MINOR track](./ROADMAP.md#v1270-minor-design-track). Rationale: #330 reply comment + #358 tracking issue.

### ⚠️ Architect-level contributors (v1.26.0+)

See [MEMORY.md §"Architect-level contributors"](./MEMORY.md#architect-level-contributors) and §"Key Design Decisions" below for definition, role, scope, DocTpoint case study. The project keeps no per-agent private memory directory; the only durable record is [MEMORY.md](./MEMORY.md). Currently granted to @DocTpoint (Write role on personal repo; "no push to main" enforced by branch protection, not role assignment).

### ⚠️ Withdrawn / non-issues (archaeology)

- **Windows: `Connection test failed: TypeError: Failed to construct 'Headers'`** — withdrawn 2026-07-10 (user input error: non-ASCII chars in API key field; not plugin/AI-SDK bug). AI-SDK 5.0.53 has a Windows guard but our `provider-utils@4.0.35` (bundled by `ai@^6.0.214`) doesn't include the fix; not worth patching given root cause is user-side.

---

## 📚 Documentation Architecture

**One fact, one place. Reference, don't copy.** When the same information appears in two files, one will drift and lie.

| File | Responsibility | What belongs | Does NOT belongs |
|------|---------------|--------------|-----------------|
| **AGENTS.md** | Dev standards + current phase | Six-Gate / TDD / Git workflow / current state | Old release histories, project structure tree, full version timeline |
| **CLAUDE.md** | Historical mirror (pointer stub only) | One-line redirect to `AGENTS.md` | All new process content (CLAUDE.md is frozen) |
| **ROADMAP.md** | Planning | Next Milestone / Version Timeline (condensed) / Deferred & Backlog | Per-version detail (use CHANGELOG) |
| **CHANGELOG.md** | History (Keep a Changelog) | Per-version Added/Changed/Fixed/Removed — ancient versions are pre-aggregated, **do not re-merge** | Forward-looking plans, dev standards |
| **CONTRIBUTING.md** | Contributor guide | Project structure tree, architecture, Mermaid, dev setup | User docs, design philosophy |
| **10 READMEs (EN + 9 i18n)** | User docs | Features / Quick Start / FAQ | Implementation details, internal version numbers, What's New |
| **memory/** | Session-persistent lessons | [[feedback-*]] (rules) + [[project-*]] (current state) | Code references that drift (use code comments) |

**Cross-reference format:** `[section](./OTHER.md#anchor)` — keep one canonical source, link to it.

**CHANGELOG rule:** Already aggregated per Keep a Changelog spec. Ancient versions (v1.6.x / 0.2.x) are pre-aggregated — do NOT re-merge. "Optimization" that deletes historical version info is a regression, not improvement. Verify with `grep -c "^## \[" CHANGELOG.md` before assuming it needs work.

---

**Maintainer:** Greener-Dalii | **Repository:** green-dalii/obsidian-llm-wiki