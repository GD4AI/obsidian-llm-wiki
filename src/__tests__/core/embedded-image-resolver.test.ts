import { describe, expect, it } from 'vitest';
import { collectEmbeddedImages } from '../../core/embedded-image-resolver';

const bytes = new Uint8Array([0, 1, 2, 3]);

describe('collectEmbeddedImages', () => {
  it('resolves Obsidian and Markdown embeds in document order', async () => {
    const result = await collectEmbeddedImages({
      markdown: '![[assets/one.png|300]]\n![two](assets/two.jpg)',
      sourcePath: 'notes/source.md',
      resolveLink: target => ({
        'assets/one.png': 'assets/one.png',
        'assets/two.jpg': 'assets/two.jpg',
      })[target] ?? null,
      readBinary: async () => bytes,
    });
    expect(result.parts).toEqual([
      { type: 'image', image: 'AAECAw==', mediaType: 'image/png' },
      { type: 'image', image: 'AAECAw==', mediaType: 'image/jpeg' },
    ]);
  });

  it('skips remote, missing, unsupported, duplicate, and oversized embeds without failing text ingest', async () => {
    const result = await collectEmbeddedImages({
      markdown: '![[ok.webp]] ![[ok.webp]] ![[missing.png]] ![](https://example.com/a.png) ![[large.bmp]] ![[note.pdf]]',
      sourcePath: 'notes/source.md',
      maxImages: 10,
      maxBytes: 3,
      resolveLink: target => ({ 'ok.webp': 'ok.webp', 'large.bmp': 'large.bmp', 'note.pdf': 'note.pdf' })[target] ?? null,
      readBinary: async path => path === 'large.bmp' ? new Uint8Array(4) : new Uint8Array([1]),
    });
    expect(result.parts).toHaveLength(1);
    expect(result.skipped).toEqual({ duplicate: 1, limit: 0, missing: 1, remote: 1, oversized: 1, unsupported: 1 });
  });

  it('accepts URL-encoded Markdown paths and limits selected images', async () => {
    const result = await collectEmbeddedImages({
      markdown: '![first](assets/a%20b.gif) ![[second.png]]',
      sourcePath: 'notes/source.md',
      maxImages: 1,
      resolveLink: target => target === 'assets/a b.gif' ? target : target === 'second.png' ? target : null,
      readBinary: async () => bytes,
    });
    expect(result.parts).toEqual([{ type: 'image', image: 'AAECAw==', mediaType: 'image/gif' }]);
    expect(result.skipped.limit).toBe(1);
  });
});
