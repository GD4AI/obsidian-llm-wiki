// Core Wiki data structures.
//
// This file is a barrel since #929: the declarations live in `src/types/`.
// It stays a **file** rather than becoming `src/types/index.ts` because
// TypeScript resolves `./types` to the file before the directory of the same
// name, so every existing `from './types'` keeps working unchanged. Making the
// directory the barrel would rewrite every import in the repository and change
// nothing about what the code does.
//
// One rule holds the split together: **no part imports this module**. A part
// that did would recreate the seven-file cycle this change removed, and
// `arch-check` fails on it.

// Declared in `constants.ts`, not here: that module keys `EXTRACTION_LIMITS`
// and `RELATED_BUDGET` by it, so the declaration sits on the far side of the
// edge. Declaring it here made `constants.ts` import `types.ts`, which closed
// the seven-file cycle (#929).
export type { ExtractionGranularity } from './constants';

export * from './types/engine';
export * from './types/ingest';
export * from './types/llm';
export * from './types/providers';
export * from './types/query';
export * from './types/settings';
export * from './types/vocabulary';
export * from './types/write';
