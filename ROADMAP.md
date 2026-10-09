# LLM Wiki Plugin Roadmap

> Feature planning and improvement proposals

**Latest shipped:** v1.28.0 MINOR (2026-10-04, 52 commits / 4372 tests). See [CHANGELOG.md §1.28.0](./CHANGELOG.md#1280---2026-10-04) for the canonical composition record. | **Updated:** 2026-10-05
**Next MINOR candidate:** **#729 Phase 1** — the M0 co-citation projection. It was v1.28.0's named head, and **v1.28.0 shipped without it**. On 2026-10-05 the ordering
was **decided: direction A** — one measurement pass comes first, then M0. The measurement's definition, and the defect it also has to fix, are in §"#729 — the three
directions" below. The milestone moved to `v1.29.0 MINOR` on 2026-10-04, so a released milestone carries no unstarted work. Only the release number changed. The four
capabilities that shipped in v1.28.0 are in CHANGELOG §1.28.0.

**Milestone move (2026-10-04).** `v1.28.0 MINOR`'s 12 open items moved to the new `v1.29.0 MINOR`: #787 #764 #756 #752 #729 #677 #668 #664. The four
open PRs are #786 #781 #755 #701. `v1.28.0 MINOR` is now empty and closes with the release.

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
| **Deferred features** | **#701** (source-note `wiki-ingested:` marker — contradicts the `README.md:114` promise in all eleven locales), **#741** (`opencode.ai` fails the CORS preflight, so streamed answers arrive buffered), PR **#728** (`@ai-sdk/openai-compatible` 2→3 MAJOR, request-body shape) | Each needs a decision, or carries a measured caveat this pass did not settle |
| **Community** | **#608** + PR **#687** ✅ **shipped 2026-09-21** (local Markdown image embeds) · **#752** (the settings tab also jumps back to the top — the sibling of #668, and fixing the scroll before #668's restructure means doing it twice) | #687 landed; #752 is still on the milestone |

### ⛔ Open decisions — the queue awaiting the maintainer (2026-10-04)

This is the first section to read after a compact. Each row is a decision, not a task.
The work is done or scoped, and the missing piece is a call. Everything here now sits on
`v1.29.0 MINOR` or `v1.28.x PATCH`; nothing here blocks v1.28.0, which shipped 2026-10-04.

**Milestone map (restructured 2026-10-04, when v1.28.0 shipped).** Three windows are open. Together they hold every open issue and PR — nothing is unassigned:

| Milestone | Open | What belongs in it |
|---|---|---|
| `v1.28.x PATCH` | 12 | Bug fixes, docs and engineering hygiene. No new features |
| `v1.29.0 MINOR` | 16 | New capabilities, and the #729 design track's head |
| `v1.27.0+ research` | 16 | Ideas with no committed version — experimental, or awaiting a design conversation |

The restructure replaced two milestones that had outlived their names. **`v1.27.x PATCH`** still held 11 items under a title naming a window that closed with v1.27.2 on
2026-09-15. Its 10 PATCH-scale items moved to `v1.28.x PATCH`. #568 (an `enhancement`, not a fix) moved to `v1.29.0 MINOR`. **`v1.27.0 MINOR`** was empty and
released, so it was closed. Both rules came from one place: *a released milestone may not carry unstarted work*. That rule is the reason `v1.28.0 MINOR` was emptied
before its own release.

| # | What it is | Why it is waiting | Recommendation |
|---|---|---|---|
| **#729** | Cross-source relations — the design record is **proposed**, and @DocTpoint's objection is unresolved | **The ordering itself is contested**: the measured loss is at the reader's *lexical seed stage*, and a denser graph cannot repair a wrong seed. The milestone moved to `v1.29.0` on 2026-10-04 and it is now the head of that queue. The three directions are set out in §"#729 — the three directions" below | **A — chosen 2026-10-05** |
| **#786** | AI SDK v7 upgrade, `Closes #764`, 29 files `+345/-439`, CI green | Four MAJOR dependencies plus wire behaviour — **not** obviously safe, so it was not merged with the rest | Review the wire snapshots, then merge; **#770/#771/#772 become superseded** |
| **#781** | #729 Phase 1 (the co-citation projection) | **Held** — it implements a design that is not settled | Do not merge until #729 concludes |
| **#755** | Extraction focus and content-requirement settings, from @weqoocu | Two new prompt-level settings — a content-generation behaviour, so it needs the Settings-panel scope call and a decision on whether the prompt should carry them at all | Review the scope first; the settings belong in the bottom Advanced panel either way |
| **#701** | Stamp a `wiki-ingested` marker on sources, from @weqoocu | Its premise **does not hold**: the marker it proposes to write is what the plugin already reads | Close it with the analysis, or re-scope it to the real need |
| **#785** | "Full Reindex" request | It touches **incremental accumulation**, a core design premise | Defer to research |
| **#787** | Let source notes opt out of the source-lemma guarantee | The guarantee assumes a note's filename is a subject; true for `Klotho.md`, false for a meeting note | Accept into the next window |

**Not waiting on a decision, just unstarted:** **#703** (ingest hangs — diagnosis first), **#468**, **#567**, **#676**, **#756**, **#668**, **#664**, **#677**.

**Waiting on someone else, not on a decision:** **#792** — the label that misled the reporter is in #810. The reporter was asked to confirm on the next patch. **#793**
— the `good first issue` label came off on 2026-10-04, and the work remains documentation. The ten translated READMEs quote English command names, and the command name
is stored twice per locale. A verification pass on 2026-10-04 corrected its own table. `README_RU.md` and `README_ZH-Hant.md` are already clean, so the count is 7 files
rather than 10. `README_RU.md` is the better reference, because it already quotes translated names.
**Resolved since this queue was written (2026-10-03):**

- **#791** ✅ fixed by #799
- **#751** ✅ shipped in v1.28.0
- **#753** closed as superseded by #751
- **#467** ✅ closed by #775, whose four review findings are fixed and mutation-checked
- **#758** ✅ closed by #760
- **#752** ✅ closed by #794, which merged after two conflict resolutions in `CHANGELOG.md` alone
- **#783** closed in favour of #760, with @newdeme credited as co-author on the fix
- **#806** ✅ merged as `4b616c0c`, and its CHANGELOG entry as `0cdbbf4a`
- **#808** filed for the two hand-written templates that #806 left out

### #729 — the three directions

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

**Where the work runs.** Not on #781. The measurement decides whether that PR is needed, and putting the decision on the branch under judgement would assume its own
conclusion. The work goes on `feat/729-reader-recall-2026-10-07`, one commit per phase, one PR at the end. #781 stays held and untouched: it returns with the shared
tie-break if the measurement says the graph is short of reachability, and it becomes the negative result this section names if it is not.

Two prerequisite fixes lead, each with a test that fails without it: a seeded rng, and a tie-break that is not the caller's pool order. The tie-break orders by text relevance
before path, because a path-only rule replaces an ordering nobody chose with an alphabetical one — the same defect in a different hat.

The five arms stay as designed, all with the same model, the same character budget, thinking off, truth from the notes, and a blind rater:

| Arm | Retrieval over | What it isolates |
|---|---|---|
| **A** | raw notes, embedding index | the baseline |
| **B** | wiki pages, same index | notes against wiki |
| **C** | the plugin's query path, today | the measured 3-of-5 loss |
| **C′** | C plus the two fixes | the fixes, apart from the budget |
| **E** | C′ plus a reserved cross-source budget, applied by hand | the proposal itself |

The metric is recall@K plus **the cross-source share of the loaded pages**, which the tie-break finding predicts sits near zero. `n >= 20` multi-source questions, with a CJK
subset, because the tokenizer defect is worst in Chinese but is not Chinese-only. The dissent's four conditions for trusting the run apply unchanged. The measurement has two
halves: a synthetic corpus with known truth that runs without anybody, and the real vault at `n >= 20` that needs the maintainer and @DocTpoint.

**The implementation, as phases.** Each carries a test that fails without it, Gate 1 green after each commit, and no phase changes a file format.

**Progress:** **P0 ✅ 2026-10-07** — 20 tests, `node tools/dev-instrument/run-graph-audit.mjs <vault> <wikiFolder> [topK]`. **P1 ✅ 2026-10-07** — `core/retrieval-profile.ts`: one weight table (title 3 / alias 2 / summary 1 / prose 1), the summary tier wired into Stage 1 and Stage 1.5b, `needleHits` moved there so the stages cannot drift. 10 tests. The prose tier is built and tested but the query path does not yet hand it the page bodies: that needs a page-text cache beside `GraphCache`, and it is the next piece. **P2a ✅ 2026-10-07** — the ranking is a function, not a lottery: `monte-carlo-ppr.ts` gains `makeSeededRng`/`seededRngFrom` and `pprCascade` seeds the walk from the query and seed set when the caller supplies no rng; `scorePagesByNeedles` breaks ties by breadth of match, then path. 9 tests. **One claim was wrong and is corrected here:** `candidate-window.ts`'s pool-order tie is a contract, not a lottery — callers pass the pool ctime-ascending and the dedup prompt's KV-prefix cache depends on it. A path-ascending change there broke three tests and was reverted; the contract is now pinned by a test. **P2b ✅ 2026-10-07** — graded CJK matching: a needle that is one continuous CJK run of 4+ characters scores against the page when it shares **two or more** character bigrams, because `tokenizeQuery` hands the lexical stage whole clauses and exact matching made a Chinese query all-or-nothing. Latin and short CJK needles keep the exact rule. 6 tests. It is a floor, not a gradient — a gradient needs IDF weights over a corpus and is a separate step. P3 not started.

| Phase | What it does | Files | Order |
|---|---|---|---|
**The implementation, as phases.** Superseded 2026-10-08 by the architecture
below: the P0-P4 split scattered one scoring function across seven patches. Each
phase carries a test that fails without it, Gate 1 green after each commit.

**The architecture. Four parts, one job each.**

```
representation (segmentation + term index)
   ↓ ranking   (BM25F — one probabilistic function)
   ↓ assembly  (RRF fusion + source coverage + budget)   ← the issue's own symptom
   ↓ fallback  (LLM keyword bridge)                      ← the ceiling of the floor/ceiling framing
graph expansion = a parallel recall channel, not part of ranking
```

A hand-tuned linear weight over text with no IDF keeps producing anomalies —
stop words, generic words, long documents, ties — and every anomaly became
another patch. Eleven had accumulated on one scoring function. BM25F folds the
seven scoring ones into one: the summary and prose tiers become fields, DF
suppression and IDF weighting come from the term statistics, length
normalisation and term saturation come with the function, and continuous scores
make ties rare. `k1 = 1.2` and `b = 0.75` are literature defaults; **the field
weights are not** — dropping the title weight from 3 to 1 moved MRR from 0.86 to
0.55, so they are calibrated on the harness, never assumed.

**Two couplings that fix the order.** Segmentation and BM25F land in the **same**
phase: without segmentation a Chinese query is one token and the IDF table is
built over whole clauses, which is not a ranker. And `lexStrong`'s constants —
`LEX_MATCH_MIN_COUNT = 3`, `LEX_MATCH_MIN_TOP_SCORE = 5`, `lexIsReliable` — are
calibrated on the old score's absolute scale. BM25F has no absolute scale, so
they fail silently. They become relative statistics: the name tier's share of
the query's total IDF.

| Phase | What it does | Order |
|---|---|---|
| **1** | stub pages by the `stub: true` frontmatter flag, take the extraction summary after the boilerplate line | first — the boilerplate words would pollute every later calibration |
| **2** | segmentation + term index + BM25F replacing `scoreProfile`; the old scorer kept behind a switch | **one phase, not two** |
| **3** | `lexStrong` becomes a coverage statistic | silent failure otherwise |
| **4** | determinism, reverse adjacency pre-built in `GraphCache`, the hub-link loop hoisted (380 calls to 20) | orthogonal, independent wins |
| **5** | harness + diagnostic command: four segmentation regimes, a cross-lingual fixture, a seeds-only ablation arm, and a **candidate-pool source count** | accepts 2 and 6 |
| **6** | assembly layer: RRF fusion (`k = 60`) plus source coverage | **precondition measured, see below** |
| **7** | process items; `contextKeywords` as its own PR | it is on the write path |

**What the assembly measurement settled.** On the maintainer's `wiki/` the top-50
candidates for six realistic questions cover **9.3 distinct sources on average**;
the top-10 that actually loads covers **3.5**, dominant source **77 %**. On the
controlled `expB` vault: 4.8 against 3.3, dominant 58 %. The cleanest case is
「强化学习 推理能力」— ten sources in the pool, **one** loaded. So the pool is not
short of cross-source pages; the selection throws them away. That is what the
issue's "reserved budget" was always about, and its native home is the assembly
step, not a new kind of edge.

**Two limits the same measurement found.** Source coverage can only act on pages
carrying a `sources:` ref: **97 %** on a freshly generated vault, **25 %** on the
maintainer's mixed-generation `wiki/` (538 of 2141). The gain moves with the age
of the library. And one of the six questions —「模型 并行 训练」— had a
single-source pool to begin with, where assembly cannot help at all; that is why
the diagnostic command reports the pool's source count.

**M0 is re-scoped, not cancelled.** The assembly step fixes the query. It does
not touch a word of the Related section a human reads, and #358's complementary
memory model makes that reader a real consumer. M0 now serves **reading**, and
its priority depends on how often Related sections are read — which nobody has
measured.

**Shelved: replacing the Monte Carlo walk with power iteration.** The semantic
mapping is a silent-failure risk and this arm's contribution is not yet known;
the seeds-only ablation arm exists to answer exactly that. Restart on three
conditions: the ablation shows the graph arm carries real weight, a comparison
script shows the visit-count semantics can be matched exactly, and lint timing
is measured. The independent wins it promised are already in phase 4.

**Measured 2026-10-08 — three vaults and one controlled pair.** The instrument is
`node tools/dev-instrument/run-graph-audit.mjs <vault> <wikiFolder> [topK]`. It reads and never writes.

| Vault | nodes | edges | planet top-10 | intra-source | top-10 edges | 3-hop directed | 3-hop undirected |
|---|---|---|---|---|---|---|---|
| `wiki/` — mixed generations, 2143 pages | 2143 | 12840 | 14.5% | 34.4% | 6.7% | **12.2%** | **63.7%** |
| `test8/` — one generation | 175 | 850 | 26.6% | 96.7% | 20.0% | 21.4% | 43.8% |
| **expB** — controlled, 5 papers, this branch | 172 | 1000 | 34.9% | **99.7%** | 27.8% | 75.9% | 84.4% |
| **expA** — the same 5 papers, `main` | 164 | 935 | 35.4% | **99.7%** | 18.9% | — | — |

To reproduce the controlled pair: five files from `AI学习资料/` —
*Chain-of-Thought Prompting Elicits Reasoning…*, *DeepSeek_LLM_2024-01*,
*DeepSeek-V2_2024-06*, *DeepSeek_V3_2024-12*, *DeepSeek_V4* — sha256 prefixes
`56be158ff40e`, `67d28ebd25f3`, `bba091c419c0`, `9242c8912923`, `80ed79d9d057`,
ingested one at a time through `tools/dev-instrument/run-instrument.mjs` with
MiniMax-M3 on `anthropic-compatible`, thinking off. Each paper takes 6-13
minutes and produces 28-47 pages. Two of the ten runs failed on a network drop
and succeeded on retry — a run that reports `success false` with
`obsidianFetchBridge network error` is worth one retry before it is read as a
defect.

**What the numbers settle.** The intra-source share is **99.7 % on a freshly
generated vault, on both branches** — so the star shape is the extraction
prompt's doing at `ingestion.ts:33`, not a generator generation. The highest
in-degree nodes are the source pages themselves, one per note, which is the
planet shape directly. And the directed-to-undirected gap is wide on an old
vault (12.2 against 63.7) and narrow on a fresh one (75.9 against 84.4), so a
reverse-edge walk is worth roughly **50 points on the maintainer's `wiki/`** and
about **8 on a new vault**. The estimate changes with the age of the graph, not
with the code.

Three findings set this shape. The verbatim source vocabulary already reaches the page — `prompts/ingestion.ts:30` requires 2-4 verbatim sentences and
`create-page.ts:246-256` writes them as the Mentions section — and the reader never reads them. The index summary is not a summary field: `core/frontmatter.ts:290-291` has
no `summary` key, and `index-generator.ts:137-156` takes the first body line cut at 100 characters, while the extraction's 4-6 sentence summary is used once as a prompt
input and dropped. And `core/hub-link-distinctiveness.ts:7-9` already computes which hub links are mutually redundant and only reports them.

The Related section headings stay as they are. They live in the schema and `section-header-canonicalizer` depends on their labels; renaming them for vocabulary is a breaking
change for a small gain. M2 is rejected rather than deferred for vaults whose ground truth is the notes.

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

### Merged into v1.28.0 — RELEASED 2026-10-04

The per-release composition list now lives in [CHANGELOG.md §1.28.0](./CHANGELOG.md#1280---2026-10-04), which is the canonical record. Detail on what each change settled lives in MEMORY.
This section keeps only the two facts a reader of this file needs: which contributors shipped user-facing work, and that the milestone is closed.

**Contributors.** @Chase07 — local Markdown image embeds (#687). @DocTpoint — one tag vocabulary (#673), per-file page index (#757), ingest Notice stage (#789),
source-page prompt/schema split (#774). @x0Lazarus — Windows custom-instruction paths (#778), lint write counting (#784). @Jan-Heldal — `config.md` audit-trail
metadata (#656). @NotAFlightRisk — the history command's registered name (#780). @abhinav-neander — #794, pending.
Recorded here, not in CHANGELOG — that entry is written once at release. Detail on what each change settled lives in MEMORY. **This list is maintained; when a PR lands, it goes here.**
`git log --oneline --since="2026-09-15" origin/main` is the authority. It currently carries **52 commits** since v1.27.2.

**User-facing:**

- **#799** — **#791**: a gateway that inlines its reasoning into the answer field is now reported. It no longer returns an empty answer in silence. The guard had tested the
  raw field before the thinking block was stripped, and that line dates from v1.19.0. Eight later commits all fixed the separate-channel shape. So the inline shape was never
  covered rather than regressed.
- **#687** — **#608**: opt-in local Markdown image embeds during ingest, from @Chase07. 30 production files + 4 test files.
- **#789** — **#788**: the manual-ingest progress Notice shows the engine's stage, and a finished batch closes it. From @DocTpoint.
- **#784** — **#763**: `writeFileWithIntent` returns whether content was written, so lint stops counting a write that was skipped. From @x0Lazarus.
- **#780** — the welcome note and eleven READMEs name the history command as Obsidian registers it. From @NotAFlightRisk. Follow-up filed as **#793**.
- **#774** — **prompts: stop asking the model for what the code writes**. The wire schema is the half that matters. A declared property is a request, and the strict tier lists
  every property in `required`. From @DocTpoint. `Refs #679`.
- **#656** — `config.md`'s audit-trail metadata on every Apply, in UTC. From @Jan-Heldal.
- **#750** — **#603 slices 2 + 3**: the write-path contract, in three movements. Its four review rounds are the most instructive of the cycle.
- **#757** — **#662**: the page index is held per file. From @DocTpoint.
- **#759** — **#751**: the build-config one-liner that made two shipped features work. Transitive **#665**.
- **#726** · **#653** · **#720** — three lint repairs. A stub's incoming link keeps its name. Dead-link repair prefers the display name. The double-nested repair reaches the file.

**Zero-embedding positioning, kept:**

- **#773** — **#699**: third-party licence notices generated from the built bundle.
- **#762** + **#673** — one tag vocabulary (**#672**), landed as two PRs on purpose. Merging either alone makes nine locales assert the opposite of what ships.
- **#746** + **#744** — **#741**: streaming for origins that block the renderer, over a desktop `node:https` transport. The fallback's failures are recorded.
- **#736** — **#723** + **#735**: custom request headers, an OpenCode preset, a `(Responses)` variant.
- **#761** · **#737** · **#734** · **#745** · **#715** — AGENTS.md process rules.

**Dependencies and internal:**

- **#769** · **#765** · **#767** · **#733** — dependency work. Two deliberate holds with their measurements, the `yaml` bump, and the zod 4 migration (**#669**).
- **#739** — **#729 Phase 0**: the Related and extraction ceilings centralised, behaviour-identical and proven by zero snapshot churn.
- **#748** — the write gate split into `pageGuard` / `rawWrite` / `notify`.
- **#776**, **#777**, **#779**, **#782**, **#730**, **#731**, **#732**, **#742**, **#743**, **#747**, **#749**, **#754** — MEMORY/ROADMAP records and handoffs.

### Ordering decision (2026-09-16)

**Hardening before the reader — done for #603/#662, and the *ordering itself* is now contested.** #603's contract now holds. #662's index is held per file. So the store the
acceptance criteria read from is telling the truth. **#729 Phase 1 is unblocked as of 2026-09-20, and #608 shipped 2026-09-21**. So nothing precedes Phase 1 in the queue.

**⚠️ But @DocTpoint challenges the ordering on measurement (2026-09-18).** Arm C lost 3 of 5 multi-note questions. It lost them **at the lexical seed stage**, not on
reachability. **A denser graph cannot repair a wrong seed** — the work belongs at the stage that actually loses. He also shows that criterion 1 cannot fail. M0 selects by
tie-break. 80 % of cuts fall inside a tie, and 79 % of chosen entries rest on one shared target. The extractor's prior is already leaking unmeasured, and `keepFrom` blocks
both allocation variants on existing vaults. **This was a maintainer-level ordering decision, settled on 2026-10-05 as direction A.** The maintainer's answer is #729's
comment of 2026-09-23. The decision, with the measurement it buys, is in §"#729 — the three directions".

The four review rounds #750 took are the part worth carrying forward. The slice shipped **two behaviour regressions of its own**, despite passing all three of its mutations.
The second of the two was a check it *removed* that had been incidentally holding another door shut. Both findings came from @DocTpoint reading the tree rather than the
description.

**The write-path design pass completed 2026-09-16 and opens the phase-2/3 gate.** It recommends three gates. The gates are `rawWrite`, `pageGuard` and `notify`, rather
than one funnel for every write. **Five real violations in four files** need a fix. Five more sites only need to declare their intent. Both source issues were re-measured,
and **each contained one claim that does not hold**. `log-writer.ts` does go through the gate. `contradictions.ts` does not exist. Each also omitted worse sites than it
listed, including `vault.adapter.write`, which sits below Obsidian's own eventing. Corrected counts and the reasoning are in the MEMORY design record, which phase 2 consumes directly.
Within #729 the mechanisms are ordered **floor-first**. The model-independent mechanism holds the graph's quality *floor*: a co-citation projection over links the vault
already has. It precedes the model-dependent ones that could raise its *ceiling*. Rationale, the three-mechanism table and the budget tiers are in the MEMORY design
record. The principle itself is now a canonical decision (MEMORY §"Key design decisions").

### Phase schedule (2026-09-16, status 2026-10-04)

Dependency-ordered, not priority-ordered. **Phases 1 and 4 have shipped.** Phase 2 is now the head of the queue. It is the only thing standing between this track and a release.

| Phase | Items | Status |
|---|---|---|
| **1 — decouple, take the cheap wins** | #669 zod 4 · #723 custom headers, OpenCode preset, Responses variant (also closed #735) · #603 + #662 design pass | ✅ **shipped in v1.28.0** |
| **2 — #729 itself** | the six sub-phases in MEMORY §"Implementation plan". Sub-phase 0 (centralise the ceilings) ✅ done 2026-09-17, behaviour-identical. **Sub-phase 1 is the head of the queue.** | **not started — the direction is chosen (A); the measurement pass comes before any code** |
| **3 — behaviour layer** | #664 together with #729's allocation · #677 (unblocked when #603 closed) · #668 after #729's toggle has a home | blocked by phase 2 |
| **4 — independent features** | #608 + PR #687 ✅ shipped · #701 (needs its design decision first) · #755, #786 | ✅ shipped, except the three noted |

**Two couplings found during the 2026-09-16 planning pass, still binding:**

- **#729 ↔ #664.** #729 *adds* Related entries. #664 says those lists already grow ~2 per source
  and are never pruned. Designed separately, one raises the ceiling while the other leaves the
  floor open. The measurement that would catch it is Related length over a rebuild. That is exactly
  the one each would blame the other for. **They ship together.**
- **#729 ↔ #668.** #729 introduces a settings toggle that defaults on. #668 restructures the
  settings tab. Land the toggle *after* #668's structure is settled, or it gets re-homed twice.
  Per the Settings-panel scope rule it is bottom-Advanced-panel either way: content-generation
  behaviour, not LLM sampling.

**Open decisions for phase 2**: three, not four. Whether the projection runs at **write time** or **query time**. **Reserved vs additive** cross-source allocation, and where the toggle lands.
The direction call was **decided on 2026-10-05 as A**. All are in #729's thread and in MEMORY §"Design record — cross-source relations".

---

### Community waves 1–3 — 2026-08-21/23 — ALL MERGED

18 PRs from community and architect contributors, reviewed, approved and squash-merged across three waves. Their per-PR records are in [CHANGELOG §1.27.0](./CHANGELOG.md#1270---2026-08-27).
The three tables that used to sit here were removed on 2026-10-04, for the same reason as the wave A–F tables above.
**Two follow-ups from those review threads are still open**, and they are why this stub remains rather than disappearing. The **alias-floor unification** (#537 × #532): route
`enforceFrontmatterConstraints` through `resolveMinAliasLength`, so every alias writer agrees on the floor. The **zh/ja candidate-gate measurement** (#521's debt): the `de`
profile is the only one measured, and the zh/ja thresholds are unmeasured and need a Chinese vault.
**Deferred at the time and still deferred:** **#503** (`userIgnoreFilters`). The decision is recorded as `vault.getConfig` behind a narrow typed interface.
It is blocked on pinning Obsidian's ignore-matching semantics. It sits on the research milestone.

---

## v1.27.x PATCH cycle — SHIPPED 2026-09-06 as v1.27.1, and 2026-09-15 as v1.27.2

**Triggered by:** v1.27.0 MINOR shipped 2026-08-27 (`3464cce`). PATCH backlog is the union of three sources: (a) v1.27.0 ship-day bugs from architect-level triage.
(b) deferred items from v1.27.0 review threads. (c) post-MINOR new Issues filed by @DocTpoint, from 2026-08-28 onwards: the #567 / #568 / #605–#620 series.
**Milestone note (2026-09-04, superseded 2026-10-04):** the `v1.27.0 MINOR` GitHub milestone is CLOSED (released 2026-08-27) and must not carry new work. Open
PATCH/feature items used to live under `v1.27.x PATCH`. That milestone was closed on 2026-10-04, for the same reason: its window ended with v1.27.2. Its items moved to
`v1.28.x PATCH` / `v1.29.0 MINOR`. See the milestone map above the decision queue.

### Shipped into v1.27.x PATCH — waves A–F (2026-08-27 → 09-15)

Six waves shipped across two PATCH releases, v1.27.1 (2026-09-06) and v1.27.2 (2026-09-15). **Their per-PR composition records live in [CHANGELOG §1.27.1](./CHANGELOG.md#1271---2026-09-06)
and [§1.27.2](./CHANGELOG.md#1272---2026-09-15).** The six wave tables are gone. They held 17 PRs in wave E alone, the whole community-wave inventory, and the Tier-0
merge order. They were fully shipped, and they were removed on 2026-10-04 rather than carried forward. A shipped backlog is not a plan. This file keeps only what still
changes a planning decision.

**Two facts from those waves are still binding**, and neither is in the CHANGELOG:

- **#703 does not block a release.** No fix PR exists to wait for. No destructive effect is known, and excluding the file works around it. It ships as a Release Notes Known Issue.
- **Process debt, unfixed:** a push-triggered CI failure on `main` has no PR page to carry a red mark. So a regression can sit red for commits nobody reads. #698 bought
the coverage, not the visibility. Candidate fix: a CI-failure notification path, or a per-session `gh run list --branch main` check.

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
