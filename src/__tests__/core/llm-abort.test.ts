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
