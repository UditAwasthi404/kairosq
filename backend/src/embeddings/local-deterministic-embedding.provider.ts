import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import {
  readEmbeddingConfig,
  type EmbeddingProvider,
  type EmbeddingResult,
} from './embedding.types';
import { validateEmbeddingVector } from './embedding.validation';

/**
 * Deterministic local embeddings for development/tests when no API key is set.
 * Uses hashed bag-of-words so shared tokens produce measurable similarity.
 * Enable with EMBEDDING_PROVIDER=local.
 */
@Injectable()
export class LocalDeterministicEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'local-deterministic';
  readonly model = 'local-hash-v1';
  readonly dimensions: number;

  constructor() {
    this.dimensions = readEmbeddingConfig().dimensions;
  }

  isConfigured(): boolean {
    return true;
  }

  async embedText(text: string): Promise<EmbeddingResult> {
    const [result] = await this.embedTexts([text]);
    return result;
  }

  embedTexts(texts: string[]): Promise<EmbeddingResult[]> {
    return Promise.resolve(
      texts.map((text) => {
        const embedding = validateEmbeddingVector(
          bagOfWordsUnitVector(text, this.dimensions),
          this.dimensions,
        );
        return {
          embedding,
          model: this.model,
          dimensions: this.dimensions,
        };
      }),
    );
  }
}

function bagOfWordsUnitVector(text: string, dimensions: number): number[] {
  const vector = new Array<number>(dimensions).fill(0);
  const tokens = tokenize(text);
  if (tokens.length === 0) {
    vector[0] = 1;
    return vector;
  }

  for (const token of tokens) {
    const digest = createHash('sha256').update(token).digest();
    const idx = digest.readUInt32BE(0) % dimensions;
    vector[idx] += 1;
    // light bigram signal
    const idx2 = digest.readUInt32BE(4) % dimensions;
    vector[idx2] += 0.25;
  }

  let norm = 0;
  for (const value of vector) norm += value * value;
  norm = Math.sqrt(norm) || 1;
  return vector.map((value) => value / norm);
}

function tokenize(text: string): string[] {
  return (
    text
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter((token) => token.length > 1) ?? []
  );
}
