/**
 * The golden net for the ingest path — Issue #926, track #925.
 *
 * One scenario, one baseline file. It fails when the shape of an ingest run
 * changes: a page that stops being written, a frontmatter key that disappears, a
 * heading or link that moves, a stage that stops asking the model, a progress
 * message that stops being announced.
 *
 * It does **not** fail when prompt wording changes. That is the trade recorded in
 * `structure.ts`: prompt text is compared by the existing contains / does-not-
 * contain assertions, not by a snapshot, because re-recording a snapshot is the
 * one repair this track forbids.
 *
 * Re-recording is still possible, and deliberately awkward:
 *   ARCH_SNAPSHOT_UPDATE=1 npx vitest run src/__tests__/golden
 * The diff is then the review artifact.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { TFile } from 'obsidian';
import { createWikiEngineHarness } from '../__support__/wiki-engine-harness';
import { createFakeClient } from './fake-client';
import { captureIngestStructure } from './structure';

const BASELINE = join(__dirname, 'baseline', 'ingest.json');

function sourceFile(path: string): TFile {
	const name = path.split('/').pop() ?? path;
	const dot = name.lastIndexOf('.');
	return Object.assign(new TFile(), {
		path,
		basename: dot > 0 ? name.slice(0, dot) : name,
		extension: dot > 0 ? name.slice(dot + 1) : 'md',
	});
}

/** Three sources, chosen for the three shapes the ingest path branches on. */
function vault(): Record<string, string> {
	const long = Array.from({ length: 1200 }, (_, i) => `Paragraph ${i} of the long note.`).join('\n\n');
	return {
		'sources/short.md': '# Short\n\nAlpha refers to Gamma.\n',
		'sources/long.md': `# Long\n\n${long}\n`,
		'sources/contradiction.md': '# Contradiction\n\nAlpha is not ALPHA.\n',
	};
}

async function runScenario(): Promise<ReturnType<typeof captureIngestStructure>> {
	const fake = createFakeClient();
	const h = createWikiEngineHarness({ files: vault(), llmClient: fake });

	for (const path of ['sources/short.md', 'sources/long.md', 'sources/contradiction.md']) {
		// A stage that throws is itself a behaviour change; the snapshot has to see
		// the report either way, so the failure is recorded rather than swallowed.
		try {
			await h.engine.ingestSource(sourceFile(path));
		} catch {
			/* captured through reports below */
		}
	}

	const last = h.reports[h.reports.length - 1] as unknown as Record<string, unknown> | undefined;
	return captureIngestStructure({
		files: h.files,
		wikiFolder: 'wiki',
		writtenPaths: h.writtenPaths,
		// Every task label the stages asked for, across all three ingests.
		taskSequence: fake.calls.map((call) => call.task),
		progress: h.progressMessages,
		report: last,
	});
}

describe('golden — the ingest path holds its shape', () => {
	it('matches the recorded structure', async () => {
		const actual = await runScenario();

		if (process.env.ARCH_SNAPSHOT_UPDATE === '1') {
			mkdirSync(dirname(BASELINE), { recursive: true });
			writeFileSync(BASELINE, `${JSON.stringify(actual, null, '\t')}\n`, 'utf8');
			return;
		}

		expect(existsSync(BASELINE)).toBe(true);
		const expected = JSON.parse(readFileSync(BASELINE, 'utf8'));
		expect(actual).toEqual(expected);
	});

	it('is deterministic — two runs on one commit are identical', async () => {
		const first = await runScenario();
		const second = await runScenario();

		expect(second).toEqual(first);
	});

	it('records the stages that ran, so a removed stage fails here', async () => {
		const actual = await runScenario();

		expect(actual.taskSequence.length).toBeGreaterThan(0);
		expect(actual.written.length).toBeGreaterThan(0);
	});
});
