# LLM Wiki Plugin Roadmap

> Feature planning and improvement proposals

**Latest shipped:** v1.28.0 MINOR (2026-10-04, 52 commits / 4372 tests). See [CHANGELOG.md §1.28.0](./CHANGELOG.md#1280---2026-10-04) for the canonical composition record. | **Updated:** 2026-10-12
**Next MINOR candidate:** **#729 Phase 1** — the M0 co-citation projection. It was v1.28.0's named head, and **v1.28.0 shipped without it**. On 2026-10-05 the ordering
was **decided: direction A** — one measurement pass comes first, then M0. The measurement's definition, and the defect it also has to fix, are in §"#729 — the three
directions" below. The milestone moved to `v1.29.0 MINOR` on 2026-10-04, so a released milestone carries no unstarted work. Only the release number changed. The four
capabilities that shipped in v1.28.0 are in CHANGELOG §1.28.0.

**Milestone move (2026-10-04).** `v1.28.0 MINOR`'s 12 open items moved to the new `v1.29.0 MINOR`: #787 #764 #756 #752 #729 #677 #668 #664. `v1.28.0 MINOR` is now empty and closes with the release.

**Of the four PRs that paragraph named as open, two have landed or closed:** #786 shipped as `f41a39d0` (AI SDK v7), and #701 was closed with the analysis that its premise does not hold.

**v1.26.5 PATCH CANCELLED 2026-08-19** — folded into v1.27.0 MINOR to amortize release-cycle overhead (per user direction).

**v1.27.0 MINOR Phase4 (CLI demote) — MERGED 2026-08-22**: PR #511 (`002da74`, closes #507) migrated `tools/llm-wiki-cli/` → `tools/dev-instrument/`. The instrument is
UPSTREAM DEV-ONLY, for engine contributors only. The move eliminated 49 of ~52 Obsidian Bot errors. Two review rounds by @DocTpoint followed; the round-2 blocking
finding produced the shim-bundle smoke test now in Gate 1. The legacy snapshot is at `legacy/cli-v1.26.4-snapshot`. One-cycle deprecation notice ships in the v1.27.0 release notes.

**v1.27.0 MINOR — SHIPPED 2026-08-27**: 36 merge commits (181 files, +11197/-3158 LOC, 3677 tests). Six named items shipped:

- Bedrock SSO/IAM (#425, PR #540) — awaits the account holder's real-AWS E2E of three constants
- MinerU multi-format (#404)
- Source-page verbatim quotes (#496)
- Fix Dead Links leave-it (#485)
- Ingest candidate gate (#514)
- Per-step taskPolicies UI (#525/#490)

Also shipped: composite-key LLM probe caches (#551/#552/#553), and a community wave of frontmatter / alias / dedup correctness fixes
(#502/#505/#509/#510/#512/#513/#515/#517/#518/#519/#520/#521/#522/#523/#524/#527/#528/#530/#531/#532/#533/#534/#535/#536/#537/#538).
The #501 npm-side `overrides` pin closed the `npm audit HIGH=1` carry-over from v1.26.x. Plan-aligned slider rule honored: all six original MINOR items shipped, none slid to v1.28.0.

## Process notes

Process standards live in [AGENTS.md §"🛡️ Six-Gate Quality Closure"](./AGENTS.md#-six-gate-quality-closure). Release flow lives in the
[`obsidian-plugin-release` skill](~/.agents/skills/obsidian-plugin-release/SKILL.md) (canonical path; legacy aliases `~/.claude/skills/` and `~/.pi/skills/` still resolve).
ROADMAP does not duplicate process standards or shipped-version details — only the **planning decisions** that have not yet shipped. The historical
`[CLAUDE.md](./CLAUDE.md)` file is now a pointer stub to `AGENTS.md`; all new content goes in `AGENTS.md`.

---

## v1.29.0 MINOR — Design track

**Opened 2026-09-16.** Two mandates, per user direction. **Feature work and hardening run in the same window** — v1.28.0 is not a feature-only release. Design detail
for the first item lives in [MEMORY.md Appendix A §"Design record — cross-source relations"](./MEMORY.md#design-record--cross-source-relations-729-v1280). This section
carries only the planning decisions.

> **The ROI rule is [MEMORY.md §"Work lists — the ROI rule"](./MEMORY.md#work-lists--the-roi-rule-tier-tables-archived)**. [MEMORY.md Appendix B](./MEMORY.md#appendix-b--session-log-dated-blocks-verbatim)
> holds the ROI-ordered tier lists, as history. The queue below is what is maintained now. The tier lists are its ancestor, kept for their reasoning only. This section
> is the newer document.

### Scope groups

| Group | Items | Why this window |
|---|---|---|
| **Cross-source relations** (feature) | **#729** — Related sections are intra-source by construction; reserved budget + co-citation projection + local ranker, with multi-hop query decomposition as companion | MINOR-sized and changes default behaviour, so not PATCH-shaped. **Decided 2026-10-05 (direction A)**: @DocTpoint's objection of 2026-09-18 is accepted — it corrects four of the underlying measurements and names a defect in the mechanism itself. The measurement pass runs first, then M0 in a corrected shape |
| **Write-path hardening** (architecture) | **#603** ✅ closed with **#750** · **#662** ✅ closed with **#757** | Both landed 2026-09-20. The gate is split into `rawWrite` / `pageGuard` / `notify` with a defaultless `WriteIntent`, and the page index is held per file. **This was the gate on #729 Phase 1 and it is open** |
| **Read-path behaviour** (architecture) | **#664** (Related lists grow ~2 entries per source and are never pruned), **#677** (a classification move makes untouched notes read as edited), **#668** (settings tab: three tabs over nine sections that already exist) | Behaviour/UX changes rather than defects |
| **Deferred features** | ~~#701~~ closed (premise does not hold) · ~~#741~~ ✅ shipped in v1.28.0 · ~~PR #728~~ closed with #786 | **All three are closed.** The row is kept as a pointer; the reasons are in MEMORY Appendix A §"Design record — #701's premise does not hold" and CHANGELOG §1.28.0 |
| **Community** | **#608** + PR **#687** ✅ **shipped 2026-09-21** (local Markdown image embeds) · **#752** ✅ closed by #794 (the settings tab also jumped back to the top) | Both landed. #752 was fixed by #794 in the order this row predicted: the scroll first, then #668's restructure |

### ⛔ Open decisions — the queue awaiting the maintainer (2026-10-04)

This is the first section to read after a compact. Each row is a decision, not a task.
The work is done or scoped, and the missing piece is a call. Everything here now sits on
`v1.29.0 MINOR` or `v1.28.x PATCH`; nothing here blocks v1.28.0, which shipped 2026-10-04.

**Milestone map (restructured 2026-10-04).** Three windows are open, and every open issue and PR is assigned to one of them.

| Milestone | What belongs in it |
|---|---|
| `v1.28.x PATCH` | Bug fixes, docs and engineering hygiene. No new features |
| `v1.29.0 MINOR` | New capabilities, and the #729 design track's head |
| `v1.27.0+ research` | Ideas with no committed version — experimental, or awaiting a design conversation |

**The per-milestone counts are deliberately not carried here.** This table held them until 2026-10-12, when they were found **wrong across all three rows** — the previous figures read 12 / 16 / 16 and `v1.29.0 MINOR` was five items high, because the move of #729's work into PRs (#781, #819) and the closure of #764 #752 #608 #687 by release had never been subtracted. Re-deriving them fixed that, and then they moved again inside the hour as four PRs and one issue arrived. **A number that changes hourly does not belong in a planning document; it belongs in a command.** Read them with `gh api "/repos/GD4AI/obsidian-llm-wiki/milestones?state=open" --jq '.[] | "\(.title): \(.open_issues)"'`.

The invariant that *is* carried: **nothing is unassigned.** On 2026-10-12 thirteen items had drifted in unassigned while this section claimed all three windows held everything. Checking the invariant is one command too, and it is the check that found the drift.

The restructure replaced two milestones that had outlived their names. **`v1.27.x PATCH`** still held 11 items under a title naming a window that closed with v1.27.2 on
2026-09-15. Its 10 PATCH-scale items moved to `v1.28.x PATCH`. #568 (an `enhancement`, not a fix) moved to `v1.29.0 MINOR`. **`v1.27.0 MINOR`** was empty and
released, so it was closed. Both rules came from one place: *a released milestone may not carry unstarted work*. That rule is the reason `v1.28.0 MINOR` was emptied
before its own release.

| # | What it is | Why it is waiting | Recommendation |
|---|---|---|---|
| **#729** | Cross-source relations — the design record is **proposed**, and @DocTpoint's objection is unresolved | **The ordering itself is contested**: the measured loss is at the reader's *lexical seed stage*, and a denser graph cannot repair a wrong seed. The milestone moved to `v1.29.0` on 2026-10-04 and it is now the head of that queue. The three directions are set out in §"#729 — the three directions" below | **A — chosen 2026-10-05** |
| **#781** | #729 Phase 1 (the co-citation projection) | **Held** — it implements a design that is not settled | Do not merge until #729 concludes |
| **#755** | Extraction focus and content-requirement settings, from @weqoocu | Two new prompt-level settings — a content-generation behaviour, so it needs the Settings-panel scope call and a decision on whether the prompt should carry them at all | Review the scope first; the settings belong in the bottom Advanced panel either way |
| **#701** | Stamp a `wiki-ingested` marker on sources, from @weqoocu | Its premise **does not hold**: the marker it proposes to write is what the plugin already reads | Close it with the analysis, or re-scope it to the real need |
| **#785** | "Full Reindex" request | It touches **incremental accumulation**, a core design premise | Defer to research |
| **#787** | Let source notes opt out of the source-lemma guarantee | The guarantee assumes a note's filename is a subject; true for `Klotho.md`, false for a meeting note | Accept into the next window |

**Not waiting on a decision, just unstarted:** **#703** (ingest hangs — diagnosis first), **#468**, **#567**, **#756**, **#668**, **#664**, **#677**.

**Waiting on someone else, not on a decision:** **#792** — the label that misled the reporter is in #810. The reporter was asked to confirm on the next patch. **#793**
— the `good first issue` label came off on 2026-10-04, and the work remains documentation. The ten translated READMEs quote English command names, and the command name
is stored twice per locale. A verification pass on 2026-10-04 corrected its own table. `README_RU.md` and `README_ZH-Hant.md` are already clean, so the count is 7 files
rather than 10. `README_RU.md` is the better reference, because it already quotes translated names.
**Shipped, and where that record lives:** [CHANGELOG.md](./CHANGELOG.md). A "resolved since this queue was written" list used to sit here. It was removed on 2026-10-12: it had been frozen at 2026-10-03, and a frozen resolve list reads as current state long after it stops being true. The per-version composition record is canonical in CHANGELOG, and a second copy here is a second place to be wrong.

### ROI order — the lint-fix correctness family (2026-10-12)

Six reports from @konstantinopolka against plugin 1.28.0 on ~1,000-page vaults, plus #676, which the same family produced. Every claim was read against the source before acceptance; none was taken from the report alone. They share one subsystem — the lint fix path — so they are ordered as one batch, not by issue number. `ROI = (impact × certainty) / effort`, per [MEMORY.md §"Work lists — the ROI rule"](./MEMORY.md#work-lists--the-roi-rule-tier-tables-archived).

| Rank | # | The defect | Impact | Certainty | Effort | Verdict |
|---|---|---|---|---|---|---|
| 1 | **#826** | Dedup can pair a page with itself, and the merge path has no `target !== source` guard — so it writes the page and then deletes the same path | High — silent data loss | High — two guards, and one already exists one layer down (`link-retarget.ts:142`) | Low | Fix first |
| 2 | **#823** | Same-page fixes race at `pageGenerationConcurrency`; the log reports corrections that never landed | High — the same dead links are "fixed" on every run, forever | High — `Promise.allSettled` over whole-file writes, and `createOrUpdateFile` discards `writeFileWithIntent`'s `boolean` | Low-medium | **In flight in #833** (@Noumenon-ai) — per-source promise chaining plus a write-outcome check. Do not re-implement |
| 3 | **#824** | `linkOrphanPage` appends an LLM-guessed target it never resolves, and can duplicate the link text on one line | Medium-high — orphans stay orphaned and the dead-link pool grows | High — `validateOrphanLinkTarget` is a substring check | Low-medium | Resolve against the page index before the write |
| 4 | **#827** | Fabricated placeholder stubs from doc-example identifiers (`myfile`, `name`, `unknown-entity`) become permanent lint items | Medium — the user cannot "fix" a page titled `Name` | Medium — needs a rule set, not a word list | Medium | Three rules: generic word, code identifier, inline-code-or-quote-only |
| 5 | **#825** | A merge reports retargets it skipped as stale, never rewrites frontmatter refs, then deletes the source | High — the merge is a net producer of dead links | Medium — the stale half is a defect; the frontmatter half reopens #386's deliberate scope | Medium | **Split.** Fix the delete-despite-stale half; take the frontmatter scope as its own decision |

**#676 is the same family and shipped 2026-10-12** as `b09ab3d7` (PR #829): the repair path could resolve a dead link to the page that contains it, which destroys the evidence that a page was ever missing. Reported at 24 pages / 27 list items on a ~2,300-page vault.

**One row left this batch while the batch was being written.** #823 was ranked second on impact and certainty, and PR **#833** opened the same day with that fix — per-source promise chaining in `runDeadLinkFixes` plus a write-outcome check. It was not visible when the roster was fetched, and it is **not available work**. This is the case the "already in flight in an OPEN PR" check exists for: a defect ranked by reading the report is not a defect nobody has started.

**The decision this batch cannot make for itself.** #825 asks whether `collectResolvingReferences` (`link-retarget.ts:198`) should read `frontmatterLinks`. #386 excluded them on purpose and #590 records that. Widening it changes the write behaviour of every merge, so it is a decision, not a fix. The recommendation is to ship the `stale > 0` half first and treat the frontmatter scope separately.

**The batch plan, for whoever picks this up.** Branch `fix/lint-dead-link-family` from `main`. One PR, four commits in this order, each revertible on its own, and each beginning with a test that fails without the change. #823 is **not** in it — see above. Four fixes, one subsystem, so one review rather than four.

| Seq | # | Where | The test that must fail first |
|---|---|---|---|
| 1 | **#826** | `dedup-phase.ts:735` drops self-pairs after `normalizeLLMPath`; a hard guard in `runDuplicateMerges` (`fix-runners.ts:423`) and in `mergeDuplicatePages` (`merge-duplicates.ts:15`) before any write or delete | A self-pair is dropped; `mergeDuplicatePages(x, x)` refuses; `deleteFile` is never called |
| 2 | **#824** | `validateOrphanLinkTarget` (`orphan-matcher.ts:45`) resolves through the existing page index; `buildOrphanLinkUpdate` (`:61`) drops a line that already carries the link | An unresolvable target is not appended; a duplicate is not appended; "linked from" is not reported when no inbound link was written |
| 3 | **#827** | The stub branch at `fix-dead-link.ts:325` gets three rules: a single generic word, a code identifier, and a name that appears only inside inline code or a quote | `MyFile` and `Name` create no page; an inline-code name creates no page; **a genuinely unknown entity still does** — over-filtering is the failure mode to test against |
| 4 | **#825** (stale half only) | `merge-duplicates.ts:194`: when `retargeted.stale > 0`, do not delete, and surface `stale` in the run result | `stale > 0` keeps the source and reports it; `stale === 0` deletes exactly as before |

**Three notes a picker-up needs.** #824 changes an **exported** signature: `validateOrphanLinkTarget` has unit tests and one caller (`link-orphan.ts:93`), so the resolver is an **optional** parameter and the existing call keeps its behaviour. #825's frontmatter half is **not** in the batch — it is decided in #835. And #833's English sentinel (`startsWith('no action taken')` in `fix-runners.ts`, matching literals in `fix-dead-link.ts`) is the same subsystem and is worth folding into seq 1 or 2, because a wording edit there silently restores the false "fixed" counts that #823 was about.

**The order is the ROI order, and the last row is last on purpose.** #825 is the only one whose correct behaviour changes what a merge *deletes*, so it carries the highest risk and belongs where it can be reverted without touching the other three.

**Status 2026-10-17: three of the four shipped on `fix/lint-dead-link-family`, and #827 waits on a decision.** #826, #824 and #825 each landed as their own commit with their own RED test and their own Gate 1. Four things came out of executing the plan rather than reading it:

- **#833 was already merged**, on 2026-10-12 as `f905b520`. Two paragraphs above still call it "in flight" and say "do not re-implement it" — both were true when written and stale five days later. The `'no action taken'` sentinel it touches is still there, and is **6** occurrences in `lint/fix-dead-link.ts`, not the four this plan names, matched by `startsWith` in `fix-runners.ts:272`. Fold that coupling into a later commit; do not silently edit the wording.
- **Seq 1's row described the fix, not the defect.** `dedup-phase.ts` did *not* drop self-pairs; it filtered only that `target` and `source` were non-empty strings, and `normalizeLLMPath` ran in the `.map()` **after** that filter, so the two were never compared. Two forms collapse — a literally repeated string, and the same path with the `wiki/` prefix on one side only. **`./entities/A.md` does not**: it becomes `wiki/./entities/A.md`. Verified by calling the production function, not by reading it.
- **Seq 2's second half was mis-attributed.** The plan calls it "can duplicate the link text on one line". The substring rule cannot: the duplicate comes from `link_text` already ending with the link. The defect is real; the cause named was not.
- **Forcing `stale > 0` in a test takes the right lever.** Replacing a cached reference's `original` looks correct and is not — the replacement is computed by substituting into `original`, so a corrupted `original` makes the replacement equal to it and the edit is dropped as a no-op before `applyEdits` sees it. Shift the recorded **position** instead.

**One residual from seq 4 is deliberately left visible.** `runDuplicateMerges` still increments `merged` for a pair whose source was kept, and `merged` reaches the user through `t.lintMergeComplete`, so the count can exceed the number of pages actually merged. Correcting it needs a structured outcome from `mergeDuplicatePages` rather than a match on the message text — the same fragile coupling as the sentinel. File it with #825's frontmatter half under the `#835` decision rather than patching the string.

**The dependency decisions in the same window.** Three, and each now has an outcome.

`@typescript-eslint`: PR **#821** took only the parser to 8.71.1 — dependabot's normal one-dependency shape — which left the parser and the plugin, both direct devDependencies, from different versions. **Resolved by #834**, which moves the pair together. Measured while doing it: **the pair bump does not remove the second copy of `@typescript-eslint/types`**, because `eslint-plugin-obsidianmd@0.4.2` pins its own `typescript-eslint` chain at 8.59.1 and the meta-package pins its sub-packages exactly. `pnpm dedupe` does not collapse them and was reverted: it converged nothing on that set while moving `picomatch`, `fdir`, `tinyglobby` and `ignore`. Collapsing the two belongs to the release-time Bot-alignment step, which already raises `eslint-plugin-obsidianmd` to its latest for this reason.

`ai` (**#831**) and `@ai-sdk/openai` (**#830**): both production dependencies, both **held**, and they must be taken together. **#828 exists because of `ai@7.0.x`'s types** — `finalStep` is present at runtime and absent from the declared type, which is why `origin/main` stopped compiling at `f41a39d0` and twelve call sites failed at once. An `ai` patch bump inside the same minor can move that type, so the pair needs `tsc --noEmit` and Gate 1 re-run after it lands, plus a wire-shape check on the OpenAI request body. Merging either one first would leave #828's fix unverified against the version actually installed.

**#816** claims dependabot now ignores TypeScript 6.x, and `.github/dependabot.yml` carries no such entry — confirm or add it, or the bot reopens the same PR.

### The next-work order — 2026-10-16, re-ranked

**Status 2026-10-17: the whole routine block is closed.** #830 and #831 were superseded by #859, #816's claim was false so #860 added the entry, the CHANGELOG was backfilled by #862, and #861 took the milestone it was missing. #755 is the one routine item left, and it waits on its contributor rather than on this repo. The heading keeps its original text deliberately: the 2026-10-17 status was first written into it, and that broke the anchor MEMORY links to — twice in one day, because a second rename followed. **A heading that another document links to is an address; status belongs in the body.**

A full sweep of ROADMAP, MEMORY, the code, 37 open issues, 6 open PRs and 3 milestones produced this order. The maintainer's call on 2026-10-16 was to run the routine items before the lint-fix batch, so the batch is no longer first despite carrying the highest correctness ROI in the repo.

| Rank | Work | Why here | Cost |
|---|---|---|---|
| ~~1~~ | ~~**#830 + #831**, `ai` and `@ai-sdk/openai`, **together**~~ | **Done 2026-10-17** — landed as #859 (`fded549f`) and both Dependabot branches closed as superseded. Neither was mergeable as it stood: both also downgraded `@typescript-eslint/*` from 8.71.1 to 8.59.1, a type-compatible revert of #834 that Gate 1 would not have caught | — |
| ~~2~~ | ~~**#816** verify~~ | **Done 2026-10-17** — the claim was false, so PR #860 (`2ff5eb40`) adds the entry. #816 itself stays open: the entry stops the bot, the migration is still 31 errors across 14 files | — |
| ~~1~~ | ~~**Backfill CHANGELOG `[Unreleased]`**~~ | **Done 2026-10-17** — PR #862 (`8934c8f9`). Ten entries added, and the `#764` version line corrected in place. `v1.28.0`'s release was 37 PRs behind and the file is what release notes are cut from, so this was a Gate 5 blocker sitting behind a section that looked complete | — |
| 1 | **#755** rebase and scope | @weqoocu's two prompt-level settings are CONFLICTING, and need a rebase plus one decision: whether the prompt should carry them at all | Needs the contributor |
| 2 | **Delete the dead `listModels()`** | Four implementations, **zero production callers**. The settings panel goes through `fetchModelsWithFallback`, which already rejects an empty list, and Codex through `fetchCodexModelCatalog`. It sits on the defect list as an "empty array false pass", which it cannot be: nothing reaches it | One small PR |
| 3 | **The real-question benchmark** | The largest evidence gap in the project. 20–30 real questions with hand-labelled answer pages, in a fixture that is synthetic and runs by default | Medium |
| 4 | **The lint-fix batch**, per the plan above | The highest correctness ROI of anything here — #826 alone is silent data loss — sequenced after the routine items by the maintainer's call | One PR, four commits |
| 5 | **#781's three residual sites** | See below. Cheap, and it clears DocTpoint's concrete objections | One small PR |
| 6 | **The E1 escalation gate** | A decision, not a fix. It needs the `coverage` and `lexCount` distributions before anyone can choose | Diagnosis, then a call |

**The whole routine block the maintainer sequenced ahead of the lint batch is now closed.** #830 and #831 were superseded by #859 (`fded549f`), #816's claim was false so #860 (`2ff5eb40`) added the entry, the CHANGELOG was backfilled by #862 (`8934c8f9`), and #861 (`4cc9e0d2`) — a dev-only `vite` 8.2.1 → 8.3.4 — was the only PR without a milestone and now has one. #755 is the one routine item left and it waits on its contributor, not on this repo.

**And #855's conflict is resolved** — twice in one day, both times a single `MEMORY.md` block where two sides insert a new "Current state" section at the same position. It is `MERGEABLE` again as of `7077f6a8`. The churn is worth naming: that branch conflicts whenever any docs PR merges, and it is blocked on a review rather than on its content, so if the review runs long it will need the resolution again. The cheap fix then is to land its documentation half separately so the code diff has nothing to conflict over.

**The `listModels()` row and the eight Shazam "orphans" are not the same kind of finding, and the orphans must not be acted on.** A call-graph tool reports eight symbols with zero incoming references across the old `tools/dev-instrument/` scripts. All eight are live: three are `setup(build)` esbuild plugin methods, which esbuild calls through the plugin object and never by name; four are passed as first-class values (`evaluateMax('MAX', [rankBm25fWithText, rankPpr])`); and `lexScore` leaves through an object shorthand. Deleting them would remove working code from the dev tools. `listModels()` is different — `grep -rn '\.listModels(' src/` returns nothing outside tests, across four implementations.

**Withdrawn: the write-side `source:` marker work.** The production vault's 25.1 % marker coverage was reported as a write-side defect, and work was queued against it. It is the age of that corpus. `test10` is the control: regenerated through the same production `IndexGenerator` it reaches 96.6 %, and its only 12 unmarked pages are its 12 `sources/` notes, which cannot link to themselves. `test8` reaches 85.5 %, and its 17 non-source gaps are pages whose `sources:` frontmatter points at an entity or concept page rather than a source note — `parseSourceSlug` reads `[[sources/<slug>]]`, so there is no slug to derive and declining is correct. The production vault's pages were written by an older release that never recorded that link. **"Unmarked" has three causes and only one is a defect, and that one only occurs in a corpus the current plugin did not write.**

**Reclassified: #781 is held, not rejected.** It was called "denied by measurement". That was wrong, and it was wrong in the expensive direction — closing it would have discarded unfinished work on the strength of a claim nobody checked. #729 chose direction A on 2026-10-05 on the terms "M0 proceeds, with one measurement in front of it. #781 stays held **until that measurement lands**" — and **that measurement has never run.** DocTpoint's `CHANGES_REQUESTED` says so in his own words: "I am marking this as 'Request changes' so that it does not merge before #729 has an answer. This is a statement about the order of the steps, not about your code."

Two of its prerequisites are already in. The query path is seeded (`ppr-cascade.ts:539` → `seededRngFrom(query, seeds)`) and two of four tie-break sorts are fixed (`:184` orders by score → `tokensFound` → path). **Three sites remain, all cheap:** `hub-detection.ts:72` and `hub-link-distinctiveness.ts:97` still reach `Math.random` through `options.pprOptions ?? {}`, and `ppr-cascade.ts:473` — `lexMatch`'s weight table — still sorts on `b.score - a.score` alone. After those, the only objection left is DocTpoint's unexplained "A" skew (9.1 % of pages, 17.1 % of chosen entries), which no mechanism in the tree accounts for and which needs its own check.

### #729 — the three directions

**STATUS 2026-10-14: the read-side track is MERGED.** Four PRs went in over one day: #837 (read-side core + tools), #841 (write-side shaping + hub-link distinctiveness), #842 (the `legacyScorer` switch in 11 locales), #840 (the docs). #843 and #844 followed with a term-index cache and its staleness fix. Gate 1 across the merge: 4709 tests / 334 files. The strict layer — pairs sharing under a third of their terms, different sources, truth edge removed — now reads 0.45-0.48 at r@10 on test8 and 0.32-0.36 on test10, up from 0.000 for a lexical channel without the body. self recall@10 is 1.000 in every arm on both vaults.

**What remains open below is the write-side track** — the part where signals get created rather than consumed. The read side can only use what the corpus carries; where two pages share no link and no wording, it has nothing to work with. That is a write-side problem and it is unchanged by the merge.

**Chosen 2026-10-05: A.** M0 proceeds, with one measurement in front of it. #781 stays held until that measurement lands. B and C stay in the table, because their cost is
the reason A was chosen. A later pass that reverses this writes the reason on the issue. It must not quietly re-plan.
**What A commits to measuring.** The prior-driven path is **already running and unmeasured**. `related-shaping.ts:140-141` pushes the extractor's out-of-scope names into
`unanswered`, and then writes them. So they land as dead links. In the control run **79 % of unresolved Related targets had never been a candidate**. That is the number
this pass exists to explain. The run has to separate two classes. One is out-of-scope-and-absent, the extractor's prior. The other is out-of-scope-but-present, where
candidate generation missed a name that is in the text. Only the second points at the reader's lexical seed stage. The Arm-C loss of 3 of 5 questions was measured
there. @DocTpoint's four conditions decide whether the result may be trusted. If any is unmet, the run repeats rather than gets interpreted.
**M0 is built after that run** — and not in the shape #781 carries today. The dissent's second finding is a defect in the mechanism as written, and the defect is worse than
stated: `ppr-cascade.ts:146`, `:348` and `:581` each sort by score alone, so **there is no tie-break, and the cut falls back to the caller's array order**. A whole Chinese
clause becomes one token (`ppr-cascade.ts:235`, the whitespace-split branch), every non-matching page scores zero, and the top-k cut then lands inside a tied group ordered by
that pool. 80 % of the top-3 cuts fall inside such a group. The dissent's other number — titles beginning with "A" are 9.1 % of pages but 17.1 % of chosen entries — this
mechanism does not explain, so that observation still needs its own check. That is a change to make on #781. It is also why A reads "measure, then M0" rather than "merge M0 now".

**A second defect makes the run unreadable until it is fixed.** `monte-carlo-ppr.ts:53` defaults `rng` to `Math.random`, over `DEFAULT_NUM_WALKS = 3000`, so the graph arm is
an estimate rather than a function: a rerun moves the numbers. Five runs per arm cannot separate two arms under that variance. Seeding the rng from the query hash is a
prerequisite, not a refinement.

**What the pass runs.** Two prerequisite fixes go into #781 first, each with a test that fails without it: a seeded rng, and a tie-break that is not the caller's pool order —
neutral and reproducible (path-lexicographic) for the measurement, because a recency-biased product policy is a separate decision and must not be smuggled in as a measurement
choice. Then five arms, all with the same model, the same character budget, thinking off, truth from the notes, and a blind rater:

| Arm | Retrieval over | What it isolates |
|---|---|---|
| **A** | raw notes, embedding index | the baseline |
| **B** | wiki pages, same index | notes against wiki |
| **C** | the plugin's query path, today | the measured 3-of-5 loss |
| **C′** | C plus the two fixes | the fixes, apart from the budget |
| **E** | C′ plus a reserved cross-source budget, applied by hand | the proposal itself |

The metric is recall@K plus **the cross-source share of the loaded pages**, which the tie-break finding predicts sits near zero. `n >= 20` multi-source questions, with a CJK
subset, because the tokenizer defect is worst in Chinese but is not Chinese-only. The dissent's four conditions for trusting the run apply unchanged.

**The work splits in two.** The automatable half is a synthetic corpus with known ground truth — N sources against M entities, cross-source links placed by hand — run through
the pipeline deterministically, reporting recall@K and the cross-source share per arm. It is reproducible and needs nobody. The half that decides is the real vault against a
real provider at `n >= 20`, blind-rated, and it needs the maintainer and @DocTpoint.

**A third finding, outside this pass.** For a Chinese query the lexical stage is nearly all-or-nothing, because one clause is one token. It affects every query path, not only
M0, so it belongs in its own issue rather than in the shape of this one.

The decision queue used to say "Three options in MEMORY §'Seed stage'". **That section does not exist**, and no other file held the three options. The row named three and
wrote down one. They are set out here, on the axis of what each one commits to.

| | What it commits to | What it costs |
|---|---|---|
| **A** | **M0, with one measurement in front of it.** Measure where the extractor's out-of-scope names come from, then build the co-citation projection as planned | #729 waits for the measurement pass. If the measurement shows the loss is at the seed stage, M0 is built anyway and may not fix the loss that was reported |
| **B** | **The reader, before any graph work.** Fix how a query picks the pages it starts from, and leave the graph as it is | The premise that opened #729 — 95 % of edges intra-source — stays unfixed for another window. #781 is closed or stays held with no date. The reader work has no design record yet |
| **C** | **Nothing until the measurement lands.** Run it with no commitment to either order, and set the next step from the result | One window ships nothing for #729, because the measurement is the deliverable. It may show both are needed, which is the outcome that costs the most calendar time |

**Why A is the recommendation.** The measurement is cheap: one instrumented run, no product code. B and C each risk a window on a design whose ordering is still disputed.
A spends the same measurement and keeps the plan. Its known weakness is that it can end with M0 built and the reported loss unfixed. That is a real cost, and the reason the
measurement comes first.

@DocTpoint's four conditions for trusting that measurement are on #729 (comment of 2026-09-24):

- it must run on the default regime rather than his local cap,
- it must cover resolved entries as well as dead ones,
- it must carry a positive control that can find a name known to be absent, and
- it must sample by hand the class it attributes to the extractor's prior.

### Query-side track — the plan as of 2026-10-15

Four levers are measured and three of them are in `main` or waiting to be. The whole track stays inside the corpus: no embedding, no external knowledge, no model call on the retrieval path.

| Lever | Gain | Cost | Status |
|-------|------|------|--------|
| Body text in the scoring | 29-90x r@20 | one index build | `main` |
| `text` not length-normalised | +0.04 / +0.08 r@10 | zero | `main` |
| Conversation in the retrieval query | 16-33x r@10 on follow-ups | zero | `fix/retrieval-sees-history`, awaiting approval |
| Two-stage Rocchio expansion | +0.04 / +0.05 r@10 | two lexical passes | #855, blocked on review fixes |

**#855 must not merge until three things are fixed.** @DocTpoint's review at `9102c478` stands on all five points. The blocking three: the expanded query is passed to the LLM stages as if it were the user's question; `expandQueryForRetrieval` rebuilds page terms and a corpus table on every query, which is the 4.4 s per query #843 removed; and no tool in the repo calls `twoStageExpand`, so the +0.040 / +0.051 cannot be reproduced from the repo. The fix order is original query to the LLM stages, `TermIndexCache` reuse, then move the measurement into the repo and re-run it through the production path.

**Next measurements, in order.**

1. `maxFuse` of lexical and PPR scores WORSE than PPR alone on both vaults (0.850 vs 0.923 test8, 0.826 vs 0.926 test10). The fusion is diluting the graph channel and it deserves its own pass before any more weight goes on the lexical side. Note that the eval set builds its questions from `a -> b` links and PPR walks those links, so this number needs `--exclude-asker` before it means anything (#854).
2. The full layered-eval re-run on 390 / 994 questions for the two-stage expansion, through the production path, after the review fixes land.

**Query surface polish, recorded on #756.** Inline citation links are too loud (smaller than body, quieter than the final reference list, underline kept). 清空历史 empties the view and leaves `data.json` alone — the button says "forget" and does "hide". The composer should default to three lines and grow with the content.

**What is NOT on this track and why.** Embeddings: the encoder's notion of similarity is the training corpus's, so it pulls a vault that deliberately goes beyond consensus back toward it. M2 (model-proposed edges): same reason, and the resolver checks that a page exists, not that a relation holds. Corpus-local co-occurrence expansion, anchor text, reverse links, co-citation projection: each measured and flat or negative on the strict layer. LLM query expansion for the cross-source gap: 0 % rescue measured over 1,180 questions. LLM reranking of the top-10: identical to baseline.

### Backlog carried out of those cycles — six items still open

The 2026-09-12 ROI board and the wider priority table that used to sit here are gone. 18 of their rows shipped, and the rest are enumerated below. **Every other
open item is tracked by its GitHub milestone**, which is the authority. This table exists only for the rows whose *next action* is not obvious from the issue itself.

| # | What | Next action |
|---|---|---|
| **#568** | Domain-axis write side follow-ups (post-#569-merge) | File follow-up issues as they surface; the merged base is the reference |
| **#567** | `customEntityLimit` / `customConceptLimit` ceiling-vs-denominator coupling lowers yield as the limit rises | Needs a contract decision (ceiling-only + its own stop signal sibling to `checkEmptyBatch`), then a PR |
| **#604** | Contradiction resolution loop is dead — nothing sets `review_ok` | Design call: remove the dead branch, keep the review field on record |
| **#542** | `isSourceBorneLoop` suppresses the halve-retry on common-word degenerate input | Small fix, self-owned |
| **#407 Stage 2** | 7 silent-failure sites in `conversation-ingest.ts` and neighbours | Split into ~3 PRs, one per blast radius |
| **#528** | Type-repair fan-out — bound concurrency to 2–4 chunks | Review-thread follow-up; defer to mid-cycle |
| **#539 follow-ups** | codex-client `outputModeOverride` honouring, exhaustion-arm test, hardcoded-EN placeholder i18n | Six filed items from the PR #539 simplify pass |

**One sequencing constraint worth stating once:** #653 and #676 both edit `fix-dead-link.ts`, and #592's fix was already reviewed on #653. Landing them in one pass avoids
editing the same function twice and re-reviewing the alias logic. (#653 and #592 have since shipped; #676 has not.)

### Review-thread debts carried into v1.27.x PATCH

- **#528** type-repair fan-out (concurrent → 2-4 chunks)
- **#521** zh/ja candidate-gate measurement on a Chinese vault (DocTpoint → maintainer follow-up)
- Alias-floor unification (#537×#532) — **DONE via PR #559**, but `filterRedundantAliases` cross-page gate still needs the wiring follow-up tracked separately
- codex-client `outputModeOverride` honoring + exhaustion arm + i18n placeholders (from PR #525 / #539 review)

### Research bookmarks (NOT in PATCH cycle)

- **#479** Coverage measurement denominator — "no edge" readability (DocTpoint, 2026-08-18). 30.1% omission rate measured.
  On `v1.27.0+ research` milestone 2026-08-28. Reopen when LLM-side probe ready.
- **#480** "PPR ≈ kNN" is a property of co-occurrence edges. It depends on typed relations #285 emitting before a re-test is meaningful. On `v1.27.0+ research` milestone 2026-08-28.

### Carried out of the v1.27.x PATCH ROI board — one item still open

The 2026-09-12 ROI board sat here with three tiers and ten rows. **Nine of them shipped.** Tier 1: #673, #684, #681, #653, #656. Tier 2: #688, #678, #665, and #657, whose residency question lives in the research track below.
Its tier 3 was a milestone reconciliation that the 2026-10-04 milestone move resolved. Only one row survives:

- **#676** — Fix Dead Links can resolve a dead link to the page it lives on. That turns a known gap into a false "resolved" (24 pages / 27 list items measured). Needs a minimal
  reproduction first. **It shares `fix-dead-link.ts` with #653**, which has since shipped. So the conflict that made them a pair is gone. It is now a standalone fix.

---

### Other follow-ups

- **#407 Stages 2** — `conversation-ingest.ts:337` and remaining 7 silent-failure sites, one PR per blast radius.
- **#438 Finding 2** — `extractPassthroughLines` whole-class passthrough (separate commit on `fix/438-frontmatter-...`, filed as new issue to track).
- **#449 Direction 2** — cross-run caching (v1.26.4 PATCH shipped Direction 1 + #452; cross-run is #449 D2).
- **PR #404 follow-up backlog (post-MinerU-merge)** — items deferred from the v1.27.0 MINOR follow-up, per simplify + code-review. They ship in a later PATCH/MINOR.
  - **Native backend image / Office input** — the native conversion branch is PDF-only by design, because of the provider PDF input surface. Images and Office files under
    native are rejected as `incompatible-type`, so multi-format routing is MinerU-only. Extending native means new provider-path work: image parts per provider, plus
    capability detection. MinerU covers those formats meanwhile, so switch backend.
  - **`PdfConversionContext` → `MarkdownConversionContext` rename** — the interface still predates the multi-format wiring. The `pdfFile` field name is misleading now,
    because MinerU accepts images and Office files.
  - **Settings migrations registry** — `src/core/settings-migrations.ts` is at its inline-if-block ceiling (5 migrations, each adds a gate field + scaffolding). A
    `MIGRATIONS: Migration[]` registry would replace linear append with array-iteration. Pair it with two-phase post-IO hooks.
  - **Move MinerU SecretStorage migration into `settings-migrations.ts`** — currently inline in `src/main.ts:216-231`, the only migration bypassing the established
    two-phase pattern. It should mirror v1.25.3's pure-stash + `commitSettingsMigration*` orchestration.
  - **PDF branch abortController lifecycle duplication** — `src/wiki/wiki-engine.ts:900-911` has a try/catch/finally for the conversion branch. That duplicates cleanup the
    main `ingestSource` finally already does. Hoist AbortError handling into the outer try/catch, so one finally owns lifecycle.
  - **`validateRemoteUrl` dedupe** — `src/core/mineru-converter.ts:99-109` reinvents `isLocalBaseURL`'s local-host detection (security-sensitive classifier duplicated).
    Extract a shared `isLocalHost(hostname)` helper. Both callers consume it.
  - **Test infrastructure consolidation** — `src/__tests__/core/mineru-converter.test.ts` re-mocks `SubtleCrypto`, but the `__support__/setup.ts` already provides a
    deterministic `crypto.subtle` global. The `pdf-converter.test.ts` `context()` helper duplicates `mineru-converter.test.ts`'s. `SettingMock`/`ControlMock` is
    re-declared in `settings-mineru-section.test.ts` and `settings-codex-sections.test.ts`. Consolidate into shared harnesses.
  - **Test the MinerU multi-format routing on real file extensions** — current unit tests use PNG/DOCX `TFile` mocks. Add an integration test (or manual E2E) for the Office
    + image types.
  - **i18n key rename for completion Notice** — `markdownConversionComplete` / `markdownConversionCompleteSaved` are now backend-agnostic. Re-key and re-translate if naming
    alignment with future HTML ingest surfaces warrants it.

---

## Design track — the complementary-memory-model items (#358 / #330)

These were listed under a `v1.27.0 MINOR — Design track` heading, which was wrong. They are not that release's work and never were. They are the **unbuilt half of the
complementary memory model** (MEMORY §"Complementary memory model"). Each is a design decision rather than a task. The ingest path, the query path and the write-path
contract are on `main`. What follows is what the model still needs in order to be whole.

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

**Correction recorded 2026-10-04, because the old table claimed otherwise:** it said "Phase 4 (Demote) ships in v1.27.0 via PR #511". The same table still listed the CLI split as
an open design item, but it shipped. The in-tree CLI is gone and `tools/dev-instrument/` replaced it, so the row was removed rather than carried. The `config.md` "list of types
becomes runtime-driven" claim is an **#317 dependency, not a shipped feature**: the schema layer still takes its reported types from code today.

---

## v1.27.0+ research track (NOT committed)

- Computable schema (`rules.ts`) — depends on typed edges.
- Query profile selector (4 modes) — depends on rules.ts.
- Periodic consolidation pass — depends on ambiguity records accumulating.
- Multi-vault isolation (#142) — long-term; `wikiFolder` provides folder-scope substitute.
- Explicit event type (#112) — folds into user-defined types (#317).
- Scheduled ingest (#295) — conflicts with v1.26.0 external orchestration philosophy.
- Obsidian Bases for index (#184) — Obsidian Bases still experimental; post-PPR integration.
- OKF Bundle export (#285) — typed-edges output standard; community-pending.
- 'auto' granularity mapping (#168) — needs benchmark + equation; community-pending.
- **PPR ≈ kNN co-occurrence (#480)** — research bookmark. Reopened 2026-08-28 with a self-correction on symmetric-vs-directed adjacency. Re-test only meaningful after typed relations #285.
- **Coverage measurement denominator (#479)** — research bookmark. Reopened 2026-08-28 with 30.1% omission rate measured. Needs an LLM-side per-edge probe before instrumentation.
- Lint details in user README — partial via Advanced settings UI; full section TBD.
- **EU-hosted document OCR (#657)** — the conversion backends send the document somewhere the user cannot choose. The native path sends it to the configured provider:
  Anthropic / OpenAI / Google / Bedrock, all US-hosted. MinerU sends it to `mineru.net`, operated by OpenDataLab on Aliyun, which publishes no retention statement. Two
  shapes are possible, both MINOR-sized and neither scoped. One is a self-hosted MinerU endpoint; the base URL is a hardcoded constant, `MINERU_API_BASE_URL` in
  `src/constants.ts`, with no setting or secret overriding it, and #404 tracks that. The other is a pluggable OCR backend. Residency per path is now documented in
  `docs/PDF-OCR-GUIDE.md`. This entry is the option, not a promise for a window.
- OS-async observation window policy — formalize SecretStorage 5-version stabilization pattern.
