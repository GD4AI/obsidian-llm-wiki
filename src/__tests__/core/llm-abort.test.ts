import { describe, it, expect } from 'vitest';
import { withAbortSignal } from '../../core/llm-abort';

describe('withAbortSignal (#646)', () => {
  const make = () => {
    const calls: unknown[] = [];
    class Client {
      private secret = 'kept';
      async createMessage(p: Record<string, unknown>) { calls.push(p); return 'text'; }
      async createMessageWithOutput(p: Record<string, unknown>) { calls.push(p); return { text: this.secret }; }
      async createMessageStream(p: Record<string, unknown>) { calls.push(p); return 'stream'; }
      other() { return this.secret; }
    }
    return { client: new Client(), calls };
  };

  it('adds the current signal to all three call shapes and leaves other members working', async () => {
    const { client, calls } = make();
    const ctl = new AbortController();
    const w = withAbortSignal(client, () => ctl.signal);
    await w.createMessage({ model: 'm' });
    expect(await w.createMessageWithOutput({ model: 'm' })).toEqual({ text: 'kept' });
    await w.createMessageStream({ model: 'm' });
    expect(calls.map(c => (c as { abortSignal?: AbortSignal }).abortSignal)).toEqual([ctl.signal, ctl.signal, ctl.signal]);
    expect(w.other()).toBe('kept');
  });

  it('reads the signal at call time, keeps a caller-set signal, and passes through when there is none', async () => {
    const { client, calls } = make();
    let current: AbortSignal | undefined;
    const w = withAbortSignal(client, () => current);
    await w.createMessage({ model: 'm' });
    const own = new AbortController().signal;
    current = new AbortController().signal;
    await w.createMessage({ model: 'm', abortSignal: own });
    await w.createMessage({ model: 'm' });
    expect(calls.map(c => (c as { abortSignal?: AbortSignal }).abortSignal)).toEqual([undefined, own, current]);
  });
});

describe('withAbortSignal abort-race (#703)', () => {
  // A provider response that never settles and ignores the abort signal —
  // the "provider response that never settles" candidate from #703.
  const hanging = () => {
    const calls: unknown[] = [];
    const client = {
      async createMessage(p: Record<string, unknown>) { calls.push(p); return new Promise<string>(() => {}); },
    };
    return { client, calls };
  };

  it('ends an in-flight call when the signal aborts, even if the call never settles', async () => {
    const { client } = hanging();
    const ctl = new AbortController();
    const w = withAbortSignal(client, () => ctl.signal);
    const pending = w.createMessage({ model: 'm' });
    const seen = expect(pending).rejects.toThrowError(expect.objectContaining({ name: 'AbortError' }));
    await new Promise(r => setTimeout(r, 50));
    const start = Date.now();
    ctl.abort();
    await seen;
    expect(Date.now() - start).toBeLessThan(2000);
  });

  it('rejects at once when the signal is already aborted, without starting the call', async () => {
    const { client, calls } = hanging();
    const ctl = new AbortController();
    ctl.abort();
    const w = withAbortSignal(client, () => ctl.signal);
    await expect(w.createMessage({ model: 'm' })).rejects.toThrowError(
      expect.objectContaining({ name: 'AbortError' }),
    );
    expect(calls).toEqual([]);
  });

  it('passes a normally resolving call through untouched', async () => {
    const client = { async createMessage(_p: Record<string, unknown>) { return 'page'; } };
    const ctl = new AbortController();
    const w = withAbortSignal(client, () => ctl.signal);
    await expect(w.createMessage({ model: 'm' })).resolves.toBe('page');
  });

  it('races against the caller-provided signal when the caller sets one', async () => {
    const { client } = hanging();
    const engineCtl = new AbortController();
    const ownCtl = new AbortController();
    const w = withAbortSignal(client, () => engineCtl.signal);
    const pending = w.createMessage({ model: 'm', abortSignal: ownCtl.signal });
    const seen = expect(pending).rejects.toThrowError(expect.objectContaining({ name: 'AbortError' }));
    await new Promise(r => setTimeout(r, 50));
    ownCtl.abort();
    await seen;
  });

  it('returns the original promise when there is no signal', async () => {
    const client = { async createMessage(_p: Record<string, unknown>) { return 'page'; } };
    const w = withAbortSignal(client, () => undefined);
    await expect(w.createMessage({ model: 'm' })).resolves.toBe('page');
  });
});
