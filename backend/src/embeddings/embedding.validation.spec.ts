import {
  EmbeddingValidationError,
  isNonEmptyChunkContent,
  toPgVectorLiteral,
  validateEmbeddingVector,
} from './embedding.validation';
import { LocalDeterministicEmbeddingProvider } from './local-deterministic-embedding.provider';

describe('embedding validation', () => {
  it('accepts a valid vector', () => {
    const vector = Array.from({ length: 8 }, (_, i) => i / 10);
    expect(validateEmbeddingVector(vector, 8)).toEqual(vector);
  });

  it('rejects wrong dimensions', () => {
    expect(() => validateEmbeddingVector([1, 2], 3)).toThrow(
      EmbeddingValidationError,
    );
  });

  it('rejects non-finite values', () => {
    expect(() => validateEmbeddingVector([1, Number.NaN], 2)).toThrow(
      EmbeddingValidationError,
    );
  });

  it('rejects empty chunk content', () => {
    expect(isNonEmptyChunkContent('   ')).toBe(false);
    expect(isNonEmptyChunkContent('hello')).toBe(true);
  });

  it('formats pgvector literals', () => {
    expect(toPgVectorLiteral([0.1, -0.2])).toBe('[0.1,-0.2]');
  });
});

describe('LocalDeterministicEmbeddingProvider', () => {
  const original = process.env.EMBEDDING_DIMENSIONS;

  beforeAll(() => {
    process.env.EMBEDDING_DIMENSIONS = '32';
  });

  afterAll(() => {
    process.env.EMBEDDING_DIMENSIONS = original;
  });

  it('produces stable unit vectors of the configured dimension', async () => {
    const provider = new LocalDeterministicEmbeddingProvider();
    const a = await provider.embedText('PostgreSQL pgvector embeddings');
    const b = await provider.embedText('PostgreSQL pgvector embeddings');
    expect(a.embedding).toHaveLength(32);
    expect(a.embedding).toEqual(b.embedding);
    const norm = Math.sqrt(
      a.embedding.reduce((sum, value) => sum + value * value, 0),
    );
    expect(norm).toBeCloseTo(1, 5);
  });

  it('ranks related text closer than unrelated text', async () => {
    const provider = new LocalDeterministicEmbeddingProvider();
    const query = await provider.embedText(
      'How can PostgreSQL store AI vectors?',
    );
    const related = await provider.embedText(
      'PostgreSQL can use pgvector to store and search embedding vectors.',
    );
    const unrelated = await provider.embedText(
      'React Native is a framework for building mobile applications.',
    );

    const cosine = (a: number[], b: number[]) =>
      a.reduce((sum, value, i) => sum + value * (b[i] ?? 0), 0);

    expect(cosine(query.embedding, related.embedding)).toBeGreaterThan(
      cosine(query.embedding, unrelated.embedding),
    );
  });
});
