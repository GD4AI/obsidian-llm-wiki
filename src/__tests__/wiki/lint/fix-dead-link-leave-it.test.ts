// Issue #485: Fix Dead Links has no "leave it" outcome — an unresolvable
// link always became an empty stub page, in both branches, with no way to
// decline. #197 established that such a stub must never be LLM-expanded;
// #485 adds the second decision: whether the stub PAGE is created at all.
//
// `createStubsForUnresolvableLinks` (default ON — existing vaults keep the
// current outcome) routes both creation sites through one greppable sibling
// of the #197 gate:
//
//   shouldFabricateStubForUnresolvableLink  → may an LLM FILL the stub?   no
//   shouldCreateStubForUnresolvableLink     → is the stub PAGE written?   yes, unless opted out
//
// When off, the link stays as it is and keeps surfacing in every lint
// report; ingest never depended on a pre-existing stub to create the page,
// so nothing downstream changes.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fixDeadLink } from '../../../wiki/lint/fix-dead-link';
import * as getExistingPages from '../../../wiki/lint/get-existing-pages';
import type { EngineContext, LLMClient } from '../../../types';
import { mockExistingWikiPages } from '../../__support__/engine-context';

const SOURCE_CONTENT = '# My Page\n\nReferences [[missing-target]] here.\n';

function makeCtx(
  client: LLMClient,
  overrides: Record<string, unknown> = {},
): { ctx: EngineContext; writes: Array<{ path: string; content: string }> } {
  const written: Array<{ path: string; content: string }> = [];
  const ctx = {
    app: {},
    settings: {
      wikiFolder: 'wiki',
      wikiLanguage: 'en',
      disableThinking: false,
      slugCase: 'preserve',
      ...overrides,
    },
    getClient: () => client,
    getSchemaContext: () => ({}),
    tryReadFile: async (_path: string): Promise<string | null> => SOURCE_CONTENT,
    createOrUpdateFile: async (path: string, content: string): Promise<void> => {
      written.push({ path, content });
    },
    // #662: fixDeadLink now takes the page list from the context seam instead of
    // importing the module. The shared helper delegates to the real reader, so
    // each test's existing spy on `getExistingWikiPages` stays in force — the
    // seam is what changed, not the data.
    getExistingWikiPages(this: { app: unknown; settings: { wikiFolder: string } }) {
      return mockExistingWikiPages(this)();
    },
  } as unknown as EngineContext;
  return { ctx, writes: written };
}

function typedClient(payload: unknown): LLMClient {
  return {
    createMessage: vi.fn(async () => '') as unknown as LLMClient['createMessage'],
    createMessageWithOutput: vi.fn(async () => ({
      text: JSON.stringify(payload),
      output: payload,
      outputMode: 'json_schema',
      finishReason: 'stop',
    })) as unknown as LLMClient['createMessageWithOutput'],
  } as LLMClient;
}

describe('fixDeadLink — leave-it outcome (#485)', () => {
  beforeEach(() => {
    vi.spyOn(getExistingPages, 'getExistingWikiPages').mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates no page and leaves the link when the LLM create_stub branch hits the gate (setting off)', async () => {
    const client = typedClient({ action: 'create_stub', stub_title: 'Missing Target', stub_type: 'entity' });
    const { ctx, writes } = makeCtx(client, { createStubsForUnresolvableLinks: false });

    const out = await fixDeadLink(ctx, 'wiki/entities/MyPage.md', 'missing-target');

    expect(writes).toHaveLength(0);
    expect(out).toContain('left as dead link');
  });

  it('creates no page when the deterministic fallback hits the gate (setting off)', async () => {
    // `{}` → no usable action → deterministic fallback → no alias match
    // (empty existing pages) → would be the unconditional stub site.
    const client = typedClient({});
    const { ctx, writes } = makeCtx(client, { createStubsForUnresolvableLinks: false });

    const out = await fixDeadLink(ctx, 'wiki/entities/MyPage.md', 'missing-target');

    expect(writes).toHaveLength(0);
    expect(out).toContain('left as dead link');
  });

  it('keeps the stub outcome by default (setting unset behaves as on)', async () => {
    const client = typedClient({ action: 'create_stub', stub_title: 'Missing Target', stub_type: 'entity' });
    const { ctx, writes } = makeCtx(client);

    const out = await fixDeadLink(ctx, 'wiki/entities/MyPage.md', 'missing-target');

    expect(out).toContain('stub created');
    // Stub page + rewritten referring link.
    expect(writes).toHaveLength(2);
    expect(writes[0]!.path).toBe('wiki/entities/Missing-Target.md');
  });

  it('still retargets through the post-LLM alias safety net when the gate is off (correction is not stub creation)', async () => {
    // The alias deliberately does NOT match the link text ('missing-target')
    // under any form `findDeadLinkTarget` compares (title / alias / slug),
    // so the pre-check passes over it; only the safety-net re-check after
    // the LLM's create_stub suggestion can catch it — proving that
    // correction still outranks the leave-it gate.
    vi.spyOn(getExistingPages, 'getExistingWikiPages').mockResolvedValue([
      {
        path: 'wiki/entities/Unrelated Page.md',
        title: 'Unrelated Page',
        aliases: ['MT Alternate'],
      },
    ] as never);
    const client = typedClient({ action: 'create_stub', stub_title: 'MT Alternate', stub_type: 'entity' });
    const { ctx, writes } = makeCtx(client, { createStubsForUnresolvableLinks: false });

    const out = await fixDeadLink(ctx, 'wiki/entities/MyPage.md', 'missing-target');

    expect(out).toContain('safety-net corrected');
    expect(writes).toHaveLength(1);
    expect(writes[0]!.content).not.toContain('generation_complete: false');
  });
});
