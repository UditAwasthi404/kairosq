import { Injectable, Logger } from '@nestjs/common';
import { AiApiKeyPool } from '../ai/ai-api-key-pool';
import { parseRetryAfterMs } from '../ai/ai-request-gate';
import {
  readEmbeddingConfig,
  type EmbeddingProvider,
  type EmbeddingResult,
} from './embedding.types';
import { validateEmbeddingVector } from './embedding.validation';

/**
 * Google Gemini embedding API (not OpenAI-compatible).
 * POST .../v1beta/models/{model}:embedContent | :batchEmbedContents
 */
@Injectable()
export class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'gemini';
  readonly model: string;
  readonly dimensions: number;
  private readonly logger = new Logger(GeminiEmbeddingProvider.name);
  private keyPool: AiApiKeyPool;
  private readonly baseUrl: string;
  private readonly maxRetries: number;

  constructor() {
    const config = readEmbeddingConfig();
    this.model = normalizeGeminiModel(config.model);
    this.dimensions = config.dimensions;
    this.keyPool = new AiApiKeyPool(config.apiKeys);
    this.baseUrl = normalizeGeminiBaseUrl(config.baseUrl);
    this.maxRetries = config.maxRetries;
    if (this.keyPool.size > 0) {
      this.logger.log(
        `Gemini embeddings ready: ${this.keyPool.size} key(s), model=${this.model}, dimensions=${this.dimensions}`,
      );
    }
  }

  replaceKeyPoolForTests(pool: AiApiKeyPool): void {
    this.keyPool = pool;
  }

  get apiKeyCount(): number {
    return this.keyPool.size;
  }

  isConfigured(): boolean {
    return this.keyPool.isConfigured();
  }

  async embedText(text: string): Promise<EmbeddingResult> {
    const [result] = await this.embedTexts([text]);
    return result;
  }

  async embedTexts(texts: string[]): Promise<EmbeddingResult[]> {
    if (!this.isConfigured()) {
      throw new Error('Embedding provider is not configured');
    }
    if (texts.length === 0) {
      return [];
    }

    const vectors = await this.requestWithRetry(texts);
    if (vectors.length !== texts.length) {
      throw new Error('Embedding provider returned unexpected batch size');
    }

    return vectors.map((embedding) => ({
      embedding: validateEmbeddingVector(embedding, this.dimensions),
      model: this.model,
      dimensions: this.dimensions,
    }));
  }

  private async requestWithRetry(texts: string[]): Promise<number[][]> {
    let attempt = 0;
    let lastError: Error | undefined;

    while (attempt <= this.maxRetries) {
      if (this.keyPool.availableCount() === 0) {
        const waitMs = Math.max(
          200,
          this.keyPool.msUntilAnyAvailable() || 1_000,
        );
        this.logger.warn(
          `All Gemini embedding keys cooling down; waiting ${waitMs}ms before retry`,
        );
        await sleep(waitMs);
        attempt += 1;
        continue;
      }

      const selected = this.keyPool.acquire();
      if (!selected) {
        const waitMs = Math.max(
          200,
          this.keyPool.msUntilAnyAvailable() || 1_000,
        );
        await sleep(waitMs);
        attempt += 1;
        continue;
      }

      try {
        return await this.requestOnce(texts, selected.key, selected.slot);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const retryAfterMs =
          error instanceof EmbeddingRateLimitError
            ? error.retryAfterMs
            : undefined;

        if (error instanceof EmbeddingRateLimitError) {
          this.keyPool.markRateLimited(selected.slot, retryAfterMs ?? 1_000);
          if (this.keyPool.availableCount() > 0 && attempt < this.maxRetries) {
            this.logger.warn(
              `Gemini embedding key rate-limited; rotating to next key (attempt ${attempt + 1}/${this.maxRetries + 1})`,
            );
            attempt += 1;
            continue;
          }
        }

        if (
          !isRetryableEmbeddingError(lastError) ||
          attempt === this.maxRetries
        ) {
          throw lastError;
        }

        const delayMs = Math.min(1000 * 2 ** attempt, 8000);
        this.logger.warn(
          `Gemini embedding failed (attempt ${attempt + 1}/${this.maxRetries + 1}): ${lastError.message}. Retrying in ${delayMs}ms`,
        );
        await sleep(delayMs);
        attempt += 1;
      } finally {
        this.keyPool.release(selected.slot);
      }
    }

    throw lastError ?? new Error('Embedding request failed');
  }

  private async requestOnce(
    texts: string[],
    apiKey: string,
    keySlot: number,
  ): Promise<number[][]> {
    if (texts.length === 1) {
      return [await this.embedOne(texts[0], apiKey, keySlot)];
    }
    return this.embedBatch(texts, apiKey, keySlot);
  }

  private async embedOne(
    text: string,
    apiKey: string,
    keySlot: number,
  ): Promise<number[]> {
    const url = `${this.baseUrl}/models/${encodeURIComponent(this.model)}:embedContent`;
    const response = await this.fetchJson(
      url,
      {
        model: `models/${this.model}`,
        content: { parts: [{ text }] },
        outputDimensionality: this.dimensions,
      },
      apiKey,
      keySlot,
    );

    const values = (response as { embedding?: { values?: unknown } }).embedding
      ?.values;
    if (!Array.isArray(values)) {
      throw new Error('Gemini embedding response missing values');
    }
    return values as number[];
  }

  private async embedBatch(
    texts: string[],
    apiKey: string,
    keySlot: number,
  ): Promise<number[][]> {
    const url = `${this.baseUrl}/models/${encodeURIComponent(this.model)}:batchEmbedContents`;
    const response = await this.fetchJson(
      url,
      {
        requests: texts.map((text) => ({
          model: `models/${this.model}`,
          content: { parts: [{ text }] },
          outputDimensionality: this.dimensions,
        })),
      },
      apiKey,
      keySlot,
    );

    const embeddings = (
      response as { embeddings?: Array<{ values?: unknown }> }
    ).embeddings;
    if (!Array.isArray(embeddings) || embeddings.length !== texts.length) {
      throw new Error('Gemini batch embedding response size mismatch');
    }

    return embeddings.map((item, index) => {
      if (!Array.isArray(item.values)) {
        throw new Error(
          `Gemini batch embedding missing values at index ${index}`,
        );
      }
      return item.values as number[];
    });
  }

  private async fetchJson(
    url: string,
    body: Record<string, unknown>,
    apiKey: string,
    keySlot: number,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (response.status === 429) {
        this.logger.warn(
          `EMBEDDING_REQUEST_FAILED ${JSON.stringify({
            event: 'rate_limited',
            provider: this.name,
            model: this.model,
            status: 429,
            keySlot: keySlot + 1,
            keyCount: this.keyPool.size,
            retryAfter: response.headers.get('retry-after') ?? undefined,
          })}`,
        );
        throw new EmbeddingRateLimitError(
          parseRetryAfterMs(response.headers.get('retry-after')) ?? 1_000,
        );
      }
      if (!response.ok) {
        let detail = '';
        try {
          const errBody = (await response.json()) as {
            error?: { message?: string };
          };
          detail = errBody.error?.message ? `: ${errBody.error.message}` : '';
        } catch {
          // ignore body parse errors
        }
        throw new Error(
          `Embedding request failed with status ${response.status}${detail}`,
        );
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Embedding request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

class EmbeddingRateLimitError extends Error {
  constructor(readonly retryAfterMs: number) {
    super('Embedding rate limit exceeded');
    this.name = 'EmbeddingRateLimitError';
  }
}

export function normalizeGeminiModel(model: string): string {
  return model.replace(/^models\//, '').trim() || 'gemini-embedding-001';
}

export function normalizeGeminiBaseUrl(baseUrl?: string): string {
  const raw = (
    baseUrl?.trim() || 'https://generativelanguage.googleapis.com'
  ).replace(/\/+$/, '');
  if (raw.endsWith('/v1beta')) return raw;
  if (raw.endsWith('/v1')) return `${raw}beta`;
  return `${raw}/v1beta`;
}

function isRetryableEmbeddingError(error: Error): boolean {
  return /timeout|rate limit|429|502|503|504|network|ECONNRESET|fetch failed|cooling down/i.test(
    error.message,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
