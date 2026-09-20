// README link absolute-URL guard (v1.25.11 PATCH #375).
//
// Obsidian's community plugin browser breaks relative-path links: a
// `](docs/README_CN.md)` markdown anchor that resolves on GitHub gets
// stripped during the marketplace render, so users lose navigation between
// locales and to the companion PDF-OCR / MODEL guides. The fix is to
// rewrite every cross-file URL in every README into an absolute
// `https://github.com/GD4AI/obsidian-llm-wiki/blob/main/<path>`
// anchor. Local `#-anchor` references (same-page TOC) stay relative —
// GitHub GFM still resolves them.
//
// What this guard pins:
//   1. Every link of the form `](docs/...)` or `](README_*.md)` in every
//      locale README is rejected — the only absolute-shape allowed is the
//      `https://github.com/GD4AI/obsidian-llm-wiki/blob/main/...`
//      form.
//   2. Image refs may stay as relative paths because Obsidian renders
//      those correctly (the plugin's banner and side-panel figures appear
//      inline in the marketplace view). This guard explicitly exempts
//      `![...](/docs/assets/...)` images.
//   3. The language-switcher block at the top of each locale README has
//      exactly 10 entries (1 EN + 9 locales), so any future drift is
//      caught here even though the count never varies today.
//
// What this guard does NOT pin:
//   - External cross-domain links (`community.obsidian.md`, `ko-fi`,
//     `deepwiki.com`, `models.dev`, `gist.github.com/karpathy`,
//     `github.com/green-dalii` issues/discussions) — those were always
//     absolute and stay absolute.
//   - Badge images (`img.shields.io/...`) — those are absolute and the
//     marketplace renders them.
//   - Internal `LICENSE` / `NOTICE` file links — GitHub resolves those
//     without the host prefix.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// __dirname shim for ESM-vitest context (vitest provides `import.meta.url`).
const HERE = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');

interface ReadmeLocation {
  /** Repo-relative path used in the human error message. */
  label: string;
  /** Absolute path on disk for `readFileSync`. */
  path: string;
}

const README_FILES: ReadmeLocation[] = [
  { label: 'README.md', path: join(REPO_ROOT, 'README.md') },
  { label: 'docs/README_CN.md', path: join(REPO_ROOT, 'docs/README_CN.md') },
  { label: 'docs/README_ZH-Hant.md', path: join(REPO_ROOT, 'docs/README_ZH-Hant.md') },
  { label: 'docs/README_JA.md', path: join(REPO_ROOT, 'docs/README_JA.md') },
  { label: 'docs/README_KO.md', path: join(REPO_ROOT, 'docs/README_KO.md') },
  { label: 'docs/README_DE.md', path: join(REPO_ROOT, 'docs/README_DE.md') },
  { label: 'docs/README_FR.md', path: join(REPO_ROOT, 'docs/README_FR.md') },
  { label: 'docs/README_ES.md', path: join(REPO_ROOT, 'docs/README_ES.md') },
  { label: 'docs/README_PT.md', path: join(REPO_ROOT, 'docs/README_PT.md') },
  { label: 'docs/README_IT.md', path: join(REPO_ROOT, 'docs/README_IT.md') },
  { label: 'docs/README_RU.md', path: join(REPO_ROOT, 'docs/README_RU.md') },
];

/**
 * Match every markdown link `[text](target)` or image `![alt](target)`.
 * Captures the target only.
 *
 * The captured target is intentionally coarse — we re-test it for the two
 * specific shapes below (absolute https:// or a known-safe exception).
 */
const LINK_OR_IMAGE_PATTERN = /!?\[[^\]]*\]\(([^)]+)\)/g;

/** Excluded from the absolute-URL check: image refs (`![…](...)`). */
const IMAGE_PREFIX = '!';
/** Same-page TOC anchors (`(#-foo)`) — GitHub resolves these locally. */
const ANCHOR_PREFIX = '#';

/**
 * Strip leading image/anchor prefixes so the rest of the assertion focuses
 * on the URL shape.
 */
function normaliseTarget(raw: string): string {
  const trimmed = raw.trim();
  return trimmed;
}

/**
 * Bare-bones file refs that GitHub resolves automatically without a host
 * prefix. The Apache LICENSE and NOTICE files live at the repo root and
 * every locale README links to them via `[LICENSE](LICENSE)` or
 * `[LICENSE](../LICENSE)`. Both render correctly on GitHub and in the
 * Obsidian marketplace, so they are explicitly allowed as relative.
 *
 * `THIRD-PARTY-NOTICES.md` is the third file of that class — repo root,
 * referenced from every locale's licence line, same renderer behaviour — and
 * was added when #699 gave the bundle the attributions it was missing. The
 * alternative was an absolute `blob/main` URL, which would be inconsistent with
 * the two files sitting beside it and no safer for them.
 */
const RELATIVE_FILE_BASENAME_ALLOWLIST = new Set([
  'LICENSE',
  'NOTICE',
  'THIRD-PARTY-NOTICES.md',
]);

describe('v1.25.11 PATCH #375 — README links are absolute https:// or known-safe', () => {
  for (const { label, path } of README_FILES) {
    it(`${label} contains no relative cross-file links`, () => {
      const body = readFileSync(path, 'utf8');
      const offenders: string[] = [];

      for (const match of body.matchAll(LINK_OR_IMAGE_PATTERN)) {
        const full = match[0];
        const target = normaliseTarget(match[1]);

        // Image refs (`![alt](...)`) are explicitly excepted — Obsidian
        // marketplace renders them; the user wanted asset paths relative
        // (clarification 2026-07-30).
        if (full.startsWith(IMAGE_PREFIX)) continue;

        // Same-page TOC anchors are absolute-safe by construction (GFM
        // resolves `#-quick-start` etc.).
        if (target.startsWith(ANCHOR_PREFIX)) continue;

        // Already-absolute — accept any of https://, http://, mailto:.
        if (/^[a-z][a-z0-9+.-]*:\/\//i.test(target)) continue;
        if (target.startsWith('mailto:')) continue;

        // Top-level repo-root files (LICENSE / NOTICE) are allowed as
        // relative — GitHub resolves them automatically and the
        // marketplace render accepts them.
        const basename = target.replace(/^\.\.\//, '').replace(/^\.\//, '');
        if (RELATIVE_FILE_BASENAME_ALLOWLIST.has(basename)) continue;

        // The offenders: relative cross-file anchors pointing at
        // `docs/...` or `README_*.md`. These are the only shapes that the
        // marketplace render breaks.
        offenders.push(target);
      }

      expect(offenders, `relative cross-file links in ${label}`).toEqual([]);
    });
  }

  it('every locale README references all 10 sibling locale READMEs (language switcher)', () => {
    for (const { label, path } of README_FILES) {
      const body = readFileSync(path, 'utf8');
      // Find the language-switcher line: the single line that begins with
      // `**English** |` for the EN README, or the equivalent bold-marker
      // line for any other locale (e.g. `**简体中文** |`). Every locale
      // README has exactly one such line, and it carries 10 absolute
      // `https://github.com/.../blob/main/...` anchors — one per sibling
      // locale — so a future drift is caught here.
      //
      // We previously matched the whole body for `blob/main/(README\.md|docs/README_)`,
      // but the SEO HTML-comment metadata block at the top of every README
      // also embeds a `canonical: https://.../blob/main/README.md` line,
      // inflating the count to 11. The switcher line is the actual unit
      // under test, so count anchors within that line only.
      // Strip the SEO HTML-comment block at the top of every README — it
      // embeds a `canonical: https://.../blob/main/README.md` line that
      // would otherwise inflate the count by one. The block opens with
      // `<!--` and closes with `-->`; everything inside is non-rendered.
      // The switcher block then contains exactly 10 absolute
      // `https://github.com/.../blob/main/...` anchors — one per sibling
      // locale. The current locale is the plain-text bold marker (e.g.
      // `**English**`) and is not counted here. (v1.26.0: Russian (ru)
      // added as the 10th locale.)
      const bodyWithoutSeo = body.replace(/<!--[\s\S]*?-->/g, '');
      const totalLinkCount = (bodyWithoutSeo.match(/blob\/main\/(README\.md|docs\/README_)/g) ?? []).length;
      expect(totalLinkCount, `expected exactly 10 absolute README anchors in ${label} switcher`).toBe(10);
    }
  });

  it('every locale switcher entry is pinned to https://github.com/GD4AI/obsidian-llm-wiki/blob/main/', () => {
    for (const { label, path } of README_FILES) {
      const body = readFileSync(path, 'utf8');
      // Each switcher entry MUST use the canonical blob/main URL prefix.
      // Pin this so a future link-shape experiment (tag, branch ref, etc.)
      // fails loudly.
      //
      // Assert the prefix positively. The previous form was a negative
      // lookahead followed by `[a-z]+/`, which cannot match `github.com`
      // (a letter run is followed by `.`, not `/`), so it only ever
      // rejected non-github hosts — a stale repository owner passed it.
      // That is exactly how the green-dalii -> GD4AI move went unnoticed
      // until the Obsidian review bot flagged the README.
      const anchors: string[] = body.match(/https:\/\/[^\s)"'<>]*\/blob\/main\/(README\.md|docs\/README_)/g) ?? [];
      expect(anchors.length, `no switcher anchors found in ${label}`).toBeGreaterThan(0);
      const wrongPrefix = anchors.find((url) => !url.startsWith('https://github.com/GD4AI/obsidian-llm-wiki/blob/main/'));
      expect(wrongPrefix, `non-canonical absolute prefix in ${label}: ${wrongPrefix}`).toBeUndefined();
    }
  });
});
