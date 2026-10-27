# `tools/dev-instrument/` — UPSTREAM DEV-ONLY INSTRUMENT

This is **not** a user-facing CLI. It is the dev-only headless measurement
instrument for the [Karpathy LLM Wiki plugin](https://github.com/GD4AI/obsidian-llm-wiki)
engine. For production ingest, use [`karpathywiki-cli`](https://github.com/green-dalii/obsidian-llm-wiki-cli)
via `npx karpathywiki-cli ingest --sources <path> --wiki <path> --provider <id> --key <key>`.

## What it does

Runs the real `WikiEngine.ingestSource` against a vault on disk with no
Obsidian runtime, and prints per-task token + wall-clock accounting via
`withTokenTracking` (tokens) + the shared `recordTaskUsage` accumulator
in `src/core/llm-task-usage.ts` (calls + millis). This is the source of
the 979s → 365s → 151s evidence in CLAUDE.md §"Force-disable thinking".

## Usage

```bash
WIKI_API_KEY=sk-... node tools/dev-instrument/run-instrument.mjs <vault> <source>
```

Environment assignments MUST precede the command — that is shell grammar,
not a style choice; `[WIKI_API_KEY=...]` placed after the positionals does
not set anything in any shell (PR #511 review).

- `<vault>` — absolute path to an Obsidian vault
- `<source>` — path (relative to vault) of a single source note
- `WIKI_API_KEY` — provider API key; required for non-local providers

### Measurement arms (optional, env-only)

The positional-only CLI cannot express these, so they arrive via env —
always **before** the command:

```bash
WIKI_API_KEY=sk-... WIKI_THINKING_MODE=plugin-off WIKI_TEMP=0.7 WIKI_TOP_P=0.9 \
  node tools/dev-instrument/run-instrument.mjs <vault> <source>
```

- `WIKI_THINKING_MODE` — `data-json` (default: use whatever data.json says) |
  `plugin-off` (force `disableThinking: true`) | `server-default` (force it
  off). Unknown values fail fast instead of silently no-opping.
- `WIKI_TEMP` / `WIKI_TOP_P` — override the extraction sampling settings for
  this run. Non-numeric values fail fast.
- `OBSIDIAN_CONFIG_DIR` — Obsidian config directory name; defaults to
  `.obsidian` (built at runtime as `'.' + 'obsidian'` to avoid the
  `obsidianmd/hardcoded-config-path` Bot rule). Users with a renamed
  config dir must set this env var.

Arms are applied to `settings` before the snapshot and echoed in the
`[cli]` header together with the effective state (`disable-thinking`) and
the data.json per-step policy map (`task-policies`, #490), so a log names
the arm that produced its numbers.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | the engine's ingest report says `success: true`. A requirements-gate skip (empty file, unsupported type, duplicate) is reported by the engine as success + `skipped` and stays `0`; the `=== Summary ===` block names the skip |
| `1` | the report says `success: false`, the engine returned without a report, or the run threw before the engine got the file (missing vault, unreadable `data.json`, unknown measurement arm, missing API key, source not in the vault index) |
| `2` | `<vault> <source>` not given — usage goes to stderr, nothing to stdout |

The code is derived from the report the engine hands `onDone`
(`src/exit-code.ts`), not from whether something threw:
`WikiEngine.ingestSource` happens to rethrow after reporting failure today,
but the contract must not hang on that (Issue #417 secondary, split out of
PR #418). Scripts branch on `$?`; the summary still prints `success` for
humans.

## Why it exists

The Obsidian marketplace review bot scans the whole repo `.ts` tree (per
CLAUDE.md "Bot compliance invariant"). The legacy in-tree CLI
(`tools/llm-wiki-cli/`) accumulated ~70 Bot findings (49 errors / 21
warnings) by v1.26.4 — static `node:*` imports, `console.log` output
interface, `globalThis` shim, hardcoded `.obsidian` literal.

This instrument eliminates every Bot finding while keeping the measurement
primitive (`withTokenTracking` + shared `recordTaskUsage`) intact. It is
the upstream-dev escape hatch for engine contributors who need to validate
per-task real-LLM cost without waiting for sibling repo sync.

## Bot compliance

This directory passes `pnpm lint:tools-bot` with **0 `obsidianmd/*`
findings and 0 errors**. Three local-only `no-unsanitized/method`
findings remain — the dynamic imports of the bundled output in
`run-instrument.mjs`, `run-graph-audit.mjs` and `run-recall-harness.mjs`.
Each carries a one-line disable with its reason, because the argument is a
hardcoded local constant rather than user input, and the rule is not in the
Bot's `obsidianmd/recommended` ruleset. The nine remaining warnings are
`no-unused-vars` on harness scaffolding, which the Bot does not scan in
`.mjs` either.

See issue [#507](https://github.com/GD4AI/obsidian-llm-wiki/issues/507)
for the full migration plan.

## Layout

```
tools/dev-instrument/
├── README.md                       # this file
├── run-instrument.mjs              # entry — bundles engine-runner.ts via esbuild
├── run-context-cost.mjs            # the answer context's cost on a real vault
├── run-conversation-eval.mjs       # conversation-history evaluation (three arms, one pipeline)
├── conversation-cases.json         # the hand-written follow-up cases
├── tsconfig.json                   # ESNext + moduleResolution bundler
├── .gitignore                      # ignores dist/
├── src/
│   ├── engine-runner.ts            # runIngest + main + withTokenTracking + printSummary
│   ├── exit-code.ts                # exit contract: report → 0 / 1, missing positionals → 2
│   ├── vault-fs.ts                 # NodeVault — Obsidian App shim against real fs
│   └── shim.ts                     # TFile / TFolder / Platform / requestUrl / installObsidianGlobals
└── dist/                           # gitignored — esbuild bundle output
    └── run-instrument.mjs
```

## The conversation evaluation

`run-conversation-eval.mjs` measures the two conversation cases that the
corpus-level r@10 numbers cannot see, because the question there is not a
conversation. It runs three arms through the production pipeline —
`planRetrieval` and `selectPprSeeds`, the same two functions `QueryView`
calls — and reports a per-family verdict.

```bash
npx tsx tools/dev-instrument/run-conversation-eval.mjs <vault-dir> \
  --cases tools/dev-instrument/conversation-cases.json --derive --limit 30
```

| arm | what it does | what it stands for |
|---|---|---|
| `none` | the history never reaches the query | the product without conversation history |
| `concat` | the history is appended to the question | the behaviour before the history weighting |
| `weighted` | the history is weighted at 0.3 | the production behaviour |

Two families:

- **topic-switch** — the question asks about a page and the history is about
  other pages. The question's own page must stay at rank 1. Auto-derived
  from the vault's own pages, with the history built from pages that share no
  vocabulary with the question's.
- **follow-up** — the question refers back to the history, so the words that
  identify the page live in the history and not in the question. Hand-written,
  in `conversation-cases.json`, because anaphora is not derivable from a link
  graph.

The verdict is the comparison, not any single number: when `weighted` and
`concat` land on the same figure for a family, the weighting does not change
that family's ranking. `--limit` applies **per family**, so two runs stay
comparable.

## `run-context-cost.mjs` — what one answer sends

A second instrument, separate from the ingest one: it measures the **query**
side, namely the context one answer carries.

It runs the production path in the production order —
`parseIndexForPages` → `buildGraphFromContent` → `selectPprSeeds` →
`loadRelevantPagesForQuery` → `assembleWikiContext` — and re-implements
nothing. The seed query is a real page's own title, sampled **equidistantly**
over the page list, so the sample is not "whatever the index orders first".

```bash
npx tsx tools/dev-instrument/run-context-cost.mjs \
  --vault "/path/to/Vault" --wiki-folder wiki --cases 30 --dump /tmp/ctx
```

- `--wiki-language` must match the vault's wiki language. A mismatch makes the
  summary extractor find no section, every page falls back to the full-text
  path, and the measurement becomes a different — and larger — one than
  production.
- `--dump <dir>` writes each case's assembled context to `<dir>/<n>.txt`.

**Token counting is not in the script on purpose.** A tokenizer is a
dependency the plugin does not have, and a per-character ratio is a different
measurement than a token count — the ratio is per language and per provider.
Dump the text and count it with the provider's own tokenizer (`tiktoken`'s
`o200k_base` for OpenAI).

The LLM client is not passed to `selectPprSeeds`, so this measures the
lexical+PPR arm. The LLM arm picks a different seed set; the page count is
the same cap either way.

## Migration from legacy `tools/llm-wiki-cli/`

| Aspect | Legacy | This instrument |
|---|---|---|
| Entry | `node tools/llm-wiki-cli/run-llm-wiki.mjs` | `node tools/dev-instrument/run-instrument.mjs` |
| Args | 16 flags (`--vault`, `--source`, `--model`, ...) | 2 positional (`<vault> <source>`) |
| API key | env `WIKI_API_KEY` | env `WIKI_API_KEY` (unchanged) |
| Settings | `<vault>/.obsidian/plugins/karpathywiki/data.json` | same (configurable via `OBSIDIAN_CONFIG_DIR`) |
| Output dir | `<vault>/wiki/entities/...` (engine default) | same (engine default; no override flag — open a feature request if needed) |
| Bot findings | ~70 | 0 (`obsidianmd/*`) |