import {
  AiRequestGate,
  parseRetryAfterMs,
  readAiChatConcurrency,
  readAiChatMaxRetries,
} from './ai-request-gate';

describe('AiRequestGate', () => {
  it('limits concurrent work to the configured concurrency', async () => {
    const gate = new AiRequestGate(1);
    let concurrent = 0;
    let maxConcurrent = 0;

    const task = async () => {
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await delay(30);
      concurrent -= 1;
    };

    await Promise.all([gate.run(task), gate.run(task), gate.run(task)]);

    expect(maxConcurrent).toBe(1);
  });

  it('allows up to N concurrent when concurrency is N', async () => {
    const gate = new AiRequestGate(2);
    let concurrent = 0;
    let maxConcurrent = 0;

    const task = async () => {
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await delay(40);
      concurrent -= 1;
    };

    await Promise.all([gate.run(task), gate.run(task), gate.run(task)]);
    expect(maxConcurrent).toBe(2);
  });

  it('does not deadlock or starve queued work', async () => {
    const gate = new AiRequestGate(1);
    const order: number[] = [];

    await Promise.all([
      gate.run(async () => {
        order.push(1);
        await delay(20);
      }),
      gate.run(async () => {
        order.push(2);
      }),
      gate.run(async () => {
        order.push(3);
      }),
    ]);

    expect(order).toEqual([1, 2, 3]);
    expect(gate.activeCount).toBe(0);
    expect(gate.waitingCount).toBe(0);
  });

  it('shared cooldown delays subsequent work after noteCooldownFor', async () => {
    const gate = new AiRequestGate(1);
    const started: number[] = [];
    const t0 = Date.now();

    const first = gate.run(async () => {
      started.push(Date.now() - t0);
      gate.noteCooldownFor(80);
    });

    // Let first acquire the slot before enqueueing the second.
    await delay(5);
    const second = gate.run(async () => {
      started.push(Date.now() - t0);
    });

    await Promise.all([first, second]);
    expect(started).toHaveLength(2);
    expect(started[1]).toBeGreaterThanOrEqual(70);
  });
});

describe('parseRetryAfterMs', () => {
  it('parses seconds exactly', () => {
    expect(parseRetryAfterMs('12')).toBe(12_000);
  });

  it('parses HTTP-date relative to now', () => {
    const now = Date.UTC(2026, 0, 1, 0, 0, 0);
    const header = new Date(now + 5_000).toUTCString();
    expect(parseRetryAfterMs(header, now)).toBe(5_000);
  });

  it('returns undefined for missing/invalid headers', () => {
    expect(parseRetryAfterMs(null)).toBeUndefined();
    expect(parseRetryAfterMs('')).toBeUndefined();
    expect(parseRetryAfterMs('not-a-date')).toBeUndefined();
  });
});

describe('readAiChatConcurrency / max retries', () => {
  it('defaults concurrency to configured key count', () => {
    expect(readAiChatConcurrency({})).toBe(1);
    expect(
      readAiChatConcurrency({
        AI_API_KEY: 'a',
        AI_API_KEY_1: 'b',
        AI_API_KEY_2: 'c',
        AI_API_KEY_3: 'd',
      }),
    ).toBe(4);
    expect(readAiChatConcurrency({}, 4)).toBe(4);
  });

  it('reads and clamps concurrency', () => {
    expect(readAiChatConcurrency({ AI_CHAT_CONCURRENCY: '3' })).toBe(3);
    expect(readAiChatConcurrency({ AI_CHAT_CONCURRENCY: '0' }, 4)).toBe(4);
    expect(readAiChatConcurrency({ AI_CHAT_CONCURRENCY: '99' })).toBe(8);
  });

  it('defaults max retries to 4', () => {
    expect(readAiChatMaxRetries({})).toBe(4);
  });
});

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
