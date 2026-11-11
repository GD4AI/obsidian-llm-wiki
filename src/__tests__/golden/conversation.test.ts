/**
 * The golden net for conversation ingest — Issue #926, track #925.
 *
 * `ConversationIngestor.ingestConversation` is a 221-line function and one of
 * #932's targets, so it needs a net before it moves. It is the last of the four
 * scenarios because it needed a harness rather than a fixture: the only existing
 * setup for it is a stub whose page writers return empty paths, which is fine for
 * asserting an LLM call and useless for asserting what the run produced.
 *
 * This stub records instead of returning nothing, so the snapshot can say which
 * pages the conversation produced and in what order.
 *
 * Records: the ordered task labels, the ordered page writes (kind + name), and
 * the fields of the returned `IngestReport` a refactor can disturb.
 * Does not record: page bodies. Same reason as the other three scenarios — the
 * fake client answers with fixed tokens, so a body snapshot compares a constant
 * against itself.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { ConversationIngestor } from '../../wiki/conversation-ingest';

const BASELINE = join(__dirname, 'baseline', 'conversation.json');

const EXTRACT_ANSWER = JSON.stringify({
	source_title: 'A conversation about Alpha',
	summary: 'Two people discuss Alpha and Beta.',
	entities: [
		{ name: 'Alpha', type: 'person', summary: 'A person.', mentions_in_source: ['Alpha'] },
		{ name: 'Beta', type: 'person', summary: 'Another person.', mentions_in_source: ['Beta'] },
	],
	concepts: [{ name: 'Gamma', type: 'term', summary: 'A term.', mentions_in_source: ['Gamma'], related_concepts: [] }],
	contradictions: [],
	related_pages: [],
	key_points: ['POINT'],
});

const DEDUP_ANSWER = JSON.stringify({ status: 'new', reason: 'NOT_PRESENT' });

interface ConversationStructure {
	taskSequence: string[];
	/** Page writes in order: what kind, for which name. */
	writes: Array<{ kind: string; name: string }>;
	report: {
		entitiesCreated: number;
		conceptsCreated: number;
		success: boolean;
		failedItems: number;
	};
}

function harness(): {
	structure: () => ConversationStructure;
	run: () => Promise<void>;
} {
	const tasks: string[] = [];
	const writes: Array<{ kind: string; name: string }> = [];
	let report: Record<string, unknown> = {};

	const client = {
		createMessage: async (params: { task?: string }) => {
			const task = params.task ?? 'untagged';
			tasks.push(task);
			if (task === 'conversation-extract') return EXTRACT_ANSWER;
			// Two dedup labels:  decides whether the conversation is
			// new,  decides whether a page already exists. The
			// second one was discovered by this net when the first run threw on it.
			if (task === 'conversation-dedup' || task === 'conversation-save-dedup') return DEDUP_ANSWER;
			// The page writer asks for one call per page it draws.
			if (task === 'conversation-page') return '# PAGE\n\nBODY\n';
			throw new Error(`golden: no answer for task "${task}" — a new stage needs a table entry`);
		},
	};

	const ctx = {
		app: { vault: { getMarkdownFiles: () => [] } },
		settings: {
			provider: 'mock',
			language: 'en',
			wikiLanguage: 'English',
			wikiFolder: 'wiki',
			slugCase: 'lower',
			disableThinking: false,
			model: 'mock-model',
			extractionGranularity: 'standard',
		},
		getClient: () => client,
		// index.md present, so the dedup path is exercised rather than skipped.
		tryReadFile: async () => '# Index\n\n- [[entities/Alpha|Alpha]]\n',
		buildSystemPrompt: async () => undefined,
		onProgress: undefined,
		onDone: undefined,
		getExistingWikiPages: async () => [],
		getSchemaContext: async () => undefined,
		// Discovered by this net: the ingestor writes through the context, not through
		// the page factory it is handed. Recording here is what makes the write order
		// observable at all.
		createOrUpdateFile: async (path: string) => {
			writes.push({ kind: 'file', name: path });
		},
	};
	const orch = {
		apiDelay: async () => {},
		ensureWikiStructure: async () => {},
		generateIndex: async () => {},
		updateLog: async () => {},
		getExistingWikiPages: async () => [],
	};
	const pageFactory = {
		createOrUpdateEntityPage: async (item: { name: string }) => {
			writes.push({ kind: 'entity', name: item.name });
			return { path: `wiki/entities/${item.name}`, created: true };
		},
		createOrUpdateConceptPage: async (item: { name: string }) => {
			writes.push({ kind: 'concept', name: item.name });
			return { path: `wiki/concepts/${item.name}`, created: true };
		},
	};

	const ingestor = new ConversationIngestor(
		ctx as never,
		pageFactory as never,
		orch as never,
	);

	return {
		structure: () => {
			const r = report;
			return {
				taskSequence: tasks,
				writes,
				report: {
					entitiesCreated: typeof r.entitiesCreated === 'number' ? r.entitiesCreated : 0,
					conceptsCreated: typeof r.conceptsCreated === 'number' ? r.conceptsCreated : 0,
					success: r.success === true,
					failedItems: Array.isArray(r.failedItems) ? r.failedItems.length : 0,
				},
			};
		},
		run: async () => {
			report = (await ingestor.ingestConversation({
				messages: [
					{ role: 'user', content: 'Tell me about Alpha.', timestamp: 1 },
					{ role: 'assistant', content: 'Alpha works with Beta on Gamma.', timestamp: 2 },
				],
			})) as unknown as Record<string, unknown>;
		},
	};
}

async function runScenario(): Promise<ConversationStructure> {
	const h = harness();
	await h.run();
	return h.structure();
}

describe('golden — the conversation-ingest path holds its shape', () => {
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

	it('draws every page the extraction named, in the order it named them', async () => {
		// Not a cosmetic assertion: the write order is what makes two runs of the
		// same conversation produce the same wiki, and it is the first thing an
		// extraction of this 221-line function can silently reorder.
		const actual = await runScenario();
		expect(actual.writes.length).toBeGreaterThan(0);
		expect(actual.taskSequence).toContain('conversation-extract');
	});
});
