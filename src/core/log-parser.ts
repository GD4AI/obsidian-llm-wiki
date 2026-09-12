// Log parser for the Operation History Panel (#122).
//
// wiki/log.md is the authoritative, machine- AND human-readable record of every
// operation LLM-Wiki performs on the user's Wiki. Structure (from real-world
// samples):
//
//   ## [YYYY-MM-DD] ingest | <source_title>
//     **Created pages**: [[...]], [[...]]
//     **Updated pages**: [[...]]
//
//   ## [YYYY-MM-DD HH:MM] Wiki 维护报告           ← "Maintenance Report" entry
//     > Wiki 状态概览：共 38 个页面，0 个缺失别名，重复 0 个，断链 19 个，耗时 7 秒
//     - [[a]] → **b**（页面不存在）
//     - [[c]] → **d**（页面不存在）
//     ### 标签越界（程序检测）[共 1 个]
//     - [[x]] — invalid: document
//     ### 孤立页面（程序检测）[共 2 个]
//     - [[y]] — 无其他 Wiki 页面链接至此
//     ### LLM 分析
//     - [矛盾：...]
//     - [过时：...]
//
//   ## [YYYY-MM-DD HH:MM] Lint — fixDeadLinks    ← Individual fix runner entry
//     - [[entities/Foo]]: cleaned 5 dead links
//
// Operation kinds are inferred from the H2 text (no separate marker field), so
// the parser must be tolerant: if it can't classify, it falls back to 'other'.

import { logLabelLineRe } from './log-labels';

/** Ingest-specific metadata parsed from the H2 line suffix. */
export interface IngestMetrics {
  /** Ingest duration in seconds (HH:MM timestamp in H2 also drives `date`+`time`). */
  durationSec?: number;
  /** LLM model id (last `-YYYYMMDD` segment stripped for display). */
  model?: string;
  /** Source file size in bytes (rendered as KB/MB). */
  sourceBytes?: number;
}

export type OperationKind =
  /** User triggered source ingestion. */
  | 'ingest'
  /** Programmatic scan + LLM analysis report (formerly just "lint"). */
  | 'maintenance'
  /** A specific fix runner applied changes (e.g. fixDeadLinks, fixPollutedSources). */
  | 'fix'
  /** Any other operation we don't yet classify. */
  | 'other';

/** A KPI parsed from the `>` blockquote header of a maintenance report. */
export interface KpiSummary {
  totalPages?: number;
  missingAliases?: number;
  duplicates?: number;
  deadLinks?: number;
  orphans?: number;
  emptyPages?: number;
  unsourced?: number;
  tagViolations?: number;
  /** Wall-clock time of the Lint run, in seconds. */
  durationSeconds?: number;
}

/** Semantic kind of a report section — drives Modal rendering decisions. */
export type SectionKind =
  | 'deadLinks'      // - [[src]] → **tgt**（页面不存在） / - [[src]] → **tgt** (page not found)
  | 'tagViolation'   // - [[path]] — invalid: xxx
  | 'orphan'         // - [[path]] — 无其他 Wiki 页面链接至此 / no other Wiki page links here
  | 'empty'          // - [[path]] — 内容不足 N 字符 / content < N chars
  | 'duplicate'      // (reserved for future)
  | 'llmAnalysis'    // - **[类型]**：... / - [contradiction: ...] [outdated: ...] [missing: ...] [structure: ...]
  | 'unknown';       // fallback when none of the patterns match

/** Type chip in LLM analysis entries (矛盾 / 过时 / 缺失 / 结构 / etc.). */
export type LlmAnalysisType = string;

/** Structured item parsed from one bullet inside a report section. */
export interface SectionItem {
  /** Wiki link targets in the bullet (in order). */
  links: DetailLink[];
  /** Bullet text with `[[path]]` markers stripped. */
  text: string;
  /** Original raw bullet text (e.g. `- [[src]] → **tgt**`). */
  raw: string;
  /** For `deadLinks`: the missing target page name (extracted from `**tgt**`). */
  targetPage?: string;
  /** For `llmAnalysis`: the [type] prefix (矛盾 / 过时 / 缺失 / 结构). */
  llmType?: LlmAnalysisType;
  /** Severity inferred from the bullet. Drives Modal color tier. */
  severity: 'none' | 'low' | 'medium' | 'high';
}

/** A labelled section inside a maintenance/fix entry. */
export interface ReportSection {
  /** Semantic kind — drives how the Modal renders this section. */
  kind: SectionKind;
  /** Section heading text (without leading `###`). May include `[共 N 个]`. */
  heading: string;
  /** Optional count extracted from `[共 N 个]` in the heading. */
  count?: number;
  /** Structured items inside the section. */
  items: SectionItem[];
}

/** A wiki link target found in a detail row (e.g. `[[entities/Foo]]`). */
export interface DetailLink {
  /** Path slug without wikiFolder prefix. */
  path: string;
  /** Display alias if `[[path|alias]]` was used; otherwise undefined. */
  alias?: string;
}

export interface DetailRow {
  /** True if the original line was a bullet (`- `, `* `). */
  isBullet: boolean;
  /** Wiki links found in the line, in order of appearance. */
  links: DetailLink[];
  /** The line text with wiki links removed (for summary rendering). */
  textWithoutLinks: string;
  /** Original raw line, preserved for fallback rendering. */
  raw: string;
}

export type LogEntry = {
  /** Operation category — derived from H2 text + body shape. */
  kind: OperationKind;
  /** ISO date (YYYY-MM-DD). Always present. */
  date: string;
  /** HH:MM timestamp (only for maintenance/fix/ingest entries; undefined for older ingest without timestamp). */
  time?: string;
  /** Free-form operation label (e.g. "ingest", "Wiki 维护报告", "Lint — fixDeadLinks"). */
  operation: string;
  /** Source title for ingest entries; undefined otherwise. */
  sourceTitle?: string;
  /** Created wiki pages for ingest entries. */
  createdPages: string[];
  /** Updated wiki pages for ingest entries. */
  updatedPages: string[];
  /** Ingest-specific metrics (duration, model, source size). Only set for 'ingest' entries. */
  ingestMetrics?: IngestMetrics;
  /** KPI summary (only present for 'maintenance' entries that have a `>` blockquote). */
  kpi?: KpiSummary;
  /** Structured sections (only present for 'maintenance' entries with `### ...`). */
  sections: ReportSection[];
  /** Unstructured detail rows (used for 'fix' entries and any fallback content). */
  details: DetailRow[];
  /** Raw details body — preserved for fallback rendering if structured parse failed. */
  rawDetails?: string;
};

// ── Regex patterns ───────────────────────────────────────────────

const H2_RE = /^## \[([0-9]{4}-[0-9]{2}-[0-9]{2})(?: ([0-9]{2}:[0-9]{2}))?\] (.+)$/;
// Built from the writer's own table, so a language the writer can produce
// is one the parser reads. The hand-typed alternation that stood here had
// lost Spanish (`Páginas creadas`) and never gained ru or zh-Hant (#667).
const CREATED_RE = logLabelLineRe('createdPages');
const UPDATED_RE = logLabelLineRe('updatedPages');
const BLOCKQUOTE_RE = /^>\s?(.*)$/;
const H3_SECTION_RE = /^###\s+(.+)$/;
const BULLET_RE = /^\s*[-*+]\s+(.+)$/;
const WIKI_LINK_RE = /\[\[([^\]|#]+?)(?:#\^?[^\]|]+)?(?:\|([^\]]+))?\]\]/g;

// ── Operation-kind inference ─────────────────────────────────────

/**
 * Classify an operation from its H2 text and first few body lines.
 * The classification is heuristic but stable: once a log entry is parsed, the
 * UI can switch on `kind` without re-running inference.
 */
function classifyOperation(h2Text: string, bodyLines: string[]): OperationKind {
  const text = h2Text.toLowerCase();
  // "Wiki 维护报告" / "Wiki Maintenance Report" → maintenance
  if (text.includes('维护') || text.includes('maintenance') || text.includes('wartung')
      || text.includes('mantenimiento') || text.includes('manutenção')
      || text.includes('manutenzione') || text.includes('maintenance')) {
    return 'maintenance';
  }
  // "ingest" anywhere in the H2 → ingest
  if (text.startsWith('ingest') || text.includes('ingest |')) {
    return 'ingest';
  }
  // "Lint — fixXxx" or "Complete Aliases" → individual fix runner
  if (text.includes('lint') || text.includes('alias') || text.includes('fix')) {
    return 'fix';
  }
  // Heuristic: if the body contains a `>` blockquote with KPI numbers, it's a
  // maintenance report even if the H2 didn't match by keyword (e.g. localized).
  if (bodyLines.some((l) => BLOCKQUOTE_RE.test(l) && /\d+\s*(个|page|pages)/i.test(l))) {
    return 'maintenance';
  }
  return 'other';
}

// ── KPI parser ───────────────────────────────────────────────────

/**
 * Extract KPI numbers from a `>` blockquote line. Tolerant of mixed CN/EN labels.
 * Examples (all should match):
 *   共 38 个页面，0 个缺失别名，重复 0 个，断链 19 个，孤立 2 个，空洞 0 个，
 *   无来源引证 0 个，标签越界 1 个。本次 Lint 耗时 7 秒
 *   Wiki 状态概览：共 38 个页面，断链 19 个，耗时 28 秒
 */
function parseKpiSummary(line: string): KpiSummary | undefined {
  const kpi: KpiSummary = {};
  let matched = false;

  const grab = (re: RegExp): number | undefined => {
    const m = line.match(re);
    return m ? Number(m[1]) : undefined;
  };

  // Total pages: "共 N 个页面" or "N pages" or "38 pages"
  const total = grab(/共\s*(\d+)\s*个页面/) ?? grab(/(\d+)\s*pages?\b/i);
  if (total !== undefined) { kpi.totalPages = total; matched = true; }

  const missing = grab(/(\d+)\s*个缺失别名/) ?? grab(/(\d+)\s*missing\s*alias(?:es)?/i) ?? grab(/缺失别名\s*(\d+)/);
  if (missing !== undefined) { kpi.missingAliases = missing; matched = true; }

  const dup = grab(/重复\s*(\d+)/) ?? grab(/(\d+)\s*duplicates?/i);
  if (dup !== undefined) { kpi.duplicates = dup; matched = true; }

  const dead = grab(/断链\s*(\d+)/) ?? grab(/(\d+)\s*dead\s*links?/i);
  if (dead !== undefined) { kpi.deadLinks = dead; matched = true; }

  const orphan = grab(/孤立\s*(\d+)/) ?? grab(/(\d+)\s*orphans?/i);
  if (orphan !== undefined) { kpi.orphans = orphan; matched = true; }

  const empty = grab(/空洞\s*(\d+)/) ?? grab(/(\d+)\s*empty\s*(?:pages?|stubs?)/i);
  if (empty !== undefined) { kpi.emptyPages = empty; matched = true; }

  const unsourced = grab(/无来源引证\s*(\d+)/) ?? grab(/(\d+)\s*unsourced/i);
  if (unsourced !== undefined) { kpi.unsourced = unsourced; matched = true; }

  const tag = grab(/标签越界\s*(\d+)/) ?? grab(/(\d+)\s*tag\s*violations?/i);
  if (tag !== undefined) { kpi.tagViolations = tag; matched = true; }

  const dur = grab(/耗时\s*(\d+)\s*秒/) ?? grab(/(\d+)\s*seconds?/i) ?? grab(/(\d+)\s*s\s/i);
  if (dur !== undefined) { kpi.durationSeconds = dur; matched = true; }

  return matched ? kpi : undefined;
}

// ── Wiki link extraction ─────────────────────────────────────────

/** Extract wiki page paths from a `[[page]]` or `[[page|alias]]` line. */
export function extractWikiLinks(line: string): DetailLink[] {
  const matches: DetailLink[] = [];
  WIKI_LINK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WIKI_LINK_RE.exec(line)) !== null) {
    matches.push({ path: m[1].trim(), alias: m[2]?.trim() });
  }
  return matches;
}

function stripWikiLinks(line: string): string {
  return line.replace(WIKI_LINK_RE, '').replace(/\s{2,}/g, ' ');
}

// Exported for downstream consumers (detail-renderer, future helpers).
export { stripWikiLinks };

// ── Detail row parser (for fix/other entries) ────────────────────

const BULLET_PREFIX_RE = /^\s*[-*+]\s+/;

/** Parse a details body into a list of structured rows. */
export function parseDetailRows(details: string | undefined): DetailRow[] {
  if (!details) return [];
  const rows: DetailRow[] = [];
  for (const line of details.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;

    const isBullet = BULLET_PREFIX_RE.test(trimmed);
    const links = extractWikiLinks(trimmed);
    const textWithoutLinks = stripWikiLinks(trimmed).trim();

    rows.push({ isBullet, links, textWithoutLinks, raw: trimmed });
  }
  return rows;
}

// ── Top-level parser ─────────────────────────────────────────────

/**
 * Parse the entire log.md content into LogEntry[].
 *
 * Returns [] for empty input or header-only content. Skips malformed entries
 * (silently). Always returns newest-first-ordered array when the input is in
 * append-order (log.md is appended, never sorted, so reverse is the UI's job).
 */
export function parseLogEntries(content: string): LogEntry[] {
  if (!content || content.trim().length === 0) return [];

  const lines = content.split('\n');
  const entries: LogEntry[] = [];
  let i = 0;

  while (i < lines.length) {
    const m = H2_RE.exec(lines[i]);
    if (!m) { i++; continue; }

    const date = m[1];
    const time = m[2];
    const rest = m[3].trim();

    // Optional " · " suffix carries ingest metrics (v3.1 enriched format):
    //   ingest | Foo.md · 28s · claude-sonnet-4 · 4.2KB
    //
    // We strip the trailing metrics segments from `rest` iteratively until no
    // more recognizable tokens follow. This way source titles can carry the
    // metrics suffix too (engine writes it after the operation label is split).
    let ingestMetrics: IngestMetrics | undefined;
    let restWithoutMetrics = rest;
    const SUFFIX_SEP = ' · ';
    while (true) {
      const idx = restWithoutMetrics.lastIndexOf(SUFFIX_SEP);
      if (idx <= 0) break;
      const tail = restWithoutMetrics.substring(idx + SUFFIX_SEP.length);
      const parsed = parseIngestMetrics(tail);
      if (!parsed) break;
      ingestMetrics = { ...ingestMetrics, ...parsed };
      restWithoutMetrics = restWithoutMetrics.substring(0, idx);
    }

    const sep = restWithoutMetrics.indexOf('|');
    let operation: string;
    let sourceTitle: string | undefined;
    if (sep >= 0) {
      operation = restWithoutMetrics.substring(0, sep).trim();
      sourceTitle = restWithoutMetrics.substring(sep + 1).trim();
    } else {
      operation = restWithoutMetrics;
    }

    // Look ahead: collect the body until the next H2 (or EOF) so we can both
    // classify the operation and split it into KPI / sections / fallback rows.
    i++;
    const bodyLines: string[] = [];
    while (i < lines.length && !H2_RE.test(lines[i])) {
      bodyLines.push(lines[i]);
      i++;
    }

    const kind = classifyOperation(operation, bodyLines);
    const entry = buildEntry(kind, date, time, operation, sourceTitle, bodyLines, ingestMetrics);
    entries.push(entry);
  }

  return entries;
}

function buildEntry(
  kind: OperationKind,
  date: string,
  time: string | undefined,
  operation: string,
  sourceTitle: string | undefined,
  bodyLines: string[],
  ingestMetrics?: IngestMetrics,
): LogEntry {
  const entry: LogEntry = {
    kind,
    date,
    time,
    operation,
    sourceTitle,
    createdPages: [],
    updatedPages: [],
    sections: [],
    details: [],
  };
  if (ingestMetrics) entry.ingestMetrics = ingestMetrics;

  // First pass: scan for `**Created pages**` / `**Updated pages**` (any kind).
  // For ingest entries, those are the main payload. For maintenance, they may
  // also appear (e.g. when a maintenance report triggered page creation), so
  // we keep them on the entry regardless of kind.
  let firstBulletIdx = -1;
  for (let j = 0; j < bodyLines.length; j++) {
    const line = bodyLines[j];
    const created = CREATED_RE.exec(line);
    if (created) {
      entry.createdPages = extractWikiLinks(created[1]).map((l) => l.path);
      continue;
    }
    const updated = UPDATED_RE.exec(line);
    if (updated) {
      entry.updatedPages = extractWikiLinks(updated[1]).map((l) => l.path);
      continue;
    }
    // Track the first bullet position so we can decide how to split sections.
    if (firstBulletIdx === -1 && BULLET_RE.test(line)) {
      firstBulletIdx = j;
    }
  }

  if (kind === 'maintenance') {
    // Extract KPI from the first `>` blockquote, if any.
    for (const line of bodyLines) {
      const bq = BLOCKQUOTE_RE.exec(line);
      if (bq) {
        const kpi = parseKpiSummary(bq[1]);
        if (kpi) { entry.kpi = kpi; break; }
      }
    }
    // Walk the body and group bullets under `### ` headings.
    // Each section is classified by its heading + bullet shape, so the Modal
    // can render it differently (dead-link table vs LLM analysis chips vs ...).
    let currentSection: ReportSection | null = null;
    let ungrouped: string[] = [];
    const flush = () => {
      if (currentSection) {
        entry.sections.push(currentSection);
        currentSection = null;
      }
    };
    for (const line of bodyLines) {
      const h3 = H3_SECTION_RE.exec(line);
      if (h3) {
        flush();
        const heading = h3[1].trim();
        currentSection = {
          kind: classifySectionKind(heading, []),
          heading,
          items: [],
        };
        const count = parseCountFromHeading(heading);
        if (count !== undefined) currentSection.count = count;
        continue;
      }
      if (currentSection) {
        const bullet = BULLET_RE.exec(line);
        if (bullet) {
          currentSection.items.push(parseSectionItem(currentSection.kind, bullet[1]));
        } else if (line.trim().length > 0
            && !BLOCKQUOTE_RE.test(line)
            && !CREATED_RE.test(line)
            && !UPDATED_RE.test(line)) {
          // Non-bullet content inside a section (rare) — treat as a bullet so it
          // still appears in the rendered list. Severity stays 'none' for free text.
          currentSection.items.push(parseSectionItem(currentSection.kind, line.trim()));
        }
      } else {
        ungrouped.push(line);
      }
    }
    flush();
    // Anything before the first `###` heading that wasn't a `>` KPI or
    // Created/Updated line is treated as a "Top" section if it has bullets.
    // Real-world data has 19 dead-link bullets here (see test vault log.md line 26-44).
    if (ungrouped.length > 0) {
      const topBullets = ungrouped
        .map((l) => BULLET_RE.exec(l)?.[1])
        .filter((s): s is string => Boolean(s));
      if (topBullets.length > 0) {
        const topKind = classifySectionKind('', topBullets);
        entry.sections.unshift({
          kind: topKind,
          heading: topKind === 'deadLinks' ? 'Dead links' : '',
          items: topBullets.map((b) => parseSectionItem(topKind, b)),
        });
      }
    }
    // Merge consecutive sections with the same heading (real log.md occasionally
    // has duplicate `### LLM 分析` headings with content split between them —
    // see test vault lines 55-58). Keep first heading, concatenate items.
    for (let i = 0; i < entry.sections.length - 1; i++) {
      const cur = entry.sections[i];
      const next = entry.sections[i + 1];
      if (cur.heading && cur.heading === next.heading) {
        cur.items.push(...next.items);
        if (typeof next.count === 'number') {
          cur.count = (cur.count ?? 0) + next.count;
        }
        entry.sections.splice(i + 1, 1);
        i--; // re-check the merged slot
      }
    }
    return entry;
  }

  // For ingest / fix / other: keep the rest of the body as a free-form detail
  // dump that renderDetailRows() can still structure as bullet lines.
  const detailsBody = bodyLines
    .filter((l) => !CREATED_RE.test(l) && !UPDATED_RE.test(l) && l.trim().length > 0)
    .join('\n');
  entry.details = parseDetailRows(detailsBody);
  entry.rawDetails = detailsBody || undefined;
  return entry;
}

// ── Section classification & item parsing ────────────────────────

const SECTION_KIND_PATTERNS: Array<[SectionKind, RegExp]> = [
  ['llmAnalysis',  /LLM\s*(分析|Analysis)|LLM\s*Analysis/i],
  ['tagViolation', /标签越界|Tag\s*violations?|tag\s*issues?/i],
  ['orphan',       /孤立页面?|Orphans?|Orphaned/i],
  ['empty',        /空洞页面?|Empty\s*(?:pages?|stubs?)/i],
  ['duplicate',    /重复|Duplicates?/i],
  ['deadLinks',    /断链|Dead\s*links?/i],
];

/**
 * Classify a section's semantic kind from its heading + bullet shape.
 *
 * - LLM analysis sections always have heading text but bullets may not match
 *   any specific pattern (they're free-form `[类型]：描述`).
 * - Dead-link sections may have either heading text OR be the implicit "top"
 *   section (bullets before any `###` in the body).
 * - Bullet shape is the fallback signal when heading is empty (top section).
 */
function classifySectionKind(heading: string, bullets: string[]): SectionKind {
  for (const [kind, re] of SECTION_KIND_PATTERNS) {
    if (re.test(heading)) return kind;
  }
  // Bullet-shape heuristic for the top section: if 80%+ of bullets match the
  // dead-link pattern `[[src]] → **tgt**（页面不存在）`, classify as deadLinks.
  if (bullets.length > 0) {
    const deadLinkHits = bullets.filter((b) => DEAD_LINK_BULLET_RE.test(b)).length;
    if (deadLinkHits / bullets.length >= 0.8) return 'deadLinks';
  }
  return 'unknown';
}

/** Count extracted from `[共 N 个]` / `[N items]` style heading suffixes. */
function parseCountFromHeading(heading: string): number | undefined {
  const m = heading.match(/共\s*(\d+)\s*个/) ?? heading.match(/\[(\d+)\s*(?:items?|个|pages?)\]/i);
  return m ? Number(m[1]) : undefined;
}

const DEAD_LINK_BULLET_RE = /\[\[[^\]]+\]\][^[]*→\s*\*\*[^*]+\*\*/;
const DEAD_LINK_TARGET_RE = /→\s*\*\*([^*]+)\*\*/;
const LLM_TYPE_RE = /^\[([^\]：:]{1,6})[\]】：:]/;

/**
 * Parse one bullet line into a structured SectionItem.
 *
 * Extracts:
 * - Wiki links (existing behavior)
 * - For dead links: the missing target page (the text inside `**…**` after `→`)
 * - For LLM analysis: the `[类型]` prefix (矛盾/过时/缺失/结构)
 * - Severity: dead links default to 'high'; tag violations to 'medium';
 *   empty/orphan to 'low'; LLM analysis severity from the type chip.
 */
function parseSectionItem(kind: SectionKind, bulletBody: string): SectionItem {
  const links = extractWikiLinks(bulletBody);
  const text = stripWikiLinks(bulletBody).trim();

  const item: SectionItem = {
    links,
    text,
    raw: bulletBody,
    severity: defaultSeverityForKind(kind),
  };

  if (kind === 'deadLinks') {
    const m = DEAD_LINK_TARGET_RE.exec(bulletBody);
    if (m) item.targetPage = m[1].trim();
    // Dead links are high severity regardless of count (a missing page is always
    // user-visible — the user clicked a link and got a 404).
    item.severity = 'high';
  } else if (kind === 'tagViolation') {
    item.severity = 'medium';
  } else if (kind === 'orphan' || kind === 'empty') {
    item.severity = 'low';
  } else if (kind === 'llmAnalysis') {
    const m = LLM_TYPE_RE.exec(bulletBody);
    if (m) {
      item.llmType = m[1].trim();
      item.severity = llmSeverityFor(item.llmType);
    }
  }

  return item;
}

function defaultSeverityForKind(kind: SectionKind): SectionItem['severity'] {
  switch (kind) {
    case 'deadLinks': return 'high';
    case 'tagViolation': return 'medium';
    case 'orphan': return 'low';
    case 'empty': return 'low';
    case 'llmAnalysis': return 'medium';
    default: return 'none';
  }
}

/**
 * Parse the ingest metrics suffix (e.g. "28s · claude-sonnet-4 · 4.2KB" or
 * "1m30s · 4.2KB"). Returns undefined when no recognizable token is found.
 *
 * Tokens are separated by " · " (space + middle dot + space). Each token is
 * classified independently:
 *   - Duration:  `28s` / `1m30s` / `1.5m`
 *   - Size:      `4.2KB` / `512B` / `1.2MB`
 *   - Model:     anything else (kept as raw string; wiki-engine strips
 *                trailing `-YYYYMMDD` segments before writing).
 *
 * A token like `1m30s` is recognized as a single duration token whose
 * total seconds = 60 + 30. We do NOT split `1m30s` into two tokens.
 */
function parseIngestMetrics(tail: string): IngestMetrics | undefined {
  const tokens = tail.split(/\s·\s/).map((s) => s.trim()).filter(Boolean);
  if (tokens.length === 0) return undefined;
  const m: IngestMetrics = {};
  let recognized = false;

  for (const tok of tokens) {
    // Duration: "<digits>m<digits>s" or "<digits>m" or "<digits>s" or with decimals.
    const durM = tok.match(/^(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?$/i);
    if (durM && (durM[1] || durM[2])) {
      const minutes = durM[1] ? Number(durM[1]) : 0;
      const seconds = durM[2] ? Number(durM[2]) : 0;
      m.durationSec = (m.durationSec ?? 0) + Math.round(minutes * 60 + seconds);
      recognized = true;
      continue;
    }
    // Size: "4.2KB" / "512B" / "1.2MB".
    const sizeMatch = tok.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)$/i);
    if (sizeMatch) {
      const num = Number(sizeMatch[1]);
      const unit = sizeMatch[2].toUpperCase();
      const bytes = unit === 'B' ? num
        : unit === 'KB' ? num * 1024
        : unit === 'MB' ? num * 1024 * 1024
        : num * 1024 * 1024 * 1024;
      m.sourceBytes = Math.round(bytes);
      recognized = true;
      continue;
    }
    // Fallback: assume model id. Last one wins (so 'a · model · b' → model='b').
    m.model = tok;
    recognized = true;
  }
  return recognized ? m : undefined;
}

/**
 * Severity tier for LLM analysis types. 矛盾 (contradiction) is high because
 * it surfaces conflicting facts the user previously trusted; 缺失 (missing) is
 * medium because it points to incomplete coverage; 过时 (outdated) is medium;
 * 结构 (structural) is low.
 */
function llmSeverityFor(type: string): SectionItem['severity'] {
  if (type.includes('矛盾')) return 'high';
  if (type.includes('缺失')) return 'medium';
  if (type.includes('过时')) return 'medium';
  if (type.includes('结构')) return 'low';
  return 'none';
}
