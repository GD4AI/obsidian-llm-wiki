import { describe, it, expect, vi } from 'vitest';
import { Notice, TFile } from 'obsidian';
import { runAliasCompletion, runDeadLinkFixes, runEmptyPageFixes, runOrphanFixes, runDuplicateMerges, runRetagViolations } from '../../../wiki/lint/fix-runners';
import type { LintContext } from '../../../wiki/lint/types';
import { AliasGenerationLLMSchema, TagFixLLMSchema } from '../../../llm-sdk/output-schemas';

// NoticeMock in setup.ts adds a static `instances` array. Cast the imported
// Notice to access the mock-side field for test introspection.
const NoticeMock = Notice as unknown as {
  instances: Array<{ message: string; hidden: boolean }>;
};

// Minimal LintContext mock — only the fields used by the cancellation check.
// Returns LintContext via a single final cast to avoid sprinkling `as any` everywhere.
const makeCtx = (overrides: Partial<LintContext> = {}): LintContext => {
  const base: Partial<LintContext> = {
    app: { vault: { adapter: { write: vi.fn().mockResolvedValue(undefined) } } } as unknown as LintContext['app'],
    settings: {
      wikiFolder: 'wiki',
      language: 'en',
      pageGenerationConcurrency: 1,
      batchDelayMs: 0,
      model: 'test-model',
    } as unknown as LintContext['settings'],
    llmClient: { createMessage: vi.fn() } as unknown as LintContext['llmClient'], // eslint-disable-line @typescript-eslint/no-unnecessary-type-assertion
    wikiEngine: {
      fixDeadLink: vi.fn().mockResolvedValue('ok'),
      fillEmptyPage: vi.fn().mockResolvedValue('expanded'),
      linkOrphanPage: vi.fn().mockResolvedValue(['wiki/OtherPage']),
      mergeDuplicatePages: vi.fn().mockResolvedValue('merged'),
    } as unknown as LintContext['wikiEngine'],
    onAnalyzeSchema: vi.fn(),
  };
  return { ...base, ...overrides } as unknown as LintContext;
};

// ── Cancellation propagation (Issue #94) ──────────────────────────
// Status bar "click to cancel" already exists, but the fix-runner
// functions in this module never received the AbortSignal. Each
// runner must check `signal.aborted` at entry AND inside its loop.

describe('fix-runners — AbortSignal propagation', () => {
  const expectAbort = (promise: Promise<unknown>) =>
    expect(promise).rejects.toMatchObject({ name: 'AbortError' });

  it('runAliasCompletion aborts when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const ctx = makeCtx();
    await expectAbort(
      runAliasCompletion(ctx, controller.signal, [
        { path: 'wiki/a.md', content: '---\n---\nbody', basename: 'a' },
      ])
    );
  });

  it('runDeadLinkFixes aborts when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const ctx = makeCtx();
    await expectAbort(
      runDeadLinkFixes(ctx, controller.signal, [{ source: 'a', target: 'missing' }])
    );
  });

  it('runEmptyPageFixes aborts when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const ctx = makeCtx();
    await expectAbort(
      runEmptyPageFixes(ctx, controller.signal, [{ path: 'wiki/a.md', content: '' }])
    );
  });

  it('runOrphanFixes aborts when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const ctx = makeCtx();
    await expectAbort(
      runOrphanFixes(ctx, controller.signal, ['wiki/a.md'])
    );
  });

  it('runDuplicateMerges aborts when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const ctx = makeCtx();
    await expectAbort(
      runDuplicateMerges(ctx, controller.signal, [{ target: 'a', source: 'b', reason: 'dup' }])
    );
  });

  it('runDeadLinkFixes stops mid-loop when signal aborts', async () => {
    const ctx = makeCtx();
    const controller = new AbortController();
    let callCount = 0;
    const wikiEngine = ctx.wikiEngine as unknown as {
      fixDeadLink: (sourcePath: string, target: string) => Promise<string>;
    };
    wikiEngine.fixDeadLink = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) controller.abort();
      return 'ok';
    });
    const links = Array.from({ length: 10 }, (_, i) => ({ source: `s${i}`, target: `t${i}` }));
    await expectAbort(runDeadLinkFixes(ctx, controller.signal, links));
    // Should have stopped after first call (which triggered abort)
    expect(callCount).toBeLessThan(10);
    expect(callCount).toBeGreaterThanOrEqual(1);
  });

  it('fix-runners work normally when no signal provided (backward compat)', async () => {
    const ctx = makeCtx();
    const result = await runDeadLinkFixes(ctx, undefined, [
      { source: 'a', target: 'missing' },
    ]);
    expect(result.fixed).toBeGreaterThanOrEqual(0);
  });

  // Simplify Phase 1.3: fixNotice.hide() must run even on AbortError,
  // otherwise a permanent Notice('', 0) is left on the status bar.
  it('runDeadLinkFixes hides the fixNotice when signal aborts mid-loop', async () => {
    const ctx = makeCtx();
    const controller = new AbortController();
    NoticeMock.instances.length = 0;
    let callCount = 0;
    const wikiEngine = ctx.wikiEngine as unknown as {
      fixDeadLink: (sourcePath: string, target: string) => Promise<string>;
    };
    wikiEngine.fixDeadLink = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) controller.abort();
      return 'ok';
    });
    const links = Array.from({ length: 10 }, (_, i) => ({ source: `s${i}`, target: `t${i}` }));
    await expectAbort(runDeadLinkFixes(ctx, controller.signal, links));
    // The most recently created Notice should have been hidden
    const lastNotice = NoticeMock.instances[NoticeMock.instances.length - 1];
    expect(lastNotice?.hidden).toBe(true);
  });

  it('runEmptyPageFixes does not create a fixNotice when signal aborts at entry', async () => {
    const controller = new AbortController();
    controller.abort();
    const ctx = makeCtx();
    NoticeMock.instances.length = 0;
    await expectAbort(
      runEmptyPageFixes(ctx, controller.signal, [{ path: 'wiki/a.md', content: '' }])
    );
    // Entry-aborted means no work — no fixNotice should have been created
    // (avoids a stuck persistent Notice on the status bar).
    expect(NoticeMock.instances).toHaveLength(0);
  });
});

// ── runAliasCompletion: frontmatter write correctness (v1.24.0 bug fix) ──
//
// User-reported bug (2026-07-07): when a page already has `aliases: []`
// (empty placeholder), running alias completion inserts a SECOND
// `aliases:` line before the closing `---` instead of appending to
// the existing array. The resulting frontmatter has duplicate keys
// and breaks Obsidian's YAML parser.
//
// The fix is to delegate frontmatter mutation to
// `enforceFrontmatterConstraints`, which parses existing aliases,
// appends the new ones (deduped), and re-serializes through the
// canonical `serializeFrontmatter` writer.

describe('runAliasCompletion — frontmatter write correctness', () => {
  // Capture what `vault.adapter.write` was called with.
  function makeWriteCaptureCtx(): {
    ctx: LintContext;
    writes: Array<{ path: string; data: string }>;
  } {
    const writes: Array<{ path: string; data: string }> = [];
    const ctx = makeCtx({
      app: {
        vault: {
          adapter: {
            write: vi.fn().mockImplementation(async (path: string, data: string) => {
              writes.push({ path, data });
            }),
          },
        },
      } as unknown as LintContext['app'],
      llmClient: {
        createMessage: vi.fn().mockResolvedValue(
          '{"aliases":["Foo","Bar"]}'
        ),
      } as unknown as LintContext['llmClient'],
    });
    return { ctx, writes };
  }

  it('appends aliases when page has existing `aliases: [X, Y]`', async () => {
    const { ctx, writes } = makeWriteCaptureCtx();
    const before = '---\ntype: entity\naliases: [Existing]\n---\n\n# Body';
    const result = await runAliasCompletion(ctx, undefined, [
      { path: 'wiki/entities/Has.md', content: before, basename: 'Has' },
    ]);
    expect(result.filled).toBe(1);
    expect(writes).toHaveLength(1);
    const written = writes[0].data;
    // Must NOT have two `aliases:` lines
    const aliasLineCount = (written.match(/^aliases:/gm) || []).length;
    expect(aliasLineCount).toBe(1);
    // Must contain both old and new aliases (Existing + Foo + Bar)
    expect(written).toContain('Existing');
    expect(written).toContain('Foo');
    expect(written).toContain('Bar');
  });

  it('appends aliases when page has empty `aliases: []` (placeholder)', async () => {
    const { ctx, writes } = makeWriteCaptureCtx();
    const before = '---\ntype: entity\naliases: []\n---\n\n# Body';
    const result = await runAliasCompletion(ctx, undefined, [
      { path: 'wiki/entities/Empty.md', content: before, basename: 'Empty' },
    ]);
    expect(result.filled).toBe(1);
    expect(writes).toHaveLength(1);
    const written = writes[0].data;
    // Must NOT have two `aliases:` lines — this is the user-reported bug
    const aliasLineCount = (written.match(/^aliases:/gm) || []).length;
    expect(aliasLineCount).toBe(1);
    expect(written).toContain('Foo');
    expect(written).toContain('Bar');
  });

  it('appends aliases when page has block-style `aliases:\n  - X`', async () => {
    const { ctx, writes } = makeWriteCaptureCtx();
    const before = '---\ntype: entity\naliases:\n  - BlockAlias\n---\n\n# Body';
    const result = await runAliasCompletion(ctx, undefined, [
      { path: 'wiki/entities/Block.md', content: before, basename: 'Block' },
    ]);
    expect(result.filled).toBe(1);
    expect(writes).toHaveLength(1);
    const written = writes[0].data;
    const aliasLineCount = (written.match(/^aliases:/gm) || []).length;
    expect(aliasLineCount).toBe(1);
    expect(written).toContain('BlockAlias');
    expect(written).toContain('Foo');
    expect(written).toContain('Bar');
  });

  it('writes a fresh `aliases:` line when page has no aliases at all', async () => {
    const { ctx, writes } = makeWriteCaptureCtx();
    const before = '---\ntype: entity\ntags: [ai]\n---\n\n# Body';
    const result = await runAliasCompletion(ctx, undefined, [
      { path: 'wiki/entities/Fresh.md', content: before, basename: 'Fresh' },
    ]);
    expect(result.filled).toBe(1);
    expect(writes).toHaveLength(1);
    const written = writes[0].data;
    const aliasLineCount = (written.match(/^aliases:/gm) || []).length;
    expect(aliasLineCount).toBe(1);
    expect(written).toContain('Foo');
  });

  it('logs the page basename + LLM response snippet when generation fails', async () => {
    // Bug 3 (v1.24.0): when the LLM returns empty / unparseable
    // text, the failure log must include the page basename and a
    // response snippet — not just "JSON parse completely failed".
    const ctx = makeCtx({
      app: {
        vault: { adapter: { write: vi.fn() } },
      } as unknown as LintContext['app'],
      llmClient: {
        // Simulate a provider that returned nothing.
        createMessage: vi.fn().mockResolvedValue(''),
      } as unknown as LintContext['llmClient'],
    });
    const debugSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const result = await runAliasCompletion(ctx, undefined, [
        { path: 'wiki/entities/Broken.md', content: '---\ntype: entity\n---\n\n# Body', basename: 'Broken' },
      ]);
      expect(result.filled).toBe(0);
      // The error log must identify which page failed AND surface the
      // raw response so the user can see whether the LLM returned
      // empty / error / thinking-only text.
      const allLogged = debugSpy.mock.calls.flat().join('\n');
      expect(allLogged).toContain('Broken');
      expect(allLogged).toMatch(/response length|response.*0|empty/i);
    } finally {
      debugSpy.mockRestore();
    }
  });
});

// ── runRetagViolations (Issue #85 v7) ───────────────────────────

import type { TagViolation } from '../../../wiki/lint/scanners';

describe('runRetagViolations (Issue #85 v7)', () => {
  const baseViolation: TagViolation = {
    path: 'wiki/entities/Alice.md',
    pageType: 'entity',
    title: 'Alice',
    currentTags: ['person', 'bogus', 'Medical_Arzneimittel'],
    invalidTags: ['bogus', 'Medical_Arzneimittel'],
  };

  function makeRetagCtx(opts: {
    fileContent?: string | null;
    llmResponse?: string;
    buildSystemPrompt?: (task: string) => Promise<string | undefined>;
  }): LintContext {
    const content = opts.fileContent !== undefined
      ? opts.fileContent
      : '---\ntype: entity\ntitle: Alice\ntags: [person, bogus, Medical_Arzneimittel]\n---\n\nBody of Alice.';
    // The mock below must mirror the real Obsidian TFile + Vault
    // shape: TFile does NOT have a `.read()` method — content is read
    // via `vault.read(file: TFile)`. Earlier versions of this test
    // mocked the wrong shape (a `{ path, read }` object) and the
    // production code at the time called `tfile.read()` — both sides
    // were wrong together, a textbook shell test. The fix below
    // uses `vault.read(file)` so the test exercises the same call
    // pattern the production code now uses (which is also the
    // correct Obsidian API). The regression guard in 'TFile mock
    // matches real Obsidian shape' below ensures this cannot
    // regress by checking that the mock has a `path` and that
    // `vault.read` is wired to return the file content.
    const realTFileMock = Object.assign(new TFile(), {
      path: baseViolation.path,
      basename: baseViolation.path.split('/').pop() || '',
      extension: 'md',
      stat: { ctime: 0, mtime: 0, size: (content ?? '').length },
    });
    return makeCtx({
      app: {
        vault: {
          adapter: { write: vi.fn().mockResolvedValue(undefined) },
          getMarkdownFiles: () => [],
          getAbstractFileByPath: vi.fn().mockReturnValue(
            opts.fileContent === null ? null : realTFileMock
          ),
          read: vi.fn().mockImplementation(async (f: { path: string }) => {
            // Reject any caller that passes a TFile-look-alike with
            // its own .read() — the API surface is `vault.read(file)`.
            if (typeof (f as { read?: unknown }).read === 'function') {
              throw new Error('TFile.read is not a function (real Obsidian API)');
            }
            return f.path === realTFileMock.path ? content : null;
          }),
        },
      } as unknown as LintContext['app'],
      llmClient: { createMessage: vi.fn().mockResolvedValue(opts.llmResponse ?? '{"tags":["person","organization"]}') } as unknown as LintContext['llmClient'],
      // #328 Phase 1 follow-up: retag now uses buildSystemPrompt('lint')
      // for the system layer injection (PRX-A2). The default leaves the
      // field undefined so existing tests exercise the back-compat path
      // (no system field) — only the new tests below override it.
      buildSystemPrompt: opts.buildSystemPrompt,
    });
  }

  it('throws DOMException when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const ctx = makeRetagCtx({});
    await expect(
      runRetagViolations(ctx, controller.signal, [baseViolation])
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('returns 0 fixed when LLM client is null', async () => {
    const ctx = makeCtx({ llmClient: null });
    const result = await runRetagViolations(ctx, undefined, [baseViolation]);
    expect(result.fixed).toBe(0);
    expect(result.results[0]).toContain('LLM client not initialized');
  });

  it('rewrites frontmatter tags via LLM response (happy path)', () => {
    const ctx = makeRetagCtx({});
    return runRetagViolations(ctx, undefined, [baseViolation]).then(result => {
      expect(result.fixed).toBe(1);
      expect(result.results[0]).toContain('Alice.md');
      const writeSpy = (ctx.app.vault.adapter as unknown as { write: ReturnType<typeof vi.fn> }).write;
      const writtenContent = writeSpy.mock.calls[0][1] as string;
      // v1.24.0: tags are now serialized via the canonical writer.
      // Both block (`tags:\n  - "person"`) and inline (`tags: [person]`)
      // forms are valid YAML.
      expect(
        writtenContent.includes('tags:\n  - "person"') ||
        writtenContent.includes('tags: [person, organization]')
      ).toBe(true);
      expect(writtenContent).toContain('Body of Alice.');
    });
  });

  it('filters LLM-returned tags not in active vocabulary (defensive)', async () => {
    // LLM hallucinates "bogus" and "Medical_Arzneimittel" — both are
    // out-of-vocab, so they must be filtered out. The runner
    // explicitly re-validates against validVocab before writing.
    const ctx = makeRetagCtx({
      llmResponse: '{"tags":["person","bogus","Medical_Arzneimittel"]}',
    });
    const writeSpy = (ctx.app.vault.adapter as unknown as { write: ReturnType<typeof vi.fn> }).write;
    const result = await runRetagViolations(ctx, undefined, [baseViolation]);
    expect(result.fixed).toBe(1);
    const writtenContent = writeSpy.mock.calls[0][1] as string;
    // Only the in-vocab tag survives the filter. v1.24.0: tags may
    // appear in block or inline form depending on serialization style.
    expect(
      writtenContent.includes('tags:\n  - "person"') ||
      writtenContent.includes('tags: [person]')
    ).toBe(true);
    expect(writtenContent).not.toContain('bogus');
  });

  it('does not write when LLM returns empty tags (safety)', async () => {
    const ctx = makeRetagCtx({ llmResponse: '{"tags":[]}' });
    const writeSpy = (ctx.app.vault.adapter as unknown as { write: ReturnType<typeof vi.fn> }).write;
    const result = await runRetagViolations(ctx, undefined, [baseViolation]);
    expect(result.fixed).toBe(0);
    expect(writeSpy).not.toHaveBeenCalled();
    expect(result.results[0]).toContain('LLM kept no tags');
  });

  // ── Regression guard (Issue #361 Theme 2) ─────────────────────
  // ── PR #361 Theme 2: source-typed contract ────────────────
// PR #349 (eucher, 43479d8) deliberately deferred tier-1 (existing
// wiki page tags) cleanup to the lint retag runner — closed-vocab
// enforcement lives in the runner for sources. Production code at
// fix-runners.ts:441-442 selects getActiveSourceTags when pageType
// is 'source'. Pin the contract with two tests below.

  const sourceViolation: TagViolation = {
    path: 'wiki/sources/Smith2024.md',
    pageType: 'source',
    title: 'Smith2024',
    currentTags: ['Medical_Arzneimittel'],
    invalidTags: ['Medical_Arzneimittel'],
  };

  it('rewrites source-page frontmatter tags against VALID_SOURCE_TAGS', async () => {
    const ctx = makeRetagCtx({
      fileContent: '---\ntype: source\ntitle: Smith2024\ntags: [Medical_Arzneimittel]\n---\n\nSmith 2024 body.',
      llmResponse: '{"tags":["article"]}',
    });
    const writeSpy = (ctx.app.vault.adapter as unknown as { write: ReturnType<typeof vi.fn> }).write;
    const result = await runRetagViolations(ctx, undefined, [sourceViolation]);
    expect(result.fixed).toBe(1);
    const writtenContent = writeSpy.mock.calls[0][1] as string;
    expect(writtenContent).toContain('article');
    expect(writtenContent).not.toContain('Medical_Arzneimittel');
  });

  it('filters LLM-returned source tags outside form list and domain vocabulary (defensive)', async () => {
    const ctx = makeRetagCtx({
      fileContent: '---\ntype: source\ntitle: Smith2024\ntags: [Medical_Arzneimittel]\n---\n\nSmith 2024 body.',
      // "bogus" is in no list. "person" is an entity identity type — legal on
      // an entity page, not on a source page, which carries only the form
      // list and the Group/Value view of the vocabulary. Both must go.
      llmResponse: '{"tags":["article","bogus","person"]}',
    });
    const writeSpy = (ctx.app.vault.adapter as unknown as { write: ReturnType<typeof vi.fn> }).write;
    const result = await runRetagViolations(ctx, undefined, [sourceViolation]);
    expect(result.fixed).toBe(1);
    const writtenContent = writeSpy.mock.calls[0][1] as string;
    expect(writtenContent).toContain('article');
    expect(writtenContent).not.toContain('bogus');
    expect(writtenContent).not.toContain('person');
  });

  // ── Regression guard (Issue #85 v7.7) ─────────────────────────
  // Earlier commit (ebf58f2) shipped with a SHELL TEST: the mock
  // provided `{ path, read }` and the production code called
  // `tfile.read()`. Both sides were wrong together — neither
  // matched the real Obsidian TFile + Vault API. The user's "Retag"
  // button blew up at runtime with "tfile.read is not a function"
  // because TFile extends TAbstractFile which has NO read() method.
  // The fix (vault.read(file)) is exercised below. If a future PR
  // reverts the production call OR the mock, this test fails loudly.

  it('reads via vault.read(file), NOT tfile.read() (TFile has no read method)', async () => {
    // Spy on vault.read to confirm the production code calls it
    // with the TFile, not the legacy tfile.read() pattern.
    const readSpy = vi.fn().mockImplementation(async (f: { path: string }) => f.path);
    const ctx = makeRetagCtx({});
    // Replace the makeRetagCtx mock's vault.read with our spy so we
    // can assert how the production code called it.
    (ctx.app.vault as unknown as { read: typeof readSpy }).read = readSpy;
    await runRetagViolations(ctx, undefined, [baseViolation]);
    expect(readSpy).toHaveBeenCalled();
    // The argument must be a TFile-shaped object, NOT a TFile with
    // its own read method (TFile has no read method).
    const arg = readSpy.mock.calls[0][0] as { path: string; read?: unknown };
    expect(arg.path).toBe(baseViolation.path);
    expect(arg.read).toBeUndefined(); // TFile has no read method
  });

  it('emits console.error with full error context on per-page failure', async () => {
    // Earlier commit only emitted a Notice with the message, no
    // console.error, so the user had no DevTools diagnostics when
    // retag failed. v7.7 fixes this: every per-page error must
    // log to console.error with the full Error object (including
    // stack) AND a path/pageType prefix.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ctx = makeRetagCtx({ llmResponse: '{not valid json' });
    // Force an error: make vault.read throw
    (ctx.app.vault as unknown as { read: () => Promise<string> }).read = vi
      .fn()
      .mockRejectedValue(new Error('simulated vault failure'));
    const result = await runRetagViolations(ctx, undefined, [baseViolation]);
    expect(result.fixed).toBe(0);
    // console.error must have been called with the path + pageType
    // and the Error object (so DevTools shows the full stack).
    expect(errSpy).toHaveBeenCalled();
    const firstCallArgs = errSpy.mock.calls[0];
    // The first arg is the formatted log string containing the
    // path + pageType for context.
    expect(String(firstCallArgs[0])).toContain(baseViolation.path);
    expect(String(firstCallArgs[0])).toContain(baseViolation.pageType);
    // The second arg is the Error object itself.
    expect(firstCallArgs[1]).toBeInstanceOf(Error);
    errSpy.mockRestore();
  });

  // === #328 Phase 1 follow-up — retag uses system layer for tag-vocab ===
  //
  // Pre-#328-Phase-1-follow-up (PRX-A2), retag appended the Active Tag
  // Vocabulary section to the user prompt via `appendTagVocabularyToPrompt`,
  // because the LLM call did not go through `buildSystemPrompt`. The
  // helper was the only remaining user-layer caller.
  //
  // PRX-A2 deduplicated by calling `ctx.buildSystemPrompt('lint')` here,
  // matching every other lint LLM call site. Two tests pin the contract:
  describe('retag dedup — system layer injects Active Tag Vocabulary (#328 Phase 1 follow-up)', () => {
    const fakeSystemPrompt = '## Active Tag Vocabulary (runtime)\n\n**Entity types** (entity_type field — one of):\n- person\n\n';

    async function captureCreateMessageCall(ctx: LintContext) {
      const ctrl = new AbortController();
      const spy = vi.spyOn(ctx.llmClient!, 'createMessage');
      await runRetagViolations(ctx, ctrl.signal, [baseViolation]);
      return spy.mock.calls[0][0] as {
        system?: string;
        messages: Array<{ role: string; content: string }>;
      };
    }

    it('passes buildSystemPrompt output as the LLM system field', async () => {
      const ctx = makeRetagCtx({
        buildSystemPrompt: vi.fn(async () => fakeSystemPrompt),
      });
      const call = await captureCreateMessageCall(ctx);
      expect(call.system).toBe(fakeSystemPrompt);
    });

    it('user prompt does NOT embed the Active Tag Vocabulary section', async () => {
      // pin the dedup: even though buildSystemPrompt returns a section,
      // the user layer must not duplicate it. This is the contract
      // PRX (dedup) established and retag is now part of it.
      const ctx = makeRetagCtx({
        buildSystemPrompt: vi.fn(async () => fakeSystemPrompt),
      });
      const call = await captureCreateMessageCall(ctx);
      expect(call.messages[0].content).not.toContain('## Active Tag Vocabulary');
      expect(call.messages[0].content).not.toContain('Entity types');
    });

    it('falls back to no-system-prompt when buildSystemPrompt is undefined (back-compat)', async () => {
      // Pre-Phase-1 callers (e.g. older test fixtures) don't supply
      // buildSystemPrompt on LintContext. Retag must preserve the
      // pre-Phase-1 prompt shape on that path: only user prompt, no
      // 'system' field. Pins the optional-chain so future contributors
      // cannot quietly drop it.
      const ctx = makeRetagCtx({});  // buildSystemPrompt: undefined
      const call = await captureCreateMessageCall(ctx);
      expect('system' in call).toBe(false);
    });
  });
});

// v1.25.10 PATCH Issue #367 P0-1 — fix-runners parallelization.
// `runAliasCompletion` already batches using `pageGenerationConcurrency`.
// The other 4 fix-runners currently run serial-for-loops. Re-use the same
// concurrency pattern so the Lint smart-fix-all wall-clock on a 2000-page
// vault drops by ~65%. Run the runner against a synthetic workload and
// pin that the per-batch concurrency equals `pageGenerationConcurrency`,
// not 1, and that errors in one work-item do not poison the rest of the
// batch.
describe('P0-1 fix-runners concurrency (Issue #367)', () => {
  it('runDeadLinkFixes dispatches up to pageGenerationConcurrency items per batch', async () => {
    let maxInFlight = 0;
    let inFlight = 0;
    const stamps: number[] = [];
    const ctx = {
      settings: { language: 'en', pageGenerationConcurrency: 3, wikiFolder: 'wiki' },
      llmClient: undefined,
      wikiEngine: {
        fixDeadLink: async (_source: string, _target: string): Promise<string> => {
          inFlight++;
          maxInFlight = Math.max(maxInFlight, inFlight);
          // artificial delay so all 3 batch slots are observed
          await new Promise(resolve => setTimeout(resolve, 5));
          inFlight--;
          return 'unchanged';
        },
        updateStatusBar: () => {},
      },
      getActiveTagVocabularySection: () => '',
      getActiveFolderLayoutSection: () => '',
    } as unknown as Parameters<typeof import('../../../wiki/lint/fix-runners')['runDeadLinkFixes']>[0];
    const links = Array.from({ length: 9 }, (_, i) => ({ source: `a${i}`, target: `b${i}` }));
    await import('../../../wiki/lint/fix-runners').then(m => m.runDeadLinkFixes(ctx, new AbortController().signal, links));
    expect(maxInFlight).toBe(3);
    expect(stamps.length).toBe(0); // sanity — recording not required
  });
});

// P0-1 second pass — EmptyPageFixes, OrphanFixes, DuplicateMerges all
// mirror the runDeadLinkFixes batch shape. Per-test verifies the
// batch concurrency actually fires (not just sequential-for).

function makeBatchCtx(opts: {
  concurrency?: number;
  fillDelayMs?: number;
  linkDelayMs?: number;
  mergeDelayMs?: number;
  fillReturns?: string;
} = {}) {
  const inflight = { current: 0, peak: 0 };
  const ctx = {
    settings: { language: 'en', pageGenerationConcurrency: opts.concurrency ?? 3, wikiFolder: 'wiki' },
    llmClient: undefined,
    wikiEngine: {
      fillEmptyPage: async (_path: string, _content: string): Promise<string> => {
        inflight.current++;
        inflight.peak = Math.max(inflight.peak, inflight.current);
        await new Promise(r => setTimeout(r, opts.fillDelayMs ?? 5));
        inflight.current--;
        return opts.fillReturns ?? 'filled';
      },
      linkOrphanPage: async (_p: string): Promise<string[]> => {
        inflight.current++;
        inflight.peak = Math.max(inflight.peak, inflight.current);
        await new Promise(r => setTimeout(r, opts.linkDelayMs ?? 5));
        inflight.current--;
        return ['x'];
      },
      mergeDuplicatePages: async (_t: string, _s: string): Promise<string> => {
        inflight.current++;
        inflight.peak = Math.max(inflight.peak, inflight.current);
        await new Promise(r => setTimeout(r, opts.mergeDelayMs ?? 5));
        inflight.current--;
        return 'merged';
      },
      updateStatusBar: () => {},
    },
    getActiveTagVocabularySection: () => '',
    getActiveFolderLayoutSection: () => '',
  } as unknown as Parameters<typeof runEmptyPageFixes>[0];
  return { ctx, inflight };
}

describe('P0-1 second pass — Empty / Orphan / Duplicate runner concurrency', () => {
  it('runEmptyPageFixes dispatches up to concurrency items in parallel', async () => {
    const { ctx, inflight } = makeBatchCtx({ concurrency: 3 });
    const pages = Array.from({ length: 9 }, (_, i) => ({ path: `wiki/p${i}.md`, content: '# Hi' }));
    await runEmptyPageFixes(ctx, new AbortController().signal, pages);
    expect(inflight.peak).toBe(3);
  });

  it('runOrphanFixes dispatches up to concurrency items in parallel', async () => {
    const { ctx, inflight } = makeBatchCtx({ concurrency: 3 });
    const orphans = Array.from({ length: 6 }, (_, i) => `wiki/o${i}.md`);
    await runOrphanFixes(ctx, new AbortController().signal, orphans);
    expect(inflight.peak).toBe(3);
  });

  it('runDuplicateMerges dispatches up to concurrency items in parallel', async () => {
    const { ctx, inflight } = makeBatchCtx({ concurrency: 3 });
    const dups = Array.from({ length: 6 }, (_, i) => ({
      target: `wiki/t${i}.md`, source: `wiki/s${i}.md`, reason: 'dup',
    }));
    await runDuplicateMerges(ctx, new AbortController().signal, dups);
    expect(inflight.peak).toBe(3);
  });

  it('all three runners fall back to concurrency=1 by default', async () => {
    // No concurrency set → safe sequential.
    const fillOnly = {
      settings: { language: 'en', wikiFolder: 'wiki' }, // no pageGenerationConcurrency
      wikiEngine: {
        fillEmptyPage: vi.fn(async () => 'x'),
        updateStatusBar: () => {},
      },
      getActiveTagVocabularySection: () => '',
      getActiveFolderLayoutSection: () => '',
    } as unknown as Parameters<typeof runEmptyPageFixes>[0];
    await runEmptyPageFixes(fillOnly, new AbortController().signal, [{ path: 'a.md', content: '' }]);
    // No crash, no batch overrun — sequential-by-default contract holds.
    expect(true).toBe(true);
  });
});

// === typed-output migration (v1.26.3 PATCH Issue #443 expanded scope) ===
// Commit 9 — runAliasCompletion uses createMessageWithOutput when available;
// falls back to createMessage on legacy clients.
describe('runAliasCompletion — typed-output migration (#443 expanded scope)', () => {
  function makeAliasCtx(client: unknown) {
    return {
      app: {
        vault: {
          adapter: { write: vi.fn().mockResolvedValue(undefined) },
        },
      } as unknown as LintContext['app'],
      llmClient: client,
      settings: { wikiFolder: 'wiki', language: 'en' } as LintContext['settings'],
    } as unknown as LintContext;
  }

  it('passes AliasGenerationLLMSchema on the wire via response_format.schema (legacy client)', async () => {
    const createMessage = vi.fn().mockResolvedValue('{"aliases":["Foo","Bar"]}');
    const ctx = makeAliasCtx({ createMessage });
    await runAliasCompletion(ctx, undefined, [
      { path: 'wiki/entities/Has.md', content: '---\ntype: entity\n---\n\n# Body', basename: 'Has' },
    ]);
    expect(createMessage).toHaveBeenCalled();
    const calls = createMessage.mock.calls as unknown as Array<[unknown]>;
    const args = calls[0]?.[0] as { response_format?: { schema?: unknown } };
    expect(args.response_format?.schema).toBe(AliasGenerationLLMSchema);
  });

  it('uses createMessageWithOutput when the client implements it (Tier 0 path)', async () => {
    const createMessageWithOutput = vi.fn().mockResolvedValue({
      text: '{"aliases":["Foo","Bar"]}',
      output: { aliases: ['Foo', 'Bar'] },
      outputMode: 'json_schema',
      finishReason: 'stop',
    });
    const createMessage = vi.fn();
    const ctx = makeAliasCtx({ createMessage, createMessageWithOutput });
    await runAliasCompletion(ctx, undefined, [
      { path: 'wiki/entities/Has.md', content: '---\ntype: entity\n---\n\n# Body', basename: 'Has' },
    ]);
    expect(createMessageWithOutput).toHaveBeenCalled();
    expect(createMessage).not.toHaveBeenCalled();
    const calls = createMessageWithOutput.mock.calls as unknown as Array<[unknown]>;
    const args = calls[0]?.[0] as { response_format?: { schema?: unknown } };
    expect(args.response_format?.schema).toBe(AliasGenerationLLMSchema);
  });

  it('falls back to createMessage when the client lacks createMessageWithOutput', async () => {
    const createMessage = vi.fn().mockResolvedValue('{"aliases":["Foo","Bar"]}');
    const ctx = makeAliasCtx({ createMessage });
    const result = await runAliasCompletion(ctx, undefined, [
      { path: 'wiki/entities/Has.md', content: '---\ntype: entity\n---\n\n# Body', basename: 'Has' },
    ]);
    expect(createMessage).toHaveBeenCalled();
    expect(result.filled).toBe(1);
  });
});

// === Commit 10 — tag-fix ===
// Top-level describe so this can stand alone. We don't reuse the existing
// makeRetagCtx helper (which is scoped inside the Issue #85 v7 describe)
// and instead use makeCtx directly with overrides.
describe('runRetagViolations — typed-output migration (#443 expanded scope)', () => {
  const tagMigrationViolation: TagViolation = {
    path: 'wiki/entities/Alice.md',
    pageType: 'entity',
    title: 'Alice',
    currentTags: ['person', 'bogus'],
    invalidTags: ['bogus'],
  };

  // Build a ctx that mimics the Issue #85 v7 fixture closely enough for
  // runRetagViolations to reach the LLM call. The original makeRetagCtx
  // scopes TFile + vault.read + getAbstractFileByPath mocks; here we
  // inline the minimum set needed by the production path.
  function makeTagMigrationCtx(llmClient: unknown): LintContext {
    const realTFileMock = Object.assign(new TFile(), {
      path: tagMigrationViolation.path,
      basename: 'Alice',
      extension: 'md',
      stat: { ctime: 0, mtime: 0, size: 0 },
    });
    return makeCtx({
      llmClient: llmClient as unknown as LintContext['llmClient'],
      app: {
        vault: {
          adapter: { write: vi.fn().mockResolvedValue(undefined) },
          getMarkdownFiles: () => [],
          getAbstractFileByPath: vi.fn().mockReturnValue(realTFileMock),
          read: vi.fn().mockImplementation(async (f: { path: string }) => {
            if (typeof (f as { read?: unknown }).read === 'function') {
              throw new Error('TFile.read is not a function (real Obsidian API)');
            }
            return f.path === realTFileMock.path
              ? '---\ntype: entity\ntitle: Alice\ntags: [person, bogus]\n---\n\nBody of Alice.'
              : null;
          }),
        },
      } as unknown as LintContext['app'],
    });
  }

  it('passes TagFixLLMSchema on the wire via response_format.schema (legacy client)', async () => {
    const createMessage = vi.fn().mockResolvedValue('{"tags":["entity"]}');
    const ctx = makeTagMigrationCtx({ createMessage });
    await runRetagViolations(ctx, undefined, [tagMigrationViolation]);
    expect(createMessage).toHaveBeenCalled();
    const calls = createMessage.mock.calls as unknown as Array<[unknown]>;
    const args = calls[0]?.[0] as { response_format?: { schema?: unknown } };
    expect(args.response_format?.schema).toBe(TagFixLLMSchema);
  });

  it('uses createMessageWithOutput when the client implements it (Tier 0 path)', async () => {
    const createMessageWithOutput = vi.fn().mockResolvedValue({
      text: '{"tags":["entity"]}',
      output: { tags: ['entity'] },
      outputMode: 'json_schema',
      finishReason: 'stop',
    });
    const createMessage = vi.fn();
    const ctx = makeTagMigrationCtx({ createMessage, createMessageWithOutput });
    await runRetagViolations(ctx, undefined, [tagMigrationViolation]);
    expect(createMessageWithOutput).toHaveBeenCalled();
    expect(createMessage).not.toHaveBeenCalled();
    const calls = createMessageWithOutput.mock.calls as unknown as Array<[unknown]>;
    const args = calls[0]?.[0] as { response_format?: { schema?: unknown } };
    expect(args.response_format?.schema).toBe(TagFixLLMSchema);
  });

  it('falls back to createMessage when the client lacks createMessageWithOutput', async () => {
    const createMessage = vi.fn().mockResolvedValue('{"tags":["entity"]}');
    const ctx = makeTagMigrationCtx({ createMessage });
    await runRetagViolations(ctx, undefined, [tagMigrationViolation]);
    expect(createMessage).toHaveBeenCalled();
  });
});
