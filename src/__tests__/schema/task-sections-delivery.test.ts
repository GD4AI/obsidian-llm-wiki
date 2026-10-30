// Issue #491: five default-schema sections (Source Page Template, Date
// Fields, Mentions Format, Content Rules, Multi-Source Merge Rules) reached
// only the 'full' callers — contradiction resolution and fill-empty-page —
// and never ingest, generation, or merge. The file promises "edit it freely";
// #328 Phase 1 made the schema file pure user domain knowledge whose edits
// must take effect, so the delivery map is ruled an oversight and extended.
//
// The delivery matrix below pins the WHOLE TASK_SECTIONS map, both to prove
// the new deliveries and to keep the unchanged tasks from silently growing.

import { describe, it, expect } from 'vitest';
import { TFile } from 'obsidian'; // mocked in setup.ts
import { SchemaManager } from '../../schema/schema-manager';
import type { LLMWikiSettings } from '../../types';

const ALL_SECTIONS = [
  'Wiki Structure',
  'Entity Page Template',
  'Concept Page Template',
  'Naming Conventions',
  'Source Page Template',
  'Date Fields',
  'Mentions Format',
  'Content Rules',
  'Classification Rules',
  'Multi-Source Merge Rules',
  'Maintenance Policies',
];

const SCHEMA_BODY = ALL_SECTIONS
  .map((h) => `## ${h}\n\n${h} body text.\n`)
  .join('\n');

function makeManager(): SchemaManager {
  const app = {
    vault: {
      getAbstractFileByPath: (path: string) =>
        path.includes('schema/config') ? Object.assign(new TFile(), { path }) : null,
      read: async () => SCHEMA_BODY,
      adapter: { read: async () => SCHEMA_BODY, readToString: async () => SCHEMA_BODY },
      getMarkdownFiles: () => [],
    },
  } as never;
  const settings = {
    provider: 'mock',
    model: 'mock-model',
    language: 'en',
    wikiLanguage: 'English',
    wikiFolder: 'wiki',
    disableThinking: false,
    maxTokensPerCall: 0,
  } as unknown as LLMWikiSettings;
  return new SchemaManager(app, settings, () => null);
}

function headingsOf(context: string): string[] {
  return [...context.matchAll(/^## (.+)$/gm)].map((m) => m[1]!);
}

// Sections are delivered in BODY order (selectSections filters the parsed
// body), so every expectation below follows ALL_SECTIONS order, not the
// whitelist's listing order.

describe('TASK_SECTIONS delivery matrix (#491 — oversight reading)', () => {
  it('delivers Mentions Format + Content Rules to entity generation', async () => {
    const ctx = await makeManager().getSchemaContext('entity');
    expect(headingsOf(ctx)).toEqual([
      'Entity Page Template',
      'Naming Conventions',
      'Mentions Format',
      'Content Rules',
      'Classification Rules',
    ]);
  });

  it('delivers Mentions Format + Content Rules to concept generation', async () => {
    const ctx = await makeManager().getSchemaContext('concept');
    expect(headingsOf(ctx)).toEqual([
      'Concept Page Template',
      'Naming Conventions',
      'Mentions Format',
      'Content Rules',
      'Classification Rules',
    ]);
  });

  it('delivers Content Rules to analyze', async () => {
    const ctx = await makeManager().getSchemaContext('analyze');
    expect(headingsOf(ctx)).toEqual([
      'Wiki Structure',
      'Naming Conventions',
      'Content Rules',
      'Classification Rules',
    ]);
  });

  it('delivers Source Page Template + Mentions Format to summary (the sources/ page writer)', async () => {
    // wiki-engine.ts writes sources/<slug>.md on buildSystemPrompt('summary').
    const ctx = await makeManager().getSchemaContext('summary');
    expect(headingsOf(ctx)).toEqual([
      'Wiki Structure',
      'Source Page Template',
      'Mentions Format',
      'Classification Rules',
    ]);
  });

  it('delivers Multi-Source Merge Rules + Date Fields to merge', async () => {
    const ctx = await makeManager().getSchemaContext('merge');
    expect(headingsOf(ctx)).toEqual([
      'Entity Page Template',
      'Concept Page Template',
      'Naming Conventions',
      'Date Fields',
      'Content Rules',
      'Classification Rules',
      'Multi-Source Merge Rules',
    ]);
  });

  it('leaves the unchanged tasks untouched', async () => {
    const mgr = makeManager();
    expect(headingsOf(await mgr.getSchemaContext('related'))).toEqual([
      'Naming Conventions',
      'Classification Rules',
    ]);
    expect(headingsOf(await mgr.getSchemaContext('conversation'))).toEqual([
      'Wiki Structure',
      'Entity Page Template',
      'Concept Page Template',
      'Naming Conventions',
      'Classification Rules',
    ]);
    // 'index' feeds the semantic dedup, which re-decides the entity/concept
    // classification on a cross-folder match — the user's Classification
    // Rules are the ruler for that decision.
    expect(headingsOf(await mgr.getSchemaContext('index'))).toEqual([
      'Wiki Structure',
      'Classification Rules',
    ]);
    expect(headingsOf(await mgr.getSchemaContext('lint'))).toEqual(['Maintenance Policies']);
  });

  it('full still returns every section unfiltered', async () => {
    const ctx = await makeManager().getSchemaContext('full');
    expect(headingsOf(ctx)).toEqual(ALL_SECTIONS);
  });
});
