// Shipped-bundle size guard, against the Obsidian Sync Standard cap.
//
// Obsidian Sync Standard refuses any single file above 5 MB. The figure is
// documented four times on official pages, and all four agree:
//   - https://obsidian.md/help/sync/plans — the Standard/Plus table
//     ("Maximum file size | 5 MB | 200 MB")
//   - https://help.obsidian.md/Sync+limitations — "For the Standard plan the
//     limit is 5 MB. For the Plus plan the limit is 200 MB per file."
//   - https://obsidian.md/sync — the plan card ("5 MB maximum file size")
//   - https://obsidian.md/blog/standard-plan/ — the same table
//
// Scope, stated precisely because two earlier drafts of this claim overstated
// it:
//   1. This is NOT a submission rule. Neither the plugin submission
//      requirements nor the developer policies mention a size limit, and the
//      directory review passed while the bundle was over the cap.
//   2. It does not affect every user. Sync only carries community plugin
//      files when the user opts in ("Installed community plugin list" /
//      "Active community plugin list" under Settings -> Sync). So the
//      affected group is Sync Standard users who enabled plugin sync. Sync
//      Plus allows 200 MB per file, and users who are not on Sync install
//      from the GitHub release.
//
// What the official pages do NOT say is what a user sees when one file in a
// multi-file install is refused. Third-party reports describe a silent partial
// install (manifest and styles arrive, main.js does not, the plugin is broken
// with nothing to act on), but that detail is not in the documentation, so
// this guard does not lean on it.
//
// Why this is a test rather than a note: the v1.29.0 bundle reached 5,188,175
// bytes through dependency growth alone. Nothing in the release chose that,
// and nothing looked. The AI SDK v6 -> v7 upgrade added 678 KB, more than ten
// times what the release's own code added. A number written in a document does
// not stop the next upgrade; a failing check does.
//
// The lever when this trips, measured on the v1.29.0 tree:
//   - `charset: 'utf8'` (in esbuild.config.mjs): 5,188,043 -> 4,864,406
//   - plus `minify: true, keepNames: true`: 2,685,917
// The second lever costs readable stack frames in user bug reports, and two
// assertions in `openai-codex-loopback-flow.test.ts` that pin esbuild's output
// spacing would have to become whitespace-tolerant.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** One file, Sync Standard plan. Decimal MB as the docs state it. */
const SYNC_STANDARD_MAX_FILE_BYTES = 5_000_000;

const bundle = readFileSync('main.js');
const bundleBytes = bundle.length;
const bundleText = bundle.toString('utf8');

/**
 * A `pnpm build:dev` artifact, not the shipped one.
 *
 * The dev build inlines a ~13 MB source map, so it is three to four times the
 * production size and always over the cap. That is by design — the file is
 * meant for the maintainer's own end-to-end run. Failing here would say "your
 * debug build is too big", which is true, uninteresting, and would train the
 * reader to ignore this guard.
 *
 * Detected by the inline source map rather than by size, so a production
 * bundle that grows past the cap can never be mistaken for a dev build. The
 * marker has to be searched for across the whole file: it sits at the START
 * of a ~13 MB base64 payload, so the last kilobyte is payload only.
 */
const isDevBuild = bundleText.includes('sourceMappingURL=data:application/json');

describe('shipped bundle size', () => {
  it.skipIf(isDevBuild)('stays under the Obsidian Sync Standard 5 MB per-file cap', () => {
    expect(
      bundleBytes,
      `main.js is ${bundleBytes.toLocaleString('en-US')} bytes, at or over the ` +
        `${SYNC_STANDARD_MAX_FILE_BYTES.toLocaleString('en-US')} byte cap Obsidian Sync ` +
        `Standard imposes on a single file (https://obsidian.md/help/sync/plans). ` +
        `Sync Standard users who enabled community-plugin sync would not receive ` +
        `this file. Recover bytes at the build, not by raising this number: ` +
        `charset 'utf8' and minify both work, and the comment at the top of this ` +
        `file records what each one measures.`,
    ).toBeLessThan(SYNC_STANDARD_MAX_FILE_BYTES);
  });

  it('decodes as clean UTF-8 with no replacement characters', () => {
    // A wrong `charset` setting, or a byte-level write under an assumption of
    // ASCII, would surface here as U+FFFD. The build is the only writer of
    // main.js, so this is the place to notice. Runs on dev builds too — a
    // mangled encoding is a defect in both.
    expect(bundleText.includes('\uFFFD')).toBe(false);
  });
});
