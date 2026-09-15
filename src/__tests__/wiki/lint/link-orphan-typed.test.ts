// link-orphan typed-output path tests (v1.26.3 PATCH Phase B).
//
// linkOrphanPage normally requires a full EngineContext. The typed-path
// migration (`createMessageWithOutput` → prefer result.output, fall back
// to parseJsonResponse(text)) is what we pin here — the downstream
// orphan-link validation is covered by the existing orphan-matcher tests.
//
// We construct a minimal EngineContext with a hand-rolled client that
// implements only `createMessageWithOutput` (Tier 0 success) or both
// methods (Tier 1/2 fallback). The orphan page + related-page content
// are stub files.

import { describe, it, expect, vi } from 'vitest';
import { linkOrphanPage } from '../../../wiki/lint/link-orphan';
import type { EngineContext } from '../../../types';
import type { LLMClient } from '../../../types';

function makeTypedClient(createMessageWithOutput: (p: Record<string, unknown>) => Promise<{
  text: string;
  output?: unknown;
  outputMode: string;
  finishReason: string;
}>): LLMClient {
  return {
    createMessage: vi.fn(async () => '') as unknown as LLMClient['createMessage'],
    createMessageWithOutput: createMessageWithOutput as unknown as LLMClient['createMessageWithOutput'],
  } as LLMClient;
}

function makeCtx(client: LLMClient, files: Record<string, string>): EngineContext {
  const ctx = {
    settings: {
      wikiFolder: 'wiki',
      wikiLanguage: 'en',
      disableThinking: false,
    },
    // the one vocabulary (vocabulary.ts) is harvested from the vault before every system prompt
    app: { vault: { getMarkdownFiles: () => [] }, metadataCache: { getFileCache: () => null } },
    getClient: () => client,
    getSchemaContext: () => ({}),
    tryReadFile: async (path: string): Promise<string | null> => files[path] ?? null,
    createOrUpdateFile: async (_path: string, content: string): Promise<void> => { void content; },
  } as unknown as EngineContext;
  return ctx;
}

describe('linkOrphanPage — typed-output path (createMessageWithOutput)', () => {
  const ORPHAN = 'wiki/Orphan.md';
  const ORPHAN_CONTENT = '# Orphan\n\nNo inbound links.';
  const RELATED_PAGE = 'wiki/Target.md';
  // Note: content must NOT contain the link_target string ('Target') or
  // validateOrphanLinkTarget returns true (already linked) and the page is
  // skipped. This mirrors production: a page that already links the target
  // gets no back-link.
  const RELATED_CONTENT = '# Related topic\n\nBody with no links yet.';

  it('uses result.output when Tier 0 succeeds (schema on wire)', async () => {
    const createMessageWithOutput = vi.fn(async (_p: Record<string, unknown>) => ({
      text: JSON.stringify({
        related_pages: [{ page_path: 'Target.md', link_text: 'Target', link_target: 'Target' }],
      }),
      output: {
        related_pages: [{ page_path: 'Target.md', link_text: 'Target', link_target: 'Target' }],
      },
      outputMode: 'json_schema',
      finishReason: 'stop',
    }));
    const ctx = makeCtx(makeTypedClient(createMessageWithOutput), {
      [ORPHAN]: ORPHAN_CONTENT,
      [RELATED_PAGE]: RELATED_CONTENT,
    });

    const linked = await linkOrphanPage(ctx, ORPHAN);

    // The related page got the back-link written (createOrUpdateFile called).
    expect(linked).toEqual(['wiki/Target.md']);
    // Zod schema must travel on the wire.
    const firstCall = createMessageWithOutput.mock.calls[0]?.[0];
    expect((firstCall as { response_format?: { schema?: unknown } }).response_format?.schema).toBeDefined();
  });

  it('falls back to parseJsonResponse(text) when Tier 1/2 succeed (output undefined)', async () => {
    const createMessageWithOutput = vi.fn(async () => ({
      text: JSON.stringify({
        related_pages: [{ page_path: 'Target.md', link_text: 'Target', link_target: 'Target' }],
      }),
      output: undefined,
      outputMode: 'json_object',
      finishReason: 'stop',
    }));
    const ctx = makeCtx(makeTypedClient(createMessageWithOutput), {
      [ORPHAN]: ORPHAN_CONTENT,
      [RELATED_PAGE]: RELATED_CONTENT,
    });

    const linked = await linkOrphanPage(ctx, ORPHAN);

    expect(linked).toEqual(['wiki/Target.md']);
  });

  it('returns [] when client lacks createMessageWithOutput (legacy path)', async () => {
    const createMessage = vi.fn(async () => JSON.stringify({
      related_pages: [{ page_path: 'Target.md', link_text: 'Target', link_target: 'Target' }],
    }));
    const ctx = makeCtx({ createMessage } as unknown as LLMClient, {
      [ORPHAN]: ORPHAN_CONTENT,
      [RELATED_PAGE]: RELATED_CONTENT,
    });

    const linked = await linkOrphanPage(ctx, ORPHAN);

    expect(linked).toEqual(['wiki/Target.md']);
    expect(createMessage).toHaveBeenCalledTimes(1);
  });

  it('returns [] when no related_pages (no link candidates)', async () => {
    const createMessageWithOutput = vi.fn(async () => ({
      text: '{}',
      output: {},
      outputMode: 'json_schema',
      finishReason: 'stop',
    }));
    const ctx = makeCtx(makeTypedClient(createMessageWithOutput), {
      [ORPHAN]: ORPHAN_CONTENT,
    });

    const linked = await linkOrphanPage(ctx, ORPHAN);

    expect(linked).toEqual([]);
  });
});
