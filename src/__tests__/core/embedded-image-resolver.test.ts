import { describe, expect, it } from 'vitest';
import { discoverEmbeddedImages, packageEmbeddedImages, readEmbeddedImagePart } from '../../core/embedded-image-resolver';

describe('embedded image resolver', () => {
  it('discovers Obsidian and Markdown embeds in document order without a note-wide count limit', async () => {
    const result = await discoverEmbeddedImages({
      markdown: Array.from({ length: 11 }, (_, index) => `![[assets/${index}.png]]`).join('\n'),
      sourcePath: 'notes/source.md',
      resolveLink: target => target,
      stat: async () => ({ size: 1 }),
    });
    expect(result.candidates).toHaveLength(11);
    expect(result.candidates.map(image => image.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it('captures the nearest non-empty Markdown paragraphs around an embed', async () => {
    const result = await discoverEmbeddedImages({
      markdown: 'Before caption.\n\n![[assets/chart.png]]\n\nAfter caption.',
      sourcePath: 'notes/source.md',
      resolveLink: target => target,
      stat: async () => ({ size: 1 }),
    });
    expect(result.candidates[0]).toMatchObject({
      contextBefore: 'Before caption.',
      contextAfter: 'After caption.',
    });
  });

  it('clips a long neighboring paragraph to the context limit', async () => {
    const before = 'a'.repeat(600);
    const result = await discoverEmbeddedImages({
      markdown: `${before}\n\n![chart](assets/chart.png)`,
      sourcePath: 'notes/source.md',
      resolveLink: target => target,
      stat: async () => ({ size: 1 }),
    });
    expect(result.candidates[0].contextBefore).toHaveLength(500);
  });

  it('skips remote, missing, unsupported, duplicate, and oversized embeds', async () => {
    const result = await discoverEmbeddedImages({
      markdown: '![[ok.webp]] ![[ok.webp]] ![[missing.png]] ![](https://example.com/a.png) ![[large.bmp]] ![[note.pdf]]',
      sourcePath: 'notes/source.md',
      maxBytes: 3,
      resolveLink: target => ({ 'ok.webp': 'ok.webp', 'large.bmp': 'large.bmp', 'note.pdf': 'note.pdf' })[target] ?? null,
      stat: async path => ({ size: path === 'large.bmp' ? 4 : 1 }),
    });
    expect(result.candidates).toHaveLength(1);
    expect(result.skipped.map(item => item.reason)).toEqual(['duplicate', 'missing', 'remote', 'oversized', 'unsupported']);
  });

  it('packages images at the byte boundary while preserving order', () => {
    const images = [1, 2, 3].map(index => ({ index, path: `${index}.png`, mediaType: 'image/png' as const, byteLength: 10, sourceOffset: index, contextBefore: '', contextAfter: '' }));
    expect(packageEmbeddedImages(images, 20).map(group => group.map(image => image.index))).toEqual([[1, 2], [3]]);
  });

  it('encodes regular images and converts GIFs to a first-frame PNG', async () => {
    const png = await readEmbeddedImagePart({ index: 1, path: 'a.png', mediaType: 'image/png', byteLength: 4, sourceOffset: 0, contextBefore: '', contextAfter: '' }, { readBinary: async () => new Uint8Array([0, 1, 2, 3]) });
    const gif = await readEmbeddedImagePart({ index: 2, path: 'a.gif', mediaType: 'image/gif', byteLength: 4, sourceOffset: 0, contextBefore: '', contextAfter: '' }, { readBinary: async () => new Uint8Array([4]), gifFirstFrame: async () => new Uint8Array([5]) });
    expect(png).toEqual({ type: 'image', image: 'AAECAw==', mediaType: 'image/png' });
    expect(gif).toEqual({ type: 'image', image: 'BQ==', mediaType: 'image/png' });
  });
});
