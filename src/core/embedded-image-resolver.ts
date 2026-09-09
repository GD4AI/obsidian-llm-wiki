import type { ImageContentPart } from '../types';

const IMAGE_MEDIA_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
} as const;

export const EMBEDDED_IMAGE_MAX_COUNT = 10;
export const EMBEDDED_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export interface EmbeddedImageReadContext {
  markdown: string;
  sourcePath: string;
  resolveLink: (target: string, sourcePath: string) => string | null;
  readBinary: (path: string) => Promise<ArrayBuffer | Uint8Array>;
  maxImages?: number;
  maxBytes?: number;
}

export interface EmbeddedImageResult {
  parts: ImageContentPart[];
  skipped: Record<'duplicate' | 'limit' | 'missing' | 'oversized' | 'remote' | 'unsupported', number>;
}

function imageTargets(markdown: string): string[] {
  const matches: Array<{ index: number; target: string }> = [];
  const obsidian = /!\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]*)?\]\]/g;
  const markdownImage = /!\[[^\]]*\]\(([^\s)]+)(?:\s+[^)]*)?\)/g;
  for (const match of markdown.matchAll(obsidian)) {
    matches.push({ index: match.index ?? 0, target: match[1].trim() });
  }
  for (const match of markdown.matchAll(markdownImage)) {
    matches.push({ index: match.index ?? 0, target: decodeTarget(match[1]) });
  }
  return matches.sort((a, b) => a.index - b.index).map(match => match.target);
}

function decodeTarget(target: string): string {
  try {
    return decodeURIComponent(target);
  } catch {
    return target;
  }
}

function mediaTypeForPath(path: string): ImageContentPart['mediaType'] | null {
  const extension = path.split('.').pop()?.toLowerCase();
  return extension && extension in IMAGE_MEDIA_TYPES
    ? IMAGE_MEDIA_TYPES[extension as keyof typeof IMAGE_MEDIA_TYPES]
    : null;
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';
  for (let start = 0; start < bytes.length; start += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(start, start + chunkSize));
  }
  return btoa(binary);
}

/**
 * Resolves local image embeds without ever fetching a remote URL. A failed
 * embed is intentionally non-fatal: the Markdown text still reaches ingest.
 */
export async function collectEmbeddedImages(ctx: EmbeddedImageReadContext): Promise<EmbeddedImageResult> {
  const skipped = { duplicate: 0, limit: 0, missing: 0, oversized: 0, remote: 0, unsupported: 0 };
  const parts: ImageContentPart[] = [];
  const seen = new Set<string>();
  const maxImages = ctx.maxImages ?? EMBEDDED_IMAGE_MAX_COUNT;
  const maxBytes = ctx.maxBytes ?? EMBEDDED_IMAGE_MAX_BYTES;

  for (const target of imageTargets(ctx.markdown)) {
    if (/^(?:https?:)?\/\//i.test(target)) {
      skipped.remote++;
      continue;
    }
    const path = ctx.resolveLink(target, ctx.sourcePath);
    if (!path) {
      skipped.missing++;
      continue;
    }
    if (seen.has(path)) {
      skipped.duplicate++;
      continue;
    }
    const mediaType = mediaTypeForPath(path);
    if (!mediaType) {
      skipped.unsupported++;
      continue;
    }
    if (parts.length >= maxImages) {
      skipped.limit++;
      continue;
    }
    let data: ArrayBuffer | Uint8Array;
    try {
      data = await ctx.readBinary(path);
    } catch {
      skipped.missing++;
      continue;
    }
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    if (bytes.byteLength > maxBytes) {
      skipped.oversized++;
      continue;
    }
    seen.add(path);
    parts.push({ type: 'image', image: bytesToBase64(bytes), mediaType });
  }
  return { parts, skipped };
}
