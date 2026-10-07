import { AiApiKeyPool, readAiApiKeys } from './ai-api-key-pool';
import { AiRequestGate } from './ai-request-gate';
import { OpenAICompatibleProvider } from './openai-compatible.provider';

const VALID_ANALYSIS = {
  summary: 'A valid document summary for tests.',
  topics: [],
  entities: [],
};

describe('AiApiKeyPool / readAiApiKeys', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('reads primary + numbered + list keys without duplicates', () => {
    process.env.AI_API_KEY = 'primary';
    process.env.AI_API_KEY_1 = 'k1';
    process.env.AI_API_KEY_2 = 'k2';
    process.env.AI_API_KEYS = 'k2, k3';
    expect(readAiApiKeys(process.env)).toEqual(['primary', 'k1', 'k2', 'k3']);
  });

  it('rotates away from a rate-limited key immediately', () => {
    const pool = new AiApiKeyPool(['a', 'b', 'c']);
    const first = pool.acquire(1_000)!;
    expect(first.key).toBe('a');
    pool.markRateLimited(first.slot, 60_000, 1_000);
    pool.release(first.slot);
    const second = pool.acquire(1_001)!;
    expect(second.key).toBe('b');
    expect(pool.availableCount(1_001)).toBe(2);
    pool.release(second.slot);
  });

  it('gives distinct idle keys to concurrent acquires', () => {
    const pool = new AiApiKeyPool(['a', 'b', 'c', 'd']);
    const got = [
      pool.acquire(1_000)!.key,
      pool.acquire(1_000)!.key,
      pool.acquire(1_000)!.key,
      pool.acquire(1_000)!.key,
    ];
    expect(new Set(got).size).toBe(4);
  });
});

describe('OpenAICompatibleProvider rate control', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.AI_API_KEY;
    delete process.env.AI_API_KEY_1;
    delete process.env.AI_API_KEY_2;
    delete process.env.AI_API_KEY_3;
    delete process.env.AI_API_KEYS;
    delete process.env.AI_BASE_URL;
    delete process.env.AI_MODEL;
    delete process.env.AI_CHAT_MAX_RETRIES;
    delete process.env.AI_CHAT_CONCURRENCY;
    jest.restoreAllMocks();
  });

  function buildProvider(gate?: AiRequestGate) {
    process.env.AI_API_KEY = 'test-key';
    process.env.AI_BASE_URL = 'https://api.openai.com/v1';
    process.env.AI_MODEL = 'gpt-4o-mini';
    process.env.AI_CHAT_MAX_RETRIES = '3';
    const provider = new OpenAICompatibleProvider();
    if (gate) {
      provider.replaceGateForTests(gate);
    }
    return provider;
  }

  it('limits concurrent chat/completions across analyzeDocument calls', async () => {
    const gate = new AiRequestGate(1);
    const provider = buildProvider(gate);
    let inFlight = 0;
    let maxInFlight = 0;

    global.fetch = jest.fn(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await delay(40);
      inFlight -= 1;
      return jsonResponse(VALID_ANALYSIS);
    });

    await Promise.all([
      provider.analyzeDocument(['doc one text']),
      provider.analyzeDocument(['doc two text']),
      provider.analyzeDocument(['doc three text']),
    ]);

    expect(maxInFlight).toBe(1);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('runs one chat call per API key in parallel', async () => {
    process.env.AI_API_KEY = 'k0';
    process.env.AI_API_KEY_1 = 'k1';
    process.env.AI_API_KEY_2 = 'k2';
    process.env.AI_API_KEY_3 = 'k3';
    process.env.AI_BASE_URL = 'https://api.openai.com/v1';
    process.env.AI_MODEL = 'gpt-4o-mini';
    delete process.env.AI_CHAT_CONCURRENCY;

    const provider = new OpenAICompatibleProvider();
    expect(provider.apiKeyCount).toBe(4);
    expect(provider.chatConcurrency).toBe(4);

    let inFlight = 0;
    let maxInFlight = 0;
    const keysUsed = new Set<string>();

    global.fetch = jest.fn(async (_url, init) => {
      const headers = init?.headers as Record<string, string>;
      const auth = headers.Authorization ?? '';
      keysUsed.add(auth);
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await delay(50);
      inFlight -= 1;
      return jsonResponse(VALID_ANALYSIS);
    });

    await Promise.all([
      provider.analyzeDocument(['doc 0']),
      provider.analyzeDocument(['doc 1']),
      provider.analyzeDocument(['doc 2']),
      provider.analyzeDocument(['doc 3']),
    ]);

    expect(maxInFlight).toBe(4);
    expect(keysUsed.size).toBe(4);
  });

  it('respects Retry-After on 429 then succeeds (single key)', async () => {
    const gate = new AiRequestGate(1);
    const provider = buildProvider(gate);
    let calls = 0;
    const timestamps: number[] = [];
    const t0 = Date.now();

    global.fetch = jest.fn(async () => {
      calls += 1;
      timestamps.push(Date.now() - t0);
      if (calls === 1) {
        return new Response(
          JSON.stringify({
            error: {
              message: 'Rate limit reached for TPM',
              type: 'rate_limit',
            },
          }),
          {
            status: 429,
            headers: {
              'retry-after': '1',
              'content-type': 'application/json',
            },
          },
        );
      }
      return jsonResponse({
        summary: 'Recovered summary after cooldown.',
        topics: [],
        entities: [],
      });
    });

    const result = await provider.analyzeDocument(['short document']);
    expect(result.summary).toMatch(/Recovered/);
    expect(calls).toBe(2);
    expect(timestamps[1]).toBeGreaterThanOrEqual(900);
  });

  it('rotates to the next API key on 429 without waiting Retry-After', async () => {
    process.env.AI_API_KEY = 'key-a';
    process.env.AI_API_KEY_1 = 'key-b';
    process.env.AI_BASE_URL = 'https://api.openai.com/v1';
    process.env.AI_MODEL = 'gpt-4o-mini';
    process.env.AI_CHAT_MAX_RETRIES = '3';
    const provider = new OpenAICompatibleProvider();
    provider.replaceGateForTests(new AiRequestGate(1));

    const authHeaders: string[] = [];
    const timestamps: number[] = [];
    const t0 = Date.now();

    global.fetch = jest.fn(async (_url, init) => {
      const headers = init?.headers as Record<string, string>;
      authHeaders.push(headers.Authorization ?? '');
      timestamps.push(Date.now() - t0);
      if (authHeaders.length === 1) {
        return new Response(JSON.stringify({ error: { message: 'tpm' } }), {
          status: 429,
          headers: {
            'retry-after': '5',
            'content-type': 'application/json',
          },
        });
      }
      return jsonResponse(VALID_ANALYSIS);
    });

    const result = await provider.analyzeDocument(['rotate me']);
    expect(result.summary).toMatch(/valid document summary/i);
    expect(authHeaders[0]).toContain('key-a');
    expect(authHeaders[1]).toContain('key-b');
    // Must not wait the full Retry-After when another key is free.
    expect(timestamps[1]).toBeLessThan(2_000);
  });

  it('does not retry non-retryable 4xx errors', async () => {
    const provider = buildProvider(new AiRequestGate(1));
    global.fetch = jest.fn(async () => {
      return new Response(
        JSON.stringify({ error: { message: 'bad request' } }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      );
    });

    await expect(provider.analyzeDocument(['x'])).rejects.toThrow(/status 400/);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('queues retries behind the gate instead of overlapping HTTP after 429', async () => {
    const gate = new AiRequestGate(1);
    const provider = buildProvider(gate);
    let inFlight = 0;
    let maxInFlight = 0;
    const perKey: Record<string, number> = { a: 0, b: 0 };

    global.fetch = jest.fn(async (_url, init) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        messages?: Array<{ content?: string }>;
      };
      const content = body.messages?.find((m) =>
        m.content?.includes('Analyze'),
      )?.content;
      const key = content?.includes('doc-a')
        ? 'a'
        : content?.includes('doc-b')
          ? 'b'
          : 'x';
      perKey[key] = (perKey[key] ?? 0) + 1;

      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await delay(15);
      inFlight -= 1;

      if (perKey[key] === 1) {
        return new Response(JSON.stringify({ error: { message: 'tpm' } }), {
          status: 429,
          headers: {
            'retry-after': '0',
            'content-type': 'application/json',
          },
        });
      }
      return jsonResponse(VALID_ANALYSIS);
    });

    const [a, b] = await Promise.all([
      provider.analyzeDocument(['doc-a content here']),
      provider.analyzeDocument(['doc-b content here']),
    ]);

    expect(a.summary).toMatch(/valid document summary/i);
    expect(b.summary).toMatch(/valid document summary/i);
    expect(maxInFlight).toBe(1);
  });
});

function jsonResponse(payload: unknown): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify(payload) } }],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
