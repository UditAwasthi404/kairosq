import { readEmbeddingApiKeys } from '../ai/ai-api-key-pool';

export const EMBEDDING_PROVIDER = Symbol('EMBEDDING_PROVIDER');

export type EmbeddingResult = {
  embedding: number[];
  model: string;
  dimensions: number;
};

export interface EmbeddingProvider {
  readonly name: string;
  readonly model: string;
  readonly dimensions: number;
  isConfigured(): boolean;
  embedText(text: string): Promise<EmbeddingResult>;
  embedTexts(texts: string[]): Promise<EmbeddingResult[]>;
}

export type EmbeddingConfig = {
  provider: string;
  model: string;
  dimensions: number;
  batchSize: number;
  maxRetries: number;
  apiKey?: string;
  apiKeys: string[];
  baseUrl?: string;
};

export function readEmbeddingConfig(): EmbeddingConfig {
  const provider = (process.env.EMBEDDING_PROVIDER ?? 'gemini').toLowerCase();
  const dimensions = Number.parseInt(
    process.env.EMBEDDING_DIMENSIONS ?? '1536',
    10,
  );
  const batchSize = Number.parseInt(
    process.env.EMBEDDING_BATCH_SIZE ?? '32',
    10,
  );
  const maxRetries = Number.parseInt(
    process.env.EMBEDDING_MAX_RETRIES ?? '3',
    10,
  );

  const defaultModel =
    provider === 'gemini' ? 'gemini-embedding-001' : 'text-embedding-3-small';
  const defaultBaseUrl =
    provider === 'gemini'
      ? 'https://generativelanguage.googleapis.com'
      : 'https://api.openai.com/v1';

  const baseUrl =
    process.env.EMBEDDING_BASE_URL?.trim() ||
    (provider === 'gemini'
      ? defaultBaseUrl
      : process.env.AI_BASE_URL?.trim() || defaultBaseUrl);

  const apiKeys = readEmbeddingApiKeys();

  return {
    provider,
    model: process.env.EMBEDDING_MODEL?.trim() || defaultModel,
    dimensions:
      Number.isFinite(dimensions) && dimensions > 0 ? dimensions : 1536,
    batchSize:
      Number.isFinite(batchSize) && batchSize > 0
        ? Math.min(batchSize, 128)
        : 32,
    maxRetries:
      Number.isFinite(maxRetries) && maxRetries >= 0
        ? Math.min(maxRetries, 5)
        : 3,
    apiKey: apiKeys[0],
    apiKeys,
    baseUrl: baseUrl.replace(/\/+$/, ''),
  };
}
