// Reports the warnings the Obsidian review bot will surface on `tools/` —
// the local Gate 1 (`pnpm lint` = `eslint src/`) is blind to `tools/` while
// the bot scans the whole repo `.ts` tree. This is an **informational** scan:
// it does not gate anything (`pnpm lint:tools-bot` always exits 0 via
// `|| true` in the package script). Run it during development / pre-release
// to see what the bot will flag BEFORE submitting.
//
// Background: the v1.26.1 release shipped a blocking `unsafe-call` Error in
// `tools/llm-wiki-cli/src/obsidian.ts` that local lint could not see (root
// tsconfig includes only `src/**`, so even `parserOptions.project` had no type
// context for tools/). This config closes that blind spot for the CLI tree.
//
// Design notes:
// - Uses `tools/llm-wiki-cli/tsconfig.json` as the type context (the root
//   tsconfig includes only `src/**`).
// - Reuses the project's `obsidianmd` recommended ruleset so the output
//   matches the bot's `obsidianmd/no-nodejs-modules`, `no-global-this`,
//   `hardcoded-config-path` and `rule-custom-message` checks.
// - Declares Node globals (process, Buffer, __filename, console) so the scan
//   is noise-free on `no-undef` — those are real Node globals, not defects.
// - Known structural warnings on tools/ are ACCEPTED (the CLI is a Node
//   program): static `node:*` imports, the `console.log` output interface,
//   the `globalThis` shim, the `.obsidian` literal. See CLAUDE.md "Bot
//   compliance invariant" + [[feedback_obsidian_bot_tools_cli_warnings]].
import tsparser from "@typescript-eslint/parser";
import tsplugin from "@typescript-eslint/eslint-plugin";
import obsidianmd from "eslint-plugin-obsidianmd";

// Node globals the CLI actually references. Avoids `no-undef` noise so the
// report surfaces the Bot-relevant rules instead of missing-global churn.
const NODE_GLOBALS = {
  process: "readonly",
  Buffer: "readonly",
  __filename: "readonly",
  __dirname: "readonly",
  console: "readonly",
  globalThis: "readonly",
  URL: "readonly",
  TextDecoder: "readonly",
  crypto: "readonly",
  fetch: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  queueMicrotask: "readonly",
  setImmediate: "readonly",
  AbortController: "readonly",
  MessageChannel: "readonly",
  // `NodeJS.ErrnoException` — the @types/node global namespace; TS resolves
  // it via `types: ["node"]` in tools/tsconfig.json, ESLint's no-undef does
  // not. Declaring it keeps the scan noise-free (Bot has it in its env).
  NodeJS: "readonly",
};

export default [
  ...obsidianmd.configs.recommended,
  {
    files: ["tools/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        // tools/dev-instrument/tsconfig.json is the type context for the
        // whole tools/ tree since the legacy tools/llm-wiki-cli/ deletion
        // (issue #507 Phase 4 demote, PR #511).
        project: ["./tools/dev-instrument/tsconfig.json"],
      },
      globals: NODE_GLOBALS,
    },
    rules: {
      ...tsplugin.configs.recommended.rules,
    },
  },
  // .mjs entry files use a separate config — no TypeScript context (they
  // are bundled output / pure ESM JavaScript), but still get the Node
  // globals so `process` / `Buffer` / `URL` etc. don't show up as
  // `no-undef` noise.
  {
    files: ["tools/**/*.mjs"],
    languageOptions: {
      globals: NODE_GLOBALS,
    },
  },
  // Scan-scope alignment: the official review bot walks the repo `.ts` tree
  // only — the `.mjs` launcher has never appeared in any official pre-review
  // report. Turning just the `obsidianmd/*` rules off for `.mjs` mirrors that
  // scope (local findings == official findings) while core ESLint rules and
  // shared plugins (no-unsanitized etc.) still run on the launcher, keeping
  // local-only signals visible.
  {
    files: ["tools/**/*.mjs"],
    rules: Object.fromEntries(
      obsidianmd.configs.recommended
        .flatMap((c) => Object.keys(c.rules ?? {}))
        .filter((ruleName) => ruleName.startsWith("obsidianmd/"))
        .map((ruleName) => [ruleName, "off"]),
    ),
  },
  // esbuild output (run-instrument.mjs's dist/, plus the bundle smoke test's
  // dist/test-bundle.mjs) — build artifacts, gitignored, never source. The
  // shim-bundle test regenerates one on every Gate 1 run, so without this
  // ignore the scan would report hundreds of findings against bundled code.
  {
    ignores: ["tools/dev-instrument/dist/**"],
  },
];
