# LLM Wiki Plugin Roadmap

> Feature planning and improvement proposals

**Latest shipped:** v1.29.0 MINOR (2026-10-26, 68 commits / 5040 tests). See [CHANGELOG.md §1.29.0](./CHANGELOG.md#1290---2026-10-26) for the canonical composition record. | **Updated:** 2026-10-26
**Next MINOR candidate:** **v1.30.0 MINOR**, opened 2026-10-26 with three items: **#895** (prompt customization, split out of #755 — held on a design question, see below), **#886** (the answer context's token ceiling), and **#781** (the M0 co-citation projection). #729 Phase 1 was v1.29.0's named head and **v1.29.0 shipped without it**; the ordering was **decided: direction A** — one measurement pass comes first, then M0. The measurement ran and narrowed the claim (CHANGELOG §1.29.0), and what it did NOT settle is the design question #781 implements, so #781 is the one item of the three still blocked on a decision rather than on code.

**Milestone move (2026-10-26).** `v1.29.0 MINOR`'s open items moved to the new `v1.30.0 MINOR`: #895 #886 #781 #729 #787 #822 #873 #880 #896 #677 #668 #664 #568. The `v1.28.x PATCH` line's five open items moved to the new `v1.29.x PATCH`: #792 #816 #825 #891 #882. A released milestone may not carry unstarted work, and both moves happen before the release so the milestone state matches what the tag contains.

**v1.29.0 shipped the read side of the retrieval rewrite.** The lexical stage now reads page bodies and scores title, alias, summary and body with BM25F (#837); the two-stage Rocchio expansion sits on top of it, with its claim narrowed by its own measurement (#855); Related pages are shaped so one hub cannot drag every page toward it (#841); and `legacyScorer` gives a reader whose results got worse a way back (#842). The correctness wave in the same release was quieter and just as load-bearing: the watcher honours Obsidian's excluded-files list (#879), the log header's command hint refreshes (#887), the legacy log-header cut no longer deletes the first entry (#889), and error normalization keys off the SDK's marker rather than class identity (#893) — that last one because a dependency bump had silently stopped `instanceof` matching across a duplicate copy.

**#895 is held on a design question, not on code.** The prompt-customization settings shipped with the English text in eight of eleven locales (fixed in #895's follow-up) and, more seriously, a requested section is stripped after generation and merges run without the requirement at all — both reported by @KvikullSigurdur and both independently reproduced here. The section list is plugin-owned, so the open question is whether `contentRequirements` may add sections or only shape the known ones. See the PR thread.

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

## v1.30.0 MINOR — Design track

**Opened 2026-09-16 for v1.29.0; the window was extended and renamed 2026-10-26 when v1.29.0 shipped.** Two mandates, per user direction. **Feature work and hardening run in the same window** — v1.28.0 is not a feature-only release. Design detail
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
`v1.30.0 MINOR` or `v1.29.x PATCH`; nothing here blocks v1.29.0, which shipped 2026-10-26.

**Milestone map (restructured 2026-10-26).** Four windows are open, and every open issue and PR is assigned to one of them.

| Milestone | What belongs in it |
|---|---|
| `v1.29.x PATCH` | Bug fixes, docs and engineering hygiene. No new features |
| `v1.30.0 MINOR` | New capabilities, and the #729 design track's head |
| `v1.27.0+ research` | Ideas with no committed version — experimental, or awaiting a design conversation |

**The per-milestone counts are deliberately not carried here.** This table held them until 2026-10-12, when they were found **wrong across all three rows** — the previous figures read 12 / 16 / 16 and `v1.29.0 MINOR` was five items high, because the move of #729's work into PRs (#781, #819) and the closure of #764 #752 #608 #687 by release had never been subtracted. Re-deriving them fixed that, and then they moved again inside the hour as four PRs and one issue arrived. **A number that changes hourly does not belong in a planning document; it belongs in a command.** Read them with `gh api "/repos/GD4AI/obsidian-llm-wiki/milestones?state=open" --jq '.[] | "\(.title): \(.open_issues)"'`.

The invariant that *is* carried: **nothing is unassigned.** On 2026-10-12 thirteen items had drifted in unassigned while this section claimed all three windows held everything. Checking the invariant is one command too, and it is the check that found the drift.

The restructure replaced two milestones that had outlived their names. **`v1.27.x PATCH`** still held 11 items under a title naming a window that closed with v1.27.2 on
2026-09-15. Its 10 PATCH-scale items moved to `v1.28.x PATCH`. #568 (an `enhancement`, not a fix) moved to `v1.29.0 MINOR`. **`v1.27.0 MINOR`** was empty and
released, so it was closed. Both rules came from one place: *a released milestone may not carry unstarted work*. That rule is the reason `v1.28.0 MINOR` was emptied
before its own release, and the reason the 2026-10-26 move emptied `v1.29.0 MINOR` and `v1.28.x PATCH` before v1.29.0 shipped.

| # | What it is | Why it is waiting | Recommendation |
|---|---|---|---|
| **#729** | Cross-source relations — the design record is **proposed**, and @DocTpoint's objection is unresolved | **The ordering itself is contested**: the measured loss is at the reader's *lexical seed stage*, and a denser graph cannot repair a wrong seed. The three directions are set out in §"#729 — the three directions" below | **A — chosen 2026-10-05**; the objection was answered 2026-10-28 and @DocTpoint is reviewing it |
| **#781** | #729 Phase 1 (the co-citation projection) | **Held** — it implements a design that is not settled. The tie-break defect it carries is located (`ppr-cascade.ts:146`, `:348`, `:581` sort by score alone), and the "A" concentration is still unexplained | Do not merge until #729 concludes |
| **#755** | Extraction focus and content-requirement settings, from @weqoocu | Split: the prompt-customisation half shipped as **#895** (green, awaiting review); the `wikiTopics` picker is **#896** and the merge path is **#902** | Merge #895 first; #896 and #902 are small once it lands |
| **#787** | Let source notes opt out of the source-lemma guarantee | The guarantee assumes a note's filename is a subject; true for `Klotho.md`, false for a meeting note. `decideSourceLemma` is a pure function, so the opt-out is one setting plus one union member | **Accepted** — answered 2026-10-28; implement |
| **#785** | "Full Reindex" request | Two requests bundled: re-extract with current settings (accepted) and "clear everything" (declined — no undo, and a partial failure leaves nothing) | Implement the re-extract half; keep the clear-out half declined |

**Not waiting on a decision, just unstarted:** **#914**, **#907** (part B), **#567**, **#468**, **#668**, **#664**, **#677**, **#890**.

**Waiting on someone else, not on a decision:** **#793** — the `good first issue` label came off on 2026-10-04, and the work remains documentation. The ten translated READMEs quote English command names, and the command name
is stored twice per locale. A verification pass on 2026-10-04 corrected its own table. `README_RU.md` and `README_ZH-Hant.md` are already clean, so the count is 7 files
rather than 10. `README_RU.md` is the better reference, because it already quotes translated names.
**Shipped, and where that record lives:** [CHANGELOG.md](./CHANGELOG.md). A "resolved since this queue was written" list used to sit here. It was removed on 2026-10-12: it had been frozen at 2026-10-03, and a frozen resolve list reads as current state long after it stops being true. The per-version composition record is canonical in CHANGELOG, and a second copy here is a second place to be wrong.

### The next-work order — 2026-10-29, re-ranked by ROI

The rule is [MEMORY.md §"Work lists — the ROI rule"](./MEMORY.md#work-lists--the-roi-rule-tier-tables-archived): **ROI = (impact × certainty) / effort.** A high-impact item with unknown reproduction cost ranks below a medium-impact one that is measured, because the second actually ships.

Tier 0 is work that is already done and waiting for a merge decision, so its effort is zero and its impact is known.

| Tier | Item | Impact | Certainty | Effort | Why here |
|---|---|---|---|---|---|
| **0** | **#917** (PR) — the gateway that answers a non-streaming request with an event stream | The reporter's connection test works; the error message stops being 725 characters of raw body | High — reproduced character for character against the SDK the plugin ships | Done | Awaiting @DocTpoint's review |
| **0** | **#886** (PR) — the answer context's token ceiling | 27 of 30 answers exceeded an 8k window while the budget read "20 of 20" | High — measured on the production path | Done | Green, awaiting review |
| **0** | **#895** (PR) — extraction focus and content requirements | Two prompt-level settings; unblocks #896 and #902 | High | Done | Green, awaiting review |
| **0** | **#882** (PR) — the follow-up rate on the user's own conversations | The number a design decision was made without | Medium-high | Done | Green, awaiting review |
| **1** | **#914** — a Query Wiki LLM failure before the answer phase is silent | Any 400/429/500 before the answer renders as nothing at all, and the pane then refuses every later query | High — the cause is located at `QueryView-class.ts:545` (outside the `try` at `:577`) and the two call sites at `:301`/`:332` are `void` with no rejection handler | **Done** — PR #919 | The issue's premise was corrected while fixing it: the retrieval-path LLM calls have their own `catch`, so what reached the throw site is a vault-read failure |
| **1** | **#907 criterion 6** — make `bundle-size.test.ts` measure the artifact that ships | The released `main.js` is built from the npm tree while every gate runs on the pnpm tree, and they differ by 6,388 bytes on v1.29.0 | High | Medium | **Option B is rejected and #907 records why:** the store scanner rebuilds with `npm ci`, so `package-lock.json` cannot go. PR #920 installs the test that every pin is applied by the npm tree. The remaining step is a CI job that builds from `package-lock.json` |
| **1** | **#567** — raising `customEntityLimit`/`customConceptLimit` reduces extraction | A user turns a limit up and gets less out | High — @DocTpoint endorsed the ceiling-only reading and measured it | **Tiny** | Answered 2026-10-28; only the code is missing |
| **2** | **#891** — align the four AI SDK packages so one provider-utils copy is bundled | `instanceof` across copies silently disabled the whole error normalisation once already (#892) | High | Medium-high | Bigger than #914 and the same family of defect |
| **2** | **#915** — math in answers does not render | Anyone reading a paper hits it; the same renderer serves generated pages | High | Medium | Needs a normaliser plus one prompt line |
| **2** | **#677** — a classification move makes untouched notes read as edited | Data-integrity perception on the write path | Medium | Medium | Read before scheduling |
| **3** | **#910** — does an exact value survive ingest? | Unknown | — | Medium | The maintainer does not require an ingest change, so the measurement's decision value is zero today; keep it open and re-run when someone asks why a value is missing |
| **3** | **#912** — the three #904 leftovers | The OpenAI reasoning path, a cross-call ceiling cache, `disableThinking` under a forced-thinking model | High | Medium, three items | Independent of each other |
| **3** | **#873** — user-defined page types and folder layout | A MAJOR trigger under the version rule | High | Large | Design first; it is the trigger-1 shape |
| **4** | **#468** — Anthropic `createMessageStream` lacks `cacheBreakpoint` parity | **Zero today.** The plumbing is one call, but no caller sets a breakpoint on the stream path, and the query path's system prompt carries page bodies that change every query, so a cache would miss every time | High | Tiny | It needs a design decision — what the cacheable prefix is — not code |
| **4** | #112 #142 #168 #184 #220 #285 #295 #326 #330 #358 #479 #480 #791 #787 #816 #822 #911 #91 | Community requests and research threads | Varies | Varies | Answered where a decision was owed; the rest wait on a design conversation |

**Two open questions the maintainer has not answered yet, and both are recorded on their own issues:** #908's acceptance criterion 5 says the base prompt "must not hardcode English section headings", while the shipped code names the native heading first and the English one as a fallback for a vault whose pages were written before a language switch. The criterion's premise was that the prompt is localised; it is not — it is English with a `Respond in {language}` directive — so the criterion is what needs rewording, not the code. And #916's report is now answered on the issue, with the gateway-side defects named as the gateway's.

### ROI order — the lint-fix correctness family (2026-10-12) — shipped 2026-10-22

Six reports from @konstantinopolka against plugin 1.28.0 on ~1,000-page vaults, plus #676, which the same family produced. **All of it shipped as PR #864** (merged `3136bfb35e`; 23 files, 348 test files, 4839 tests): #826, #824 and #827 closed by it, #825's stale half fixed with its frontmatter clause left open. The ROI table, the batch plan, and what executing it taught are in the PR thread and in [MEMORY §"Lessons learned"](./MEMORY.md#lessons-learned-from-session-memory); the user-facing entries are in the CHANGELOG. What is left is small, and it is here:

| Left | What | Where it belongs |
|---|---|---|
| `deleteFile`'s return type | `void` where `boolean` would let the caller know the page went | its own change — every caller and every mock follows it |
| The `merged` count | it still increments for a pair whose source was kept, and it reaches the user through `t.lintMergeComplete`, so the count can exceed the pages actually merged | **#835**, with #825's frontmatter clause — correcting it needs a structured outcome from `mergeDuplicatePages` rather than a match on the message text, and the match on the message text is the fragile coupling this whole family is about |
| #827's declined clause | a name appearing only inside a quote is not treated as fiction, because `"[[X]]"` is a real link in Obsidian | on the record, not on the roadmap |

**The idempotency requirement is worth naming separately because it is not a detail of #825.** Keeping a source makes the merge re-entrant, so the fallback append had to become a containment check on `## From <title>` in the same change. A fix that keeps a page and then re-merges it on every run trades one silent deletion for slow unbounded growth — both failures of the same kind.

**Status 2026-10-17: three of the four shipped on `fix/lint-dead-link-family`, and #827 waits on a decision.** #826, #824 and #825 each landed as their own commit with their own RED test and their own Gate 1. Four things came out of executing the plan rather than reading it — the plan's row for #823 was already merged in #833 and was not available work; the row for #826 described the fix rather than the defect (`normalizeLLMPath` ran after the filter, so the two paths were never compared); the row for #824 named a cause that was not the cause (the duplicate comes from `link_text` already ending with the link, not from the substring rule); and forcing `stale > 0` in a test takes the recorded **position**, not the `original` text, because the replacement is computed by substituting into `original` and a corrupted `original` makes it a no-op. The lessons are in MEMORY and the detail is in the PR thread.

**One residual from seq 4 is deliberately left visible.** `runDuplicateMerges` still increments `merged` for a pair whose source was kept, and `merged` reaches the user through `t.lintMergeComplete`, so the count can exceed the number of pages actually merged. Correcting it needs a structured outcome from `mergeDuplicatePages` rather than a match on the message text — the same fragile coupling as the sentinel. File it with #825's frontmatter half under the `#835` decision rather than patching the string.

**Status 2026-10-18: the review found one blocking point in #824, and it was mine.** The review probed the case where the model's guess names a *different page that exists*. The old code kept the guess, because the resolver it asked was "does this target name some page?" — not "does this target name the orphan?". The orphan gained no inbound link, the run reported that it had linked it, and the next lint reported the orphan again: the loop #824 describes, with a success message on top. The fix is to stop asking the wrong question: the link's purpose is to make the orphan reachable, so the target is the orphan by definition, and the resolver is deleted with it. The duplicate check moved from string comparison to **target identity**, because a page linked under a different label is the same page, and the label is presentation. Two remarks from the same review were answered rather than coded, and both are on the record in the PR thread: **#825's write order** is kept deliberately (reordering would make links point at a target that still holds its pre-merge content, so a failed write would leave the answer behind the merge), and **#827's unstored decision** is not persisted, because persisting it changes what the next run is allowed to do.

**Status: all four shipped, plus five follow-ups the plan did not name — PR #864, nine commits, CI Gate 1 green.** The paragraph above says #827 "waits on a decision" and that was true when written; the decision was made and the row was wrong. What executing the rest of it changed:

- **Seq 3's row named a fix that was rejected, and the real defect is one layer below the fixer.** "Three rules: generic word, code identifier, inline-code-or-quote-only" is an English word list of about 70 entries, and the project ships 11 locales — so the rule would silently disable in 10 of them. Replaced by the model deciding (`action=leave` in `prompts/fixes.ts`), because "is this name real" is a question about meaning (`Osteopontin`, `LinkedIn` are real; `Name` is not) and a spelling list cannot answer it. The deeper finding: `scanDeadLinks` and `scanOrphans` ran their link regex over **raw page text**, so a `[[link]]` inside inline code or a fenced block was reported dead and the fixer then created a page for `Name` or `MyFile`. The reporter's placeholder pages came mostly from example text. Both scanners now mask code regions (`maskCodeRegions`). **Quotation is deliberately not masked** — `"[[X]]"` is a real link in Obsidian, and a test asserts that boundary rather than leaving it to be rediscovered. A rejected-approach note: I first declined an inline-code rule because it "needs a new position contract between scanner and fixer". False — masking needs only the page's text, and that wrong call bought two patches at the wrong layer.
- **Seq 1 needed identity, not string equality.** "Two guards, and one already exists one layer down" understated it. Measured by calling the production function: a string compare catches the literally repeated path and the missing `wiki/` prefix, and lets **six** spellings through — `./`, a doubled slash, a dropped `.md`, and Unicode NFC/NFD in both directions. NFC/NFD is the dangerous one, and the reason is an asymmetry: `tryReadFile` (`wiki-engine.ts:2209`) normalises the path and scans directories while `deleteFile` (`:2178`) uses an exact key, so one spelling reads the page and the other deletes it. `canonicalPagePath` folds all six; `mergeDuplicatePages` refuses on a match and `runDuplicateMerges` drops those pairs before they arrive.
- **A defect the plan could not have seen: the log could say `merged` with the source still on disk.** The same asymmetry, opposite direction. `mergeDuplicatePages` now reads the source back and says so when it survived. `deleteFile` returning `boolean` is the better shape and is a separate change, because every caller and every mock would have to follow it.
- **Two test doubles were more forgiving than production, which is why both defects stayed hidden.** `createMergeCtx`'s `deleteFile` recorded a delete without performing one — the read-back check above was unwritable until that was fixed. And `link-vault.ts` already skipped fenced links, which is why the link-retarget tests never surfaced the scanner bug. **A lenient double hides exactly the defect you are looking for.**

**What is still open, in the order it should be taken.** Three of the four rows now meet the issue's own acceptance criteria and say `Closes`; #824's target is rebuilt from the orphan's own path rather than skipped, #827's stub pages no longer return as findings, and #826 compares identity. **#827 has one clause declined on the record** — a name appearing only inside a quote is not treated as fiction, because `"[[X]]"` is a real link in Obsidian. #825 stays `Refs`, because its frontmatter clause reopens #386. Left: `deleteFile`'s return type (`boolean` rather than `void`), and the `merged` count that still increments for a kept-source pair — the latter stays filed under `#835`, per the residual note above, because it needs a structured outcome rather than a match on the message text.

The **idempotency** requirement is worth naming separately because it is not a detail of #825: keeping a source makes the merge re-entrant, so the fallback append had to become a containment check on `## From <title>` in the same change. A fix that keeps a page and then re-merges it on every run trades one silent deletion for slow unbounded growth — both failures of the same kind.

**The dependency decisions in the same window.** Three, and each now has an outcome.

`@typescript-eslint`: PR **#821** took only the parser to 8.71.1 — dependabot's normal one-dependency shape — which left the parser and the plugin, both direct devDependencies, from different versions. **Resolved by #834**, which moves the pair together. Measured while doing it: **the pair bump does not remove the second copy of `@typescript-eslint/types`**, because `eslint-plugin-obsidianmd@0.4.2` pins its own `typescript-eslint` chain at 8.59.1 and the meta-package pins its sub-packages exactly. `pnpm dedupe` does not collapse them and was reverted: it converged nothing on that set while moving `picomatch`, `fdir`, `tinyglobby` and `ignore`. Collapsing the two belongs to the release-time Bot-alignment step, which already raises `eslint-plugin-obsidianmd` to its latest for this reason.

`ai` (**#831**) and `@ai-sdk/openai` (**#830**): both production dependencies, both **held**, and they must be taken together. **#828 exists because of `ai@7.0.x`'s types** — `finalStep` is present at runtime and absent from the declared type, which is why `origin/main` stopped compiling at `f41a39d0` and twelve call sites failed at once. An `ai` patch bump inside the same minor can move that type, so the pair needs `tsc --noEmit` and Gate 1 re-run after it lands, plus a wire-shape check on the OpenAI request body. Merging either one first would leave #828's fix unverified against the version actually installed.

**#816** claims dependabot now ignores TypeScript 6.x, and `.github/dependabot.yml` carries no such entry — confirm or add it, or the bot reopens the same PR.

### The next-work order — 2026-10-16, re-ranked

**Superseded 2026-10-29** by [the ROI order below](#the-next-work-order--2026-10-29-re-ranked-by-ROI). This section keeps the record of what that sweep decided, because two of its rows were decided on a measurement and are still load-bearing. The heading keeps its original text deliberately: the 2026-10-17 status was first written into it, and that broke the anchor MEMORY links to — twice in one day, because a second rename followed. **A heading that another document links to is an address; status belongs in the body.**

A full sweep of ROADMAP, MEMORY, the code, 37 open issues, 6 open PRs and 3 milestones produced this order. The maintainer's call on 2026-10-16 was to run the routine items before the lint-fix batch, so the batch is no longer first despite carrying the highest correctness ROI in the repo.

**Closed by that sweep, and now shipped:** #830 + #831 were superseded by #859 (`fded549f`) — neither was mergeable as it stood, both also downgraded `@typescript-eslint/*` from 8.71.1 to 8.59.1, a type-compatible revert of #834 that Gate 1 would not have caught; #816's claim was false so #860 (`2ff5eb40`) added the entry and the issue stays open because the migration itself is 31 errors across 14 files; the CHANGELOG was backfilled by #862 (`8934c8f9`), because `v1.28.0`'s release was 37 PRs behind and the file is what release notes are cut from; #503 was implemented by #519 (`3928eed2`); the dead `listModels()` went with #878 (`0d80ffb7`), and `CODEX_MODELS` survives because `openai-codex-model-policy.ts:22` still consumes it; and #781's residual sites went with #878 (`83b8f73f`) — four sites, not three.

| Rank | Work | Why here | Cost |
|---|---|---|---|
| 1 | **#755** rebase and scope | @weqoocu's two prompt-level settings are CONFLICTING, and need a rebase plus one decision: whether the prompt should carry them at all | Needs the contributor |
| 3 | **The real-question benchmark** | The largest evidence gap in the project. 20–30 real questions with hand-labelled answer pages, in a fixture that is synthetic and runs by default | Medium |
| 4 | **The lint-fix batch**, per the plan above | The highest correctness ROI of anything here — #826 alone is silent data loss — sequenced after the routine items by the maintainer's call | One PR, four commits |
| 6 | **The E1 escalation gate** | A decision, not a fix. It needs the `coverage` and `lexCount` distributions before anyone can choose | Diagnosis, then a call |

**The token ceiling was measured, and the number that matters is the after-state.** On the two vaults that describe the current write path, answers over an 8k window went from 9/30 to **0/30** (test8) and 27/30 to **0/30** (test10), with p50 falling 7,067 → 5,332 and 11,015 → 5,873. The third vault on disk was written by an earlier release and is deliberately not quoted as evidence.

**Withdrawn: the write-side `source:` marker work.** The production vault's 25.1 % marker coverage was reported as a write-side defect, and work was queued against it. It is the age of that corpus. `test10` is the control: regenerated through the same production `IndexGenerator` it reaches 96.6 %, and its only 12 unmarked pages are its 12 `sources/` notes, which cannot link to themselves. `test8` reaches 85.5 %, and its 17 non-source gaps are pages whose `sources:` frontmatter points at an entity or concept page rather than a source note — `parseSourceSlug` reads `[[sources/<slug>]]`, so there is no slug to derive and declining is correct. The production vault's pages were written by an older release that never recorded that link. **"Unmarked" has three causes and only one is a defect, and that one only occurs in a corpus the current plugin did not write.**

**Reclassified: #781 is held, not rejected.** It was called "denied by measurement". That was wrong, and it was wrong in the expensive direction — closing it would have discarded unfinished work on the strength of a claim nobody checked. #729 chose direction A on 2026-10-05 on the terms "M0 proceeds, with one measurement in front of it. #781 stays held **until that measurement lands**" — and **that measurement has never run.** DocTpoint's `CHANGES_REQUESTED` says so in his own words: "I am marking this as 'Request changes' so that it does not merge before #729 has an answer. This is a statement about the order of the steps, not about your code."

All four of its prerequisites are now in (**#878**), and their reachability is not uniform — @DocTpoint checked, and the correction matters because "a fix that fixes nothing" is worse than no fix.

The query path was seeded first (`ppr-cascade.ts:539` → `seededRngFrom(query, seeds)`) and its BM25F sort broke ties by breadth and then by path (`:184`). #878 closed the rest:

- **`hub-link-distinctiveness.ts` — live.** The lint scan runs it, and its PPR reached `Math.random` through `options.pprOptions ?? {}`. The distinctiveness is what the recommendation to strip a link is built from, so the number moved on every run.
- **`hub-detection.ts` — guarded but unreachable in production.** `detectHubs` runs PPR only when `options.pprSeed` is set, and its one production caller (`scanHubLinkDensity`) passes `minInDegree` and `pprOptions` but no seed — so the hub's `pprScore` is never computed in production and that `Math.random` path was never taken. The guard is still right for the function's other callers; it is not a live defect.
- **`ppr-cascade.ts` (`lexMatch`) — live.** The order decides the seed list (`lex.slice(0, 3)`), the score (`lexScoreOf` reads the position) and the rank (`mergeWithPPR` sets `rank: i + 1`).
- **`index-search.ts` (`localKeywordMatch`) — guarded, and it changes no production behaviour.** Its only caller, `selectCandidateWindow`, turns the result into a `Map` from path to score, so the order is dropped; it then sorts by its own combined score with ties in the caller's pool order, and **that pool order is a documented contract** (ctime-ascending, for the dedup prompt's KV-prefix cache — a path-ascending change was tried and reverted on 2026-10-07). The function is now deterministic on its own; the window's order is not, and deliberately so.

**The remaining objection to #781 is not unexplained — the mechanism is on #781's branch, not on `main`, so a search in `main` finds nothing.** `coCitationCandidates` (`src/core/co-citation.ts`) ranks by the raw count of shared targets and breaks ties by path, and on @DocTpoint's rebuild 80 % of the cuts fall inside a tie — so the path's alphabet decides the cut. That is the "A" skew (9.1 % of pages, 17.1 % of chosen entries). The roadmap said "no mechanism in the tree accounts for it", which was true of `main` and false of the branch; it now names the code.

**And a path tie-break makes an order deterministic, not neutral.** Wherever a tie survives the breadth check, the alphabet decides. For `lexMatch`, with its small integer scores, how often that happens has not been measured.

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
| Conversation in the retrieval query | 16-33x r@10 on follow-ups | zero | **inside #855** — the `fix/retrieval-sees-history` branch no longer exists; the claim is **not yet reconciled** with the harness's numbers, so it is not evidence either way |
| Two-stage Rocchio expansion | +0.04 / +0.05 r@10 | two lexical passes | #855, one review point left — see below |

**#855 is one review point from done, and that point is a measurement, not a patch.** The three blocking points from @DocTpoint's review at `9102c478` are fixed — the expanded query no longer goes to the LLM stages as the user's question, the per-query term-table rebuild is gone, and the measurement now lives in `tools/dev-instrument/run-expansion-eval.mjs` and runs through the production path. What remains is the history in the ranking, and the fourth review (2026-10-21) settled **which arm is the baseline**: on `main` the retrieval query is the question alone, so `none` — not `concat` — stands for what ships today. Against `none` the weighted arm is **worse** on topic-switch (MRR 0.615 → 0.550) and better on follow-up MRR (0.121 → 0.248, hit@1 zero in both arms).

**The maintainer chose the measurement over the decision (2026-10-22), and the measurement has now answered it: the history stays.** The steps were to extend the harness to report r@10, to run a derived follow-up set, to re-measure against `none` — the only baseline that means anything, because on `main` `selectPprSeeds(userMessage, …)` takes the question alone — and to reconcile the 16-33x claim on the same instrument. The first three are done; the numbers are below, and the fourth is a restatement of the claim, not a reconciliation. The rule the measurement had to follow was written down before it ran: if the history cannot beat `none` on both families, **remove the history half from the PR** — `buildWeightedRetrievalQuery`, `buildRetrievalQuery`, the history branch of `prepareRetrievalInputs` and the `history: N rounds (weight 0.3)` label line — because with the history out they are unreachable and the dead-code policy forbids shipping them; flipping a flag to zero and keeping them is shipping dead code. It can, so nothing is removed.

Two shapes of fix, neither cheap. **A** carries `WeightedTerm[]` to the ranking path and has it consume `segment()`'s output instead of re-tokenizing a string; that needs the two segmenters reconciled, because `segment` (`term-index.ts:60`) and `tokenizeQuery` (`ppr-cascade.ts:328`) are separate implementations. **B** keeps the ranking query to the current question's terms plus the expansion's additions, so the history drives the expansion and the term selection and never enters the ranking query — the topic-switch case then holds by construction, but the history's missing words would reach the ranking only through the expansion, which is a different promise from the one `buildWeightedRetrievalQuery`'s docstring makes.

**The code-level finding, and the correction.** The weight cannot reach the ranking *as a weight*: `twoStageExpand` flattens the weighted terms to strings, and the only way a flat string expresses a weight is repetition, which both ends delete — `bm25fScore` counts "a repeated query term … once (the query is a set of terms, not a bag)" and `tokenizeQuery` collects into a `Set`. But the weight still reaches the ranking **indirectly**, by changing which terms the expansion adds. I had written, and posted on the PR, that the weighting "has no effect on the ranking at all". The harness corrected that: the effect is real, its route is not the one the parameter owns, and that is why nobody could say which part of it was responsible for a number.

**The measurement, on the 2,141-page production vault** (`tools/dev-instrument/run-conversation-eval.mjs`, three arms through `planRetrieval` + `selectPprSeeds`; r@10 added, and the follow-up family split into its two populations because a limit applied to the family alone sampled the derived list and left one hand-written case):

| family | arm | MRR | hit@1 | r@10 | not in list |
|---|---|---|---|---|---|
| topic-switch (n=30, derived) | none | **0.615** | **0.400** | **1.000** | 0 |
| | concat | 0.205 | 0.100 | 0.367 | 13 |
| | weighted | 0.550 | 0.333 | 0.967 | 1 |
| follow-up (n=6, hand-written) | none | 0.121 | 0.000 | 0.333 | 3 |
| | concat | **0.650** | **0.500** | **0.833** | 0 |
| | weighted | 0.248 | 0.000 | 0.667 | 0 |
| follow-up (n=30, derived) | none | 0.000 | 0.000 | 0.000 | 30 |
| | concat | **0.622** | **0.400** | **1.000** | 0 |
| | weighted | 0.599 | 0.400 | **1.000** | 0 |

**The answer: the history stays, and the weighted form is the right one.** Without the history in the ranking query the derived follow-up family is not merely worse — it is **unanswerable**: r@10 0.000, all 30 misses, the expected page absent from the list in every case. The hand-written family drops to r@10 0.333 with hit@1 0.000. The history's cost on topic-switch is 0.065 MRR and one case in 30 falling out of the top 10. The trade is **3.3 % of the topic-switch r@10 against 33-100 % of the follow-up r@10** — a bad deal only if fewer than one query in ten is a follow-up.

**The weighted form beats the concatenated one.** `concat` is the better arm on the hand-written follow-ups (MRR 0.650 vs 0.248) and the far worse one on topic-switch (0.205 vs 0.550). Weighted costs 0.065 MRR on topic-switch and gains 0.127 (hand-written) and 0.599 (derived) on the follow-ups, so its break-even mix is 34 % and 10 % follow-ups; concatenated's are 44 % and 45 %. The lower break-even wins, and the branch already ships the weighted form.

**The coverage gate is refuted, and that closes the design question.** The design this section pointed at was a gate on the question's own name-tier coverage: when the question covers enough on its own the history stays out, when it covers nothing the history carries it. The harness computes that statistic with the production functions, and it does **not** separate the families. The derived questions score coverage 0.000 across all 30 cases and the topic-switch questions 1.000 across all 30 — but the six **hand-written** follow-ups score 1.000, 0.000, 1.000, 1.000, 0.730, 0.482, median 1.000. The statistic measures the question's *aspect* word ("显存", "残差连接"), not whether the question names its topic: "它的显存需求呢？" matches some other page's name tier perfectly and is still an anaphora. A gate on that number would exclude the history for exactly the cases that need it, and the hand-written family's r@10 would fall from 0.667 to 0.333.

**One cost the harness cannot see, and it points the same way.** The harness passes no LLM client, so it measures the lexical and PPR path only. The third shape also empties the **gate** query, and the gate is what decides whether a query escalates to the paid LLM stage. A follow-up's question names nothing, so gating on the question alone escalates every one — which is why `select-seeds.ts` deliberately keeps the history in the gate query ("a follow-up carries no content words, so gating on the question alone would escalate every one"). The third shape is worse than the table shows.

**What is still open, and what is not.** The 16-33x r@10 claim in this file is about the **expansion's** effect, measured by `run-expansion-eval.mjs` on synthetic corpora; the numbers above are about the **history's** effect, measured by another tool on the production vault. Different intervention, so not reconciled — and the claim should be restated as a claim about the expansion. The history's own effect is measured now, and it is large.

**The harness is the reusable part and it landed first.** `tools/dev-instrument/run-conversation-eval.mjs` runs the three arms through the production pipeline, derives the topic-switch cases and the derived follow-up cases from the vault's own pages, and keeps the hand-written follow-ups in `tools/dev-instrument/conversation-cases.json` (anaphora is not derivable from a link graph). The two caveats it carries: the topic-switch question is the page's own title, so it is a controlled displacement rather than a natural utterance; and the derived follow-up question is a bare anaphora with no aspect word, so it is a lower bound on the realistic shape rather than the realistic shape itself.

>**Next measurements, in order.**

1. `maxFuse` of lexical and PPR scores WORSE than PPR alone on both vaults (0.850 vs 0.923 test8, 0.826 vs 0.926 test10). The fusion is diluting the graph channel and it deserves its own pass before any more weight goes on the lexical side. Note that the eval set builds its questions from `a -> b` links and PPR walks those links, so this number needs `--exclude-asker` before it means anything (#854).
2. The full layered-eval re-run on 390 / 994 questions for the two-stage expansion, through the production path, after the review fixes land.

**Query surface polish, recorded on #756.** Inline citation links are too loud (smaller than body, quieter than the final reference list, underline kept). 清空历史 empties the view and leaves `data.json` alone — the button says "forget" and does "hide". The composer should default to three lines and grow with the content.

**What is NOT on this track and why.** Embeddings: the encoder's notion of similarity is the training corpus's, so it pulls a vault that deliberately goes beyond consensus back toward it. M2 (model-proposed edges): same reason, and the resolver checks that a page exists, not that a relation holds. Corpus-local co-occurrence expansion, anchor text, reverse links, co-citation projection: each measured and flat or negative on the strict layer. LLM query expansion for the cross-source gap: 0 % rescue measured over 1,180 questions. LLM reranking of the top-10: identical to baseline.

### Query view surface — shipped 2026-10-16, follow-ups open

#857 merged five items from #756: the composer grows with the content (`field-sizing: content`, one line of CSS), inline citations in academic form (`[N]` at the point of use, `[N] Display - description` in the bibliography), the bibliography stays clickable, "clear history" clears `lastOfferedQueryHash` too, and the retrieval label names the pipeline that actually ran (`⚡ BM25F+PPR · 📚 N sources`).

Three bugs on that path are recorded in MEMORY because each looked like a formatting issue and was a logic one. The rule they add: read the prompt before writing the matcher. The reference-list detection broke because it matched a fixed set of heading names and the model writes whatever the prompt asks in the language the answer is in.

### Retrieval-channel measurements — measured 2026-10-16

**Lexical channel: the `legacyScorer` setting, legacy vs BM25F.** This is a real production switch, not two functions a tool invented: `select-seeds.ts` passes `settings.legacyScorer` into `lexMatchByTitleAndAliases(query, pages, { scorer })`, which is the same setting a user flips in Advanced settings. `tools/dev-instrument/run-retrieval-ab.mjs` measures both arms twice — the Stage-1 ranking the seeds are cut from, and the whole pipeline end to end through `selectPprSeeds` — because a better Stage-1 ranking only counts if the walk carries it.

r@10, budget 20, `--exclude-asker`, questions built from the production graph's own edges. **BM25F wins on five vaults out of five, at both stages.**

| Vault | Pages | Questions | Stage 1 legacy | Stage 1 BM25F | End-to-end legacy | End-to-end BM25F |
|---|---|---|---|---|---|---|
| `sample-50page` | 53 | 154 | 0.032 | 0.325 | 0.468 | 0.578 |
| `expA-main/wiki` | 161 | 748 | 0.008 | 0.330 | 0.433 | 0.578 |
| `expB-branch/wiki` | 171 | 819 | 0.006 | 0.288 | 0.376 | 0.545 |
| `test8` | 172 | 688 | 0.025 | 0.369 | 0.548 | 0.674 |
| `test10` | 354 | 1,572 | 0.003 | 0.300 | 0.345 | 0.508 |

**How to read the two columns, because the gap shrinks and that is the finding.** At Stage 1 the legacy scorer lands the truth in the top-5 seeds between 0.3 % and 3.2 % of the time — it almost never seeds the right page. End to end the gap is +0.110 to +0.169, not +0.28 to +0.34, because `pprCascade` derives its own implicit lexical seeds and can walk to the truth regardless of what Stage 1 handed it. So the setting matters, and it matters less than the Stage-1 number implies. The legacy arm is a degraded path, not a broken one.

**The CROSS layer is empty on all five vaults, and that is a production fact, not a missing run.** `cross` compares source slugs, and a slug reaches `PageRef` only from an index line's `` `source:` `` marker. No `index.md` in any of these vaults carries one, so production sees `sourceSlug === undefined` on every page and `assembleWithCoverage`'s source-diversity signal has nothing to act on. The cross-source layer — the one the plugin exists to serve — is **not measurable on these corpora and not active in production on them.** Anything quoted as a CROSS figure for these vaults is `n=0`; the older expansion figures came from a loader that read `sources:` out of file frontmatter instead, which is not the path `read-index.ts` takes.

**The previous run of this measurement is void and its numbers are withdrawn.** The tool called `lexMatch(query, pages, tables)`; `lexMatch` takes two parameters, so the corpus argument was discarded and both arms ran the same code. The four vaults agreed to three decimals, which read as a null result and was actually a broken tool. Same for the "fusion" arm: its PPR-alone baseline was a score the tool made up. The earlier claim of "+0.065 to +0.105 across four vaults" has no traceable provenance and is not repeated here.

**Fusion: not a decision this project currently has.** `pprCascade` calls `maxFuse` on its lex and ppr channels and then `assembleWithCoverage`. No setting turns that off. "Is the lex channel earning its place inside `pprCascade`?" is a fair question, but answering it needs a seam in `pprCascade` plus its own test and review — not a flag, and not a fabricated baseline. Until that seam exists the tool reports the question rather than a number.

### The answer-path scorer and the cross-source layer — measured 2026-10-16

Both records moved to [MEMORY §"Measurement record — the query side, 2026-10-16"](./MEMORY.md#measurement-record--the-query-side-2026-10-16) with the tables and the corrections. The verdicts stay here.

**The answer-path scorer ships.** `pprCascade` called `lexMatch(query, pages)` with no tables, so the BM25F branch had no production caller and the hand-tuned weight table scored every answer. `PPRCascadeOptions.tables` carries them now. Measured after the segmentation fix, not before: @DocTpoint measured the BM25F branch returning **no page at all** for 深度学习 while the weight table returned the right one, so wiring it earlier would have been a regression on exactly the vaults this plugin is used on. The gain is small and positive on both Chinese vaults — +0.013 to +0.033 r@20.

**The cross-source layer is barely measurable on the production vault.** Only 537 of its 2,141 pages carry a `source:` marker (25.1 %), and a true cross-source pair needs two pages from different sources, so only 15 questions in a 400-question sample qualify. The expansion's gain on the test corpora is +0.055 to +0.146 on the CROSS subset, and the production vault's CROSS rows are 0.000 in both arms — not measurable. The strict rule is `a.sourceSlug !== undefined && b.sourceSlug !== undefined && a.sourceSlug !== b.sourceSlug`; the loose rule counted unmarked pages as a different source and produced a 20x error in the other direction. The expansion ships on the ALL numbers (+0.078 to +0.130 on the corpora, +0.030 on the production vault's 400-question sample), and the cross-source question stays open under the issue that owns it.

### The expansion's own verdict — measured 2026-10-16

**This is the first valid measurement the expansion has ever had.** The shipped path fed it an uncut Chinese run, so it returned its input verbatim and every figure attached to it in this PR described an input the plugin does not produce. After the segmentation fix it runs for the first time.

`run-expansion-eval.mjs` runs both arms through `planRetrieval` and `selectPprSeeds`: arm A is `expand: false` — the product minus one step — and arm B is the product. r@10, budget 20, `--exclude-asker`, questions built from the production graph's own edges.

| Vault | Pages | Questions | No expansion | Expansion | delta |
|---|---|---|---|---|---|
| `expA-main/wiki` | 161 | 748 | 0.572 | 0.650 | **+0.078** |
| `expB-branch/wiki` | 171 | 819 | 0.535 | 0.620 | **+0.085** |
| `test8` | 172 | 688 | 0.645 | 0.731 | **+0.086** |
| `sample-50page` | 53 | 154 | 0.526 | 0.656 | **+0.130** |

Positive on four vaults of four, including both Chinese vaults the earlier void figures came from. The tool self-checks and reports **20.0 words added per query, minimum 20.0, zero no-ops** — so this is the mechanism and not the baseline measured twice.

**The deltas land near the old numbers, which is a coincidence and must not be read as confirmation.** The old +0.070 and +0.089 were on an input production never produces, and their baseline was 0.180 on test8 where this run's no-expansion arm reads 0.645 — the baseline moved because it is now `selectPprSeeds`'s real output instead of a hand-written ranking. Same magnitude, different quantity.

**CROSS is `n/a` on all four, not `0.000`.** No index carries a `` `source:` `` marker, so the cross-source layer has no questions here. **And that is a stale index, not a missing capability** — I said otherwise in the PR first and it was wrong. `index-generator.ts` writes the marker (`sourceStr` from `parseSourceSlug`, which reads `[[sources/<slug>]]` out of frontmatter) and all 129 of test8's concept pages carry that frontmatter across 10 distinct sources. Its `index.md` was generated before that wiring. So the cross-source gap this expansion targets is **measurable today by regenerating an index**, and until it is measured the ALL-layer gain above carries a real risk: a cross-source regression could sit hidden inside a positive overall number.

### The cross-source layer — measured 2026-10-16

The record, the tables and the two corrections are in [MEMORY §"Measurement record — the query side, 2026-10-16"](./MEMORY.md#measurement-record--the-query-side-2026-10-16). The verdict stays here: the expansion ships on the ALL numbers (+0.078 to +0.130 on the corpora, +0.030 on the production vault's 400-question sample), and the cross-source question stays open — the production vault's index carries a source marker on 537 of its 2,141 pages (25.1 %), so a 400-question even sample yields 15 true cross-source pairs, which is no data rather than a zero.

### Still open

- #855 awaits a second review from @DocTpoint. The six fixes from the independent review are on the branch at `e3dc1c38`.
- Five PRs to triage: #836, #831, #830, #781, #755.
- `wiki/` vault PPR times out on 2,145 pages.
- The E1 trigger gate fires 0% of the time in production (`coverage < 0.5` never holds).
- The write-side re-plan after @DocTpoint's seven points.

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

- **#872 — the auto-maintain watcher ignores the excluded-files list.** `AutoMaintain.isWatched` (`auto-maintain.ts:116`) calls `isIngestableSource` without the predicate PR #865 added, so a file the user excluded is still ingested automatically — only the manual folder ingest skips it. All four automatic paths go through it (change, rename, batch, periodic). Six acceptance criteria in the issue; the predicate is the one PR #865 introduced, not a second implementation. **The related-shaping note-title count (`wiki-engine.ts:1279`) is a different question and must not take the predicate** — that list answers "which note names already exist?", and a file excluded from ingestion is still a note in the vault, so a link to it is still a true link. The two questions are now two functions (`isInSourceScope` for existence, `isIngestableSource` for ingest intent), and the predicate is required rather than optional so a call site cannot forget it.
- **#876 — the log header's command hint is never refreshed.** `migrateLogHeader` returns early once the marker is present, so every existing vault's `log.md` keeps the old, wrong hint — the drifted string, and for a vault whose interface language and wiki language differ, a name the palette does not carry. The fix in PR #866 reaches headers written from now on. The open design question is how to refresh an existing one: the header's language is not recoverable from its content without guessing, so the surgical option is to replace only the quoted name inside the first bullet, leaving the title, the subtitle, the second bullet and the quote characters untouched.
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
| **User-defined types** (events / risks / issues) | #873, joint with #491 / #330 / #358 | Adds an `event` page type beside entity/concept; the type list becomes **runtime-driven through the injection layer** — a setting, never the schema file, per the three-layer split. **Not yet built, and five questions are open**: the options, the costs and the recommendations are in the #873 thread, one question per line, each closable with a one-line reply. Q1 (a setting or a file) settles the rest; Q3 and Q4 (the entity/concept asymmetry, and #330) must be answered together. #317's *other* half — a direct edit of `schema/config.md` being ignored — was a cache bug and is fixed in #874 |
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
