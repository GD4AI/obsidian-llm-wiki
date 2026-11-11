/**
 * The net under the Smart Fix All callback — Issue #932, after a mutation review
 * found the golden snapshot did not reach this code.
 *
 * Why this file exists. `golden/baseline/lint.json` is 11 lines: it records the
 * task labels the run asked for, the pages it rewrote, and the pages it trashed.
 * That covers `runLintWiki`'s own path and nothing else — it never invokes a fix
 * callback. So the ~430 lines of callback bodies that #932 moved had no test at
 * all, and three hand-made mutations passed the full suite.
 *
 * The assertions are structural on purpose: the log headings the run wrote and
 * the paths it touched, never the finding prose and never a prompt hash (#926's
 * rule).
 *
 * Mutations this file kills, each verified by hand before it was written down:
 *
 *   1. Pass an empty array to `runDuplicateMerges`, so the merge phase is skipped.
 *      Killed by "the phase is not skipped — the pair is actually merged".
 *   2. Drop the `generateIndexFromEngine()` call after the phases are done.
 *      Killed by "rebuilds the index once, after the phases".
 *   3. Move the orphan phase ahead of the dead-link phase.
 *      Killed by "logs the phases in causal order, then the summary".
 *
 * Completion signal. `onFixAll` is `() => void` — it starts a lint operation and
 * returns. Awaiting it waits for nothing, which is how the first version of this
 * file managed to assert on a run that had not started. The harness below
 * resolves a deferred when the closing summary is logged, which happens after
 * every phase and after the index rebuild.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWikiEngineHarness } from '../../__support__/wiki-engine-harness';
import { DEFAULT_SETTINGS } from '../../__support__/engine-context';
import { createFakeClient } from '../../golden/fake-client';
import type { FakeClient } from '../../golden/fake-client';
import type { LintContext } from '../../../wiki/lint/types';
import type { LintFixCallbacks } from '../../../ui/modals';

const SUMMARY = 'Smart Fix All (Causality-Aware with Aliases)';

/** The callbacks `runLintWiki` hands to the modal, captured instead of rendered. */
const captured: { callbacks: LintFixCallbacks | null } = { callbacks: null };

vi.mock('../../../ui/modals', async importOriginal => {
	const actual = await importOriginal<typeof import('../../../ui/modals')>();
	class CapturingModal {
		constructor(_app: unknown, _report: unknown, callbacks: LintFixCallbacks) {
			captured.callbacks = callbacks;
		}
		open(): void {
			// The real modal waits for a click. The callbacks are the subject here.
		}
	}
	return { ...actual, LintReportModal: CapturingModal };
});

/**
 * The golden client answers per task and throws on an unknown one, which is the
 * behaviour #926 wants. The lint fix path needs two additions:
 *
 * - `lint-dedup` must report a pair, or the dedup phase returns an empty set, the
 *   merge callback is never offered, and the merge assertion is vacuous.
 * - `untagged` must answer at all. The fix runners pass no task label — the
 *   accounting gap `AGENTS.md` records — so they arrive here unlabelled.
 *
 * The `untagged` answer is deliberately inert: these tests assert what the
 * programmatic phases did to the vault, not what a model wrote into a page.
 */
function createLintFakeClient(): FakeClient {
	const base = createFakeClient();
	return {
		calls: base.calls,
		createMessage: async (params: { task?: string }) => {
			if (params.task === 'lint-dedup') {
				return JSON.stringify({
					duplicates: [
						{ target: 'wiki/entities/two.md', source: 'wiki/concepts/two.md', reason: 'same title and body' },
					],
				});
			}
			if (params.task === undefined) {
				// The dead-link runner reads `action` + `correct_link`; every other
				// unlabelled caller gets the same object and reports "no action", which
				// is what keeps this answer inert for the phases not under test.
				return JSON.stringify({ action: 'correct', correct_link: 'Orphan' });
			}
			return base.createMessage(params as Parameters<FakeClient['createMessage']>[0]);
		},
	} as unknown as FakeClient;
}

/** One of each finding the programmatic scanners report. */
function vault(): Record<string, string> {
	return {
		// A dead link whose target does not exist.
		'wiki/entities/one.md': '---\ntags: [person]\n---\n\n# One\n\nSee [[missing-page|the missing page]].\n',
		// A duplicate pair: same title, two folders, same body.
		'wiki/entities/two.md': '---\ntags: [person]\n---\n\n# Two\n\nSame body.\n',
		'wiki/concepts/two.md': '---\ntags: [term]\n---\n\n# Two\n\nSame body.\n',
		// An orphan: nothing links to it, it links to nothing.
		'wiki/entities/orphan.md': '---\ntags: [person]\n---\n\n# Orphan\n\nAlone.\n',
		'wiki/index.md': '# Index\n\n- [[entities/one|One]]\n',
	};
}

interface LintNet {
	callbacks: LintFixCallbacks;
	/** `## [stamp] label` headings in `wiki/log.md`, in file order. */
	logHeadings: () => string[];
	/**
	 * The phase sections inside the summary entry, in the order the smart fix wrote
	 * them. Each phase appends `## <Phase>` to the one aggregated log entry, so this
	 * is where the causal order is visible.
	 */
	logSections: () => string[];
	writtenPaths: string[];
	trashedPaths: string[];
	/** Resolves when the closing summary reaches the log. */
	summaryLogged: Promise<void>;
	indexRebuilds: () => number;
}

async function setup(): Promise<LintNet> {
	const fake = createLintFakeClient();
	const settings = {
		...DEFAULT_SETTINGS,
		pageGenerationConcurrency: 1,
		batchDelayMs: 0,
		// Off on purpose: with it on, `runLintWiki` runs Smart Fix All itself, the
		// completion deferred below resolves during setup, and the assertions then
		// read a run that has not started yet.
		autoSmartFix: false,
		periodicLint: 'off' as const,
	};
	const h = createWikiEngineHarness({ files: vault(), settings, llmClient: fake });

	let indexRebuilds = 0;
	const engine = h.engine;
	const realGenerate = engine.generateIndexFromEngine.bind(engine);
	engine.generateIndexFromEngine = async () => {
		indexRebuilds++;
		return realGenerate();
	};

	const ctx: LintContext = {
		app: h.app,
		settings,
		wikiEngine: engine,
		llmClient: fake,
		onAnalyzeSchema: () => {},
	};

	const { runLintWiki } = await import('../../../wiki/lint/controller');
	await runLintWiki(ctx, undefined, 'manual');
	if (!captured.callbacks) throw new Error('runLintWiki never handed callbacks to the modal');

	// Installed after the lint run, so only a *manual* Smart Fix All can resolve it.
	let resolveSummary: () => void = () => {};
	const summaryLogged = new Promise<void>(resolve => {
		resolveSummary = resolve;
	});
	const realLog = engine.logLintFix.bind(engine);
	engine.logLintFix = async (label: string, details: string) => {
		await realLog(label, details);
		if (label === SUMMARY) resolveSummary();
	};

	return {
		callbacks: captured.callbacks,
		logHeadings: () => {
			const log = h.files.get('wiki/log.md') ?? '';
			return [...log.matchAll(/^## \[[^\]]*\] (.+)$/gm)].map(m => m[1]);
		},
		logSections: () => {
			const log = h.files.get('wiki/log.md') ?? '';
			return [...log.matchAll(/^## (?!\[)(.+)$/gm)].map(m => m[1].trim());
		},
		writtenPaths: h.writtenPaths,
		trashedPaths: h.trashedPaths,
		summaryLogged,
		indexRebuilds: () => indexRebuilds,
	};
}

/** Fire Smart Fix All and wait for the run to finish, or fail loudly. */
async function runSmartFixAll(net: LintNet): Promise<void> {
	net.callbacks.onFixAll!();
	await Promise.race([
		net.summaryLogged,
		new Promise((_, reject) =>
			setTimeout(() => reject(new Error('Smart Fix All never logged its summary')), 5000),
		),
	]);
}

beforeEach(() => {
	captured.callbacks = null;
});

describe('Smart Fix All — what the callback does to the vault', () => {
	it('offers a fix for every finding the vault produced', async () => {
		const { callbacks } = await setup();

		// Structural: which fixes exist, not how they read. A refactor that loses a
		// callback loses a button, and this is where that shows.
		expect(Object.keys(callbacks)).toEqual(
			expect.arrayContaining([
				'onFixAll', 'onMergeDuplicates', 'onFixDeadLinks', 'onLinkOrphans', 'onCompleteAliases',
			]),
		);
	});

	it('always offers the stub deletion, even when nothing else is fixable', async () => {
		const { callbacks } = await setup();

		// #103: an independent action, not a phase, so it must not depend on a
		// finding existing. Folding it into the fixable count would hide the button
		// on a clean vault, leaving no way to clear stubs an earlier run left.
		expect(typeof callbacks.onDeleteEmptyStubs).toBe('function');
	});

	it('the phase is not skipped — the duplicate pair is actually merged', async () => {
		const net = await setup();
		await runSmartFixAll(net);

		// A merge either rewrites both sides or removes the source. One path, not
		// none: this is the assertion a skipped merge phase fails.
		const touched = [...net.writtenPaths, ...net.trashedPaths].filter(p => p.endsWith('/two.md'));
		expect(touched.length).toBeGreaterThan(0);
		expect(net.logSections()).toContain('Merge Duplicate Pages');
	});

	it('logs the phases in causal order, then the summary', async () => {
		const net = await setup();
		await runSmartFixAll(net);

		const headings = net.logHeadings();
		const summaryAt = headings.indexOf(SUMMARY);
		expect(summaryAt).toBeGreaterThan(-1);

		// Dead links are fixed before orphans are linked: linking an orphan to a page
		// that is about to be retargeted would link to the wrong title. Merge runs
		// before both, because it changes which pages exist.
		const sections = net.logSections();
		const mergeAt = sections.indexOf('Merge Duplicate Pages');
		expect(mergeAt).toBeGreaterThan(-1);
		const deadLinkAt = sections.indexOf('Fix Dead Links');
		const orphanAt = sections.indexOf('Link Orphan Pages');
		expect(deadLinkAt).toBeGreaterThan(-1);
		expect(orphanAt).toBeGreaterThan(-1);
		if (deadLinkAt !== -1 && orphanAt !== -1) expect(deadLinkAt).toBeLessThan(orphanAt);
	});

	it('rebuilds the index once, after the phases', async () => {
		const net = await setup();

		const before = net.indexRebuilds();
		await runSmartFixAll(net);
		const after = net.indexRebuilds();

		// One rebuild for the whole smart fix, not one per phase: a rebuild per phase
		// is the O(phases x pages) cost the aggregation exists to avoid.
		expect(after - before).toBe(1);
	});
});
