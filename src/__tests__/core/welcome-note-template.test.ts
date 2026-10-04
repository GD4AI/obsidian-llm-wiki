// Pure-function tests for welcome-note-template.ts
//
// buildWelcomeNote is a pure function that produces the English-template
// markdown body of the Welcome note. The LLM then translates to the
// user's wiki language at write time (D8, see core/localize-welcome-note.ts).
//
// v1.23.0 refactor (2026-06-28): the template no longer takes VaultCandidate
// suggestions. The "Initial Source Suggestions" section was removed because
// the checkbox affordance had no handler; the v1.23.0 multi-file ingest
// command (see #130) replaces it. Sections expanded to cover plugin
// commands and the wiki structure (entities / concepts / sources / Schema).

import { describe, it, expect } from 'vitest';
import { buildWelcomeNote, type LlmConfigStatus } from '../../core/welcome-note-template';

const STD_ARGS = {
  llmConfig: { ok: true, provider: 'OpenAI', model: 'gpt-4o-mini' } as LlmConfigStatus,
  createdAt: '2026-06-27',
};

describe('buildWelcomeNote — frontmatter', () => {
  it('always sets type: welcome in frontmatter', () => {
    const body = buildWelcomeNote(STD_ARGS);
    expect(body).toMatch(/^---/);
    expect(body).toMatch(/type:\s*welcome/);
  });

  it('includes createdAt in frontmatter', () => {
    const body = buildWelcomeNote({ ...STD_ARGS, createdAt: '2026-06-27' });
    expect(body).toMatch(/created:\s*2026-06-27/);
  });

  it('starts with a single H1 title', () => {
    const body = buildWelcomeNote(STD_ARGS);
    expect(body).toMatch(/^---[\s\S]*?---\n\n#\s+Welcome/);
  });
});

describe('buildWelcomeNote — line-break correctness (regression: 2026-06-28)', () => {
  // The v1 draft embedded "\n   " line-breaks inside paragraph
  // continuations, which Obsidian rendered as <br> (hard break),
  // producing ugly mid-line wraps. The fix is to use a SEPARATE
  // string per visual line — these join with \n but Obsidian does
  // not treat a single trailing newline as a hard break; the
  // renderer auto-wraps to the viewport.
  it('paragraph continuations are SINGLE lines (no embedded \\n in a visual line)', () => {
    const body = buildWelcomeNote(STD_ARGS);
    // v1.23.0 stage 4: intro is now a single short sentence (the
    // "Two ways to use" sub-list was removed). The body should
    // still have NO lines shorter than 10 chars (no hard-break
    // artifact tails from indented continuation text), except
    // for known-structural short lines: frontmatter delimiters
    // ("---") and code-fence markers ("```", "wiki/").
    const lines = body.split('\n');
    for (const ln of lines) {
      if (ln.trim().length === 0) continue;
      const trimmed = ln.trim();
      // Frontmatter delimiters.
      if (trimmed === '---') continue;
      // Code-fence markers.
      if (trimmed === '```') continue;
      // The first line of the wiki/ folder tree (just the dir name).
      if (trimmed === 'wiki/') continue;
      // Skip markdown table separator lines (e.g. "| --- | --- |").
      if (/^\|[-\s|]+\|$/.test(trimmed)) continue;
      expect(trimmed.length).toBeGreaterThan(10);
    }
  });

  it('each table row is a single line (markdown tables break on \\n)', () => {
    const body = buildWelcomeNote(STD_ARGS);
    // Pull a table row, ensure the | separators stay on one line.
    const tableRow = body.match(/^\| `Karpathy LLM Wiki: Ingest multiple files`[\s\S]*?$/m);
    expect(tableRow).toBeTruthy();
    expect(tableRow![0].includes('\n')).toBe(false);
  });

  it('uses \\n\\n (blank line) for paragraph breaks, not triple-space + \\n', () => {
    // Old draft used "   \n" for forced breaks; the fix uses '\n\n'.
    // Look for any backslash-n backslash-n — there should be many
    // of these, NOT a single "\n   \n" pattern (which would have
    // indicated an artifact from the old format).
    const body = buildWelcomeNote(STD_ARGS);
    const blankLineBreaks = (body.match(/\n\n/g) ?? []).length;
    expect(blankLineBreaks).toBeGreaterThan(8);
  });
});

describe('buildWelcomeNote — "How to verify the install" section', () => {
  it('includes the verify section with a green-light protocol when LLM is OK', () => {
    const body = buildWelcomeNote(STD_ARGS);
    expect(body).toMatch(/##\s+How to verify the install/);
    expect(body).toMatch(/in your wiki language/);
    // The verify section now points the user to Settings → Test Connection
    // (no visible ✅/⚠ status row in the body — moved to frontmatter).
    expect(body).toMatch(/Test Connection/);
  });

  it('includes recovery steps (open Settings → LLM Provider) when LLM is NOT configured', () => {
    const body = buildWelcomeNote({
      ...STD_ARGS,
      llmConfig: { ok: false, error: 'API key not configured' },
    });
    expect(body).toMatch(/Settings\s*→\s*Karpathy LLM Wiki/);
    expect(body).toMatch(/Test Connection/);
    expect(body).toMatch(/Recreate Wiki Welcome Note/);
  });
});

describe('buildWelcomeNote — "How to use this plugin" section', () => {
  it('renders a markdown table of the 7 commands', () => {
    const body = buildWelcomeNote(STD_ARGS);
    expect(body).toMatch(/##\s+How to use this plugin/);
    // Each command in a table row
    expect(body).toMatch(/\| `Karpathy LLM Wiki: Ingest multiple files`/);
    expect(body).toMatch(/\| `Karpathy LLM Wiki: Ingest single source`/);
    expect(body).toMatch(/\| `Karpathy LLM Wiki: Ingest from folder`/);
    expect(body).toMatch(/\| `Karpathy LLM Wiki: Query Wiki`/);
    expect(body).toMatch(/\| `Karpathy LLM Wiki: Lint wiki`/);
    expect(body).toMatch(/\| `Karpathy LLM Wiki: View operation history`/);
    expect(body).toMatch(/\| `Karpathy LLM Wiki: Recreate Wiki Welcome Note`/);
  });

  it('mentions the Ingest Multiple Files command (#130) as the day-one entry point', () => {
    const body = buildWelcomeNote(STD_ARGS);
    // v1.23.0 stage 4 shortened the table — the entry point now
    // reads "Day one — start here." (was "Day one. This is the
    // entry point."). The key facts to keep are: the command name
    // is present AND day-one is called out.
    expect(body).toMatch(/Karpathy LLM Wiki: Ingest multiple files/);
    expect(body).toMatch(/Day one/);
  });
});

describe('buildWelcomeNote — "What the wiki structure means" section', () => {
  it('explains entities / concepts / sources as the three core types', () => {
    const body = buildWelcomeNote(STD_ARGS);
    expect(body).toMatch(/##\s+What the wiki structure means/);
    expect(body).toMatch(/\*\*`entities\/`\*\*/);
    expect(body).toMatch(/\*\*`concepts\/`\*\*/);
    expect(body).toMatch(/\*\*`sources\/`\*\*/);
  });

  it('explains the optional Schema layer', () => {
    const body = buildWelcomeNote(STD_ARGS);
    expect(body).toMatch(/###\s+The Schema layer/);
    expect(body).toMatch(/wiki\/schema\//);
  });

  it('explains the wikilink graph as the query index', () => {
    const body = buildWelcomeNote(STD_ARGS);
    expect(body).toMatch(/###\s+The wikilink graph/);
    expect(body).toMatch(/\[\[X\]\]/);
  });

  it('shows a directory tree of wiki folder layout', () => {
    const body = buildWelcomeNote(STD_ARGS);
    expect(body).toMatch(/```\nwiki\//);
    expect(body).toMatch(/├── entities\//);
    expect(body).toMatch(/├── concepts\//);
    expect(body).toMatch(/├── sources\//);
    expect(body).toMatch(/├── schema\//);
    expect(body).toMatch(/├── index\.md/);
    expect(body).toMatch(/└── log\.md/);
  });
});

describe('buildWelcomeNote — "Quick start" section', () => {
  it('lists 4 numbered steps', () => {
    const body = buildWelcomeNote(STD_ARGS);
    expect(body).toMatch(/##\s+Quick start/);
    expect(body).toMatch(/1\.\s+\*\*/);
    expect(body).toMatch(/2\.\s+\*\*/);
    expect(body).toMatch(/3\.\s+\*\*/);
    expect(body).toMatch(/4\.\s+\*\*/);
  });

  it('mentions the Ingest Multiple Files command (#130) and View operation history', () => {
    const body = buildWelcomeNote(STD_ARGS);
    expect(body).toMatch(/Ingest multiple files/);
    expect(body).toMatch(/View operation history/);
  });

  it('mentions the Query Wiki panel', () => {
    const body = buildWelcomeNote(STD_ARGS);
    expect(body).toMatch(/Query Wiki/);
  });
});

describe('buildWelcomeNote — "Configuration Test" frontmatter (hidden metadata)', () => {
  // v1.23.0 refactor (2026-06-28): the visible "Configuration Test" H2
  // section was removed — the user feedback was that the ✅/⚠ status
  // row + provider/model/error lines broke the reading flow ("looks
  // like debug output"). LLM config state now lives in frontmatter
  // only, hidden by default in Obsidian's reading view. The user
  // verifies via Settings → LLM Provider → Test Connection.

  it('records llm_config_status: ok in frontmatter when LLM config is valid', () => {
    const body = buildWelcomeNote(STD_ARGS);
    expect(body).toMatch(/^llm_config_status:\s*ok\s*$/m);
    expect(body).toMatch(/^llm_config_provider:\s*OpenAI\s*$/m);
    expect(body).toMatch(/^llm_config_model:\s*gpt-4o-mini\s*$/m);
    expect(body).not.toMatch(/^llm_config_error:/m);
  });

  it('records llm_config_status: failed in frontmatter with quoted error', () => {
    const body = buildWelcomeNote({
      ...STD_ARGS,
      llmConfig: { ok: false, error: 'API key not configured' },
    });
    expect(body).toMatch(/^llm_config_status:\s*failed\s*$/m);
    expect(body).toMatch(/^llm_config_error:\s*"API key not configured"\s*$/m);
    expect(body).not.toMatch(/^llm_config_provider:/m);
    expect(body).not.toMatch(/^llm_config_model:/m);
  });

  it('quotes frontmatter error values that contain YAML-special characters', () => {
    const body = buildWelcomeNote({
      ...STD_ARGS,
      llmConfig: { ok: false, error: 'status 400: "weird: error: with # comment"' },
    });
    // The raw error must not appear unquoted in the frontmatter (would
    // break YAML parsing on ':' or '#'). The string must appear inside
    // a quoted form.
    expect(body).toMatch(/^llm_config_error:\s*"/m);
    // And the inner double-quote must be escaped.
    expect(body).toMatch(/\\"weird/);
  });
});

describe('buildWelcomeNote — structural invariants', () => {
  it('does NOT render the visible "Configuration Test" H2 section', () => {
    // v1.23.0 refactor: status is now frontmatter-only. The H2
    // section would render visible status rows that the user wanted
    // removed from the body.
    const body = buildWelcomeNote(STD_ARGS);
    expect(body).not.toMatch(/^##\s+Configuration Test\s*$/m);
  });

  it('does NOT render any HTML comment markers', () => {
    // v1.23.0 refactor: the `<!-- auto-generated -->` and
    // `<!-- end auto-generated -->` markers were visible artifacts in
    // the body. Status now lives in frontmatter; no visible markers
    // are needed.
    const body = buildWelcomeNote(STD_ARGS);
    expect(body).not.toMatch(/<!--/);
  });

  it('contains the expected H2 sections in order (verify, how-to, structure, quick-start)', () => {
    const body = buildWelcomeNote(STD_ARGS);
    const verifyIdx = body.indexOf('## How to verify the install');
    const howToUseIdx = body.indexOf('## How to use this plugin');
    const structureIdx = body.indexOf('## What the wiki structure means');
    const quickIdx = body.indexOf('## Quick start');
    expect(verifyIdx).toBeGreaterThan(-1);
    expect(howToUseIdx).toBeGreaterThan(verifyIdx);
    expect(structureIdx).toBeGreaterThan(howToUseIdx);
    expect(quickIdx).toBeGreaterThan(structureIdx);
  });

  it('does NOT include the legacy "Domains" or "Wiki Scope" sections', () => {
    // v1.23.0 refactor: removed user-input-collecting sections. They
    // had no consumers in the codebase.
    const body = buildWelcomeNote(STD_ARGS);
    expect(body).not.toMatch(/^##\s+Domains\s*$/m);
    expect(body).not.toMatch(/^##\s+Wiki Scope\s*$/m);
  });

  it('does NOT include legacy Initial Source Suggestions section with checkboxes', () => {
    // v1.23.0 refactor: removed the "- [ ] [[path]]" suggestion list
    // (no ingest handler). Users use the Ingest Multiple Files
    // command (see #130) instead.
    const body = buildWelcomeNote(STD_ARGS);
    expect(body).not.toMatch(/Initial Source Suggestions/);
    expect(body).not.toMatch(/- \[[ ]\] \[\[/);
  });
});