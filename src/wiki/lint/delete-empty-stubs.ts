import { EngineContext } from '../../types';
import { parseFrontmatter, extractBody } from '../../core/frontmatter';
import { isPageEmpty } from './utils';
import { isStubPage } from '../page-factory/stub-page';
import { isInFolderScope } from '../../core/folder-scope';

/**
 * A stub is empty when all it holds is its own title and its own placeholder
 * line — nothing the plugin paid a model for.
 *
 * `stub: true` alone cannot answer that. Two writers set the marker and their
 * bodies differ in kind: `fix-dead-link.ts` writes a placeholder pointing at a
 * page that does not exist yet, while the ingest candidate gate
 * (`buildDissentStubContent`, `stub-page.ts`) writes a placeholder *plus the
 * extraction's summary and a verbatim quote*. Deleting the second kind would
 * take real content off disk under an action named "Delete Empty Stubs".
 *
 * So the shape is asserted directly: one heading, one quoted line, no prose.
 * That is exact for the dead-link stub, and it sorts the gate stub's three
 * forms by whether a model produced anything on the page:
 *
 *   summary + quote  → prose present        → kept
 *   summary, no quote → prose present       → kept
 *   neither          → nothing paid for     → collected, on purpose
 *
 * The third form is the one to read twice. `buildDissentStubContent` drops
 * `quoteBlock` when the item carries no mention (`stub-page.ts:138`), so a
 * gate stub with no summary *and* no mention has exactly the dead-link shape
 * and is collected. That is the intent, not an oversight — by the rule above
 * there is nothing on that page a model produced, which is the same reason
 * the dead-link stub goes. Pinned by test so it is not "fixed" later.
 *
 * Fail-safe by construction: anything a future writer adds that is neither a
 * heading nor a quote keeps the page.
 */
function isEmptyStub(content: string): boolean {
  const lines = extractBody(content)
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const headings = lines.filter(line => line.startsWith('#'));
  const quotes = lines.filter(line => line.startsWith('>'));
  const prose = lines.filter(line => !line.startsWith('#') && !line.startsWith('>'));
  return headings.length === 1 && quotes.length === 1 && prose.length === 0;
}

export async function deleteEmptyStubs(
  ctx: EngineContext,
  wikiFolder: string
): Promise<{ deleted: number; failed: number; errors: string[] }> {
  const files = ctx.app.vault.getMarkdownFiles()
    .filter(f => isInFolderScope(f.path, wikiFolder, false) &&
                 !f.path.endsWith('/index.md') &&
                 !f.path.includes('/schema/') &&
                 !f.path.includes('/sources/') &&
                 !f.path.includes('/contradictions/') &&
                 !f.path.includes('log.md'));

  let deleted = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const file of files) {
    try {
      const content = await ctx.app.vault.read(file);
      const fm = parseFrontmatter(content);
      if (fm?.reviewed === true) continue;
      // #678: a stub carries `stub: true` and a placeholder sentence that clears
      // MIN_SUBSTANTIVE_CHARS by roughly a factor of two, so the text-based
      // predicate alone never recognised one — every Fix Dead Links stub
      // survived this action for good.
      //
      // Deliberately NOT folded into `isPageEmpty`: that predicate also decides
      // which pages "Expand Empty Pages" hands to the LLM, and #197's gate
      // forbids fabricating content for an unresolvable link. Deleting a stub
      // and filling it are different decisions and stay in different places.
      //
      // The stub test is `isEmptyStub`, not `isStubPage` — the marker is set by
      // two writers whose bodies differ; see its doc comment above.
      if (!isPageEmpty(content) && !(isStubPage(fm) && isEmptyStub(content))) continue;
      await ctx.deleteFile(file.path);
      deleted++;
    } catch (e) {
      failed++;
      const errMsg = e instanceof Error ? e.message : String(e);
      errors.push(`${file.path}: ${errMsg}`);
      console.error(`[deleteEmptyStubs] Failed: ${file.path}`, e);
    }
  }
  return { deleted, failed, errors };
}
