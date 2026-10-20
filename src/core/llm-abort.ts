// #646: the engine's cancel reaches the model call. `cancelIngestion()`
// aborts the engine's controller, but until now that signal reached only the
// PDF conversion call; extraction, merge and every other call ran to their
// end and the cancel was noticed at three checkpoints per ingest — minutes
// later on a local model, and never if Obsidian closed in between. The
// engine hands out its client through one getter; this wraps it so every
// `createMessage` / `createMessageWithOutput` / `createMessageStream` call
// carries the current signal.
// A call site that sets its own signal keeps it.
//
// #703: the signal alone does not end the await. A provider response that
// never settles — or a call path that swallows the signal — leaves
// `cancelIngestion()` with no way to stop the in-flight call. The abort
// fires, the promise never resolves, and `checkCancelled()` is never
// reached. The proxy now races each model-call promise against the signal
// it injected, so the await ends with an AbortError as soon as the signal
// aborts. A call that finishes first resolves normally; the race does not
// touch it. When the signal is already aborted the call does not start.

type Signalled = { abortSignal?: AbortSignal };

function abortReason(signal: AbortSignal): Error | DOMException {
  const reason: unknown = signal.reason;
  if (reason instanceof Error) return reason;
  // Fallback for runtimes without signal.reason, or a non-Error reason:
  // a real DOMException, matching the codebase's single cancellation
  // convention — the engine recognises a cancellation with
  // `instanceof DOMException && name === 'AbortError'`.
  return new DOMException('Aborted', 'AbortError');
}

/**
 * Race a model-call promise against its abort signal (#703).
 *
 * The signal reaches the provider in the normal case, and the provider
 * ends the call itself. This race covers the other case: a provider
 * response that never settles, or a call path that drops the signal.
 * Without the race the await hangs forever and the cancel never lands.
 *
 * No signal: the promise passes through untouched. Normal completion:
 * the first branch wins and the listener is removed, so a finished call
 * keeps no reference to the signal.
 */
function raceWithAbort<T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (!signal) return promise;
  // No `signal.aborted` early-out here, deliberately. An abort that fired
  // before this line already ran its listeners; attaching a new one now
  // never fires, so the call's own outcome stands and the next
  // checkCancelled() checkpoint owns the cancellation — which keeps the
  // AbortError's DOMException identity for the engine's cancelled branch.
  // (A call that never started is rejected by the proxy's pre-invoke
  // check above instead.) Only an abort that fires while the promise is
  // still pending ends the await.
  let onAbort!: () => void;
  const abortPromise = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(abortReason(signal));
    signal.addEventListener('abort', onAbort, { once: true });
  });
  // Promise.race subscribes to both promises at once, so a late rejection
  // of the loser is still handled. `.finally` drops the abort listener on
  // the winning path; `once: true` drops it on the abort path.
  return Promise.race([promise, abortPromise]).finally(() => {
    signal.removeEventListener('abort', onAbort);
  });
}

export function withAbortSignal<C extends object>(client: C, signal: () => AbortSignal | undefined): C {
  const inject = <P extends Signalled>(params: P): P => {
    if (params.abortSignal) return params;
    const s = signal();
    return s ? { ...params, abortSignal: s } : params;
  };
  return new Proxy(client, {
    get(target, key, receiver) {
      if (key === 'createMessage' || key === 'createMessageWithOutput' || key === 'createMessageStream') {
        const fn = Reflect.get(target, key, target) as ((p: Signalled) => unknown) | undefined;
        if (typeof fn !== 'function') return fn;
        return (params: Signalled) => {
          const injected = inject(params);
          const sig = injected.abortSignal;
          // Already cancelled: do not start the call. The await ends at
          // once with the signal's reason instead of hanging on a call
          // that nobody will read.
          if (sig?.aborted) return Promise.reject(abortReason(sig));
          const result = fn.call(target, injected);
          return raceWithAbort(result as Promise<unknown>, sig);
        };
      }
      const v = Reflect.get(target, key, receiver);
      return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v;
    },
  });
}
