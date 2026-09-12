// #688 — a file the requirements gate skips returns above the method's main
// try/finally, so the teardown that lives there never ran. Two consequences,
// and the second is worse than the reported symptom:
//
//   1. `onIngestionEnd` never fired, so the status bar stayed visible. (The
//      progress Notice the issue also reports is *not* this path — `reportSkip`
//      dispatches `onDone` with `skipped: true`, which reaches
//      `dismissProgress` in `onIngestDoneDispatch` for every non-`auto`
//      trigger. Checked against the code rather than the issue text.)
//   2. `this.abortController` stayed non-null. The guard at the top of
//      `ingestSource` only builds a controller — and only calls
//      `onIngestionStart` — when it finds none, so every later file in the
//      same batch inherited the skipped file's controller: no fresh signal,
//      no start hook, and `wasCancelled` never reset.
//
// The gate rejection is triggered with an empty note, which `checkNonEmpty`
// rejects with reason 'empty' — the shortest deterministic path to the skip
// and the same one the reported reproduction takes.

import { describe, it, expect } from 'vitest';
import { TFile } from 'obsidian';
import { createWikiEngineHarness } from '../__support__/wiki-engine-harness';

function sourceFile(path: string): TFile {
  const name = path.split('/').pop() ?? path;
  const dot = name.lastIndexOf('.');
  return Object.assign(new TFile(), {
    path,
    name,
    basename: dot > 0 ? name.slice(0, dot) : name,
    extension: dot > 0 ? name.slice(dot + 1) : 'md',
  });
}

describe('WikiEngine.ingestSource — a skipped file still tears down (#688)', () => {
  it('fires onIngestionEnd and clears the controller when the gate rejects', async () => {
    const h = createWikiEngineHarness({ files: { 'Notizen/blank.md': '' } });

    await h.engine.ingestSource(sourceFile('Notizen/blank.md'), { interactive: true });

    expect(h.startedFilenames).toEqual(['blank']);
    expect(h.endedCount).toBe(1);
    expect(h.engine.isIngesting()).toBe(false);
  });

  it('leaves no controller for the next file of a batch to inherit', async () => {
    const h = createWikiEngineHarness({
      files: { 'Notizen/blank-a.md': '', 'Notizen/blank-b.md': '' },
    });

    await h.engine.ingestSource(sourceFile('Notizen/blank-a.md'), {});
    await h.engine.ingestSource(sourceFile('Notizen/blank-b.md'), {});

    // Both files reach the start hook only when the first released the
    // controller — the second skips `new AbortController()` + the start call
    // otherwise.
    expect(h.startedFilenames).toEqual(['blank-a', 'blank-b']);
    expect(h.endedCount).toBe(2);
    expect(h.engine.isIngesting()).toBe(false);
  });
});
