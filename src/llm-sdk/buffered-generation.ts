// Buffered generation — one call shape, two transports. Issue #980.
//
// ## Why this exists
//
// iOS runs `requestUrl` on `URLSession`, which enforces
// `timeoutIntervalForRequest`: **60 seconds without receiving data**, not 60
// seconds of total duration. The timer resets on every byte.
//
// A buffered completion sends nothing until the model has finished, so for a
// generation longer than 60 s the connection is silent for longer than 60 s and
// iOS aborts it. The server keeps working and then discards the result. Measured
// on a local `llama-server`: time to first byte equals total time on the buffered
// path (0.662 s of 0.663 s) and 0.0009 s on the streamed one.
//
// The defect is silence, not slowness. A faster model hides it; a slower one
// cannot avoid it.
//
// ## Why it is one module and not four
//
// Checked against `ai@7.0.142`: `generateText` and `streamText` accept the same
// argument object. Diffing their option types gives 23 keys against 26 —
// `streamText` adds `onChunk`, `includeRawChunks` and `experimental_transform`,
// `generateText` adds six lifecycle callbacks, and both carry `output`. The
// clients here pass exactly `model`, `messages`, `maxOutputTokens`, `output` and
// `providerOptions`, and use none of the callbacks, so the argument object moves
// between the two functions unchanged.
//
// `StreamTextResult` exposes `text`, `finishReason`, `usage`, `finalStep` and
// `output` as promises, so a streamed call can produce the buffered result the
// callers already consume. `await result.output` is the SDK's own equivalent of
// `generateText({ output })`.
//
// ## The policy
//
// Stream only where the silence limit exists, because streaming costs about 60×
// the bytes: 4.3 bytes per token buffered against 255.7 streamed, measured on one
// prompt, one model, `temperature: 0`, identical 611-character output. The
// overhead is SSE framing — 303 frames of about 253 bytes each, with the answer
// itself 0.8 % of the payload.
//
// The limit is a property of the platform, so the platform decides. Desktop has
// no such limit and keeps the cheaper transport.
import { Platform } from 'obsidian';
import { generateText, streamText, NoOutputGeneratedError } from 'ai';
import type { FinishReason, LanguageModelUsage } from 'ai';

/**
 * The five fields the callers read from a `generateText` result.
 *
 * `finalStep` is carried because `extractResultReasoning` reads it: several
 * backends route the answer into `reasoning_content` and leave `content` empty,
 * so losing this field would silently disable that rescue (#443).
 *
 * `output` is present only when an `output` specification was passed, and reading
 * it without one throws — the same contract the SDK's own getter has. Two call
 * sites catch that error and recover the answer from the reasoning channel, so
 * turning it into `undefined` here would have moved the throw out of their
 * `try`/`catch` and lost the recovery (#443).
 */
export interface BufferedGeneration {
	readonly text: string;
	readonly finishReason: FinishReason;
	readonly usage: LanguageModelUsage;
	readonly finalStep: unknown;
	readonly output: unknown;
}

export interface BufferedGenerationOptions {
	/**
	 * Force one transport. Omit to let the platform decide — production call
	 * sites omit it, and tests pass it so the policy is not part of what they
	 * are measuring.
	 */
	stream?: boolean;
}

type GenerateArgs = Parameters<typeof generateText>[0];
type StreamArgs = Parameters<typeof streamText>[0];

/** How the plugin decides whether an ingest call streams (#980). */
export type StreamIngestMode = 'auto' | 'always' | 'never';

/**
 * The user's choice, as last read from settings.
 *
 * A module-level value because it is one decision about the transport, not data
 * that varies per call: the three clients make fifteen completion calls between
 * them, and threading a mode through every one would add a parameter that can be
 * forgotten at one site. `create-llm-client.ts` sets it where settings are read.
 */
let streamIngestMode: StreamIngestMode = 'auto';

/**
 * True where an idle connection is cut before a long generation can finish.
 *
 * `Platform.isMobile` covers both mobile apps. It is read here, and nowhere
 * else, so the policy has one home; the parameters exist for tests.
 *
 * `always` and `never` are escape hatches the platform cannot express. A desktop
 * user behind a proxy with its own idle timeout needs the first; a user on
 * metered mobile data, who reads the byte cost and prefers a failed long call to
 * an expensive one, needs the second.
 */
export function shouldStreamForSilence(
	isMobile: boolean = Platform.isMobile,
	mode: StreamIngestMode = streamIngestMode,
): boolean {
	if (mode === 'always') return true;
	if (mode === 'never') return false;
	return isMobile;
}

/** Set once, where the plugin reads its settings. */
export function setStreamIngestMode(mode: StreamIngestMode | undefined): void {
	streamIngestMode = mode === 'always' || mode === 'never' ? mode : 'auto';
}

/**
 * Run one completion and return the buffered result either way.
 *
 * The argument object is passed through unchanged: `generateText` and
 * `streamText` accept the same shape, so no translation happens here and a
 * caller cannot accidentally pass options that only one of them understands.
 */
export async function generateBuffered(
	args: GenerateArgs,
	options: BufferedGenerationOptions = {}
): Promise<BufferedGeneration> {
	const stream = options.stream ?? shouldStreamForSilence();

	if (!stream) {
		// The SDK result is returned untouched, not rebuilt field by field. Every
		// field already has exactly the semantics the callers rely on, and `output`
		// is a getter that throws when nothing was parsed — a detail two call sites
		// catch on purpose. Copying the fields here moved that throw from their
		// `try`/`catch` into this function, which is how the first version of this
		// module broke them.
		return await generateText(args);
	}

	const result = streamText(args as unknown as StreamArgs);
	const [text, finishReason, usage, finalStep] = await Promise.all([
		result.text,
		result.finishReason,
		result.usage,
		result.finalStep,
	]);
	// Awaited only when a specification was passed: parsing output is work a
	// caller that never reads it should not pay for.
	const output: unknown = args.output ? await result.output : undefined;
	return {
		text,
		finishReason,
		usage,
		finalStep,
		get output(): unknown {
			if (!args.output) throw new NoOutputGeneratedError();
			return output;
		},
	};
}
