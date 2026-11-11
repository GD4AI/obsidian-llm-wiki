import tsparser from "@typescript-eslint/parser";
import obsidianmd from "eslint-plugin-obsidianmd";

// Issue #927: the size ratchet. Per-file ceilings are what each file measures TODAY, so a file may
// not grow and no new function may pass 120. The map may only shrink — a function that drops below
// its ceiling goes back to the global limit, and the entry is deleted in the same change.
const LONG_FUNCTION_CEILINGS = {
	"src/core/frontmatter.ts": 136,
	"src/core/json.ts": 132,
	"src/llm-sdk/openai-compat-sdk-client.ts": 311,
	"src/llm-sdk/openai-sdk-client.ts": 126,
	"src/main-commands/command-registry.ts": 156,
	"src/main-commands/ingest-commands.ts": 127,
	"src/ui/history-modal/HistoryModal-class.ts": 185,
	"src/ui/history-modal/renderers/maintenance-details.ts": 129,
	"src/ui/settings-sections/advanced-settings-section.ts": 200,
	"src/ui/settings-sections/auto-maintain-section.ts": 130,
	"src/ui/settings-sections/model-section.ts": 137,
	"src/ui/settings-sections/provider-section.ts": 238,
	"src/ui/settings-sections/wiki-config-section.ts": 200,
	"src/wiki/conversation-ingest.ts": 221,
	"src/wiki/source-analyzer.ts": 145,
	"src/wiki/lint/fix-dead-link.ts": 143,
	"src/wiki/lint/fix-runners.ts": 127,
	"src/wiki/lint/merge-duplicates.ts": 172,
	"src/wiki/lint/report-builder.ts": 199,
	"src/wiki/page-factory/merge-page.ts": 199,
	"src/wiki/page-factory/path-resolution.ts": 126,
	"src/wiki/query-engine/QueryView-class.ts": 246,
};

export default [
  ...obsidianmd.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
  },
  {
    ignores: [
      "main.js",
      "node_modules/",
      // Test files are excluded from local lint to mirror the Obsidian
      // Bot review pipeline's focus on plugin production code. Note (2026-08-06,
      // v1.26.0 pre-submission finding): the Bot actually scans the WHOLE repo
      // `.ts` tree, not just `main.js` — it reported ~60 Warnings on
      // `tools/llm-wiki-cli/` that local lint cannot see (this config lints only
      // `src/` and the root tsconfig includes only `src/**`). The exclude list
      // below keeps local lint focused on plugin code; tools/ warnings are
      // accepted (structural to a Node CLI; see CLAUDE.md Bot compliance
      // invariant). See [[feedback_obsidian_bot_tools_cli_warnings]].
      // Each entry below has a documented user direction:
      //   - src/**/__tests__/** — test files (Direction v1.25.4)
      //   - src/**/__support__/** — test polyfills (Direction v1.25.4)
      //   - src/**/fixtures/** — fixture wikis (Direction v1.25.4)
      //   - src/**/*.test.ts / src/**/*.spec.ts — top-level test files (Direction v1.25.4)
      "src/**/__tests__/**",
      "src/**/__support__/**",
      "src/**/fixtures/**",
      "src/**/*.test.ts",
      "src/**/*.spec.ts",
    ],
  },
// Issue #927: apply the size ratchet. Overrides live here, never in the source, so `pnpm lint` reports
// 0 warnings and no `eslint-disable` is added anywhere.
{
  files: ["src/**/*.ts"],
  rules: { "max-lines-per-function": ["error", { max: 120, skipBlankLines: true, skipComments: true }] },
},
...Object.entries(LONG_FUNCTION_CEILINGS).map(([file, max]) => ({
  files: [file],
  rules: { "max-lines-per-function": ["error", { max, skipBlankLines: true, skipComments: true }] },
})),
];
