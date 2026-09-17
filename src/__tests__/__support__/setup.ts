// Vitest global setup — runs once before all test files
// Centralizes obsidian mock to eliminate per-file eslint-disable

import { vi } from 'vitest';
import { installObsidianDomHelpers } from './dom-helpers';

// Polyfill window for code that uses window.setTimeout (e.g. withRetry)
// @ts-expect-error — node test environment, window is not native
globalThis.window = globalThis;

// NoticeMock hoisted to top of file so vi.mock factory can reference it
const { NoticeMock } = vi.hoisted(() => {
  class NoticeMock {
    static instances: Array<{ message: string; hidden: boolean }> = [];
    private _message: string;
    constructor(message: string, _timeout?: number) {
      this._message = message;
      NoticeMock.instances.push({ message, hidden: false });
      // Testing: console intentionally not used
    }
    setMessage(message: string): void {
      this._message = message;
    }
    hide(): void {
      const last = NoticeMock.instances[NoticeMock.instances.length - 1];
      if (last) last.hidden = true;
    }
  }
  return { NoticeMock };
});

// Mock obsidian module globally — all tests inherit this
vi.mock('obsidian', () => ({
  // Basic exports
  normalizePath: (path: string) => path,
  Notice: NoticeMock,
  // TFile/TFolder stubs
  TFile: class {
    path = '';
    basename = '';
    extension = '';
  },
  TFolder: class {
    path = '';
    name = '';
  },
  // Modal base class (simplified for testing)
  Modal: class {
    app: unknown;
    // Testing: HTMLElement stubbed as any to avoid DOM dependency
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contentEl: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    modalEl: any;
    constructor(app: unknown) {
      this.app = app;
      this.contentEl = {};
      this.modalEl = {};
    }
    open() {}
    close() {}
    onOpen() {}
    onClose() {}
  },
  // ItemView base class (simplified for testing) — used by QueryView.
  // Without this, importing query-engine.ts (`class QueryView extends
  // ItemView`) throws "extends undefined" at module load.
  ItemView: class {
    app: unknown;
    leaf: unknown;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contentEl: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    containerEl: any;
    constructor(leaf: unknown) {
      this.leaf = leaf;
      this.contentEl = {};
      this.containerEl = {};
    }
    onOpen(): Promise<void> {
      return Promise.resolve();
    }
    onClose(): Promise<void> {
      return Promise.resolve();
    }
    getViewType(): string {
      return '';
    }
    getDisplayText(): string {
      return '';
    }
    getIcon(): string {
      return '';
    }
  },
  WorkspaceLeaf: class {},
  // Platform detection
  Platform: {
    isMacOS: false,
    isMobile: false,
    isDesktopApp: true,
  },
  // MarkdownRenderer
  MarkdownRenderer: {
    renderMarkdown: async () => {},
  },
  // Component
  Component: class {
    load() {}
    unload() {}
  },
  // PluginSettingTab base class — used by settings.ts, imported via main.ts
  PluginSettingTab: class {
    app: unknown;
    containerEl: HTMLElement;
    constructor(app: unknown) {
      this.app = app;
      this.containerEl = activeDocument.createElement('div');
    }
    display() {}
  },
  // Plugin base class — minimal stub so main.ts can be imported in tests
  Plugin: class {
    app: unknown;
    manifest: unknown;
    constructor(app: unknown, manifest: unknown) {
      this.app = app;
      this.manifest = manifest;
    }
    load() {}
    unload() {}
    addCommand() {}
    registerView() {}
    registerEditorSuggest() {}
    addChild() {}
    registerDomEvent() {}
    registerInterval() {}
    loadData() { return Promise.resolve({}); }
    saveData() { return Promise.resolve(); }
  },
  // Suggest modals (stubbed — used in settings.ts FolderSuggestModal)
  FuzzySuggestModal: class {
    constructor() {}
    open() {}
    close() {}
    onOpen() {}
    onClose() {}
  },
  // Network requests — tests control return values via vi.mocked(requestUrl)
  requestUrl: vi.fn(),
}));

// Stub activeDocument for jsdom test environment.
// Production code uses activeDocument (Obsidian's popout-window-aware
// document reference). jsdom only provides `document`, so we alias it
// here so that tests don't need per-file eslint-disable comments.
(globalThis as Record<string, unknown>).activeDocument = globalThis.document;

// Stub activeWindow for code that needs SubtleCrypto (PDF cache sha256).
// Production uses Obsidian's popout-window-aware `activeWindow`. jsdom's
// default `window` does not implement SubtleCrypto, so we attach a minimal
// `crypto.subtle` mock here. Tests that need deterministic sha256 output
// override this in their own beforeEach.
(globalThis as Record<string, unknown>).activeWindow = globalThis.window ?? globalThis;

// crypto is a non-writable getter in jsdom ≥24 (per Web spec). Use
// defineProperty so the test shim can install a minimal SubtleCrypto mock.
Object.defineProperty(globalThis, 'crypto', {
  configurable: true,
  writable: true,
  value: {
    subtle: {
      digest: async (_algo: string, data: ArrayBuffer) => {
        // Test-only SubtleCrypto.digest: produce a deterministic 32-byte
        // digest from the input bytes. NOT cryptographically secure —
        // only ensures the cache key is stable + unique for distinct inputs.
        const view = new Uint8Array(data);
        const out = new Uint8Array(32);
        let h = 0;
        for (let i = 0; i < view.length; i++) {
          h = ((h << 5) - h + view[i]) | 0;
          out[i % 32] = (out[i % 32] + view[i]) & 0xff;
        }
        out[31] = h & 0xff;
        return out.buffer;
      },
    } as SubtleCrypto,
    // Issue #723: the plugin generates a per-client session id for
    // OpenAI-compatible providers that require one. `defineProperty` above
    // replaces the whole `crypto` object, so jsdom's native `randomUUID` is not
    // reachable — without this shim, constructing a compat client throws.
    // Unique per call rather than random; nothing asserts the value.
    randomUUID: (() => {
      let seq = 0;
      return () => `00000000-0000-4000-8000-${String(seq += 1).padStart(12, '0')}`;
    })(),
  },
});

// Mirror Obsidian's HTMLElement extensions on whatever DOM implementation
// is in use. Obsidian production runtime adds `createEl` / `createDiv` /
// `createSpan` / `setText` / `addClass` to HTMLElement.prototype and
// Document.prototype. jsdom does not ship these, so production code
// calling e.g. `parent.createEl('div', {...})` would throw
// `TypeError: parent.createEl is not a function` under the test runner.
//
// Install the same shape Obsidian documents (see `src/types/obsidian-dom.d.ts`)
// onto `HTMLElement.prototype` and `Document.prototype` if either is
// available. Skip silently on pure-node test files where neither exists.
if (typeof HTMLElement !== 'undefined' && typeof Document !== 'undefined'
    && typeof HTMLElement.prototype === 'object') {
  installObsidianDomHelpers(
    { HTMLElement, Document },
    activeDocument,
  );
}

// Global test environment setup
export function setup(): void {
  // Future: global test state initialization
}

export function teardown(): void {
  // Future: global cleanup
}
