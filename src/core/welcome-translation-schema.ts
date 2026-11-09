// The reply shape for the welcome-note translation call.
//
// Declared here, not in `llm-sdk/output-schemas.ts`, because the only caller is
// `core/localize-welcome-note.ts` and `core/` must not import `llm-sdk/` (#931).
// `output-schemas.ts` imports and re-exports it, so the schema still has one
// definition and every existing importer is unchanged.
import { z } from 'zod';

/**
 * Translation of the welcome note. The model returns the whole note as
 * markdown inside `translated`. Widening passthrough so future fields
 * (e.g. `notes`) don't break.
 */
export const WelcomeTranslationLLMSchema = z.object({
  translated: z.string(),
}).loose();
export type WelcomeTranslationLLM = z.infer<typeof WelcomeTranslationLLMSchema>;
