# LLM Wiki Plugin Roadmap

> Feature planning and improvement proposals

**Latest shipped:** v1.27.2 PATCH (2026-09-15, 39 commits / 4144 tests). See [CHANGELOG.md §1.27.2](./CHANGELOG.md#1272---2026-09-15) for the canonical composition record. | **Updated:** 2026-09-21 (**three of the window's four feature items have landed** — #603, #662 and #608 are closed, so #729 Phase 1 is the head of the queue; see the phase schedule below)

**Next MINOR candidate:** **#729 Phase 1** — the M0 co-citation projection. It was hard-blocked on #603 by design and that gate is now open. (#608, which used to be named here, **shipped 2026-09-21 as PR #687** — see "Merged into v1.28.0 so far" below.)

**v1.26.5 PATCH CANCELLED 2026-08-19** — folded into v1.27.0 MINOR to amortize release-cycle overhead (per user direction).

**v1.27.0 MINOR Phase4 (CLI demote) — MERGED 2026-08-22**: PR #511 (`002da74`, closes #507) migrates `tools/llm-wiki-cli/` → `tools/dev-instrument/` (UPSTREAM DEV-ONLY INSTRUMENT, engine contributors only), eliminating 49 of ~52 Obsidian Bot errors. Two review rounds by @DocTpoint (round-2 blocking finding produced the shim-bundle smoke test now in Gate 1); legacy snapshot at `legacy/cli-v1.26.4-snapshot`. One-cycle deprecation notice ships in the v1.27.0 release notes.

**v1.27.0 MINOR — SHIPPED 2026-08-27**: 36 merge commits (181 files, +11197/-3158 LOC, 3677 tests). Bedrock SSO/IAM (#425, PR #540, awaiting account-holder real-AWS E2E of three constants), MinerU multi-format (#404), source-page verbatim quotes (#496), Fix Dead Links leave-it (#485), ingest candidate gate (#514), per-step taskPolicies UI (#525/#490), composite-key LLM probe caches (#551/#552/#553), and a community wave of frontmatter / alias / dedup correctness fixes (#502/#505/#509/#510/#512/#513/#515/#517/#518/#519/#520/#521/#522/#523/#524/#527/#528/#530/#531/#532/#533/#534/#535/#536/#537/#538). Plus release chore: #501 npm-side `overrides` pin closes the `npm audit HIGH=1` carry-over from v1.26.x. Plan-aligned slider rule honored — all six original MINOR items shipped, none slid to v1.28.0.

## Process notes

Process standards live in [AGENTS.md §"🛡️ Six-Gate Quality Closure"](./AGENTS.md#-six-gate-quality-closure). Release flow lives in the [`obsidian-plugin-release` skill](/Users/greener/.pi/skills/obsidian-plugin-release/SKILL.md) (Pi canonical path; legacy alias `/Users/greener/.claude/skills/obsidian-plugin-release/SKILL.md` still works under Claude Code sessions). ROADMAP does not duplicate process standards or shipped-version details — only the **planning decisions** that have not yet shipped. The historical `[CLAUDE.md](./CLAUDE.md)` file is now a pointer stub to `AGENTS.md`; all new content goes in `AGENTS.md`.

---

## v1.28.0 MINOR — Design track

**Opened 2026-09-16.** Two mandates, per user direction: **feature work and hardening run in the same window** — v1.28.0 is not a feature-only release. Design detail for the first item lives in [MEMORY.md §"Design record — cross-source relations"](./MEMORY.md#design-record--cross-source-relations-729-v1280); this section carries only the planning decisions.

> **The live, ROI-ordered task list is [MEMORY.md §"Work list (2026-09-21)"](./MEMORY.md#work-list-2026-09-21--ordered-by-roi).** That file holds the ordering and the reasoning; this one holds the window's scope. When they disagree, MEMORY is the newer document.

### Scope groups

| Group | Items | Why this window |
|---|---|---|
| **Cross-source relations** (feature) | **#729** — Related sections are intra-source by construction; reserved budget + co-citation projection + local ranker, with multi-hop query decomposition as companion | MINOR-sized and changes default behaviour, so not PATCH-shaped. Research and design concluded 2026-09-16 |
| **Write-path hardening** (architecture) | **#603** ✅ closed with **#750** · **#662** ✅ closed with **#757** | Both landed 2026-09-20. The gate is split into `rawWrite` / `pageGuard` / `notify` with a defaultless `WriteIntent`, and the page index is held per file. **This was the gate on #729 Phase 1 and it is open** |
| **Read-path behaviour** (architecture) | **#664** (Related lists grow ~2 entries per source and are never pruned), **#677** (a classification move makes untouched notes read as edited), **#668** (settings tab: three tabs over nine sections that already exist) | Behaviour/UX changes rather than defects |
| **Deferred features** | **#701** (source-note `wiki-ingested:` marker — contradicts the `README.md:114` promise in all eleven locales), **#741** (`opencode.ai` fails the CORS preflight, so streamed answers arrive buffered), PR **#728** (`@ai-sdk/openai-compatible` 2→3 MAJOR, request-body shape) | Each needs a decision, or carries a measured caveat this pass did not settle |
| **Community** | **#608** + PR **#687** ✅ **shipped 2026-09-21** (local Markdown image embeds) · **#752** (the settings tab also jumps back to the top — the sibling of #668, and fixing the scroll before #668's restructure means doing it twice) | #687 landed; #752 is still on the milestone |

### Landed outside this window, and worth noting

**#751** sits on `v1.27.x PATCH` rather than here, deliberately: it is one line in
`esbuild.config.mjs` and it repairs two shipped features (Codex browser login, and the
desktop streaming transport from #746 that never loaded). **#753 is the same defect
fixed at the call sites and is an alternative, not a companion** — the reasoning, and
the check that #751's global flag only affects the two `node:` imports, are in
MEMORY's work list. **Decide one, not both.**

### Merged into v1.28.0 so far (unreleased)

Recorded here, not in CHANGELOG — that entry is written once at release. Detail on
what each change settled lives in MEMORY.

- **#687** — **#608**: opt-in local Markdown image embeds during ingest, from
  @Chase07. 30 production files + 4 test files. Closes **#608**. The maintainer-side
  rebase was the unlock (a fork PR that `maintainer_can_modify` then allowed), and
  the review's two findings were the message-type split and the degradation
  contract — see MEMORY §"#687 reviewed".
- **#774** — **prompts: stop asking the model for what the code writes**, from
  @DocTpoint. The half that matters is the wire schema: a declared property is a
  request, and the strict tier lists every property in `required`, so removing the
  fields from the prompt alone would have left them requested. `Refs #679`.
- **#656** — config.md's audit-trail metadata on every Apply, in UTC, from
  @Jan-Heldal. Landed after three review rounds; the last two were on my own fixes.
- **#778** — the Windows collection failure in the custom-instruction test, from
  @x0Lazarus (first contribution). Test-only, one file, and the CI run had been
  waiting on maintainer approval rather than failing.
- **#776** + **#777** — the docs-only handoff refresh and the ruleset-restore lesson.
- **#736** — custom request headers, the `opencode` preset, a `(Responses)` variant.
  Closes **#723** and **#735**; both verified end to end by @aisahpA on a real vault
  with a real Go key, and three defects he found in the PR's own code were fixed
  before merge.
- **#739** — **#729 Phase 0**: the Related and extraction ceilings centralised into
  `src/constants.ts`, behaviour-identical and proven by zero snapshot churn.
- **#733** — zod 4 migration (**#669**), proven by byte-identical wire snapshots.
- **#737** + **#734** — AGENTS.md process rules.

### Ordering decision (2026-09-16)

**Hardening before the reader — done.** #603's contract now holds and #662's index is held per file, so the store the acceptance criteria read from is telling the truth. **#729 Phase 1 is unblocked as of 2026-09-20, and #608 shipped 2026-09-21** — so nothing precedes Phase 1 in the queue.

The four review rounds #750 took are the part worth carrying forward: the slice shipped **two behaviour regressions of its own** despite passing all three of its mutations, and the second of the two was a check it *removed* that had been incidentally holding another door shut. Both findings came from @DocTpoint reading the tree rather than the description.

**The write-path design pass completed 2026-09-16 and opens the phase-2/3 gate.** Its recommendation: split the gate into `rawWrite` / `pageGuard` / `notify` rather than funnel every write through it — **five real violations in four files** to fix, plus five sites that only need to declare their intent. Both source issues were re-measured and **each contained one claim that does not hold** (`log-writer.ts` does go through the gate; `contradictions.ts` does not exist), and each omitted worse sites than it listed — including `vault.adapter.write`, which sits below Obsidian's own eventing. Corrected counts and the reasoning are in the MEMORY design record, which phase 2 consumes directly.

Within #729 the mechanisms are ordered **floor-first**: the model-independent mechanism that holds the graph's quality *floor* (co-citation projection over links the vault already has) precedes the model-dependent ones that could raise its *ceiling*. Rationale, the three-mechanism table and the budget tiers are in the MEMORY design record; the principle itself is now a canonical decision (MEMORY §"Key design decisions").

### Phase schedule (2026-09-16)

Dependency-ordered, not priority-ordered. Phase 1 and phase 4 are parallelisable; phase 2 is a chain.

| Phase | Items | Blocked by |
|---|---|---|
| **1 — decouple, take the cheap wins** | **#669** ✅ zod 4 · **#723** ✅ custom headers, OpenCode preset, Responses variant (also closed #735) · **#603 + #662 design pass** ✅ — **complete**, see MEMORY §"Design record — write path and page index" | **nothing — done** |
| **2 — #729 itself** | the six sub-phases in MEMORY §"Implementation plan". **Sub-phase 0 (centralise the ceilings) — ✅ done 2026-09-17** (behaviour-identical, proven by zero snapshot churn); **sub-phase 1 is next — it is the head of the queue** | **nothing — #603 closed 2026-09-20** |
| **3 — behaviour layer** | **#664 together with #729's allocation** · **#677** (unblocked with #603) · **#668 after #729's toggle has a home** | phase 2 |
| **4 — independent features** | **#701** (needs its design decision first) · ~~**#608 + PR #687**~~ ✅ **shipped 2026-09-21** · ~~**PR #728**~~ closed (superseded by the **#764** coordinated v7 upgrade, which now has three red Dependabot PRs behind it: #770 TS 6, #771 `@ai-sdk/anthropic` 4.x, #772 `ai` 7) | nothing |

**Two couplings found during the 2026-09-16 planning pass, now binding:**

- **#729 ↔ #664.** #729 *adds* Related entries; #664 says those lists already grow ~2 per source and are never pruned. Designed separately, one raises the ceiling while the other leaves the floor open — and the measurement that would catch it (Related length over a rebuild) is exactly the one each would blame the other for. **They ship together.**
- **#729 ↔ #668.** #729 introduces a settings toggle that defaults on; #668 restructures the settings tab. Land the toggle *after* #668's structure is settled, or it gets re-homed twice. Per the Settings-panel scope rule it is bottom-Advanced-panel either way (content-generation behaviour, not LLM sampling).

**Scheduling gap closed 2026-09-16:** PR **#728** (the MAJOR bump that superseded #706 — which was closed still carrying this milestone) and Issue **#725** + PR **#726** were unassigned. They now sit on `v1.28.0 MINOR` and `v1.27.x PATCH` respectively.

### Open decisions

- Whether #729's co-citation projection runs at **write time** (edges persist, PPR gets cross-source reach for free) or **query time** (no format change, A/B-able without a rebuild).
- **Reserved vs additive** cross-source allocation — see #729 §"Open questions".
- Where #729's toggle lands: content-generation behaviour belongs in the bottom Advanced panel per the Settings-panel scope rule, but this should be fixed before code, not after.

---

## v1.27.0 MINOR — remaining scope after milestone ROI reallocation

**Decision 2026-08-25:** MINOR keeps only high-value/important items; low-priority hygiene deferred to the new **`v1.27.x PATCH`** milestone; design-track umbrellas moved to research. **#425 is implemented first** per user direction.

### Remaining work (execution order)

| Order | Issue | What | Note |
|-------|-------|------|------|
| 1 | **#425** | Bedrock Stage 2 — SSO/profile auth via hand-rolled IAM Identity Center OIDC + SigV4 → bedrock-mantle | **IMPLEMENTED — PR #540 open, NOT merged** (15 commits, Gate 1 green, dual-subagent review applied). Zero AWS SDK, ~+10–15 KB; includes Stage-1 fix for the sync-factory `bedrockRegion` forwarding bug. Awaiting @dmsessions real-AWS E2E of the three isolated constants |
| 2 | **#485** | Fix Dead Links lacks "leave_it" outcome (always creates stub) | Small LLM JSON-schema enum addition |
| 3 | micro-batch | #525 scan follow-ups: codex-client `outputModeOverride` honoring, exhaustion arm, placeholder i18n | **PR #539 (DocTpoint, 2026-08-24) implements all six filed items — in review** |
| 4 | **#506** | NoOutputGeneratedError reasoning recovery + translation thinking-disable | Reliability across all typed-output paths |
| 5 | **#501** | package-lock.json missing the brace-expansion pin (npm ignores pnpm.overrides) | Release chore, audit HIGH→0 |
| 6 | **#491 + #496** | TASK_SECTIONS co-design — five default-schema sections reach ingest/generation/merge; source-page verbatim quotes rewrite | Largest item. **Slider rule:** if it would delay the tag after #425 lands, slides to v1.28.0 rather than holding the release |

Completed from the original P0/P1 batch: #493 (PR #497 wire-contract test) · #472 (PR #499 designator fix) · MinerU #404 (`769e7bb`) · #498 attribution docs · #306 stale-resolved by v1.26.4 #482.

Moved out (2026-08-25): **#469 / #468 / #467** (streaming-interface trio) and the review-thread debts (**alias-floor unification** #537×#532, **bounded type-repair fan-out** #528, **zh/ja candidate-gate measurement** #521) → `v1.27.x PATCH` · **#220 / #358 / #330** → `v1.27.0+ research`.

### Community wave 1 — 2026-08-21/22 (ALL MERGED)

8 PRs reviewed, approved and squash-merged 2026-08-22/23; all linked issues auto-closed.

| PR | Issue | What | Note |
|----|-------|------|------|
| **#513** | #512 | duplicate-merge passthrough (#356 parity) | Merged with #523 as one batch |
| **#523** | #522 | constraints pass block-form passthrough (#356 parity) | Closes the parity chain |
| **#510** | #509 | `mergeFrontmatter` unions incoming type tags | **Decision: keep union** (order-invariance; `incomingTypeTag` guards custom vocab) |
| **#520** | #519 | one ranked candidate window for dedup + dead-link prompts | Full-list fallback recall was nominal (0/18), cost real (~40K tokens × 61% candidates). Gate-4 accepted: ~2KB text/page (~5.6MB peak @2.8K pages) |
| **#521** | #514 | opt-in candidate gate (`skipMentionOnlyCandidates`, default off) | Only `de` profile measured; zh/ja thresholds unmeasured — maintainer follow-up on a Chinese vault |
| **#516** | #515 | OpenRouter Anthropic baseURL fixture fix | Test-only; GLM/z.ai rows still need account-holding verification |
| **#518** | #517 | blank-model guard in Test Connection (+11 locales) | First-time-fork CI needed run approval (`actions/runs/{id}/approve`) |
| **#508** | — | CHANGELOG upgrade note for #504 `/` entries | Rides `[Unreleased]` into v1.27.0 |

Deferred: **#503** (`userIgnoreFilters`) → research track — decision recorded: `vault.getConfig` behind a narrow typed interface; blocked on pinning Obsidian's ignore-matching semantics.

Follow-ups filed from #517 adjacent findings: **#533** (`isUrlError` treats model-404 as URL fault → wasted fallback round trip), **#534** (`getModelFilter` drops every OpenRouter id containing `:` — ~79/419 models incl. all `:free` variants invisible).

### Community wave 2 + 3 — 2026-08-22/23 (ALL MERGED 2026-08-24)

10 PRs reviewed, approved and squash-merged 2026-08-24 (`65ebdbd` closes the set); linked issues #527/#536/#533/#534/#524 auto-closed. Batches: #529 → #531 → #530 → #535 → #537 → #526, then conflict-rebases (#532 slug.ts vs #530; #538/#528 CHANGELOG anchors) pushed back to fork branches per `update-branch` flow.

| PR | Issue | What | Note |
|----|-------|------|------|
| **#525** | #524 | extract defaults to text mode + repetition-loop guard + taskPolicies UI | Merged last after maintainer convergence on the global text baseline (no provider split — failure axis is model×backend, not local/cloud; opt-back = one taskPolicies entry). Max-effort scan: 0 blocking / 7 non-blocking (codex-client outputModeOverride gap is the notable one) |
| **#528** | #527 | type repair at intake (fold → one short call) | Merged after CLEAN max-effort review; follow-ups noted: unbounded repair fan-out (chunk to 2–4), buildSystemPrompt doc nuance |
| **#526** | #417s | dev-instrument exit codes 0/1/2 | Report-driven contract; usage→stderr |
| **#529** | #258 class | `stripUnknownSections` on generation paths | Reviewed pages bypass |
| **#530** | #366 p2 | NFC + Turkish fold on alias comparison keys | File-naming untouched |
| **#531** | #484 | `folderBySlug` keyed on comparison slug | `preserveCase` param removed |
| **#532** | — | `minAliasLength` setting (default 2, range 2..6) | Follow-up: route enforceFrontmatterConstraints floor through resolveMinAliasLength so all alias writers agree |
| **#537** | #536 | drop self-named aliases on create path | Same filterRedundantAliases gate as appendAliases |
| **#535** | #533 | OpenRouter model-404 no longer a URL fault | First-time fork CI run approved via API |
| **#538** | #534 | OpenRouter `:` variants visible (~79 models) | External @pttydou; colon-split consumers verified absent |

Open follow-ups from review threads: alias-floor unification (#537×#532), bounded type-repair concurrency (#528), zh/ja candidate-gate measurement (#521 debt), plus from the #525 scan — codex-client `outputModeOverride` honoring (extract stays JSON-mode on that provider despite the builtin pin), source-borne loop pre-check before spending the halve-retry, exhaustion-arm test, hardcoded-EN placeholder i18n.

---

## v1.27.x PATCH cycle — SHIPPED 2026-09-06 as v1.27.1, and 2026-09-15 as v1.27.2

**Triggered by:** v1.27.0 MINOR shipped 2026-08-27 (`3464cce`). PATCH backlog is the union of (a) v1.27.0 ship-day bugs from architect-level triage, (b) deferred items from v1.27.0 review threads, (c) post-MINOR new Issues filed by @DocTpoint (2026-08-28 onwards: #567 / #568 / #605–#620 series).

**Milestone note (2026-09-04):** the `v1.27.0 MINOR` GitHub milestone is CLOSED (released 2026-08-27) and must not carry new work. All open PATCH/feature items live under `v1.27.x PATCH` until a future MINOR milestone is created.

### Shipped into v1.27.x PATCH — wave A (2026-08-27 → 09-02, 12 PRs, main `7c4d144`)

Architect + community correctness wave merged 09-02: repetition-loop echo (#572), task-policy `__proto__` guard (#571), Hermes cross-reference memory (#587), contradiction marker read half (#578), item-level contradiction lane (#576), contentHash drift lint (#577), merge note paragraphs (#579), preamble cut fix (#580), heading normalization (#581), cancelled-ingest fix (#583), reasoning-channel gates (#585/#586), Claude-residue removal (#574). Plus Tier-0 5-PR wave (09-02, merged in order #596 → #602 → #591 → #600 → #589): ingest ownership from `source_file` (#596), contradiction write-path resolution (#602), dev-instrument link cache (#591), picker disk-state (#600), cross-folder dedup routing (#589). 3741 → 3792 tests.

### Shipped into v1.27.x PATCH — wave C (2026-09-04/05, 5 PRs + 3 audit cleanups, main `ddf392d`)

Composition record: [CHANGELOG §1.27.1](./CHANGELOG.md#1271---2026-09-06). DocTpoint query/ingest/LLM correctness wave (merge order #630 → #629 → #625 → #626 → #631) + maintainer three-phase repo-audit cleanup (#632 → #633 → #634, merge-first as the base). 3975 tests (Gate 1 green); issues #623/#624/#627/#628 auto-closed by their PRs.

Planning residue: #631's follow-up stands — `mergeDuplicatePages`/`resolveContradiction` stay unguarded (2-guarded/1-unguarded until the follow-up note is acted on). Open design calls unchanged: #603 (write-gate contract), #604 (dead contradiction loop), #567 (limit contract).

### Shipped into v1.27.x PATCH — wave D (2026-09-05/06, 2 PRs, main `f1f2936`)

Composition record: [CHANGELOG §1.27.1](./CHANGELOG.md#1271---2026-09-06). Deterministic related lists end to end (#636, closes #635) + the fast-uri dependency-security root fix (#637, closes 8 Dependabot alerts, open=0) — the final wave before v1.27.1 shipped. 3993 tests (Gate 1 green).

### Shipped into v1.27.x PATCH — wave E (2026-09-10 → 09-12, 17 PRs, main `6b543bf`)

Composition record: [CHANGELOG §1.27.2](./CHANGELOG.md#1272---2026-09-15). Post-v1.27.1 correctness wave: @DocTpoint's issue→PR pairs (each bug filed with measurements, then fixed with tests in the same window), @Jan-Heldal's first two PRs, and dependency/CI hygiene. All review-approved (`gh pr review` event precedes every `gh pr merge`) and squash-merged; 3993 → **4115 tests**. Issues auto-closed by their PRs: #593 #594 #644 #646 #648 #650 #659 #661.

### Shipped into v1.27.x PATCH — wave B (2026-09-04, 9 PRs, main `8feb5fd`)

Composition record: [CHANGELOG §1.27.1](./CHANGELOG.md#1271---2026-09-06). DocTpoint rewrite-safety audit wave, all merge-ready and review-approved in one pass (09-04). 3830 tests (Gate 1 green); issues #605/#609/#611/#613/#614/#617/#620 auto-closed by their PRs.

### Shipped into v1.27.x PATCH — wave F (2026-09-13 → 09-15) — SHIPPED 2026-09-15 as v1.27.2

Composition record: [CHANGELOG §1.27.2](./CHANGELOG.md#1272---2026-09-15) — 39 commits, 3993 → **4144 tests**. Per-PR detail lives there, not here; this section keeps only what changes the planning picture:

- **Deferred to `v1.28.0 MINOR` (decided 2026-09-15):** **#701** writes `wiki-ingested:` into the user's *source notes* with the write on by default — contradicts the Quick Start promise at `README.md:114` in all eleven locales and the old-default-behaviour-preserved rule. Two design options on the table (opt-in write + 11-README update, or keep the record in plugin data keyed by path). **#706** (`@ai-sdk/openai-compatible` 2→3 MAJOR) changes the request-body shape — MINOR material, not PATCH.
- **#703 does not block a release:** no fix PR exists to wait for, no destructive effect, workaround available (exclude the file) — ships as a Release Notes Known Issue.
- **Process debt (unfixed):** a push-triggered CI failure on `main` has no PR page to carry a red mark, so the regression that #722 fixed sat red for five commits that nobody read. #698 bought the coverage, not the visibility. Candidate fix: a CI-failure notification path, or a per-session `gh run list --branch main` verification step.
- **Review rule recorded (MEMORY, 2026-09-15):** two PRs touching the same file must be diffed against each other before merge — #705 and #714 each passed Gate 1 alone and broke `main` together.

### Active backlog (priority × ROI)

| # | Issue | What | Why now | Owner | Status |
|---|-------|------|---------|-------|--------|
| 1 | **#568** | Domain-axis write side follow-ups (post-#569-merge) | #91 read-side prerequisite; PR #569 MERGED 09-04 (`9d6183c`), gate table #607 MERGED 09-04 (`6a5ba34`) — remaining work is follow-ups on the merged base, not re-review | DocTpoint | Merged base; file follow-up issues as needed |
| 2 | **#567** | `customEntityLimit` / `customConceptLimit` ceiling-vs-denominator coupling reduces yield as limit rises | Real user pain (11-50 default range); recommended contract: ceiling-only + stop gets own signal sibling to `checkEmptyBatch` | green-dalii (owner-self) | Issue open; needs contract decision then PR; #607's gate table addresses part of it |
| 3 | **#603** | "single write gate" contract does not hold — six writers bypass `createOrUpdatePage` | Design call (09-02 reply): narrow documented contract + progressive funnel + write-audit logging | DocTpoint | ✅ **CLOSED 2026-09-20** — landed as #750 after four review rounds; slices 1–3 shipped |
| 4 | **#604** | contradiction resolution loop dead code — nothing sets `review_ok` | Design call (09-02 reply): remove dead branch, keep review field on record | DocTpoint | Open; design decision pending |
| 5 | **#592 / #593 / #594 / #597** | Jan-Heldal community bug series (dead-link clobber / modal crash / log voice / schema metadata) | Verified against bundled main.js by DocTpoint; submitter invited to PR | Jan-Heldal | Open; awaiting contributor PRs |
| 6 | **#542** | `isSourceBorneLoop` suppresses halve-retry for common-word degenerate cases | Reaffirmed by #525 follow-up review | green-dalii (owner-self) | Issue open; small fix |
| 7 | **#407 Stage 2** | 7 silent-failure sites in `conversation-ingest.ts:337` et al (one PR per blast radius) | High-ROI bug series, blast-radius split per `feedback_*` lessons | green-dalii (owner-self) | Open; split into ~3 PRs |
| 8 | **#528** | Type-repair fan-out — bound concurrency to 2-4 chunks | Review-thread follow-up from #528 merged | DocTpoint | Open; defer to mid-PATCH |
| 9 | **#539 follow-ups** | codex-client `outputModeOverride` honoring + exhaustion-arm test + hardcoded-EN placeholder i18n | 6 filed items from simplify pass on PR #539 | green-dalii (owner-self) | Open; mid-PATCH |

**Removed from backlog as shipped (wave A/B):** #543 (PR #571) · #542-adjacent repetition-loop (PR #572) · #595/#598/#601/#588/#590/#605/#609/#611/#613/#614/#617/#620 (all closed by PRs #596/#600/#602/#589/#591/#606/#610/#612/#615/#616/#618/#621)

**Removed from backlog as shipped (wave E):** #542 (PR #572) · #593/#594 (PRs #654/#655, Jan-Heldal series)

**Re-homed off the PATCH backlog:** #603 / #604 → `v1.28.0 MINOR`. Both are design calls, not patch-shaped, and #604's fix (#684) closes it from the PATCH side — see the milestone reconciliation in the ROI board below.

**Stale rows to read with care:** row 7's #407 was closed on `v1.26.x PATCH`; rows 8–9 name merged PRs (#528, #539) whose *follow-up items* are the open work, not the PRs themselves.

**The ROI board below is the single source for milestone-scoped remaining work.** This table is the wider backlog, including items that carry no milestone.

### Recently shipped into v1.27.x PATCH (2026-08-27, pre-triage batch)

| PR | Issue | What | Why |
|----|-------|------|-----|
| **#559** (`92f2f8c`) | #537 × #532 | `minAliasLength` floor threaded to the create path; cross-page alias gate wired at path resolution | Alias-floor unification from v1.27.0 review thread |
| **#564** (`1a56a9d`) | #562 | `parenSpans` no longer treats wikilink markup brackets as aside | Gate link markup misread |
| **#557** (`bd992f8c`) | #556 | `pnpm.overrides` deprecation → move to `pnpm-workspace.yaml` | pnpm 11+ silently drops the `pnpm` field |
| **#566** (`a4c90c4`) | #560 follow-up | dev-instrument relative links converted to absolute https URLs | Path-changing PR must sync-audit `readme-links` guard |

### Review-thread debts carried into v1.27.x PATCH

- **#528** type-repair fan-out (concurrent → 2-4 chunks)
- **#521** zh/ja candidate-gate measurement on a Chinese vault (DocTpoint → maintainer follow-up)
- Alias-floor unification (#537×#532) — **DONE via PR #559**, but `filterRedundantAliases` cross-page gate still needs the wiring follow-up tracked separately
- codex-client `outputModeOverride` honoring + exhaustion arm + i18n placeholders (from PR #525 / #539 review)

### Research bookmarks (NOT in PATCH cycle)

- **#479** Coverage measurement denominator — "no edge" readability (DocTpoint, 2026-08-18): 30.1% omission rate measured; on `v1.27.0+ research` milestone 2026-08-28; reopen when LLM-side probe ready
- **#480** "PPR ≈ kNN" is a property of co-occurrence edges — depends on typed relations #285 emitting before re-test meaningful; on `v1.27.0+ research` milestone 2026-08-28

### ROI board — remaining v1.27.x PATCH work (2026-09-12)

**Supersedes the 2026-09-04 cadence.** 18 open items in the milestone; zero are merge-ready today, which is the single most useful fact about this board. ROI = user value × probability of landing soon ÷ (remaining effort).

**Tier 1 — unblock, then merge (work ~90 % done; only a mechanical action remains).** Highest ROI on the board: the code and tests already exist, CI is green on all three, and each has a conflict resolution written out on the PR.

| # | Item | Why it matters | Remaining work | Owner |
|---|------|----------------|----------------|-------|
| 1 | **#673** (PR) → closes #672 | 7.6 % of pages born tagless (69/903); prompt offered one vocabulary, write gate enforced another | rebase `wiki-engine.ts` — import union + take the author's comment (both hunks specified) | DocTpoint |
| 2 | **#684** (PR) → closes #604 + #666 | removes the contradiction requirement the prompt cannot answer, and the `review_ok` loop nothing feeds. Zero-reference trace run by maintainer: 6 deleted symbols at 0 refs, `review_ok` only in comments; `page-factory/` untouched so detection survives | rebase `log-writer.ts` — keep `getLogLabels`, add `ContradictionInfo`, drop stale-base `TEXTS` | DocTpoint |
| 3 | **#681** (PR) → completes #679/#680 | source-page head from the code (21 of 105 titles were paths the model copied back, all on notes without an H1) | rebase `wiki-engine.ts` — keep **both** lines, upsert before stamp | DocTpoint |
| 4 | **#653** (PR) → closes #592 | dead-link repair discards author-written aliases — data-destroying on user text | 3 review items + rebase (test file was moved by #634) | Jan-Heldal |
| 5 | **#656** (PR) → closes #597 | `config.md` audit trail never updated on Apply | 3 review items (`upsertFrontmatterField`, `updated` semantics, `localDateStamp`) | Jan-Heldal |

**Tier 2 — start now, no external dependency.** Best ROI per unit of *maintainer* effort, because none of these waits on a contributor.

| # | Item | Why it matters | Remaining work |
|---|------|----------------|----------------|
| 6 | **#688** | status bar stuck after Skip/Cancel until restart, Notice also undismissed | **root cause located**: the Skip path returns at `wiki-engine.ts:972`, above the main `try/finally` at `:1605` that calls `onIngestionEnd`. Small — move the teardown to cover the early return |
| 7 | **#678** | every stub Fix Dead Links creates is never collected — `STUB_MARKER` is `'Auto-generated stub page'` while `fix-dead-link.ts:95` writes a different sentence, so `isPageEmpty` is always false | needs a dedicated predicate, **not** a constant update (`isPageEmpty` is read beyond stub collection) |
| 8 | **#657** | README's GDPR claim is scoped to the model path only; `native` sends the PDF to a US provider, `mineru` to Aliyun with no published retention statement | docs only — the cheap half; EU-hosted OCR stays a roadmap entry |
| 9 | **#676** | Fix Dead Links can resolve a dead link to the page it lives on, turning a known gap into a false "resolved" (24 pages / 27 list items measured) | needs a minimal reproduction first; **shares `fix-dead-link.ts` with #653**, so land them together |
| 10 | **#665** | Codex browser sign-in fails ("Failed to fetch dynamically imported module") for a community user | blocked on reporter diagnostics; note the existing test only asserts the *bundle shape* and never executes the dynamic import — a real coverage hole at the failing line |

**Tier 3 — reconcile the milestone, not the code.**

- **#604** sits on `v1.28.0 MINOR` while its fix **#684** sits on `v1.27.x PATCH`. An issue and the PR that closes it must ship in the same window — move #604 to `v1.27.x PATCH` when #684 lands, or move #684 with it.
- **#467 / #468 / #568** are enhancements/refactors parked in a PATCH milestone (created 2026-08-15 / 08-27). They are not patch-shaped; re-home to `v1.28.0 MINOR` rather than carrying them through another PATCH.
- **#567** is a real bug but needs a contract decision (ceiling-only vs denominator coupling) before it is patch-shaped.

**Sequencing constraint worth stating once:** #653 and #676 both edit `fix-dead-link.ts`, and #592's fix has already been reviewed on #653. Landing them in one pass avoids editing the same function twice and re-reviewing the alias logic.

### Triage discipline notes (post-triage 2026-08-28)

- 5 new items triaged: 4 from @DocTpoint (3 architect-level + 2 future-work bookmarks) + 1 PR. Total open issues 21 + 1 PR.
- AND-rule (eyes + label both present) skipped #542 / #543 — those had previous maintainer 👀 + label, but the work is still pending; visible in backlog above.
- PR review policy per AGENTS.md "Mandatory merge sequence": `gh pr review` (formal review event) precedes any `gh pr merge`. PR #569 received `CHANGES_REQUESTED` review event 2026-08-28 with B1-B6 + T1-T3 as pre-merge scope.

---

### Other follow-ups

- **#407 Stages 2** — `conversation-ingest.ts:337` and remaining 7 silent-failure sites, one PR per blast radius.
- **#438 Finding 2** — `extractPassthroughLines` whole-class passthrough (separate commit on `fix/438-frontmatter-...`, filed as new issue to track).
- **#449 Direction 2** — cross-run caching (v1.26.4 PATCH shipped Direction 1 + #452; cross-run is #449 D2).
- **PR #404 follow-up backlog (post-MinerU-merge)** — items deferred from the v1.27.0 MINOR follow-up per simplify + code-review; ship in subsequent PATCH/MINOR:
  - **Native backend image / Office input** — the native conversion branch is PDF-only by design (provider PDF input surface); images/Office under native are rejected as `incompatible-type`. Multi-format routing is MinerU-only. Extending native = new provider-path work (image parts per provider, capability detection); MinerU covers those formats meanwhile (switch backend).
  - **`PdfConversionContext` → `MarkdownConversionContext` rename** — interface still predates the multi-format wiring (`pdfFile` field name misleading now that MinerU accepts images/Office).
  - **Settings migrations registry** — `src/core/settings-migrations.ts` is at its inline-if-block ceiling (5 migrations, each adds a gate field + scaffolding). A `MIGRATIONS: Migration[]` registry would replace linear append with array-iteration; pair with two-phase post-IO hooks.
  - **Move MinerU SecretStorage migration into `settings-migrations.ts`** — currently inline in `src/main.ts:216-231` (the only migration bypassing the established two-phase pattern). Should mirror v1.25.3's pure-stash + `commitSettingsMigration*` orchestration.
  - **PDF branch abortController lifecycle duplication** — `src/wiki/wiki-engine.ts:900-911` has a try/catch/finally for the conversion branch that duplicates cleanup the main `ingestSource` finally already does. Hoist AbortError handling into the outer try/catch so one finally owns lifecycle.
  - **`validateRemoteUrl` dedupe** — `src/core/mineru-converter.ts:99-109` reinvents `isLocalBaseURL`'s local-host detection (security-sensitive classifier duplicated). Extract a shared `isLocalHost(hostname)` helper; both callers consume it.
  - **Test infrastructure consolidation** — `src/__tests__/core/mineru-converter.test.ts` re-mocks `SubtleCrypto` (the `__support__/setup.ts` already provides a deterministic `crypto.subtle` global); `pdf-converter.test.ts` `context()` helper duplicates `mineru-converter.test.ts`'s; `SettingMock`/`ControlMock` is re-declared in `settings-mineru-section.test.ts` and `settings-codex-sections.test.ts`. Consolidate into shared harnesses.
  - **Test the MinerU multi-format routing on real file extensions** — current unit tests use PNG/DOCX `TFile` mocks. Add an integration test (or manual E2E) for the Office + image types.
  - **i18n key rename for completion Notice** — `markdownConversionComplete` / `markdownConversionCompleteSaved` are now backend-agnostic. Re-key and re-translate if naming alignment with future HTML ingest surfaces warrants it.

---

## v1.27.0 MINOR — Design track

| Item | Issue | Note |
|------|-------|------|
| **CLI repo split** — `tools/llm-wiki-cli/` → standalone sibling repo `green-dalii/obsidian-llm-wiki-cli` | (see SPEC v2.0) | 4-phase migration (Boot → Coexist → Deprecate → Demote). Phase 1 (Boot) landed in the v1.26.x window; **Phase 4 (Demote) ships in v1.27.0 via PR #511** — in-tree CLI replaced by `tools/dev-instrument/` (UPSTREAM DEV-ONLY INSTRUMENT, engine contributors only); sibling repo remains the user-facing CLI |
| Per-type registration via Settings (#328 Phase 2) | #358 item 1 | Strongly coupled to cross-type dedup |
| User-extensible typed edges (frontmatter `relations:`) | #358 item 2 / #285 | Community pending |
| Bidirectional frontmatter (`derived_from` + `wiki_pages`) | #358 item 3 / #220 | Source-revision awareness is the foundation |
| Identity ambiguity record | #358 item 4 / #330 §7 | Core invariant |
| Preview-Confirm gate | #358 item 6 / #330 §2 | UX cost evaluation pending discussion |
| Stable mutation interface | #358 item 7 / #330 §8 | Prerequisite for external LLM-wiki CLI sibling project |
| **User-defined types** (events / risks / issues) — schema three-layer separation Phase 2 | #317 (joint design with #491 / #330 / #358) | Adds `event` page type alongside entity/concept. Schema config.md list of types becomes runtime-driven |
| **Source-revision awareness for merge** — distinguishing self-updates from cross-source conflicts | #220 | Content-layer order-invariance engineering expression. merge prompts learn the difference between "page changed because source changed" vs "page changed because a different source now affects it" |
| **External canonical pages defer** — wiki defers to existing People/Companies notes outside `wikiFolder` | #326 | Implementation layer of complementary-memory-model (#330) |

---

## v1.27.0+ research track (NOT committed)

- Computable schema (`rules.ts`) — depends on typed edges
- Query profile selector (4 modes) — depends on rules.ts
- Periodic consolidation pass — depends on ambiguity records accumulating
- Multi-vault isolation (#142) — long-term; `wikiFolder` provides folder-scope substitute
- Explicit event type (#112) — folds into user-defined types (#317)
- Scheduled ingest (#295) — conflicts with v1.26.0 external orchestration philosophy
- Obsidian Bases for index (#184) — Obsidian Bases still experimental; post-PPR integration
- OKF Bundle export (#285) — typed-edges output standard; community-pending
- 'auto' granularity mapping (#168) — needs benchmark + equation; community-pending
- **PPR ≈ kNN co-occurrence (#480)** — research bookmark; reopened 2026-08-28 with self-correction on symmetric-vs-directed adjacency; re-test only meaningful after typed relations #285
- **Coverage measurement denominator (#479)** — research bookmark; reopened 2026-08-28 with 30.1% omission rate measured; needs LLM-side per-edge probe before instrumentation
- Lint details in user README — partial via Advanced settings UI; full section TBD
- **EU-hosted document OCR (#657)** — the conversion backends send the document somewhere the user cannot choose: the native path to the configured provider (Anthropic / OpenAI / Google / Bedrock, all US-hosted), MinerU to `mineru.net` operated by OpenDataLab on Aliyun, which publishes no retention statement. Two shapes, both MINOR-sized and neither scoped: a self-hosted MinerU endpoint (the base URL is a hardcoded constant, `MINERU_API_BASE_URL` in `src/constants.ts`, with no setting or secret overriding it — #404 tracks it) or a pluggable OCR backend. Residency per path is now documented in `docs/PDF-OCR-GUIDE.md`; this entry is the option, not a promise for a window.
- OS-async observation window policy — formalize SecretStorage 5-version stabilization pattern
