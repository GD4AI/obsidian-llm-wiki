/**
 * LogWriter unit tests — wiki operation log appender + size cap.
 *
 * Extracted from WikiEngine (2026-07-19). Verifies:
 *   - appendIngest writes H2 entry with date/time, deduped created pages,
 *     updated pages, contradictions, and metrics suffix
 *   - appendLintFix writes H2 entry with details
 *   - log file size cap (512 KB) trims oldest entries while preserving header
 *   - formatBytes via LogWriter's exposed helper
 */

import { describe, it, expect, vi } from 'vitest';
import { LogWriter } from '../../../wiki/engine-internals/log-writer';
import type { SourceAnalysis } from '../../../types';

function makeAnalysis(overrides: Partial<SourceAnalysis> = {}): SourceAnalysis {
  return {
    source_file: 'sources/test.md',
    source_title: 'Test Source',
    summary: '',
    entities: [],
    concepts: [],
    related_pages: [],
    key_points: [],
    created_pages: ['wiki/sources/test.md'],
    updated_pages: ['wiki/concepts/c1.md'],
    source_note_aliases: [],
    ...overrides,
  };
}

describe('LogWriter', () => {
  it('appendIngest writes H2 entry with date + time + source_title + metrics', async () => {
    const writeFile = vi.fn().mockResolvedValue(undefined);
    const readFile = vi.fn().mockResolvedValue('# Wiki Operation Log\n');
    const writer = new LogWriter({
      wikiFolder: 'wiki',
      wikiLanguage: 'en',
      readFile,
      writeFile,
    });

    await writer.appendIngest('ingest', makeAnalysis({ source_title: 'Paper X' }), [], {
      durationSec: 28,
      model: 'claude-sonnet-4-5-20250929',
      sourceBytes: 4400,
    });

    expect(writeFile).toHaveBeenCalledTimes(1);
    const [path, content] = writeFile.mock.calls[0] as [string, string];
    expect(path).toBe('wiki/log.md');
    expect(content).toContain('## [');
    expect(content).toContain('ingest | Paper X');
    expect(content).toContain(' · 28s');
    expect(content).toContain(' · claude-sonnet-4-5'); // trailing 8-digit date stripped
    expect(content).toContain(' · 4.3KB'); // 4400 bytes → 4.3KB
  });

  it('appendIngest stamps the local calendar date, not the UTC one', async () => {
    // 00:30 local on 3 Sep. East of UTC the ISO date is still 2 Sep at this
    // hour; the log is read in local time, so the header must say 3 Sep.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 3, 0, 30));
    try {
      const writeFile = vi.fn().mockResolvedValue(undefined);
      const writer = new LogWriter({
        wikiFolder: 'wiki',
        wikiLanguage: 'en',
        readFile: vi.fn().mockResolvedValue('# Wiki Operation Log\n'),
        writeFile,
      });
      await writer.appendIngest('ingest', makeAnalysis(), [], {});
      const [, content] = writeFile.mock.calls[0] as [string, string];
      expect(content).toContain('## [2026-09-03 00:30] ingest');
    } finally {
      vi.useRealTimers();
    }
  });

  it('appendIngest with no metrics omits the suffix entirely', async () => {
    const writeFile = vi.fn().mockResolvedValue(undefined);
    const readFile = vi.fn().mockResolvedValue('# Header\n');
    const writer = new LogWriter({
      wikiFolder: 'wiki',
      wikiLanguage: 'en',
      readFile,
      writeFile,
    });

    await writer.appendIngest('ingest', makeAnalysis({ source_title: 'X' }), []);

    const content = (writeFile.mock.calls[0] as [string, string])[1];
    expect(content).toContain('ingest | X\n');
    expect(content).not.toContain(' · ');
  });

  it('appendIngest deduplicates created_pages', async () => {
    const writeFile = vi.fn().mockResolvedValue(undefined);
    const readFile = vi.fn().mockResolvedValue('');
    const writer = new LogWriter({
      wikiFolder: 'wiki',
      wikiLanguage: 'en',
      readFile,
      writeFile,
    });

    await writer.appendIngest('ingest', makeAnalysis({
      created_pages: ['wiki/sources/p.md', 'wiki/sources/p.md', 'wiki/sources/q.md'],
    }), []);

    const content = (writeFile.mock.calls[0] as [string, string])[1];
    // LogWriter strips the `wiki/` prefix; the wiki link keeps the `.md`
    // suffix (the rendered log link points to the on-disk path).
    expect(content).toContain('[[sources/p.md]]');
    expect(content).toContain('[[sources/q.md]]');
    // Two occurrences of [[sources/p.md]], NOT three
    const occurrences = (content.match(/\[\[sources\/p\.md\]\]/g) ?? []).length;
    expect(occurrences).toBe(1);
  });

  it('appendIngest with contradictions includes them', async () => {
    const writeFile = vi.fn().mockResolvedValue(undefined);
    const readFile = vi.fn().mockResolvedValue('');
    const writer = new LogWriter({
      wikiFolder: 'wiki',
      wikiLanguage: 'en',
      readFile,
      writeFile,
    });

    await writer.appendIngest('ingest', makeAnalysis(), [
      { claim: 'Sky is blue', source_page: 'page-a', contradicted_by: 'page-b', resolution: '' },
      { claim: 'Sky is green', source_page: 'page-c', contradicted_by: 'page-d', resolution: '' },
    ]);

    const content = (writeFile.mock.calls[0] as [string, string])[1];
    expect(content).toContain('Contradictions found');
    expect(content).toContain('- Sky is blue vs page-a');
    expect(content).toContain('- Sky is green vs page-c');
  });

  it('appendIngest writes header when log file does not exist', async () => {
    const writeFile = vi.fn().mockResolvedValue(undefined);
    const readFile = vi.fn().mockResolvedValue(null); // file missing
    const writer = new LogWriter({
      wikiFolder: 'wiki',
      wikiLanguage: 'en',
      readFile,
      writeFile,
    });

    await writer.appendIngest('ingest', makeAnalysis(), []);
    const content = (writeFile.mock.calls[0] as [string, string])[1];
    // buildLogHeader produces a header line; we just verify it doesn't crash
    // and the entry is appended after the header
    expect(content).toContain('## [');
    expect(content).toContain('ingest | Test Source');
  });

  it('appendLintFix writes H2 entry with details', async () => {
    const writeFile = vi.fn().mockResolvedValue(undefined);
    const readFile = vi.fn().mockResolvedValue('# Header\n');
    const writer = new LogWriter({
      wikiFolder: 'wiki',
      wikiLanguage: 'en',
      readFile,
      writeFile,
    });

    await writer.appendLintFix('fix: dead link', 'Resolved [[broken]] → [[fixed]]');
    const [path, content] = writeFile.mock.calls[0] as [string, string];
    expect(path).toBe('wiki/log.md');
    expect(content).toContain('## [');
    expect(content).toContain('fix: dead link');
    expect(content).toContain('Resolved [[broken]] → [[fixed]]');
  });

  it('appendLintFix trims log when projected size exceeds 512 KB', async () => {
    // Build a "fat" existing log that's well over the 512 KB threshold.
    // We need fatLog.length + entry.length * 2 > 512 KB to engage the trim path.
    // Each chunk is ~600 bytes; 1200 chunks ≈ 720 KB.
    const fatHeader = '# Wiki Operation Log\n\n';
    const chunk = '## [2026-01-01 12:00] old entry\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. '.padEnd(600, 'x') + '\n\n';
    const chunks: string[] = [];
    for (let i = 0; i < 1200; i++) chunks.push(chunk);
    const fatLog = fatHeader + chunks.join('');

    const writeFile = vi.fn().mockResolvedValue(undefined);
    const readFile = vi.fn().mockResolvedValue(fatLog);
    const writer = new LogWriter({
      wikiFolder: 'wiki',
      wikiLanguage: 'en',
      readFile,
      writeFile,
    });

    await writer.appendLintFix('fix: fresh entry', 'small content');
    const content = (writeFile.mock.calls[0] as [string, string])[1];
    // Trim happened — header preserved
    expect(content).toContain('# Wiki Operation Log');
    // Fresh entry appended
    expect(content).toContain('fix: fresh entry');
    // Old entries trimmed (size shrunk substantially)
    expect(content.length).toBeLessThan(fatLog.length);
  });

  it('appendLintFix re-throws write errors (caller surfaces)', async () => {
    const writeFile = vi.fn().mockRejectedValue(new Error('disk full'));
    const readFile = vi.fn().mockResolvedValue('');
    const writer = new LogWriter({
      wikiFolder: 'wiki',
      wikiLanguage: 'en',
      readFile,
      writeFile,
    });

    await expect(writer.appendLintFix('op', 'details')).rejects.toThrow('disk full');
  });
});