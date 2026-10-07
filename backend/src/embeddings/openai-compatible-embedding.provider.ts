import { Injectable, Logger } from '@nestjs/common';
import {
  readEmbeddingConfig,
  type EmbeddingProvider,
  type EmbeddingResult,
} from './embedding.types';
import { validateEmbeddingVector } from './embedding.validation';

@Injectable()
export class OpenAICompatibleEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'openai-compatible';
  readonly model: string;
  readonly dimensions: number;
  private readonly logger = new Logger(OpenAICompatibleEmbeddingProvider.name);
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly maxRetries: number;

  constructor() {
    const config = readEmbeddingConfig();
    this.model = config.model;
    this.dimensions = config.dimensions;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl!;
    this.maxRetries = config.maxRetries;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
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

    const payload = await this.requestWithRetry(texts);
    if (!Array.isArray(payload.data) || payload.data.length !== texts.length) {
      throw new Error('Embedding provider returned unexpected batch size');
    }

    const ordered = [...payload.data].sort(
      (a, b) => (a.index ?? 0) - (b.index ?? 0),
    );

    return ordered.map((item) => {
      const embedding = validateEmbeddingVector(
        item.embedding,
        this.dimensions,
      );
      return {
        embedding,
        model: this.model,
        dimensions: this.dimensions,
      };
    });
  }

  private async requestWithRetry(
    texts: string[],
  ): Promise<{ data: Array<{ embedding: unknown; index?: number }> }> {
    let attempt = 0;
    let lastError: Error | undefined;

    while (attempt <= this.maxRetries) {
      try {
        return await this.requestOnce(texts);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const retryable = isRetryableEmbeddingError(lastError);
        if (!retryable || attempt === this.maxRetries) {
          throw lastError;
        }
        const delayMs = Math.min(1000 * 2 ** attempt, 8000);
        this.logger.warn(
          `Embedding request failed (attempt ${attempt + 1}/${this.maxRetries + 1}): ${lastError.message}. Retrying in ${delayMs}ms`,
        );
        await sleep(delayMs);
        attempt += 1;
      }
    }

    throw lastError ?? new Error('Embedding request failed');
  }

  private async requestOnce(
    texts: string[],
  ): Promise<{ data: Array<{ embedding: unknown; index?: number }> }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    try {
      const body: Record<string, unknown> = {
        model: this.model,
        input: texts,
      };
      // text-embedding-3-* supports explicit dimensions
      if (this.model.includes('text-embedding-3')) {
        body.dimensions = this.dimensions;
      }

      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (response.status === 429) {
        throw new Error('Embedding rate limit exceeded');
      }
      if (!response.ok) {
        throw new Error(
          `Embedding request failed with status ${response.status}`,
        );
      }

      return (await response.json()) as {
        data: Array<{ embedding: unknown; index?: number }>;
      };
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

function isRetryableEmbeddingError(error: Error): boolean {
  return /timeout|rate limit|429|502|503|504|network|ECONNRESET|fetch failed/i.test(
    error.message,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
