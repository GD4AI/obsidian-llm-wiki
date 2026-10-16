// PR #3 split: QueryView Obsidian ItemView class extracted from query-engine.ts.
//
// This is the thin class wrapper. Most of the public surface (constructor,
// getViewType/getDisplayText/getIcon, invalidateGraph, onOpen, onClose,
// sendMessage, stopGeneration, scrollToBottom, renderMarkdownContent,
// renderHistoryMessage) lives here because it carries the view's instance
// state (streaming flags, rAF handle, graph cache, turn indicator ref, etc.).
//
// Renderer + pipeline helpers were extracted in earlier Steps to sibling
// files; QueryView delegates to them via the imports below.
//
// - renderMarkdownContent uses extractThinkingPanel + bindWikiLinkClicks
//   (renderers/thinking-extract + renderers/wiki-link-clicks)
// - buildWikiContext is decomposed into 4 pipeline phases (read-index,
//   select-seeds, load-pages, assemble-context) but `_graph` /
//   `_lastRetrieval` writes remain on the class (the cache lives here).

import { ItemView, WorkspaceLeaf, Notice, MarkdownRenderer, Component } from 'obsidian';
import LLMWikiPlugin from '../../main';
import { TEXTS } from '../../texts';
import { PROMPTS } from '../../prompts';
import { parseJsonResponse } from '../../core/json';
import { renderTemplate } from '../../core/template-renderer';
import { formatPageRefSummary } from '../../core/ppr-cascade';
import { buildTurnIndicator, observeVisibleTurn, updateActiveDot } from '../turn-indicator';
import { TOKENS_QUERY_ANSWER, TOKENS_QUERY_SAVE_DEDUP, NOTICE_BRIEF, NOTICE_SHORT, NOTICE_NORMAL, NOTICE_ERROR, CUSTOM_QUERY_INSTRUCTIONS_MAX_CHARS, RETRIEVAL_HISTORY_ROUNDS } from '../../constants';
import { capMaxTokens } from '../../core/token-cap';
import { getSectionLabels } from '../system-prompts';

import { extractThinkingPanel } from './renderers/thinking-extract';
import { resolveModelForTask } from '../../core/model-resolver';
import { bindWikiLinkClicks } from './renderers/wiki-link-clicks';
import { renderHistoryMessage as buildHistoryMessage, addCopyButton } from './renderers/history-message';
import { QueryViewValueSchema } from '../../llm-sdk/output-schemas';
import {
  scrollToBottom,
  scrollToStartOfCurrentTurn,
  scrollToTurn,
} from './renderers/turn-scroll';
import { renderRetrievalLabel } from './renderers/retrieval-label';
import { SuggestSaveModal } from './SuggestSaveModal-class';
import { InternalView } from './state';

import { readWikiIndex, withBodies } from './pipeline/read-index';
import { TermIndexCache } from '../../core/term-index-cache';
import { twoStageExpand, ExpansionTermsCache, DEFAULT_EXPANSION } from '../../core/query-expansion';
import { selectPprSeeds } from './pipeline/select-seeds';
import { prepareRetrievalInputs, retrievalQueryTerms } from '../../core/retrieval-query';
import { selectSeedsWithLLM } from './pipeline/seed-selector';
import { loadRelevantPagesForQuery } from './pipeline/load-pages';
import {
  assembleWikiContext,
  emptyWikiHint,
  wikiContextErrorHint,
} from './pipeline/assemble-context';
import { appendCustomQueryInstructions, logCustomInstructionsInjectionContext } from './custom-instructions';
import { renderCustomInstructionsPanel, type CustomInstructionsPanelHandle } from './renderers/custom-instructions-panel';
import type { RetrievalLabelData } from './types';

export const VIEW_TYPE_QUERY = 'llm-wiki-query-view';

export class QueryView extends ItemView {
  plugin: LLMWikiPlugin;
  history: {
    messages: Array<{
      role: 'user' | 'assistant';
      content: string;
      timestamp: number;
      /** v1.24.0: retrieval metadata persisted per assistant message. */
      retrieval?: {
        arm: string;
        count: number;
        topPaths: string[];
      };
    }>;
  };
  isStreaming: boolean;
  aborted: boolean;
  accumulatedResponse: string;
  currentResponseDiv: HTMLElement | null;
  historyContainer: HTMLElement;
  inputArea: HTMLTextAreaElement;
  sendBtn: HTMLButtonElement;
  historyCountDisplay: HTMLElement;
  // v1.24.0 #251: collapsible Custom Query Instructions panel handle.
  // The panel owns its own DOM + event listeners; the handle is disposed
  // on view close to avoid leaks across open/close cycles.
  private _customInstructionsPanel: CustomInstructionsPanelHandle | null = null;
  private pendingInput: string;
  private activeRenderComponent: Component | null;
  // v1.24.0 Bug A: the per-view PPR graph cache has been removed; the graph
  // now lives in WikiEngine and is shared across all QueryView leaves.
  /** Cached section labels for Tier B extraction (settings don't change mid-query). */
  private _sectionLabels: ReturnType<typeof getSectionLabels> | null = null;
  /** Last PPR cascade result — for displaying retrieval source in the response UI. */
  private _lastRetrieval: RetrievalLabelData | null = null;

  /**
   * The terms of the last retrieval, segmented. `loadRelevantPages` takes page
   * titles and no query, so the terms the retrieval ran on ride here to let the
   * matched paragraphs reach the model's context. #855 fix 6.
   */
  private _lastRetrievalTerms: string[] = [];
  /**
   * Term tables keyed on the wiki index file. Building them per query was 4.4 s
   * against 21 ms to score from a prebuilt one on 2,864 pages — the scoring was
   * never slow, rebuilding the same table once per question was. Lives here
   * because QueryView is what reads the index on every query and can see when
   * it has not changed.
   */
  private readonly termIndexCache = new TermIndexCache();
  private readonly expansionCache = new ExpansionTermsCache();
  private _turnIndicator: HTMLElement | null = null;
  /** Issue #850: set when the stream ran out of output budget. Rendered at the
   *  end of the answer so the user sees why it stopped, next to the thinking
   *  trace that consumed the budget. */
  private truncationHint: string | null = null;

  /** Render the token-overflow hint below the answer. The thinking trace stays
   *  above — it is the evidence of what consumed the budget. */
  private appendTruncationHint(container: HTMLElement): void {
    const hint = this.truncationHint;
    this.truncationHint = null;
    if (!hint) return;
    container.createEl('blockquote', {
      text: hint,
      cls: 'llm-wiki-query-truncation-hint',
    });
  }
  private _turnObserver: IntersectionObserver | null = null;
  /**
   * v1.23.0 P2: Persistence health fix — when the user explicitly clears
   * history, onClose must NOT clobber the cleared state by writing
   * `this.history.messages` (which is `[]`) over the just-saved empty
   * array. In practice the read-back is the same, but the fire-and-forget
   * saveSettings in onClose could race with a concurrent sendMessage
   * completion and resurrect stale messages. Tracks the last
   * user-initiated clear timestamp so onClose skips the redundant write.
   */
  private _lastClearTimestamp: number = 0;
  /**
   * v1.23.0 P2: rAF batching for streaming DOM updates — coalesce
   * multiple onChunk calls within the same animation frame into a
   * single textContent write + scroll. Without this, 100+ chunks
   * in a single rAF window trigger 100+ layout/paint cycles and the
   * browser can drop intermediate frames, making the stream look
   * "一次性" even though the data is genuinely incremental.
   */
  private _streamRafHandle: number | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: LLMWikiPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.history = {
      messages: plugin.settings.queryHistory || []
    };
    this.isStreaming = false;
    this.aborted = false;
    this.accumulatedResponse = '';
    this.currentResponseDiv = null;
    this.historyContainer = null as unknown as HTMLElement;
    this.inputArea = null as unknown as HTMLTextAreaElement;
    this.sendBtn = null as unknown as HTMLButtonElement;
    this.historyCountDisplay = null as unknown as HTMLElement;
    this.activeRenderComponent = new Component();
    this.pendingInput = '';
  }

  getViewType(): string {
    return VIEW_TYPE_QUERY;
  }

  getDisplayText(): string {
    return TEXTS[this.plugin.settings.language].queryModalTitle;
  }

  getIcon(): string {
    return 'message-circle';
  }

  /**
   * v1.24.0 Bug A: Invalidate the engine-level PPR graph cache + this view's
   * last retrieval result so the next sendMessage rebuilds against whatever
   * wiki/ state is current. Called from main.ts onIngestDoneDispatch across
   * every open QueryView. Idempotent.
   */
  public invalidateGraph(): void {
    this.plugin.wikiEngine.invalidateGraph();
    // The term index is keyed on the wiki index FILE, but the full index also
    // holds body terms and the bodies come from the graph cache. A vault write
    // that changes a body without changing `index.md` would otherwise keep
    // serving an index built from the old prose — retrieval would rank on words
    // a page no longer has. Same lifecycle as the graph: drop both.
    this.termIndexCache.invalidate();
    const self = this as unknown as InternalView;
    self._lastRetrieval = null;
    console.debug('[QueryView] engine graph + term index + last retrieval invalidated');
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    const texts = TEXTS[this.plugin.settings.language];

    // v1.23.0 P2: Diagnostic — log actual queryHistory state when the
    // view is (re-)opened. Helps debug "history not loading on restart"
    // by showing exactly what plugin.settings has when onOpen runs.
    // Will be removed in v1.24.0 once the regression is confirmed fixed.
    console.debug(
      '[QueryView.onOpen] settings.queryHistory.length =',
      this.plugin.settings.queryHistory?.length ?? 'undefined',
      '| this.history.messages.length =',
      this.history.messages.length,
      '| isArray =',
      Array.isArray(this.plugin.settings.queryHistory)
    );

    // v1.23.0 P2: Refresh history from the latest settings on every
    // onOpen. The constructor captures the value once at instantiation,
    // but Obsidian may restore a cached view state where the settings
    // have since been updated (e.g. by another view writing, or by
    // loadData() after a hot-reload during dev). Re-reading here ensures
    // the user always sees the most recent persisted history.
    const persisted = this.plugin.settings.queryHistory;
    if (Array.isArray(persisted) && persisted.length !== this.history.messages.length) {
      this.history.messages = persisted.slice();
      console.debug(
        '[QueryView.onOpen] re-synced this.history.messages from settings:',
        this.history.messages.length
      );
    }

    contentEl.addClass('llm-wiki-query-view');
    contentEl.addClass('llm-wiki-query-content');

    const container = contentEl.createDiv({
      cls: 'llm-wiki-query-container'
    });

    const header = container.createDiv({
      cls: 'llm-wiki-query-header'
    });
    header.setText(texts.queryModalTitle);

    const hintText = container.createDiv({
      cls: 'llm-wiki-query-hint'
    });
    hintText.setText(texts.queryModalHint);

    this.historyContainer = container.createDiv({
      cls: 'llm-wiki-query-history'
    });

    this.history.messages.forEach((msg, idx) => {
      const turnIdx = Math.floor(idx / 2);
      this.renderHistoryMessage(msg.role, msg.content, turnIdx);
      // v1.24.0: re-hydrate retrieval labels from persisted history.
      // Find the just-rendered message wrapper by its position.
      if (msg.role === 'assistant' && msg.retrieval) {
        const wrapper = this.historyContainer.lastElementChild as HTMLElement | null;
        if (wrapper) {
          this.addRetrievalLabel(wrapper, msg.retrieval);
        }
      }
    });

    // 自动滚动到最新的消息底部
    this.scrollToBottom();

    this.rebuildTurnIndicator();

    const inputContainer = container.createDiv({
      cls: 'llm-wiki-query-input-container'
    });

    this.inputArea = inputContainer.createEl('textarea', {
      attr: {
        placeholder: texts.queryModalPlaceholder,
        rows: '3'
      },
      cls: 'llm-wiki-query-textarea'
    });

    // v1.23.0 P2: Unified Ctrl+Enter across all platforms (Mac/Win/Linux).
    // Previous design used Cmd+Enter on Mac (Platform.isMacOS), but
    // Electron's global menu intercepts Cmd+Enter on macOS before the
    // textarea keydown fires. Accepting both metaKey+ctrlKey OR-ed
    // caused inconsistent UX (some users only Ctrl, some only Cmd).
    // Unifying on Ctrl+Enter is the simplest cross-platform contract
    // and matches Obsidian's own send-message shortcuts.
    const modKey = 'Ctrl';

    this.inputArea.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter' && evt.ctrlKey) {
        evt.preventDefault();
        if (this.isStreaming) {
          this.stopGeneration();
        } else if (this.inputArea.value.trim()) {
          void this.sendMessage(this.inputArea.value);
        }
      }
    });

    // v1.24.0 UX: Sync the Send button's disabled state with the input.
    // Empty / whitespace-only input visually disables Send (the click
    // handler also early-returns, so this is defence in depth).
    // The listener is registered BEFORE `sendBtn` exists so we can hook the
    // input event early; the call into `updateSendDisabledState` short-
    // circuits when `sendBtn` is still null (constructor placeholder).
    const updateSendDisabledState = () => {
      if (!this.sendBtn) return;
      this.sendBtn.disabled = !this.isStreaming && this.inputArea.value.trim().length === 0;
    };
    this.inputArea.addEventListener('input', updateSendDisabledState);

    const buttonRow = inputContainer.createDiv({
      cls: 'llm-wiki-query-button-row'
    });

    this.sendBtn = buttonRow.createEl('button', {
      text: `${texts.queryModalSendButton} (${modKey}+Enter)`,
      cls: 'llm-wiki-query-send-btn mod-cta'
    });
    // Now that sendBtn exists, sync the initial disabled state.
    updateSendDisabledState();
    this.sendBtn.addEventListener('click', () => {
      if (this.isStreaming) {
        this.stopGeneration();
      } else if (this.inputArea.value.trim()) {
        void this.sendMessage(this.inputArea.value);
      }
    });

    buttonRow.createEl('button', {
      text: texts.queryModalSaveButton,
      cls: 'llm-wiki-query-save-btn'
    }).addEventListener('click', () => {
      if (this.history.messages.length > 0) {
        void this.saveToWiki();
      }
    });

    buttonRow.createEl('button', {
      text: texts.queryModalClearButton,
      cls: 'llm-wiki-query-clear-btn'
    }).addEventListener('click', () => {
      void this.clearHistory();
    });

    // v1.24.0 #251: Custom Query Instructions collapsible panel.
    // Lives between the button row and the history-count display so the
    // input area stays compact (panel is collapsed by default). Mounted
    // AFTER buttonRow so its DOM sits above historyCountDisplay but the
    // panel is collapsed until the user explicitly expands it.
    this._customInstructionsPanel = renderCustomInstructionsPanel(inputContainer, {
      initialValue: this.plugin.settings.customQueryInstructions ?? '',
      maxChars: CUSTOM_QUERY_INSTRUCTIONS_MAX_CHARS,
      language: this.plugin.settings.language,
      applyHandler: (value) => { void this.applyCustomInstructions(value); },
      clearHandler: () => { void this.clearCustomInstructions(); },
    });

    this.historyCountDisplay = inputContainer.createDiv({
      cls: 'llm-wiki-query-count'
    });
    const currentRounds = Math.floor(this.history.messages.length / 2);
    const maxRounds = this.plugin.settings.maxConversationHistory;
    this.historyCountDisplay.setText(
      texts.queryModalHistoryCount
        .replace('{}', currentRounds.toString())
        .replace('{}', maxRounds.toString())
    );
  }

  async onClose() {
    const { contentEl } = this;

    if (this.activeRenderComponent) {
      this.activeRenderComponent.unload();
      this.activeRenderComponent = null;
    }

    // v1.23.0 P2: Cancel any pending rAF that might fire after the
    // view is being torn down (would touch a detached DOM node).
    if (this._streamRafHandle !== null) {
      window.cancelAnimationFrame(this._streamRafHandle);
      this._streamRafHandle = null;
    }

    // v1.24.0 #251: dispose the Custom Query Instructions panel.
    // Removes event listeners + clears internal refs so a subsequent
    // open with a fresh panel doesn't see stale listeners.
    this._customInstructionsPanel?.dispose();
    this._customInstructionsPanel = null;

    // v1.23.0 P2: Skip persisting queryHistory on close if the user just
    // cleared it. clearHistory already awaits saveSettings; re-saving
    // here (with `this.history.messages` which is `[]`) is technically
    // a no-op BUT it can race with concurrent sendMessage completions
    // that may have pushed new messages between the clear and close.
    // Belt-and-braces: only skip if a clear happened within the last
    // 5 seconds (i.e. the user almost certainly intended the cleared state).
    if (Date.now() - this._lastClearTimestamp > 5000) {
      this.plugin.settings.queryHistory = this.history.messages;
      await this.plugin.saveSettings();
    }

    contentEl.empty();
  }

  private evaluateAndSuggestSave(): void {
    const assistantMessages = this.history.messages.filter(m => m.role === 'assistant');
    if (assistantMessages.length < 1) return;

    // Skip if this conversation was already offered for save and hasn't changed
    const hash = this.computeConversationHash();
    if (hash === this.plugin.settings.lastOfferedQueryHash) return;

    // Always use LLM to evaluate conversation value semantically
    void this.evaluateWithLLM();
  }

  private computeConversationHash(): string {
    return JSON.stringify(this.history.messages);
  }

  private async evaluateWithLLM(): Promise<void> {
    if (!this.plugin.llmClient) return;

    try {
      const conversationText = this.plugin.wikiEngine.formatConversation(this.history);
      const prompt = renderTemplate(PROMPTS.evaluateConversationValue, {
        conversation: conversationText.substring(0, 3000),
      });

      // v1.24.0 #208: log resolved query model for e2e verification.
      const queryModel = resolveModelForTask(this.plugin.settings, 'query');
      console.debug('[QueryView] evaluateConversationValue model:', queryModel);

      // v1.26.3 PATCH Phase B (Issue #443): typed-output path. Prefer
      // `result.output` when the client implements createMessageWithOutput
      // and the Tier 0 (json_schema) parse succeeds; fall back to
      // parseJsonResponse(text).
      let parsed: { valuable?: boolean; reason?: string } | null;
      if (this.plugin.llmClient.createMessageWithOutput) {
        const typedResult = await this.plugin.llmClient.createMessageWithOutput<{ valuable?: boolean; reason?: string }>({
          task: 'query-view-evaluate',
          model: queryModel,
          max_tokens: TOKENS_QUERY_SAVE_DEDUP,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object', schema: QueryViewValueSchema },
          ...(this.plugin.settings.disableThinking ? { enableThinking: false } : {}),
        });
        parsed = typedResult.output && typeof typedResult.output === 'object'
          ? typedResult.output
          : await parseJsonResponse(typedResult.text);
      } else {
        const response = await this.plugin.llmClient.createMessage({
          model: queryModel,
          max_tokens: TOKENS_QUERY_SAVE_DEDUP,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          ...(this.plugin.settings.disableThinking ? { enableThinking: false } : {}),
        });
        parsed = await parseJsonResponse(response);
      }

      if (parsed?.valuable) {
        this.plugin.settings.lastOfferedQueryHash = this.computeConversationHash();
        void this.plugin.saveSettings();
        new SuggestSaveModal(this.app, this.plugin, this.history, parsed.reason || '').open();
      }
    } catch {
      // LLM evaluation failed, skip suggestion
    }
  }

  async sendMessage(userMessage: string) {
    if (!userMessage.trim() || this.isStreaming) return;

    const texts = TEXTS[this.plugin.settings.language];

    this.history.messages.push({
      role: 'user',
      content: userMessage,
      timestamp: Date.now()
    });

    const userTurnIdx = Math.floor((this.history.messages.length - 1) / 2);
    this.renderHistoryMessage('user', userMessage, userTurnIdx);
    this.scrollToBottom();

    this.limitHistory();

    // Switch button to stop mode
    this.isStreaming = true;
    this.aborted = false;
    this.pendingInput = '';
    this.inputArea.value = '';
    this.sendBtn.setText(texts.queryModalStopButton);
    this.sendBtn.className = 'llm-wiki-query-stop-btn';

    // ChatGPT-style flat layout: full-width message div
    const assistantTurnIdx = Math.floor((this.history.messages.length - 1) / 2);
    const messageDiv = this.historyContainer.createDiv({
      cls: 'llm-wiki-query-message-wrapper llm-wiki-query-message-assistant llm-wiki-query-response-live',
      attr: { 'data-turn': String(assistantTurnIdx) }
    });

    messageDiv.createDiv({
      cls: 'llm-wiki-query-message-label',
      text: '🤖 Wiki'
    });

    const contentDiv = messageDiv.createDiv({
      cls: 'llm-wiki-query-message-body markdown-reading-view'
    });

    // v1.23.0 P2: Streaming-aware rendering — during accumulation, append
    // raw text to a plain-text element; only run the full MarkdownRenderer
    // pass when the stream completes. This avoids 70+ empty()+render cycles
    // per query (which caused "一次性输出" appearance despite real streaming).
    const streamTextDiv = messageDiv.createDiv({
      cls: 'llm-wiki-query-stream-text',
    });

    const statusIndicator = messageDiv.createDiv({
      cls: 'llm-wiki-query-status',
      text: texts.queryPhaseSearching
    });

    this.accumulatedResponse = '';

    // Track found pages info to merge into generating phase
    let foundPagesInfo = '';
    const foundPrefix = texts.queryPhaseFoundPages.split('{count}')[0];

    // Phase 1 & 2: Build wiki context (search → found → context ready)
    const wikiContext = await this.buildWikiContext(userMessage, (phase: string) => {
      if (phase.startsWith(foundPrefix)) {
        foundPagesInfo = phase;
      }
      statusIndicator.setText(phase);
    });

    if (this.aborted) {
      statusIndicator.remove();
      this.finishGeneration(texts as unknown as Record<string, string>);
      return;
    }

    // Phase 3: Generate response with elapsed timer
    const conversationMessages = this.history.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    const startTime = Date.now();
    let statusTemplate = foundPagesInfo
      ? `${foundPagesInfo}, ${texts.queryPhaseGenerating}`
      : texts.queryPhaseGenerating;
    const timerInterval = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      statusIndicator.setText(statusTemplate.replace('{time}', elapsed.toString()));
    }, 1000);

    const cleanupTimer = () => {
      window.clearInterval(timerInterval);
      statusIndicator.remove();
    };

    try {
      if (this.plugin.llmClient?.createMessageStream) {
        let fullResponse = '';
        // v1.24.0 #208: log resolved query model for e2e verification.
        const queryModel = resolveModelForTask(this.plugin.settings, 'query');
        console.debug('[QueryView] streaming chat model:', queryModel);
        logCustomInstructionsInjectionContext('streaming', userMessage, this.plugin.settings.customQueryInstructions);
        try {
          fullResponse = await this.plugin.llmClient.createMessageStream({
            model: queryModel,
            // Issue #469: the streamed chat answer is a known step — label it
            // for per-task accounting (distinct from query-view-evaluate, the
            // separate save-to-wiki judgement call at the top of this method).
            task: 'query-wiki' as const,
            // Issue #75 cap applied here rather than inherited: QueryView pre-caps
            // so the value is explicit and the `maxTokensPerCall=0` case
            // (no wrapper cap) is still covered. Post-#451 the wrapper
            // also caps `createMessageStream`; manual forwarding remains
            // for `enableThinking` and `chatTemperature` which the wrapper
            // does not inject.
            max_tokens: capMaxTokens(TOKENS_QUERY_ANSWER, this.plugin.settings),
            onFinish: (meta) => {
              if (meta.finishReason === 'length') {
                console.warn('[QueryView] streaming answer truncated (finish_reason=length) at max_tokens=', capMaxTokens(TOKENS_QUERY_ANSWER, this.plugin.settings));
                // Issue #850: a reasoning model bills its chain of thought
                // against the same budget as the answer, so a long thought can
                // leave the answer pane empty while the trace looks complete.
                // Say so instead of leaving the user to guess. The thinking
                // trace stays where it is — hiding it would lose the only
                // evidence of what happened.
                const budget = capMaxTokens(TOKENS_QUERY_ANSWER, this.plugin.settings);
                const hint = `答案在 max_tokens=${budget} 处被截断。思考过程占用了大量预算。若不需要推理，请在设置中关闭 thinking，或提高 maxTokensPerCall。`;
                new Notice(hint, NOTICE_ERROR);
                this.truncationHint = hint;
              }
            },
            system: appendCustomQueryInstructions(wikiContext, this.plugin.settings.customQueryInstructions),
            messages: conversationMessages,
            onChunk: (chunk) => {
              if (this.aborted) return;
              this.accumulatedResponse += chunk;
              // v1.23.0 P2: Streaming-aware — coalesce DOM updates into
              // a single rAF frame so the browser can paint each batch
              // as a separate visible step. Direct textContent writes
              // in tight succession cause 70+ layout cycles that the
              // browser can coalesce into a single visible render.
              this.scheduleStreamRender(streamTextDiv);
            },
            ...(this.plugin.settings.disableThinking ? { enableThinking: false } : {}),
            ...(this.plugin.settings.chatTemperature !== undefined ? { temperature: this.plugin.settings.chatTemperature } : {}),
          });
          cleanupTimer();
        } catch (streamErr) {
          if (this.aborted) {
            cleanupTimer();
            this.finishGeneration(texts as unknown as Record<string, string>);
            return;
          }
          console.warn('Streaming query failed, falling back to non-streaming:', streamErr);
          statusTemplate = foundPagesInfo
            ? `${foundPagesInfo}, ${texts.queryPhaseNonStreaming}`
            : texts.queryPhaseNonStreaming;
          // Fallback: try non-streaming if streaming fails
          if (this.plugin.llmClient?.createMessage) {
            // v1.24.0 #208: log resolved query model for e2e verification.
            const queryModel = resolveModelForTask(this.plugin.settings, 'query');
            console.debug('[QueryView] non-stream-fallback chat model:', queryModel);
            logCustomInstructionsInjectionContext('non-stream-fallback', userMessage, this.plugin.settings.customQueryInstructions);
            try {
              fullResponse = await this.plugin.llmClient.createMessage({
                model: queryModel,
                max_tokens: TOKENS_QUERY_ANSWER,
                onFinish: (meta) => {
                  if (meta.finishReason === 'length') {
                    console.warn('[QueryView] non-stream-fallback answer truncated (finish_reason=length) at max_tokens=', TOKENS_QUERY_ANSWER);
                  }
                },
                system: appendCustomQueryInstructions(wikiContext, this.plugin.settings.customQueryInstructions),
                messages: conversationMessages,
                ...(this.plugin.settings.disableThinking ? { enableThinking: false } : {}),
                ...(this.plugin.settings.chatTemperature !== undefined ? { temperature: this.plugin.settings.chatTemperature } : {}),
              });
              if (this.aborted) {
                cleanupTimer();
                this.finishGeneration(texts as unknown as Record<string, string>);
                return;
              }
              // v1.23.0 P2: Streaming never started — remove the preview div.
              streamTextDiv.remove();
              this.renderMarkdownContent(fullResponse, contentDiv);
              this.appendTruncationHint(contentDiv);
              this.scrollToBottom();
            } catch (fallbackErr) {
              console.error('Non-streaming fallback also failed:', fallbackErr);
              const errMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
              streamTextDiv.remove();
              contentDiv.createEl('p', {
                text: texts.queryModalErrorPrefix + errMsg,
                cls: 'llm-wiki-query-error'
              });
              cleanupTimer();
              this.finishGeneration(texts as unknown as Record<string, string>);
              return;
            }
          } else {
            const errMsg = streamErr instanceof Error ? streamErr.message : String(streamErr);
            contentDiv.createEl('p', {
              text: texts.queryModalErrorPrefix + errMsg,
              cls: 'llm-wiki-query-error'
            });
            cleanupTimer();
            this.finishGeneration(texts as unknown as Record<string, string>);
            return;
          }
          cleanupTimer();
        }

        // v1.20.0: Final render with fullResponse (includes 抠hink blocks
        // from reasoning_content). During streaming, onChunk only received
        // delta.text — the thinking content was accumulated separately by
        // createMessageStream and prepended as 抠hink tags in the return value.
        // v1.23.0 P2: Remove streaming plain-text preview, then run the full
        // MarkdownRenderer pass into contentDiv. Cancel any pending rAF
        // from the streaming phase first — the final renderMarkdownContent
        // call below replaces whatever the rAF was about to paint.
        if (this._streamRafHandle !== null) {
          window.cancelAnimationFrame(this._streamRafHandle);
          this._streamRafHandle = null;
        }
        if (fullResponse !== undefined && fullResponse !== null) {
          streamTextDiv.remove();
          this.renderMarkdownContent(fullResponse, contentDiv);
          this.appendTruncationHint(contentDiv);
          this.scrollToBottom();
        }

        if (!this.aborted) {
          this.history.messages.push({
            role: 'assistant',
            content: fullResponse,
            timestamp: Date.now(),
            // v1.24.0: persist retrieval metadata so the label
            // survives view re-open.
            retrieval: this._lastRetrieval ?? undefined,
          });
          // v1.23.0 P2: Persist queryHistory after each completed turn
          // so that an abrupt Obsidian close (which may not trigger
          // onClose) doesn't lose the conversation. This is the
          // "crash-safe" persistence path that complements the
          // onClose write-back.
          this.plugin.settings.queryHistory = this.history.messages;
          void this.plugin.saveSettings();
          console.debug(
            '[QueryView.sendMessage] persisted queryHistory, length =',
            this.plugin.settings.queryHistory.length
          );
        }
      } else {
        statusTemplate = foundPagesInfo
          ? `${foundPagesInfo}, ${texts.queryPhaseNonStreaming}`
          : texts.queryPhaseNonStreaming;
        logCustomInstructionsInjectionContext('non-stream-main', userMessage, this.plugin.settings.customQueryInstructions);
        // v1.24.0 #208: log resolved query model for e2e verification.
        const queryModel = resolveModelForTask(this.plugin.settings, 'query');
        console.debug('[QueryView] non-stream-main chat model:', queryModel);
        const response = await this.plugin.llmClient!.createMessage({
          model: queryModel,
          max_tokens: TOKENS_QUERY_ANSWER,
          onFinish: (meta) => {
            if (meta.finishReason === 'length') {
              console.warn('[QueryView] non-stream-main answer truncated (finish_reason=length) at max_tokens=', TOKENS_QUERY_ANSWER);
            }
          },
          system: appendCustomQueryInstructions(wikiContext, this.plugin.settings.customQueryInstructions),
          messages: conversationMessages,
          ...(this.plugin.settings.disableThinking ? { enableThinking: false } : {}),
          ...(this.plugin.settings.chatTemperature !== undefined ? { temperature: this.plugin.settings.chatTemperature } : {}),
        });

        if (this.aborted) {
          cleanupTimer();
          this.finishGeneration(texts as unknown as Record<string, string>);
          return;
        }

        this.history.messages.push({
          role: 'assistant',
          content: response,
          timestamp: Date.now(),
          retrieval: this._lastRetrieval ?? undefined,
        });
        // v1.23.0 P2: Crash-safe persistence (see streaming branch above).
        this.plugin.settings.queryHistory = this.history.messages;
        void this.plugin.saveSettings();
        console.debug(
          '[QueryView.sendMessage:non-stream] persisted queryHistory, length =',
          this.plugin.settings.queryHistory.length
        );

        this.renderMarkdownContent(response, contentDiv);
        this.scrollToBottom();
        cleanupTimer();
      }

    } catch (error) {
      console.error('Query failed:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      contentDiv.createEl('p', {
        text: texts.queryModalErrorPrefix + errorMsg,
        cls: 'llm-wiki-query-error'
      });
      cleanupTimer();
    }

    // Add copy button to live response
    const lastMsg = this.history.messages[this.history.messages.length - 1];
    if (lastMsg && lastMsg.role === 'assistant' && messageDiv) {
      contentDiv.setAttribute('data-raw-content', lastMsg.content);
      this.addCopyButton(messageDiv, contentDiv);
      this.addRetrievalLabel(messageDiv);
      messageDiv.removeClass('llm-wiki-query-response-live');
    }

    this.finishGeneration(texts as unknown as Record<string, string>);
  }

  stopGeneration() {
    this.aborted = true;
    this.pendingInput = this.inputArea.value;
    // v1.23.0 P2: Cancel any pending rAF so the aborted state is
    // reflected immediately rather than after the next paint frame.
    if (this._streamRafHandle !== null) {
      window.cancelAnimationFrame(this._streamRafHandle);
      this._streamRafHandle = null;
    }
  }

  private finishGeneration(texts: Record<string, string>) {
    this.isStreaming = false;
    this.currentResponseDiv = null;
    this.sendBtn.setText(`${texts.queryModalSendButton} (Ctrl+Enter)`);
    this.sendBtn.className = 'llm-wiki-query-send-btn mod-cta';
    // After generation: input area may be empty (consumed by send) OR have
    // pending input restored. Re-sync the disabled state in both cases.
    this.sendBtn.disabled = this.inputArea.value.trim().length === 0;

    // Restore pending input if user stopped generation
    if (this.pendingInput) {
      this.inputArea.value = this.pendingInput;
      this.pendingInput = '';
    }

    const currentRounds = Math.floor(this.history.messages.length / 2);
    const maxRounds = this.plugin.settings.maxConversationHistory;
    this.historyCountDisplay.setText(
      texts.queryModalHistoryCount
        .replace('{}', currentRounds.toString())
        .replace('{}', maxRounds.toString())
    );

    // v1.23.2 (#221 Variant 2): scroll-to-start on completion so the
    // user lands at the beginning of the answer, not the very bottom.
    this.scrollToStartOfCurrentTurn();

    this.rebuildTurnIndicator();
  }

  private scrollToStartOfCurrentTurn(): void {
    scrollToStartOfCurrentTurn(this.historyContainer, this.history.messages.length);
  }

  renderMarkdownContent(content: string, container: HTMLElement) {
    container.empty();

    // v1.20.0: extract thinking blocks BEFORE rendering so the visible
    // markdown goes to MarkdownRenderer and the reasoning goes into a
    // collapsible <details> panel above it (default collapsed, ChatGPT-style).
    // Fast guard: skip regex during streaming (onChunk only receives text deltas,
    // never think tags). Only run the full extraction when delimiters are present.
    //
    // PR #3 split: delegated to renderers/thinking-extract.ts. The wiki-link
    // normalization reuses the real `wikiFolder` so user configs with non-default
    // folders get the correct [[{folder}/path|display]] prefix substitution.
    // v1.25.2 PATCH: pass `container` to `extractThinkingPanel` so the
    // <details> collapsible panel is built against the parent's createEl
    // rather than `HTMLDocument.createEl`, which would auto-attach to
    // document.body and trip the runtime "Only one element on document
    // allowed" check the moment we tried to nest `details.createEl('summary')`.
    const { thinkingEl, normalized: normalizedContent } = extractThinkingPanel(
      content,
      this.plugin.settings.language,
      this.plugin.settings.wikiFolder,
      container,
    );

    // If reasoning is present, render the collapsible panel first so it
    // appears above the visible answer.
    if (thinkingEl) container.appendChild(thinkingEl);

    // Dispose previous render component to avoid stale/orphaned components
    if (this.activeRenderComponent) {
      this.activeRenderComponent.unload();
      this.activeRenderComponent = null;
    }

    this.activeRenderComponent = new Component();
    this.activeRenderComponent.load();

    const sourcePath = this.plugin.settings.wikiFolder;

    void MarkdownRenderer.render(
      this.app,
      normalizedContent,
      container,
      sourcePath,
      this.activeRenderComponent
    );

    // Bind click handlers on wiki-links so they work inside the Modal.
    // Obsidian's global delegated handler on document.body may not see
    // events from Modal DOM, so we attach per-link listeners manually.
    // PR #3 split: delegated to renderers/wiki-link-clicks.ts.
    bindWikiLinkClicks(container, this.app, sourcePath);
  }

  scrollToBottom() {
    scrollToBottom(this.historyContainer);
  }

  /**
   * v1.23.2 (#221 Variant 2): rebuild the right-edge turn indicator
   * whenever the conversation changes. Clicking a dot scrolls that
   * turn to the top of the history container.
   *
   * v1.25.11 PATCH follow-up v4: the indicator is a translated dot
   * stack. The whole stack slides vertically so the dot representing
   * the currently-visible turn sits at the indicator's centre. As
   * the user scrolls the history container the IntersectionObserver
   * callback fires `updateActiveDot`, which both swaps the active
   * class and updates the stack translation.
   */
  private rebuildTurnIndicator(): void {
    if (this._turnObserver) {
      this._turnObserver.disconnect();
      this._turnObserver = null;
    }

    const turnCount = Math.floor(this.history.messages.length / 2);
    if (turnCount === 0) {
      if (this._turnIndicator) {
        this._turnIndicator.remove();
        this._turnIndicator = null;
      }
      return;
    }

    const turnLabels: string[] = [];
    for (let i = 0; i < this.history.messages.length; i += 2) {
      const userMsg = this.history.messages[i];
      turnLabels.push(userMsg?.role === 'user' ? userMsg.content.slice(0, 120) : '');
    }

    this._turnIndicator = buildTurnIndicator(
      this.historyContainer,
      turnCount - 1,
      turnLabels,
      (idx) => this.scrollToTurn(idx)
    );

    this._turnObserver = observeVisibleTurn(
      this.historyContainer,
      this._turnIndicator,
      (activeIdx) => {
        if (activeIdx === null) return;
        if (!this._turnIndicator) return;
        updateActiveDot(this._turnIndicator, activeIdx);
      },
    );
  }

  private scrollToTurn(idx: number): void {
    scrollToTurn(this.historyContainer, idx);
  }

  /**
   * v1.23.0 P2: rAF-coalesced streaming render. Each onChunk call
   * appends to accumulatedResponse and schedules a single
   * requestAnimationFrame callback. If more chunks arrive before the
   * rAF fires, they share the same DOM write — guaranteeing one paint
   * per frame instead of one per chunk. This is the canonical fix
   * for "streamed data appears to render in one go" when the producer
   * (AI-SDK's textStream) yields faster than the browser can paint.
   */
  private scheduleStreamRender(streamTextDiv: HTMLElement): void {
    if (this._streamRafHandle !== null) return; // already scheduled
    this._streamRafHandle = window.requestAnimationFrame(() => {
      this._streamRafHandle = null;
      if (this.aborted) return;
      streamTextDiv.textContent = this.accumulatedResponse;
      this.scrollToBottom();
    });
  }

  renderHistoryMessage(role: 'user' | 'assistant', content: string, turnIdx?: number) {
    // Preserve the original conditional data-turn behavior: when turnIdx is
    // explicitly provided, set the attribute; otherwise leave it unset.
    const messageDiv = buildHistoryMessage(
      this.historyContainer,
      role,
      content,
      // forwarding via undefined propagates the same omit behavior to the
      // extracted renderer.
      turnIdx,
    );
    if (role === 'assistant') {
      const bodyDiv = messageDiv.querySelector('.llm-wiki-query-message-body') as HTMLElement;
      if (bodyDiv) {
        bodyDiv.setAttribute('data-raw-content', content);
        this.renderMarkdownContent(content, bodyDiv);
        addCopyButton(messageDiv, bodyDiv);
      }
    }
  }

  private addCopyButton(messageWrapper: HTMLElement, bodyDiv: HTMLElement) {
    addCopyButton(messageWrapper, bodyDiv);
  }

  /**
   * Add a persistent retrieval-arm label below the message body.
   * Surfaces the PPR cascade arm choice so users (and devs reading the
   * rendered chat) can see which retrieval method was used.
   * Skipped silently if no retrieval metadata was captured.
   */
  private addRetrievalLabel(
    messageWrapper: HTMLElement,
    retrieval: RetrievalLabelData | null = this._lastRetrieval,
  ): void {
    if (!retrieval) return;
    renderRetrievalLabel(messageWrapper, retrieval, this.plugin.settings.wikiFolder);
  }

  limitHistory() {
    const max = this.plugin.settings.maxConversationHistory;
    const totalMessages = this.history.messages.length;

    if (totalMessages > max * 2) {
      const keepCount = max * 2;
      this.history.messages = this.history.messages.slice(-keepCount);

      const texts = TEXTS[this.plugin.settings.language];
      new Notice(
        texts.historyTruncated.replace('{max}', String(max)),
        3000
      );

      this.historyContainer.empty();
      this.history.messages.forEach((msg, idx) => {
        const turnIdx = Math.floor(idx / 2);
        this.renderHistoryMessage(msg.role, msg.content, turnIdx);
      });
      this.rebuildTurnIndicator();
    }
  }

  async saveToWiki() {
    if (this.history.messages.length === 0) return;

    const texts = TEXTS[this.plugin.settings.language];
    const progressNotice = new Notice(texts.savingToWiki, 0);

    // Wire progress callback to update the sticky notice
    const origProgress = this.plugin.wikiEngine.getProgressCallback();
    this.plugin.wikiEngine.setProgressCallback((msg: string) => {
      progressNotice.setMessage(msg);
    });

    try {
      const report = await this.plugin.wikiEngine.ingestConversation(this.history);
      this.plugin.settings.lastOfferedQueryHash = this.computeConversationHash();
      void this.plugin.saveSettings();
      const lang = this.plugin.settings.language;
      const summary = lang === 'en'
        ? `${report.entitiesCreated} entities, ${report.conceptsCreated} concepts, ${report.createdPages.length} pages`
        : `${report.entitiesCreated} 实体, ${report.conceptsCreated} 概念, ${report.createdPages.length} 页`;
      // Issue #398: surface `report.errorMessage` so a silent-success outcome
      // (e.g. dedupCheck returned 'fully_redundant' — see conversation-ingest.ts:78-93)
      // does not lie to the user with an unconditional "saved" notice. The
      // i18n key carries the user's language; the underlying reason string
      // is the LLM's own verdict (kept verbatim) so DevTools inspection lines
      // up with the notice.
      const noticeTail = report.errorMessage
        ? `\n${texts.querySaveAlreadyExists}\n${report.errorMessage}`
        : '';
      new Notice(`${texts.saveToWikiSuccess}\n${summary}${noticeTail}`, NOTICE_NORMAL);
    } catch (error) {
      console.error('Save failed:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      const texts = TEXTS[this.plugin.settings.language];
      new Notice(texts.queryModalErrorPrefix + errorMsg, NOTICE_ERROR);
    } finally {
      progressNotice.hide();
      this.plugin.wikiEngine.setProgressCallback(origProgress);
    }
  }

  async clearHistory() {
    const beforeLen = this.history.messages.length;
    this.history.messages = [];
    this.historyContainer.empty();

    this.plugin.settings.queryHistory = [];
    // v1.23.0 P2: Await the save so the empty state is guaranteed to hit
    // disk before this method returns. The previous `void this.plugin.saveSettings()`
    // was fire-and-forget — if the user closed Obsidian immediately after
    // clicking Clear, the write could be lost. Awaiting closes that window.
    await this.plugin.saveSettings();
    this._lastClearTimestamp = Date.now();

    // v1.23.0 P2: Diagnostic — log the clear so user can verify in
    // DevTools that the empty array reached disk.
    console.debug(
      '[QueryView.clearHistory] cleared',
      beforeLen,
      'messages; settings.queryHistory after save =',
      JSON.stringify(this.plugin.settings.queryHistory)
    );

    const texts = TEXTS[this.plugin.settings.language];
    new Notice(texts.historyCleared, NOTICE_BRIEF);

    const maxRounds = this.plugin.settings.maxConversationHistory;
    this.historyCountDisplay.setText(
      texts.queryModalHistoryCount
        .replace('{}', '0')
        .replace('{}', maxRounds.toString())
    );
  }

  // v1.24.0 #251: persist user-supplied custom instructions and notify.
  // The cap is applied here too (defense in depth — the panel also caps
  // at the input layer).
  async applyCustomInstructions(value: string): Promise<void> {
    const capped = value.length > CUSTOM_QUERY_INSTRUCTIONS_MAX_CHARS
      ? value.slice(0, CUSTOM_QUERY_INSTRUCTIONS_MAX_CHARS)
      : value;
    this.plugin.settings.customQueryInstructions = capped;
    await this.plugin.saveSettings();
    console.debug(
      `[QueryView.applyCustomInstructions] saved length=${capped.length} chars`,
    );
    const texts = TEXTS[this.plugin.settings.language];
    new Notice(texts.instructionsApplied, NOTICE_SHORT);
  }

  // v1.24.0 #251: clear user-supplied custom instructions and notify.
  async clearCustomInstructions(): Promise<void> {
    this.plugin.settings.customQueryInstructions = '';
    await this.plugin.saveSettings();
    console.debug('[QueryView.clearCustomInstructions] cleared');
    const texts = TEXTS[this.plugin.settings.language];
    new Notice(texts.instructionsCleared, NOTICE_SHORT);
  }

  /**
   * Build the wiki context system prompt sent to the query LLM.
   *
   * PR #3 split: this used to be a 165-LOC method with 4 inline phases.
   * Now delegates to the pure pipeline modules:
   *   1. readWikiIndex (Phase 1)
   *   2. selectPprSeeds (Phase 2 — PPR + optional LLM augmentation)
   *   3. loadRelevantPagesForQuery (Phase 3 — Tier B summaries)
   *   4. assembleWikiContext (Phase 4 — system prompt assembly)
   *
   * v1.24.0 Bug A: the PPR graph cache moved to WikiEngine; only
   * `_lastRetrieval` writes remain on the class.
   */
  async buildWikiContext(userMessage: string, onProgress?: (phase: string) => void): Promise<string> {
    console.debug('=== buildWikiContext started ===');
    console.debug('User question:', userMessage);

    const texts = TEXTS[this.plugin.settings.language];
    const wikiFolder = this.plugin.settings.wikiFolder;
    const reader = this.plugin.wikiEngine;

    try {
      // Phase 1: Read the wiki index
      const indexResult = await readWikiIndex(wikiFolder, reader);
      console.debug('[Step 1] Index content:', indexResult.indexContent ? 'loaded' : 'not found');

      if (!indexResult.indexContent) {
        console.debug('[Step 1] Wiki is empty, returning hint');
        return emptyWikiHint(this.plugin.settings.wikiLanguage);
      }

      // v1.24.0 Bug A: warmup the engine-level graph BEFORE the PPR cascade
      // so the first query already has full graph state. The cache is shared
      // across QueryView leaves and invalidated on vault writes.
      const graph = await this.plugin.wikiEngine.getOrBuildGraph(indexResult.allPaths);

      // B-1 second half: the answer path's lexical channel reads
      // `PageRef.text`, and the prose lives in the graph cache — the index has a
      // summary line and no body. Enrich for the retrieval call ONLY: the
      // page-summary hint below wants one line per page and must not receive
      // full bodies.
      const retrievalRefs = withBodies(
        indexResult.pageRefs,
        this.plugin.wikiEngine.getPageBodies(),
      );

      // Phase 2: PPR cascade + optional LLM seed augmentation.
      // delegate returns { matches, armLabel, llmAugmented }
      //
      // `termIndex` carries a cache keyed on the index file. Building the term
      // table per query was 4.4 s against 21 ms to score from a prebuilt one on
      // 2,864 pages; a session that reads the same index now builds once.
      //
      // The retrieval sees the conversation. A follow-up question carries no
      // content words — "为什么？" scores nothing on its own — and the answer
      // generator then gets the right context with the wrong pages. Measured
      // 2026-10-15 on both vaults over 1,000 follow-up cases: 0.015-0.047 r@10
      // with the follow-up alone, 0.49-0.67 with the recent turns. The round
      // count is `maxConversationHistory`, the same window the answer sees, so
      // a provider's prefix cache stays stable across turns.
      // Sliding window of 5 user turns, not `maxConversationHistory`. The two
      // want different sizes: the answer wants the widest window a provider's
      // prefix cache will hold, the retrieval wants only the turns that say
      // what the user is looking for. Hand pass with the full conversation in
      // the query produced noise; see `RETRIEVAL_HISTORY_ROUNDS` in constants.
      // Three query strings, three policies. `prepareRetrievalInputs` owns the
      // distinction so it cannot be re-introduced at a call site: the LLM gets
      // the question as typed, the gate gets history + question with no
      // expansion, and the scorer and the walk get everything.
      // @DocTpoint's second review found the LLM was being handed the history
      // and the gate was being handed the expansion. See the function.
      const { retrievalQuery, expansionTerms: expansionQueryTerms, llmQuery, gateQuery } = prepareRetrievalInputs(
        userMessage,
        this.history.messages,
        RETRIEVAL_HISTORY_ROUNDS,
      );
      // Two-stage Rocchio expansion (#855). The query's own words and the
      // answer page's words are disjoint on the strict layer, so scoring the
      // query as written cannot find the page. The neighbourhood the ranking
      // already found knows the topic's vocabulary; read it twice, with a
      // re-rank between, and the query walks across. Every added word comes
      // from the user's notes.
      //
      // Terms are cached per index file (#855 review point 4). Rebuilding
      // them per query is the 4.4 s cost #843 removed from the seed scorer.
      const expansionPages = retrievalRefs.map(r => ({
        key: r.path,
        title: r.title,
        // The summary is the first slice of the body, NOT the first alias.
        // #855 review: the tool that measured this built `summary` as
        // `body.slice(0, 200)` while the production path used
        // `r.aliases[0] ?? ''`, which is empty on most pages. Measurement
        // must describe the code that ships. Both now use the body slice.
        summary: (r.text ?? '').slice(0, 200),
        text: r.text ?? '',
      }));
      const { terms: expansionTerms, corpus: expansionCorpus, index: expansionIndex } = this.expansionCache.get(
        indexResult.indexContent,
        expansionPages,
      );
      // The inverted index is the same one the cache built. It cuts the
      // scorer's work from "every page" to "the pages that carry a query
      // term" without changing the ranking; `expansion-inverted-index.test.ts`
      // pins the two together.
      //
      // The terms arrive SEGMENTED. `tokenizeQuery` keeps a Chinese run as one
      // token and `bm25fScore` looks terms up in a table built by `segment`, so
      // an uncut run matches nothing and the expansion returns its input
      // verbatim — a no-op on exactly the vaults this feature was measured on.
      const expandedQuery = twoStageExpand(
        expansionQueryTerms,
        expansionPages,
        expansionCorpus,
        DEFAULT_EXPANSION,
        expansionTerms,
        expansionIndex,
      ).join(' ');
      const seedResult = await selectPprSeeds(
        expandedQuery,
        retrievalRefs,
        graph,
        this.plugin.llmClient as unknown as Parameters<typeof selectPprSeeds>[3],
        this.plugin.settings,
        texts as unknown as Record<string, string>,
        onProgress,
        { cache: this.termIndexCache, indexContent: indexResult.indexContent },
        // #855 review point 2: the model sees the words the user wrote this
        // turn — not the expansion's, and not the history. The prompt labels
        // this "User question:", and from the second turn on `retrievalQuery`
        // is a transcript, not the question.
        llmQuery,
        // #855 review point 3: the gate reads the query as written plus the
        // history, with no expansion. Expansion words come from page bodies and
        // the gate measures the name tier's share of the query's IDF, so they
        // could only ever push a matching query into the paid stage.
        gateQuery,
      );

      // Write back _lastRetrieval for retrieval label UI
      const relevantPages = seedResult.matches.map(m => m.page.path);
      // The terms that produced this ranking, segmented. `loadRelevantPages`
      // is called later without a query and needs them to surface the matched
      // paragraphs. #855 fix 6.
      this._lastRetrievalTerms = retrievalQueryTerms(expandedQuery);
      this._lastRetrieval = {
        arm: seedResult.armLabel || 'none',
        count: relevantPages.length,
        // v1.24.1 PATCH Phase 5.5.0: top-N display follows the PPR
        // return value (which is already capped by select-seeds's
        // adaptive formula), not a hardcoded 5. Small wikis may return
        // fewer than 5 paths; large wikis may return 10–20.
        topPaths: relevantPages,
      };

      console.debug(`[Step 2] PPR cascade selected ${relevantPages.length} pages (arm: ${seedResult.armLabel || 'none'})`);
      // v1.24.1 PATCH Phase 5.5.0: log ALL matched paths (was hardcoded
      // slice(0, 5)). Hardcoded 5 misled users on large vaults that
      // return 10/20 pages via the adaptive top-N. Show every match
      // so the log + UI reflect the same list.
      console.debug(`[Step 2]   paths:`, seedResult.matches.map(m => `${m.page.path} (${m.arm}, score=${m.score.toFixed(3)})`));
      // Print the query the RETRIEVAL actually scores, not the message the
      // user typed. The two differ whenever the conversation is in play: a
      // follow-up like "为什么？" is one string to the user and a much longer
      // one to the scorer. Printing the typed message made a working fix look
      // broken — the user saw one token where the scorer saw the whole turn.
      console.debug(`[Step 2]   query tokens:`, retrievalQuery.toLowerCase().split(/\s+/).filter(k => k.length > 0));
      console.debug(`[Step 2]   history turns in query: ${this.history.messages.filter(m => m.role === 'user').length}`);
      console.debug(`[Step 2]   graph state: ${graph ? `${graph.nodes.length} nodes / ${graph.edges.size} edges` : 'none'}`);
      console.debug(`[Step 2]   LLM augmentation: ${seedResult.llmAugmented ? 'triggered' : 'skipped (fast path sufficient)'}`);

      // Phase 3: Loading pages
      onProgress?.(texts.queryPhaseLoadingPages);
      console.debug('[Step 3] Loading page content...');

      // Section labels for extractSummaryFromPage (Tier B). Cache on first call.
      if (!this._sectionLabels) {
        this._sectionLabels = getSectionLabels(this.plugin.settings);
      }
      const sectionLabels = this._sectionLabels
        ? {
            description: (this._sectionLabels as unknown as { description?: string }).description,
            definition: (this._sectionLabels as unknown as { definition?: string }).definition,
          }
        : null;

      const rawLoadedPages = await loadRelevantPagesForQuery(
        relevantPages,
        wikiFolder,
        reader,
        sectionLabels,
        // #855 fix 6. The retrieval scored the full body; the display shows one
        // section. These are the terms that earned each page, so the paragraph
        // that matched rides along with the summary the model reads. Omitting
        // this argument left the extractor with `[]` and the fix unreachable.
        this._lastRetrievalTerms,
      );
      console.debug('[Step 3] Pages loaded:', rawLoadedPages.length);

      console.debug('[Step 3] Graph shared from engine:', graph.nodes.length, 'nodes,', graph.edges.size, 'edges');

      // Phase: Context ready, about to generate
      onProgress?.(texts.queryPhaseContextReady);

      // Phase 4: Assemble the system prompt.
      // v1.24.1 PATCH Phase 5.5.0: stop sending the heavy `Wiki Index`
      // full text to the chat LLM. The page bodies already contain
      // the content the LLM needs; the index was redundant AND the
      // dominant contributor to prompt overflow on large vaults
      // (2137 nodes → ~70K tokens of index text). Optionally pass a
      // compact page summary list (path + title + aliases) so the
      // chat LLM can see what pages exist even if not retrieved.
      const pageSummaryHint = indexResult.pageRefs.length > 0
        ? indexResult.pageRefs.slice(0, 50).map(p => formatPageRefSummary(p)).join('\n')
        : undefined;
      const wikiContext = assembleWikiContext({
        pageSummaryHint,
        pageBodies: rawLoadedPages,
        armLabel: seedResult.armLabel,
        llmAugmented: seedResult.llmAugmented,
        pureLLM: seedResult.pureLLM,
        matchesCount: relevantPages.length,
        wikiFolder,
        wikiLanguage: this.plugin.settings.wikiLanguage,
      });

      console.debug('[Step 4] Wiki context built');
      console.debug('[Step 4] Context length:', wikiContext.length);
      return wikiContext;
    } catch (error) {
      console.error('[Error] buildWikiContext failed:', error);
      return wikiContextErrorHint(this.plugin.settings.wikiLanguage);
    }
  }

  async loadRelevantPages(pageTitles: string[]): Promise<string[]> {
    console.debug('=== loadRelevantPages started ===');
    console.debug('Page titles:', pageTitles);

    const sectionLabels = this._sectionLabels
      ? {
          description: (this._sectionLabels as unknown as { description?: string }).description,
          definition: (this._sectionLabels as unknown as { definition?: string }).definition,
        }
      : null;

    return loadRelevantPagesForQuery(
      pageTitles,
      this.plugin.settings.wikiFolder,
      this.plugin.wikiEngine,
      sectionLabels,
      // The terms of the retrieval that produced these titles. This method
      // takes no query of its own, so the terms ride on the instance — same
      // lifetime as `_lastRetrieval`, and empty when nothing has been
      // retrieved yet, which leaves the summary-only behaviour.
      this._lastRetrievalTerms,
    );
  }

  async selectSeedsWithLLM(
    query: string,
    pageRefs: import('../../core/ppr-cascade').PageRef[],
  ): Promise<string[]> {
    return selectSeedsWithLLM(
      query,
      pageRefs,
      this.plugin.llmClient as unknown as Parameters<typeof selectSeedsWithLLM>[2],
      this.plugin.settings,
    );
  }
}
