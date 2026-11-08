// #915: the answer pane rendered formulas as broken text.
//
// The model emits `\( … \)` for inline maths and `\[ … \]` for display maths.
// Obsidian's MarkdownRenderer treats `$…$` and `$$…$$` as maths and leaves a
// backslash-bracket span as literal text. Once the span is literal, the
// underscores inside it are ordinary markdown: emphasis parsing pairs them up
// across the sentence and eats them, which is why `w_{t,j}^{l}` reached the
// user as `w{t,j}^{l}`.
//
// Writing the conversion here rather than in the prompt is deliberate. The
// renderer sees every answer, from every provider, including answers already
// stored in history; a prompt instruction only covers answers produced after
// the instruction ships, and only for a provider that obeys it.

/** Text that must be shown verbatim, and so must not be rewritten. */
function protectedRanges(markdown: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];

  // Fenced block. The closer is searched explicitly rather than with one
  // regex: under the `m` flag `$` matches at every line end, so a single
  // pattern closes the block on the line after it opens. An unclosed fence
  // protects to the end of the text, because that is also how a renderer
  // treats it.
  const fenceOpen = /^[ \t]*(`{3,}|~{3,})[^\n]*$/gm;
  let m: RegExpExecArray | null;
  while ((m = fenceOpen.exec(markdown)) !== null) {
    const marker = m[1];
    const start = m.index;
    let end = markdown.length;
    const close = new RegExp(`^[ \\t]*${marker[0].repeat(marker.length)}[ \\t]*$`, 'gm');
    close.lastIndex = m.index + m[0].length;
    const closeMatch = close.exec(markdown);
    if (closeMatch !== null) end = closeMatch.index + closeMatch[0].length;
    ranges.push([start, end]);
    fenceOpen.lastIndex = end;
  }

  // Inline code, but only outside a fenced block.
  const inline = /`[^`\n]*`/g;
  while ((m = inline.exec(markdown)) !== null) {
    const at = m.index;
    if (ranges.some(([start, end]) => at >= start && at < end)) continue;
    ranges.push([at, at + m[0].length]);
  }

  return ranges.sort((a, b) => a[0] - b[0]);
}

/**
 * Rewrite a matched pair only. An unmatched `\(` stays as text: emitting a
 * lone `$` would turn the rest of the answer into one maths span, which is
 * worse than the defect being fixed.
 */
function convertSegment(text: string): string {
  return text
    .replace(/\\\(([^\n]{0,500}?)\\\)/g, (_all: string, body: string) => `$${body}$`)
    .replace(/\\\[([\s\S]{0,2000}?)\\\]/g, (_all: string, body: string) => `$$${body}$$`);
}

/**
 * Convert `\( … \)` and `\[ … \]` to the delimiters Obsidian renders.
 *
 * Idempotent: the output carries no backslash-bracket span, so a re-render of
 * the same answer is unchanged.
 */
export function normalizeMathDelimiters(markdown: string): string {
  const ranges = protectedRanges(markdown);

  let out = '';
  let pos = 0;
  for (const [start, end] of ranges) {
    if (start < pos) continue;
    out += convertSegment(markdown.slice(pos, start));
    out += markdown.slice(start, end);
    pos = end;
  }
  out += convertSegment(markdown.slice(pos));
  return out;
}
