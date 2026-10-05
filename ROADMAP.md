# LLM Wiki Plugin Roadmap

> Feature planning and improvement proposals

**Latest shipped:** v1.28.0 MINOR (2026-10-04, 52 commits / 4372 tests). See [CHANGELOG.md §1.28.0](./CHANGELOG.md#1280---2026-10-04) for the canonical composition record. | **Updated:** 2026-10-05

**Next MINOR candidate:** **#729 Phase 1** — the M0 co-citation projection. It was the named head of v1.28.0 and **v1.28.0 shipped without it**, because its design record is still *proposed* and an objection to it is unresolved. The milestone was moved to `v1.29.0 MINOR` on 2026-10-04 so a released milestone would not carry unstarted work. Nothing about the plan changed — only which release number it lands in. The four capabilities that did ship in v1.28.0 are in CHANGELOG §1.28.0.

**Milestone move (2026-10-04).** `v1.28.0 MINOR`'s 12 open items moved to the new `v1.29.0 MINOR`: #787 #764 #756 #752 #729 #677 #668 #664, plus the four open PRs #786 #781 #755 #701. `v1.28.0 MINOR` is now empty and closes with the release.

**v1.26.5 PATCH CANCELLED 2026-08-19** — folded into v1.27.0 MINOR to amortize release-cycle overhead (per user direction).

**v1.27.0 MINOR Phase4 (CLI demote) — MERGED 2026-08-22**: PR #511 (`002da74`, closes #507) migrates `tools/llm-wiki-cli/` → `tools/dev-instrument/` (UPSTREAM DEV-ONLY INSTRUMENT, engine contributors only), eliminating 49 of ~52 Obsidian Bot errors. Two review rounds by @DocTpoint (round-2 blocking finding produced the shim-bundle smoke test now in Gate 1); legacy snapshot at `legacy/cli-v1.26.4-snapshot`. One-cycle deprecation notice ships in the v1.27.0 release notes.

**v1.27.0 MINOR — SHIPPED 2026-08-27**: 36 merge commits (181 files, +11197/-3158 LOC, 3677 tests). Bedrock SSO/IAM (#425, PR #540, awaiting account-holder real-AWS E2E of three constants), MinerU multi-format (#404), source-page verbatim quotes (#496), Fix Dead Links leave-it (#485), ingest candidate gate (#514), per-step taskPolicies UI (#525/#490), composite-key LLM probe caches (#551/#552/#553), and a community wave of frontmatter / alias / dedup correctness fixes (#502/#505/#509/#510/#512/#513/#515/#517/#518/#519/#520/#521/#522/#523/#524/#527/#528/#530/#531/#532/#533/#534/#535/#536/#537/#538). Plus release chore: #501 npm-side `overrides` pin closes the `npm audit HIGH=1` carry-over from v1.26.x. Plan-aligned slider rule honored — all six original MINOR items shipped, none slid to v1.28.0.

## Process notes

Process standards live in [AGENTS.md §"🛡️ Six-Gate Quality Closure"](./AGENTS.md#-six-gate-quality-closure). Release flow lives in the [`obsidian-plugin-release` skill](/Users/greener/.pi/skills/obsidian-plugin-release/SKILL.md) (Pi canonical path; legacy alias `/Users/greener/.claude/skills/obsidian-plugin-release/SKILL.md` still works under Claude Code sessions). ROADMAP does not duplicate process standards or shipped-version details — only the **planning decisions** that have not yet shipped. The historical `[CLAUDE.md](./CLAUDE.md)` file is now a pointer stub to `AGENTS.md`; all new content goes in `AGENTS.md`.

---

## v1.29.0 MINOR — Design track

**Opened 2026-09-16.** Two mandates, per user direction: **feature work and hardening run in the same window** — v1.28.0 is not a feature-only release. Design detail for the first item lives in [MEMORY.md §"Design record — cross-source relations"](./MEMORY.md#design-record--cross-source-relations-729-v1280); this section carries only the planning decisions.

> **The live, ROI-ordered task list is [MEMORY.md §"Work list (2026-09-21)"](./MEMORY.md#work-list-2026-09-21--ordered-by-roi).** That file holds the ordering and the reasoning; this one holds the window's scope. When they disagree, MEMORY is the newer document.

### Scope groups

| Group | Items | Why this window |
|---|---|---|
| **Cross-source relations** (feature) | **#729** — Related sections are intra-source by construction; reserved budget + co-citation projection + local ranker, with multi-hop query decomposition as companion | MINOR-sized and changes default behaviour, so not PATCH-shaped. **⚠️ Proposed 2026-09-16, NOT concluded**: @DocTpoint's objection of 2026-09-18 is still open and corrects four of the underlying measurements. Do not build on this until #729's thread concludes |
| **Write-path hardening** (architecture) | **#603** ✅ closed with **#750** · **#662** ✅ closed with **#757** | Both landed 2026-09-20. The gate is split into `rawWrite` / `pageGuard` / `notify` with a defaultless `WriteIntent`, and the page index is held per file. **This was the gate on #729 Phase 1 and it is open** |
| **Read-path behaviour** (architecture) | **#664** (Related lists grow ~2 entries per source and are never pruned), **#677** (a classification move makes untouched notes read as edited), **#668** (settings tab: three tabs over nine sections that already exist) | Behaviour/UX changes rather than defects |
| **Deferred features** | **#701** (source-note `wiki-ingested:` marker — contradicts the `README.md:114` promise in all eleven locales), **#741** (`opencode.ai` fails the CORS preflight, so streamed answers arrive buffered), PR **#728** (`@ai-sdk/openai-compatible` 2→3 MAJOR, request-body shape) | Each needs a decision, or carries a measured caveat this pass did not settle |
| **Community** | **#608** + PR **#687** ✅ **shipped 2026-09-21** (local Markdown image embeds) · **#752** (the settings tab also jumps back to the top — the sibling of #668, and fixing the scroll before #668's restructure means doing it twice) | #687 landed; #752 is still on the milestone |

### ⛔ Open decisions — the queue awaiting the maintainer (2026-10-04)

This is the first section to read after a compact. Each row is a decision, not a task:
the work is done or scoped, and what is missing is a call. Everything here now sits on
`v1.29.0 MINOR` or `v1.28.x PATCH`; nothing here blocks v1.28.0, which shipped 2026-10-04.

**Milestone map (restructured 2026-10-04, when v1.28.0 shipped).** Three windows are open,
and together they hold every open issue and PR — nothing is unassigned:

| Milestone | Open | What belongs in it |
|---|---|---|
| `v1.28.x PATCH` | 12 | Bug fixes, docs and engineering hygiene. No new features |
| `v1.29.0 MINOR` | 16 | New capabilities, and the #729 design track's head |
| `v1.27.0+ research` | 16 | Ideas with no committed version — experimental, or awaiting a design conversation |

The restructure replaced two milestones that had outlived their names. **`v1.27.x PATCH`**
still held 11 items under a title naming a window that closed with v1.27.2 on 2026-09-15; its
10 PATCH-scale items moved to `v1.28.x PATCH` and #568 (an `enhancement`, not a fix) moved to
`v1.29.0 MINOR`. **`v1.27.0 MINOR`** was empty and released, so it was closed. Both rules came
from the same place: *a released milestone may not carry unstarted work* — the reason
`v1.28.0 MINOR` was emptied before its own release.

| # | What it is | Why it is waiting | Recommendation |
|---|---|---|---|
| **#729** | Cross-source relations — the design record is **proposed**, and @DocTpoint's objection is unresolved | **The ordering itself is contested**: the measured loss is at the reader's *lexical seed stage*, and a denser graph cannot repair a wrong seed. The milestone moved to `v1.29.0` on 2026-10-04 and it is now the head of that queue. The three directions are set out in §"#729 — the three directions" below | **A** |
| **#786** | AI SDK v7 upgrade, `Closes #764`, 29 files `+345/-439`, CI green | Four MAJOR dependencies plus wire behaviour — **not** obviously safe, so it was not merged with the rest | Review the wire snapshots, then merge; **#770/#771/#772 become superseded** |
| **#781** | #729 Phase 1 (the co-citation projection) | **Held** — it implements a design that is not settled | Do not merge until #729 concludes |
| **#755** | Extraction focus and content-requirement settings, from @weqoocu | Two new prompt-level settings — a content-generation behaviour, so it needs the Settings-panel scope call and a decision on whether the prompt should carry them at all | Review the scope first; the settings belong in the bottom Advanced panel either way |
| **#701** | Stamp a `wiki-ingested` marker on sources, from @weqoocu | Its premise **does not hold**: the marker it proposes to write is what the plugin already reads | Close it with the analysis, or re-scope it to the real need |
| **#785** | "Full Reindex" request | It touches **incremental accumulation**, a core design premise | Defer to research |
| **#787** | Let source notes opt out of the source-lemma guarantee | The guarantee assumes a note's filename is a subject; true for `Klotho.md`, false for a meeting note | Accept into the next window |

**Not waiting on a decision, just unstarted:** **#703** (ingest hangs — diagnosis first),
**#468**, **#567**, **#676**, **#756**, **#668**, **#664**, **#677**.

**Waiting on someone else, not on a decision:** **#792** — the label that misled the reporter
is in #810, and the reporter was asked to confirm on the next patch. **#793** — the
`good first issue` label came off on 2026-10-04, and the work remains documentation: the ten
translated READMEs quote English command names, and the command name is stored twice per locale.
A verification pass on 2026-10-04 corrected its own table — `README_RU.md` and
`README_ZH-Hant.md` are already clean, so the count is 7 files rather than 10, and `README_RU.md`
is the better reference because it already quotes translated names.

**Resolved since this queue was written (2026-10-03):** **#791** ✅ fixed by #799 ·
**#751** ✅ shipped in v1.28.0 · **#753** closed as superseded by #751 · **#467** ✅ closed by
#775, whose four review findings are fixed and mutation-checked · **#758** ✅ closed by #760 ·
**#752** ✅ closed by #794, which merged after two conflict resolutions in `CHANGELOG.md` alone ·
**#783** closed in favour of #760, with @newdeme credited as co-author on the fix ·
**#806** ✅ merged as `4b616c0c`, and its CHANGELOG entry as `0cdbbf4a` · **#808** filed for the
two hand-written templates that #806 left out.

### #729 — the three directions

The decision queue used to say "Three options in MEMORY §'Seed stage'". **That section does not
exist**, and no other file held the three options — the row named three and wrote down one. They
are set out here, on the axis of what each one commits to.

| | What it commits to | What it costs |
|---|---|---|
| **A** | **M0, with one measurement in front of it.** Measure where the extractor's out-of-scope names come from, then build the co-citation projection as planned | #729 waits for the measurement pass. If the measurement shows the loss is at the seed stage, M0 is built anyway and may not fix the loss that was reported |
| **B** | **The reader, before any graph work.** Fix how a query picks the pages it starts from, and leave the graph as it is | The premise that opened #729 — 95 % of edges intra-source — stays unfixed for another window. #781 is closed or stays held with no date. The reader work has no design record yet |
| **C** | **Nothing until the measurement lands.** Run it with no commitment to either order, and set the next step from the result | One window ships nothing for #729, because the measurement is the deliverable. It may show both are needed, which is the outcome that costs the most calendar time |

**Why A is the recommendation.** The measurement is cheap: one instrumented run, no product code.
B and C each risk a window on a design whose ordering is still disputed. A spends the same
measurement and keeps the plan. Its known weakness is that it can end with M0 built and the
reported loss unfixed, which is a real cost — and the reason the measurement comes first.

@DocTpoint's four conditions for trusting that measurement are on #729 (comment of 2026-09-24): it
must run on the default regime rather than his local cap, cover resolved entries as well as dead
ones, carry a positive control that can find a name known to be absent, and sample by hand the
class it attributes to the extractor's prior.

### Merged into v1.28.0 — RELEASED 2026-10-04

The per-release composition list now lives in [CHANGELOG.md §1.28.0](./CHANGELOG.md#1280---2026-10-04), which is the canonical record. Detail on what each change settled lives in MEMORY. This section keeps only the two facts a reader of this file needs: which contributors shipped user-facing work, and that the milestone is closed.

**Contributors:** @Chase07 (local Markdown image embeds, #687) · @DocTpoint (one tag vocabulary #673, per-file page index #757, ingest Notice stage #789, and the source-page prompt/schema split #774) · @x0Lazarus (Windows custom-instruction paths #778, lint write counting #784) · @Jan-Heldal (`config.md` audit-trail metadata #656) · @NotAFlightRisk (the history command's registered name #780) · @abhinav-neander (#794, pending).

Recorded here, not in CHANGELOG — that entry is written once at release. Detail on
what each change settled lives in MEMORY. **This list is maintained; when a PR lands,
it goes here.** `git log --oneline --since="2026-09-15" origin/main` is the authority,
and it currently carries **52 commits** since v1.27.2.

**User-facing:**

- **#799** — **#791**: a gateway that inlines its reasoning into the answer field is
  now reported instead of returning an empty answer in silence. The guard had tested the
  raw field before the thinking block was stripped, and that line dates from v1.19.0 —
  eight later commits all fixed the separate-channel shape, so the inline shape was never
  covered rather than regressed.
- **#687** — **#608**: opt-in local Markdown image embeds during ingest, from
  @Chase07. 30 production files + 4 test files.
- **#789** — **#788**: the manual-ingest progress Notice shows the engine's stage, and
  a finished batch closes it. From @DocTpoint.
- **#784** — **#763**: `writeFileWithIntent` returns whether content was written, so
  lint stops counting a write that was skipped. From @x0Lazarus.
- **#780** — the welcome note and eleven READMEs name the history command as Obsidian
  registers it. From @NotAFlightRisk. Follow-up filed as **#793**.
- **#774** — **prompts: stop asking the model for what the code writes**. The wire
  schema is the half that matters: a declared property is a request, and the strict
  tier lists every property in `required`. From @DocTpoint. `Refs #679`.
- **#656** — `config.md`'s audit-trail metadata on every Apply, in UTC. From
  @Jan-Heldal.
- **#750** — **#603 slices 2 + 3**: the write-path contract, in three movements. Its
  four review rounds are the most instructive of the cycle.
- **#757** — **#662**: the page index is held per file. From @DocTpoint.
- **#759** — **#751**: the build-config one-liner that made two shipped features work.
  Transitive **#665**.
- **#726** · **#653** · **#720** — three lint repairs: a stub's incoming link keeps its
  name, dead-link repair prefers the display name, and the double-nested repair reaches
  the file.

**Zero-embedding positioning, kept:**

- **#773** — **#699**: third-party licence notices generated from the built bundle.
- **#762** + **#673** — one tag vocabulary (**#672**), landed as two PRs on purpose
  because merging either alone makes nine locales assert the opposite of what ships.
- **#746** + **#744** — **#741**: streaming for origins that block the renderer, over a
  desktop `node:https` transport, with the fallback's failures recorded.
- **#736** — **#723** + **#735**: custom request headers, an OpenCode preset, a
  `(Responses)` variant.
- **#761** · **#737** · **#734** · **#745** · **#715** — AGENTS.md process rules.

**Dependencies and internal:**

- **#769** · **#765** · **#767** · **#733** — dependency work: two deliberate holds with
  their measurements, the `yaml` bump, and the zod 4 migration (**#669**).
- **#739** — **#729 Phase 0**: the Related and extraction ceilings centralised,
  behaviour-identical and proven by zero snapshot churn.
- **#748** — the write gate split into `pageGuard` / `rawWrite` / `notify`.
- **#776** · **#777** · **#779** · **#782** · **#730** · **#731** · **#732** · **#742** ·
  **#743** · **#747** · **#749** · **#754** — MEMORY/ROADMAP records and handoffs.

### Ordering decision (2026-09-16)

**Hardening before the reader — done for #603/#662, and the *ordering itself* is now contested.** #603's contract now holds and #662's index is held per file, so the store the acceptance criteria read from is telling the truth. **#729 Phase 1 is unblocked as of 2026-09-20, and #608 shipped 2026-09-21** — so nothing precedes Phase 1 in the queue.

**⚠️ But @DocTpoint challenges the ordering on measurement (2026-09-18):** arm C lost 3 of 5 multi-note questions **at the lexical seed stage**, not on reachability, so **a denser graph cannot repair a wrong seed** — the work belongs at the stage that actually loses. He also shows criterion 1 cannot fail, that M0 selects by tie-break (80 % of cuts inside a tie, 79 % of chosen entries resting on one shared target), that the extractor's prior is already leaking unmeasured, and that `keepFrom` blocks both allocation variants on existing vaults. **This is a maintainer-level ordering decision, not settled.** Maintainer's answer: #729 comment of 2026-09-23.

The four review rounds #750 took are the part worth carrying forward: the slice shipped **two behaviour regressions of its own** despite passing all three of its mutations, and the second of the two was a check it *removed* that had been incidentally holding another door shut. Both findings came from @DocTpoint reading the tree rather than the description.

**The write-path design pass completed 2026-09-16 and opens the phase-2/3 gate.** Its recommendation: split the gate into `rawWrite` / `pageGuard` / `notify` rather than funnel every write through it — **five real violations in four files** to fix, plus five sites that only need to declare their intent. Both source issues were re-measured and **each contained one claim that does not hold** (`log-writer.ts` does go through the gate; `contradictions.ts` does not exist), and each omitted worse sites than it listed — including `vault.adapter.write`, which sits below Obsidian's own eventing. Corrected counts and the reasoning are in the MEMORY design record, which phase 2 consumes directly.

Within #729 the mechanisms are ordered **floor-first**: the model-independent mechanism that holds the graph's quality *floor* (co-citation projection over links the vault already has) precedes the model-dependent ones that could raise its *ceiling*. Rationale, the three-mechanism table and the budget tiers are in the MEMORY design record; the principle itself is now a canonical decision (MEMORY §"Key design decisions").

### Phase schedule (2026-09-16, status 2026-10-04)

Dependency-ordered, not priority-ordered. **Phases 1 and 4 have shipped; phase 2 is now the head of the queue and is the only thing standing between this track and a release.**

| Phase | Items | Status |
|---|---|---|
| **1 — decouple, take the cheap wins** | #669 zod 4 · #723 custom headers, OpenCode preset, Responses variant (also closed #735) · #603 + #662 design pass | ✅ **shipped in v1.28.0** |
| **2 — #729 itself** | the six sub-phases in MEMORY §"Implementation plan". Sub-phase 0 (centralise the ceilings) ✅ done 2026-09-17, behaviour-identical. **Sub-phase 1 is the head of the queue.** | **not started — needs the direction call below** |
| **3 — behaviour layer** | #664 together with #729's allocation · #677 (unblocked when #603 closed) · #668 after #729's toggle has a home | blocked by phase 2 |
| **4 — independent features** | #608 + PR #687 ✅ shipped · #701 (needs its design decision first) · #755, #786 | ✅ shipped, except the three noted |

**Two couplings found during the 2026-09-16 planning pass, still binding:**

- **#729 ↔ #664.** #729 *adds* Related entries; #664 says those lists already grow ~2 per source and are never pruned. Designed separately, one raises the ceiling while the other leaves the floor open — and the measurement that would catch it (Related length over a rebuild) is exactly the one each would blame the other for. **They ship together.**
- **#729 ↔ #668.** #729 introduces a settings toggle that defaults on; #668 restructures the settings tab. Land the toggle *after* #668's structure is settled, or it gets re-homed twice. Per the Settings-panel scope rule it is bottom-Advanced-panel either way (content-generation behaviour, not LLM sampling).

**Open decisions for phase 2** — the direction call (A / B / C), whether the projection runs at **write time** or **query time**, **reserved vs additive** cross-source allocation, and where the toggle lands. All four are in #729's thread and in MEMORY §"Design record — cross-source relations"; the maintainer's recommendation is **A**, which defers the projection until the extractor's out-of-scope names have been measured.

---

### Community waves 1–3 — 2026-08-21/23 — ALL MERGED

18 PRs from community and architect contributors, reviewed, approved and squash-merged
across three waves. Their per-PR records are in [CHANGELOG §1.27.0](./CHANGELOG.md#1270---2026-08-27).
The three tables that used to sit here were removed on 2026-10-04, together with the
wave A–F tables above, for the same reason.

**Two follow-ups from those review threads are still open**, and they are why this stub
remains rather than disappearing: the **alias-floor unification** (#537 × #532 — route
`enforceFrontmatterConstraints` through `resolveMinAliasLength` so every alias writer
agrees on the floor) and the **zh/ja candidate-gate measurement** (#521's debt — the `de`
profile is the only one measured; the zh/ja thresholds are unmeasured and need a Chinese
vault).

**Deferred at the time and still deferred:** **#503** (`userIgnoreFilters`) — decision
recorded as `vault.getConfig` behind a narrow typed interface, blocked on pinning
Obsidian's ignore-matching semantics. It sits on the research milestone.

---

## v1.27.x PATCH cycle — SHIPPED 2026-09-06 as v1.27.1, and 2026-09-15 as v1.27.2

**Triggered by:** v1.27.0 MINOR shipped 2026-08-27 (`3464cce`). PATCH backlog is the union of (a) v1.27.0 ship-day bugs from architect-level triage, (b) deferred items from v1.27.0 review threads, (c) post-MINOR new Issues filed by @DocTpoint (2026-08-28 onwards: #567 / #568 / #605–#620 series).

**Milestone note (2026-09-04, superseded 2026-10-04):** the `v1.27.0 MINOR` GitHub milestone is CLOSED (released 2026-08-27) and must not carry new work. Open PATCH/feature items used to live under `v1.27.x PATCH`. That milestone was closed on 2026-10-04 for the same reason — its window ended with v1.27.2 — and its items moved to `v1.28.x PATCH` / `v1.29.0 MINOR`. See the milestone map above the decision queue.

### Shipped into v1.27.x PATCH — waves A–F (2026-08-27 → 09-15)

Six waves shipped across two PATCH releases, v1.27.1 (2026-09-06) and v1.27.2
(2026-09-15). **Their per-PR composition records live in [CHANGELOG §1.27.1](./CHANGELOG.md#1271---2026-09-06)
and [§1.27.2](./CHANGELOG.md#1272---2026-09-15).** The six wave tables that used to sit
here — 17 PRs in wave E alone, the whole community-wave inventory, the Tier-0 merge order —
were fully shipped and were removed on 2026-10-04 rather than carried forward. A shipped
backlog is not a plan; this file keeps only what still changes a planning decision.

**Two facts from those waves are still binding**, and neither is in the CHANGELOG:

- **#703 does not block a release.** No fix PR exists to wait for, no destructive effect,
  and excluding the file works around it — it ships as a Release Notes Known Issue.
- **Process debt, unfixed:** a push-triggered CI failure on `main` has no PR page to carry
  a red mark, so a regression can sit red for commits nobody reads. #698 bought the
  coverage, not the visibility. Candidate fix: a CI-failure notification path, or a
  per-session `gh run list --branch main` check.

### Backlog carried out of those cycles — six items still open

The 2026-09-12 ROI board and the wider priority table that used to sit here are gone:
18 of their rows shipped, and the rest are enumerated below. **Every other open item is
tracked by its GitHub milestone**, which is the authority — this table exists only for the
rows whose *next action* is not obvious from the issue itself.

| # | What | Next action |
|---|---|---|
| **#568** | Domain-axis write side follow-ups (post-#569-merge) | File follow-up issues as they surface; the merged base is the reference |
| **#567** | `customEntityLimit` / `customConceptLimit` ceiling-vs-denominator coupling lowers yield as the limit rises | Needs a contract decision (ceiling-only + its own stop signal sibling to `checkEmptyBatch`), then a PR |
| **#604** | Contradiction resolution loop is dead — nothing sets `review_ok` | Design call: remove the dead branch, keep the review field on record |
| **#542** | `isSourceBorneLoop` suppresses the halve-retry on common-word degenerate input | Small fix, self-owned |
| **#407 Stage 2** | 7 silent-failure sites in `conversation-ingest.ts` and neighbours | Split into ~3 PRs, one per blast radius |
| **#528** | Type-repair fan-out — bound concurrency to 2–4 chunks | Review-thread follow-up; defer to mid-cycle |
| **#539 follow-ups** | codex-client `outputModeOverride` honouring, exhaustion-arm test, hardcoded-EN placeholder i18n | Six filed items from the PR #539 simplify pass |

**One sequencing constraint worth stating once:** #653 and #676 both edit `fix-dead-link.ts`,
and #592's fix was already reviewed on #653. Landing them in one pass avoids editing the
same function twice and re-reviewing the alias logic. (#653 and #592 have since shipped;
#676 has not.)

### Review-thread debts carried into v1.27.x PATCH

- **#528** type-repair fan-out (concurrent → 2-4 chunks)
- **#521** zh/ja candidate-gate measurement on a Chinese vault (DocTpoint → maintainer follow-up)
- Alias-floor unification (#537×#532) — **DONE via PR #559**, but `filterRedundantAliases` cross-page gate still needs the wiring follow-up tracked separately
- codex-client `outputModeOverride` honoring + exhaustion arm + i18n placeholders (from PR #525 / #539 review)

### Research bookmarks (NOT in PATCH cycle)

- **#479** Coverage measurement denominator — "no edge" readability (DocTpoint, 2026-08-18): 30.1% omission rate measured; on `v1.27.0+ research` milestone 2026-08-28; reopen when LLM-side probe ready
- **#480** "PPR ≈ kNN" is a property of co-occurrence edges — depends on typed relations #285 emitting before re-test meaningful; on `v1.27.0+ research` milestone 2026-08-28

### Carried out of the v1.27.x PATCH ROI board — one item still open

The 2026-09-12 ROI board sat here with three tiers and ten rows. **Nine of them shipped**
(#673, #684, #681, #653, #656 in tier 1; #688, #678, #665, and #657 in tier 2, where #657's
residency question lives in the research track below). Its tier 3 was a milestone
reconciliation that the 2026-10-04 milestone move resolved. Only one row survives:

- **#676** — Fix Dead Links can resolve a dead link to the page it lives on, turning a
  known gap into a false "resolved" (24 pages / 27 list items measured). Needs a minimal
  reproduction first. **It shares `fix-dead-link.ts` with #653**, which has since shipped,
  so the conflict that made them a pair is gone — it is now a standalone fix.

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

## Design track — the complementary-memory-model items (#358 / #330)

These were listed under a `v1.27.0 MINOR — Design track` heading, which was wrong: they are
not that release's work and never were. They are the **unbuilt half of the complementary
memory model** (MEMORY §"Complementary memory model"), and each is a design decision rather
than a task. The ingest path, the query path and the write-path contract are on `main`;
what follows is what the model still needs in order to be whole.

| Item | Issue | What it needs |
|---|---|---|
| **Identity ambiguity record** | #358 item 4 / #330 §7 | The core invariant: record when a name could mean two things, rather than silently picking one |
| **Preview-Confirm gate** | #358 item 6 / #330 §2 | UX cost evaluation is still pending discussion — the gate is named as the smallest kernel of the Karpathy cycle |
| **Stable mutation interface** | #358 item 7 / #330 §8 | Prerequisite for the external CLI sibling project |
| **Per-type registration via Settings** | #358 item 1 / #328 Phase 2 | Strongly coupled to cross-type dedup |
| **User-defined types** (events / risks / issues) | #317, joint with #491 / #330 / #358 | Adds an `event` page type beside entity/concept; the `config.md` type list becomes runtime-driven. **Not yet built — and see the note on #656 below** |
| **User-extensible typed edges** (frontmatter `relations:`) | #358 item 2 / #285 | Community-pending |
| **Bidirectional frontmatter** (`derived_from` + `wiki_pages`) | #358 item 3 / #220 | Source-revision awareness is the foundation |
| **Source-revision awareness for merge** | #220 | Distinguishing "the page changed because its source changed" from "the page changed because a different source now affects it" |
| **External canonical pages defer** | #326 | How the wiki defers to People/Companies notes outside `wikiFolder` |

**Correction recorded 2026-10-04, because the old table claimed otherwise:** it said
"Phase 4 (Demote) ships in v1.27.0 via PR #511" while the same table still listed the CLI
split as an open design item. It shipped — the in-tree CLI is gone and `tools/dev-instrument/`
replaced it — so the row was removed rather than carried. The `config.md` "list of types
becomes runtime-driven" claim is an **#317 dependency, not a shipped feature**: the schema
layer still takes its reported types from code today.

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
