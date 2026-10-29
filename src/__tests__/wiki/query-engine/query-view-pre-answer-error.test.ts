// Issue #914 — a Query Wiki failure BEFORE the answer phase is silent.
//
// The diagnosis in the issue was read off the control flow, and the control
// flow is as described: `sendMessage` builds the answer context at
// `QueryView-class.ts:545` and only enters its own `try` at `:577`, so a
// throw in between rejects the promise. Both call sites
// (`:301`, `:332`) say `void this.sendMessage(...)` — no handler — so the
// rejection is unhandled.
//
// Two consequences, and the second is the one a user actually feels:
//
//   1. No error element is rendered. The answer body stays empty.
//   2. `this.isStreaming` is never reset, because the reset lives in
//      `finishGeneration`, which sits after the `try`. The send button
//      stays in stop mode, and `sendMessage` early-returns on
//      `this.isStreaming` — so the pane is dead until the view is reopened.
//
// This test drives the real `sendMessage` and asserts the user-visible
// outcome: an element with class `llm-wiki-query-error`, and a pane that
// accepts the next query.
//
// One correction to the issue's premise, recorded here so it is not lost:
// the retrieval-path LLM calls do NOT reach `:545`. `generateQueryKeywords`
// has its own `try`/`catch` (`pipeline/query-keywords.ts:206`) that returns
// an empty keyword list, and `buildWikiContext` has its own `catch`
// (`:1357`) that returns `wikiContextErrorHint`. So a provider 429 during
// expansion degrades to lexical retrieval and the query still runs. What
// reaches `:545` is a vault-read or graph-build failure — rarer, and worse,
// because nothing catches it.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { installObsidianDomHelpers } from '../../__support__/dom-helpers';
import { QueryView } from '../../../wiki/query-engine';

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
  view.renderHistoryMessage = vi.fn();
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

  it('releases the pane, so the next query is not refused', async () => {
    const view = makeView({ contextError: new Error('vault read failed') });

    await view.sendMessage('what is the retention curve?');

    // `sendMessage` early-returns while `isStreaming` is true, so a stuck
    // flag means the user cannot ask anything else in this view.
    expect((view as unknown as ViewInternals).isStreaming).toBe(false);
  });

  it('does not reject the promise, so the caller has nothing to swallow', async () => {
    const view = makeView({ contextError: new Error('vault read failed') });

    await expect(
      view.sendMessage('what is the retention curve?'),
    ).resolves.not.toThrow();
  });

  it('keeps the send button usable after the failure', async () => {
    const view = makeView({ contextError: new Error('vault read failed') });

    await view.sendMessage('what is the retention curve?');

    const btn = (view as unknown as ViewInternals).sendBtn;
    expect(btn.textContent).not.toContain('Stop');
    expect(btn.className).toContain('llm-wiki-query-send-btn');
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
