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
import { generateText, streamText } from 'ai';
import type { FinishReason, LanguageModelUsage } from 'ai';

/**
 * The five fields the callers read from a `generateText` result.
 *
 * `finalStep` is carried because `extractResultReasoning` reads it: several
 * backends route the answer into `reasoning_content` and leave `content` empty,
 * so losing this field would silently disable that rescue (#443).
 *
 * `output` is present only when an `output` specification was passed. The SDK
 * throws when the field is read without one, and every caller already treats
 * "absent" as `undefined` — see `readOutput` in the compat client.
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

/**
 * True where an idle connection is cut before a long generation can finish.
 *
 * `Platform.isMobile` covers both mobile apps. It is read here, and nowhere
 * else, so the policy has one home; the parameter exists for tests.
 */
export function shouldStreamForSilence(isMobile: boolean = Platform.isMobile): boolean {
	return isMobile;
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
		const result = await generateText(args);
		return {
			text: result.text,
			finishReason: result.finishReason,
			usage: result.usage,
			finalStep: result.finalStep,
			// Guarded: the SDK's `output` getter throws when no specification was
			// passed, so reading it unconditionally would turn the buffered path
			// into a failure the streamed path does not have.
			output: args.output ? result.output : undefined,
		};
	}

	const result = streamText(args as unknown as StreamArgs);
	const [text, finishReason, usage, finalStep] = await Promise.all([
		result.text,
		result.finishReason,
		result.usage,
		result.finalStep,
	]);
	// `unknown` is stated rather than inferred: the cast above erases the output
	// generic, so the inferred type here is `any` and the lint budget forbids an
	// unchecked assignment. The callers cast at the point of use through
	// `readOutput`, which already accepts `unknown`.
	const output: unknown = args.output ? await result.output : undefined;
	return { text, finishReason, usage, finalStep, output };
}
