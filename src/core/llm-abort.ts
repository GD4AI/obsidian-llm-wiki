// #646: the engine's cancel reaches the model call. `cancelIngestion()`
// aborts the engine's controller, but until now that signal reached only the
// PDF conversion call; extraction, merge and every other call ran to their
// end and the cancel was noticed at three checkpoints per ingest — minutes
// later on a local model, and never if Obsidian closed in between. The
// engine hands out its client through one getter; this wraps it so every
// `createMessage` / `createMessageWithOutput` / `createMessageStream` call
// carries the current signal.
// A call site that sets its own signal keeps it.

type Signalled = { abortSignal?: AbortSignal };

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
        return (params: Signalled) => fn.call(target, inject(params));
      }
      const v = Reflect.get(target, key, receiver);
      return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v;
    },
  });
}
