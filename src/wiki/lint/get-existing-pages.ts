import { App } from 'obsidian';
import { parseFrontmatter, extractBody } from '../../core/frontmatter';
import { CANDIDATE_WINDOW_TEXT_CHARS } from '../../constants';
import { isInFolderScope } from '../../core/folder-scope';

export async function getExistingWikiPages(
  app: App,
  wikiFolder: string
): Promise<Array<{ path: string; title: string; displayTitle?: string; wikiLink: string; aliases?: string[]; tags?: string[]; ctime?: number; text?: string }>> {
  const wikiFiles = app.vault
    .getMarkdownFiles()
    .filter(
      f =>
        isInFolderScope(f.path, wikiFolder, false) &&
        !f.path.includes('index.md') &&
        !f.path.includes('log.md') &&
        !f.path.includes('/schema/') &&
        !f.path.includes('/contradictions/')
    );

  const pages: Array<{ path: string; title: string; displayTitle?: string; wikiLink: string; aliases?: string[]; tags?: string[]; ctime?: number; text?: string }> = [];
  for (const f of wikiFiles) {
    const relPath = f.path.replace(wikiFolder + '/', '').replace('.md', '');
    const content = await app.vault.read(f);
    const fm = parseFrontmatter(content);
    const body = extractBody(content);

    // v1.23.0 P0-2 follow-up: skip Welcome notes. They have
    // `type: welcome` frontmatter and a localized filename
    // (e.g. "欢迎使用 Karpathy LLM Wiki.md" in Chinese), so we
    // cannot filter by filename. The frontmatter is the only
    // robust signal.
    //
    // Without this, Ingest would treat the welcome note as an
    // existing entity page and Query Wiki would surface it in
    // context — both are wrong: the welcome is onboarding
    // content, not a knowledge page.
    // Defensive: parseFrontmatter returns null for malformed
    // frontmatter. Only skip pages with a valid `type: welcome`
    // — any other shape (no frontmatter, malformed, no type) is
    // kept and treated as a regular wiki page.
    if (fm && fm.type === 'welcome') {
      continue;
    }

    // Issue #592: `title` (below) is the filename slug, not a display name — title-casing a slug can't recover punctuation, spacing, or subscripts a real heading has.
    // Prefer the page's actual H1; when there's no parseable heading, leave it unset so callers fall back to `title` — frontmatter aliases are unordered abbreviations/variants, not necessarily what the page is called.
    // Costs no extra read — `body` is already produced above for the candidate-window text below.
    const h1Match = body.trim().match(/^#\s+(.+?)(?:\n|$)/);
    const displayTitle = h1Match ? h1Match[1].trim() : undefined;

    pages.push({
      path: f.path,
      title: f.basename,
      displayTitle,
      wikiLink: `[[${relPath}|${f.basename}]]`,
      aliases: Array.isArray(fm?.aliases) ? fm.aliases : undefined,
      // Issue #446: ranking signal for designators that match more than one
      // page. Read here because the frontmatter is already parsed.
      tags: Array.isArray(fm?.tags) ? fm.tags : undefined,
      ctime: f.stat?.ctime,
      // The page's prose, for the candidate window (`core/candidate-window.ts`).
      // The file is already read here to parse its frontmatter; keeping a
      // bounded, lower-cased slice of the body costs no second read and lets
      // the dedup and dead-link prompts rank pages by what they say, not only
      // by what they are called.
      text: body.toLowerCase().slice(0, CANDIDATE_WINDOW_TEXT_CHARS),
    });
  }
  return pages;
}
