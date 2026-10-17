// The Obsidian API surface the dev-only index regeneration touches.
//
// `index-generator.ts` imports `{ TFile, normalizePath }`. `TFile` is a type and
// erases; `normalizePath` is the one runtime value, and Obsidian's own
// implementation is a path-separator normalisation. This stub exists so a dev
// tool can call the PRODUCTION generator outside Obsidian — the alternative was
// reimplementing the index rendering, which is the drift this track exists to
// remove.
//
// Scoped to tool runs by `tools/dev-instrument/tsconfig.tools-run.json`. The
// plugin build and `typecheck:tools` never see it.
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/^\/+/, '');
}

export class TFile {
  path = '';
  basename = '';
  extension = 'md';
}
