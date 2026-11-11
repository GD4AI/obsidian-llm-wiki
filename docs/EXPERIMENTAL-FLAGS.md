# Experimental flags

Four settings exist to keep an older behaviour reachable. They are not preferences. Each one
exists because a change removed a way back, and each is meant to expire.

This file is the register. #933 step 1 asks for one row per flag: why it exists, where it is
read, and the version it expires in. Nothing here removes a setting, and nothing here changes
`data.json`.

## The register

| Flag | Default | Read at | Test of the value | Exists because | Proposed expiry |
|---|---|---|---|---|---|
| `legacyScorer` | off | `select-seeds.ts:145`, `:157` | `settings.legacyScorer ? …` | #819 step 7 made BM25F the default scorer (shipped 1.29.0, PR #842). The two ranks differ — top-5 overlap measured 2.4 of 5 — and a user who sees worse results needs the old path back before the accuracy harness carries evidence. | 1.32.0 |
| `skipMentionOnlyCandidates` | off | `applyCandidateGates` (`wiki-engine.ts:1173`, `:1208`) | `=== true` | #514 / PR #521. It changes *which pages an ingest writes*, so it is the user's choice rather than an upgrade's. Keyed on `wikiLanguage`; a wiki language with no profile reports that it could not apply. | 1.32.0 |
| `gateDissentStubs` | off | `applyCandidateGates` (`wiki-engine.ts:1172`) | `=== true` | S135. When the two gate halves disagree, the candidate becomes a stub from the extraction's own summary instead of being dropped. Needs `skipMentionOnlyCandidates` on, because the table consumes the position verdict that setting opts into. | 1.32.0 |
| `createStubsForUnresolvableLinks` | **on** | `shouldCreateStubForUnresolvableLink` (`fix-dead-link.ts:165`) | `!== false` | #75. When *Fix Dead Links* cannot resolve a target, it writes an empty stub and re-points the link instead of leaving it dead. Default-on, so the flag is an opt-out, not an opt-in. | 1.33.0 |

**The expiry column is a proposal, not an agreement.** Nobody has set a release date. The
dates live in `src/core/experimental-flags.ts`, and `experimental-flags.test.ts` compares each
one to `package.json`'s version — so the release that reaches an expiry fails the suite and
forces the decision. Moving a date is allowed; moving it silently is what the test makes
visible. The register below is checked against that file by the same test, in both directions.

## Three things this table makes visible

**The value test is not uniform.** Three flags are opt-in (`=== true`) and one is an opt-out
(`!== false`). A reader who assumes one convention reads the fourth wrong, and a future
migration that normalises them would flip behaviour for every user who never touched the
setting.

**One flag depends on another.** `gateDissentStubs` has no effect unless
`skipMentionOnlyCandidates` is on. The expiry order therefore matters: removing the second
before the first would leave a setting that enables nothing.

**The expiry is a promise that needs a mechanism.** "Proposed expiry 1.32.0" means: in that
release, the flag is removed, its behaviour becomes unconditional, and the changelog carries
the migration line. This repository's rule is that an escape hatch is not allowed to become
permanent furniture — `legacyScorer` is the current example, and it is named in `AGENTS.md`
§"Which of the three numbers moves" as a MAJOR trigger precisely because removing it removes
a way back. The deadline is enforced in code, so a proposal that nobody carries becomes a
failing test rather than furniture.

## What would make a flag expire early

Each of these is a measurement, not a date:

| Flag | Evidence that retires it |
|---|---|
| `legacyScorer` | The accuracy harness carries a result showing BM25F is not worse on the same vault. The overlap figure (2.4 of 5) says the two orders differ, not which is better. |
| `skipMentionOnlyCandidates` | The candidate gate is reported as a net improvement by users on multi-language vaults, and the "no language profile" path has an answer for every supported wiki language. |
| `gateDissentStubs` | No request for the serial (drop-on-dissent) behaviour since 1.29.0. The outcome table measured equal to the serial path over 1,153 items across three runs, so this flag only exists to undo a page-set change — that measurement is the evidence, waiting only on the same "nobody asked" signal. |
| `createStubsForUnresolvableLinks` | A user reports that stub pages are worse than dead links — the flag exists to undo a default, so the evidence needed is the opposite direction from the other three. |

## Not in this file

`streamIngest` (`'auto' | 'always' | 'never'`, #980) is a deployment choice rather than an
escape hatch: mobile and desktop have different failure modes, and no version removes it. It
belongs with the other per-environment settings, not here.
