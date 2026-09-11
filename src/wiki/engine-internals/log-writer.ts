/**
 * LogWriter — wiki operation log (ingest + lint) writer.
 *
 * Extracted from WikiEngine (2026-07-19) as part of v1.25.1 Phase C-PR1.
 *
 * Responsibility:
 *   - Append ingest entries (## [date time] ingest | source_title · metrics)
 *     with deduplicated created-pages, updated-pages, and contradictions
 *   - Append lint-fix entries (## [date time] operation + details)
 *   - Trim the log file at 512 KB to avoid Obsidian choking on multi-MB files
 *     (trimming strategy: keep header + most-recent bytes aligned to H2 boundary)
 *   - Format byte counts (KB / MB) and metric suffix strings
 *
 * Non-responsibility:
 *   - The actual `vault.read` and `vault.process` calls live in WikiEngine's
 *     tryReadFile / createOrUpdateFile. LogWriter receives these as injected
 *     closures so it stays unit-testable.
 *   - Localized log label translation lives in TEXTS (per-locale logLabels table).
 *
 * Why extracted:
 *   - updateLog + logLintFix + formatIngestMetricsSuffix + formatBytes together
 *     totaled ~100 LOC with zero shared mutable state outside the log file
 *     itself. Composing them into a class makes the lifecycle (timestamp +
 *     header insertion + size cap) obvious.
 *   - Future log consumers (e.g. a "tail -f log.md" status indicator) can
 *     inject a custom writeFile and reuse the append-only invariants.
 */

import type { EmbeddedImageAnalysisReport, SourceAnalysis } from '../../types';
import { TEXTS } from '../../texts';
import { dedupPages } from './dedup-pages';
import { buildLogHeader } from '../../core/log-header';
import { formatBytes, localDateStamp } from '../../core/format';

/** Metrics suffix for ingest log H2 line. */
export interface IngestMetrics {
  durationSec?: number;
  model?: string;
  sourceBytes?: number;
  embeddedImageAnalysis?: EmbeddedImageAnalysisReport;
}

export interface LogWriterOptions {
  wikiFolder: string;
  wikiLanguage: string;
  /** Read the current log file content (returns null if not found). */
  readFile: (path: string) => Promise<string | null>;
  /** Write the full log content to the given path. */
  writeFile: (path: string, content: string) => Promise<void>;
}

export class LogWriter {
  private readonly wikiFolder: string;
  private readonly wikiLanguage: string;
  private readonly readFile: LogWriterOptions['readFile'];
  private readonly writeFile: LogWriterOptions['writeFile'];

  constructor(opts: LogWriterOptions) {
    this.wikiFolder = opts.wikiFolder;
    this.wikiLanguage = opts.wikiLanguage;
    this.readFile = opts.readFile;
    this.writeFile = opts.writeFile;
  }

  /**
   * Append an ingest entry. Format:
   *   ## [YYYY-MM-DD HH:MM] ingest | source_title · 28s · claude-sonnet-4-5 · 4.2KB
   *   **Created pages**: [[a]], [[b]]
   *   **Updated pages**: [[c]]
   *   **Contradictions found**:
   *   - claim1 vs page1
   */
  async appendIngest(
    operation: string,
    analysis: SourceAnalysis,
    metrics?: IngestMetrics,
  ): Promise<void> {
    const logPath = `${this.wikiFolder}/log.md`;
    const { date, time } = this.timestamp();
    const labels = this.labels();

    const h2Suffix = metrics ? this.formatIngestMetricsSuffix(metrics) : '';
    let entry = `\n\n## [${date} ${time}] ${operation} | ${analysis.source_title}${h2Suffix}\n\n`;
    entry += `**${labels.createdPages}**：${dedupPages(analysis.created_pages)
      .map(p => `[[${p.replace(this.wikiFolder + '/', '')}]]`)
      .join(', ')}\n\n`;
    entry += `**${labels.updatedPages}**：${analysis.updated_pages.map(p => `[[${p}]]`).join(', ')}\n\n`;
    if (metrics?.embeddedImageAnalysis) {
      const image = metrics.embeddedImageAnalysis;
      entry += `**Embedded images**: ${image.analyzed}/${image.discovered} analyzed; ${image.sent} sent from ${image.queued} queued in ${image.packages} package(s); ${image.convertedGifs} GIF first frame(s) converted; ${image.skipped.length} skipped; ${image.failedPackages} package(s) failed\n\n`;
    }

    if (analysis.contradictions.length > 0) {
      entry += `**${labels.contradictionsFound}**：\n`;
      for (const c of analysis.contradictions) {
        entry += `- ${c.claim} vs ${c.source_page}\n`;
      }
    }

    const existingLog = (await this.readFile(logPath)) || buildLogHeader(this.wikiLanguage);
    await this.writeFile(logPath, existingLog + entry);
  }

  /**
   * Append a lint-fix entry. Trims the log file at 512 KB to keep it manageable
   * in long-lived vaults. Trimming strategy: preserve the header + most-recent
   * bytes aligned to the next H2 boundary (so we never cut mid-entry).
   *
   * v1.25.1 Phase C-PR1.8 (Altitude #6): trim relies on the buildLogHeader
   * invariant that the header block is terminated by `\n\n`. If a future
   * change to `buildLogHeader` (in `src/core/log-header.ts`) breaks that
   * invariant — e.g. inserts a `---` separator or one-line subtitle — the
   * trim will silently drop real entries because `indexOf('\n\n')` returns
   * the FIRST occurrence anywhere in the file, not the bounded header. The
   * constants below document the seam: keep `buildLogHeader`'s terminator
   * in sync with `LogWriter.HEADER_TERMINATOR`.
   */
  private static readonly HEADER_TERMINATOR = '\n\n';
  private static readonly HEADER_FALLBACK = '# Wiki Operation Log\n\n';
  async appendLintFix(operation: string, details: string): Promise<void> {
    const logPath = `${this.wikiFolder}/log.md`;
    const { date, time } = this.timestamp();
    const entry = `\n\n## [${date} ${time}] ${operation}\n\n${details}\n`;

    try {
      let existingLog = await this.readFile(logPath);
      if (!existingLog) {
        existingLog = buildLogHeader(this.wikiLanguage);
      }

      // Cap at 512 KB to avoid Obsidian choking on multi-MB files.
      const MAX_LOG_BYTES = 512 * 1024;
      const projectedSize = (existingLog.length + entry.length) * 2; // UTF-16 estimate
      if (projectedSize > MAX_LOG_BYTES) {
        const headerEnd = existingLog.indexOf(LogWriter.HEADER_TERMINATOR);
        const header = headerEnd > 0
          ? existingLog.substring(0, headerEnd + LogWriter.HEADER_TERMINATOR.length)
          : LogWriter.HEADER_FALLBACK;
        const keepBytes = MAX_LOG_BYTES / 2;
        const trimmed = existingLog.substring(existingLog.length - keepBytes);
        const h2Idx = trimmed.indexOf('\n## ');
        existingLog = header + (h2Idx > 0 ? trimmed.substring(h2Idx + 1) : trimmed);
        console.warn(`[logLintFix] ${logPath} exceeded ${MAX_LOG_BYTES} bytes; trimmed oldest entries`);
      }
      await this.writeFile(logPath, existingLog + entry);
    } catch (e) {
      console.error(`[logLintFix] failed to write ${logPath}:`, e);
      throw e; // re-throw so callers (e.g. runLintWiki) can surface the failure
    }
  }

  /** Format an ingest metrics suffix: ` · 28s · claude-sonnet-4-5 · 4.2KB`. */
  private formatIngestMetricsSuffix(m: IngestMetrics): string {
    const parts: string[] = [];
    if (typeof m.durationSec === 'number' && m.durationSec > 0) {
      parts.push(`${m.durationSec}s`);
    }
    if (m.model) {
      // Strip trailing 8-digit date stamp: "claude-sonnet-4-5-20250929" → "claude-sonnet-4-5".
      // Avoid leaking internal provider IDs into the user's log.
      parts.push(m.model.replace(/-\d{8}$/, ''));
    }
    if (typeof m.sourceBytes === 'number' && m.sourceBytes > 0) {
      parts.push(formatBytes(m.sourceBytes));
    }
    return parts.length > 0 ? ` · ${parts.join(' · ')}` : '';
  }

  private timestamp(): { date: string; time: string } {
    const now = new Date();
    return {
      date: localDateStamp(now),
      time: now.toTimeString().slice(0, 5), // HH:MM
    };
  }

  private labels(): { createdPages: string; updatedPages: string; contradictionsFound: string } {
    const lang = this.wikiLanguage || 'en';
    type LogLangKey = keyof typeof TEXTS.en.logLabels;
    const langKey: LogLangKey = (lang in TEXTS.en.logLabels) ? lang as LogLangKey : 'en';
    return TEXTS.en.logLabels[langKey];
  }
}

/**
 * Render byte count with KB / MB units.
 * Re-exported so wiki-engine.ts's legacy `formatBytes` import still resolves.
 * v1.25.1 Phase C-PR1.8 cleanup: the canonical implementation moved to
 * `src/core/format.ts`; this re-export preserves backward compatibility.
 */
export { formatBytes } from '../../core/format';
