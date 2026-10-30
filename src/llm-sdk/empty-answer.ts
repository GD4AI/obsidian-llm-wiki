// An answer that arrives empty must say so.
//
// Issue #916. The plugin prefers a streaming request when the provider offers
// one. When the gateway's frames are unusable — the #916 case, where the
// first frame arrived without its `data: ` prefix — the SSE parser drops it,
// keeps only the terminator, and the stream ends with no text and no
// exception. The query pane then renders a blank answer with no error
// anywhere.
//
// This is separate from `assertNotReasoningOnly` (`finish-reason.ts`), which
// fires when the model spent its budget on reasoning and left no answer.
// That guard deliberately stays silent when the finish reason is anything
// other than `length`. An empty body with a `stop` finish reason is a
// different thing: nothing came back at all.

/**
 * Throw when the answer is empty.
 *
 * `source` names where the answer should have come from, so the message
 * says which step produced nothing.
 */
export function assertNotEmptyAnswer(text: string, source: string): void {
  if (text.trim().length > 0) return;
  throw new Error(
    `The answer was empty: ${source} returned no content. `
    + 'This is not a parse error — the request succeeded and the body carried no answer. '
    + 'A gateway that answers with an event stream the plugin cannot read is one known cause.',
  );
}
