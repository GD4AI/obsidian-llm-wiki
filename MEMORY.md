# LLM Wiki Plugin — Project Memory

> **Audience:** anyone landing on this repo (collaborators, reviewers, future
> maintainers). Not an LLM-agent session log. The only durable,
> externally-checked-in, single-source-of-truth record for this project
> is **this file** ([MEMORY.md](./MEMORY.md)); there is no per-agent private
> memory directory checked in to the repository.

---

## Current state (2026-09-20)

**Latest shipped release:** **v1.27.2 PATCH** (2026-09-15, 4144 tests / 294 files —
see CHANGELOG §1.27.2). Nothing released since. `main` = **`4f56b475`**, Gate 1 green
at **308 files / 4285 tests**. **v1.28.0 MINOR is in flight.**

**⭐ #603 is CLOSED** (#750 merged), so the write-path contract holds and **#729
Phase 1 is unblocked** — that was the head of the v1.28.0 chain. The chain is now
#662 ✅ (shipped in #757) → #729 P1 → P2 + #664 → P3-6.

**Merged into v1.28.0 so far (unreleased):**

- **#750** — **#603 slices 2 + 3**, and the four rounds it took are the most
  instructive review of the cycle. Closes **#603**. Three blocking findings, two of
  them behaviour regressions the slice introduced, each now covered by a test that
  fails without its fix. See §"Slice 3 reviewed" for the chain and §"Write path"
  for the shape.
- **#757** — **#662**: `getExistingWikiPages` no longer walks the vault per written
  page. From @DocTpoint; closes **#662**.
- **#759** — **#751**: the build-config one-liner that made two shipped features
  work. Closes **#751** and, transitively, **#665**. See §"The build test that was
  protecting the bug".
- **#773** — **#699**: third-party licence notices generated from the built bundle
  rather than hand-listed. Closes **#699**. See §"Third-party notices" for the two
  things the packages' own files did not settle, and §"Notices scope decision" for
  why they live in the repository rather than in the artifact.
- **#762** + **#673** — one change to a user-visible claim, landed as two PRs on
  purpose (EN + DE in one, the other nine locales in the other) because merging
  either alone makes nine locales assert the opposite of what ships. Closes **#672**.
- **#769** — dependabot holds for `obsidian` and `@types/node`, each entry carrying
  the measurement that says why. See §"Two bumps that read opposite to their cost".
- **#765** — dependabot hold for `@ai-sdk/openai-compatible` 3.x, which cannot
  typecheck without `ai@7`; tracked as **#764**.
- **#761** — an AGENTS.md rule: a squash merge is how a contributor's trailer
  reaches a maintainer commit. See §"Main's own commits".
- **#767** — the `yaml` devDependency bump.
- Earlier: #726 (#725), #748 (#603 slice 1), #744 + #746 (#741), #736 (#723/#735),
  #739 (#729 Phase 0), #733 (#669), #737 + #734, #707/#708, #727.

**In review:** **#775** (#467, Gate 1 green, waiting on @DocTpoint); **#760** (#758);
**#656** (@Jan-Heldal's audit-trail fix, which now supersedes an implementation of
mine — see §"The issue that was already being fixed").

**Blocked on other people:** **#687** — @Chase07 confirmed the implementation is
complete and the WIP description was stale, and asked for the maintainer-side
rebase; **it is done and green (309 files / 4298 tests) and cannot be pushed**
because `maintainer_can_modify` is `false`. Waiting on one checkbox. **#755** —
waiting on @weqoocu to strip a version bump (the two features still need the
"one PR or two" answer). **#701** — premise refuted; a product decision.

**New from Dependabot on 2026-09-20:** **#772** (`ai` 6 → 7.0.105), **#771**
(`@ai-sdk/anthropic`), **#770** (TypeScript 5.9.3 → 6). #772 is the piece **#764**
was filed for; the coordinated upgrade is now three PRs that have to move together,
and `@ai-sdk/openai-compatible` is still held so it will not join them.

**Planning lives in ROADMAP §"v1.28.0 MINOR — Design track"** — scope groups,
the hardening-before-reader ordering, and the open decisions. This file carries
the *why* and the *how*, never the window schedule.

---

## Work list (2026-09-20) — ordered by ROI

**ROI = (impact × certainty) / effort.** Certainty is how confident we are the fix
lands *and* stays landed. A high-impact item with unknown reproduction cost ranks
below a medium-impact one that is measured, because the second actually ships.

### Tier 0 — **closed on 2026-09-20**

**#751 landed as #759.** The build-config one-liner is in `main`: `esbuild.config.mjs`
now sets `supported: { 'dynamic-import': false }`, so `await import('node:module')`
compiles to `require` and the renderer can load it. It fixed **two** shipped features —
Codex browser login (#665, closed) and the desktop streaming transport from #746, which
had never loaded once in a release build. **#753 was closed as superseded** on the layer
decision, with the author's diagnosis credited in the closing comment.

Measured by @DocTpoint rather than by me, and his form is stronger: he built the branch
twice, one line apart, and diffed the artifacts — **two lines differ in 4,539,124 bytes**,
both at the intended sites, and the ~30 other runtime `import()` calls were already
require-based under `format: 'cjs'`. "The global switch is safe, not merely untested."

### Tier 0′ — the v1.28.0 chain's head is now unblocked

**#729 Phase 1** (M0 co-citation projection) was hard-blocked on #603 by design: a
reader's acceptance metric is meaningless while the write path's contract does not hold.
**#603 closed with #750**, and **#662 closed with #757**, so both gates are open and
Phase 1 is the highest-ROI substantive work left in the window.

Read `## Design record — cross-source relations (#729, v1.28.0)` for the phase plan and
the two corrections made after the issue was written — in particular that
**`RELATED_BUDGET.siblings` must not be read until Phase 2**, since it is 3/3/2/1/3 while
today every granularity gets a flat 3.

### Tier 1 — unblock the queue (zero new work)

| Item | What it waits on | Effort |
|---|---|---|
| **#687** (@Chase07) | **One checkbox.** The author confirmed the implementation is complete and the WIP wording was stale, and asked for the maintainer-side rebase. It is **done and green** — 7 commits, one conflict (an import block in `source-analyzer.ts`), Gate 1 at 309 files / 4298 tests — and **cannot be pushed**: `maintainer_can_modify` is `false`, so the push is rejected `permission denied`. The branch is parked at `pr-687` @ `e3273353`; push it the moment "Allow edits by maintainers" is ticked. The conflict resolution is described on the PR for him to review | none |
| **#656** (@Jan-Heldal) | @DocTpoint. **Three fixes of mine are already on the branch** (`4c6d2fb1`), pushed as a fast-forward after `gh pr update-branch --rebase`. See §"The issue that was already being fixed" | none |
| **#755** (@weqoocu) | The author, for the "one PR or two" answer. The version bump can be stripped by us — it is three files (`manifest.json`, `package.json`, `CHANGELOG.md`) | small |
| **#701** (@weqoocu) | A product decision. The premise is refuted — see §"#701's premise does not hold" | none |

### Tier 2 — the v1.28.0 feature track (the window's purpose)

Dependency-ordered; each is blocked by the one before it.

1. ✅ **#603** — slices 2+3 landed in **#750**; the issue is closed.
2. ✅ **#662** — landed in **#757**; the page index is held per file and the issue is closed.
3. **#729 Phase 1** (M0 co-citation projection) — hard-blocked on #603 by design: a reader's acceptance metric is meaningless while the write path's contract does not hold.
4. **#729 Phase 2** + **#664 together** — *“they ship together”*: #729 adds Related entries while #664 says those lists already grow ~2 per source and are never pruned. Designed separately, one raises the ceiling while the other leaves the floor open.
5. **#729 Phases 3–6**, then **#668 + #752 together** — #668 restructures the settings tab and #752 is the sibling bug (the panel also jumps back to the top), so fixing the scroll before the restructure means doing it twice. #729's toggle placement is also gated on #668.

### Tier 3 — user-facing bugs worth a PATCH

| Item | Why it ranks here |
|---|---|
| **#703** — ingest hangs indefinitely on one file, `cancelIngestion()` cannot abort it. **High impact, low certainty**: the v1.27.2 release notes already carry it as a Known Issue, but it needs the reporter's file, and it is labelled `help wanted` |
| **#665** | Closed by #751 — do not fix separately |
| **#676**, **#567**, **#597** | Real bugs with narrow reach; #597 already has the #656 PR in review |
| **#699** | Docs: the shipped bundle carries no third-party licence. Cheap and it is a compliance-shaped gap |

### Tier 4 — backlog and design

**#701** awaits a product decision, not code: it writes a marker into the user's own
notes, and §“#701 — the premise does not hold” below records why the two scenarios it
cites are already handled. **#330 / #358** are design anchors rather than tasks.
**#479 / #480** are measurement research. **#91, #112, #142, #168, #184, #220, #285,
#295, #317, #326, #467, #468, #503, #568** are unstarted enhancements on
`v1.27.x PATCH` or older milestones and should be re-triaged at the next planning
pass rather than carried indefinitely.

**Open PRs (2026-09-20):** **#775** (#467, Gate 1 green — the guard is the deliverable,
see §"The unified-model guard was wrong twice") · **#760** (#758) · **#774** (@DocTpoint,
prompts) · **#770 / #771 / #772** (Dependabot: TypeScript 6, `@ai-sdk/anthropic`, and
**`ai` 6 → 7** — #772 is the piece **#764** was filed for, so those three move together
and `@ai-sdk/openai-compatible` stays held).

**Newly filed, unstarted:** **#763** — `writeFileWithIntent` returns `void`, so a
skipped lint write is logged as a fix that happened. Needs a return value; review scoped
it out of #750 and the scope is 8 production declarations plus ~20 test doubles. **#764**
— the coordinated AI SDK v7 upgrade.

> **Superseded 2026-09-17:** the 2026-09-16 block below is the previous snapshot.
> Kept for archaeology — do not update the old block.

---

## Superseded snapshots (2026-09-05 → 2026-09-15)

Three pre-release snapshots used to sit here — the v1.27.2 ship day, the v1.27.1
ship day, and the wave-C merge — each with its own "Next:" list. They are
removed rather than archived in place, because **the per-version composition
record is canonical in [CHANGELOG.md](./CHANGELOG.md)** and a stale "Next:" list is
worse than no list: it reads as current.

For what shipped, read CHANGELOG §1.27.0 / §1.27.1 / §1.27.2. For the planning
view at any point in the past, read ROADMAP's wave sections.

---

## Process invariants (non-negotiable)

**[AGENTS.md](./AGENTS.md) is the single canonical source for process standards.**
This section deliberately does not restate them: a duplicated rule drifts, and
the AGENTS.md copy is the one the release skill reads.

| Invariant | Canonical home |
|---|---|
| Six-Gate Quality Closure; `pnpm gate:1`; the **build → test** order (test reads `main.js`, so the reverse fails with ENOENT on a fresh clone) | AGENTS.md §"🛡️ Six-Gate Quality Closure" |
| Git branch workflow; the 7-step per-fix E2E handoff; the explicit "可以 push" / "merge it" gates | AGENTS.md §"🔀 Git Branch Workflow (enforced since v1.20.2)" |
| `gh pr review` before `gh pr merge` — two separate audit surfaces; `--admin` bypasses the requirement rule, never the review-event rule | AGENTS.md §"Git Branch Workflow" → "Mandatory merge sequence" |
| Obsidian Bot double-lint — local `pnpm lint` covers `src/` only, the Bot scans the whole `.ts` tree incl. `tools/`, `pnpm lint:tools-bot` is the local pre-check | AGENTS.md §"⚠️ Obsidian Bot compliance invariant" |

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
- **`package-lock.json` is load-bearing — do NOT delete it.** Its real
  justification is release reproducibility, not Dependabot: Obsidian's own
  pipeline runs `npm install` and compares the `main.js` it builds against the
  released artifact, and a resolution difference demotes the review score.
  `.npmrc` records that post-mortem (v1.25.1 Phase E) and
  `.github/workflows/release.yml` depends on the same tree (`cache: 'npm'`,
  `npm install --legacy-peer-deps` → `npm run build`). The gate's own header
  comment still justifies itself with Dependabot advisories, which is now
  obsolete — GitHub has supported pnpm for the dependency graph and alerts
  since 2023-08-02 — so do not read that comment as the reason the file exists.
- **Dependabot cannot update both lockfiles, and never will.** This repo
  declares `packageManager: pnpm@10.14.0` plus a `pnpm-workspace.yaml`, so its
  npm ecosystem resolves to pnpm and every PR it opens changes exactly
  `package.json` + `pnpm-lock.yaml` (#652, #706, #707, #708 — all four).
  `dependabot-lockfile.yml` (PR #727, 2026-09-16) regenerates
  `package-lock.json` on the PR branch with `npm install --legacy-peer-deps
  --package-lock-only` and pushes it. That command is **idempotent (SHA-256
  verified)**, which is what keeps the workflow from looping. The push lands as
  `github-actions[bot]`, so its Gate 1 run arrives as `action_required` — one
  click, and it is the same click the ruleset's required review already asks
  for, so do not add `actions: write` to self-approve it.

### Issue close keyword — and its inverse hazard

`Closes #N` / `Fixes #N` / `Resolves #N` in the commit body, never `Refs` /
`See` / `Related to`; the squash commit must carry the keyword. (Verified
2026-08-07: PRs #401/#406/#410/#411 used non-closing keywords and 5 issues
drifted.)

**A keyword does not have to be deliberate, and it does not have to aim at an
issue.** PR #689's body described the milestone in prose — "…#604 sits on
`v1.28.0 MINOR` while its **fix #684** sits on the PATCH line" — and GitHub read
`fix #684` as a closing directive, so merging #689 closed **PR #684** one second
after it landed. `ClosedEvent.closer` was the PR, the author had never touched
it, and a closed PR reads to a contributor as *rejected*.

- Never let `close[sd]?` / `fix(es|ed)?` / `resolve[sd]?` sit immediately before
  `#N` in prose. "The fix for #604 is PR #684" breaks the match; so does a bare
  "PR #684".
- **Negation does not protect it.** GitHub's parser has no notion of "not".
  *"It does not close #741"* closes #741. The first draft of PR #744's body said
  exactly that — announcing that the issue would stay open — and the pre-merge
  scan caught it at 0 hits only after the sentence was rewritten to "#741 stays
  open". This is the same hazard as #689 above, one step further in: there the
  keyword was unintended, here it was **deliberately negated and still armed**.
- **The target decides the damage:** aimed at an issue it closes the issue
  (intended); aimed at a PR it closes the PR.
- Scan before merging:
  `gh pr view <N> --json title,body --jq '.title, .body' | grep -inE '\b(closes?|closed|fix(es|ed)?|resolve[sd]?)\s+#[0-9]+'`
- **Count it, do not eyeball the grep.** `grep ... | sed` in a pipeline exits with
  *sed's* status, so `|| echo "clean"` never fires and an empty result is
  indistinguishable from a match that was swallowed. Use `grep -c` and read the
  number; re-run it against the **PR body as GitHub holds it**, not the local draft.
- Recover with `gh pr reopen <N>`, and read `ClosedEvent` before assuming the
  mechanism: `commit_id` present ⇒ a commit message did it; empty ⇒ API/PR-level.

### Declined PRs are closed, not left open

A PR decided against is **closed** once the contributor has had a fair window to
answer — about two weeks of silence is enough. An open pull request asserts that
merging is still possible, which is exactly what a decline denies; a closed one
cannot collect a stray review. Nothing is lost — branch, diff and thread stay
readable and linkable, which is all "preserved as a reference implementation"
needs. A close means "not now", not "never", so the decision comment **names in
one line what would reopen it.**

**Read the signals before any review.** #570 (2026-09-12) carried three signals
of one decision — a `wontfix` label, a decision comment, draft status — while
staying open, so a `CHANGES_REQUESTED` review landed anyway, contradicting the
decision and inviting work that had already been declined. Recovered by
dismissing the review (`PUT .../reviews/<id>/dismissals`), posting a correction
comment, and converting to draft via `convertPullRequestToDraft` (`gh` has no
`pr draft`; REST's `draft` field is GitHub-App-only). Two ways that check was
built wrong, both caught in review of its first version:

- **Latest, not first** — decisions arrive late on a thread that opened with a
  greeting, and `.[0:1]` returns the *oldest* comment, so it happens to look
  right on the one case it was built against and hides the decision elsewhere.
- **Any maintainer, not one account** — keying on `.author.login ==
  "green-dalii"` makes a decision written by anyone else invisible.

```
gh pr view <N> --json labels,comments \
  --jq '{labels: [.labels[].name], last_comments: [.comments[] | "\(.author.login) \(.createdAt[0:10]): \(.body[0:120])"][-3:]}'
```

Any `wontfix` / `duplicate` / `do not merge` label, or a maintainer comment
recording a decision, means the PR is decided — **stop** and ask, do not review.

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
| **Floor / ceiling asymmetry** (2026-09-16, decided with the maintainer on #729) — a `source → LLM → wiki` flow means the model always affects wiki quality; that is unavoidable and not worth pretending otherwise. What the architecture controls is *which parts* depend on it. Model-independent mechanisms hold the **floor** (a user on a small local model still gets real structure, and upgrading a model cannot retroactively improve a graph that is meant to accumulate); model-dependent mechanisms exist to explore the **ceiling** and are **deferred, never rejected** — closing that door is its own defect. `docs/MODEL-GUIDE.md` already commits to the same asymmetry from the model side: "instruction-following quality matters more than raw IQ for the extraction task". | ROADMAP §v1.28.0 Design track; MEMORY §"Design record — cross-source relations" |

---

## Design record — cross-source relations (#729, v1.28.0)

Recorded 2026-09-16, converged with the maintainer. The planning window lives in
ROADMAP §"v1.28.0 MINOR — Design track"; this section is the *why* and the *how*.

> **Start here if you have no context.** Read `### The measurement` and
> `### Root cause` first — they are the whole reason this work exists. Then
> `### Three mechanisms` for the design, and **`### Implementation plan
> (ordered phases)` to build it**. Everything after that is rationale and
> guardrails. The issue is #729.

### Where the analysis lives — and the two corrections made since

**The measurement, the root cause, the three mechanisms, the budget table, the
allocation algorithm, the definition, the rejection of embeddings and the acceptance
criteria are all in [issue #729](https://github.com/GD4AI/obsidian-llm-wiki/issues/729).**
It was written as the design document and is the canonical statement of them. They
were mirrored here for several rounds and had already begun to diverge — this copy
carried none of the corrections below and the issue carries none of the phase status
that follows. One fact, one place: **read the issue for the design, this section for
what changed afterwards and what is left.**

Two corrections were made here after the issue was written, and would otherwise be
lost:

- **Two concerns, not three of a kind.** `GRANULARITY_FIX_LIMITS` and the `?? 5`
  defaults are **extraction** limits — how many entities/concepts to ask for, read by
  `getGranularityInstruction` and `getGranularityFixLimits`. `SIBLING_CAP` caps
  **Related list entries**. Both are granularity-keyed and nothing else about them is
  the same, so they are two tables in `constants.ts`, not one.
- **The `?? 5` count was 4, not 2** — two in `getGranularityInstruction` (`:209`,
  `:210`) and two in `getGranularityFixLimits` (`:226`, `:227`). Replacing only the
  documented pair would have left two orphaned defaults, the exact scattering the
  constant exists to remove.

And one claim in the issue that did not survive contact, recorded here so Phase 2 does
not re-derive it: **`RELATED_BUDGET.siblings` must NOT be read yet.** It is 3/3/2/1/3
where today every granularity gets a flat 3, so consuming it is not
behaviour-preserving. Phase 0 shipped it unread on purpose; Phase 2 owns it.

**The budget table and the five-step allocation algorithm are in the issue** under
§"1. An adaptive Related budget" and §"2. Reserved allocation, with backfill". Kept
there rather than mirrored: they are the specification Phase 2 implements, and a copy
here would be a second place to update when it changes. The one property worth
carrying at this level is that **the cross-source column is a ceiling, never a
quota** — a page with no cross-source candidates is not made emptier by the feature.

### Implementation plan (ordered phases)

Each phase is independently mergeable and testable. **Do not start phase N+1
before phase N's pass condition holds.** Phases 1–2 are the feature; 3–4 make it
useful and shippable; 0 is a prerequisite; 6 is what decides whether anything
model-dependent is ever opened.

**Phase 0 — centralise the ceilings (no behaviour change). ✅ DONE 2026-09-17**

- Moved `SIBLING_CAP` (`core/related-shaping.ts:67`) → `RELATED_SIBLING_CAP`, and
  `GRANULARITY_FIX_LIMITS` + **four** (not two) `?? 5` literals →
  `EXTRACTION_LIMITS` + `CUSTOM_EXTRACTION_LIMIT_DEFAULT`, all in
  `src/constants.ts`. No re-export from the old homes; both files now import.
- Added `RELATED_BUDGET` — granularity-keyed, **shipped unread on purpose**.
- Updated the single importer (`__tests__/core/related-shaping.test.ts:3`).
- **Pass condition met:** Gate 1 green, 4170/4170, **zero snapshot or fixture
  churn** — the phase is behaviour-identical by definition, so churn here would
  be a bug rather than an update.
- **`siblings` must NOT be read yet.** It is 2 for `coarse` and 1 for `minimal`,
  where today every granularity gets 3, so consuming it would not be
  behaviour-preserving. It is wired in Phase 2, where the change is intended,
  measured and tested — Phase 0's zero-diff condition forbids it here.

**Phase 1 — M0, the co-citation projection.**

- Build the projection from the graph `core/build-graph.ts` already produces:
  for page `P`, candidates are pages sharing ≥1 outgoing target with `P`, ranked
  by shared-target count, **ties broken by path** (project determinism).
- Exclude self, anything already in the note-grounded list, and anything the
  vault resolver rejects.
- Wire it in as a new **optional** dep on `shapeRelatedLists`, so every existing
  unit test keeps compiling untouched:
  ```ts
  candidates?: (self: string, exclude: ReadonlySet<string>) => string[]
  ```
- Run at **write time** (the open question on write-vs-query is resolved in
  favour of write time for this phase) so the edges persist and PPR gets the
  cross-source reach for free rather than re-deriving it per query.
- **Pass condition:** new unit tests for the projection (sharing, ranking order,
  tie determinism, exclusion) plus the existing suite green **with the dep
  absent**. **Then re-measure the 95 % figure on a rebuild.** If this phase alone
  does not move it, stop — the diagnosis is wrong, not the mechanism.

**Phase 2 — allocation (reserved + backfill).**

- Implement the five-step algorithm above inside `shapeRelatedLists`.
- Log both the truncation count and the cross-source count; the acceptance
  criteria are unmeasurable without them.
- **Pass condition:** tests for (a) the reservation holds when candidates exist,
  (b) freed slots return to note-grounded when they do not, (c) totals never
  exceed the tier, (d) an orphan still gets its siblings before anything else.

**Phase 3 — M1, local window ranking.**

- Call `selectCandidateWindow({ name, context: item.summary }, vaultPool, K)`,
  where `vaultPool` is `getExistingWikiPages`' output and `K` is the tier's
  **cross-source budget** (30 is the window's own ceiling, not the budget).
- `wiki-engine.ts:1224` is the call site that must supply the provider.
- **Pass condition:** tests against a stub pool; determinism (same input → same
  output, stable ordering); and **no additional LLM call enters the path**
  (assert the client is untouched).

**Phase 4 — settings toggle + docs.**

- Toggle defaults **on**. Decide its panel **before** writing code:
  content-generation behaviour ⇒ the bottom Advanced panel, per the
  Settings-panel scope rule.
- 11 locale strings, 11 READMEs, CHANGELOG entry under the MINOR.
- **Pass condition:** Gate 1 green; `pnpm lint:tools-bot` clean; i18n parity.

**Phase 5 — companion: multi-hop query decomposition.**

- Extend `generateQueryKeywords`'s contract from `Promise<string[]>` to
  `Promise<{ keywords: string[]; subqueries?: string[] }>` and update its callers
  and tests — that signature change is the whole cost of this phase.
- Decompose **only** when the model marks the query multi-hop.
- **Pass condition:** a simple question is provably not decomposed (fixture
  assertion); a compound one is; the union-of-seeds path is covered.

**Phase 6 — measurement, and the only thing that opens M2.**

- Rebuild a comparable vault, re-measure the intra-source share, re-run the five
  multi-note questions, and check the dead-related-entry baseline (676 / 870).
- Publish the numbers against the staged acceptance criteria below. **M2 (or an
  embedding) is opened by these numbers, never by preference.**

### Definition and companion

- **"Cross-source" = not named by this note's own extraction.** Chosen because
  `getExistingWikiPages` does not expose per-page `sources`; a provenance-based
  definition is more precise and more expensive, and should not be paid for
  before measurement says it matters.
- **Companion: multi-hop query decomposition.** Arm C's three losses are
  multi-note (compound) questions. Decompose into sub-queries, retrieve per
  sub-query and union the seeds — **only for queries classified as multi-hop**;
  over-splitting a simple question is the classic IR regression. The classifier
  folds into the existing Stage 1.5a call (`generateQueryKeywords`, which already
  makes an LLM round-trip on this path) so the decision costs no extra latency.
  Kept in #729 rather than split out: same acceptance harness.

### Why not embeddings

`Zero-embedding graph retrieval` is a load-bearing identity claim — README badge
line, SEO intents ("Obsidian RAG without embeddings"), the competitor comparison
table, README `:229` ("Most 'AI search' plugins … embed them in a vector DB. We
don't."), and `docs/MODEL-GUIDE.md` ("Embedding endpoints are irrelevant — we
don't use embeddings"). It is also a **model-dependent dependency paid by every
install**, including users who chose this plugin because it runs fully local —
the exact asymmetry the floor/ceiling principle warns about. Reopen only if the
lexical residual proves material *after* the floor is raised, and let the staged
acceptance criteria make that visible.

### Acceptance criteria (staged attribution)

1. **M0 only** — intra-source edge share < 95 % on a comparable rebuild (the
   model-independent floor).
2. **M0 + M1** — the further drop, plus the five multi-note questions improving
   in arm C.
3. **M2 justified only if** 1–2 leave the multi-note questions unfixed, or the
   residual gap is demonstrably semantic (*"how knowledge evolves over time"*
   against a page titled *Consolidation kernel*).
4. Dead related entries do not increase — **676 on 870 pages** is the baseline.
5. No regression on single-note questions; the `related-shaping` /
   `related-sections` suites stay green.
6. Gate 1 green; no settings-schema break; a disable switch exists and defaults
   **on** (a deliberate default change ⇒ MINOR).

### Files to touch

`src/constants.ts` (budget table) · `src/core/related-shaping.ts` (import +
allocation + candidate hook) · `src/wiki/system-prompts.ts` (table out, `?? 5`
replaced) · `src/wiki/wiki-engine.ts:1224` (pass the candidate provider) ·
`src/__tests__/core/related-shaping.test.ts` (import + reservation / backfill /
determinism) · `src/texts/*.ts` ×11 (toggle copy) · README ×11 + CHANGELOG.

### Coupling constraints

Two constraints make the build order non-negotiable, and both were found late —
during the 2026-09-16 planning pass, not during design. They are recorded here
because the *reason* is what a future reader needs; the schedule table itself is
in ROADMAP §"Phase schedule".

- **#729 ships with #664.** #729 adds entries to the Related lists; #664
  observes that those lists already grow about two per source and are never
  pruned. Built separately, #729 raises the ceiling while #664 leaves the floor
  open — and the measurement that would catch it (Related length over a rebuild)
  is precisely the one each change would blame the other for.
- **#729 sequences after #668, not parallel to it.** #729 introduces a settings
  toggle defaulting on; #668 restructures the settings tab. Landing the toggle
  first means re-homing it twice.
- **#603 is a hard prerequisite for every sub-phase past 0.** The
  floor-before-ceiling argument applies twice: a faster reader over a store whose
  write-gate contract does not hold moves the error rather than removing it, and
  the phase-1 acceptance criterion (intra-source share) is meaningless if the
  edges it measures can be written by six paths the design does not account for.

### Open questions

- Reserved vs additive (we argue reserved-with-backfill).
- The tier numbers (first proposal).
- M0 at write time or query time.
- Whether the ceiling deserves more than M2 — for instance a periodic
  consolidation pass over accumulated pages (the #358 kernel). This design
deliberately does not close that door.

---

## Design record — write path and page index (#603 / #662, v1.28.0)

**Design pass, 2026-09-16. No implementation.** Both issues describe a surface
problem accurately and enumerate it inaccurately; the enumeration is what decides
the design, so it was re-measured from source rather than trusted.

### The gate bundles four concerns, not one

`createOrUpdateFile` (`wiki/wiki-engine.ts:1873-2045`) is documented as "single
write gate with pollution defense". It actually does four separable things, and
callers want different subsets of them:

| # | Concern | Where |
|---|---|---|
| 1 | Pollution correction (display-name, path-prefix, `sources` field) | `:1884-1932` |
| 2 | Heading + provenance normalization (`normalizeHeadingSpacing`, `normalizeProvenanceMarkers`) | `:1940-1945` |
| 3 | IO with retry + path resolution (3 attempts, directory scan, full scan) | `:1947-2045` |
| 4 | Notification + cache invalidation (`onFileWrite`, `invalidatePageCaches`) | 5 exit points |

The gate offers "all four" or "none", and nothing in between is reachable.

### The decisive evidence is already in the codebase

`wiki-engine.ts:845-851` documents a **deliberate** bypass: the PDF sidecar is
written via the vault directly because going through the gate "would fire
`onFileWrite` + `invalidatePageCaches`, which could trigger auto-ingest cascades if
the source folder is watched."

That comment is the design conclusion, written early by whoever needed it first:
**one gate for every write is the wrong shape**, because concern 4 is sometimes
actively harmful. The sidecar wants concern 3 and nothing else.

### Corrections to the two enumerations

`#603` claims six bypassing writers:

- ❌ **`log-writer.ts` is not one.** Its header states the vault calls "live in
  WikiEngine's tryReadFile / createOrUpdateFile. LogWriter receives these as
  injected" — it goes *through* the gate. The issue's list has a false positive.
- ⚠️ **Missed: `lint/fix-runners.ts:133` and `:604` use `vault.adapter.write`** —
  below Obsidian's own `vault.modify` eventing. The worst mechanism found, and
  the one with the least in common with the documented contract.
- ⚠️ **Missed: `wiki-engine.ts:349` (`markPageComplete`)** — the engine writes a
  wiki page's frontmatter **outside its own gate**.
- ⚠️ **Missed: `lint/phases/preparation.ts:68`** writes wiki pages (the
  double-nested-link fix) — same class as the above, listed by the issue only
  for its log.md sibling at `:82`.

`#662` claims eight direct importers of `getExistingWikiPages`:

- ❌ **`contradictions.ts:37` does not exist** — the file is
  `contradiction-gates.ts` and calls neither. Measured count: **7**, not 8.
- ✅ The 5 s TTL is right (`PAGES_CACHE_TTL_MS = 5000`, `constants.ts:55`) and it
  is invalidated at `:447` plus five gate exit points.
- ⚠️ **Missed: `wiki-engine.ts:1104` calls the module function directly**, bypassing
  the engine's own cached wrapper at `:2120`. This is the *same self-bypass
  pattern* as #603's `markPageComplete`, in a second subsystem — which is the
  real finding: the engine does not consistently use its own front doors.

### Recommendation — split, do not funnel

Funnelling every write through today's gate is not the fix, for the reason the
sidecar comment gives. Narrowing the contract alone is also insufficient, because
five sites genuinely need the guard. The shape that satisfies both:

| Layer | Contents | Who needs it |
|---|---|---|
| **`rawWrite`** | concern 3 — retry, path resolution, create-or-update | everything that writes |
| **`pageGuard`** | concerns 1 + 2 | wiki pages only |
| **`notify`** | concern 4 | anything the watcher must see; the sidecar **opts out explicitly** |

Each call site then declares its set, and `types.ts:989`'s contract is narrowed to
what the layers actually guarantee. Tiering the sites:

- **A — real violations** (wiki pages, missing both guard and notify):
  `link-retarget.ts:185`, `markPageComplete:349`, `fix-runners.ts:133`,
  `fix-runners.ts:604`, `preparation.ts:68`. **Five sites, four files.**
- **B — declare `guard: false` explicitly** (source notes, sidecars):
  `sources-normalizer.ts:247`, `preparation.ts:105`, sidecar `:870/:872`.
  Their current silence is indistinguishable from an oversight; the declaration
  is the whole change.
- **C — out of contract, document and leave** (schema, logs, caches):
  `schema-manager.ts` ×5, `apply-suggestion.ts` ×2, `auto-maintain.ts:713`,
  `disk-cache.ts:155`, `ensure-welcome-note.ts:161`.

**For #662 the issue's proposal is right and its mechanism is the point:** the TTL
cache is invalidated *by the writes the ingest itself performs*, so it cannot hold
during an ingest no matter how many callers use the wrapper. Routing the 7 direct
callers through the engine accessor is hygiene; the fix is a **run-scoped index
updated by the writer**, as proposed — the writer knows what it wrote, so it
should tell the index rather than invalidate it.

### Re-measurement (2026-09-17) — three corrections, and the first slice changes

The design pass above reasoned from the two issues' line numbers. Re-measuring them
against the source on 2026-09-17, before writing any code, found **three errors** —
and one of them removes the reason the pass gave for doing tier B first.

| Design record said | Actually | Evidence |
|---|---|---|
| `link-retarget.ts:185` is a tier-A violation | ❌ **Not a violation.** `:33` records it as deliberate: the write goes through `vault.process` because the gate normalizes `sources:` and corrects link pollution, which is "appropriate for a generated wiki page, not for someone's own note" | declared, and for a good reason |
| `sources-normalizer.ts:247` is a tier-B **source-note** write | ❌ **It writes wiki pages** — the file set is `isInFolderScope(f.path, wikiFolder, …)` | `folder-scope.ts:33` |
| `preparation.ts:105` is a tier-B **source-note** write | ❌ **It writes wiki pages** — it iterates `pageMap`, built from `wikiFiles` | `preparation.ts:34-52` |

**Consequence:** tier B is not "three silent sites" — it is **the sidecar alone, and
the sidecar is the most-documented write in the codebase**. The pass's stated reason
for doing B first ("behaviour-preserving, and the declaration is the whole change")
no longer supports a slice of that shape at all.

### `log.md` proves the gate already spans two file classes

The pass looked at the gate's *callers* only through the issues' lens. Reading them
directly turns up the strongest argument for splitting:

| Caller | What it writes |
|---|---|
| `:283` `indexGenerator.writeFile` | the index — a wiki page, wants **all three** layers |
| `:292` `logWriter.writeFile` | **`log.md` — not a wiki page** |

So the "single write gate" already serves two file classes, and `pageGuard`
(pollution correction + heading/provenance normalization) is **harmful for a
log** — not merely meaningless, which is what this pass first assumed. Slice 2
measured it: `LogWriter.pageLinks` builds links from real page paths, so a page
named `concepts布局优化` is written as `[[concepts/concepts布局优化]]` (correct), and
Pattern B rewrites it to `[[concepts/布局优化]]` — a dead link. That answers the
pass's first open question by itself: `pageGuard` must be a **separately declared
layer**, not a superset of `createOrUpdateFile`.

### Corrected tiers

- **A — real violations** (wiki pages, missing both guard and notify):
  `markPageComplete:349` (the engine writes a page's frontmatter outside its own
  gate; no deliberate note) · `fix-runners.ts:133` and `:604` (`vault.adapter.write`,
  below Obsidian's event layer) · `preparation.ts:68` (the double-nested-link fix) ·
  **`sources-normalizer.ts:247` and `preparation.ts:105`** (the sources-field repair,
  writing wiki pages). **Six sites, five files.**
- **B — already declared deliberate, in prose:** the PDF sidecar `:870/:872` (its
  comment at `:848-852` is the evidence the pass itself cites) and
  `link-retarget.ts:185` (comment at `:33`). Both want `guard: false`; the sidecar
  also wants `notify: false`. Making the declaration *typed* rather than prose is
  the whole change — no behaviour moves.
- **C — out of contract, document and leave** (schema, caches, welcome note):
  `schema-manager.ts` ×5, `apply-suggestion.ts` ×2, `auto-maintain.ts:713`,
  `ensure-welcome-note.ts:161`. (`disk-cache.ts:155` is not a vault write.)

### Revised slice plan

Because tier B collapsed, the first slice changes shape: **introduce the three layers
and the `WriteIntent` type with zero call-site changes**, `createOrUpdateFile`
becoming the "all three" compatibility entry point. Zero behaviour change is
provable — the default path must equal today's four concerns one for one — and it is
what actually establishes the interfaces the later slices consume. Slice 2 converts
the two prose-declared bypasses into typed intent (the sidecar to `rawWrite` alone;
`log.md` to `rawWrite + notify`, which **is** a behaviour change and needs its own
check). Slice 3 takes the six violations one at a time, `fix-runners.ts` last: routing
`adapter.write` through the gate fires `onFileWrite` + `invalidatePageCaches`, which
can cascade into auto-ingest.

### Open questions

- ~~Whether `pageGuard` stays inside `createOrUpdateFile` as a superset or becomes a
  separate declared layer.~~ **Answered 2026-09-17:** separate. `log.md` already goes
  through the gate and is not a wiki page — a superset would normalize a log.
- ~~Whether tier B's declaration is a type-level requirement or a call-site option.~~
  **Answered 2026-09-17:** type-level, as the pass suspected. The new layer entries
  take `intent` as a **required** parameter; `createOrUpdateFile(path, content)` stays
  as the "all three" shorthand so the six existing callers change nothing.
- ~~Whether `fix-runners.ts`'s `adapter.write` sites are deliberate or an old idiom.~~
  **Answered 2026-09-17:** no comment says either way, so it is an idiom rather than
  a decision — but the fix carries cascade risk (see the revised slice plan) and is
  therefore last, not first.
- **Still open:** whether the sources-field repair sites
  (`sources-normalizer.ts:247`, `preparation.ts:105`) should *use* the gate or declare
  `guard: false` because they **are** the guard's repair path. Routing them through it
  is not circular in effect — after they fix a file the gate finds nothing to do — but
  it does mean the repair runs the thing it repairs. Decide before slice 3.

### Slice 1 shipped (2026-09-18) — and the race it surfaced

`4f00823f` (PR #748) split the gate into `writeFileWithIntent` / `rawWrite` +
`wiki/page-write-guard.ts`, with `WriteIntent { guard, notify }` and **no default**
(a default is how the ambiguity the type exists to remove would return).
`createOrUpdateFile(path, content)` stays as the all-three shorthand, so the six
existing callers changed nothing.

**Acceptance was zero behaviour change, and exactly one assertion flipped — which is
the finding, not a nuisance.** `wiki-engine-ingest.test.ts` asserted a created file's
content equalled the raw input, which also excluded the `generation_complete` stamp.
That test was passing on a **race**: `markPageComplete` is deliberately
fire-and-forget (`void (async () => …)()`), so whether it landed before the caller
resumed depended on how many async frames the write path took, and the split added
one. It is now deterministic (5/5 runs). The assertion was replaced with a
**stronger pair** — content present *and* stamp present — not relaxed.

**That fire-and-forget stamp is a #603-shaped hole in its own right:** "this page is
complete" is not something a reader may rely on immediately after the write returns.
Slice 3 owns it.

**Two mutations were run, because pure unit tests cannot see wiring.** Disabling the
guard call failed exactly 4 wiring tests (`write-gate-layers.test.ts`) while all 10
pure-unit tests (`page-write-guard.test.ts`) stayed green — the precise split that
made the #736 gap invisible. Removing `onFileWrite` failed exactly 2. This is the
#736 lesson applied on purpose rather than rediscovered.

**The `recovered` asymmetry is preserved and encoded**, not silently unified: the two
recovery paths (NFC/NFD "already exists", exhausted-retries scan) never stamped the
page while the two ordinary paths did. `rawWrite` returns `'updated' | 'created' |
'recovered'` so `writeFileWithIntent` can reproduce that exactly. Whether the recovery
paths *should* stamp is a slice-3 decision.

**A trap worth remembering when extracting regexes:** both pollution patterns carry
the `g` flag, and `RegExp.prototype.test` advances `lastIndex` on a global regex. The
inline form was safe only because it rebuilt the literals per call. Hoisting them to
module scope — the obvious move when extracting to a module — would make every
**second** write skip its correction. The guard keeps them inside the function, and a
test calls it four times on the same input requiring all four to correct.

### Slice 2 shipped (2026-09-18) — and the log turned out to be corrupted

**The pass's description of `log.md` was wrong in a way that mattered.** It said the
guard was *meaningless* for a log. Measuring before changing found it is
**harmful**: `LogWriter.pageLinks` builds links from **real page paths** (stripping
`wiki/` because `[[wiki/concepts/X.md]]` renders dead), so a page genuinely named
`concepts布局优化` is written as `[[concepts/concepts布局优化]]` — correct as written.
Pattern B cannot tell that from LLM-emitted duplication and rewrote it to
`[[concepts/布局优化]]`, a dead link. **The fix is a bug fix, not a tidy-up** — which
is why the test asserts both directions rather than a single `toContain`.

Shipped: `LOG_WRITE_INTENT { guard: false, notify: true, create: true, cancel: 'ingest' }`
at the LogWriter injection (`log.md` keeps `notify` — only the guard is dropped) and
`RAW_WRITE_INTENT { guard: false, notify: false, create: true, cancel: 'ingest' }`
at the PDF sidecar, whose prose bypass at `wiki-engine.ts:845-851` is now a
declaration. Routing the sidecar through `rawWrite` also gave it the retry and the
NFC/NFD recovery the two direct vault calls lacked.

**`guard: false` drops three corrections, not one** (corrected 2026-09-20 in review).
The paragraph above justifies only the path-prefix repair; the layer also carries
display-name correction and sources normalization, and both are dropped here too.
Neither was ever wanted on the log — it has no display name, and its `sources` line
is a projected link list rather than the note's — so the narrower edit is the correct
outcome rather than a side effect. Recorded because "the guard is harmful for one
reason" and "the guard does three things, all unwanted here" are different claims,
and only the second is checkable.

**A property that had never been tested:** the sidecar's **not-notify** behaviour is
the entire reason the bypass exists (the comment warns of auto-ingest cascades), yet
the existing tests asserted only file contents. Giving the sidecar `notify: true`
would have broken nothing. It now fails one test.

**`link-retarget.ts:185` is deliberately out of scope and must stay that way**: it
receives an injected `process` and never touches the engine's layers, so its
"declaration" is a type-level statement, not a call-site change.

### Slice 3 reviewed (2026-09-20) — three findings, two of them mine to own

@DocTpoint reviewed the slice and returned CHANGES_REQUESTED with **two shipped-
behaviour findings and one test finding**. The slice's own three mutations passed
before he looked, which is the useful part of the record: **mutations cover the
wiring, and neither of these was a wiring question.**

**1. `markPageComplete` gained `vault.create` and could resurrect a deleted page.**
My reasoning had been that the old form's `process` callback discarded its `data`, so
there was no atomicity to lose. That part is true and irrelevant: `rawWrite` adds
**three** things, and the third is `create`. The old form resolved a `TFile` first and
did nothing when it was gone; the new one writes it back.
`markPageComplete` is deliberately un-awaited, so it races the cancel cleanup that
deletes the page it is stamping — and a stamp that can create writes the page back
with `generation_complete: true`, which is precisely the state #582/#583 exist to
prevent. Which side wins is undetermined, so it reproduces intermittently.
**Fixed by making it a declared layer**: `WriteIntent` gained `create`, every existing
intent is `create: true`, and `STAMP_WRITE_INTENT` is `create: false`. `rawWrite`
returns a new `'absent'` outcome rather than an error — nothing happened, on purpose.
His probe is now a test, as given, with the interleaving pinned rather than timed.

**2. The lint fixers' writes were governed by the ingest's cancel button.**
`writeFileWithIntent` opened with `checkCancelled()`, which read `abortController` —
the **ingest** controller. The engine holds two (`lintAbortController` beside it), and
they overlap because `lint-wiki` is registered with no `isIngesting()` guard. So
cancelling an ingest aborted an overlapping lint's writes, and cancelling the lint did
not touch its own. `runRetagViolations` re-throws AbortError deliberately, so the run
tore down with earlier batches already written and the user was never told.
**Fixed the same way**: the cancel owner is now a declared field —
`cancel: 'ingest' | 'lint' | 'none'` — and `LINT_WRITE_INTENT` names `lint`. The check
had been implicit since it was written, which is exactly the ambiguity the type exists
to remove.

**3. The contract test's waiver list could not match on Windows.** The waiver is
`'core/disk-cache.ts'` but `relative()` yields `core\disk-cache.ts` on win32, so the
lookup missed, `core/disk-cache.ts` stopped being excluded, and both assertions failed
there — on the one platform CI never runs. **A guard whose value is that it runs
everywhere must normalise the paths it compares.** Now `relPosix()`.

**Two non-blocking notes, both acted on.** The comment stripper cut each line at its
first `//` without tracking string literals, so a bypass written after an inline URL
was invisible — a scanner whose failure mode is "silently reports a clean tree". It is
a one-pass quote-aware walk now. And `write-gate-layers.test.ts` claimed to protect
"pollution correction outside the content folders" while writing through
`createOrUpdateFile` — which production **no longer uses for the log**, the `LogWriter`
being its sole writer with `guard: false`. So the behaviour it claimed to protect was
gone and the test still passed. Re-pinned on a path that still takes the full gate,
with the log named as the counter-example.

**The generalisable part:** a test can be written to protect a *property*, pass for a
long time, and then be protecting a *spelling* — the same failure as #751's build test,
found in the same week, in a test written by two different people. The check that
catches it is asking what the assertion would still pass on.

**Lesson worth keeping: "this does nothing useful" and "this is harmful" are
different claims, and only the second justifies urgency.** The design pass made the
first; one measurement upgraded it to the second.

---

## Design record — the streaming fallback classifies by URL, not by outcome (#741, v1.28.0)

**Analysis 2026-09-18, from source + history. No implementation.** @aisahpA measured
the preflight behaviour on the shipped `c709a162` and raised three points; two of
them are corrections to what #736 shipped, and one of those contradicts a comment
#736 itself wrote.

### The mechanism as built

```
streamWithFallback(url, init)
  ├─ isLocalBaseURL(url)?  → requestUrl   (no CORS, no streaming: whole body at once)
  └─ else try window.fetch → real streaming
            catch TypeError → requestUrl  (silent, buffered)
```

### First principle: the classifier is a proxy for the wrong variable

The capability actually required is **"this method + URL + *header set* is permitted
cross-origin by this server"** — a server-side property computed per request. The
code decides on `isLocalBaseURL(url)` — a client-side property of the host.

That proxy was approximately true when it was written (`6be9258d`, the AI-SDK v6
migration): the observed population was **bimodal** — cloud hosts returned `ACAO`
(`*` or `app://obsidian.md`), local servers returned nothing — and a bimodal
population hides proxy errors. Introduce a third kind (a cloud host that is *not*
permissive about `app://obsidian.md`) and the proxy is simply wrong.

**Extending the host list cannot fix it, and not because of maintenance burden — it
is a type error.** A preflight is triggered by non-safelisted headers and succeeds
only if the server echoes *every* name from `Access-Control-Request-Headers`. So the
outcome is a function of `(host, method, header set)`. #736 turned the header set
into **user data** via the free-form custom-headers field. A table keyed on host
cannot represent a function of two variables — it structurally cannot cover the case
#736 introduced, on any host.

The only faithful representation is **the observed outcome**: try once, remember per
host for the session, skip the gamble afterwards. That also self-heals if a host
starts answering `OPTIONS`, with no list to maintain.

### The finding that explains why this took so long: in production the fallback is unobservable

Three independent layers each hide it:

| Layer | What it hides | Evidence |
|---|---|---|
| `streamWithFallback` catches `TypeError` deliberately | the error itself | `:265` — "Successful fallback path is silent (no console.warn) — it would spam logs on every request" |
| every diagnostic is `console.debug` | the trace | `:275/:281/:283/:289` |
| the production build **neutralises** `console.debug` | even that | `esbuild.config.mjs:15` — `const prodBanner = prod ? 'console.debug = function() {};\n' : ''`, injected as main.js's first statement |
| `requestUrl` is a main-process IPC call | the request | aisahpA: bridge requests do not appear in DevTools Network at all — **an empty Network panel is not evidence nothing was sent** |

So in the shipped plugin a CORS-blocked provider degrades from streaming to buffered
leaving **no log, no error, and no Network entry** — the only observable is the ~20 s
empty pane. The silent-fallback decision was correct for the population it was written
for (local servers, where the fallback is *expected and total*, so a warning would be
noise on every single call) and was inherited unchanged by a population where the
fallback is a **capability downgrade**. One code path, two meanings.

This is the same class as MEMORY's "an `optionalDependency` a required feature needs
is a silent capability hole": the degradation is designed, the *silence* is the bug.

### The two branches differ in header semantics, not only in streaming

| | `window.fetch` | `requestUrl` |
|---|---|---|
| stack | renderer, browser-arbitrated | main process over IPC |
| CORS | enforced | **not applicable — not a browser fetch** |
| forbidden headers | dropped | unaffected |
| `User-Agent` | **overridden by Chromium** | sent as supplied |
| visible in DevTools Network | yes | **no** |

**The `User-Agent` premise in #736 is inverted, and so is its stated reason.** #736's
comment says the header "is a fetch-forbidden header". It is not — the Fetch standard
removed `User-Agent` from the forbidden list (`whatwg/fetch` `dab09b0`, "Allow
User-Agent to be set, but not omitted"); **Chromium implemented that and then reverted
it** (`chromium/chromium` `079b3a3` reverts `c7d5f1c6`, bug 40450316), with
the chromestatus entry to allow it still at intent-to-prototype. So the correct
statement is: *spec-permitted, Chromium-policy-suppressed* — which means the plugin's
`karpathywiki/<version>` identity **reaches the wire only on the `requestUrl` branch**,
i.e. exactly on the hosts that are *not* the default. #736's purpose included plugin
identity; on the preferred branch it never arrives. aisahpA measured both to
Obsidian's UA; the revert explains why.

### The structural limit, stated plainly

`requestUrl` returns a **complete body**; only `window.fetch` exposes
`response.body: ReadableStream`. CORS is enforced by the renderer. Therefore **on a
host that blocks CORS, real streaming is architecturally unavailable** — it is not a
bug to be routed around. The honest goal is narrower: route around CORS to recover
*identity* and *legible errors*, and **tell the user** streaming is off. Adopting
`requestUrl` for `opencode` is not a streaming fix; it is a legibility fix.

### Historical precedent — the project has made this call twice already

- `13e57772` (2026-05-15) `fix: CORS for OpenAI-compatible endpoints + Query UX overhaul`
- `c3bb5c11` (2026-06-05) `fix(llm): rewrite AnthropicClient on requestUrl to fix CORS (Closes #95)`

Both concluded the same way: **`requestUrl` is the escape hatch**. The per-call gamble
(`streamWithFallback`) arrived later, with the AI-SDK v6 migration, to recover
streaming where it is available. The current design is therefore the *union* of two
strategies chosen by a proxy — and **the chooser is the weak link, not either branch**.

### Recommended shape

1. **Decide from the outcome, not the URL** — remember the first CORS `TypeError` per
   host for the session; later calls skip the gamble. Covers user-added headers, no
   host list, self-healing.
2. **Stop degrading silently** — one `console.warn` plus (given the 20 s empty pane) a
   first-time Notice per host per session. A no-op `console.debug` is not a signal.
3. **Correct the `User-Agent` claim in code and docs** — either add a non-forbidden
   identity header (`x-karpathywiki-version`) or state the caveat. The comments #736
   wrote assert a false reason and must be fixed regardless of the transport decision.
4. **Keep a preset flag only as a *hint*** for hosts known to answer no `OPTIONS`
   (`opencode`), never as the mechanism.
5. **Acceptance criteria** (aisahpA's, adopted): first streamed character within ~1 s;
   no `[STREAM-FETCH] TypeError` from the second streamed call onward; adding a custom
   header on `kimi`/`gemini` no longer downgrades to a buffered answer.

### What this changes about #736's regression status

`opencode` failing is **not** a #736 regression — that host never worked. The
**regression is the free-form header field**: each host's CORS policy is configured
against a fixed header set, and #736 made that set user-extensible, so **any user can
now silently downgrade their own streaming on any provider**. Combined with the
unobservability above, the user gets no way to connect cause to effect.

### Resolution (2026-09-18) — shipped in two steps

**Step 1** (`5f6754f7`) records a cross-origin failure per origin and warns once per
origin per session, on `console.warn` — the only channel a shipped build can emit.
`AbortError` and plain `Error` are deliberately not recorded; only a `TypeError` is a
verdict about the host.

**Step 2** (`e150d139`) gives desktop a streaming transport for these origins:
`node:https` behind the `Platform.isDesktop` early-exit guard, wrapped as a web
`ReadableStream` and handed to AI-SDK as a `Response`.

**A fifth transport was rejected on the way, and the reason must not be forgotten:**
**Electron's `net` module** is the ideal answer on paper — Chromium's network stack,
therefore proxy-aware *and* streaming — but its documented process list is **"Main,
Utility"** and a plugin runs in the renderer. That is why `node:https` (which cannot
see Obsidian's proxy configuration; Electron's docs contrast `net` with the Node
modules as offering "better support for web proxies") is the only option left.

Because of that gap a failed Node attempt is treated as a verdict about the
**transport**, not the request: recorded per origin, then `requestUrl` takes over. A
proxy user therefore lands on exactly the behaviour they had before step 2, paying for
the discovery once per origin instead of once per call. **This is the pattern to
reuse** — when a fallback transport has a known environmental failure mode, remember
the failure rather than predicting it.

**Bot compliance was verified by control, not by reading.** `node:https` is a Node
built-in so `obsidianmd/no-nodejs-modules` applies. A probe file with three shapes
produced exactly two reports — the unguarded import and
`if (!Platform.isDesktop) { import(…) }` — and **none** for the early-exit form
`if (!Platform.isDesktop) throw` at function start. The rule is sourced from Node's
own `module.isBuiltin()`, so **`electron` is not covered by it at all**.

**Known limitation, and the reason the issue is closed rather than left open:** mobile
is unchanged. It has no Node runtime and `net` is main-process only, so streaming on a
CORS-blocked host is not reachable there — not pending work.

---

## Design record — #701's premise does not hold (2026-09-18)

**Decision, not implementation.** #701 writes a `wiki-ingested:` marker into the
user's own source notes. It is deferred pending a product decision, and this records
why the deferral is about the premise rather than the code.

### Where the fact can live

"This note has been ingested" is a **derived** fact — an assertion about a
transformation the plugin performed, not a property of the note. So it can live in
three places, and the middle one is not a proposal:

| Home | Owned by | Survives a plugin reset | Survives deleting the wiki |
|---|---|---|---|
| Plugin state (`data.json`) | plugin | ❌ | ❌ |
| **The wiki's own artifact** — `wiki/sources/*.md` carrying `contentHash` + `source_file` | plugin | ✅ | n/a |
| The user's source note (frontmatter marker) | **the user** | ✅ | ✅ |

`buildIngestedHashes()` (`wiki-engine.ts:477`) is documented as *"Content hashes
already present in the wiki, read from source-page frontmatter"*, and
`wiki-engine.ts:1775` writes `contentHash` onto every sources page. `scanners.ts:485`
already uses the same field for source-drift detection.

### Both cited failure modes are already handled

- **"a folder re-run after the batch cache restarts"** — the batch cache is
  `ingestedHashesCache`, a TTL memoisation. When it expires, `buildIngestedHashes()`
  **recomputes the set from the wiki pages**. The cache is not the record; the wiki is.
  Nothing is lost, so nothing re-ingests.
- **"a user re-adding the same note body under a different name"** — already deduped.
  `hashBody` (`source-requirements.ts:77`) is FNV-1a over the trimmed,
  whitespace-normalised **body only** — no path, no filename, no frontmatter. The same
  body under any name hashes identically and is caught by `ingested.has(hash)`.

No case was found that the marker fixes and the hash does not.

### The two problems the marker introduces

**It writes a derived fact into the user's input.** The wiki is the plugin's output
space; the note is the user's. `README.md:114` promises *"The plugin modifies nothing
in your original notes"* in all eleven locales.

**Its failure mode is the user's main recovery action.** Deleting a `wiki/sources/`
page — or the whole `wiki/` folder — is how someone forces a rebuild. The hash
mechanism cooperates: remove the artifact, the fact is gone, the note re-ingests. The
marker opposes it: the note still says "done" while the page is gone, so a rebuild
silently skips exactly the notes the user was trying to rebuild. A second source of
truth does not stay in agreement, and here disagreeing is not neutral.

**What would reopen this:** a specific, demonstrated case the hash mechanism misses —
an observation, not a reasoning chain. Any redesign should keep the fact on the wiki
side.

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

## Lessons learned (2026-09-20 session — skill audit, build-config layer, three dependency holds)

**Trigger:** compact-prep after a long working session. Merged #757, #759, #761, #762,
#765, #767, #769, #773, **#750**; closed #603, #662, #665, #672, #699, #751, and #753 as
superseded; filed #763 and #764. `main` `3499da2a` → **`4f56b475`**; 4240 → **4285
tests**. The through-line was **reviewing other people's work and being reviewed**, and
most of what follows came from @DocTpoint's reviews rather than from my own passes.

### Durable lessons

1. **A dependency experiment leaves `node_modules` ahead of the lockfile, and `git
   checkout` does not clean it — because it is not tracked.** Hit twice, and the second
   time I reported it as a fact about `main`: 31 `TS2550: Property 'at' does not exist`
   errors presented as a property of the `@types/node` bump, when the installed tree
   still held the bumped package from reading that branch. `main` was clean. **Any local
   Gate 1 result after a dependency experiment is untrustworthy until `pnpm install
   --frozen-lockfile`.** The symptom is indistinguishable from a real regression, and it
   was written into #765's audit note and #768's closing comment so the next person
   recognises it faster.

2. **The triage skill's dedup step read `--state merged` only, so an OPEN PR already
   fixing an issue was invisible.** I picked #597 as the highest-ROI unstarted item, read
   the code, confirmed the defect against two independent doc comments, implemented it,
   tested it, mutation-tested it twice — and then found **#656 had been fixing the same
   issue for four review rounds and was one small change from approval**. Its branch was
   six days stale, so every "recent activity" search missed it too. The wasted work is
   the cheap part; the real cost is that a re-implementation is how a contributor's four
   rounds get devalued. **Fixed in the skill**: Phase 1.5 now asks two separate questions
   (fixed on `main`? vs **in flight in an open PR?**) and Phase 1d pulls every thread
   roster-wide rather than per item, because a body does not say who already acted on it.

3. **A test can be written to protect a property and end up protecting a spelling.**
   Three instances in one week, from two different authors and three different files: the
   bundle test asserting `toContain('import("node:module")')` while its own comment said
   the requirement was laziness; `toContain('updated:')` in the schema-audit test, which
   passes for the old value and so cannot tell an apply from a no-op; and #750's fourth
   assertion, caught by review. **The check that catches it is one question: what would
   this assertion still pass on?**

4. **When you remove a wrong check, ask what it was incidentally holding shut.** The
   best finding of the session, and it was not mine: `LINT_WRITE_INTENT` stopped reading
   the ingest controller, which was right — and the old wiring had *also* been preventing
   a lint write from resurrecting the page the cancelled-ingest cleanup had just deleted.
   Removing a wrong reason left a right effect unprotected, and nothing replaced it. The
   fix is now `create: false` plus a test that fails without it.

5. **Mutations cover the wiring; a correctness finding can live elsewhere — and a guard
   assertion must itself be mutation-tested.** #750's slice passed all three of its own
   mutations and still shipped two behaviour regressions. Then, on #467, **my guard
   passed two of three mutations on the first version**: the assignment assertion was
   satisfied by `syncModelsFromPlugin` assigning the same field, and the cascade
   assertion by `toContain` matching the method's own *definition* — a lazy
   `[\s\S]{0,400}?` span reaching past the closing brace to find it. Both now sit inside
   one block, bound by `[^}]*`.

6. **Two version numbers that read opposite to their cost.** `@types/node` 16 → 26 does
   not add anything this project uses (`node:module` and `node:https` date from Node 15)
   and **removes** the `compatibility/indexable.d.ts` shim that makes
   `Array.prototype.at` typecheck under `lib: ES2021` — the upgrade takes away a
   convenience. And `obsidian` 1.13.1 deprecates `display()` while its own doc comment
   calls it *"a fallback for plugins that need to support Obsidian versions older than
   1.13.0"* — so neither bump forces `minAppVersion`, and both were held with the
   measurement written into `.github/dependabot.yml` rather than left as open PRs #766
   and #768. **A version number is a claim about change, not about benefit.**

7. **A rejection message can name the wrong cause, and the fix is the stronger flag.**
   `git push` to a contributor's branch came back `non-fast-forward` — which is just what
   a rebase looks like — before `--force-with-lease` returned the real `permission denied`
   (`maintainer_can_modify: false`). Two attempts were spent on the wrong diagnosis.
   Similarly: **verify the merge returned `merged=true` before restoring a bypass actor**,
   not that the command exited — restoring first left #773 open while the script printed
   success, and only the next status read showed it. **And never suppress the restore's
   output.** A `>/dev/null 2>&1` on the ruleset `PUT` hid two network failures this
   session, so the run reported "restored" while `bypass_actors` stayed at 1 — a
   security-relevant residue that survived several commands before a direct read found
   it. The restore is the one write in this flow whose failure is silent by construction,
   so it is the one that must be read back.

8. **The bundle is the authority on what is bundled — read the artifact, do not
   re-derive the set.** #699 measured ten third-party packages in the shipped `main.js`;
   the artifact contains **twelve**. The two it missed (`@vercel/oidc`,
   `eventsource-parser`) are transitive two levels below anything `package.json` names,
   and they are exactly the ones a hand-maintained list keeps missing. The generator now
   reads esbuild's own `// node_modules/.pnpm/<pkg>@<ver>/` markers, so the set cannot go
   stale, and a test fails when the committed document and the artifact disagree.

---

## Lessons learned (2026-09-16 session — cross-source direction + Dependabot lockfile root fix)

### Durable lessons

- **`optionalDependencies` fail silently, and that is how a whole capability
  disappears.** pi 0.85.1 declares `@earendil-works/pi-server` / `pi-client` as
  optional; the global install skipped them and nothing complained, so background
  subagents were unavailable — and the error text blamed a "standalone pi
  binary" that did not exist. Diagnose by reading the consumer's resolution code
  (`runner-aliases.ts::findPeerPackageDir` walks `<pkg>/node_modules` then every
  ancestor), not the message. Fixed by extracting the 0.85.1 tarballs into pi's
  own `node_modules` — **zero-intrusion (both manifest SHA-256s unchanged),
  fully reversible with `rm -rf`**. Generalise: an optional dependency that a
  required feature needs is a silent capability hole, not graceful degradation.
- **Read the consumer before trusting an external search.** A research subagent
  searched Obsidian's docs, correctly found no lockfile requirement, and
  recommended deleting `package-lock.json`. The real constraint was in this
  repo's own `.npmrc` post-mortem: Obsidian's pipeline runs `npm install` and
  compares build hashes, so the file is load-bearing for release
  reproducibility. **Absence of evidence in vendor documentation is not absence
  of a constraint** — internal post-mortems outrank external docs for constraints
  we discovered the hard way.
- **The constraint may be in the prompt, not the architecture.** The Related
  graph's intra-source shape looked like an inevitable property of "one note →
  one star". It is literally an instruction at `prompts/ingestion.ts:27`.
- **A log grep can identify the wrong CI step.** "Which step failed" was misread
  from log text twice — `pnpm install --frozen-lockfile` looked like the failure
  when it was the *preceding* step's `##[group]Run` echo. `gh run view <id>
  --json jobs --jq '.jobs[].steps[]'` gives per-step conclusions and is the only
  trustworthy source.
- **A machine-generated artifact read back as input is a view-as-data bug.**
  `build-graph.ts` parses `[[links]]` from page bodies without knowing that the
  Related sections were written by `related-page.ts`. The graph is therefore
  largely a render of the ingest's own co-occurrence decisions, which is why PPR
  cannot discover anything the ingest had not already decided.
- **Test the mechanism before merging it.** #718's workflow was validated on the
  real Dependabot branch in a throwaway worktree — failure reproduced,
  regeneration verified, single-file diff confirmed, and **idempotency proven by
  SHA-256** so the workflow provably cannot loop — *then* merged, *then*
  confirmed in production on #707 and #708.

### State pointers (2026-09-16)

- Issue **#729** — cross-source relations, the first item of the v1.28.0 design
  track.
- **#718** CLOSED by PR **#727** (`e9be7f75`); **#707** `3f0fc9a2` and **#708**
  `7cc50bf9` merged; `main` = `7cc50bf9`.
- **Local pi install repaired:** `@earendil-works/pi-{server,client}@0.85.1`
  placed in `pi-coding-agent/node_modules` — re-apply after any pi reinstall.

### Resume point (post-compact handoff, 2026-09-20)

**Read in this order if context was lost:** this file's `## Current state` (where
things stand) → **`## Work list (2026-09-20)`** (what to do next, ROI-ordered) →
ROADMAP §"v1.28.0 MINOR — Design track" (the window's scope) → then the design record
for whichever item is next. **The next substantive work is #729 Phase 1** — both of its
gates (#603, #662) closed on 2026-09-20.

**State at handoff:** `main` = **`4f56b475`**, Gate 1 green at **308 files / 4285
tests**. Merged this window: #757, #759, #761, #762, #765, #767, #769, #773, **#750**.
Closed: #603, #662, #665, #672, #699, #751, #753 (superseded), plus the Dependabot PRs
#726/#728/#766/#768. **The working tree is clean and the stash is empty.**

**One branch is parked and must not be lost:** `pr-687` @ **`e3273353`** — the rebase
of @Chase07's PR, 7 commits, Gate 1 green at 309 files / 4298 tests, **unpushable
until he ticks "Allow edits by maintainers"**. If context is lost and that branch is
gone, re-deriving it is cheap (one conflict, an import block in `source-analyzer.ts`:
keep main's `foldToVocabulary` import, add his `EmbeddedImageEvidenceSchema` to the
`output-schemas` line). One other local branch, `refactor/467-unified-model-setter` @
`033e1842`, is PR **#775** and is already pushed.

**The ruleset needs ~15 s to propagate, not 6 s — and one more thing about bypasses:**
verify the merge returned `merged=true` **before** restoring the ruleset. Restoring
first left #773 open while the script reported success, and the failure only surfaced
on the next status read. A cross-account `gh pr review --approve` still satisfies the
ruleset on someone else's PR, so most merges need no bypass at all — that is how #750
merged.

**This environment's reads are intermittently empty, not wrong.** The GraphQL surface
returns EOFs and `/pulls/<N>/files` sometimes returns `[]`; a status read that comes
back blank is a retry, not a fact. `gh api repos/.../pulls/<N>` is more reliable than
`gh pr view`.

**One open decision blocks a later phase, not this one:** #729's toggle placement
(bottom Advanced panel vs a home created by #668) — needed before Phase 4.

**One open decision blocks a later phase, not this one:** #729's toggle
placement (bottom Advanced panel vs a home created by #668) — needed before
Phase 4.

---

## Lessons learned (2026-09-15 session — v1.27.2 release prep, main-is-red regression forensics)

**Trigger:** user "梳理本patch阶段所有工作，按skill执行发布流程". Gate 1 failed 12 seconds into Step 1 on a clean `main` — before any release change had been made.

### Durable lessons

1. **Two PRs touching the same file must be reviewed for interaction, not only individually.** #705 added the token-limit guard to `related-page.ts` as `return true` (the function returned `boolean`); #714 changed that function's return type to `string | null`. Each passed Gate 1 on its own branch. Merged, they left `main` failing `error TS2322` for **five consecutive commits** (`c05d89a0` → `4c3e6ecc`). Per-PR CI cannot see this class at all, and I had read both diffs in review — each verified against its own base, never against the other. **Before merging into a file another queued PR also touches, diff the two against each other, not just against `main`.**
2. **The runtime half of a type error is often worse than the type error.** `updatedPath` became the boolean `true`, so `updated_pages` gained an entry that `repointLinksAfterRun`'s `p.endsWith('.md')` filter drops **silently** — precisely the #713 shape, reintroduced by the fix for #713's sibling. A red type check is the *lucky* outcome; the same mistake in an untyped position ships unnoticed.
3. **A push-triggered CI failure on `main` has no surface.** #698 added `push: branches: [main]` and it worked exactly as designed — five runs reported `failure`. There is no PR page to carry a red mark, so nobody saw them. **Coverage ≠ visibility.** Until a notification path exists, "main is green" must be verified by query, not assumed: `gh run list --branch main --limit 5 --json headSha,conclusion`.
4. **`return page.path` was correct semantically, not merely type-correct.** The guard runs *after* `createOrUpdateFile`, so the frontmatter had landed and the page genuinely was updated — recording it in `updated_pages` is what the link-repoint pass needs. Choosing whichever value satisfies the type checker would have been a coin flip; asking what the call chain does with it decides the question.
5. **Gate 1 finding a blocker at Step 1 is the gate working.** The alternative was cutting tag `1.27.2` from a five-commit-red `main`. The release flow's order (Gate 1 before any version bump) is what made the failure cheap — no tag to retract, no release to unpublish, no published artifact to amend.
6. **`pnpm-lock.yaml` had been stale since #692.** #692 regenerated `package-lock.json` for the vitest 5 bump and did not regenerate `pnpm-lock.yaml`; the drift surfaced only at release time (491 → 495 entries). `pnpm install --frozen-lockfile` is the decisive check that the pair now agrees with `package.json`. Regenerating **both** is the rule; regenerating one is a half-measure that hides until the next release.
7. **`AGENTS.md`'s "Latest shipped" pointer was two releases behind** (still v1.27.0 / 3677 tests) while v1.27.1 had shipped. It is the first line of the file every agent reads, so it needs the same update pass as CHANGELOG/ROADMAP — not a "docs" afterthought.
8. **CONTRIBUTING.md carried a whole stale section, not just stale numbers.** Its `tools/llm-wiki-cli/` tree — described as "the current user-facing install path" — had been deleted in v1.27.0 by #511, and its Mermaid diagram still pointed at the removed directory. **Numerical drift is visible; structural drift is not.** Sweep the tree and the diagram, not only the counts.

### State pointers (2026-09-15)

- **Open PRs:** #653/#656 (Jan-Heldal, CHANGES_REQUESTED), #673 (DocTpoint, CHANGES_REQUESTED), #687 (Chase07, draft), #701 (deferred to `v1.28.0 MINOR`), #706/#707/#708 (dependabot, CI red — #706 is a MAJOR).
- **Open design calls:** #603 (write-gate contract), #567 (limit contract). #604 closed by #684.
- **Milestones:** `v1.27.x PATCH` (15 open), `v1.28.0 MINOR` (new), `v1.27.0 MINOR` closed.
- **Repository links point to `GD4AI/obsidian-llm-wiki`** — the org move made every `green-dalii/obsidian-llm-wiki` URL stale, and the Obsidian review bot caught it ("README links to another repository with the same name"). 376 repo links across 25 files were updated; the substitution used a negative lookahead so `green-dalii/obsidian-llm-wiki-cli` was protected (the sibling CLI repo did **not** move). The #375 locale-switcher guard now asserts the prefix positively — its previous lookahead-plus-`[a-z]+/` form could not match any `github.com` URL, so a stale owner passed it, which is why this drift survived two releases.
- **Ruleset `16884813`:** `bypass_actors: []` restored after the #722 merge — a temporary `bypass_mode: "pull_request"` actor was added and reverted **in the same command chain**, and `updated_at` 2026-09-15T08:28:50+08:00 proves the revert was the last write.
- **Docs synced:** CHANGELOG §1.27.2 · ROADMAP wave F + header · MEMORY current-state + this block · CONTRIBUTING (counts + tree + Mermaid) · AGENTS.md latest-shipped pointer · 11 READMEs (`latest:` + `last-updated:`).

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

## Hermes cross-reference (2026-08-30) — what it settled

A cross-read of `NousResearch/hermes-agent`'s bundled `llm-wiki` skill against
our own design, triggered by #575 and DocTpoint's revive of #220. Two findings
were executed the next day and are now history; the rest are standing judgments.

**Executed that week:** **#575** — the `merge` definition contained "contradicts",
so `strategy: "contradictory"` was unreachable (closed 2026-08-31). **#577** — read
the `contentHash` back and flag drifted sources, report-only (merged 2026-08-31).
Hermes' PR #13700 had reached both conclusions independently, which is what made
them worth acting on rather than worth debating.

**Where Hermes is more permissive and we deliberately are not:**

- Hermes puts `sha256:` in the **frontmatter of raw sources**; we attach the
  fingerprint to the derived `wiki/sources/*.md` only, because the plugin never
  writes user notes. Same function either way: `hashBody(extractBody(content))`
  — body-only, frontmatter excluded so it cannot hash itself.
- Hermes writes paragraph-level provenance markers (`^[raw/…/source.md]`) on
  pages synthesising 3+ sources; we keep the structured `Mentions:` block. Ours
  parses more reliably for an LLM and `Mentions:` already satisfies human
  traceability, so revisit only on user research — not on symmetry.
- Contradictions stay a **structured record**, never LLM-readable prose.

### Standing judgments (survive the session that produced them)

- **Drift detection is intrinsic to wiki-mode, not an add-on.** The premise
  (offline-compiled synthesis beats per-query RAG) breaks the moment sources
  change silently, so `contentHash` + read-back lint is a requirement of the
  pattern, not a feature of it.
- **Auto-revise on drift is empirically harmful.** Wikipedia's record shows a
  fact revision on page X does not propagate to pages citing X, and an automatic
  fix risks unbounded cascade corruption. Report the drift, route it to the
  user; never auto-re-ingest, never auto-revise.
- **#220 Tier 2 ("recency ≠ correctness") stays open by design.** A "newest
  wins" rule would silently collapse editorial disagreement into recency —
  precisely the failure mode #358 warns against. **Do not implement an
  automatic rule here** until there is a benchmark for cross-source resolution.
- **#220 Tier 1 (`supersedes:` frontmatter) is deferred, not dropped.** Its
  contract once #577 is in: fingerprint detects drift → a user-declared
  `supersedes: true` overrides fingerprint ambiguity → deterministic
  replace-self-block path. Not PATCH-scale, and not to be bundled with #577.
- **#220 Tier 3** (review-queue UI) is a product-surface decision — route it to
  a MINOR design discussion, not to a fix.

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
**Repository:** [GD4AI/obsidian-llm-wiki](https://github.com/GD4AI/obsidian-llm-wiki)
