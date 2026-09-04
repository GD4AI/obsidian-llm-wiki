// `getExistingWikiPages()` sets `title` from the filename slug, not a display name. `displayTitle` (H1, or the first frontmatter alias when there is no parseable heading) is what a display name should come from instead — this pins its extraction directly.

import { describe, it, expect } from 'vitest';
import { getExistingWikiPages } from '../../../wiki/lint/get-existing-pages';
import { createMockContext } from '../../__support__/engine-context';

describe('getExistingWikiPages — displayTitle extraction (#592)', () => {
  it('uses the page\'s H1 as displayTitle when present', async () => {
    const { ctx } = createMockContext({
      vaultFiles: {
        'wiki/entities/haem-a3.md': '---\ntype: entity\n---\n# Haem A₃\n\nSome description.\n',
      },
    });

    const pages = await getExistingWikiPages(ctx.app, 'wiki');

    expect(pages).toHaveLength(1);
    expect(pages[0]!.title).toBe('haem-a3');
    expect(pages[0]!.displayTitle).toBe('Haem A₃');
  });

  it('falls back to the first frontmatter alias when there is no H1', async () => {
    const { ctx } = createMockContext({
      vaultFiles: {
        'wiki/entities/no-h1.md': '---\ntype: entity\naliases:\n  - "My Frontmatter Alias"\n  - "Other Alias"\n---\nNo heading here, just prose.\n',
      },
    });

    const pages = await getExistingWikiPages(ctx.app, 'wiki');

    expect(pages).toHaveLength(1);
    expect(pages[0]!.displayTitle).toBe('My Frontmatter Alias');
  });

  it('leaves displayTitle undefined when there is neither an H1 nor an alias', async () => {
    const { ctx } = createMockContext({
      vaultFiles: {
        'wiki/entities/bare.md': '---\ntype: entity\n---\nNo heading, no aliases.\n',
      },
    });

    const pages = await getExistingWikiPages(ctx.app, 'wiki');

    expect(pages).toHaveLength(1);
    expect(pages[0]!.displayTitle).toBeUndefined();
  });
});
