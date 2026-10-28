/**
 * Replace all `{{placeholder}}` tokens in a string with values from a vars map.
 *
 * Supported syntax: `{{name}}` where `name` matches `\w+` (letters, digits,
 * underscore). Unknown placeholders are left as-is AND emit `console.debug`
 * — this is strictly additive over the previous `.replace()` chains, which
 * silently left later occurrences unrendered.
 *
 * `key in vars` is sufficient: prompt site callers always pass inline object
 * literals, so prototype-pollution from `__proto__` / `constructor` is not
 * a concern in practice.
 *
 * Read-only and pure: no IO, no async.
 */
export interface RenderTemplateOptions {
  /**
   * Placeholders a LATER pass is expected to fill (Issue #904).
   *
   * The source analyzer splits `PROMPTS.analyzeSource` on `{{batch_context}}`
   * and renders the prefix first, so that marker and its neighbours are absent
   * by design on that pass. Naming them here keeps "not yet" from reading as
   * "typo" in the log, which is the difference between three noise lines on
   * every ingest and a warning someone investigates.
   *
   * A name present in `vars` is always rendered, deferred or not: deferral
   * cannot shadow a value.
   */
  defer?: readonly string[];
}

export function renderTemplate(
  template: string,
  vars: Record<string, string>,
  options?: RenderTemplateOptions,
): string {
  const deferred = options?.defer;
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    if (key in vars) {
      return vars[key];
    }
    if (deferred?.includes(key)) {
      return match;
    }
    console.debug(`[renderTemplate] unknown placeholder: ${match}`);
    return match;
  });
}