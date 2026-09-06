# LLM Wiki Plugin — Project Memory

> **Audience:** anyone landing on this repo (collaborators, reviewers, future
> maintainers). Not an LLM-agent session log. The only durable,
> externally-checked-in, single-source-of-truth record for this project
> is **this file** ([MEMORY.md](./MEMORY.md)); there is no per-agent private
> memory directory checked in to the repository.

---

## Current state (2026-09-06)

**Latest shipped:** **v1.27.1 PATCH** (2026-09-06) — 46 merge commits since
v1.27.0, 194 files, +10487/−3258 LOC, **3993 tests / 282 files** (see CHANGELOG
§1.27.1). Content: deterministic related lists (#636), sourced-paragraph
rewrite guard (#631), vault-wide folder-link repoint (#626), stream-path
thinking policy (#629), local-calendar dates (#612), two-gate contradiction
records (#610), stop-word/lex-PPR fix (#625), 3-phase repo audit
(#632/#633/#634), dependency-security root fix (#637: fast-uri ^3.1.7, CI
`pnpm audit` gate, `.github/dependabot.yml` weekly auto-PRs). All Gate-1 green.

**Next:** v1.27.x PATCH shipped — remaining open design calls #603 (write-gate
contract) / #604 (dead contradiction loop) / #567 (limit contract); Jan-Heldal
#592/#593/#594/#597 PRs if submitted; #542 + #407-Stage-2; future MINOR
(v1.28.0) backlog #608 image-embed ingest + #317/#326/#295 design-track.
ROADMAP.md "v1.27.x PATCH" milestone now CLOSED (shipped as v1.27.1); open
items live under `v1.27.0+ research` / backlog rows.

> **Superseded 2026-09-06 (v1.27.1 shipped):** the 2026-09-05 block below is
> the pre-release snapshot (3975 tests, main `ddf392d`). Kept for
> archaeology — do not update the old block.

## Current state (2026-09-05)

**Latest shipped:** **v1.27.0 MINOR** (2026-08-27) — 36 commits, 181 files,
+11197/-3158 LOC, **3677 tests passing** (see CHANGELOG §1.27.0). Since then the
v1.27.x PATCH slot has taken 26 PRs: wave A (09-02, 12 PRs), wave B (09-04,
9 PRs), wave C (09-04/05, 5 DocTpoint fix PRs #625/#626/#629/#630/#631 closing
#623/#624/#627/#628) plus the 3-phase repo-audit cleanup (#632/#633/#634).
**3975 tests / 279 files on main `ddf392d`**, all Gate-1 green.

**Next:** v1.27.x PATCH remaining scope — re-review #569-11-commits if updated,
decide #603 (write-gate contract) / #604 (dead contradiction loop) / #567
(limit contract), Jan-Heldal #592/#593/#594/#597 PRs if submitted, #542 +
first #407-Stage-2 PR, #539 follow-ups, then #528/#521 late-PATCH.
ROADMAP.md "v1.27.x PATCH" milestone is the live tracker.

> **Superseded 2026-09-05 (wave-C merge):** the 2026-08-27 pointer block below
> is the pre-PATCH snapshot. Current state is the block above (3975 tests,
> main `ddf392d`). Kept for archaeology — do not update the old block.

**Latest shipped (2026-08-27 snapshot):** **v1.27.0 MINOR** — 36 commits, 181 files, +11197/-3158 LOC,
**3677 tests passing**. Highlights: Bedrock SSO/IAM (#425 / PR #540),
MinerU multi-format ingest (#404), source-page verbatim quotes (#496),
Fix Dead Links leave-it (#485), ingest candidate gate (#514), per-step
taskPolicies UI (#525/#490), composite-key LLM probe caches (#551/#552/#553),
release chore `npm audit HIGH→0` (#501).

**Next:** v1.27.x PATCH slot carries deferred items (alias-floor unification
#537×#532, bounded type-repair fan-out #528, zh/ja candidate-gate measurement
#521, #407 Stage 2 silent-failure sites, #542/#543 follow-ups, **#562/#558/#556
ship-day bugs from @DocTpoint's triage**). ROADMAP.md "v1.27.x PATCH" milestone
is the live tracker. PRs #559 (alias) / #564 (gate) / #557 (pnpm) approved,
merge in progress.

---

## Process invariants (non-negotiable)

### Six-Gate Quality Closure
Every release ships through six gates before merge:

| Gate | Constraint |
|------|-----------|
| 1. Code correct | `pnpm lint` 0/0 + `npx tsc --noEmit` 0 + `pnpm build` clean + `pnpm test` all pass + `pnpm css-lint` 0 |
| 2. No side effects | Call-site audit + data flow + state mutation + error propagation |
| 3. No breaking | API schema, settings, file format, command IDs, Obsidian API |
| 4. No perf regression | 5-dim written assessment (CPU/Memory/IO/Network/Token) |
| 5. Docs complete | 10 READMEs + ROADMAP + AGENTS.md + CHANGELOG + memory |
| 6. Release clean | superset 1-5 + TOC + i18n + Release Notes + Contributors + git hygiene |

`pnpm gate:1` is the composite alias for Gate 1 — runs all five in the
**mandatory order build → test** (test reads `main.js` for esbuild bundle
shape; reversed order fails ENOENT on fresh clone).

### Git workflow (enforced since v1.20.2)

```
main (protected, GH013) ────► tag → release
  ├── feat/xxx ── PR → review → admin squash merge → delete branch
  └── fix/xxx  ── PR → review → admin squash merge → delete branch
```

**Per-fix E2E handoff (post-#456 incident, 2026-08-14):**
1. Branch from main
2. RED test → GREEN fix → 4-Gate green
3. Local commit (no push yet)
4. `pnpm build:dev` → verify artifacts (`tail -1 main.js` ends with sourcemap;
   `console.debug` preserved; 3 output files exist)
5. **Report to user** — root cause + file:line + diff + test delta + 6-Gate table
6. **Wait for explicit "可以 push" / "push it" / "ship it"** before `git push` + `gh pr create`
7. **Wait for explicit "merge it" / "合并"** before `gh pr merge`

### Mandatory merge sequence (added 2026-08-18)

```
gh pr review <N> --body "<file>"   # MANDATORY: formal review event lands on PR
gh pr merge <N> --admin --squash --delete-branch   # ONLY after "merge it"
```

`gh pr review --approve` MUST be posted BEFORE `gh pr merge`. `--admin`
bypasses the requirement rule, not the review event rule — two separate
audit surfaces. If `--approve` was skipped, post `gh pr comment <N> --body-file
<audit-note>` patching the audit trail only.

### Bot double-lint invariant

- Local `pnpm lint` = `eslint src/` only. **Obsidian review Bot scans the
  whole repo `.ts` tree** including `tools/`.
- The v1.26.1 release shipped a blocking `unsafe-call` Error in
  `tools/llm-wiki-cli/src/obsidian.ts` that local lint never saw.
- `pnpm lint:tools-bot` (v1.26.2+) is the local pre-check — read its
  output, don't just check exit code. New warnings on touched code MUST
  be fixed before submission; pre-existing structural warnings on
  `tools/legacy/cli-v1.26.4-snapshot` are accepted.

### Lockfile rule

- **Never** use `mktemp -d` for npm `--package-lock-only` (v1.23.2 lesson:
  re-resolves from registry and drifts from pnpm).
- **Always** `rm -f pnpm-lock.yaml && pnpm install && npm install
  --legacy-peer-deps --package-lock-only` in the project directory. The
  project pins `pnpm@10.14.0`; the flat pnpm overrides live in
  `pnpm-workspace.yaml` (the `pnpm` field in package.json is deprecated and
  pnpm >= 11 no longer reads it, Issue #556) — npm `overrides` has different
  semantics, so `package.json` keeps the top-level key with the same flat
  values to keep both lockfiles aligned.

### Issue close keyword

PR commit body MUST use `Closes #N` (or `Fixes #N` / `Resolves #N`) — NOT
`Refs #N` / `See #N` / `Related to #N`. GitHub does NOT honor the latter for
auto-close. Squash-merge must preserve the keyword in the squash commit
body. Verified 2026-08-07: the v1.26.0 MINOR batch had 5 state-drift issues
because PRs #401/#406/#410/#411 used non-closing keywords.

---

## Key design decisions (canonical references)

| Decision | Pointer |
|----------|---------|
| **Schema 三层分离** (Issue #328 Phase 1) — `schema/config.md` owns user domain knowledge, settings panel injects runtime params at call time, engine ships facts in code. Adding user params to schema file = dual-source drift. | ROADMAP §"Schema 三层分离"; AGENTS.md §"Schema 三层分离" |
| **Complementary memory model** (Issue #358) — wiki pages serve *different* queries than raw notes; do NOT try to make wiki win every query. "Self-improving" = periodic consolidation pass with LLM judgement on past decisions, NOT a smarter ingest path. | AGENTS.md §"Complementary memory model"; ROADMAP §v1.27.0 MINOR Design track |
| **Codex OAuth discipline** — credentials in Obsidian SecretStorage ONLY, never in `data.json` / logs / Notices / docs / test fixtures. Sign-out overwrites secret with empty value + clears in-memory state. SecretStorage requires Obsidian 1.11.4 — `manifest.json`/badges MUST NOT advertise older minimum. | AGENTS.md §"Codex OAuth provider architecture" |
| **Bedrock SSO/IAM** (v1.27.0 #425) — three auth modes (API key / SSO / IAM), zero AWS SDK, hand-rolled IAM Identity Center OIDC + SigV4, secrets in `karpathywiki-bedrock-sso` / `karpathywiki-bedrock-iam` SecretStorage only. Three isolated constants (`BEDROCK_MANTLE_SIGNING_SERVICE='bedrock'`, content-sha256 switch, portal-host bearer scheme) are the only dials a real-AWS E2E would need. | CHANGELOG §1.27.0 — Bedrock Stage 2 |
| **Force-disable thinking** (v1.26.0 Batch 6 + PR #411) — Layer 1 `reasoningEffort: 'none'` + Layer 3 400-strip retry via `reasoning-strip-probe.ts` + Layer 4 prompt-level "do not reason step by step". Never write `thinking.type` or `chat_template_kwargs` into provider options — AI SDK zod silently drops them. | AGENTS.md §"Force-disable thinking"; [[feedback_force_disable_thinking_openai_compat_noop]] |
| **Dead-code-as-docs policy** (v1.26.0 Batch 4) — exported symbols with zero production importers have a **half-life of one release cycle**. Wire or delete before next MINOR ships. `pre-release-gate` Phase 2g enforces. | AGENTS.md §"Dead-code-as-docs policy"; [[feedback_dead_code_as_docs]] |
| **Settings panel scope rule** (v1.26.0 Batch 2 lesson) — `advanced-section.ts` = LLM sampling + provider overrides ONLY. Bottom `advanced-settings-section.ts` = dedup thresholds + per-source toggles + storage flags. New toggle? Decide FIRST which scope. | AGENTS.md §"Settings panel scope rule"; [[feedback_settings_panel_naming_collision]] |
| **Architect-level contributors** (v1.26.0+) — currently @DocTpoint with Write role on personal repo; "no push to main" enforced by branch protection, not role. | [[project_architect_contributor_policy]] |

---

## Architectural invariants (write-once)

- **`document` is forbidden in production code** — Obsidian is multi-window,
  `document` may refer to wrong window. Use `activeDocument`. Bot
  `prefer-active-doc` is no-disable. (v1.25.x incident)
- **No `ts-ignore` / `eslint-disable` to silence failures** — fix the root cause
  instead. (v1.20.x rule)
- **LLM calls carry an explicit `task` label** — a call site that omits it
  files under `'untagged'` (a hole in the per-step accounting table), not dropped.
  New `createMessage` call site picks a label named for the step.
- **Per-step `taskPolicies` baseline is `extract`/`extract-retry` in text mode**
  (v1.27.0 #525) — the wire shape every user had before 1.26.3 for the one
  long-output step. Short judgement calls keep the prober's default.
- **Cache bounded growth (every cache)** — hard caps + LRU eviction. No
  unbounded `Set`/`Map`. `thinkingControlCache` bounded by user count;
  `getExistingWikiPages` retained text bounded by 2KB/page.

---

## Lessons learned (from session memory)

Distilled from 75 session-level feedback entries. Full text lives in this
file ([MEMORY.md](./MEMORY.md)); there is no separate per-agent private
memory directory for this project.

### GitHub hygiene

- **Issue state can drift from merge history.** A PR that fixes Issue N
  but uses `Refs #N` / `See #N` / no link in its commit message → GitHub
  does NOT auto-close on merge. Verify with `gh issue view N --json state`
  before declaring an issue "solved". 5 such state-drift issues found on
  2026-08-07 in v1.26.0 alone; remediation is `gh issue close N --comment
  "Closed by PR #XXX (merged ...)"`. (`feedback_issue_tracker_state_vs_merge_history`)
- **`gh release delete` is irreversible.** v1.25.8 incident: deleted the
  published release body. Recovery required re-publishing from a local
  `/tmp/release-body-*.md` backup. Rule: edit in place with
  `gh release edit <tag> --notes-file --draft=false`, never delete. Always
  verify `tagName + isDraft + body` before editing. (`feedback_gh_release_edit_delete_safety`)

### External communication

- **Never append `🤖 Generated with <AI agent>` (Claude Code, Codex,
  Cursor, Pi, or any AI marker) to GitHub replies, release notes, or
  Discussions.** Violates `obsidian-plugin-release` skill; an AI marker
  breaks voice consistency and reads as spam. If posted, fix via REST
  PATCH on the comment body. (`feedback_no_ai_marker_in_reply`)
- **Public content (Issues, PRs, Release Notes) must NOT include
  `[[feedback_*]]` / `[[project_*]]` memory pointers.** Those are session-private
  wiki-link notation that does NOT render in GitHub markdown and is
  unreadable by other developers. Reference public docs (AGENTS.md /
  CHANGELOG.md / SPEC.md) instead. (`feedback_public_content_no_internal_pointers`)
- **GitHub comments: no hard single-`\n` linebreaks between sentences**
  — they render as `<br>` which is jarring. Use `\n\n` for proper
  paragraph spacing. (`feedback_github_comment_no_hard_linebreaks`)

### Provider / config reality check

- **Don't doubt existing LLM providers based on name unfamiliarity.**
  v1.18.2 incident: called MiniMax a typo; user proved it ships in production
  with a real `baseUrl` (`api.minimaxi.com`). Always verify by baseUrl +
  live response, never by name recognition. (`feedback_dont_doubt_existing_providers`)

### Build / release mechanics

- **Lockfile regeneration: never `npm install --package-lock-only` in an
  isolated directory.** v1.23.2 incident: AI-SDK patch versions silently
  drifted the npm lockfile while pnpm stayed clean. Correct sequence:
  (1) `rm -f pnpm-lock.yaml && pnpm install`,
  (2) `npm install --legacy-peer-deps --package-lock-only` in the
  project dir (where `node_modules` already exists), (3) commit both
  lockfiles in the same release commit. (`feedback_lockfile_regeneration_procedure`)
- **Post-compaction re-hydration.** After every context compaction,
  re-read AGENTS.md → CHANGELOG.md → ROADMAP.md → `git log --oneline -20` →
  open Issues/PRs before continuing any non-trivial change. Compaction
  erases decisions that look obvious only with full context. (`feedback_post_compact_rehydration`)

### GitHub heuristics & review-event surfaces

- **`Refs #N` semantic can auto-close issues on doc-only PRs.** 2026-07-14:
  PR #278 (doc-only AGENTS.md/ROADMAP.md) body said "to close #255" and
  GitHub's heuristic closed #255 even though the PR had zero runtime change.
  Use "tracked by" / "see" / "blocked by" in doc PR body text. Verify
  issue state right after merge; `gh issue reopen N` if unexpectedly closed.
  (`feedback_github_refs_heuristic_close`)
- **Local lint is blind to whole-repo issues.** `pnpm lint` = `eslint src/`
  only; Obsidian review Bot scans the entire repo `.ts` tree including
  `tools/`. v1.26.1 shipped a blocking `unsafe-call` Error in
  `tools/llm-wiki-cli/src/obsidian.ts` that local lint never saw. Run
  `pnpm lint:tools-bot` before every release. (`feedback_obsidian_bot_tools_cli_warnings`)

### CLI surface (post-PR #511 demote)

- **`pnpm llm-wiki` script no longer exists.** PR #511 (v1.27.0) demoted
  `tools/llm-wiki-cli/` → `tools/dev-instrument/` (dev-only measurement
  instrument, NOT a user CLI). The `package.json` `bin` field was removed.
  **User-facing CLI now lives in the sibling repo
  [`green-dalii/obsidian-llm-wiki-cli`](https://github.com/green-dalii/obsidian-llm-wiki-cli)**
  (`npm i -g karpathywiki-cli`). This repo's `tools/dev-instrument/` is for
  engine contributors only — do not point users at it. (`project_v1_27_0_cli_demote_done`)

### Engine invariants (engine contributors)

- **Dedup halving was dead code.** v1.26.0 Batch 2: counter reset inside
  the for-loop so concurrency halving never actually halved; `null` and
  `{"duplicates":[]}` both routed to `[]` conflated truncation with success.
  Fix PR #411 (Batches 6+7). Future LLM business paths need retry + backoff
  + halving + log + Notice — extract `callLlmWithRetry<T>()` from
  `runDedupPhase` before adding a 6th caller. (`feedback_dedup_phase_halving_dead_code`,
  `feedback_dedup_phase_truncation_vs_empty_conflation`, `feedback_llm_retry_extraction`)
- **`schema/config.md` MUST stay pure user-domain knowledge.** v1.26.0 Batch
  1 (Issue #328) fixed the dual-source tag-vocab problem: schema file owns
  user domain knowledge (page templates, content rules, naming conventions,
  merge policies); runtime parameters (tag vocabulary, folder layout, output
  language, page-type registration) MUST be injected at call time via
  `getSchemaContext()`, never baked into the schema file. Violating
  reintroduces the dual-source drift Phase 1 was designed to eliminate.
  (`feedback-schema-phase1-option-a-decision`, `feedback_schema_template_programmatic_injection`)

### PR self-approve & maintainer passby

- **GitHub blocks self-approve on own PR.** Platform hard restriction:
  `gh pr review <N> --approve` on your own PR fails with
  `GraphQL: Review Can not approve your own pull request`. For own-PR
  merges, use `gh pr merge <N> --admin --squash --delete-branch` (the
  `--admin` flag bypasses the requirement rule, not the review event
  rule). After merge, post `gh pr comment <N> --body-file <audit-note>`
  to patch the audit trail. Document the procedural miss in the audit
  note; do NOT rebase or amend. (`feedback_pr_merge_workflow`,
  `feedback_pr_review_vs_comment`)
- **Architect-level contributor PRs do NOT need `--admin`.** `@DocTpoint`
  PRs (and any future architect-level Write-role contributor) can be
  merged via standard `gh pr merge <N> --squash --delete-branch` once
  `--approve` lands — `--admin` is only required for own-PR self-approve
  bypass. Habitually adding `--admin` to every merge creates branch
  protection audit noise. (`feedback_architect_pr_merge_no_bypass`)

### GraphQL stale-read & reply language

- **`gh issue view --json` returns stale state after `gh issue edit --add-label`
  or `--milestone`.** GraphQL EOF is intermittent; audit MUST use REST
  (`gh api /repos/.../issues/N/labels` + `gh api /repos/.../issues/N` for
  milestone). Repeat retries on a "stale-looking" edit usually just spam
  GitHub's rate limit — first confirm with REST, then retry if needed.
  (`feedback_gh_cli_graphql_eof_stale_reads`)
- **Reply drafts MUST match the submitter's language.** English Issue →
  English reply; Chinese Issue → Chinese reply. The report body can be
  Chinese (maintainer-facing), but the `#### ✉️ 5. 回复草稿` boxes must
  match the contributor's language. Drafting all 12 replies in Chinese
  for an English-submitter pool is condescending to architect-level
  contributors and breaks codebase convention. (`feedback_reply_language_match_submitter`)

### Cross-release hidden coupling (v1.27.0 ship-day bugs)

- **Path-changing PRs must sync-audit the `readme-links` guard.** v1.27.0
  PR #511 demoted `tools/llm-wiki-cli/` → `tools/dev-instrument/`,
  introducing new paths. v1.27.0 PR #560 added `](tools/dev-instrument/README.md)`
  relative links to 11 READMEs, which v1.25.11 PATCH #375
  (`src/__tests__/root/readme-links.test.ts`) forbids. CI was 11× red from
  `bd0da25` until a maintainer-passby merge shipped #566 the same day.
  **Rule:** when a PR moves/renames any repo path that appears in any
  README, the PR must sync-update every README link to the new path AND
  verify locally with `pnpm test src/__tests__/root/readme-links.test.ts`.
  (`feedback_gh_cli_graphql_eof_stale_reads` -- related audit pattern)
- **`pnpm.overrides` is deprecated; pnpm >= 11 silently drops it.** Issue
  #556 / PR #557: the `pnpm.overrides` and `pnpm.onlyBuiltDependencies`
  fields in `package.json` print a deprecation warning on pnpm 10.14 and
  are not read by pnpm 11. Move both keys to `pnpm-workspace.yaml`, keep
  the top-level `overrides` for npm-side pinning, drop the deprecated
  `pnpm` block. Future `packageManager` upgrades will silently lose the
  pin otherwise — same failure class as #501 but on the pnpm half.
  (`feedback_lockfile_regeneration_procedure` -- related lockfile rule)

---

## Release cadence (since v1.20.2)

- v1.20.2–v1.24.x: PATCH cadence every 1-2 weeks, occasional MINOR (v1.24.0)
- v1.25.x: 11 PATCH releases in 6 weeks (eucher-era hot-fix cadence)
- v1.26.x: 5 releases (v1.26.0 MINOR + v1.26.1–v1.26.4 PATCH)
- **v1.27.0 MINOR** ships 2026-08-27; **in** v1.27.x PATCH (wave A 09-02: 12 PRs; wave B 09-04: 9 PRs; next release after #569/#607 or community PRs land)

MINOR cadence is roughly every 3-4 PATCH releases or when an architect-level
contributor lands a ≥5-PR cluster. Decision documented in AGENTS.md "PR merge
workflow".

---

## Lessons learned (2026-09-05 session — wave-C 5-PR merge + audit-trio + doc sync)

**Trigger:** user "按你建议执行 review+Approve+Merge，然后更新 CHANGELOG、ROADMAP、MEMORY、CONTRIBUTING". Merged #630 → #629 → #625 → #626 → #631 (small-to-large; audits #632/#633/#634 already on main as base); main `bf3cd3d` → `ddf392d`; 3932 → 3975 tests (279 files). Labels `bug` + milestone `v1.27.x PATCH` applied to all five post-merge (verify showed 630/629/625 first, 626/631 needed a retry pass). Linked issues #623/#624/#627/#628 auto-closed via `Closes`.

### Durable lessons

1. **Merge-then-label works but verify per item, not per batch.** `gh pr edit --add-label --milestone` on merged PRs succeeds, but GraphQL EOF/TLS flakes meant the batch verify loop timed out after 3 of 5 — the remaining two needed an individual retry. Lesson: verify each PR's labels+milestone in the same command that sets them, with retries, before moving on.
2. **Zero-file-overlap across a same-author wave is checkable in one pass and worth checking.** The five DocTpoint PRs touched disjoint production files (ppr-cascade / related-link-corrector+wiki-engine / llm-client-wrapper / section-extractor / paragraph-provenance+merge/related-page) — confirming `交集=∅` up front justified the small-to-large merge order and ruled out cross-PR conflicts without rebases.
3. **Doc-sync arithmetic must be recomputed from git log, not carried forward.** The CHANGELOG header I inherited said "21 PRs … 3677 → 3830" (wave A+B only); the true post-wave-C count is 26 PRs / 3975 tests — wave C (5) + audit trio (3) + #569/#607 (2, merged 09-04 after the 21-PR doc commit `0ad53c6`) were all missing. `git log --oneline <last-doc-commit>..HEAD` is the source of truth for "N PRs merged" lines.
4. **#629 closed the b302aab reasoning-streaming question.** The streamed answer "thought 43/55s" because `taskPolicies` never reached `createMessageStream` — verified reasoning never enters `onChunk` (earlier session), so the policy gap was the only remaining suspect and #629's diff confirms it. Record the negative result where the question was asked: b302aab (wrap-string format + idempotence guard) cannot cause reasoning streaming.
5. **#631's accepted inconsistency is now project state.** Rewrite paths are 2-guarded (`merge-page`, `related-page` via `guardBodyRewrite`) / 1-unguarded (`mergeDuplicatePages`, `resolveContradiction`). The follow-up note exists in the review comment and ROADMAP wave-C table — the next person touching either unguarded path must read it first.

### State pointers (2026-09-05)

- **Open PRs:** #570 (wontfix, no action). #569/#607 already MERGED 09-04 (verify before re-reviewing — ROADMAP backlog row 1 is stale).
- **Open design calls:** #603 (write-gate contract), #604 (dead contradiction loop), #567 (limit contract) — unchanged.
- **Community:** Jan-Heldal #592/#593/#594/#597 still awaiting PRs; #608 image-embeds deferred to MINOR.
- **Milestones:** v1.27.x PATCH open=10; v1.27.0 MINOR closed (0); v1.27.0+ research open=15.
- **Docs synced:** CHANGELOG [Unreleased] (5 Fixed + 1 Refactor entries), ROADMAP wave-C table + header date, MEMORY current-state + this lesson block, CONTRIBUTING test count + 2 tree rows.

## Lessons learned (2026-09-04 session — wave-B rewrite-safety audit + 21-PR PATCH wave)

**Trigger:** post-09-02 PATCH continuation. Merged 21 PRs total (wave A 12 on 09-02, wave B 9 on 09-04); main `7c4d144` → `8feb5fd`; 3677 → 3830 tests. Wave B was DocTpoint's rewrite-safety audit — every PR measured on a 413-note German vault with per-write audit parking (previous version saved before each write), exposing a whole class of "non-lossy promise broken" bugs.

### Durable lessons

1. **Merge-stack conflicts on shared files are the norm for same-author waves, not the exception.** Wave B's stacked PRs (#606→#610; #569→#607) each carried their base's commits; when the base merged to main first, the child's diff was computed against a stale base and went CONFLICTING. Resolution pattern that worked: fetch head, `git merge origin/main`, resolve per-hunk (keep BOTH sides when two complementary changes touch the same lines — e.g. `localDateStamp` from #612 + `wikiRelativePagePath` from #606 — keep the child's superset in tests), local Gate 1, force-push to the fork. **Cost:** two force-push cycles (#600, #606, #610). Lesson: for stacked same-author PRs, either merge the whole stack in one sitting before anything else lands, or expect per-child conflict resolution.
2. **`v1.27.0 MINOR` GitHub milestone is a shipped release — it must never receive new open items.** I moved #569/#568/#567 there from PATCH (judging them "MINOR-scale work") and was corrected: a released milestone is closed to new work by definition. Future-work items belong under `v1.27.x PATCH` (the only active cycle) or a not-yet-created v1.28.0 milestone. **Scale of a PR (35 files) is a code-size observation, not a release-window argument.**
3. **`shazam_verify` after every edit is a hard requirement the harness enforces — including markdown.** Doc edits to ROADMAP/CHANGELOG trigger the same turn-end verification as code edits.
4. **DocTpoint's write-audit methodology is the project's best bug-discovery instrument.** Park-previous-version-before-every-write + compare → surfaced #613 (573 misdirected source rewrites), #614 (180 mentions losses), #617 (9 sections, 34K chars lost) — three data-corruption classes no fuzz test would find. When a future contributor wants to hunt bugs, this is the pattern to copy.
5. **Co-maintainer credit landed (PR #619, owner-approved).** DocTpoint is now in manifest author + README maintainer + NOTICE. Permission elevation (to `maintain` role) remains a separate decision, still gated on ruleset required-review per the 09-02 research — credit and permission are different surfaces.

### State pointers (2026-09-04)

- **Open PRs:** #569 (domain-axis, B1-B6 fixed 09-02, needs full re-review of 11 commits), #607 (gate three-outcome table, stacked on #569), #570 (wontfix).
- **Open design calls:** #603 (write-gate contract), #604 (dead contradiction loop), #567 (limit contract).
- **Community:** Jan-Heldal bugs #592/#593/#594/#597 invited to PR; Chase07 #608 image-embeds deferred to MINOR.
- **Milestones:** v1.27.x PATCH open=11; v1.27.0 MINOR closed (0 open); v1.27.0+ research open=15.

---

## Lessons learned (2026-08-30 session — Hermes cross-reference)

**Trigger:** Issue #575 (newly opened) + DocTpoint's 2026-08-30 revive of
Issue #220, cross-referenced against the Hermes agent's bundled `llm-wiki`
skill (`NousResearch/hermes-agent`, `skills/research/llm-wiki/SKILL.md`
v2.1.0; PR #5100 introduction; PR #13700 provenance/sha256/quality signals;
PR #5635 skill-config interface). Full analysis: see commit history of the
2026-08-30 session for the prior write-up.

### Cross-reference table — borrow / don't-borrow / borrow-and-rewrite

| Hermes does | We do | Action |
|---|---|---|
| Raw sources carry `sha256:` frontmatter (PR #13700) | Derived `wiki/sources/*.md` carries `contentHash` (`src/wiki/wiki-engine.ts:1470`, PR #164) | **Borrow-and-rewrite**: our posture (plugin never writes user notes) is more conservative than Hermes'; keep it. The fingerprint function `hashBody(extractBody(content))` is the same in both — body-only SHA-256, frontmatter excluded so it doesn't hash itself. |
| Re-ingest: skip when body hash unchanged, flag drift when changed; report-only | #577 (open PR by DocTpoint, 2026-08-30) does exactly this on the read half of #220 Tier 0 | **Borrow unchanged**. Hermes and #577 are second-source-of-truth for the same design judgment. |
| Paragraph-level provenance markers `^[raw/articles/source.md]` on pages synthesising 3+ sources (PR #13700) | Structured `Mentions:` block + per-claim `mentions_in_source` fields | **Don't borrow** (yet). Reader-UX enhancement, not core. Our structured form is friendlier for LLM parsing; human-traceability is satisfied by `Mentions:`. Revisit only if user-research shows the gap. |
| Three-layer architecture (raw / entities / schema) | AGENTS.md "Three-layer architecture" (Sources → Wiki → Schema) | **Borrow unchanged** — same concept, same folder isolation in our vault. |
| Compile-once vs. RAG-rediscover | Same — LLM-wiki pattern is the assumption, not a feature | **Borrow unchanged**. |
| Contradiction handling: frontmatter mark + body keeps both positions with dates + source | `ContradictionManager` writes structured contradiction records in lint phase | **Borrow-and-rewrite**: keep the structured representation; do NOT regress to LLM-readable text. |
| `mergeAnalysis` falls through to body-rewrite on contradiction; no structured signal kept at the merge point | Same — issue #575 documents this as a literal bug (`merge` definition includes "contradicts" bullet → `strategy: "contradictory"` is unreachable, 0/58 calls) | **Fix #575** (see "Next moves" below). DocTpoint called this out in #220 comment on 2026-07-12; #575 is the more specific location. |

### First-principles anchors

- **Drift detection is intrinsic to wiki-mode**, not an optional add-on. Wiki's
  premise (offline-compiled synthesis > per-query RAG) breaks the moment
  sources change silently. So `contentHash` + read-back lint is required
  for the pattern to hold.
- **Auto-revise on drift is empirically harmful** — Wikipedia's 30-year
  track record shows fact-revision-on-page-X does NOT auto-propagate to
  pages that reference X; an automatic fix risks unbounded cascade
  corruption. DocTpoint's #220 Tier 3 explicitly preserves this
  conservatism ("detect and flag, not auto-rewrite"). Hermes PR #13700
  commit message is also explicit: report-only, not a hard error. So:
  report drift → route to user, do not auto-re-ingest, do not auto-revise.
- **Tier 2 of #220 ("recency ≠ correctness") stays open by design**. A
  "newest wins" rule would silently collapse editorial disagreement into
  recency, which is exactly the failure mode #358 (complementary memory
  model) warns against. Until we have a real benchmark for cross-source
  resolution, **do not implement** an automatic rule here.

### Next moves (recorded here so they're findable later)

1. **Fix #575** — owner-self, ~half-day. Remove "contradicts" from the `merge`
   definition bullet list so `strategy: "contradictory"` becomes reachable.
   When `mergeAnalysis` returns `contradictory`, push the structured
   record to `ContradictionManager` at merge time (DocTpoint's #220
   comment 2026-07-12 already proposed this; #575 is the specific
   evidence that the path was unreachable). Test delta: ~3-5 unit tests
   covering the now-reachable path.
2. **Review PR #577** — the read half of #220 Tier 0 as a report-only
   lint check (DocTpoint, 2026-08-30, 3699 tests passing, tsc/eslint
   clean per PR description). Design matches Hermes and our own
   `hashBody` post-#164; the only thing to verify is the edge-case
   conservatism (skip pages with no `contentHash`, multi-source pages
   with one surviving match, etc.).
3. **Defer Tier 1 (`supersedes:` frontmatter flag) to a later MINOR**.
   After #577 lands, the Tier 1 contract becomes: fingerprint detects
   drift → user-declared `supersedes: true` overrides fingerprint
   ambiguity → deterministic replace-self-block path. Not urgent; not
   PATCH-scale; do not bundle with #577 in the same cycle.
4. **Hold open**: Tier 2 (cross-source resolution) and Tier 3 (review
   queue UI). Tier 3 is a product-surface decision; route to MINOR-track
   design discussion. Tier 2 has no good automatic answer — do NOT
   propose "newest wins" as a default.

### Session memory pointer

This section was extracted from the 2026-08-30 session's full analysis
(in `/tmp/...` working notes of the same session). Full technical detail
on Hermes's PR #13700 commit message, sha256-frontmatter mechanics, and
the contradiction-handling comparison is recoverable from the session
transcript; the *conclusions* — borrow table, first-principles anchors,
next moves — are captured here for retrieval.

---

## Where to look

- **Project standards & process:** [AGENTS.md](./AGENTS.md) (canonical; the historical [CLAUDE.md](./CLAUDE.md) is now a pointer stub only)
- **Roadmap & planning:** [ROADMAP.md](./ROADMAP.md)
- **Per-version history:** [CHANGELOG.md](./CHANGELOG.md)
- **Contributor guide:** [CONTRIBUTING.md](./CONTRIBUTING.md)
- **Architect-level attribution:** [NOTICE](./NOTICE)
- **Release workflow skill:** `~/.pi/skills/obsidian-plugin-release/SKILL.md` (Pi canonical; legacy alias `~/.claude/skills/...` still works under Claude Code sessions)
- **Detailed session learnings (project-internal):** the durable record for this project is this file ([MEMORY.md](./MEMORY.md)). No per-agent private memory directory is maintained in the repository.

---

**Maintainer:** [@green-dalii](https://github.com/green-dalii) ·
**Repository:** [green-dalii/obsidian-llm-wiki](https://github.com/green-dalii/obsidian-llm-wiki)
