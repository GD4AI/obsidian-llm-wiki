import { EngineContext } from '../../types';
import { escapeRegex } from './utils';

export async function fixPollutedPage(
  ctx: EngineContext,
  oldPath: string,
  newBasename: string
): Promise<string> {
  const oldRel = oldPath.replace(ctx.settings.wikiFolder + '/', '').replace('.md', '');
  const dir = oldRel.split('/').slice(0, -1).join('/');
  const newPath = `${ctx.settings.wikiFolder}/${dir}/${newBasename}.md`;
  const newRel = `${dir}/${newBasename}`;

  const existingAtNew = await ctx.tryReadFile(newPath);
  if (existingAtNew !== null) {
    console.debug(`fixPollutedPage: clean path already exists, merging ${oldRel} → ${newRel}`);
    await ctx.createOrUpdateFile(newPath, existingAtNew);
    await ctx.deleteFile(oldPath);
    return `merged ${oldRel} → ${newRel} (clean path existed)`;
  }

  const oldContent = await ctx.tryReadFile(oldPath);
  if (oldContent === null) {
    return `cannot fix ${oldRel}: file not found`;
  }

  await ctx.createOrUpdateFile(newPath, oldContent);
  await ctx.deleteFile(oldPath);

  const allPages = await ctx.getExistingWikiPages();
  let updatedCount = 0;
  for (const page of allPages) {
    const content = await ctx.tryReadFile(page.path);
    if (!content) continue;

    const newContent = content
      .replace(new RegExp(`\\[\\[${escapeRegex(oldRel)}\\|([^\\]]+)\\]\\]`, 'g'), `[[${newRel}|$1]]`)
      .replace(new RegExp(`\\[\\[${escapeRegex(oldRel)}\\]\\]`, 'g'), `[[${newRel}]]`);

    if (content !== newContent) {
      await ctx.createOrUpdateFile(page.path, newContent);
      updatedCount++;
    }
  }

  return `renamed ${oldRel} → ${newRel} (${updatedCount} pages updated)`;
}
