import { readEmbeddingApiKeys } from '../ai/ai-api-key-pool';
import { readEmbeddingConfig } from './embedding.types';
import {
  GeminiEmbeddingProvider,
  normalizeGeminiBaseUrl,
  normalizeGeminiModel,
} from './gemini-embedding.provider';

describe('GeminiEmbeddingProvider helpers', () => {
  it('normalizes model ids', () => {
    expect(normalizeGeminiModel('models/gemini-embedding-001')).toBe(
      'gemini-embedding-001',
    );
    expect(normalizeGeminiModel('gemini-embedding-001')).toBe(
      'gemini-embedding-001',
    );
  });

  it('normalizes base URLs to v1beta', () => {
    expect(
      normalizeGeminiBaseUrl('https://generativelanguage.googleapis.com'),
    ).toBe('https://generativelanguage.googleapis.com/v1beta');
    expect(
      normalizeGeminiBaseUrl(
        'https://generativelanguage.googleapis.com/v1beta',
      ),
    ).toBe('https://generativelanguage.googleapis.com/v1beta');
  });
});

describe('readEmbeddingConfig / readEmbeddingApiKeys', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  function isolateKeys() {
    delete process.env.EMBEDDING_PROVIDER;
    delete process.env.EMBEDDING_API_KEY;
    delete process.env.EMBEDDING_API_KEYS;
    delete process.env.AI_API_KEY;
    delete process.env.AI_API_KEYS;
    for (let i = 1; i <= 8; i += 1) {
      delete process.env[`EMBEDDING_API_KEY_${i}`];
      delete process.env[`AI_API_KEY_${i}`];
    }
  }

  it('defaults the embedding provider to gemini', () => {
    isolateKeys();
    expect(readEmbeddingConfig().provider).toBe('gemini');
    expect(readEmbeddingConfig().model).toBe('gemini-embedding-001');
  });

  it('prefers dedicated embedding keys over the chat pool', () => {
    isolateKeys();
    process.env.EMBEDDING_API_KEY = 'emb-primary';
    process.env.EMBEDDING_API_KEY_1 = 'emb-1';
    process.env.AI_API_KEY = 'chat-only';
    expect(readEmbeddingApiKeys(process.env)).toEqual(['emb-primary', 'emb-1']);
  });

  it('falls back to the chat Gemini key pool when no embedding keys are set', () => {
    isolateKeys();
    process.env.AI_API_KEY = 'chat-a';
    process.env.AI_API_KEY_1 = 'chat-b';
    expect(readEmbeddingApiKeys(process.env)).toEqual(['chat-a', 'chat-b']);
    expect(readEmbeddingConfig().apiKeys).toEqual(['chat-a', 'chat-b']);
  });
});

describe('GeminiEmbeddingProvider key rotation', () => {
  const originalFetch = global.fetch;
  const envBackup = { ...process.env };

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...envBackup };
  });

  function buildProvider() {
    process.env.EMBEDDING_PROVIDER = 'gemini';
    process.env.EMBEDDING_MODEL = 'gemini-embedding-001';
    process.env.EMBEDDING_DIMENSIONS = '2';
    process.env.EMBEDDING_MAX_RETRIES = '3';
    process.env.EMBEDDING_BASE_URL =
      'https://generativelanguage.googleapis.com';
    delete process.env.AI_API_KEY;
    delete process.env.AI_API_KEYS;
    for (let i = 1; i <= 8; i += 1) {
      delete process.env[`AI_API_KEY_${i}`];
    }
    return new GeminiEmbeddingProvider();
  }

  it('calls embedContent with the rotating API key', async () => {
    process.env.EMBEDDING_API_KEY = 'emb-key';
    const provider = buildProvider();
    global.fetch = jest.fn(async (url, init) => {
      expect(String(url)).toMatch(
        /generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-embedding-001:embedContent/,
      );
      const headers = init?.headers as Record<string, string>;
      expect(headers['x-goog-api-key']).toBe('emb-key');
      return embeddingResponse([0.1, 0.2]);
    });

    const result = await provider.embedText('hello');
    expect(result.model).toBe('gemini-embedding-001');
    expect(result.embedding).toEqual([0.1, 0.2]);
  });

  it('rotates to the next Gemini embedding key on 429', async () => {
    process.env.EMBEDDING_API_KEY = 'key-a';
    process.env.EMBEDDING_API_KEY_1 = 'key-b';
    const provider = buildProvider();

    const keys: string[] = [];
    global.fetch = jest.fn(async (_url, init) => {
      const headers = init?.headers as Record<string, string>;
      keys.push(headers['x-goog-api-key'] ?? '');
      if (keys.length === 1) {
        return new Response(JSON.stringify({ error: { message: 'quota' } }), {
          status: 429,
          headers: { 'retry-after': '5', 'content-type': 'application/json' },
        });
      }
      return embeddingResponse([0.3, 0.4]);
    });

    const result = await provider.embedText('rotate me');
    expect(result.embedding).toEqual([0.3, 0.4]);
    expect(keys[0]).toBe('key-a');
    expect(keys[1]).toBe('key-b');
  });
});

function embeddingResponse(values: number[]): Response {
  return new Response(JSON.stringify({ embedding: { values } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
