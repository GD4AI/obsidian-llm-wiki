/**
 * What the golden net records — Issue #926, track #925.
 *
 * Structure, not prose, and not a prompt hash.
 *
 * **Not prose.** The fake client answers with fixed tokens, so a snapshot of the
 * text would compare a constant against itself. What can change without any
 * production edit is the shape: which files appear, which frontmatter keys they
 * carry, which headings and links they hold, which stages ran. That is what a
 * refactor can silently break.
 *
 * **Not a prompt hash.** Prompt text changes legitimately and often — #895
 * removed placeholders, #908 added rule blocks, both within one month. A hash
 * snapshot would fail on each, and the only repair would be to re-record it,
 * which is exactly what this track forbids. Prompt *content* stays with the
 * existing contains / does-not-contain tests.
 *
 * The cost of this choice, stated because it cannot be measured here: a
 * regression that lives in prompt wording is invisible to this net.
 *
 * Normalised before comparison — timestamps, `updated:` dates, absolute paths and
 * the elapsed-time fields. Everything else is compared exactly.
 */
import { parseFrontmatter } from '../../core/frontmatter';

export interface PageStructure {
	path: string;
	/** Sorted. A new frontmatter key is a behaviour change; its value often is not. */
	frontmatterKeys: string[];
	/** The two values a refactor actually moves, when present. */
	type: string | null;
	tags: string[];
	/** Headings in document order — a lost section shows up here. */
	headings: string[];
	/** Wikilink targets, sorted and de-duplicated. */
	links: string[];
}

export interface IngestStructure {
	/** The task labels the stages asked for, in order. A new stage appears here. */
	taskSequence: string[];
	/** Wiki pages written, sorted. */
	written: PageStructure[];
	/** Fields of the IngestReport that a refactor could disturb. */
	report: {
		createdPages: number;
		updatedPages: number;
		entitiesCreated: number;
		conceptsCreated: number;
		contradictionsFound: number;
		success: boolean;
		failedItems: number;
		skipped: boolean | null;
	};
	/** Progress messages, in order. PDF and ingest stages announce through this. */
	progress: string[];
}

const DATE_LIKE = /\b\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?(?:\.\d+)?Z?\b/g;

/** Timestamps and absolute paths differ per run; nothing else may. */
function normalise(value: string): string {
	return value.replace(DATE_LIKE, '<date>').replace(/\b\d{10,13}\b/g, '<epoch>');
}

function headingsOf(body: string): string[] {
	return body
		.split('\n')
		.filter((line) => /^#{1,6}\s/.test(line))
		.map((line) => line.trim());
}

function linksOf(body: string): string[] {
	const found = new Set<string>();
	for (const match of body.matchAll(/\[\[([^\]|#]+)/g)) found.add(match[1].trim());
	return [...found].sort();
}

function structureOf(path: string, content: string): PageStructure {
	const normalised = normalise(content);
	const frontmatter = parseFrontmatter(normalised) as Record<string, unknown> | null;
	const type = frontmatter && typeof frontmatter.type === 'string' ? frontmatter.type : null;
	const rawTags = frontmatter?.tags;
	const tags = Array.isArray(rawTags)
		? rawTags.map(String).sort()
		: typeof rawTags === 'string'
			? rawTags
					.split(/[,\s]+/)
					.filter(Boolean)
					.sort()
			: [];
	return {
		path,
		frontmatterKeys: frontmatter ? Object.keys(frontmatter).sort() : [],
		type,
		tags,
		headings: headingsOf(normalised),
		links: linksOf(normalised),
	};
}

export interface CaptureInput {
	files: Map<string, string>;
	wikiFolder: string;
	writtenPaths: string[];
	taskSequence: string[];
	progress: string[];
	report: Record<string, unknown> | undefined;
}

export function captureIngestStructure(input: CaptureInput): IngestStructure {
	// Written paths, not every file in the vault: a page the run touched is the
	// unit a refactor can lose.
	const unique = [...new Set(input.writtenPaths)].sort();
	const written = unique
		.filter((path) => path.startsWith(`${input.wikiFolder}/`) && input.files.has(path))
		.map((path) => structureOf(path, input.files.get(path) ?? ''));

	const report = input.report ?? {};
	return {
		taskSequence: input.taskSequence,
		written,
		report: {
			createdPages: count(report.createdPages),
			updatedPages: count(report.updatedPages),
			entitiesCreated: count(report.entitiesCreated),
			conceptsCreated: count(report.conceptsCreated),
			contradictionsFound: count(report.contradictionsFound),
			success: report.success === true,
			failedItems: count(report.failedItems),
			skipped: typeof report.skipped === 'boolean' ? report.skipped : null,
		},
		progress: input.progress.map(normalise),
	};
}

function count(value: unknown): number {
	if (typeof value === 'number') return value;
	if (Array.isArray(value)) return value.length;
	return 0;
}
