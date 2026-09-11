import type { ImageContentPart } from '../types';

const IMAGE_MEDIA_TYPES = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp',
} as const;

export const EMBEDDED_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const EMBEDDED_IMAGE_PACKAGE_MAX_BYTES = 20 * 1024 * 1024;

export type EmbeddedImageSkipReason = 'duplicate' | 'missing' | 'oversized' | 'remote' | 'unsupported' | 'gif-decode-failed';

export interface EmbeddedImageCandidate {
  index: number;
  path: string;
  mediaType: ImageContentPart['mediaType'];
  byteLength: number;
}

export interface EmbeddedImageSkip {
  path: string;
  reason: EmbeddedImageSkipReason;
}

export interface EmbeddedImageDiscovery {
  candidates: EmbeddedImageCandidate[];
  discovered: number;
  skipped: EmbeddedImageSkip[];
}

export interface EmbeddedImageDiscoveryContext {
  markdown: string;
  sourcePath: string;
  resolveLink: (target: string, sourcePath: string) => string | null;
  stat: (path: string) => Promise<{ size: number } | null>;
  maxBytes?: number;
}

export interface ImagePartReadContext {
  readBinary: (path: string) => Promise<ArrayBuffer | Uint8Array>;
  gifFirstFrame?: (bytes: Uint8Array) => Promise<Uint8Array>;
}

function imageTargets(markdown: string): Array<{ index: number; target: string }> {
  const matches: Array<{ index: number; target: string }> = [];
  const obsidian = /!\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]*)?\]\]/g;
  const markdownImage = /!\[[^\]]*\]\(([^\s)]+)(?:\s+[^)]*)?\)/g;
  for (const match of markdown.matchAll(obsidian)) matches.push({ index: match.index ?? 0, target: match[1].trim() });
  for (const match of markdown.matchAll(markdownImage)) matches.push({ index: match.index ?? 0, target: decodeTarget(match[1]) });
  return matches.sort((a, b) => a.index - b.index);
}

function decodeTarget(target: string): string {
  try { return decodeURIComponent(target); } catch { return target; }
}

function mediaTypeForPath(path: string): ImageContentPart['mediaType'] | null {
  const extension = path.split('.').pop()?.toLowerCase();
  return extension && extension in IMAGE_MEDIA_TYPES ? IMAGE_MEDIA_TYPES[extension as keyof typeof IMAGE_MEDIA_TYPES] : null;
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';
  for (let start = 0; start < bytes.length; start += chunkSize) binary += String.fromCharCode(...bytes.subarray(start, start + chunkSize));
  return btoa(binary);
}

function createActiveElement<K extends keyof HTMLElementTagNameMap>(tag: K): HTMLElementTagNameMap[K] {
  return createEl(tag);
}

/** Discover every eligible local embed before reading any image bytes. */
export async function discoverEmbeddedImages(ctx: EmbeddedImageDiscoveryContext): Promise<EmbeddedImageDiscovery> {
  const candidates: EmbeddedImageCandidate[] = [];
  const skipped: EmbeddedImageSkip[] = [];
  const seen = new Set<string>();
  const maxBytes = ctx.maxBytes ?? EMBEDDED_IMAGE_MAX_BYTES;
  const targets = imageTargets(ctx.markdown);

  for (const target of targets) {
    if (/^(?:https?:)?\/\//i.test(target.target)) { skipped.push({ path: target.target, reason: 'remote' }); continue; }
    const path = ctx.resolveLink(target.target, ctx.sourcePath);
    if (!path) { skipped.push({ path: target.target, reason: 'missing' }); continue; }
    if (seen.has(path)) { skipped.push({ path, reason: 'duplicate' }); continue; }
    const mediaType = mediaTypeForPath(path);
    if (!mediaType) { skipped.push({ path, reason: 'unsupported' }); continue; }
    const stat = await ctx.stat(path);
    if (!stat) { skipped.push({ path, reason: 'missing' }); continue; }
    if (stat.size > maxBytes) { skipped.push({ path, reason: 'oversized' }); continue; }
    seen.add(path);
    candidates.push({ index: candidates.length + 1, path, mediaType, byteLength: stat.size });
  }
  return { candidates, discovered: targets.length, skipped };
}

/** Split discovered images without imposing a per-note image-count limit. */
export function packageEmbeddedImages(candidates: EmbeddedImageCandidate[], maxBytes: number = EMBEDDED_IMAGE_PACKAGE_MAX_BYTES): EmbeddedImageCandidate[][] {
  const packages: EmbeddedImageCandidate[][] = [];
  let current: EmbeddedImageCandidate[] = [];
  let currentBytes = 0;
  for (const candidate of candidates) {
    if (current.length > 0 && currentBytes + candidate.byteLength > maxBytes) {
      packages.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(candidate);
    currentBytes += candidate.byteLength;
  }
  if (current.length > 0) packages.push(current);
  return packages;
}

/** Read one candidate only when its package is about to be sent. */
export async function readEmbeddedImagePart(candidate: EmbeddedImageCandidate, ctx: ImagePartReadContext): Promise<ImageContentPart> {
  const raw = await ctx.readBinary(candidate.path);
  let bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
  let mediaType = candidate.mediaType;
  if (mediaType === 'image/gif') {
    if (!ctx.gifFirstFrame) throw new Error('GIF first-frame conversion is unavailable');
    bytes = await ctx.gifFirstFrame(bytes);
    mediaType = 'image/png';
  }
  return { type: 'image', image: bytesToBase64(bytes), mediaType };
}

/** Browser-only GIF first-frame conversion. Object URLs are always released. */
export async function gifFirstFrameToPng(bytes: Uint8Array): Promise<Uint8Array> {
  const blob = new Blob([bytes.slice().buffer], { type: 'image/gif' });
  const url = URL.createObjectURL(blob);
  try {
    const image = createActiveElement('img');
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Unable to decode GIF'));
      image.src = url;
    });
    const canvas = createActiveElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to create GIF canvas context');
    context.drawImage(image, 0, 0);
    const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Unable to encode GIF first frame')), 'image/png'));
    return new Uint8Array(await png.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}
