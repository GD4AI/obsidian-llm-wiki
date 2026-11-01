// Issue #914 — a Query Wiki failure BEFORE the answer phase is silent.
//
// The issue's diagnosis was read off the control flow, and the control flow is
// as described: `sendMessage` builds the answer context, then enters its own
// `try`. Both call sites said `void this.sendMessage(...)` — no handler — so a
// rejection in between was unhandled.
//
// **The reachable defect is narrower than the issue says, and it is not a
// provider error.** Two `catch` blocks sit between the LLM calls and the
// boundary: `generateQueryKeywords` (`pipeline/query-keywords.ts:206`) returns
// an empty keyword list, and `buildWikiContext` returns
// `wikiContextErrorHint` — its `try` covers every `await`, so it does not
// reject. A provider 429 therefore degrades to lexical retrieval and the query
// still runs, and no vault-read or graph-build failure reaches the boundary
// either.
//
// What CAN still throw is the DOM setup at the top of `sendMessage`, and that
// path has the consequence worth fixing: `this.isStreaming` is set to `true`
// before the setup and is only reset by `finishGeneration`, which sits after
// the boundary. So a throw there left the view refusing every later query —
// `sendMessage` early-returns while `isStreaming` is true — until it was
// reopened. The tests below drive that path by making a pre-boundary helper
// throw.
//
// The boundary move itself is defence in depth: it is free, and it stops a
// future edit from re-creating the original hole.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { installObsidianDomHelpers } from '../../__support__/dom-helpers';
import { QueryView } from '../../../wiki/query-engine';
import { Notice } from 'obsidian';

// The `obsidian` module ships types only, so the import graph cannot be
// loaded under the jsdom environment — Vite's import analysis fails on it
// before any mock can intercept. The node environment can, because the
// global setup mocks it. So this file builds its own JSDOM, the way
// `wiki/turn-indicator.test.ts` does.
beforeEach(() => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  // eslint-disable-next-line obsidianmd/no-global-this
  globalThis.document = dom.window.document;
  // eslint-disable-next-line obsidianmd/no-global-this
  (globalThis as Record<string, unknown>).activeDocument = dom.window.document;
  installObsidianDomHelpers(
    { HTMLElement: dom.window.HTMLElement, Document: dom.window.Document },
    dom.window.document,
  );
});

afterEach(() => {
  // eslint-disable-next-line obsidianmd/no-global-this
  delete (globalThis as Record<string, unknown>).document;
  // eslint-disable-next-line obsidianmd/no-global-this
  delete (globalThis as Record<string, unknown>).activeDocument;
});

/** The parts of QueryView the error path touches. */
type ViewInternals = {
  plugin: unknown;
  history: { messages: unknown[] };
  isStreaming: boolean;
  aborted: boolean;
  pendingInput: string;
  accumulatedResponse: string;
  currentResponseDiv: unknown;
  _streamRafHandle: number | null;
  inputArea: HTMLTextAreaElement;
  sendBtn: HTMLButtonElement;
  historyContainer: HTMLElement;
  historyCountDisplay: HTMLElement;
  buildWikiContext: (msg: string, onProgress?: (phase: string) => void) => Promise<string>;
  renderHistoryMessage: (role: string, content: string, idx?: number) => void;
  scrollToBottom: () => void;
  limitHistory: () => void;
  scrollToStartOfCurrentTurn: () => void;
  rebuildTurnIndicator: () => void;
  renderMarkdownContent: (content: string, container: HTMLElement) => void;
};

interface TestOptions {
  /** Thrown by the context builder. `undefined` = the context builds. */
  contextError?: Error;
  /** Thrown by both answer-phase calls. */
  answerError?: Error;
  /**
   * Thrown by a helper that runs BEFORE the error boundary — the DOM setup.
   * This is the path a real vault can reach, because `buildWikiContext` has
   * its own `catch` and does not reject.
   */
  setupError?: Error;
}

/**
 * A QueryView with the DOM scaffolding `sendMessage` needs, and nothing
 * else. The methods that only touch the view chrome are stubbed; the error
 * path under test is the real code.
 */
function makeView(options: TestOptions): QueryView {
  const view = Object.create(QueryView.prototype) as unknown as ViewInternals;

  const settings = {
    language: 'en',
    wikiFolder: 'wiki',
    wikiLanguage: 'en',
    model: 'test-model',
    queryHistory: [],
    maxConversationHistory: 10,
    disableThinking: false,
    customQueryInstructions: '',
  };

  const llmClient = options.answerError
    ? {
        createMessageStream: vi.fn().mockRejectedValue(options.answerError),
        createMessage: vi.fn().mockRejectedValue(options.answerError),
      }
    : undefined;

  view.plugin = {
    settings,
    llmClient,
    wikiEngine: { invalidateGraph: () => { /* no-op */ } },
  };
  view.history = { messages: [] };
  view.isStreaming = false;
  view.aborted = false;
  view.pendingInput = '';
  view.accumulatedResponse = '';
  view.currentResponseDiv = null;
  view._streamRafHandle = null;

  // eslint-disable-next-line obsidianmd/no-global-this
  const doc = globalThis.document;
  view.inputArea = doc.createElement('textarea');
  view.inputArea.value = 'what is the retention curve?';
  view.sendBtn = doc.createElement('button');
  view.historyContainer = doc.createElement('div');
  view.historyCountDisplay = doc.createElement('span');

  view.buildWikiContext = options.contextError
    ? vi.fn().mockRejectedValue(options.contextError)
    : vi.fn().mockResolvedValue('WIKI CONTEXT');
  // `renderHistoryMessage` is the first thing `sendMessage` calls after it sets
  // `isStreaming`, so making it throw exercises the pre-boundary path.
  view.renderHistoryMessage = options.setupError
    ? vi.fn(() => { throw options.setupError; })
    : vi.fn();
  view.scrollToBottom = vi.fn();
  view.limitHistory = vi.fn();
  view.scrollToStartOfCurrentTurn = vi.fn();
  view.rebuildTurnIndicator = vi.fn();
  view.renderMarkdownContent = vi.fn();

  return view as unknown as QueryView;
}

/** The error element the user sees, if any. */
function errorElement(view: QueryView): HTMLElement | null {
  const container = (view as unknown as ViewInternals).historyContainer;
  return container.querySelector('.llm-wiki-query-error');
}

describe('QueryView — a failure before the answer phase must reach the user (#914)', () => {
  it('renders the error instead of leaving the answer body empty', async () => {
    const view = makeView({ contextError: new Error('vault read failed') });

    await view.sendMessage('what is the retention curve?');

    const el = errorElement(view);
    expect(el, 'the query view must show an error').not.toBeNull();
    expect(el?.textContent ?? '').toContain('vault read failed');
  });

  it('renders exactly one error element, so the user does not see it twice', async () => {
    const view = makeView({ contextError: new Error('vault read failed') });

    await view.sendMessage('what is the retention curve?');

    const container = (view as unknown as ViewInternals).historyContainer;
    expect(container.querySelectorAll('.llm-wiki-query-error')).toHaveLength(1);
  });

  it('releases the pane, so the next query is not refused', async () => {
    const view = makeView({ contextError: new Error('vault read failed') });

    await view.sendMessage('what is the retention curve?');

    // `sendMessage` early-returns while `isStreaming` is true, so a stuck
    // flag means the user cannot ask anything else in this view.
    expect((view as unknown as ViewInternals).isStreaming).toBe(false);
  });

  it('resolves rather than rejecting, so a caller has nothing to swallow', async () => {
    const view = makeView({ contextError: new Error('vault read failed') });

    await expect(view.sendMessage('what is the retention curve?')).resolves.toBeUndefined();
  });

  it('keeps the send button usable after the failure', async () => {
    const view = makeView({ contextError: new Error('vault read failed') });

    await view.sendMessage('what is the retention curve?');

    const btn = (view as unknown as ViewInternals).sendBtn;
    expect(btn.textContent).not.toContain('Stop');
    expect(btn.className).toContain('llm-wiki-query-send-btn');
  });

  // The cases below cover the one path a real vault can reach: a throw in the
  // DOM setup, above the boundary. `sendMessage` rejects there — it has no
  // `catch` above the setup, by design — so the release comes from the
  // `.catch()` handler at the call site, which calls `reportQueryFailure`.
  // That handler's wiring is asserted structurally in `query-view-wiring.test.ts`;
  // its behaviour is asserted here, called directly, because the alternative
  // is to fake the whole `onOpen()` scaffolding and then test the fake.

  it('rejects when a pre-boundary helper throws, so the caller must handle it', async () => {
    const view = makeView({ setupError: new Error('history render failed') });

    await expect(
      view.sendMessage('what is the retention curve?'),
    ).rejects.toThrow('history render failed');
  });

  it('reportQueryFailure releases the pane', async () => {
    const view = makeView({ setupError: new Error('history render failed') });
    (view as unknown as ViewInternals).isStreaming = true;

    (view as unknown as { reportQueryFailure: (e: unknown) => void })
      .reportQueryFailure(new Error('history render failed'));

    // Without this the view refuses every later query until it is reopened.
    expect((view as unknown as ViewInternals).isStreaming).toBe(false);
  });

  it('reportQueryFailure restores the send button', async () => {
    const view = makeView({ setupError: new Error('history render failed') });
    (view as unknown as ViewInternals).isStreaming = true;

    (view as unknown as { reportQueryFailure: (e: unknown) => void })
      .reportQueryFailure(new Error('history render failed'));

    const btn = (view as unknown as ViewInternals).sendBtn;
    expect(btn.textContent).not.toContain('Stop');
    expect(btn.className).toContain('llm-wiki-query-send-btn');
  });

  it('reportQueryFailure states the reason in a Notice, because there is no answer body yet', async () => {
    const noticeMock = Notice as unknown as { instances: Array<{ message: string }> };
    const before = noticeMock.instances.length;
    const view = makeView({ setupError: new Error('history render failed') });

    (view as unknown as { reportQueryFailure: (e: unknown) => void })
      .reportQueryFailure(new Error('history render failed'));

    expect(noticeMock.instances.length).toBeGreaterThan(before);
    expect(noticeMock.instances[noticeMock.instances.length - 1].message)
      .toContain('history render failed');
  });

  it('still renders the error when the ANSWER phase fails (regression guard)', async () => {
    // The answer path already had a working error element. The fix must not
    // move that path's behaviour.
    const view = makeView({ answerError: new Error('provider returned 429') });

    await view.sendMessage('what is the retention curve?');

    const el = errorElement(view);
    expect(el, 'the answer-phase error must still be shown').not.toBeNull();
    expect(el?.textContent ?? '').toContain('provider returned 429');
    expect((view as unknown as ViewInternals).isStreaming).toBe(false);
  });
});
