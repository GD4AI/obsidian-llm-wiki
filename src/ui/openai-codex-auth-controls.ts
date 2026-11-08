export interface CodexAuthUiInput {
  isDesktop: boolean;
  isSignedIn: boolean;
  isBusy: boolean;
}

export interface CodexAuthUiState {
  showBrowser: boolean;
  showDevice: boolean;
  showSignOut: boolean;
}

export interface CodexModelRefreshInput {
  refresh(): Promise<string[]>;
  sync(): void;
  showSuccess(count: number): void;
  showError(error: unknown): void;
  setBusy(value: boolean): void;
  render(): void;
}

export interface CodexDevicePrompt {
  verificationUrl: string;
  userCode: string;
  complete: Promise<unknown>;
  cancel(): void;
}

export interface CodexAsyncControlInput {
  showError(error: unknown): void;
  setBusy(value: boolean): void;
  setReady(value: boolean): void;
  render(): void;
}

export interface CodexDeviceAuthInput extends CodexAsyncControlInput {
  beginLogin(): Promise<CodexDevicePrompt>;
  openExternal(url: string): void | Promise<void>;
  setPrompt(prompt: CodexDevicePrompt | null): void;
}

export interface CodexClipboard {
  writeText(value: string): Promise<void>;
}

export interface CodexSignOutInput extends CodexAsyncControlInput {
  isBusy(): boolean;
  isSignedIn(): boolean;
  confirm(): Promise<boolean>;
  signOut(): Promise<void>;
}

export interface CodexExternalNavigationTarget {
  open(url: string, target: string, features: string): unknown;
}

export function getCodexAuthUiState(input: CodexAuthUiInput): CodexAuthUiState {
  if (input.isBusy) return { showBrowser: false, showDevice: false, showSignOut: false };
  if (input.isSignedIn) return { showBrowser: false, showDevice: false, showSignOut: true };
  return { showBrowser: input.isDesktop, showDevice: true, showSignOut: false };
}

export async function runCodexModelRefresh(input: CodexModelRefreshInput): Promise<void> {
  input.setBusy(true);
  input.render();
  try {
    const models = await input.refresh();
    input.sync();
    input.showSuccess(models.length);
  } catch (error) {
    input.showError(error);
  } finally {
    input.setBusy(false);
    input.render();
  }
}

export function openCodexExternalUrl(target: CodexExternalNavigationTarget, url: string): void {
  target.open(url, '_blank', 'noopener,noreferrer');
}

export async function copyCodexDeviceCode(code: string, clipboard: CodexClipboard): Promise<void> {
  await clipboard.writeText(code);
}

export async function runCodexDeviceAuth(input: CodexDeviceAuthInput): Promise<void> {
  let prompt: CodexDevicePrompt | null = null;
  let opened = false;
  input.setBusy(true);
  input.render();
  try {
    prompt = await input.beginLogin();
    input.setPrompt(prompt);
    input.render();
    await input.openExternal(prompt.verificationUrl);
    opened = true;
    await prompt.complete;
    input.setReady(false);
  } catch (error) {
    if (prompt && !opened) {
      prompt.cancel();
      void prompt.complete.catch(() => undefined);
    }
    if (!(error instanceof DOMException && error.name === 'AbortError')) input.showError(error);
  } finally {
    input.setPrompt(null);
    input.setBusy(false);
    input.render();
  }
}

export async function runCodexSignOut(input: CodexSignOutInput): Promise<void> {
  if (input.isBusy()) return;
  // v1.25.2 PATCH: confirm() now returns a Promise — Obsidian `ConfirmModal`
  // is intrinsically async, so we await it before deciding to sign out.
  // Lock busy immediately so a second click during the modal wait does
  // not call `confirm` a second time. The first click drives the action;
  // the second click is dropped.
  input.setBusy(true);
  input.render();
  let confirmed: boolean;
  try {
    confirmed = await input.confirm();
  } catch (error) {
    input.setBusy(false);
    input.render();
    input.showError(error);
    return;
  }
  if (!confirmed) {
    input.setBusy(false);
    input.render();
    return;
  }
  try {
    await input.signOut();
  } catch (error) {
    input.showError(error);
  } finally {
    if (!input.isSignedIn()) input.setReady(false);
    input.setBusy(false);
    input.render();
  }
}
