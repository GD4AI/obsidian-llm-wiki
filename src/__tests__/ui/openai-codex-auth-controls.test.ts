import { describe, expect, it, vi } from 'vitest';
import { CODEX_MODELS } from '../../llm-sdk/openai-codex/constants';
import { copyCodexDeviceCode, getCodexAuthUiState, openCodexExternalUrl, runCodexDeviceAuth, runCodexModelRefresh, runCodexSignOut } from '../../ui/openai-codex-auth-controls';
import { applyCodexModelPolicy, preserveCodexRuntimeModelState } from '../../llm-sdk/openai-codex/model-policy';
import type { CodexDevicePrompt } from '../../ui/openai-codex-auth-controls';

function deferred<T>(): { promise: Promise<T>; resolve(value: T): void; reject(error: unknown): void } {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
  return { promise, resolve, reject };
}

describe('Codex auth controls', () => {
  it('shows browser and device actions on desktop when signed out', () => {
    expect(getCodexAuthUiState({ isDesktop: true, isSignedIn: false, isBusy: false })).toEqual({ showBrowser: true, showDevice: true, showSignOut: false });
  });
  it('shows only device login on mobile when signed out', () => {
    expect(getCodexAuthUiState({ isDesktop: false, isSignedIn: false, isBusy: false })).toEqual({ showBrowser: false, showDevice: true, showSignOut: false });
  });
  it('shows only sign out when signed in', () => {
    expect(getCodexAuthUiState({ isDesktop: true, isSignedIn: true, isBusy: false })).toEqual({ showBrowser: false, showDevice: false, showSignOut: true });
  });
  it('hides actions while authorization is busy', () => {
    expect(getCodexAuthUiState({ isDesktop: true, isSignedIn: false, isBusy: true })).toEqual({ showBrowser: false, showDevice: false, showSignOut: false });
  });
  it('seeds the exact supported model list and removes custom model state', () => {
    const settings = { availableModels: ['custom'], model: 'custom', useCustomModel: true, lintModel: 'custom-lint', lintModelUseCustom: true, queryModel: 'gpt-5.4', queryModelUseCustom: true };
    applyCodexModelPolicy(settings);
    expect(settings).toEqual({ availableModels: [...CODEX_MODELS], model: CODEX_MODELS[0], useCustomModel: false, ingestModelUseCustom: false, lintModel: '', lintModelUseCustom: false, queryModel: 'gpt-5.4', queryModelUseCustom: false });
  });
  it('uses the cached account catalog instead of the bundled fallback', () => {
    const settings = { availableModels: ['old'], openAICodexModels: [{ slug: 'account-a' }, { slug: 'account-b' }], model: 'account-b', lintModel: 'missing', queryModel: 'account-a' };
    applyCodexModelPolicy(settings);
    expect(settings.availableModels).toEqual(['account-a', 'account-b']);
    expect(settings.model).toBe('account-b');
    expect(settings.lintModel).toBe('');
    expect(settings.queryModel).toBe('account-a');
  });
  it('selects the first account model when the current unified and task models are unavailable', () => {
    const settings = { openAICodexModels: [{ slug: 'account-a' }, { slug: 'account-b' }], model: 'missing', ingestModel: 'missing', lintModel: 'missing', queryModel: 'missing' };
    applyCodexModelPolicy(settings);
    expect(settings.model).toBe('account-a');
    expect(settings.ingestModel).toBe('');
    expect(settings.lintModel).toBe('');
    expect(settings.queryModel).toBe('');
  });
  it('excludes raw model slugs that the Responses endpoint marked unavailable', () => {
    const settings = { availableModels: [] as string[], openAICodexModels: [], openAICodexUnavailableModels: ['gpt-5.5'], model: 'gpt-5.5' };
    applyCodexModelPolicy(settings);
    expect(settings.availableModels).not.toContain('gpt-5.5');
    expect(settings.model).toBe('gpt-5.4');
  });
  it('preserves runtime Codex model pruning when the overall connection test fails', () => {
    const restored = { model: 'bad-model', openAICodexModels: [{ slug: 'bad-model' }], openAICodexUnavailableModels: [] as string[] };
    preserveCodexRuntimeModelState(restored, { model: 'working-model', ingestModel: 'working-model', lintModel: '', queryModel: '', openAICodexModels: [{ slug: 'working-model' }], openAICodexModelsFetchedAt: 123, openAICodexUnavailableModels: ['bad-model'] });
    expect(restored).toMatchObject({ model: 'working-model', openAICodexModels: [{ slug: 'working-model' }], openAICodexModelsFetchedAt: 123, openAICodexUnavailableModels: ['bad-model'] });
  });
  it('preserves a non-Codex provider model while carrying runtime catalog metadata back', () => {
    const restored = { provider: 'openai', model: 'gpt-4.1', availableModels: ['gpt-4.1'], openAICodexModels: [] as Array<{ slug: string }> };
    preserveCodexRuntimeModelState(restored, { provider: 'openai-codex', model: 'codex-model', openAICodexModels: [{ slug: 'codex-model' }], openAICodexModelsFetchedAt: 123, openAICodexUnavailableModels: ['bad-model'] });
    expect(restored).toMatchObject({ provider: 'openai', model: 'gpt-4.1', availableModels: ['gpt-4.1'], openAICodexModels: [{ slug: 'codex-model' }], openAICodexModelsFetchedAt: 123, openAICodexUnavailableModels: ['bad-model'] });
  });
  it('runs account model refresh with busy and success state', async () => {
    const events: string[] = [];
    await runCodexModelRefresh({ refresh: async () => ['a', 'b'], sync: () => { events.push('sync'); }, showSuccess: (count) => { events.push(`success:${count}`); }, showError: vi.fn(), setBusy: (value) => { events.push(`busy:${value}`); }, render: () => { events.push('render'); } });
    expect(events).toEqual(['busy:true', 'render', 'sync', 'success:2', 'busy:false', 'render']);
  });
  it('keeps the device prompt visible until deferred completion then clears it', async () => {
    const completion = deferred<void>();
    const events: string[] = [];
    const prompt = { verificationUrl: 'https://example.com/device', userCode: 'ABCD', complete: completion.promise, cancel: vi.fn() };
    let visiblePrompt: CodexDevicePrompt | null = null;
    const pending = runCodexDeviceAuth({ beginLogin: async () => prompt, openExternal: async (url) => { events.push(`open:${url}`); }, setPrompt: (value) => { visiblePrompt = value; events.push(`prompt:${value?.userCode ?? 'clear'}`); }, showError: vi.fn(), setBusy: (busy) => { events.push(`busy:${busy}`); }, setReady: (ready) => { events.push(`ready:${ready}`); }, render: () => { events.push('render'); } });
    await vi.waitFor(() => expect(events).toEqual(['busy:true', 'render', 'prompt:ABCD', 'render', 'open:https://example.com/device']));
    expect(visiblePrompt).toBe(prompt);
    completion.resolve();
    await pending;
    expect(visiblePrompt).toBeNull();
    expect(events).toEqual(['busy:true', 'render', 'prompt:ABCD', 'render', 'open:https://example.com/device', 'ready:false', 'prompt:clear', 'busy:false', 'render']);
  });
  it('surfaces external-opening failure, cancels completion, and restores controls', async () => {
    const completion = deferred<void>();
    const failure = new Error('popout unavailable');
    const cancel = vi.fn();
    const showError = vi.fn();
    const busy: boolean[] = [];
    const prompts: Array<string | null> = [];
    await runCodexDeviceAuth({ beginLogin: async () => ({ verificationUrl: 'https://example.com/device', userCode: 'ABCD', complete: completion.promise, cancel }), openExternal: async () => { throw failure; }, setPrompt: (prompt) => { prompts.push(prompt?.userCode ?? null); }, showError, setBusy: (value) => { busy.push(value); }, setReady: vi.fn(), render: vi.fn() });
    expect(cancel).toHaveBeenCalledOnce();
    expect(showError).toHaveBeenCalledWith(failure);
    expect(busy).toEqual([true, false]);
    expect(prompts).toEqual(['ABCD', null]);
  });
  it('copies the pending device code through the provided clipboard', async () => {
    const writeText = vi.fn(async () => undefined);
    await copyCodexDeviceCode('ABCD-EFGH', { writeText });
    expect(writeText).toHaveBeenCalledWith('ABCD-EFGH');
  });
  it('clears the persistent device prompt after cancellation without showing an error', async () => {
    const completion = deferred<void>();
    const controller = new AbortController();
    const prompt = { verificationUrl: 'https://example.com/device', userCode: 'ABCD', complete: completion.promise, cancel: () => { controller.abort(); completion.reject(new DOMException('Aborted', 'AbortError')); } };
    const prompts: Array<string | null> = [];
    const showError = vi.fn();
    const pending = runCodexDeviceAuth({ beginLogin: async () => prompt, openExternal: vi.fn(), setPrompt: (value) => { prompts.push(value?.userCode ?? null); }, showError, setBusy: vi.fn(), setReady: vi.fn(), render: vi.fn() });
    await vi.waitFor(() => expect(prompts).toEqual(['ABCD']));
    prompt.cancel();
    await pending;
    expect(controller.signal.aborted).toBe(true);
    expect(prompts).toEqual(['ABCD', null]);
    expect(showError).not.toHaveBeenCalled();
  });
  it('accepts null from successful noopener navigation and propagates synchronous opener failures', () => {
    const successTarget = { open: vi.fn(() => null) };
    expect(() => openCodexExternalUrl(successTarget, 'https://example.com/device')).not.toThrow();
    expect(successTarget.open).toHaveBeenCalledWith('https://example.com/device', '_blank', 'noopener,noreferrer');
    const failure = new Error('navigation unavailable');
    expect(() => openCodexExternalUrl({ open: () => { throw failure; } }, 'https://example.com/device')).toThrow(failure);
  });
  it('confirms sign-out once, prevents repeated clicks, and clears readiness after success', async () => {
    const completion = deferred<void>();
    const confirm = vi.fn(async () => true);
    let signedIn = true;
    const signOut = vi.fn(async () => { await completion.promise; signedIn = false; });
    const state = { busy: false, ready: true };
    const input = { isBusy: () => state.busy, isSignedIn: () => signedIn, confirm, signOut, showError: vi.fn(), setBusy: (value: boolean) => { state.busy = value; }, setReady: (value: boolean) => { state.ready = value; }, render: vi.fn() };
    const first = runCodexSignOut(input);
    const repeated = runCodexSignOut(input);
    await repeated;
    expect(confirm).toHaveBeenCalledOnce();
    expect(signOut).toHaveBeenCalledOnce();
    expect(state).toEqual({ busy: true, ready: true });
    completion.resolve();
    await first;
    expect(state).toEqual({ busy: false, ready: false });
    expect(input.render).toHaveBeenCalledTimes(2);
  });
  it('leaves readiness unchanged when confirmation is declined or sign-out fails', async () => {
    const declinedReady = vi.fn();
    await runCodexSignOut({ isBusy: () => false, isSignedIn: () => true, confirm: async () => false, signOut: vi.fn(), showError: vi.fn(), setBusy: vi.fn(), setReady: declinedReady, render: vi.fn() });
    expect(declinedReady).not.toHaveBeenCalled();
    const failure = new Error('secret storage failed');
    const showError = vi.fn();
    const busy: boolean[] = [];
    const setReady = vi.fn();
    await runCodexSignOut({ isBusy: () => false, isSignedIn: () => true, confirm: async () => true, signOut: async () => { throw failure; }, showError, setBusy: (value) => { busy.push(value); }, setReady, render: vi.fn() });
    expect(showError).toHaveBeenCalledWith(failure);
    expect(setReady).not.toHaveBeenCalled();
    expect(busy).toEqual([true, false]);
  });
  it('clears stale temporary readiness when sign-out clears credentials before persistence fails', async () => {
    let signedIn = true;
    const state = { busy: false, ready: true };
    const failure = new Error('persistence failed');
    const showError = vi.fn();
    await runCodexSignOut({ isBusy: () => state.busy, isSignedIn: () => signedIn, confirm: async () => true, signOut: async () => { signedIn = false; throw failure; }, showError, setBusy: (value) => { state.busy = value; }, setReady: (value) => { state.ready = value; }, render: vi.fn() });
    expect(showError).toHaveBeenCalledWith(failure);
    expect(state).toEqual({ busy: false, ready: false });
  });
});
