/**
 * The golden net for the lint path — Issue #926, track #925.
 *
 * Same shape as the ingest net, one level up: `runLintWiki` is the 444-line
 * orchestrator that #932 extracts from, and `runDedupPhase` is the 277-line
 * phase beside it. Both move code; this records what the run looked like.
 *
 * What it holds: which pages the run rewrote, which it trashed, and which task
 * labels the model was asked for. What it does not hold: finding prose. The
 * report goes to a modal or a Notice and has no stable capture point, so the
 * snapshot records what the run did to the vault instead — the part a refactor
 * can break.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createWikiEngineHarness } from '../__support__/wiki-engine-harness';
import { DEFAULT_SETTINGS } from '../__support__/engine-context';
import { createFakeClient } from './fake-client';
import { runLintWiki } from '../../wiki/lint/controller';
import type { LintContext } from '../../wiki/lint/types';

const BASELINE = join(__dirname, 'baseline', 'lint.json');

/** A vault with one of each finding the programmatic scanners report. */
function vault(): Record<string, string> {
	return {
		// A dead link, and the page it should have pointed at is absent.
		'wiki/entities/one.md': '---\ntags: [person]\n---\n\n# One\n\nSee [[missing-page|the missing page]].\n',
		// A duplicate pair, same title, different folder.
		'wiki/entities/two.md': '---\ntags: [person]\n---\n\n# Two\n\nSame body.\n',
		'wiki/concepts/two.md': '---\ntags: [term]\n---\n\n# Two\n\nSame body.\n',
		// An orphan: nothing links to it, it links to nothing.
		'wiki/entities/orphan.md': '---\ntags: [person]\n---\n\n# Orphan\n\nAlone.\n',
		'wiki/index.md': '# Index\n\n- [[entities/one|One]]\n',
	};
}

interface LintStructure {
	taskSequence: string[];
	/** Pages the run wrote, sorted. */
	rewritten: string[];
	/** Pages the run trashed, sorted. */
	trashed: string[];
	/** A throw is a behaviour change, so it is recorded rather than swallowed. */
	error: string | null;
}

async function runScenario(): Promise<LintStructure> {
	const fake = createFakeClient();
	const settings = { ...DEFAULT_SETTINGS, pageGenerationConcurrency: 1, batchDelayMs: 0, autoSmartFix: true, periodicLint: 'off' as const };
	const h = createWikiEngineHarness({ files: vault(), settings, llmClient: fake });
	const ctx: LintContext = {
		app: h.app,
		settings,
		wikiEngine: h.engine,
		llmClient: fake,
		onAnalyzeSchema: () => {},
	};

	// The report itself has no stable capture point: `runLintWiki` hands it to a
	// modal or a Notice. What it does to the vault does have one, and that is the
	// part a refactor can break. Findings prose is documentation; the writes are
	// the behaviour.
	let error: string | null = null;
	try {
		await runLintWiki(ctx, undefined, 'manual');
	} catch (err) {
		error = err instanceof Error ? err.message : String(err);
	}

	return {
		taskSequence: fake.calls.map((call: { task: string }) => call.task),
		rewritten: [...new Set(h.writtenPaths)].sort(),
		trashed: [...new Set(h.trashedPaths)].sort(),
		error,
	};
}

describe('golden — the lint path holds its shape', () => {
	it('matches the recorded structure', async () => {
		const actual = await runScenario();

		if (process.env.ARCH_SNAPSHOT_UPDATE === '1') {
			mkdirSync(dirname(BASELINE), { recursive: true });
			writeFileSync(BASELINE, `${JSON.stringify(actual, null, '\t')}\n`, 'utf8');
			return;
		}

		expect(existsSync(BASELINE)).toBe(true);
		expect(actual).toEqual(JSON.parse(readFileSync(BASELINE, 'utf8')));
	});

	it('is deterministic — two runs on one commit are identical', async () => {
		expect(await runScenario()).toEqual(await runScenario());
	});
});
