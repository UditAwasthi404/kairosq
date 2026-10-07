import { normalizeGeminiOcrBaseUrl } from './gemini-ocr.provider';
import { readOcrConfig } from './ocr.types';

describe('OCR helpers', () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it('normalizes Gemini OCR base URL to v1beta', () => {
    expect(
      normalizeGeminiOcrBaseUrl('https://generativelanguage.googleapis.com'),
    ).toBe('https://generativelanguage.googleapis.com/v1beta');
  });

  it('reads OCR config with embedding key fallback', () => {
    delete process.env.OCR_API_KEY;
    delete process.env.OCR_MODEL;
    delete process.env.AI_INGEST_MODEL;
    process.env.EMBEDDING_API_KEY = 'test-key';
    process.env.OCR_PROVIDER = 'gemini';
    const config = readOcrConfig();
    expect(config.provider).toBe('gemini');
    expect(config.apiKey).toBe('test-key');
    expect(config.model).toBe('gemini-3.5-flash-lite');
  });

  it('falls back to the chat Gemini key pool when no OCR or embedding key is set', () => {
    delete process.env.OCR_API_KEY;
    delete process.env.EMBEDDING_API_KEY;
    delete process.env.EMBEDDING_API_KEYS;
    for (let i = 1; i <= 8; i += 1) {
      delete process.env[`EMBEDDING_API_KEY_${i}`];
    }
    process.env.AI_API_KEY = 'chat-key';
    process.env.OCR_PROVIDER = 'gemini';
    expect(readOcrConfig().apiKey).toBe('chat-key');
  });
});
