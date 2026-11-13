// value-survival-cli — run the #910 count against a real vault.
//
// Usage:
//   node tools/dev-instrument/run-value-survival.mjs <vault> <wikiFolder>
//   node tools/dev-instrument/run-value-survival.mjs --self-check
//
// `<wikiFolder>` is relative to the vault, e.g. `test10`. `--self-check` runs
// the masking and harvesting over the fixture shipped with this tool, so the
// instrument can be exercised without a vault or a model.
//
// Exit code: 0 = printed a report · 1 = the run threw · 2 = usage.
//
// This module does no I/O of its own: the launcher passes the file access it
// needs (`CliIo`). Two reasons. `obsidianmd/no-nodejs-modules` exempts a
// `node:*` import only behind a `Platform.isDesktop` AST guard, and a Node CLI
// has no `Platform` — so the imports belong in the `.mjs` launcher, which is
// outside the Bot's `.ts` scan scope and where the environment is assembled
// anyway (see `run-instrument.mjs`). And a report printer that takes its input
// as an argument can be tested without a vault: `value-survival-cli.test.ts`
// drives the whole report path against an in-memory vault.

import {
  maskNonKnowledge,
  harvestValues,
  survivalOf,
  summarize,
  sourceSlugs,
  sourceFileOf,
  type PageType,
  type Row,
} from './value-survival';

/** The file access the report needs. The launcher supplies it from `node:fs`. */
export interface CliIo {
  readTextFile(path: string): string;
  listDir(path: string): string[];
  exists(path: string): boolean;
  join(...parts: string[]): string;
  resolve(...parts: string[]): string;
}

// The Obsidian Bot's `no-console` rule covers this file, and this file IS a report
// printer: stdout is the interface. Writing to the stream says that directly, and it
// keeps the scan quiet without a disable comment — the Bot rejects those.
const say = (line: string): void => {
  process.stdout.write(line + '\n');
};
const usage = (line: string): void => {
  process.stderr.write(line + '\n');
};

const QUOTE_HEADINGS = /^##\s+(?:来源提及|Mentions in Source)\s*$/gmu;

interface Page {
  type: PageType;
  slug: string;
  body: string;
  quoted: string;
  prose: string;
}

/** Split a page into its verbatim quote sections and everything else. */
function splitQuoted(body: string): { quoted: string; prose: string } {
  const spans: Array<[number, number]> = [];
  QUOTE_HEADINGS.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = QUOTE_HEADINGS.exec(body)) !== null) {
    const start = m.index;
    const next = /\n##\s+/gu;
    next.lastIndex = m.index + m[0].length;
    const following = next.exec(body);
    spans.push([start, following ? following.index : body.length]);
  }
  const quoted = spans.map(([a, b]) => body.slice(a, b)).join('\n');
  let prose = '';
  let cursor = 0;
  for (const [a, b] of spans) {
    prose += body.slice(cursor, a);
    cursor = b;
  }
  prose += body.slice(cursor);
  return { quoted, prose };
}

function readPages(dir: string, type: PageType, io: CliIo): Page[] {
  if (!io.exists(dir)) return [];
  return io
    .listDir(dir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => {
      const raw = io.readTextFile(io.join(dir, name));
      const { quoted, prose } = splitQuoted(raw);
      return { type, slug: name.replace(/\.md$/u, ''), body: raw, quoted, prose };
    });
}

function countVault(
  vault: string,
  wiki: string,
  sampleSize: number,
  io: CliIo,
): { rows: Row[]; samples: string[][] } {
  const root = io.resolve(vault, wiki);
  const sourcesDir = io.join(root, 'sources');
  if (!io.exists(sourcesDir)) {
    throw new Error(`no sources/ under ${root} — is <wikiFolder> spelled as it appears in the vault?`);
  }

  const entities = readPages(io.join(root, 'entities'), 'entity', io);
  const concepts = readPages(io.join(root, 'concepts'), 'concept', io);
  const rows: Row[] = [];
  const samples: string[][] = [];

  for (const name of io.listDir(sourcesDir).filter((n) => n.endsWith('.md'))) {
    const sourcePage = readPages(sourcesDir, 'source', io).find(
      (p) => p.slug === name.replace(/\.md$/u, ''),
    );
    if (!sourcePage) continue;
    const noteRel = sourceFileOf(sourcePage.body);
    if (!noteRel) continue;
    const notePath = io.resolve(vault, noteRel);
    if (!io.exists(notePath)) continue;

    // Pages this source produced, by the backlink the pipeline writes. No name
    // matching: a Chinese page title over an English note is the case that
    // broke the first attempt, and this route never reads the title.
    const slug = sourcePage.slug;
    const attributed = [...entities, ...concepts].filter((p) => sourceSlugs(p.body).includes(slug));

    const byClass: Record<PageType, Page[]> = {
      source: [sourcePage],
      entity: attributed.filter((p) => p.type === 'entity'),
      concept: attributed.filter((p) => p.type === 'concept'),
    };

    const maskedNote = maskNonKnowledge(io.readTextFile(notePath));
    for (const value of harvestValues(maskedNote)) {
      for (const pageType of ['source', 'entity', 'concept'] as const) {
        const pages = byClass[pageType];
        if (pages.length === 0) continue;
        const quoted = pages.map((p) => p.quoted).join('\n');
        const prose = pages.map((p) => p.prose).join('\n');
        const outcome = survivalOf(value.text, quoted, prose);
        rows.push({ pageType, kind: value.kind, position: value.position, outcome });
        if (outcome === 'absent' && pageType === 'source' && samples.length < sampleSize) {
          const from = Math.max(0, value.offset - 28);
          const context = maskedNote
            .slice(from, value.offset + value.text.length + 28)
            .replace(/\s+/gu, ' ');
          samples.push([value.kind, noteRel.split('/').pop() ?? noteRel, value.text, context]);
        }
      }
    }
  }
  return { rows, samples };
}

function table(header: string[], body: string[][]): string {
  const widths = header.map((h, i) => Math.max(h.length, ...body.map((r) => r[i].length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join('  ');
  return [line(header), line(widths.map((w) => '-'.repeat(w))), ...body.map(line)].join('\n');
}

const pct = (n: number): string => `${(n * 100).toFixed(0)}%`;

function selfCheck(io: CliIo, fixturePath: string): number {
  if (!io.exists(fixturePath)) throw new Error(`fixture missing: ${fixturePath}`);
  const note = io.readTextFile(fixturePath);
  const masked = maskNonKnowledge(note);
  const found = harvestValues(masked);
  say(`fixture: ${fixturePath}`);
  say(`note ${note.length} chars · values ${found.length} · masked ${masked.length} chars (must equal)`);
  say(
    table(
      ['kind', 'position', 'offset', 'text'],
      found.map((v) => [v.kind, v.position, String(v.offset), v.text]),
    ),
  );
  return masked.length === note.length ? 0 : 1;
}

export async function main(argv: string[], io: CliIo, fixturePath: string): Promise<number> {
  if (argv[0] === '--self-check') return selfCheck(io, fixturePath);
  const sampleAt = argv.indexOf('--sample');
  const sampleSize = sampleAt === -1 ? 0 : Number(argv[sampleAt + 1] ?? 20);
  const positional = argv.filter((_a, i) => sampleAt === -1 || (i !== sampleAt && i !== sampleAt + 1));
  const [vault, wiki] = positional;
  if (!vault || !wiki) {
    usage(
      'usage: run-value-survival.mjs <vault> <wikiFolder> [--sample N]\n       run-value-survival.mjs --self-check',
    );
    return 2;
  }

  const { rows, samples } = countVault(vault, wiki, sampleSize, io);
  const report = summarize(rows);

  say(`vault ${vault} · wiki ${wiki} · rows ${report.total}\n`);

  say('By value position (head = inside the 500-char window the source prose sees)');
  say(
    table(
      ['position', 'n', 'quoted', 'prose', 'absent', 'absent share'],
      report.byPosition.map((r) => [
        r.position,
        String(r.n),
        String(r.quoted),
        String(r.prose),
        String(r.absent),
        pct(r.absentShare),
      ]),
    ),
  );

  say('\nBy value kind');
  say(
    table(
      ['kind', 'n', 'quoted', 'prose', 'absent', 'absent share'],
      report.byKind.map((r) => [
        r.kind,
        String(r.n),
        String(r.quoted),
        String(r.prose),
        String(r.absent),
        pct(r.absentShare),
      ]),
    ),
  );

  say('\nBy page type (each value is counted once per page class it could reach)');
  say(
    table(
      ['page type', 'n', 'quoted', 'prose', 'absent', 'absent share'],
      report.byPageType.map((r) => [
        r.pageType,
        String(r.n),
        String(r.quoted),
        String(r.prose),
        String(r.absent),
        pct(r.absentShare),
      ]),
    ),
  );

  if (samples.length > 0) {
    say('\nAbsent values, with the text around them in the note — read this before trusting the table');
    say(table(['kind', 'note', 'value', 'context'], samples));
  }
  return 0;
}
