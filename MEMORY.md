# LLM Wiki Plugin — Project Memory

> **Audience:** anyone landing on this repo (collaborators, reviewers, future
> maintainers). Not an LLM-agent session log. The only durable,
> externally-checked-in, single-source-of-truth record for this project
> is **this file** ([MEMORY.md](./MEMORY.md)); there is no per-agent private
> memory directory checked in to the repository.

---

## Contents

One file, indexed. Read the row you need. Do not read this file top to bottom.

| Need | Where |
|---|---|
| **The handoff — what was decided, and what to do next** | [Handoff — 2026-10-22, before compaction](#handoff--2026-10-22-before-compaction) |
| What is true **today** — release, open counts, the next action | [Current state](#current-state-2026-10-17-latest-the-routine-queue-closed-and-the-release-file-caught-37-prs-behind) |
| The rule for choosing what to work on | [Work lists — the ROI rule](#work-lists--the-roi-rule-tier-tables-archived) |
| Rules that bind any change | [Process invariants](#process-invariants-non-negotiable) |
| The decision list — one line per decision, with pointers | [Key design decisions](#key-design-decisions-canonical-references) |
| Invariants that must never change | [Architectural invariants](#architectural-invariants-write-once) |
| A rule from a past session, and the incident behind it | [Lessons learned](#lessons-learned-from-session-memory) → [Appendix B](#appendix-b--session-log-dated-blocks-verbatim) |
| Why a shipped decision looks odd, before reopening it | [Appendix A](#appendix-a--design-records-verbatim-moved-back-from-docs) |
| Where the other documents live | [Where to look](#where-to-look) |

**Appendix A** holds the four design records; **Appendix B** holds the dated session blocks.
Both are kept in this file so there is one artifact to index and one place to search. Neither
is current state.

## Handoff — 2026-10-22, before compaction

### The maintainer's decisions, and what each one authorises

1. **Merge #864, #874, #867, #871.** All four are APPROVED, CI green, CLEAN. The merge is authorised; it is the first action on resume. #864 and #874 carry @DocTpoint's approval; #867 and #871 carry mine.
2. **#866 waits on @DocTpoint's re-review.** The blocking point is fixed in `23956702` and the branch is rebased onto the current `main`. Do not merge it and do not review it again.
3. **#855: re-measure before cutting or keeping the history.** The steps are spelled out below. The maintainer chose the measurement over a decision.
4. **#755: I may rebase it, provided the contributor's identity is not lost.** The author's identity survives a rebase; the committer becomes the maintainer, and the maintainer accepted that. The credit survives because a squash merge's author is the PR author. The contributor's own trailer stays on the contributor's work — use `--subject`/`--body` on the squash rather than the default message, so the trailer is not carried onto a maintainer-authored commit.
5. **#873's Q1–Q5 are still open.** The options, the costs and the recommendations are in the issue thread; each question closes with a one-line reply there. No code before they are answered.

### The merge, step by step

**#864 needs a fresh approving review before it can merge.** @DocTpoint's approval of `561b7847` was **dismissed** when the handoff commit was pushed on top of it (review `5597752014`, state DISMISSED). The code diff is byte-identical — `git diff --name-only 561b7847..6972533b -- src/ tools/` is empty, and the whole change is `MEMORY.md` and `ROADMAP.md` — so the dismissal is the cost of pushing to an approved PR, not a change in what was reviewed. The ruleset has `required_approving_review_count: 1` and no bypass actor, so the options are a re-approval or a temporary admin bypass. **A request for a re-approval is on #864**; if it is unanswered, ask again rather than bypassing.

The same trap applies to #874, #867 and #871: **do not push to them after their approval lands.** Their heads are `0d896db3`, `1501c90b` and `2062119d` respectively, and those are the commits the approvals cover.

```bash
# 1. Closing keywords in the PR body — every hit must be an issue you mean to close.
gh pr view <N> --json title,body --jq '.title, .body' \
  | grep -inE '\b(closes?|closed|fix(es|ed)?|resolve[sd]?)\s+#[0-9]+'
# 2. AI trailers on the branch commits AND on the draft squash message.
git log origin/main..origin/<branch> --format=%B \
  | grep -inE '^(co-authored-by|generated with|signed-off-by|assisted-by):'
# 3. A review event, before the merge. An APPROVE already exists on all four;
#    add a --comment audit note. `gh pr review --approve` is BLOCKED on my own PRs.
gh pr review <N> --comment --body "<audit note>"
# 4. The merge, with the message written explicitly.
gh pr merge <N> --squash --delete-branch --subject "<subject>" --body-file <msg>
# 5. Read the merge commit back — author, trailer, the closing keyword's effect.
git show --stat --format="author: %an <%ae>%nsubject: %s" <merge-sha>
```

**Watch for the duplicate-review trap.** A `gh pr review` that returns a GraphQL EOF may still have posted. Check `gh pr view <N> --json reviews` before retrying, and note the duplicate in a PR comment — GitHub refuses to delete or dismiss a submitted COMMENTED review.

### #855 — the re-measurement, spelled out so it needs no re-derivation

The branch is `feat/two-stage-query-expansion` (head `b17d9068`); the harness and the corrected docs landed on it in `31566806`.

1. **Extend the harness** (`tools/dev-instrument/run-conversation-eval.mjs`): report **r@10** alongside MRR and hit@1, and add a **derived follow-up set** — questions built from the vault's own edges, with the referring context supplied as history — next to the six hand-written cases in `conversation-cases.json`.
2. **Re-run on the production vault**:
   `npx tsx tools/dev-instrument/run-conversation-eval.mjs "/Users/greener/Documents/Obsidian Vault/wiki" --cases tools/dev-instrument/conversation-cases.json --derive --limit 30`
3. **Judge against `none`, never against `concat`.** On `main` the retrieval query is the question alone (`selectPprSeeds(userMessage, …)`), so `none` is the arm that stands for what ships today. `concat` was never shipped. Measured against `none` the current weighted arm is **worse** on topic-switch (0.615 → 0.550) and better on follow-up MRR (0.121 → 0.248, hit@1 zero in both arms).
4. **Then cut or keep.** If the history cannot beat `none` on both families, **remove the history half from the PR** — `buildWeightedRetrievalQuery`, `buildRetrievalQuery`, the history branch of `prepareRetrievalInputs`, and the `history: N rounds (weight 0.3)` line in the retrieval label — because with the history out they are unreachable and the dead-code policy forbids shipping them. Flipping a flag to zero and keeping them is shipping dead code. Then re-examine the three query strings, which collapse toward one when there is no history. If it can, keep it and implement the gate-based design the measurement points at: the question's own lexical coverage (`LEX_COVERAGE_MIN`, `LEX_MATCH_MIN_COUNT` in `select-seeds.ts`) decides whether the history joins the ranking query.
5. **Before cutting, reconcile the ROADMAP's 16-33x r@10 on follow-ups** with the harness's numbers. They are different metrics on different question sets and are not yet on one instrument. Cutting a feature against six cases while a 16-33x claim stands unexamined is an unmeasured decision.

### The state of everything

| PR | State | Note |
|---|---|---|
| #864 | APPROVED, CLEAN | merge first; the lint family, 23 files |
| #865 | MERGED (`2cd8c7e5`) | #503 closed by it |
| #866 | CHANGES_REQUESTED, head `23956702` | waiting on @DocTpoint |
| #867 | APPROVED, CLEAN | @juliasadler; the abort race and the two catch-alls |
| #871 | APPROVED, CLEAN | @NotAFlightRisk; the debounce clamp Notice |
| #874 | APPROVED, CLEAN | the schema cache, mtime-keyed |
| #875 | MERGED into the #855 branch | the harness, `31566806` |
| #855 | CHANGES_REQUESTED, head `b17d9068` | the re-measurement above |
| #781, #755 | CONFLICTING | #755 may be rebased by me; #781 still waits on @DocTpoint's order |

Issues opened this cycle: **#872** (the watcher does not consult the excluded-files list), **#873** (the user-defined taxonomy; decisions in the thread), **#876** (the log header's hint is never refreshed, so existing vaults keep the wrong one).

### What is not verified, and what a continuation must not assume

- **#867 and #871 were reviewed from their diffs and the production code, not by running their suites locally.** Their CI is green.
- **#873's Q3 option C was costed in PRs, not in code.** The template layer and the rule layer have not been read.
- **The ROADMAP's 16-33x r@10 on follow-ups has never been independently reproduced.**
- **#781's blocking measurement** — the 2026-10-09 ruling says its premise measurement ran; the ROADMAP's "never run" refers to a different M0/A offset measurement. The two statements still have to be reconciled before the branch is touched.

### Operational notes that cost time to rediscover

- **Gate 1 takes over 30 minutes in the foreground** and times out at 3600 s. Run it in the background and read the exit codes: `nohup bash -c 'pnpm lint > /tmp/g-lint.log 2>&1; echo "lint=$?" >> /tmp/g.log; npx tsc --noEmit > /tmp/g-tsc.log 2>&1; echo "tsc=$?" >> /tmp/g.log; pnpm build > /tmp/g-build.log 2>&1; echo "build=$?" >> /tmp/g.log; pnpm test > /tmp/g-test.log 2>&1; echo "test=$?" >> /tmp/g.log; pnpm css-lint > /tmp/g-css.log 2>&1; echo "css=$?" >> /tmp/g.log' &`. **Build must precede test** — a test-first run fails with ENOENT on a fresh clone.
- **`shazam_verify` reports 8 false-positive orphans**, all in `tools/dev-instrument/` (three `setup` esbuild plugin methods, four functions passed as first-class values, one `lexScore` object-shorthand export). Do not "fix" them.
- **The production vault is `/Users/greener/Documents/Obsidian Vault/wiki`** — 2,141 pages, 537 carrying a `source:` marker. The test vaults that are still on disk are `/tmp/expA/wiki` and `/tmp/expB/wiki`.
- **MiniMax credentials live only in `/tmp/wikkey.env`** and must not enter the repository.
- **A subagent launch failed with `Cannot find package '@earendil-works/pi-coding-agent'`** — an infrastructure fault, not a task fault. Do not silently switch execution modes over it.

## Current state (2026-10-17, latest): the routine queue closed, and the release file caught 37 PRs behind

Swept ROADMAP, MEMORY, the code, 37 open issues, 6 open PRs and 3 milestones to re-rank the work. The order lives in [ROADMAP §"The next-work order — 2026-10-16, re-ranked"](./ROADMAP.md#the-next-work-order--2026-10-16-re-ranked); this section is the state and the corrections. #855 sits on `v1.29.0 MINOR` and now carries **no conflict** — the one that appeared was a single `MEMORY.md` block where both sides inserted a "Current state" section at the same position, resolved by keeping both newest-first. So the "nothing is unassigned" invariant is true: 0 issues and 0 PRs without a milestone.

**What ranks 1–2 of the next-work order did, and what they cost.** The Dependabot pair landed as #859 (`fded549f`) with `#830` and `#831` closed as superseded. Neither branch was mergeable as it stood: both also downgraded `@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin` from 8.71.1 to 8.59.1, because both were cut before #834. **That downgrade is type-compatible, so Gate 1 would have passed and the revert would have shipped silently** — the reason to read a dependency PR's whole diff rather than its title. `#816`'s claim that Dependabot already ignores TypeScript 6 was false; the `ignore` list had no `typescript` entry, and #860 (`2ff5eb40`) adds one. `#861` (`4cc9e0d2`) bumped dev-only `vite` and was the only PR without a milestone. Its last CI run predated #859, and the ruleset sets `strict_required_status_checks_policy: false`, so the green check said nothing about the pair: the merged state was verified locally (`pnpm install --frozen-lockfile` plus full Gate 1) before merging.

**The CHANGELOG's `[Unreleased]` section was 37 PRs behind and had recorded 7.** #729's read side (#837, #841, #842), the term-index cache (#843, #844), the custom-Anthropic URL fix (#851), the doubled answer budget (#852), the academic citations (#857) and the dead-link race (#823) were all absent from it. The file is what release notes are cut from, so this was a Gate 5 blocker sitting unnoticed behind a section that looked complete. Backfilled 2026-10-17.

**#781 is held, not rejected, and I had it backwards.** I reported it as "denied by measurement" and recommended closing it. That came from a compaction summary, and I repeated it to the maintainer without opening the primary sources. #729 chose direction A on 2026-10-05 on the terms "M0 proceeds, with one measurement in front of it. #781 stays held **until that measurement lands**" — and that measurement has never run. DocTpoint's `CHANGES_REQUESTED` states its own scope: "This is a statement about the order of the steps, not about your code." Closing it would have thrown away unfinished work on a claim nobody had checked. Its technical objection stands and is specific: M0 decides by tie-break rather than by signal, 80 % of top-3 cuts landing inside a tied group, and titles beginning with "A" at 9.1 % of pages but 17.1 % of chosen entries.

**Most of #781's prerequisites are already in, and three sites are not.** The query path is seeded — `ppr-cascade.ts:539` does `rng ?? seededRngFrom(query, seeds)` — and two of four tie-break sorts are fixed, `:184` ordering by score → `tokensFound` → path. Still open: `hub-detection.ts:72` and `hub-link-distinctiveness.ts:97` both reach `Math.random` through `options.pprOptions ?? {}`, and `ppr-cascade.ts:473`, `lexMatch`'s weight table, sorts on `b.score - a.score` with no tie-break. Cheap, and it clears the concrete half of the objection.

**The production vault's missing `source:` markers are its age, not a write-side defect.** I reported 25.1 % marker coverage as a write-side finding and queued work against it. `test10` is the control: through the same production `IndexGenerator` it reaches 96.6 %, and its only 12 unmarked pages are its 12 `sources/` notes, which cannot link to themselves. `test8` reaches 85.5 %, and its 17 non-source gaps are pages whose `sources:` frontmatter points at an entity or concept page — `entities/google` carries `sources: - "[[entities/ga4-e-commerce]]"` — so there is no `[[sources/<slug>]]` to derive and declining is correct. The production vault's pages were written by an older release that never recorded that link. The current write side is complete.

**`listModels()` had zero production callers, so the "empty array false pass" on the defect list could not fire**: the settings panel uses `fetchModelsWithFallback`, which already rejects an empty list, and Codex uses `fetchCodexModelCatalog`. Four implementations satisfying an optional interface member, dead. **Deleted 2026-10-18 (`0d80ffb7`)**: the member, the four bodies, twelve mock lines across five files, both tautological `describe` blocks, and the two `no-unnecessary-type-assertion` disables those blocks needed. `CODEX_MODELS` survives because `openai-codex-model-policy.ts:22` still consumes it.

**#503 is implemented, and the reason it asks Obsidian instead of reimplementing is a measurement.** `folder-scope.ts` stays pure: the exclusion predicate arrives as an argument, and `core/user-ignore.ts` is the single place that knows `metadataCache.isUserIgnored`, which is not in the published typings. DocTpoint measured the semantics on Obsidian 1.13.7: a plain entry is a string **prefix** where the trailing slash is part of the pattern, `#Definition` matches **nothing** (not even a note carrying the tag), and `/…/` entries are regexes. Three rules, one of which is "silently match nothing" — the same reasoning that rejected an English stub word list in #827. **The two explicit file pickers deliberately keep the old behaviour**: a file the user selected by hand is a decision, not something to filter.

**The eight "orphans" a call-graph tool reports are a different matter and must not be touched.** They are all live: three are `setup(build)` esbuild plugin methods, which esbuild calls through the plugin object and never by name; four are passed as first-class values (`evaluateMax('MAX', [rankBm25fWithText, rankPpr])`); and `lexScore` leaves through an object shorthand. **A zero-reference report is a hypothesis about the tool's resolution rules, not a verdict on the code** — so `listModels()` was worth checking with `grep` before believing it, and so were these.

**The lint batch shipped as PR #864, nine commits, and three of the four plan rows were wrong in ways that change the next step.** One commit per issue, each with its own RED test and its own Gate 1; CI Gate 1 passes. The plan's #827 row asked for "three rules: generic word, code identifier, inline-code-or-quote-only"; its #826 row said the commit-time guard was "two guards, and one already exists one layer down"; and its #824 row named "can duplicate the link text on one line", which the substring rule cannot produce. Full corrections in [ROADMAP §"ROI order — the lint-fix correctness family"](./ROADMAP.md#roi-order--the-lint-fix-correctness-family-2026-10-12); this is the state. **A bold paragraph lead is not an address** — that section's plan and status live under a bold lead rather than a heading, so it cannot be linked to; the family heading is what resolves.

**The word list was rejected, and the principle that replaced it is worth keeping.** The #827 plan resolved to roughly 70 English words. The project ships 11 locales, so that rule silently disables in 10 of them — a fix that works only where the reporter happened to write is not a fix. The model decides now (`action=leave` in `prompts/fixes.ts`), because "is this name real" is a question about meaning: `Osteopontin` and `LinkedIn` are real names, `Name` is not, and a spelling list cannot tell them apart. The list is gone from branch history — `git log -S GENERIC_STUB_WORDS` returns 0. `candidate-gate.ts`'s per-language connectives are **not** a precedent: those are a closed grammatical class, while placeholders are an open, behaviour-dependent set.

**#827's root cause is in the scanner, and I first said it could not be fixed there.** I declined an inline-code rule on the grounds that it needed a new position contract between the scanner and the fixer. That was false: masking needs only the page's text, no positions, no contract. The cost of the wrong call was two patches at the wrong layer — the word list, then a prompt rule. `scanDeadLinks` and `scanOrphans` ran their link regex over raw content, so a `[[link]]` inside inline code or a fence was reported dead and the fixer then created a page for `Name` or `MyFile`; the reporter's placeholder pages came mostly from example text. Both scanners mask code regions now (`maskCodeRegions`). **Quotation is deliberately not masked, and a test asserts it** — `"[[X]]"` is a real link in Obsidian, and the reporter's `"[[entities/name|Name]]"` is instruction text that leaked into a page, which is a judging problem for the model.

**Compare page identity, not path spelling — and the read/delete asymmetry is why it matters.** A string compare caught the literally repeated path and the missing `wiki/` prefix, and let **six** spellings through: `./`, a doubled slash, a dropped `.md`, and Unicode NFC/NFD in both directions. NFC/NFD is the dangerous one because the two sides disagree about what a path is: `tryReadFile` (`wiki-engine.ts:2209`) normalises the path and scans directories, while `deleteFile` (`:2178`) uses an exact key — so one spelling reads the page and the other deletes it. `canonicalPagePath` folds all six; the merge refuses on a match and the runner drops those pairs before they arrive. The same asymmetry runs the other way too: `merged` could be logged with the source still on disk, so the merge now reads the source back and reports when it survived.

**Two test doubles were more forgiving than production, which is why both defects stayed hidden.** `createMergeCtx`'s `deleteFile` recorded a delete without performing one, so the read-back check above could not be written — it would have failed on the fake, not on the code. And `link-vault.ts` already skipped fenced links, which is why the link-retarget tests never surfaced the scanner bug. Both are fixed. **A lenient double hides exactly the defect you are looking for.**

**Three of the four issues now meet their acceptance criteria outright, and the three follow-ups that closed the gap came from executing the batch rather than reading it.** #824 is `Closes`: an unresolvable target is rebuilt from the orphan's own path (`retargetOrphanLinkTarget`) instead of being skipped, because the page is there by definition and the model's readable text survives as the label. #827 is `Closes`: the model decides whether a name is real, the scanner masks code regions so an example is not a link, and a stub no longer returns as an alias-deficient or orphan finding. **One clause is declined on the record** — a name appearing only inside a quote is not treated as fiction, because `"[[X]]"` is a real link in Obsidian and treating quotation as evidence would delete real references. #826 is `Closes`. Only #825 stays `Refs`: the stale half is fixed and the fallback merge is idempotent, but the issue also asks whether `collectResolvingReferences` should read `frontmatterLinks`, and #386 excluded them deliberately.

**Still open, and the order I would take them.** `deleteFile` returning `boolean` rather than `void` — the merge now reads the source back as a cheaper substitute, which reports the failure without changing a contract every caller and mock would have to follow. Then the `merged` count that still increments for a kept-source pair, which needs a structured outcome rather than a match on the message text. Then #855's P0: `weightedTerms` reaching the final ranking, `expanded.join(' ')` at `retrieval-plan.ts:131` untouched, waiting on its Doc review.

## Current state (2026-10-15)

**What the query path looks like now.** Four levers, three of them measured on the production path and one of them waiting on a review. Body text in the scoring (29-90x), `text` not length-normalised (+0.04 / +0.08), the conversation in the retrieval query (16-33x on follow-ups), and two-stage Rocchio query expansion (+0.04 / +0.05, module shipped, wiring under review). Every one of them stays inside the corpus: no embedding, no external knowledge, no model call on the retrieval path.

**Follow-up questions were a silent total failure and are now fixed.** `maxConversationHistory` wired the conversation into the ANSWER generator and the retrieval never saw it. A user asking "K3 与 DeepSeek 的架构异同" and then "为什么？" got the right context with the wrong pages. Measured over 1,000 follow-up cases built from the layered-eval questions: scoring the follow-up alone is 0.015-0.047 r@10, scoring it with the recent turns is 0.49-0.67. The fix is a string. The round count is `RETRIEVAL_HISTORY_ROUNDS = 5` in `constants.ts`, NOT `maxConversationHistory`: the answer wants the widest window a prefix cache will hold, the retrieval wants only the turns that say what the user is looking for. A hand pass with the full transcript in the query produced noise.

**#855 (two-stage Rocchio) has a CHANGES_REQUESTED review from @DocTpoint at `9102c478` and all five points stand.** Three are blocking. The expanded query is passed to the LLM stages as if it were the user's question (`query-keywords.ts:97`, `selectSeedsWithLLM`), so up to 20 words the user did not write reach the model. `expandQueryForRetrieval` rebuilds page terms and a corpus table on EVERY query, `twoStageExpand` builds them again, and `distinctive()` segments every page twice — that is the 4.4 s per query #843 removed, and Gate 4 counted only the scoring. And no tool in the repo calls `twoStageExpand`, so the +0.040 / +0.051 is not reproducible from the repo; `run-layered-eval.mjs` still seeds with the old title 3 / alias 2 scorer. That last one is this project's own rule broken — the path that is measured is the path that ships. Fix order: original query to the LLM stages, `TermIndexCache` reuse, then move the measurement into the repo.

**Also open on the query surface (#756).** Inline citation links read as body text with a highlight; the fix is a smaller size than the body and a lower saturation than the final reference list, underline kept. "清空历史" empties the view and leaves `data.json` alone, so the button says "forget" and does "hide". The composer is the same height for three characters and three paragraphs; it wants three lines by default and to grow with the content.

**Still awaiting the maintainer.** #855 (blocked on the review fixes) and `fix/retrieval-sees-history` (history into the retrieval query, URL fallback hardening, L1 writes the resolved Base URL back). Both build clean at 4725 tests / 336 files.

---

**Retrieval experiments — 2026-10-15, seven arms against `lex+PPR`.** All on the production path (`bm25fScore` + `pprCascade` + `maxFuse`), both vaults, all questions and the cross-source strict layer. The question was whether query expansion and the graph channel overlap or compound.

| Arm | mechanism | test8 ALL | test8 CROSS | test10 ALL | test10 CROSS |
|-----|-----------|-----------|-------------|------------|--------------|
| A0 | baseline `lex+PPR` | 0.850 | 0.760 | 0.826 | 0.641 |
| A1 | one-shot expansion from the LEXICAL top-5 | 0.880 | **0.720** | 0.885 | 0.667 |
| A2 | one-shot expansion from the PPR top-5 | 0.893 | 0.760 | 0.872 | 0.641 |
| A3 | one-shot from both sources | 0.893 | 0.760 | 0.878 | 0.667 |
| **A4** | **two-stage: expand, re-rank, expand from the NEW top-5** | **0.885** | **0.800** | **0.892** | **0.692** |
| A5 | A1 plus negative feedback | 0.880 | 0.720 | 0.885 | 0.667 |
| A6 | A1 only when coverage < 0.5 | 0.850 | 0.760 | 0.826 | 0.641 |
| A7 | A1 with PPR seeded from the reranked list | 0.880 | 0.720 | 0.885 | 0.667 |

Sweep for A4: `k1=5 m1=10 k2=5 m2=10` is the best setting on both vaults. Average r@10 gain **+0.048**, positive in all four cells, and 2.5x the one-shot form.

**What the matrix says.** The gain is in ITERATING the expansion, not in mixing channels. A7 — the arm built to make the two channels compound — is identical to A1, so seeding PPR from a reranked list changes nothing: the graph is fixed, and moving the walk's starting points does not change which pages it can reach. A2 beats A1 on one vault and loses on the other, so "expand from the graph" is not a rule. A5 and A6 are noise. **A4 is the only arm that wins in all four cells.**

**Why iteration compounds.** The first expansion adds the topic's words. The re-rank pulls the query toward that topic. The second expansion then pulls words out of the topic's own interior, and those are the words that bridge to a page sharing none of the asker's vocabulary. One-shot expansion can only reach the topic's rim.

**MEASUREMENT ARTIFACT — the sixth trap, and the worst one.** The evaluation questions are built from `a -> b` links: the query is `a`'s summary terms minus `b`'s terms, and the truth is `b`. PPR's seeds are the lexical top-3, and since the query terms come from `a`'s own summary, `a` is almost always a seed. **PPR then walks `a`'s edges and lands on `b` — that is link-following, not retrieval.** Measured on both vaults: with the asker left in, the strict layer reads 0.800 / 0.795; with the asker excluded from the seeds it reads **0.400 / 0.385**. Half the number was the question answering itself. Any figure quoted for PPR on this evaluation set must state which one it is.

**What the matrix does NOT say.** PPR is not redundant — but its honest contribution is the lower number. Pure lexical sits at 0.320 / 0.256 on the strict layer; PPR with the asker excluded lifts it to 0.400 / 0.385; two-stage expansion takes it to 0.440 / 0.436. The gain from A4 survives the artifact check: +0.040 and +0.051 with the asker already removed, so the expansion is not leaning on the link it is being asked to find. Note also that `maxFuse` of lexical and PPR scores WORSE than PPR alone on both vaults — the fusion is diluting the graph channel, and that is worth its own pass before any more weight is added to the lexical side.

**Also falsified this round, for the record.** Corpus-local co-occurrence expansion (raw counts and PMI): flat on the strict layer at every parameter — the strict layer is defined by vocabulary disjointness, so the words the query would need to reach are exactly the words it excludes. LLM query expansion (MiniMax, 1,180 questions): r@10 +0.023 weighted, and the decomposition shows **0 % rescue on the cross-source layer** — it fixes same-source ranking, not the vocabulary gap. LLM reranking of the top-10: identical to baseline. The earlier 40-question figure of +0.050 / +0.125 was a sample artefact and is withdrawn.

**Number provenance — read before quoting any figure from @DocTpoint's work.** His measurements come from two different builds and the mail mixed them. "Stock" means unmodified upstream `main`. "Local stack" means his patched build: deterministic Related sections with a cap of five, a picker that sets ingest order, and a local micro-embedding for dedup. A figure from the local stack does NOT describe `main`.

| Figure | Build | Describes `main`? |
|--------|-------|------------------|
| Star shape: ~95 % of edges intra-source, 9 in 10 pages without a cross-source incoming link | stock (July) AND local stack | **yes** — load-bearing |
| Arm C lost 3 of 5 at the lexical seed stage | stock, query path | **yes** — load-bearing |
| M0: 79 % of chosen entries rest on one shared target; 95 % of top-3 cuts fall inside a tie | local stack, M0 computed as specified | mechanism yes, numbers approximately |
| **"676 dead related entries on 870 pages"** | **stock control run, 136 notes, alphabetical** | **this is NOT the rebuild** |
| The rebuild's own dead-related count: 374 on 2,135 pages (5 %) | local stack only | **no** — not a `main` baseline |
| Related cap of five, zero violations | local stack only | **no** — `main` has no cap at all |
| Micro-embedding dedup window 56 % / 34 % → 99.5 % / 95 % | local build, opt-in | n/a — not upstream |

**The single sentence that matters:** the star shape and the lexical-seed bottleneck survive the regime change and hold on `main`; the dead-related counts and the Related cap do not.

**Latest shipped release:** **v1.28.0 MINOR** (2026-10-04, 4372 tests / 313 files — CHANGELOG §1.28.0). Nothing since is released; the merges below are unreleased work on `main`.

**The #729 read-side track merged on 2026-10-14**, one day, six PRs. #837 read-side core + tools, #841 write-side shaping + hub-link distinctiveness, #842 the `legacyScorer` switch in 11 locales, #840 the docs, #843 a term-index cache, #844 its staleness fix. Gate 1 across the merge: 4709 tests / 334 files. What the merge bought, on the strict layer (pairs sharing under a third of their terms, different sources, truth edge removed): 0.45-0.48 at r@10 on test8 and 0.32-0.36 on test10, up from 0.000 for a lexical channel without the body. `self recall@10` is 1.000 in every arm on both vaults.

**The write-side track is what remains.** The read side consumes signals the corpus carries; where two pages share no link and no wording it has nothing to work with. That is unchanged by the merge and it is a write-side problem.

**Three numbers worth keeping beside the code.** The body is the only lexical lever that crosses a real vocabulary gap — `lexMatch` scores 0.021 at r@20 without one and 0.667 with one on test8. BM25F's length normaliser was damping it: turning that off for `text` moved recall 0.385 -> 0.456 and 0.271 -> 0.356, and with the fix BM25F now matches or beats the production substring scorer. And the LLM seed stage is worth about +0.03 weighted over the strict layer — measured +0.125 at r@20 on the 24-33 % of strict questions that trigger it — by translating the asker's phrasing into the target's name-tier words.

**A process rule changed on the same day, because the same day proved it.** Bypass merges are for three cases only — explicitly authorised by name, "merge it" for that specific PR, or documentation only — and approval is the FIRST gate, not the last: Gate 1, side effects, breaking changes and performance must all pass before `gh pr merge`. A term-index cache passed Gate 1 with 4707 tests and shipped stale on body edits; only the side-effect audit found it. See AGENTS §Git Safety Protocol.

**Older state below, kept for the reasoning it carries rather than for currency.**

**Latest shipped release:** **v1.28.0 MINOR** (2026-10-04, 4372 tests / 313 files — CHANGELOG §1.28.0). The tag and the merge commit are both `c47c25a7`; the release carries three assets and a Discussion in `announcements`. It shipped **four opt-in capabilities** — #608 image embeds, #723/#735 per-provider headers with the OpenCode preset, #741 the desktop streaming fallback, #672 one tag vocabulary — plus **#751**, which made two already-shipped features run in a release build.

**v1.28.0 shipped without its named head.** #729 Phase 1 was the plan of record; it did not go in.
Its design record is still *proposed* and @DocTpoint's objection is unanswered.
**The plan did not change. Only the release number did.**
The milestone moved to `v1.29.0 MINOR` on 2026-10-04, with its 12 open items and 4 open PRs, because a released milestone carries no unstarted work.
**The direction was decided on 2026-10-05: A** — one measurement pass first, then M0 in a corrected shape.
The measurement's definition and the tie-break defect the dissent found are in ROADMAP §"#729 — the three directions".

**Twenty merges have landed after the release, and none is released yet.** `main` is at **`b09ab3d7`** (2026-10-12). The five most recent are `f41a39d0` #786 (AI SDK v7 — closed #764 and superseded #770/#771/#772) · `8fc341eb` #820 · `fb5a0bce` #818 · `c12ca34e` #828 · `b09ab3d7` #829. This paragraph used to carry all eleven SHAs inline; **a hand-copied SHA list is drift-prone and the full record is one command away** — `git log --oneline c47c25a7..origin/main`.

**#813 unblocked every PR's Gate 1.** Main's audit step was green at 2026-10-05T14:53 and failed at 2026-10-06T06:41 on #786, which carried no dependency change of its own; unpatched main failed the same audit locally. A new `source-map-js` advisory appeared between the two runs. The fix pins `source-map-js` 1.2.1 → 1.2.2 in both override lists and regenerates both lockfiles. **CI runs `Audit` before `Five-Gate`**, so a fresh advisory hides the five checks behind it and a docs-only PR reads as a code failure.

**Open counts: this section does not carry them any more.** It read 31 issues / 5 PRs until 2026-10-12, when the API returned 35 / 6 — and the corrected figures moved again inside the hour, as four PRs and one issue arrived and two milestones gained items. **A number that changes hourly belongs in a command, not a document.** The invariant worth keeping is that **every open item is assigned to a milestone**, because that is what was actually broken: thirteen items had drifted in unassigned since 2026-10-04 while this section claimed the three windows held everything. Read the counts with `gh api "/repos/GD4AI/obsidian-llm-wiki/milestones?state=open" --jq '.[] | "\(.title): \(.open_issues)"'`, and check the invariant the same way. See ROADMAP §"Open decisions".

**Triage round (2026-10-12).** 44 open items at fetch, 13 to process, 31 already fully processed. **Four PRs merged:** #820 (`8fc341eb`, the i18n Notice hint pointed at a setting v1.23.0 had removed) · #818 (`fb5a0bce`, Codex readiness pinned at the caller) · #828 (`c12ca34e`, the twelve AI SDK v7 type failures) · #829 (`b09ab3d7`, `Closes #676`). **`origin/main` had not compiled since `f41a39d0`**, so #828 was a prerequisite for every other PR's Gate 1, not one change among several. **#829's family is five further reports, in ROADMAP §"ROI order — the lint-fix correctness family"** — ROI-ordered, each verified against the source (not accepted from the report). **Four are unfixed; #823 is in flight in #833**, opened by @Noumenon-ai while this round was running and carrying the per-source serialization the ROI table had just recommended. **It is not available work.** The ranking was written from the report before #833 existed, which is exactly the gap the open-PR check closes — a defect ranked by reading the report is not a defect nobody has started. PR **#821** is held: it takes `@typescript-eslint/parser` to 8.71.1 while `eslint-plugin` stays at 8.59.1, so two copies of `@typescript-eslint/types` resolve. PR **#819** stays a draft and was deliberately not reviewed.

**Triage round (2026-10-07).** 36 open items, 4 to process, 32 already fully processed. **#770** (TypeScript 6.0.3) is **closed**: its Gate 1 fails with 31 errors across 14 files, which is a codebase-wide migration and not a version pin, so it became **#816** with the acceptance criteria named. **The "dependabot now ignores 6.x" half of this sentence is unverified and probably wrong** — `.github/dependabot.yml` carries no `typescript` ignore entry, and #816 asks for the same confirmation. Do not repeat the claim until the entry exists. **#771** and **#772** are superseded by #786, which carries newer versions of both (`@ai-sdk/anthropic` 4.0.65 against 4.0.56; `ai` 7.0.116 against 7.0.105); they close when it merges. **#729** is in flight in #781, and the correction posted to it records where the body's mechanism claim fails: `create-page.ts:347` writes `[[sources/<slug>]]` into frontmatter and `prompts/generation.ts:134-139` asks for full-path back-references, so S and E are linked in both directions, and `prompts/constraints.ts:7` keeps the E-to-S edge in frontmatter only.

### Documentation consolidation (2026-10-06)

Landed as **#814**, merge commit **`b19cf69f`**. Five live documents went through the four checks
in AGENTS.md §"Document lifecycle". Every ceiling is now met.

| File | Before | After | Ceiling |
|---|---|---|---|
| `MEMORY.md` | 2032 | **1089** | 1500 |
| `AGENTS.md` | 471 | **515** | 600 |
| `ROADMAP.md` | 382 | **381** | 500 |
| `CONTRIBUTING.md` | 362 | **363** | 450 |
| `NOTICE` | 51 | **51** | — |

The pass added three mechanisms, all in AGENTS.md §"Document lifecycle":

1. **`MEMORY.md` carries a `## Contents` index at its top.** A section that cannot be described in
   one index row is two sections.
2. **`MEMORY.md` takes no new dated section.** Eight had accumulated. Their rules merged into
   §"Lessons learned (from session memory)"; their dated halves moved to Appendix B.
3. **Compress in place; do not relocate.** Moving a block to a new file creates a second file to
   maintain, and the words are unchanged. Two files created during this pass were deleted for
   that reason.

**Acceptance:** every ceiling met · all restored rule headlines byte-verbatim against `HEAD` ·
`AGENTS.md`, `CONTRIBUTING.md` and `NOTICE` lost **zero** facts · `ROADMAP.md` lost two alias
tokens whose meaning is still stated in one line · `MEMORY.md` dropped 23 superseded state
pointers by design, plus 4 stale-path tokens · `shazam_verify` PASS.

**Six subagent writers ran in two rounds, and all six hit the 30-minute cap.** Four produced
usable work. Two died mid-reformat with no report, so the acceptance above is mine and carries
my own uncertainty. **Round 1 gave each writer a whole file and failed. Round 2 gave one file
per writer, an explicit line target, and a read-only inventory step first, and worked.** One
writer asked whether "≤382 lines" and "wrap at 100 chars" could both hold. It measured, showed
they cannot, and offered three options with costs. **It was right to ask.** The answer: hold the
ceiling, widen the wrap, never trade a fact for a line.

### Open, small, and not started (2026-10-06)

- **✅ RESOLVED 2026-10-06 — the `AGENTS.md` → `MEMORY.md` anchor.** `AGENTS.md` linked to `#architect-level-contributors`, a heading MEMORY never had.
That content is the **Architect-level contributors** row of §"Key design decisions (canonical references)", and the link now names that section.
The same pass fixed four siblings: a `~/.pi/skills/…` release-skill path that does not exist (canonical is `~/.agents/skills/…`); `docs/PDF-OCR-GUIDE{,_CN}.md` pointing at a README section the README does not have; a stale test path in AGENTS.md's Gate-1 note; and "10 READMEs (EN + 9 i18n)", which is 11.
The README defect was in the sentence, not only the anchor: its 13 H2s carry no PDF heading.
- **#786** (AI SDK v7) is **reviewed**, and CI is green end to end. Four tests in `reasoning-only-guard.test.ts:172-194` pin the `finalStep` shape, so the SDK contract is verified at the type level; the only unknown left is provider-backend behaviour. A dev build for live testing is at `~/Desktop/llm-wiki-786-dev/`. It waits on that test, not on review.

### ✅ RESOLVED 2026-10-03 — CI was red on every commit, and `gate:1` could not see it

`main`'s CI had been failing since at least 2026-09-27. **Nothing in the tree caused it:** the failing step is `.github/workflows/pr-ci.yml:79`, `pnpm audit --audit-level high --ignore-registry-errors`, and **that step is not part of `pnpm gate:1`** (`lint && typecheck && build && test && css-lint`). CI runs **six** checks; the local alias runs **five**. Two advisories published that day made the pin stale — `brace-expansion` (override existed at `5.0.9`, advisories want `>=5.0.11`) via the eslint chain, and `undici` (no override at all, `>=8.10.2` wanted) via `jsdom`, **both dev-only and both patched inside their own minor line** ⇒ not breaking. Fixed in **#796** by bumping `brace-expansion` to `5.0.12` and adding `undici: 8.10.2`, in `pnpm-workspace.yaml` **and** `package.json`, regenerating **both** lockfiles (`npm` does not read pnpm's — the #501/#652 class). Proof: `8bb496db` = `success` while `eadfaee1` / `73e6ca49` / `127f35be` = `failure`. The two surviving moderates are left alone on purpose — the gate is `--audit-level high`.

**The durable rule: a green `gate:1` is not evidence that CI will be green.** The only signal that the two gates differ is CI's colour. Three PRs were merged on a red signal before this was noticed, on the reasoning that a docs-only or one-line change cannot break an already-red gate — **that reasoning is wrong to act on even when the outcome is benign**. Red means stop and diagnose.

### The reasoning-shape family, and which clients guard it (2026-10-03)

**#799** fixed the shape where a gateway inlines its reasoning into `content` inside a thinking block. **Only `OpenAICompatSdkClient` carries the guard.** `create-llm-client.ts` sends `openai` (and `useOfficialOpenAI`, and `apiShape: 'responses'`) to `OpenAISdkClient`, sends `anthropic` and `anthropic-compatible` to `AnthropicSdkClient`, and sends **everything else** to the compat client — so most built-in providers are guarded, and "custom provider" is **not** the boundary: the shape is a property of the wire format, not of who hosts the endpoint.

**The other two clients do not need it today, and their own docs are the evidence.** OpenAI's Responses API returns reasoning as its own item type (`summary_text` / `reasoning_text`).
Chat Completions returns no reasoning text at all — never inline in the answer.
Anthropic returns `thinking` blocks separately from `text` blocks.
The one counter-example found: Anthropic itself returns the reasoning **as a `text` block with literal `<thinking>` tags** for a thinking-only response followed by `tool_use` (`anthropics/claude-code#21849`).
**This plugin never creates that trigger — it sends no tools — so the case was not filed and not fixed.**
If a report ever arrives on one of these clients, the wiring is small: the predicate is shared in `finish-reason.ts`, so each call site needs `result.text` plus the `rescued` value.

**Still silent, and worth its own look:** the `NoOutputGeneratedError` arm in the compat client returns `text: ''` with only a `console.debug`, so an empty answer can still be invisible to the user. It fires only when the output getter throws, which means schema-backed calls, so it does not affect Query. Found while reviewing #799.

### The ruleset restore can fail, and only the re-read catches it (2026-10-03)

While merging #800 the ruleset restore returned `Put ... : EOF` and **the bypass actor stayed active** (`bypass_actors=1`); the write looked issued, and nothing in the merge output said the restore failed. **So the restore needs two things it did not have:** its own retry loop (the API returns intermittent EOFs), and a **re-read of the ruleset** as the only accepted proof. "Never suppress the restore output" was already a rule here and it was not enough, because the output was present and wrong. What caught this was reading `bypass_actors` back after the restore call returned — `1` where `0` was expected. Check it before moving on, and do not treat a printed restore line as the evidence.

**`--admin` is only effective when `bypass_actors` covers you (2026-10-12).** The own-PR merges of #828 and #829 needed **both** a temporary bypass actor **and** `--admin`; `--admin` alone was refused with `At least 1 approving review is required by reviewers with write access`, because the ruleset's `bypass_actors` is `[]` and `current_user_can_bypass` reads `never`. **Read it as: the bypass actor is the operative mechanism, and `--admin` is what tells GitHub to use it.** The ruleset was updated **2026-10-07T12:09** to add `required_approving_review_count: 1` and `require_extra_approval_for_unattributed_changes: true`, which is when `--admin`-alone stopped working — see §"PR self-approve & maintainer passby" for the corrected rule.

**The bypass actor's shape is `OrganizationAdmin`, and every other shape is refused (corrected 2026-10-16, on #836).** This paragraph first said the route was unavailable. It is not — I concluded that from three failed shapes and stopped, which was the same error as reading `gh`'s generic merge message as a protection refusal. The shape that works on this repository is **`{"actor_type": "OrganizationAdmin", "role_name": "admin"}`**, sent as a `PUT` on the ruleset with `bypass_actors` replaced; it returns `{"actor_id": null, "actor_type": "OrganizationAdmin", "bypass_mode": "always"}` and flips `current_user_can_bypass` from `never` to `always`. `gh`'s own token is fine for it — no extra scope, no GitHub App, despite `GD4AI` being a user account rather than an organisation.

The shapes that fail, all with 422, and all of which look conclusive if you stop at the first one:

| Payload | Error |
|---|---|
| `{"actor_type":"RepositoryRole","role_name":"admin"}` | `actor_id is required for RepositoryRole` |
| `{"actor_id":<user id>,"actor_type":"RepositoryRole","role_name":<any role>}` | `Invalid bypass actor` — and the error string renders only `actor_id` and `actor_type`, so it reads as though `role_name` were never sent. `write`, `triage` and `read` fail identically, and so does the **repository** id in that slot |
| `{"actor_id":"<user id>","actor_type":"RepositoryRole",...}` | `Invalid property /bypass_actors/0/actor_id: is not of type integer` — `actor_id` must be a JSON number, not a string |
| `{"actor_id":<user id>,"actor_type":"Integration"}` | `Actor integration must be part of the ruleset source or owner organization` — correct, and irrelevant, because `OrganizationAdmin` already works |
| `{"actor_type":"OrganizationAdmin","role_name":"admin"}` | **succeeds** |

**Two lessons, and both are about stopping early.** First, `gh pr merge --admin` failing is not evidence about the bypass route at all. On #836 the merge was refused with `the base branch policy prohibits the merge` while the PR was `mergeable=CONFLICTING / mergeStateStatus=DIRTY` — `gh` prints that generic line whenever `mergeStateStatus` is not `CLEAN`, so a merge conflict was wearing a branch-protection costume, and I went to the ruleset instead of to `gh pr view --json mergeable,mergeStateStatus`. **Read the PR's actual state before theorising about why a merge is refused.** Second: three rejected payload shapes is not a proof that the fourth is impossible. Exhausting the *plausible* set and then declaring the route closed is how a working mechanism gets recorded as missing — and this file already carried a procedure whose precondition nobody had written down. A recorded procedure needs its precondition beside it **and a record of the shapes known to fail**, so the next attempt does not re-run the same three dead ends.

> **The decision queue lives in ROADMAP §"Open decisions — the queue awaiting the maintainer"**, with a recommendation per row. This file carries the *reasoning* behind those recommendations; it does not duplicate the table.

**Why the queue matters more than the code right now.** Five open items are **done work waiting on a call**, and none waits on effort: #783 and #760 fix the same bug twice; #786 is a finished four-MAJOR upgrade; #775's guard needs four holes closed; #781 implements a design that is not settled. The cheapest progress available is deciding, not building.

**Landed since the previous state block (2026-09-21).** #784 (**#763**) · #789 (**#788**) · #780 · #774 · #687 · #656 · #778 · #773 · #782 · #779 — the authoritative list is ROADMAP §"Merged into v1.28.0 so far", sourced from `git log --oneline --since="2026-09-15" origin/main` (**52 commits** since v1.27.2). **Closed in the same pass:** #608, #662, #603, #665, #672, #699, #725, #751, #763, #788 — and #753 as superseded.

**Merged 2026-09-21 (this round, unreleased):**

- **#687** — **#608**, local Markdown image embeds during ingest, from @Chase07. 30 production files + 4 test files; closes **#608**. The maintainer-side rebase was the unlock — see §"The rebase that could not be pushed" for the fork mechanic, and §"#687 reviewed" for what the review turned on.
- **#656** — config.md's audit-trail metadata on every Apply, in UTC, from @Jan-Heldal. Closes nothing (the issue it answers was already closed); three review rounds, the last two on my own fixes.
- **#774** — **prompts: stop asking the model for what the code writes**, from @DocTpoint. Closes nothing (`Refs #679`). The half that matters is the wire schema: a declared property is a request, and the strict tier lists every property in `required`.
- **#778** — the Windows collection failure in the custom-instruction test, from @x0Lazarus (first contribution). Test-only, one file.
- **#776** + **#777** — the docs-only handoff refresh and the ruleset-restore lesson.

**Merged earlier in v1.28.0 (unreleased):** #750 (#603 slices 2+3) · #757 (#662) · #759 (#751, and transitively #665) · #773 (#699) · #762 + #673 (#672) · #769 · #765 · #761 · #767 · #726 (#725) · #748 · #744 + #746 · #736 (#723/#735) · #739 (#729 Phase 0) · #733 (#669). #750's review is the most instructive of the cycle; see §"Slice 3 reviewed".

**Closed since that snapshot.** **#775** — merged `b3e5a412`; #467 closed. **#760** — merged `fb44868d`; #758 closed. **#701** — closed by decision; its premise does not hold, see §"#701's premise does not hold". **#809** — merged `fd2a1aa3`; #808 auto-closed.

**Still blocked on other people.** **#755** (@weqoocu) — the version bump is three files and can be stripped; the author has not pushed since the review on 2026-10-05. **#786** (iveteamorim) — CI is green end to end; it waits on a live-provider test.

**The Dependabot trio resolved into one PR** — the outcome #764 needed. **#771** (`@ai-sdk/anthropic` → 4.0.56) and **#772** (`ai` → 7.0.105) are **superseded by #786**, which moves `ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai` and `@ai-sdk/openai-compatible` in step to strictly newer versions and removes the `.github/dependabot.yml` hold entry — do not merge them separately. **#770** (TypeScript 5.9.3 → **6.0.3**) stays held on its own: Gate 1 fails on it in CI, and it is a full-codebase type migration, not a PATCH-shaped bump.

**Planning lives in ROADMAP §"v1.29.0 MINOR — Design track"** — scope groups, the hardening-before-reader ordering, and the open decisions. §"v1.28.0 MINOR — Design track" no longer exists; v1.28.0 shipped and its composition record is CHANGELOG §1.28.0. This file carries the *why* and the *how*, never the window schedule.

---

## Work lists — the ROI rule (tier tables archived)

**ROI = (impact × certainty) / effort.** A high-impact item with unknown reproduction cost
ranks below a medium-impact one that is measured, because the second actually ships.
Certainty is how confident we are the fix lands *and* stays landed.

**The queue itself is ROADMAP §"Open decisions".** The tier tables here were that queue's
ancestor. The two dated copies disagreed with each other within two weeks. They also
disagreed with the milestones. They are condensed in [Appendix B](#appendix-b--session-log-dated-blocks-verbatim),
with their reasoning intact. They get the same rule the pre-release snapshots got: a stale
"Next:" list reads as current.

## Superseded snapshots (2026-09-05 → 2026-09-15)

Three pre-release snapshots used to sit here: the v1.27.2 ship day, the v1.27.1 ship
day, and the wave-C merge. Each had its own "Next:" list. They are removed, not archived,
because **the per-version composition record is canonical in
[CHANGELOG.md](./CHANGELOG.md)**. A stale "Next:" list is worse than no list. It reads as
current.

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
- **A comment is a surface too.** GitHub parses closing keywords in issue and PR
  **comments**, not only in a body and a commit. A reply to a reporter can close the issue
  it replies to, so the same scan runs on the comment before it is posted.
- **Print the number, never the verdict.** 2026-10-04: a scan ran with `grep -c -inE`, found
  one hit, and the next line of the same command printed "（空 ✓）" — a verdict typed by hand
  beside a count that contradicted it. The output read clean while the hit sat two lines
  above. The count decides the branch and the branch prints the conclusion; the shell never
  asserts a result the grep did not produce.
- **Fix the sentence, not the check.** The hit was `I did not close #792.` — the #744
  hazard again, a sentence denying the action. Rewritten to `I left the issue open.`, the
  scan re-run to 0, and the **remote** body read back and re-scanned, because the local file
  is not what GitHub merges.
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
| **Complementary memory model** (Issue #358) — wiki pages serve *different* queries than raw notes; do NOT try to make wiki win every query. "Self-improving" = periodic consolidation pass with LLM judgement on past decisions, NOT a smarter ingest path. | AGENTS.md §"Complementary memory model"; ROADMAP §"Design track — the complementary-memory-model items" |
| **Codex OAuth discipline** — credentials in Obsidian SecretStorage ONLY, never in `data.json` / logs / Notices / docs / test fixtures. Sign-out overwrites secret with empty value + clears in-memory state. SecretStorage requires Obsidian 1.11.4 — `manifest.json`/badges MUST NOT advertise older minimum. | AGENTS.md §"Codex OAuth provider architecture" |
| **Bedrock SSO/IAM** (v1.27.0 #425) — three auth modes (API key / SSO / IAM), zero AWS SDK, hand-rolled IAM Identity Center OIDC + SigV4, secrets in `karpathywiki-bedrock-sso` / `karpathywiki-bedrock-iam` SecretStorage only. Three isolated constants (`BEDROCK_MANTLE_SIGNING_SERVICE='bedrock'`, content-sha256 switch, portal-host bearer scheme) are the only dials a real-AWS E2E would need. | CHANGELOG §1.27.0 — Bedrock Stage 2 |
| **Force-disable thinking** (v1.26.0 Batch 6 + PR #411) — Layer 1 `reasoningEffort: 'none'` + Layer 3 400-strip retry via `reasoning-strip-probe.ts` + Layer 4 prompt-level "do not reason step by step". Never write `thinking.type` or `chat_template_kwargs` into provider options — AI SDK zod silently drops them. | AGENTS.md §"Force-disable thinking"; [[feedback_force_disable_thinking_openai_compat_noop]] |
| **Dead-code-as-docs policy** (v1.26.0 Batch 4) — exported symbols with zero production importers have a **half-life of one release cycle**. Wire or delete before next MINOR ships. `pre-release-gate` Phase 2g enforces. | AGENTS.md §"Dead-code-as-docs policy"; [[feedback_dead_code_as_docs]] |
| **Settings panel scope rule** (v1.26.0 Batch 2 lesson) — `advanced-section.ts` = LLM sampling + provider overrides ONLY. Bottom `advanced-settings-section.ts` = dedup thresholds + per-source toggles + storage flags. New toggle? Decide FIRST which scope. | AGENTS.md §"Settings panel scope rule"; [[feedback_settings_panel_naming_collision]] |
| **Architect-level contributors** (v1.26.0+) — currently @DocTpoint with Write role on personal repo; "no push to main" enforced by branch protection, not role. | [[project_architect_contributor_policy]] |
| **Floor / ceiling asymmetry** (2026-09-16, **proposed** on #729 — not "decided", see that section's status banner) — a `source → LLM → wiki` flow means the model always affects wiki quality; that is unavoidable and not worth pretending otherwise. What the architecture controls is *which parts* depend on it. Model-independent mechanisms hold the **floor** (a user on a small local model still gets real structure, and upgrading a model cannot retroactively improve a graph that is meant to accumulate); model-dependent mechanisms exist to explore the **ceiling** and are **deferred, never rejected** — closing that door is its own defect. `docs/MODEL-GUIDE.md` already commits to the same asymmetry from the model side: "instruction-following quality matters more than raw IQ for the extraction task". **@DocTpoint argues the ceiling should come from the notes too, i.e. M2 rejected rather than deferred; the maintainer agrees and the issue still says "deferred".** | ROADMAP §"v1.29.0 MINOR — Design track"; MEMORY §"Design record — cross-source relations" |

---

## Design records — see Appendix A

Four records used to sit here in full. They are now at the end of this file, in
[Appendix A](#appendix-a--design-records-verbatim-moved-back-from-docs), verbatim.

- **Cross-source relations (#729)**
- **Write path and page index (#603 / #662)**
- **The streaming fallback classifies by URL (#741)**
- **#701's premise does not hold**

They record shipped work. The *argument* was the part nothing else reproduced. So the
argument moved to a page that calls itself an archive. It did not stay in a file whose
own header says it is not a session log. The standing decisions stay above, in
§"Key design decisions (canonical references)".

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

### A cache's lifetime belongs to the file, not to the command that wrote it (#317, 2026-10-18)

`SchemaManager` cached the body of `wiki/schema/config.md`. The cache was invalidated from exactly one place — the plugin's own "apply suggestion" flow. So a user who opened the schema file in the Obsidian editor, changed it, and ran an ingest saw **the old body**, and the edit stayed invisible until Obsidian was restarted. The issue's title, "Schema.md changes are ignored", was literally true.

Two things made it easy to miss.

- **The cache was invalidated somewhere, so it looked maintained.** `invalidateCache()` existed, was tested, and was called. It was called by the one flow that *wrote* the file through the plugin. Every path that *edited* the file by hand went around it.
- **The invalidation was tied to a command rather than to the file.** A command is one way a file can change; a sync, a file drop and a git checkout are others. An event listener would have caught the editor and missed the rest.

**The fix keys the cache on the file's mtime.** No event wiring, no lifecycle, and it catches every way a file can change. The cost is one `getAbstractFileByPath` call — an in-memory lookup, not a read — on the path that was already calling it.

**The general rule: when a cache holds a file's content, the cache key must include something that changes when the file changes.** A boolean "have I loaded this?" is only correct when the file is written exclusively by the code that owns the cache. The moment a user can edit the file, the cache needs a content-derived key — mtime, a hash, or an explicit invalidation wired to the file's own lifecycle.

**Same family, three instances in this repo.** The schema body (this), the term index (#843/#844 — keyed on the index file, so an edited page body left it stale), and the frontmatter alias map that `fix-runners.ts:138` already had to watch with `vault.on('modify')`. Each is a cache whose key did not follow the file it described.

### A repair's target comes from the operation, not from what the model guessed (#824, 2026-10-18)

The orphan-link repair kept the model's guessed target whenever the guess "resolved". Resolving meant "names some page that exists" — a link-hygiene question. The question that decides the repair is "does this target name the orphan?" — a link-identity question. The check answered the first one and was used to decide the second.

Two things made it invisible for months.

- **The model cannot know the orphan's real path.** It sees the orphan's content and the wiki index, never its file name. It guesses a path from the display name. Every guess is wrong by construction — whether or not it happens to hit a page that exists. "The guess resolved" was never evidence that the guess was right.
- **The failure reported success.** The run wrote the link, pushed the page onto the "linked" list, and told the user it was linked — while the orphan gained no inbound link and was reported again on the next run. That is worse than a plain failure: it hides the loop from the user and from the next lint. A report that says "fixed" while the file says otherwise is a false success, and it is worth treating a report and the file as two independent claims that must both hold.

**The rule: name the question the operation must answer, then check that the code asks it.** A guard that answers a nearby question is worse than no guard, because it looks like protection.

**The second-order cost was performance.** The resolver scanned every markdown file and its frontmatter aliases — once per orphan, per run — to answer a question whose answer did not change the outcome. A check whose answer cannot change the result should not exist; it is pure cost. Deleting it also deleted a vault-wide scan.

**Corollary for the duplicate check.** Once the target is always the orphan, "is this link already there?" is a question about *identity*, not spelling. `[[page]]` and `[[page|Label]]` are the same page, and a page linked under the vault path and under the wiki-relative path is the same page too. Comparing whole strings let one page be linked twice under two spellings — the label is presentation, the target is identity.
>
### GitHub hygiene

- **Issue state can drift from merge history.** A PR that fixes Issue N but uses `Refs #N` / `See #N` / no link in its commit message → GitHub does NOT auto-close on merge. Verify with `gh issue view N --json state` before declaring an issue "solved". 5 such state-drift issues found on 2026-08-07 in v1.26.0 alone; remediation is `gh issue close N --comment "Closed by PR #XXX (merged ...)"`. (`feedback_issue_tracker_state_vs_merge_history`)
- **`gh release delete` is irreversible.** v1.25.8 incident: deleted the published release body; recovery required re-publishing from a local `/tmp/release-body-*.md` backup. Rule: edit in place with `gh release edit <tag> --notes-file --draft=false`, never delete. Always verify `tagName + isDraft + body` before editing. (`feedback_gh_release_edit_delete_safety`)

### External communication

- **Never append `🤖 Generated with <AI agent>` (Claude Code, Codex, Cursor, Pi, or any AI marker) to GitHub replies, release notes, or Discussions.** Violates `obsidian-plugin-release` skill; an AI marker breaks voice consistency and reads as spam. If posted, fix via REST PATCH on the comment body. (`feedback_no_ai_marker_in_reply`)
- **Public content (Issues, PRs, Release Notes) must NOT include `[[feedback_*]]` / `[[project_*]]` memory pointers** — session-private wiki-link notation that does NOT render in GitHub markdown and is unreadable by other developers. Reference public docs (AGENTS.md / CHANGELOG.md / SPEC.md) instead. (`feedback_public_content_no_internal_pointers`)
- **GitHub comments: no hard single-`\n` linebreaks between sentences** — they render as `<br>` which is jarring. Use `\n\n` for proper paragraph spacing. (`feedback_github_comment_no_hard_linebreaks`)

### Provider / config reality check

- **Don't doubt existing LLM providers based on name unfamiliarity.** v1.18.2 incident: called MiniMax a typo; user proved it ships in production with a real `baseUrl` (`api.minimaxi.com`). Always verify by baseUrl + live response, never by name recognition. (`feedback_dont_doubt_existing_providers`)

### Build / release mechanics

- **Lockfile regeneration: never `npm install --package-lock-only` in an isolated directory.** v1.23.2 incident: AI-SDK patch versions silently drifted the npm lockfile while pnpm stayed clean. Correct sequence: (1) `rm -f pnpm-lock.yaml && pnpm install`, (2) `npm install --legacy-peer-deps --package-lock-only` in the project dir (where `node_modules` already exists), (3) commit both lockfiles in the same release commit. (`feedback_lockfile_regeneration_procedure`)
- **Post-compaction re-hydration.** After every context compaction, re-read AGENTS.md → CHANGELOG.md → ROADMAP.md → `git log --oneline -20` → open Issues/PRs before continuing any non-trivial change. Compaction erases decisions that look obvious only with full context. (`feedback_post_compact_rehydration`)

### GitHub heuristics & review-event surfaces

- **`Refs #N` semantic can auto-close issues on doc-only PRs.** 2026-07-14: PR #278 (doc-only AGENTS.md/ROADMAP.md) body said "to close #255" and GitHub's heuristic closed #255 even though the PR had zero runtime change. Use "tracked by" / "see" / "blocked by" in doc PR body text. Verify issue state right after merge; `gh issue reopen N` if unexpectedly closed. (`feedback_github_refs_heuristic_close`)
- **Local lint is blind to whole-repo issues.** `pnpm lint` = `eslint src/` only; Obsidian review Bot scans the entire repo `.ts` tree including `tools/`. v1.26.1 shipped a blocking `unsafe-call` Error in `tools/llm-wiki-cli/src/obsidian.ts` (that CLI has since been removed from the repo; the lesson is the scanner's reach, not the file). Run `pnpm lint:tools-bot` before every release. (`feedback_obsidian_bot_tools_cli_warnings`)

### CLI surface (post-PR #511 demote)

- **`pnpm llm-wiki` script no longer exists.** PR #511 (v1.27.0) demoted `tools/llm-wiki-cli/` → `tools/dev-instrument/` (dev-only measurement instrument, NOT a user CLI). The `package.json` `bin` field was removed. **User-facing CLI now lives in the sibling repo [`green-dalii/obsidian-llm-wiki-cli`](https://github.com/green-dalii/obsidian-llm-wiki-cli)** (`npm i -g karpathywiki-cli`). This repo's `tools/dev-instrument/` is for engine contributors only — do not point users at it. (`project_v1_27_0_cli_demote_done`)

### Engine invariants (engine contributors)

- **Dedup halving was dead code.** v1.26.0 Batch 2: counter reset inside the for-loop so concurrency halving never actually halved; `null` and `{"duplicates":[]}` both routed to `[]` conflated truncation with success. Fix PR #411 (Batches 6+7). Future LLM business paths need retry + backoff + halving + log + Notice — extract `callLlmWithRetry<T>()` from `runDedupPhase` before adding a 6th caller. (`feedback_dedup_phase_halving_dead_code`, `feedback_dedup_phase_truncation_vs_empty_conflation`, `feedback_llm_retry_extraction`)
- **`schema/config.md` MUST stay pure user-domain knowledge.** v1.26.0 Batch 1 (Issue #328) fixed the dual-source tag-vocab problem: schema file owns user domain knowledge (page templates, content rules, naming conventions, merge policies); runtime parameters (tag vocabulary, folder layout, output language, page-type registration) MUST be injected at call time via `getSchemaContext()`, never baked into the schema file. Violating reintroduces the dual-source drift Phase 1 was designed to eliminate. (`feedback-schema-phase1-option-a-decision`, `feedback_schema_template_programmatic_injection`)

### PR self-approve & maintainer passby

- **GitHub blocks self-approve on own PR.** Platform hard restriction: `gh pr review <N> --approve` on your own PR fails with `GraphQL: Review Can not approve your own pull request`. **Corrected 2026-10-12: `--admin` alone is NOT enough.** `gh pr merge <N> --admin --squash --delete-branch` is refused with `At least 1 approving review is required by reviewers with write access` **because the ruleset's `bypass_actors` is `[]`** (`current_user_can_bypass: never`), and admin bypass needs a bypass actor to exist. The working sequence is: add a temporary bypass actor for the maintainer's user id, merge with `--admin`, then **restore `bypass_actors: []` and re-read the ruleset as the proof** (§"The ruleset restore can fail, and only the re-read catches it"). A `COMMENTED` review event (`gh pr review <N> --comment --body-file`) is what lands the audit trail, because `--approve` is impossible; document the procedural miss there and do NOT rebase or amend. (`feedback_pr_merge_workflow`, `feedback_pr_review_vs_comment`)
- **Architect-level contributor PRs do NOT need `--admin`.** `@DocTpoint` PRs (and any future architect-level Write-role contributor) can be merged via standard `gh pr merge <N> --squash --delete-branch` once a **cross-account** `--approve` lands — the approver simply must not be the PR author, and `--admin` is only for the own-PR case above. Habitually adding `--admin` to every merge creates branch protection audit noise. **Confirmed 2026-10-12 on #818** (DocTpoint's own PR, approved by the maintainer, merged with plain `--squash`). (`feedback_architect_pr_merge_no_bypass`)
- **The squash merge author is `Greener-Dalii`, and AGENTS.md asks for lowercase `green-dalii`.** GitHub sets the squash commit's author from the account display name, so the canonical-lowercase rule cannot be satisfied through `gh pr merge`. **316 of main's commits carry `Greener-Dalii` against 708 `green-dalii`** (2026-10-12). The rule binds locally-authored commits; treat the squash-merge casing as an accepted platform artifact or amend the rule — do not re-litigate it per merge.

### GraphQL stale-read & reply language

- **`gh issue view --json` returns stale state after `gh issue edit --add-label` or `--milestone`.** GraphQL EOF is intermittent; audit MUST use REST (`gh api /repos/.../issues/N/labels` + `gh api /repos/.../issues/N` for milestone). Repeat retries on a "stale-looking" edit usually just spam GitHub's rate limit — first confirm with REST, then retry if needed. (`feedback_gh_cli_graphql_eof_stale_reads`)
- **Reply drafts MUST match the submitter's language.** English Issue → English reply; Chinese Issue → Chinese reply. The report body can be Chinese (maintainer-facing), but the `#### ✉️ 5. 回复草稿` boxes must match the contributor's language. Drafting all 12 replies in Chinese for an English-submitter pool is condescending to architect-level contributors and breaks codebase convention. (`feedback_reply_language_match_submitter`)

### Cross-release hidden coupling (v1.27.0 ship-day bugs)

- **Path-changing PRs must sync-audit the `readme-links` guard.** v1.27.0 PR #511 demoted `tools/llm-wiki-cli/` → `tools/dev-instrument/`, introducing new paths; PR #560 then added `](tools/dev-instrument/README.md)` relative links to 11 READMEs, which v1.25.11 PATCH #375 (`src/__tests__/root/readme-links.test.ts`) forbids. CI was 11× red from `bd0da25` until a maintainer-passby merge shipped #566 the same day. **Rule:** when a PR moves/renames any repo path that appears in any README, the PR must sync-update every README link to the new path AND verify locally with `pnpm test src/__tests__/root/readme-links.test.ts`. (`feedback_gh_cli_graphql_eof_stale_reads` -- related audit pattern)
- **`pnpm.overrides` is deprecated; pnpm >= 11 silently drops it.** Issue #556 / PR #557: the `pnpm.overrides` and `pnpm.onlyBuiltDependencies` fields in `package.json` print a deprecation warning on pnpm 10.14 and are not read by pnpm 11. Move both keys to `pnpm-workspace.yaml`, keep the top-level `overrides` for npm-side pinning, drop the deprecated `pnpm` block. Future `packageManager` upgrades will silently lose the pin otherwise — same failure class as #501 but on the pnpm half. (`feedback_lockfile_regeneration_procedure` -- related lockfile rule)

---

### Durable rules from the dated sessions (merged 2026-10-06)

The rule blocks below came from the eight dated session sections; their dates and scale are in [Appendix B](#appendix-b--session-log-dated-blocks-verbatim), with the incidents each rule depends on.

**A slash command can move the working tree under you.** `/review pr 809` checks the pull request out locally, so this session's branch silently became `fix/808-stub-template-tag-shape` while `docs/compact-prep-2026-10-05` held the work being edited. The next edit failed to match its anchor in `ROADMAP.md`, and the first reading of that failure was "my anchor text is wrong" rather than "this is the wrong file". `pi-review` registers only slash commands, so it cannot be called as a tool and returns nothing to read. **After `/review`, check `git branch --show-current` before editing anything**, and treat a suddenly-unmatchable anchor as a branch signal.

**The uncommitted-work rule, violated by the person who recorded it.** The first draft of the decision-queue rewrite sat uncommitted while `git checkout main` and `git reset --hard origin/main` ran in the same shell command.
`reset --hard` overwrote the working tree, the edit existed nowhere else, and nothing was staged, so there was no stash to recover from.
The content was rewritten and committed before any branch operation ran.
The rule was already in this file, so this was not a knowledge gap; the command was written without a `git status` first.
**Commit before any command that can reset the worktree, and never combine a branch switch with `reset --hard` while holding edits.**

**A push that succeeded at the wrong ref.** #760's fix went to `fix/lmstudio-hub-model-ids`; the PR head was `fix/758-lmstudio-model-ids`. The push exited 0, the PR head did not move, and a stray branch on the base repo had to be deleted. **Read the PR's `head.ref` and `head.repo.full_name` before pushing, and re-read the head SHA after** — `git push` succeeding is not evidence that the PR moved.

**A test that passed for the wrong reason, caught by reading its output.** A #792 test asserted that no prompt contained `[[Conversation:`. It passed, and the real output showed why: that placeholder is rendered inside the page factory, which the harness replaces with a stub, so the prompt never existed to be asserted on. The test was deleted rather than kept. Same rule as `feedback_tdd_standard`: a green test that cannot fail is worse than no test.

**An `edit` that silently removed a line.** One `oldText` ended inside a comment, so the line above the anchor was dropped and the remaining comment began mid-sentence. **Read the file after an edit, not only before it.** `git diff` is the check.

**A queue that named three options and wrote one.** ROADMAP's #729 row said "Three options in MEMORY §'Seed stage'". That section existed in no file, so the decision could not be taken, and more than one planning pass read the row and moved on. **A decision row must contain the options it asks someone to choose between, or name a destination that exists.**

**A correct number read as a stale one (2026-10-06).** A doc sweep found `4372 tests / 313 files` in five files and I called all five stale, because main now reports 4402 / 317.
Reading the context reversed it: **every one is scoped to v1.28.0** — two carry the date inline, three sit under "latest shipped".
Had I "fixed" them, five correct numbers would have become five wrong ones.
**A number is not stale until its scope is read.**
A count that changes every PR is only safe when it is nailed to a release, and the danger is that it looks identical either way.
The same sweep found the real defects by contrast. The stale *path* is `src/__tests__/llm-sdk/openai-codex-loopback-flow.test.ts`, which moved into an `openai-codex/` subdirectory.
The *count of files that exists* is "10 READMEs (EN + 9 i18n)" — there are 11.
And three links pointed at a deleted target.
Paths and counts-of-things-that-exist are checkable; numbers tied to a dated release are not.

**1. Explaining a technical dispute twice is part of the work, not a failure of the audience.** A first explanation of @DocTpoint's objection was dense enough that the reader asked for it again, and the second attempt was shorter, plainer and better. The signal to watch is not “did they understand the code” but “can they make the decision”. If a summary of a dispute does not end in a choice the reader can make, it is not a summary — it is more of the dispute.

**2. `converged with the maintainer` written 37 minutes after asking for dissent is a false record, not an optimistic one.** The request went out at 10:42.
The record was written at 11:19 and merged at 11:23, and the first reply arrived two days later.
The specific damage is that **the record then outranked the dissent**: Phase 1 was built against a document that said the design was settled, while the objection that disputed it sat unanswered in the thread the document pointed at.
**When a document records a decision, the only evidence that it was a decision is a reply.**
Absent one, the word is `proposed`.
If a direction changes after review has begun, the change and its reason belong in the record the same day, because a stale record is read as current.

**3. A retry loop whose *read* is unreliable duplicates the write.** This session produced **five** identical APPROVED events on #784, two days after the same mistake on #656.
The guard I had installed was the wrong shape: it re-read the reviews list after each attempt, and that read was itself returning empty.
**When the read is flaky, loop on the read alone** — write once, then poll the read until it answers, and never put the write back inside the loop.
The audit trail survived both times only because an approval before a merge is still an approval; the next variant of this may not be so forgiving.

**4. A duplicated fix is a decision, not a queue entry.** #783 and #760 fix the same bug (#758) in two shapes — 1 file of 14 lines versus 4 files with a pure-function seam and its own test file. Neither is wrong, and the right answer is a choice rather than a merge of both. **The cheap-looking one keeps the rule where tests cannot reach it; the structured one carries a guard with four known holes.** Naming which property is worth more than either diff.

**5. Two providers with the same wire format are still two providers.** #786 upgrades four packages together (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/openai-compatible`) and `Closes #764`. It is the correct shape — the three Dependabot attempts proved the individual bumps cannot typecheck — but it is **four MAJORs plus wire behaviour across 29 files**, which is why it was not merged with the three small fixes in the same pass. **A contributor having done the work is not the same as the work being safe.**

**6. A report's scale can change between two API calls.** A check for #789 returned `404`, the next day the same number was a live PR from the maintainer's most active reviewer. **A 404 on a low number near the current maximum is “not yet”, not “does not exist”** — say which one you checked and when, rather than telling the person who asked that the thing they named is not real.

**1. A report's summary of the rule is not the rule. Read the code.**

**2. A documented-but-unreachable state is worse than an undescribed one.**

**3. A graceful-degradation path must name exactly which error it swallows.**

**4. Interleaving text with each media part is how you bind context to it.**

**5. Removing a "redundant" mapping is a change with a reason.**

**6. A push to a fork PR goes to the fork, and its ref name is not your branch name.**

**7. A PR with no CI status may be waiting for maintainer approval.**

**8. Retrying a command whose output you cannot read duplicates its side effects.**

**9. Verify the commit is what the message says — including after `--amend`.**

**10. Two mechanical traps, both hit again this session.**

- **`optionalDependencies` fail silently, and that is how a whole capability disappears.** pi 0.85.1 declares `@earendil-works/pi-server` / `pi-client` as optional.
  The global install skipped them and nothing complained, so background subagents were unavailable — and the error text blamed a "standalone pi binary" that did not exist.
  Diagnose by reading the consumer's resolution code (`runner-aliases.ts::findPeerPackageDir` walks `<pkg>/node_modules` then every ancestor), not the message.
  Fixed by extracting the 0.85.1 tarballs into pi's own `node_modules` — **zero-intrusion (both manifest SHA-256s unchanged), fully reversible with `rm -rf`**.
  Generalise: an optional dependency that a required feature needs is a silent capability hole, not graceful degradation.
- **Read the consumer before trusting an external search.** A research subagent searched Obsidian's docs, correctly found no lockfile requirement, and recommended deleting `package-lock.json`; the real constraint was in this repo's own `.npmrc` post-mortem (Obsidian's pipeline runs `npm install` and compares build hashes, so the file is load-bearing for release reproducibility). **Absence of evidence in vendor documentation is not absence of a constraint** — internal post-mortems outrank external docs for constraints we discovered the hard way.
- **The constraint may be in the prompt, not the architecture.** The Related graph's intra-source shape looked like an inevitable property of "one note → one star". It is literally an instruction at `prompts/ingestion.ts:27`.
- **A log grep can identify the wrong CI step.** "Which step failed" was misread from log text twice — `pnpm install --frozen-lockfile` looked like the failure when it was the *preceding* step's `##[group]Run` echo. `gh run view <id> --json jobs --jq '.jobs[].steps[]'` gives per-step conclusions and is the only trustworthy source.
- **A machine-generated artifact read back as input is a view-as-data bug.** `build-graph.ts` parses `[[links]]` from page bodies without knowing that the Related sections were written by `related-page.ts`, so the graph is largely a render of the ingest's own co-occurrence decisions — which is why PPR cannot discover anything the ingest had not already decided.
- **Test the mechanism before merging it.** #718's workflow was validated on the real Dependabot branch in a throwaway worktree — failure reproduced, regeneration verified, single-file diff confirmed, and **idempotency proven by SHA-256** so the workflow provably cannot loop — *then* merged, *then* confirmed in production on #707 and #708.

**The queue is the work.** Five items are finished and waiting on a call — choosing between #783 and #760, closing #770/#771/#772 once #786 lands, and answering #729. None of them needs an implementation pass, and building on any of them before the call is the mistake this session was spent learning.

**11. A status claim whose action is destructive gets one command against the primary source, and a compaction summary is not a primary source.**

I called #781 "denied by measurement" and recommended closing the PR. The phrase came from a compaction summary of an earlier session, and I repeated it to the maintainer without opening the decision thread or the review body. Both say the opposite: #729's own words hold the PR "until that measurement lands", that measurement never ran, and DocTpoint wrote that his `CHANGES_REQUESTED` is "a statement about the order of the steps, not about your code". The error pointed the expensive way — it would have discarded unfinished work and closed the thread on a reason that was never true. The rule is procedural rather than a reminder: **before any claim whose action is irreversible, run one command against the source the claim is about.** A summary is a pointer to that source, not the source.

**12. Unmarked is not a defect until the other two causes are excluded, and a coverage figure measured only on old corpora describes the corpora.**

The production vault's 25.1 % `source:` marker coverage was read as a write-side defect and turned into queued work. "Unmarked" has three causes and only one is a defect: a `sources/` note cannot link to itself; a page whose `sources:` frontmatter points at an entity or concept page gives `parseSourceSlug` no `[[sources/<slug>]]` to read; and a page written by an older release never recorded that link at all. Only the third is a real gap, and it occurs only in a corpus the current plugin did not write. `test10` settled it in one command — 96.6 %, with its only unmarked pages being its 12 source notes. **Before a coverage number becomes write-side work, name a corpus the current version wrote and check it there.** A related trap sits next to it: the committed `index.md` in those vaults carries **zero** markers on every one of them, because an older plugin wrote those files too. The generator is the authority on what a marker should be — never the index file already on disk.

**The ruleset is clean and verified** (`bypass_actors=0`, `enforcement=active`). Docs-only merges by the maintainer need the temporary bypass actor; other people's PRs do not, because a cross-account `--approve` satisfies the ruleset (#784, #789, #780 all merged that way). **Never silence the restore** — its failure is silent by construction, so it is the one write that must be read back.

**Pushing to a fork PR, the `action_required` CI class, the ruleset restore, and the retry-that-duplicates-its-own-side-effect** are incidents in [Appendix B](#appendix-b--session-log-dated-blocks-verbatim). They are mechanics, not state.

**This environment's reads are intermittently empty, not wrong.** The GraphQL surface returns EOFs, `/pulls/<N>/files` sometimes returns `[]`, and `gh api ... --jq .body` returned empty for a PR whose body was complete — **four times in one session**, once nearly producing a request that the body be written. A blank read is a retry, not a fact. `gh api repos/.../pulls/<N>` is more reliable than `gh pr view`.

**One open decision blocks a later phase, not this one:** #729's toggle placement (bottom Advanced panel vs a home created by #668) — needed before Phase 4.

**Three rules the first compression pass dropped. Restored verbatim on 2026-10-06.** Their
exact wording was lost when the dated sessions were merged. A rule nobody can find by its own
words cannot be reused, so the headlines are back.

**A test can be written to protect a property and end up protecting a spelling.** Three cases
in one week, from two authors and three files: a bundle test asserting
`toContain('import("node:module")')` while its own comment named laziness; `toContain('updated:')`
in the schema-audit test, which passes for the old value and so cannot tell an apply from a
no-op; and #750's fourth assertion, caught by review. **The check that finds it is one question:
what would this assertion still pass on?**

**A rejection message can name the wrong cause, and the fix is the stronger flag.** A `git push`
to a contributor's branch returned `non-fast-forward` — which is what a rebase looks like —
before `--force-with-lease` returned the real `permission denied` (`maintainer_can_modify: false`).
Two attempts went to the wrong diagnosis. Same shape: **verify the merge returned `merged=true`
before restoring a bypass actor**, not that the command exited — restoring first left #773 open
while the script printed success. And never suppress the restore's output: a `>/dev/null 2>&1` on
the ruleset `PUT` hid two network failures and reported "restored" while `bypass_actors` stayed
at 1.

**The bundle is the authority on what is bundled — read the artifact, do not re-derive the set.**
#699 measured ten third-party packages in the shipped `main.js`; the artifact holds **twelve**.
The two it missed (`@vercel/oidc`, `eventsource-parser`) are transitive two levels below anything
`package.json` names. The generator now reads esbuild's own markers
(`// node_modules/.pnpm/<pkg>@<ver>/`), and a test fails when the committed document and the
artifact disagree.

**The dated sessions' remaining durable rules, dropped when those sections were merged. Headlines restored verbatim on 2026-10-06.**

**A dependency experiment leaves `node_modules` ahead of the lockfile, and `git checkout` does not clean it — because it is not tracked.** Hit twice; once 31 `TS2550: Property 'at' does not exist` errors were read as a property of the `@types/node` bump, while the installed tree still held it and `main` was clean. **Any local Gate 1 result after a dependency experiment is untrustworthy until `pnpm install --frozen-lockfile`.**

**The triage skill's dedup step read `--state merged` only, so an OPEN PR already fixing an issue was invisible.** #597 was picked as the highest-ROI unstarted item, implemented and mutation-tested twice, then found to duplicate **#656**, already four review rounds in and one small change from approval. **Fixed in the skill**: Phase 1.5 asks fixed-on-`main` vs in-flight-in-an-open-PR, and Phase 1d pulls every thread roster-wide.

**When you remove a wrong check, ask what it was incidentally holding shut.** `LINT_WRITE_INTENT` stopped reading the ingest controller, which was right — and the old wiring had *also* been preventing a lint write from resurrecting the page the cancelled-ingest cleanup had just deleted. Removing a wrong reason left a right effect unprotected, and nothing replaced it. The fix is now `create: false` plus a test that fails without it.

**Mutations cover the wiring; a correctness finding can live elsewhere — and a guard assertion must itself be mutation-tested.** #750's slice passed all three of its own mutations and still shipped two behaviour regressions. On #467 the guard passed two of three mutations on the first version: the cascade assertion matched the method's own *definition* through a lazy `[\s\S]{0,400}?` span. Both assertions now sit inside one block, bound by `[^}]*`.

**Two version numbers that read opposite to their cost.** `@types/node` 16 → 26 adds nothing this project uses (`node:module` and `node:https` date from Node 15) and **removes** the `compatibility/indexable.d.ts` shim that makes `Array.prototype.at` typecheck under `lib: ES2021`. `obsidian` 1.13.1 deprecates `display()` while its own doc comment calls it a fallback for older versions, so neither bump forces `minAppVersion`. Both were held with the measurement written into `.github/dependabot.yml` rather than left as open PRs #766 and #768. **A version number is a claim about change, not about benefit.**

**Two PRs touching the same file must be reviewed for interaction, not only individually.** #705 added the token-limit guard to `related-page.ts` as `return true`; #714 changed that function's return type to `string | null`. Each passed Gate 1 on its own branch; merged, they left `main` failing `error TS2322` for **five consecutive commits** (`c05d89a0` → `4c3e6ecc`). **Before merging into a file another queued PR also touches, diff the two against each other, not just against `main`.**

**The runtime half of a type error is often worse than the type error.** `updatedPath` became the boolean `true`, so `updated_pages` gained an entry that `repointLinksAfterRun`'s `p.endsWith('.md')` filter drops **silently** — the #713 shape, reintroduced by the fix for #713's sibling. A red type check is the *lucky* outcome; the same mistake in an untyped position ships unnoticed.

**A push-triggered CI failure on `main` has no surface.** #698 added `push: branches: [main]` and it worked as designed — five runs reported `failure`. No PR page carries a red mark, so nobody saw them. **Coverage ≠ visibility.** Until a notification path exists, verify by query: `gh run list --branch main --limit 5 --json headSha,conclusion`.

**`return page.path` was correct semantically, not merely type-correct.** The guard runs after `createOrUpdateFile`, so the frontmatter had landed and the page genuinely was updated — recording it in `updated_pages` is what the link-repoint pass needs. Choosing whichever value satisfies the type checker would have been a coin flip; asking what the call chain does with it decides the question.

**Gate 1 finding a blocker at Step 1 is the gate working.** The alternative was cutting tag `1.27.2` from a five-commit-red `main`. The release flow's order (Gate 1 before any version bump) is what made the failure cheap — no tag to retract, no release to unpublish, no published artifact to amend.

**`pnpm-lock.yaml` had been stale since #692.** #692 regenerated `package-lock.json` for the vitest 5 bump and did not regenerate `pnpm-lock.yaml`; the drift surfaced only at release time (491 → 495 entries). `pnpm install --frozen-lockfile` is the decisive check that the pair agrees with `package.json`. Regenerating **both** is the rule; one is a half-measure that hides until the next release.

**`AGENTS.md`'s "Latest shipped" pointer was two releases behind** (still v1.27.0 / 3677 tests) while v1.27.1 had shipped. It is the first line of the file every agent reads, so it needs the same update pass as CHANGELOG/ROADMAP — not a "docs" afterthought.

**CONTRIBUTING.md carried a whole stale section, not just stale numbers.** Its `tools/llm-wiki-cli/` tree — described as "the current user-facing install path" — had been deleted in v1.27.0 by #511, and its Mermaid diagram still pointed at the removed directory. **Numerical drift is visible; structural drift is not.** Sweep the tree and the diagram, not only the counts.

**Merge-then-label works but verify per item, not per batch.** `gh pr edit --add-label --milestone` on merged PRs succeeds, but GraphQL EOF/TLS flakes timed out the batch verify after 3 of 5 — the remaining two needed an individual retry. Verify each PR's labels and milestone in the same command that sets them, with retries.

**Zero-file-overlap across a same-author wave is checkable in one pass and worth checking.** The five DocTpoint PRs touched disjoint production files (ppr-cascade / related-link-corrector+wiki-engine / llm-client-wrapper / section-extractor / paragraph-provenance+merge/related-page); confirming `交集=∅` up front justified the small-to-large merge order and ruled out cross-PR conflicts without rebases.

**Doc-sync arithmetic must be recomputed from git log, not carried forward.** The CHANGELOG header said "21 PRs … 3677 → 3830" (wave A+B only); the true post-wave-C count is **26 PRs / 3975 tests** — wave C (5) + audit trio (3) + #569/#607 (2, merged 09-04 after the 21-PR doc commit `0ad53c6`) were all missing. `git log --oneline <last-doc-commit>..HEAD` is the source of truth.

**#629 closed the b302aab reasoning-streaming question.** The streamed answer "thought 43/55s" because `taskPolicies` never reached `createMessageStream`; verified reasoning never enters `onChunk`, so the policy gap was the only remaining suspect and #629's diff confirms it. Record the negative result where the question was asked: b302aab (wrap-string format + idempotence guard) cannot cause reasoning streaming.

**#631's accepted inconsistency is now project state.** Rewrite paths are 2-guarded (`merge-page`, `related-page` via `guardBodyRewrite`) / 1-unguarded (`mergeDuplicatePages`, `resolveContradiction`). The follow-up note is in the review comment and the ROADMAP wave-C table — the next person touching either unguarded path must read it first.

**Merge-stack conflicts on shared files are the norm for same-author waves, not the exception.** Wave B's stacked PRs (#606→#610; #569→#607) each carried their base's commits, so when the base merged to main first the child's diff went CONFLICTING. Resolution: fetch head, `git merge origin/main`, resolve per-hunk (keep BOTH sides for complementary changes — `localDateStamp` from #612 + `wikiRelativePagePath` from #606 — keep the child's superset in tests), local Gate 1, force-push to the fork. **Cost:** two force-push cycles (#600, #606, #610).

**`v1.27.0 MINOR` GitHub milestone is a shipped release — it must never receive new open items.** Moving #569/#568/#567 there from PATCH was corrected: a released milestone is closed to new work by definition. Future-work items belong under `v1.27.x PATCH` or a not-yet-created v1.28.0 milestone. **Scale of a PR (35 files) is a code-size observation, not a release-window argument.**

**`shazam_verify` after every edit is a hard requirement the harness enforces — including markdown.** Doc edits to ROADMAP/CHANGELOG trigger the same turn-end verification as code edits.

**DocTpoint's write-audit methodology is the project's best bug-discovery instrument.** Park-previous-version-before-every-write + compare surfaced #613 (573 misdirected source rewrites), #614 (180 mentions losses), #617 (9 sections, 34K chars lost) — three data-corruption classes no fuzz test would find. When a future contributor wants to hunt bugs, copy this pattern.

**Co-maintainer credit landed (PR #619, owner-approved).** DocTpoint is in manifest author + README maintainer + NOTICE. Permission elevation to `maintain` remains a separate decision, still gated on ruleset required-review — credit and permission are different surfaces.

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

## Release cadence (since v1.20.2)

- v1.20.2–v1.24.x: PATCH cadence every 1-2 weeks, occasional MINOR (v1.24.0)
- v1.25.x: 11 PATCH releases in 6 weeks (eucher-era hot-fix cadence)
- v1.26.x: 5 releases (v1.26.0 MINOR + v1.26.1–v1.26.4 PATCH)
- **v1.27.0 MINOR** ships 2026-08-27; **in** v1.27.x PATCH (wave A 09-02: 12 PRs; wave B 09-04: 9 PRs; next release after #569/#607 or community PRs land)

MINOR cadence is roughly every 3-4 PATCH releases or when an architect-level
contributor lands a ≥5-PR cluster. Decision documented in AGENTS.md "PR merge
workflow".

---

## Where to look

- **Project standards & process:** [AGENTS.md](./AGENTS.md) (canonical; the historical [CLAUDE.md](./CLAUDE.md) is now a pointer stub only)
- **Roadmap & planning:** [ROADMAP.md](./ROADMAP.md)
- **Per-version history:** [CHANGELOG.md](./CHANGELOG.md)
- **Contributor guide:** [CONTRIBUTING.md](./CONTRIBUTING.md)
- **Architect-level attribution:** [NOTICE](./NOTICE)
- **Release workflow skill:** `~/.agents/skills/obsidian-plugin-release/SKILL.md` (canonical; legacy aliases `~/.claude/skills/...` and `~/.pi/skills/...` still resolve)
- **Durable rules and current state:** this file ([MEMORY.md](./MEMORY.md)). No per-agent private memory directory is maintained in the repository.
- **History moved out of the live sections:** [Appendix A](#appendix-a--design-records-verbatim-moved-back-from-docs) holds the four design records; [Appendix B](#appendix-b--session-log-dated-blocks-verbatim) holds the dated session blocks and the past ROI tier tables. Neither is current state.

---

**Maintainer:** [@green-dalii](https://github.com/green-dalii) ·
**Repository:** [GD4AI/obsidian-llm-wiki](https://github.com/GD4AI/obsidian-llm-wiki)

---

## Appendix A — Design records (verbatim, moved back from docs/)

The four design records, unchanged. They record shipped work, so the per-version
composition stays in [CHANGELOG.md](./CHANGELOG.md) and the planning view stays in
[ROADMAP.md](./ROADMAP.md). What nothing else reproduces is the *argument*: which option
was rejected, what the measurement showed, which objection was right. Read this before
reopening one of these decisions.

## Design record — cross-source relations (#729, v1.28.0)

> ### ⚠️ STATUS: PROPOSED, and the design thread is OPEN
>
> **This section is not a settled design and must not be read as one.** It was written 2026-09-16 and for four days said it was "converged with the maintainer"; that was **false when written** — #729's request for dissent went out at 10:42, this was recorded at 11:19 and merged at 11:23, and the first reply arrived two days later.
>
> **@DocTpoint's objection of 2026-09-18 is the substantive reply, and it is still open.** It corrects four of the measurements below, shows that acceptance criterion 1 cannot fail, and measures that M0 selects by tie-break rather than by signal. The maintainer's answer of 2026-09-23 accepts the corrections and the M0 defect, and leaves the sequencing question (reader before graph) as a decision. **Nothing in the implementation plan below should be built on before that thread concludes.**
>
> The four measurement-provenance corrections are applied in §"Measurement provenance". They were propagated wrongly here and into #781's PR body; the originals were documented honestly in the source files and the error was mine in transcription.

Recorded 2026-09-16 as a proposal. The planning window lives in ROADMAP §"v1.29.0 MINOR — Design track"; this section is the *why* and the *how*. **Start here if you have no context:** `### The measurement` and `### Root cause` are the whole reason this work exists, `### Three mechanisms` is the design, and **`### Implementation plan (ordered phases)` is the build**. The issue is #729.

### Measurement provenance (corrected 2026-09-23)

Four figures in this record were attributed wrongly, and the error was mine in transcription — the source files documented them honestly. @DocTpoint's vocabulary: **"stock"** is unmodified upstream; **"local stack"** is his patched build (deterministic Related sections capped at five, an ingest-order picker, a local micro-embedding for dedup).

| Figure | Actually from | Holds on `main`? | Can it carry weight? |
|---|---|---|---|
| ~95 % of edges intra-source; 9 in 10 pages with no cross-source incoming link | **stock** code, July 2026, again in the rebuild | **yes** | **load-bearing** — it is the premise of #729, and it survives the regime change |
| Arm C lost 3 of 5 questions | query path, **stock** code | **yes** | **load-bearing** — and it lost at the **lexical seed stage**, wrong seeds and not missing paths |
| B ≥ A (wiki pages retrieve at least as well as raw notes) | local stack for the corpus | direction only | motivates the work; **too small to justify a default-on change** |
| M0 re-measured (tie-break behaviour) | local-stack vault, M0 as specified, no model | mechanism yes, numbers approximately | **load-bearing** for how M0 behaves; on `main` there are more links per page, so somewhat fewer ties |
| 374 dead related entries (5 %) | **local stack only** | **no** | **not** a criterion-4 baseline for a stock build |
| Related cap of five, zero violations | **local stack only** | **no** | says nothing about `main`'s shaping — `main` has no cap at all |

### The three findings that reopen the plan

**① Acceptance criterion 1 cannot fail.** M0 creates cross-source edges by definition, so the intra-source share must fall whether the pairs are useful or not — measured 96 % → 56 % on his vault. It is a restatement of what the mechanism does, not a test of it. Success has to be measured at the reader.

**② M0 decides by tie-break, not by signal — and Phase 1 shipped a biased tie-break.** Re-run on the full rebuild with raw count and path-ordered ties: **80 % of the top-3 cuts fall inside a group of equally scored candidates**, median 12 in the group.
**79 % of the chosen entries rest on a single shared target.**
One broad hub alone generates 16.5 % of all candidate pairs.
Titles beginning with "A" are 9.1 % of pages but **17.1 % of the chosen entries**.
The source of the bias is `co-citation.ts`'s tie-break, which the PR describes as a virtue.
A **repeatable arbitary cut is worse than a random one**, because it is repeatable *and* systematically biased.
Adamic-Adar damping reduces the ties (95 % → 84 %) without removing them.
A later rebuild (~100 notes) reproduces the shape.

**③ The root cause is named and then left in place.** `prompts/ingestion.ts:33` is unchanged, so the extractor keeps answering the intra-source question it was asked. And the names it volunteers beyond the source are **not discarded** — `related-shaping.ts:140-141` pushes them to `unanswered` and then writes them, so they land as dead links. A prior-driven path is therefore already running, in the open, **unmeasured**. In the control run, 79 % of unresolved Related targets had never been a candidate.

Also recorded, because each changes a phase: **criterion 4's baseline is not 676 / 870**; **criterion 3 opens M2 at the wrong gap** (a ranking problem inside the vault, not a world-knowledge one); and **`keepFrom` keeps existing entries in front (`related-sections.ts:124`)**, so neither reserved nor additive allocation reaches an existing vault without a migration — Phase 2's pass conditions are not testable on a rebuild until that is decided.

### Where the analysis lives — and the two corrections made since

**The measurement, the root cause, the three mechanisms, the budget table, the allocation algorithm, the definition, the rejection of embeddings and the acceptance criteria are all in [issue #729](https://github.com/GD4AI/obsidian-llm-wiki/issues/729)**, which was written as the design document and is their canonical statement. They were mirrored here for several rounds and had already begun to diverge — this copy carried none of the corrections below and the issue carries none of the phase status. One fact, one place: **read the issue for the design, this section for what changed afterwards and what is left.**

Two corrections were made here after the issue was written, and would otherwise be lost:

- **Two concerns, not three of a kind.** `GRANULARITY_FIX_LIMITS` and the `?? 5` defaults are **extraction** limits — how many entities/concepts to ask for, read by `getGranularityInstruction` and `getGranularityFixLimits`. `SIBLING_CAP` caps **Related list entries**. Both are granularity-keyed and nothing else about them is the same, so they are two tables in `constants.ts`, not one.
- **The `?? 5` count was 4, not 2** — two in `getGranularityInstruction` (`:209`, `:210`) and two in `getGranularityFixLimits` (`:226`, `:227`). Replacing only the documented pair would have left two orphaned defaults, the exact scattering the constant exists to remove.

One claim in the issue did not survive contact, recorded here so Phase 2 does not re-derive it: **`RELATED_BUDGET.siblings` must NOT be read yet** — it is 3/3/2/1/3 where today every granularity gets a flat 3, so consuming it is not behaviour-preserving. Phase 0 shipped it unread on purpose; Phase 2 owns it. **The budget table and the five-step allocation algorithm are in the issue** under §"1. An adaptive Related budget" and §"2. Reserved allocation, with backfill"; they are the specification Phase 2 implements, and a copy here would be a second place to update when it changes. The one property worth carrying at this level: **the cross-source column is a ceiling, never a quota** — a page with no cross-source candidates is not made emptier by the feature.

### Implementation plan (ordered phases)

Each phase is independently mergeable and testable. **Do not start phase N+1 before phase N's pass condition holds.** Phases 1–2 are the feature; 3–4 make it useful and shippable; 0 is a prerequisite; 6 is what decides whether anything model-dependent is ever opened.

- **Phase 0 — centralise the ceilings (no behaviour change). ✅ DONE 2026-09-17.** `SIBLING_CAP` → `RELATED_SIBLING_CAP`, and `GRANULARITY_FIX_LIMITS` + the four (not two) `?? 5` literals → `EXTRACTION_LIMITS` + `CUSTOM_EXTRACTION_LIMIT_DEFAULT`, all in `src/constants.ts`. `RELATED_BUDGET` added, **unread on purpose**. Pass condition met: Gate 1 green, 4170/4170, zero snapshot churn. **`siblings` must NOT be read yet** — it is 2/1 where today every granularity gets 3, so reading it is not behaviour-preserving.
- **Phase 1 — M0, the co-citation projection.** Candidates for page `P` are pages sharing ≥1 outgoing target with `P`, ranked by shared-target count, ties broken by path.
  Exclude self, anything already note-grounded, and anything the vault resolver rejects.
  Wire in as an **optional** dep on `shapeRelatedLists` (`candidates?: (self: string, exclude: ReadonlySet<string>) => string[]`), so existing unit tests keep compiling.
  Run at **write time**, so the edges persist and PPR gets the cross-source reach for free.
  **Pass condition:** projection tests (sharing, ranking, tie determinism, exclusion) plus the suite green **with the dep absent**, **then re-measure the 95 % figure on a rebuild**.
  If this phase alone does not move it, stop — the diagnosis is wrong, not the mechanism.
- **Phase 2 — allocation (reserved + backfill).** The five-step algorithm goes inside `shapeRelatedLists`. Log the truncation count and the cross-source count; the acceptance criteria are unmeasurable without them. **Pass condition:** the reservation holds when candidates exist · freed slots return to note-grounded when they do not · totals never exceed the tier · an orphan still gets its siblings first.
- **Phase 3 — M1, local window ranking.** Call `selectCandidateWindow({ name, context: item.summary }, vaultPool, K)` where `vaultPool` is `getExistingWikiPages`' output and `K` is the tier's **cross-source budget** (30 is the window's own ceiling, not the budget). `wiki-engine.ts:1224` supplies the provider. **Pass condition:** stub-pool tests, determinism, and **no additional LLM call enters the path**.
- **Phase 4 — settings toggle + docs.** Toggle defaults **on**; decide its panel before writing code (content-generation behaviour ⇒ the bottom Advanced panel). 11 locale strings, 11 READMEs, a CHANGELOG entry under the MINOR. **Pass condition:** Gate 1 green, `pnpm lint:tools-bot` clean, i18n parity.
- **Phase 5 — companion: multi-hop query decomposition.** Extend `generateQueryKeywords`'s contract from `Promise<string[]>` to `Promise<{ keywords: string[]; subqueries?: string[] }>` and update its callers and tests — that signature change is the whole cost. Decompose **only** when the model marks the query multi-hop. **Pass condition:** a simple question is provably not decomposed (fixture assertion), a compound one is, and the union-of-seeds path is covered.
- **Phase 6 — measurement, and the only thing that opens M2.** Rebuild a comparable vault, re-measure the intra-source share, re-run the five multi-note questions, and check the dead-related count against the **rebuild's own** control, not the 676 / 870 figure. **M2 (or an embedding) is opened by these numbers, never by preference.**

### Definition, companion, and why not embeddings

- **"Cross-source" = not named by this note's own extraction.** Chosen because `getExistingWikiPages` does not expose per-page `sources`; a provenance-based definition is more precise and more expensive, and should not be paid for before measurement says it matters.
- **Companion: multi-hop query decomposition.** Arm C's three losses are multi-note (compound) questions. Decompose into sub-queries, retrieve per sub-query and union the seeds — **only for queries classified as multi-hop**; over-splitting a simple question is the classic IR regression. The classifier folds into the existing Stage 1.5a call (`generateQueryKeywords`, which already makes an LLM round-trip on this path) so the decision costs no extra latency. Kept in #729 rather than split out: same acceptance harness.
- **Why not embeddings.** `Zero-embedding graph retrieval` is a load-bearing identity claim: README badge line, SEO intents ("Obsidian RAG without embeddings"), the competitor comparison table, README `:229`, and `docs/MODEL-GUIDE.md`.
  README `:229` reads "Most 'AI search' plugins … embed them in a vector DB. We don't." and `docs/MODEL-GUIDE.md` reads "Embedding endpoints are irrelevant — we don't use embeddings".
  It is also a **model-dependent dependency paid by every install**, including users who chose this plugin because it runs fully local — the exact asymmetry the floor/ceiling principle warns about.
  Reopen only if the lexical residual proves material *after* the floor is raised, and let the staged acceptance criteria make that visible.

### Acceptance criteria (staged attribution)

1. **M0 only** — intra-source edge share < 95 % on a comparable rebuild (the model-independent floor).
2. **M0 + M1** — the further drop, plus the five multi-note questions improving in arm C.
3. **M2 justified only if** 1–2 leave the multi-note questions unfixed, or the residual gap is demonstrably semantic (*"how knowledge evolves over time"* against a page titled *Consolidation kernel*).
4. Dead related entries do not increase. **The baseline is *not* 676 / 870** — that is an earlier 136-note alphabetical control run on stock code, 25 % of all Related links. The rebuild's own number is **374 on 2,135 pages (5 %)**, and part of that residual is intended (frontier names are deliberately kept). Both figures come from @DocTpoint's vault and neither is a `main` baseline for a stock build.
5. No regression on single-note questions; the `related-shaping` / `related-sections` suites stay green.
6. Gate 1 green; no settings-schema break; a disable switch exists and defaults **on** (a deliberate default change ⇒ MINOR).

**Files to touch:** `src/constants.ts` (budget table) · `src/core/related-shaping.ts` (import + allocation + candidate hook) · `src/wiki/system-prompts.ts` (table out, `?? 5` replaced) · `src/wiki/wiki-engine.ts:1224` (pass the candidate provider) · `src/__tests__/core/related-shaping.test.ts` (import + reservation / backfill / determinism) · `src/texts/*.ts` ×11 (toggle copy) · README ×11 + CHANGELOG.

### Coupling constraints

Two constraints make the build order non-negotiable, and both were found late — during the 2026-09-16 planning pass, not during design. They are recorded here because the *reason* is what a future reader needs; the schedule table itself is in ROADMAP §"Phase schedule".

- **#729 ships with #664.** #729 adds entries to the Related lists; #664 observes that those lists already grow about two per source and are never pruned. Built separately, #729 raises the ceiling while #664 leaves the floor open — and the measurement that would catch it (Related length over a rebuild) is precisely the one each change would blame the other for.
- **#729 sequences after #668, not parallel to it.** #729 introduces a settings toggle defaulting on; #668 restructures the settings tab. Landing the toggle first means re-homing it twice.
- **#603 is a hard prerequisite for every sub-phase past 0.** The floor-before-ceiling argument applies twice: a faster reader over a store whose write-gate contract does not hold moves the error rather than removing it, and the phase-1 acceptance criterion (intra-source share) is meaningless if the edges it measures can be written by six paths the design does not account for.

### Open questions

- Reserved vs additive (we argue reserved-with-backfill) · the tier numbers (first proposal) · M0 at write time or query time.
- Whether the ceiling deserves more than M2 — for instance a periodic consolidation pass over accumulated pages (the #358 kernel). This design deliberately does not close that door.

---

## Design record — write path and page index (#603 / #662, v1.28.0)

**Design pass, 2026-09-16. No implementation.** Both issues describe a surface problem accurately and enumerate it inaccurately; the enumeration is what decides the design, so it was re-measured from source rather than trusted.

### The gate bundles four concerns, not one

`createOrUpdateFile` (`wiki/wiki-engine.ts:1873-2045`) is documented as the "single write gate with pollution defense". It does four separable things, and callers want different subsets of them:

| # | Concern | Where |
|---|---|---|
| 1 | Pollution correction (display-name, path-prefix, `sources` field) | `:1884-1932` |
| 2 | Heading + provenance normalization (`normalizeHeadingSpacing`, `normalizeProvenanceMarkers`) | `:1940-1945` |
| 3 | IO with retry + path resolution (3 attempts, directory scan, full scan) | `:1947-2045` |
| 4 | Notification + cache invalidation (`onFileWrite`, `invalidatePageCaches`) | 5 exit points |

The gate offers "all four" or "none", and nothing in between is reachable.

### The decisive evidence is already in the codebase

`wiki-engine.ts:845-851` documents a **deliberate** bypass: the PDF sidecar is written via the vault directly because going through the gate "would fire `onFileWrite` + `invalidatePageCaches`, which could trigger auto-ingest cascades if the source folder is watched". That comment is the design conclusion, written early by whoever needed it first: **one gate for every write is the wrong shape**, because concern 4 is sometimes actively harmful. The sidecar wants concern 3 and nothing else.

### Corrections to the two enumerations

**#603** claims six bypassing writers: ❌ **`log-writer.ts` is not one**.
It goes *through* the gate: its header states the vault calls are injected from `WikiEngine`'s `tryReadFile` / `createOrUpdateFile`.
So the issue's list has a false positive.
⚠️ **Missed: `lint/fix-runners.ts:133` and `:604` use `vault.adapter.write`**, below Obsidian's own `vault.modify` eventing.
That is the worst mechanism found, and the one with the least in common with the documented contract.
⚠️ **Missed: `wiki-engine.ts:349` (`markPageComplete`)**, where the engine writes a wiki page's frontmatter **outside its own gate**.
⚠️ **Missed: `lint/phases/preparation.ts:68`** writes wiki pages (the double-nested-link fix); the issue lists only its log.md sibling at `:82`.

**#662** claims eight direct importers of `getExistingWikiPages`: ❌ **`contradictions.ts:37` does not exist** — the file is `contradiction-gates.ts` and calls neither, so the measured count is **7**, not 8. ✅ The 5 s TTL is right (`PAGES_CACHE_TTL_MS = 5000`, `constants.ts:55`) and it is invalidated at `:447` plus five gate exit points. ⚠️ **Missed: `wiki-engine.ts:1104` calls the module function directly**, bypassing the engine's own cached wrapper at `:2120` — the *same self-bypass pattern* as #603's `markPageComplete`, in a second subsystem, which is the real finding: the engine does not consistently use its own front doors.

### Recommendation — split, do not funnel

Funnelling every write through today's gate is not the fix, for the reason the sidecar comment gives; narrowing the contract alone is also insufficient, because five sites genuinely need the guard. The shape that satisfies both:

| Layer | Contents | Who needs it |
|---|---|---|
| **`rawWrite`** | concern 3 — retry, path resolution, create-or-update | everything that writes |
| **`pageGuard`** | concerns 1 + 2 | wiki pages only |
| **`notify`** | concern 4 | anything the watcher must see; the sidecar **opts out explicitly** |

Each call site declares its set, and `types.ts:989`'s contract is narrowed to what the layers actually guarantee. First tiering: **A — real violations** (wiki pages, missing both guard and notify) `link-retarget.ts:185`, `markPageComplete:349`, `fix-runners.ts:133`, `fix-runners.ts:604`, `preparation.ts:68` (five sites, four files) · **B — declare `guard: false` explicitly** `sources-normalizer.ts:247`, `preparation.ts:105`, sidecar `:870/:872` · **C — out of contract, document and leave** `schema-manager.ts` ×5, `apply-suggestion.ts` ×2, `auto-maintain.ts:713`, `disk-cache.ts:155`, `ensure-welcome-note.ts:161`.

**For #662 the issue's proposal is right and its mechanism is the point:** the TTL cache is invalidated *by the writes the ingest itself performs*, so it cannot hold during an ingest no matter how many callers use the wrapper. Routing the 7 direct callers through the engine accessor is hygiene; the fix is a **run-scoped index updated by the writer** — the writer knows what it wrote, so it should tell the index rather than invalidate it.

### Re-measurement (2026-09-17) — three corrections, and the first slice changes

Re-measuring the issues' line numbers against the source before writing any code found **three errors**, and one removes the reason the pass gave for doing tier B first.

| Design record said | Actually | Evidence |
|---|---|---|
| `link-retarget.ts:185` is a tier-A violation | ❌ **Not a violation** — `:33` records it as deliberate, the write goes through `vault.process` because the gate normalizes `sources:` and corrects link pollution, "appropriate for a generated wiki page, not for someone's own note" | declared, and for a good reason |
| `sources-normalizer.ts:247` is a tier-B **source-note** write | ❌ **It writes wiki pages** — the file set is `isInFolderScope(f.path, wikiFolder, …)` | `folder-scope.ts:33` |
| `preparation.ts:105` is a tier-B **source-note** write | ❌ **It writes wiki pages** — it iterates `pageMap`, built from `wikiFiles` | `preparation.ts:34-52` |

**Consequence:** tier B is not "three silent sites" — it is **the sidecar alone, and the sidecar is the most-documented write in the codebase**, so the pass's stated reason for doing B first no longer supports a slice of that shape at all.

### `log.md` proves the gate already spans two file classes

| Caller | What it writes |
|---|---|
| `:283` `indexGenerator.writeFile` | the index — a wiki page, wants **all three** layers |
| `:292` `logWriter.writeFile` | **`log.md` — not a wiki page** |

`pageGuard` (pollution correction + heading/provenance normalization) is **harmful for a log**, not merely meaningless, which is what this pass first assumed. Slice 2 measured it: `LogWriter.pageLinks` builds links from real page paths, so a page named `concepts布局优化` is written as `[[concepts/concepts布局优化]]` (correct), and Pattern B rewrote it to `[[concepts/布局优化]]` — a dead link. That answers the pass's first open question by itself: `pageGuard` must be a **separately declared layer**, not a superset of `createOrUpdateFile`.

### Corrected tiers

- **A — real violations** (wiki pages, missing both guard and notify): `markPageComplete:349` (a page's frontmatter written outside the engine's own gate, with no deliberate note) · `fix-runners.ts:133` and `:604` (`vault.adapter.write`, below Obsidian's event layer) · `preparation.ts:68` (the double-nested-link fix) · **`sources-normalizer.ts:247` and `preparation.ts:105`** (the sources-field repair, writing wiki pages). **Six sites, five files.**
- **B — already declared deliberate, in prose:** the PDF sidecar `:870/:872` (comment at `:848-852`, the evidence the pass itself cites) and `link-retarget.ts:185` (comment at `:33`). Both want `guard: false`; the sidecar also wants `notify: false`. Making the declaration *typed* rather than prose is the whole change — no behaviour moves.
- **C — out of contract, document and leave:** `schema-manager.ts` ×5, `apply-suggestion.ts` ×2, `auto-maintain.ts:713`, `ensure-welcome-note.ts:161`. (`disk-cache.ts:155` is not a vault write.)

### Revised slice plan

Tier B collapsed, so the first slice changes shape: **introduce the three layers and the `WriteIntent` type with zero call-site changes**, `createOrUpdateFile` becoming the "all three" compatibility entry point. Zero behaviour change is provable — the default path must equal today's four concerns one for one — and it establishes the interfaces the later slices consume. Slice 2 converts the two prose-declared bypasses into typed intent (the sidecar to `rawWrite` alone; `log.md` to `rawWrite + notify`, which **is** a behaviour change and needs its own check). Slice 3 takes the six violations one at a time, `fix-runners.ts` last: routing `adapter.write` through the gate fires `onFileWrite` + `invalidatePageCaches`, which can cascade into auto-ingest.

### Open questions

- **Answered 2026-09-17, all three:** `pageGuard` becomes a separate declared layer, not a superset — `log.md` already goes through the gate and is not a wiki page, so a superset would normalize a log · tier B's declaration is **type-level**, with `intent` a **required** parameter, while `createOrUpdateFile(path, content)` stays as the "all three" shorthand so the six existing callers change nothing · `fix-runners.ts`'s `adapter.write` sites are an idiom rather than a decision (no comment says either way), but the fix carries cascade risk and is therefore last, not first.
- **Still open:** whether the sources-field repair sites (`sources-normalizer.ts:247`, `preparation.ts:105`) should *use* the gate or declare `guard: false` because they **are** the guard's repair path. Routing them through it is not circular in effect — after they fix a file the gate finds nothing to do — but it means the repair runs the thing it repairs. Decide before slice 3.

### Slice 1 shipped (2026-09-18) — and the race it surfaced

`4f00823f` (PR #748) split the gate into `writeFileWithIntent` / `rawWrite` + `wiki/page-write-guard.ts`, with `WriteIntent { guard, notify }` and **no default** (a default is how the ambiguity the type exists to remove would return). **Acceptance was zero behaviour change, and exactly one assertion flipped — which is the finding, not a nuisance.** `wiki-engine-ingest.test.ts` asserted a created file's content equalled the raw input, which also excluded the `generation_complete` stamp; that test was passing on a **race**, because `markPageComplete` is deliberately fire-and-forget (`void (async () => …)()`), so whether it landed before the caller resumed depended on how many async frames the write path took, and the split added one. It is now deterministic (5/5 runs), and the assertion was replaced with a **stronger pair** — content present *and* stamp present — not relaxed. **That fire-and-forget stamp is a #603-shaped hole in its own right:** "this page is complete" is not something a reader may rely on immediately after the write returns. Slice 3 owns it.

**Two mutations were run, because pure unit tests cannot see wiring.** Disabling the guard call failed exactly 4 wiring tests (`write-gate-layers.test.ts`) while all 10 pure-unit tests (`page-write-guard.test.ts`) stayed green.
That is the precise split that made the #736 gap invisible.
Removing `onFileWrite` failed exactly 2.
**The `recovered` asymmetry is preserved and encoded**, not silently unified: the two recovery paths never stamped the page while the two ordinary paths did.
Those paths are the NFC/NFD "already exists" write and the exhausted-retries scan.
`rawWrite` returns `'updated' | 'created' | 'recovered'`, so `writeFileWithIntent` can reproduce that exactly.
**A trap worth remembering when extracting regexes:** both pollution patterns carry the `g` flag, and `RegExp.prototype.test` advances `lastIndex` on a global regex.
The inline form was safe only because it rebuilt the literals per call.
Hoisting them to module scope would make every **second** write skip its correction.
The guard keeps them inside the function, and a test calls it four times on the same input requiring all four to correct.

### Slice 2 shipped (2026-09-18) — and the log turned out to be corrupted

The pass said the guard was *meaningless* for a log; measuring found it is **harmful** (the dead link above), so **the fix is a bug fix, not a tidy-up** — which is why the test asserts both directions rather than a single `toContain`. Shipped: `LOG_WRITE_INTENT { guard: false, notify: true, create: true, cancel: 'ingest' }` at the LogWriter injection (`log.md` keeps `notify` — only the guard is dropped) and `RAW_WRITE_INTENT { guard: false, notify: false, create: true, cancel: 'ingest' }` at the PDF sidecar, whose prose bypass at `wiki-engine.ts:845-851` is now a declaration; routing the sidecar through `rawWrite` also gave it the retry and the NFC/NFD recovery the two direct vault calls lacked.

**`guard: false` drops three corrections, not one** (corrected 2026-09-20 in review). The justification above covers only the path-prefix repair; the layer also carries display-name correction and sources normalization, and both are dropped here too. Neither was ever wanted on the log — it has no display name, and its `sources` line is a projected link list rather than the note's — so the narrower edit is the correct outcome rather than a side effect.

**A property that had never been tested:** the sidecar's **not-notify** behaviour is the entire reason the bypass exists (the comment warns of auto-ingest cascades), yet the existing tests asserted only file contents; giving the sidecar `notify: true` would have broken nothing. It now fails one test. **`link-retarget.ts:185` is deliberately out of scope and must stay that way** — it receives an injected `process` and never touches the engine's layers.

### Slice 3 reviewed (2026-09-20) — three findings, two of them mine to own

@DocTpoint returned CHANGES_REQUESTED with **two shipped-behaviour findings and one test finding**. The slice's own three mutations passed before he looked, which is the useful part of the record: **mutations cover the wiring, and neither of these was a wiring question.**

1. **`markPageComplete` gained `vault.create` and could resurrect a deleted page.** `rawWrite` adds **three** things and the third is `create`, so where the old form resolved a `TFile` first and did nothing when it was gone, the new one writes it back. `markPageComplete` is deliberately un-awaited, so it races the cancel cleanup that deletes the page it is stamping — and a stamp that can create writes the page back with `generation_complete: true`, the state #582/#583 exist to prevent. Which side wins is undetermined, so it reproduces intermittently. **Fixed by making it a declared layer:** `WriteIntent` gained `create`, every existing intent is `create: true`, and `STAMP_WRITE_INTENT` is `create: false`; `rawWrite` returns a new `'absent'` outcome rather than an error — nothing happened, on purpose. His probe is now a test, with the interleaving pinned rather than timed.
2. **The lint fixers' writes were governed by the ingest's cancel button.** `writeFileWithIntent` opened with `checkCancelled()`, which read `abortController` — the **ingest** controller. The engine holds two (`lintAbortController` beside it) and they overlap, because `lint-wiki` is registered with no `isIngesting()` guard; so cancelling an ingest aborted an overlapping lint's writes, and cancelling the lint did not touch its own. `runRetagViolations` re-throws AbortError deliberately, so the run tore down with earlier batches already written and the user was never told. **Fixed the same way:** the cancel owner is a declared field — `cancel: 'ingest' | 'lint' | 'none'` — and `LINT_WRITE_INTENT` names `lint`.
3. **The contract test's waiver list could not match on Windows.** The waiver is `'core/disk-cache.ts'` but `relative()` yields `core\disk-cache.ts` on win32, so the lookup missed, `core/disk-cache.ts` stopped being excluded, and both assertions failed there — on the one platform CI never runs. **A guard whose value is that it runs everywhere must normalise the paths it compares.** Now `relPosix()`.

**Two non-blocking notes, both acted on.** The comment stripper cut each line at its first `//` without tracking string literals, so a bypass written after an inline URL was invisible.
That is a scanner whose failure mode is "silently reports a clean tree"; it is a one-pass quote-aware walk now.
And `write-gate-layers.test.ts` claimed to protect "pollution correction outside the content folders" while writing through `createOrUpdateFile` — which production **no longer uses for the log**, the `LogWriter` being its sole writer with `guard: false`.
So the behaviour it claimed to protect was gone and the test still passed.
It is re-pinned on a path that still takes the full gate, with the log named as the counter-example.

**The generalisable part:** a test can be written to protect a *property*, pass for a long time, and then be protecting a *spelling* — the same failure as #751's build test, found in the same week, in a test written by two different people. The check that catches it is asking what the assertion would still pass on. **And "this does nothing useful" and "this is harmful" are different claims, and only the second justifies urgency** — the design pass made the first, and one measurement upgraded it to the second.

---

## Design record — the streaming fallback classifies by URL, not by outcome (#741, v1.28.0)

**Analysis 2026-09-18, from source + history. No implementation.** @aisahpA measured the preflight behaviour on the shipped `c709a162` and raised three points; two are corrections to what #736 shipped, and one contradicts a comment #736 itself wrote.

```
streamWithFallback(url, init)
  ├─ isLocalBaseURL(url)?  → requestUrl   (no CORS, no streaming: whole body at once)
  └─ else try window.fetch → real streaming
            catch TypeError → requestUrl  (silent, buffered)
```

### First principle: the classifier is a proxy for the wrong variable

The capability actually required is **"this method + URL + *header set* is permitted cross-origin by this server"** — a server-side property computed per request; the code decides on `isLocalBaseURL(url)`, a client-side property of the host. That proxy was approximately true when it was written (`6be9258d`, the AI-SDK v6 migration), because the observed population was **bimodal** — cloud hosts returned `ACAO` (`*` or `app://obsidian.md`), local servers returned nothing — and a bimodal population hides proxy errors. Introduce a third kind (a cloud host that is *not* permissive about `app://obsidian.md`) and the proxy is simply wrong.

**Extending the host list cannot fix it, and not because of maintenance burden — it is a type error.** A preflight is triggered by non-safelisted headers, and it succeeds only if the server echoes *every* name from `Access-Control-Request-Headers`.
So the outcome is a function of `(host, method, header set)`.
#736 turned the header set into **user data** via the free-form custom-headers field.
A table keyed on host cannot represent a function of two variables — it structurally cannot cover the case #736 introduced, on any host.
The only faithful representation is **the observed outcome**: try once, remember per host for the session, skip the gamble afterwards.
That also self-heals if a host starts answering `OPTIONS`, with no list to maintain.

### The finding that explains why this took so long: in production the fallback is unobservable

| Layer | What it hides | Evidence |
|---|---|---|
| `streamWithFallback` catches `TypeError` deliberately | the error itself | `:265` — "Successful fallback path is silent (no console.warn) — it would spam logs on every request" |
| every diagnostic is `console.debug` | the trace | `:275/:281/:283/:289` |
| the production build **neutralises** `console.debug` | even that | `esbuild.config.mjs:15` — `const prodBanner = prod ? 'console.debug = function() {};\n' : ''`, injected as main.js's first statement |
| `requestUrl` is a main-process IPC call | the request | aisahpA: bridge requests do not appear in DevTools Network at all — **an empty Network panel is not evidence nothing was sent** |

So in the shipped plugin a CORS-blocked provider degrades from streaming to buffered leaving **no log, no error, and no Network entry** — the only observable is the ~20 s empty pane. The silent-fallback decision was correct for the population it was written for (local servers, where the fallback is *expected and total*, so a warning would be noise on every single call) and was inherited unchanged by a population where the fallback is a **capability downgrade**. One code path, two meanings. This is the same class as MEMORY's "an `optionalDependency` a required feature needs is a silent capability hole": the degradation is designed, the *silence* is the bug.

### The two branches differ in header semantics, not only in streaming

| | `window.fetch` | `requestUrl` |
|---|---|---|
| stack | renderer, browser-arbitrated | main process over IPC |
| CORS | enforced | **not applicable — not a browser fetch** |
| forbidden headers | dropped | unaffected |
| `User-Agent` | **overridden by Chromium** | sent as supplied |
| visible in DevTools Network | yes | **no** |

**The `User-Agent` premise in #736 is inverted, and so is its stated reason.** #736's comment says the header "is a fetch-forbidden header".
It is not — the Fetch standard removed `User-Agent` from the forbidden list (`whatwg/fetch` `dab09b0`, "Allow User-Agent to be set, but not omitted").
**Chromium implemented that and then reverted it** (`chromium/chromium` `079b3a3` reverts `c7d5f1c6`, bug 40450316), with the chromestatus entry still at intent-to-prototype.
So the correct statement is: *spec-permitted, Chromium-policy-suppressed*.
That means the plugin's `karpathywiki/<version>` identity **reaches the wire only on the `requestUrl` branch** — exactly on the hosts that are *not* the default.
#736's purpose included plugin identity; on the preferred branch it never arrives.
aisahpA measured both to Obsidian's UA; the revert explains why.

### The structural limit, precedent, and the recommended shape

`requestUrl` returns a **complete body**; only `window.fetch` exposes `response.body: ReadableStream`, and CORS is enforced by the renderer. Therefore **on a host that blocks CORS, real streaming is architecturally unavailable** — it is not a bug to be routed around; the honest goal is narrower, to route around CORS to recover *identity* and *legible errors* and **tell the user** streaming is off. Adopting `requestUrl` for `opencode` is not a streaming fix; it is a legibility fix.

The project has made this call twice already: `13e57772` (2026-05-15) `fix: CORS for OpenAI-compatible endpoints + Query UX overhaul`, and `c3bb5c11` (2026-06-05) `fix(llm): rewrite AnthropicClient on requestUrl to fix CORS (Closes #95)`. Both concluded the same way — **`requestUrl` is the escape hatch**; the per-call gamble (`streamWithFallback`) arrived later, with the AI-SDK v6 migration, to recover streaming where it is available. The current design is therefore the *union* of two strategies chosen by a proxy — and **the chooser is the weak link, not either branch**.

Recommended shape:

1. **Decide from the outcome, not the URL** — remember the first CORS `TypeError` per host for the session; later calls skip the gamble. Covers user-added headers, no host list, self-healing.
2. **Stop degrading silently** — one `console.warn` plus (given the 20 s empty pane) a first-time Notice per host per session. A no-op `console.debug` is not a signal.
3. **Correct the `User-Agent` claim in code and docs** — either add a non-forbidden identity header (`x-karpathywiki-version`) or state the caveat. The comments #736 wrote assert a false reason and must be fixed regardless of the transport decision.
4. **Keep a preset flag only as a *hint*** for hosts known to answer no `OPTIONS` (`opencode`), never as the mechanism.
5. **Acceptance criteria** (aisahpA's, adopted): first streamed character within ~1 s; no `[STREAM-FETCH] TypeError` from the second streamed call onward; adding a custom header on `kimi`/`gemini` no longer downgrades to a buffered answer.

### What this changes about #736's regression status

`opencode` failing is **not** a #736 regression — that host never worked. The **regression is the free-form header field**: each host's CORS policy is configured against a fixed header set, and #736 made that set user-extensible, so **any user can now silently downgrade their own streaming on any provider**. Combined with the unobservability above, the user gets no way to connect cause to effect.

### Resolution (2026-09-18) — shipped in two steps

**Step 1** (`5f6754f7`) records a cross-origin failure per origin and warns once per origin per session, on `console.warn` — the only channel a shipped build can emit; `AbortError` and plain `Error` are deliberately not recorded, only a `TypeError` is a verdict about the host. **Step 2** (`e150d139`) gives desktop a streaming transport for these origins: `node:https` behind the `Platform.isDesktop` early-exit guard, wrapped as a web `ReadableStream` and handed to AI-SDK as a `Response`.

**A fifth transport was rejected on the way, and the reason must not be forgotten: Electron's `net` module.**
On paper it is the ideal answer — Chromium's network stack, therefore proxy-aware *and* streaming.
But its documented process list is **"Main, Utility"**, and a plugin runs in the renderer.
That is why `node:https` is the only option left, even though it cannot see Obsidian's proxy configuration.
Electron's docs contrast `net` with the Node modules as offering "better support for web proxies".
Because of that gap a failed Node attempt is treated as a verdict about the **transport**, not the request: recorded per origin, then `requestUrl` takes over.
A proxy user therefore lands on exactly the behaviour they had before step 2, paying for the discovery once per origin instead of once per call.
**This is the pattern to reuse** — when a fallback transport has a known environmental failure mode, remember the failure rather than predicting it.

**Bot compliance was verified by control, not by reading.** `node:https` is a Node built-in so `obsidianmd/no-nodejs-modules` applies; a probe file with three shapes produced exactly two reports — the unguarded import and `if (!Platform.isDesktop) { import(…) }` — and **none** for the early-exit form `if (!Platform.isDesktop) throw` at function start. The rule is sourced from Node's own `module.isBuiltin()`, so **`electron` is not covered by it at all**.

**Known limitation, and the reason the issue is closed rather than left open:** mobile is unchanged. It has no Node runtime and `net` is main-process only, so streaming on a CORS-blocked host is not reachable there — not pending work.

---

## Design record — #701's premise does not hold (2026-09-18)

**Decision, not implementation.** #701 writes a `wiki-ingested:` marker into the user's own source notes. It is deferred pending a product decision, and this records why the deferral is about the premise rather than the code.

"This note has been ingested" is a **derived** fact — an assertion about a transformation the plugin performed, not a property of the note. So it can live in three places, and the middle one is not a proposal:

| Home | Owned by | Survives a plugin reset | Survives deleting the wiki |
|---|---|---|---|
| Plugin state (`data.json`) | plugin | ❌ | ❌ |
| **The wiki's own artifact** — `wiki/sources/*.md` carrying `contentHash` + `source_file` | plugin | ✅ | n/a |
| The user's source note (frontmatter marker) | **the user** | ✅ | ✅ |

`buildIngestedHashes()` (`wiki-engine.ts:477`) is documented as *"Content hashes already present in the wiki, read from source-page frontmatter"*, `wiki-engine.ts:1775` writes `contentHash` onto every sources page, and `scanners.ts:485` already uses the same field for source-drift detection.

**Both cited failure modes are already handled.** (1) "a folder re-run after the batch cache restarts" — the batch cache is `ingestedHashesCache`, a TTL memoisation, and when it expires `buildIngestedHashes()` **recomputes the set from the wiki pages**.
The cache is not the record; the wiki is.
(2) "a user re-adding the same note body under a different name" — already deduped, because `hashBody` (`source-requirements.ts:77`) is FNV-1a over the trimmed, whitespace-normalised **body only**: no path, no filename, no frontmatter.
The same body under any name hashes identically and is caught by `ingested.has(hash)`.
**No case was found that the marker fixes and the hash does not.**

**Two problems the marker introduces.** It writes a derived fact into the user's input: the wiki is the plugin's output space and the note is the user's.
`README.md:114` promises *"The plugin modifies nothing in your original notes"* in all eleven locales.
Its failure mode is also the user's main recovery action: deleting a `wiki/sources/` page — or the whole `wiki/` folder — is how someone forces a rebuild.
The hash mechanism cooperates: remove the artifact, the fact is gone, the note re-ingests.
The marker opposes it, because the note still says "done" while the page is gone.
A rebuild then silently skips exactly the notes the user was trying to rebuild.
A second source of truth does not stay in agreement, and here disagreeing is not neutral.

**What would reopen this:** a specific, demonstrated case the hash mechanism misses — an observation, not a reasoning chain. Any redesign should keep the fact on the wiki side.

---

## Appendix B — Session log (dated blocks, verbatim)

Condensed 2026-10-06. The rules those sessions produced are in [§"Lessons learned (from session memory)"](#lessons-learned-from-session-memory); only the incidents a rule depends on are kept here. **This is history, not current state** — GitHub and git history are the authority for state. Per-session state pointers (`main` SHA, test counts, open-PR lists, local-branch lists) were dropped as superseded.

### Sessions, one line each

| Date | Theme | Scale |
|---|---|---|
| 2026-10-03 | the dissent I never answered, and the report that was not a review; queued #791, #792; filed #793 | Gate 1 313 files / 4363 tests |
| 2026-09-21 | #687/#656/#774/#778 merges, #760 review round, the CI that never ran | Gate 1 311 files / 4349 tests |
| 2026-09-20 | skill audit, build-config layer, three dependency holds; merged #757, #759, #761, #762, #765, #767, #769, #773, #750; closed #603, #662, #665, #672, #699, #751, #753 (superseded); filed #763, #764 | 4240 → 4285 tests |
| 2026-09-16 | cross-source direction + Dependabot lockfile root fix; #718 closed by #727 (`e9be7f75`), #707 `3f0fc9a2` and #708 `7cc50bf9` merged | `main` `7cc50bf9` |
| post-compact 2026-10-03 | the resume point: next actions #791 and #792's self-check, in that order. #791 is a blank answer (a reasoning-only reply); #792's slug path can be inspected without waiting for its reporter; neither depends on the #729 decision | — |
| 2026-09-15 | v1.27.2 release prep, main-is-red regression forensics | — |
| 2026-09-05 | wave-C 5-PR merge + audit-trio + doc sync; merged #630 → #629 → #625 → #626 → #631 (audits #632/#633/#634 already on main as base) | `bf3cd3d` → `ddf392d`; 3932 → 3975 tests (279 files) |
| 2026-09-04 | wave-B rewrite-safety audit + 21-PR PATCH wave (wave A 12 on 09-02, wave B 9 on 09-04), DocTpoint's rewrite-safety audit on a 413-note German vault | `7c4d144` → `8feb5fd`; 3677 → 3830 tests |

### Incidents the rules depend on

- **2026-09-21.** The #758 excerpt quotes two lines and omits the `openrouter` branch that precedes them.
  Its prose — "drops every id containing `/` for all providers except ollama" — inherits the omission, so both halves are wrong.
  `/` was rejected for ollama too (ollama's exemption is `:`).
  Openrouter was the provider left unfiltered.
  **I copied the report's sentence into three files** (module header, test header, PR body), and @DocTpoint caught it, along with the file contradicting itself two paragraphs later.
  The report's *diagnosis of the symptom* was exact and its repro was solid: verified HTTP 200 for a namespaced id.
  Only its summary of what it was measuring against was wrong.
  **Write the rule from the code, and if you are quoting a report, say so.**
  The same review found a second inversion in the same block: "Widening the filter is the smaller change" said the opposite of the paragraph it sat in, which argues for *listing* providers instead.
- **2026-09-21.** `ModelSelectionPatch.useCustomModel` has documented `true` as "the field is the user's own" since the PR opened, and **no branch returned it**, so a model picked from the catalogue and later vanished from the endpoint kept the id in settings and showed the dropdown's "Custom input…" sentinel — the value visible nowhere, and re-choosing the already-selected sentinel fires no `change`, so the text field cannot be opened either. **When a type's doc comment describes a state, grep for who produces it.**
- **2026-09-21.** #687's image analysis is the model to copy — three outcomes, three explicit classes, and the swallow is the narrow one:

  ```ts
  if (error instanceof DOMException && error.name === 'AbortError') throw error;  // cancel still cancels
  if (!isVisionInputRejected(error)) throw error;                                 // everything else propagates
  report.failedPackages++;                                                        // only then degrade
  ```

  The alternative — `catch { /* no evidence */ }` — converts auth failures, rate limits and network errors into "the model found nothing", indistinguishable from a working feature on an unhelpful image. `isVisionInputRejected` is a bidirectional 80-char regex (`image|vision|multimodal|content_type` against `unsupported|not supported|invalid|reject`, either order), and a false **negative** propagates rather than degrading silently — the right failure direction.
- **2026-09-21.** #687 sends, per image, a text part (`Image N`, its path, its nearest before/after paragraphs, and the sentence "The image content block immediately following this text is Image N") **immediately followed by** that image; one text block followed by N images leaves the association for the model to guess, and it guesses wrong on transcripts of screenshots. Each package's response is **verifiable**: the code checks every returned index against the indices it sent, ignores and warns on invalid or duplicate ones, and counts the missing ones. `messages: messages.map((m) => ({ role: m.role, content: m.content }))` appeared in four provider clients and looked like a no-op; it was what **blocked multimodal parts**, and removing it was safe because of the type union that replaced the inline type — `user` accepts `MessageContentPart[]`, `assistant` is `Exclude<MessageContentPart, ImageContentPart>[]`.
- **2026-09-21.** #687's head repo is `Chase07/obsidian-llm-wiki`, its ref `feat/608-embedded-markdown-images`; `git push origin pr-687:refs/heads/feat/analyze-embedded-images` printed `[new branch]` — success, zero effect — and created a stray branch in **our** repo. **`git ls-remote --heads origin <ref>` returning nothing is the tell.** Five runs also sat in `action_required` (@x0Lazarus's first contribution, @Chase07's rebase, all three Dependabot PRs), so **none of them had ever run** and the absence read as "CI is broken" or "the change is fine": `gh api 'repos/.../actions/runs?status=action_required'` lists them, `POST .../runs/<id>/approve` releases one.
- **2026-09-21.** A `gh pr review --approve` retry loop that grepped stdout produced **three identical APPROVED events**; the confirmation to write is a **read** of `pulls/<N>/reviews`, never the exit status of the command that wrote it. Separately: `sed` on a line containing `/` needs a different delimiter, and a `s#...#...#` that contains `#` fails with an opaque `bad flag in substitute command` — **the file is left unmodified and no error propagates to the commit**. The pre-commit hook runs the tools-bot lint over `main.js` and `tools/`, producing **669 pre-existing findings** that block an unrelated docs commit; `--no-verify` is legitimate there because `lint:tools-bot` is documented as informational and exits 0. Carried forward from #736, and it held: `git status --porcelain` must be empty right after every commit, and an amend that changes *content* needs `git add` first.
- **2026-09-20.** A dependency experiment leaves `node_modules` ahead of the lockfile, and `git checkout` does not clean it — it is not tracked. Hit twice; the second time 31 `TS2550: Property 'at' does not exist` errors were presented as a property of the `@types/node` bump, when the installed tree still held the bumped package. **Any local Gate 1 result after a dependency experiment is untrustworthy until `pnpm install --frozen-lockfile`.** The triage skill's dedup step read `--state merged` only, so an OPEN PR already fixing an issue was invisible: #597 was picked as the highest-ROI unstarted item, implemented and mutation-tested twice, then found to duplicate **#656**, already four review rounds in. **Fixed in the skill**: Phase 1.5 asks two separate questions (fixed on `main`? vs **in flight in an open PR?**) and Phase 1d pulls every thread roster-wide.
- **2026-09-20.** A test can protect a property and end up protecting a spelling — three instances in one week, two authors, three files: the bundle test asserting `toContain('import("node:module")')` while its own comment said the requirement was laziness; `toContain('updated:')` in the schema-audit test, which passes for the old value; and #750's fourth assertion, caught by review. **The check is one question: what would this assertion still pass on?** And when you remove a wrong check, ask what it was incidentally holding shut: `LINT_WRITE_INTENT` stopped reading the ingest controller, which was right, and the old wiring had *also* been preventing a lint write from resurrecting the page the cancelled-ingest cleanup had just deleted — now `create: false` plus a test that fails without it. Mutations cover the wiring, not correctness: #750's slice passed all three of its own mutations and still shipped two behaviour regressions, and on #467 the guard passed two of three mutations on its first version (the cascade assertion matched the method's own *definition* through a lazy `[\s\S]{0,400}?` span).
- **2026-09-20.** Two version numbers that read opposite to their cost: `@types/node` 16 → 26 adds nothing this project uses (`node:module` and `node:https` date from Node 15) and **removes** the `compatibility/indexable.d.ts` shim that makes `Array.prototype.at` typecheck under `lib: ES2021`; and `obsidian` 1.13.1 deprecates `display()` while its own doc comment calls it *"a fallback for plugins that need to support Obsidian versions older than 1.13.0"* — so neither bump forces `minAppVersion`, and both were held with the measurement written into `.github/dependabot.yml` rather than left as open PRs #766 and #768. **A version number is a claim about change, not about benefit.**
- **2026-09-20.** `git push` to a contributor's branch came back `non-fast-forward` — which is just what a rebase looks like — before `--force-with-lease` returned the real `permission denied` (`maintainer_can_modify: false`). **Verify the merge returned `merged=true`** before restoring a bypass actor, not that the command exited: restoring first left #773 open while the script printed success. **Never suppress the restore's output** — a `>/dev/null 2>&1` on the ruleset `PUT` hid two network failures, so the run reported "restored" while `bypass_actors` stayed at 1. The bundle is also the authority on what is bundled: #699 measured ten third-party packages in the shipped `main.js` and the artifact contains **twelve** (`@vercel/oidc`, `eventsource-parser`, both transitive two levels below anything `package.json` names), so the generator now reads esbuild's own `// node_modules/.pnpm/<pkg>@<ver>/` markers and a test fails when the committed document and the artifact disagree.
- **2026-09-16.** Issue **#729** — cross-source relations, the first item of the v1.28.0 design track. **Local pi install repaired:** `@earendil-works/pi-{server,client}@0.85.1` placed in `pi-coding-agent/node_modules` — re-apply after any pi reinstall.
- **2026-09-15.** Two PRs touching the same file must be reviewed for interaction, not only individually: #705 added the token-limit guard to `related-page.ts` as `return true`, and #714 changed that function's return type to `string | null`; each passed Gate 1 on its own branch, and merged they left `main` failing `error TS2322` for **five consecutive commits** (`c05d89a0` → `4c3e6ecc`). The runtime half is often worse: `updatedPath` became the boolean `true`, so `updated_pages` gained an entry that `repointLinksAfterRun`'s `p.endsWith('.md')` filter drops **silently** — the #713 shape, reintroduced by the fix for #713's sibling. A push-triggered CI failure on `main` has no surface (#698 added `push: branches: [main]`; five runs reported `failure` with no PR page), so verify by query: `gh run list --branch main --limit 5 --json headSha,conclusion`. `return page.path` was correct semantically, not merely type-correct, because the guard runs *after* `createOrUpdateFile` so the page genuinely was updated. Gate 1 finding a blocker at Step 1 is the gate working — the alternative was cutting tag `1.27.2` from a five-commit-red `main`.
- **2026-09-15.** `pnpm-lock.yaml` had been stale since #692 (491 → 495 entries), and `pnpm install --frozen-lockfile` is the decisive check that the pair agrees with `package.json`. `AGENTS.md`'s "Latest shipped" pointer was two releases behind (still v1.27.0 / 3677 tests) while v1.27.1 had shipped. CONTRIBUTING.md carried a whole stale section: its `tools/llm-wiki-cli/` tree, described as "the current user-facing install path", had been deleted in v1.27.0 by #511, and its Mermaid diagram still pointed at the removed directory. **Numerical drift is visible; structural drift is not.** The org move also made every `green-dalii/obsidian-llm-wiki` URL stale; 376 repo links across 25 files were updated with a negative lookahead so `green-dalii/obsidian-llm-wiki-cli` was protected (the sibling CLI repo did **not** move). The #375 locale-switcher guard now asserts the prefix positively — its previous lookahead-plus-`[a-z]+/` form could not match any `github.com` URL, which is why the drift survived two releases. Ruleset `16884813`: `bypass_actors: []` restored after the #722 merge; `updated_at` 2026-09-15T08:28:50+08:00 proves the revert was the last write.
- **2026-09-05.** Merge-then-label works but verify per item, not per batch — GraphQL EOF/TLS flakes timed out a 3-of-5 batch verify and the remaining two needed an individual retry. Zero-file-overlap across a same-author wave is checkable in one pass: the five DocTpoint PRs touched disjoint production files (ppr-cascade / related-link-corrector+wiki-engine / llm-client-wrapper / section-extractor / paragraph-provenance+merge/related-page), which justified the small-to-large merge order. Doc-sync arithmetic must be recomputed from git log, not carried forward: the inherited CHANGELOG header said "21 PRs … 3677 → 3830" (waves A+B only) while the true post-wave-C count is **26 PRs / 3975 tests**. #629 closed the `b302aab` reasoning-streaming question — verified reasoning never enters `onChunk`, so `taskPolicies` never reaching `createMessageStream` was the only remaining suspect and #629's diff confirms it: **b302aab (wrap-string format + idempotence guard) cannot cause reasoning streaming.** #631's accepted inconsistency is project state: rewrite paths are 2-guarded (`merge-page`, `related-page` via `guardBodyRewrite`) / 1-unguarded (`mergeDuplicatePages`, `resolveContradiction`).
- **2026-09-04.** Merge-stack conflicts on shared files are the norm for same-author waves: wave B's stacked PRs (#606→#610; #569→#607) each carried their base's commits, so when the base merged first the child's diff went CONFLICTING. Resolution: fetch head, `git merge origin/main`, resolve per-hunk (keep BOTH sides when two complementary changes touch the same lines — e.g. `localDateStamp` from #612 + `wikiRelativePagePath` from #606), local Gate 1, force-push to the fork. **Cost:** two force-push cycles (#600, #606, #610). A released GitHub milestone must never receive new open items: moving #569/#568/#567 to `v1.27.0 MINOR` was corrected — **scale of a PR (35 files) is a code-size observation, not a release-window argument.** `shazam_verify` after every edit is a hard requirement the harness enforces, markdown included. DocTpoint's write-audit methodology (park the previous version before every write, then compare) surfaced #613 (573 misdirected source rewrites), #614 (180 mentions losses), #617 (9 sections, 34K chars lost) — three data-corruption classes no fuzz test would find. Co-maintainer credit landed (PR #619, owner-approved): DocTpoint is in manifest author + README maintainer + NOTICE; permission elevation to `maintain` remains a separate decision.

#### Work list (2026-10-03) — ordered by ROI

**ROI = (impact × certainty) / effort.** A high-impact item with unknown reproduction cost ranks below a medium-impact one that is measured, because the second ships. The queue itself is ROADMAP §"Open decisions"; this is the *reasoning* behind its recommendations.

- **Tier 0 — decide, do not build.** Five open items are finished work waiting on a call, not on effort: #783 vs #760 (the same bug twice), #786 (a completed four-MAJOR upgrade), #775 (four holes in its own guard), #781 (implements an unsettled design), and #729 itself.
- **Tier 1 — the two bugs with a user watching.** **#791** — a Query answer arrives **reasoning-only**: every character sits inside `<think>…</think>` and nothing follows the closing tag.
  The user sees a collapsible block and no answer, on a custom OpenAI-compatible endpoint with a reasoning-capable model.
  **The symptom is a blank answer, not a wrong one.**
  `reasoning-strip-probe.ts` exists, so the first question is whether this is a strip that produced nothing or a strip that never ran.
  **#792** — saving a query conversation fails because the generated filename contains `:`.
  The body is empty, but the title names the cause, so the slug path can be inspected without waiting for the reporter.
  If the slug generator has no colon filter, the fix needs no reply at all.
- **Tier 2 — accept into the window, scoped but not started.** **#787** — the source-lemma guarantee assumes a note's filename names a knowledge subject (true for `Klotho.md`, false for a meeting note or a log): a real modelling defect with a clean boundary, in the same region as #729's domain axis. **#468** — Anthropic `createMessageStream` lacks cache breakpoints; narrow, and #687 touched that exact client, so the file is warm.
- **Tier 3 — diagnosis first.** **#703** — a single-file ingest hangs and `cancelIngestion()` cannot abort it; highest impact, lowest certainty, it needs the reporter's file, and it is labelled `help wanted`. **Diagnosis only** — reproduce, locate, write the root cause down, then decide.
- **Tier 4 — the rest.** **#567** · **#676** · **#752** · **#756** · **#668** · **#664** · **#677** · **#701** (needs a product decision; premise refuted) · **#785** (defer — it touches incremental accumulation) · **#793** (`good first issue`). Design anchors rather than tasks: **#330** · **#358**. Measurement research: **#479** · **#480**.

> **Superseded 2026-10-03:** the 2026-09-21 block below is the previous snapshot. Kept for archaeology — do not update it.

#### Work list (2026-09-21) — ordered by ROI

- **Tier 0 — closed since the last planning pass.** **#608** closed 2026-09-21 with **#687**, against the issue's own six acceptance criteria mapped one by one in the closing comment, with the three "possible options" not taken (no note-wide image cap, first-frame GIF only, no analysis cache) named as decisions rather than left to read as gaps. Earlier in the window: **#603** with #750, **#662** with #757, **#751** with #759 (carrying **#665**), **#672** with #762 + #673, **#699** with #773, **#725** with #726.
- **Tier 0′ — the v1.28.0 chain's head is now unblocked.** **#729 Phase 1** (M0 co-citation projection) was hard-blocked on #603 by design, because a reader's acceptance metric is meaningless while the write path's contract does not hold; all three gates are now open — #603 ✅, #662 ✅, #608 ✅ — so Phase 1 was the highest-ROI substantive work left in the window. **`RELATED_BUDGET.siblings` must not be read until Phase 2** — it is 3/3/2/1/3 while today every granularity gets a flat 3.
- **Tier 1 — unblock the queue (no new work for me).** **#775** (#467) — @DocTpoint, requested 2026-09-21; Gate 1 green, nothing left on our side.
  **#760** (#758) — @DocTpoint's re-review; all three points addressed on `a127feb6`, rebased onto `2a4a99b3`, Gate 1 at 312 files / 4361 tests.
  **#755** (@weqoocu) — the author's "one PR or two" answer; the version bump can be stripped by us (three files: `manifest.json`, `package.json`, `CHANGELOG.md`).
  **#701** (@weqoocu) — a product decision; the premise is refuted.
  **#770 / #771 / #772** — nothing; they are red on purpose, and what is owed is a `.github/dependabot.yml` entry per hold, with the reason.
- **Tier 2 — the v1.28.0 feature track, dependency-ordered.** ✅ **#603** (slices 2+3 in **#750**) → ✅ **#662** (**#757**) → ✅ **#608** (**#687**) → **#729 Phase 1** → **#729 Phase 2 + #664 together** (*"they ship together"*: #729 adds Related entries while #664 says those lists already grow ~2 per source and are never pruned) → **#729 Phases 3–6, then #668 + #752 together** (#668 restructures the settings tab and #752 is the sibling bug, so fixing the scroll before the restructure means doing it twice; #729's toggle placement is also gated on #668).
- **Tier 3 — user-facing bugs worth a PATCH.** **#703** (highest impact, lowest certainty; the v1.27.2 release notes carry it as a Known Issue; diagnosis only) · **#468** · **#763** (`writeFileWithIntent` returns `void`, so a skipped lint write is logged as a fix that happened; review scoped it out of #750; scope is 8 production declarations plus ~20 test doubles) · **#676** · **#567** · **#752** · **#756**.
- **Tier 4 — backlog and design.** **#764** is now backed by evidence rather than a hunch: three Dependabot PRs, three different failure modes — #772 spec-v4, #771 the same mismatch in the Anthropic SDK, and #770 TS 6's definite-assignment and variance tightening.
  That is a coordinated upgrade, not a bump.
  **#701** awaits a product decision, not code.
  **#330 / #358** are design anchors rather than tasks.
  **#479 / #480** are measurement research.
  Re-triage at the next planning pass rather than carry indefinitely: **#91, #112, #142, #168, #184, #220, #285, #295, #317, #326, #467, #468, #503, #568**.
  **One correction is owed now: #568's milestone is `v1.27.x PATCH` and it belongs on `v1.28.0 MINOR`**, since the write-side domain axis is a MINOR-track design item and the prerequisite research for #729.
- **Newly filed, unstarted:** **#763** — `writeFileWithIntent` returns `void`, so a skipped lint write is logged as a fix that happened; it needs a return value. **#764** — the coordinated AI SDK v7 upgrade, now with three red PRs behind it.
