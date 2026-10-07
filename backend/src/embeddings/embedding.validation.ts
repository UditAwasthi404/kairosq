export class EmbeddingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmbeddingValidationError';
  }
}

export function validateEmbeddingVector(
  value: unknown,
  expectedDimensions: number,
): number[] {
  if (!Array.isArray(value)) {
    throw new EmbeddingValidationError('Embedding must be an array');
  }
  if (value.length !== expectedDimensions) {
    throw new EmbeddingValidationError(
      `Embedding dimension mismatch: expected ${expectedDimensions}, got ${value.length}`,
    );
  }

  const vector: number[] = [];
  for (const item of value) {
    if (typeof item !== 'number' || !Number.isFinite(item)) {
      throw new EmbeddingValidationError(
        'Embedding contains non-finite numeric values',
      );
    }
    vector.push(item);
  }
  return vector;
}

export function toPgVectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

export function isNonEmptyChunkContent(
  content: string | null | undefined,
): boolean {
  return Boolean(content && content.trim().length > 0);
}
