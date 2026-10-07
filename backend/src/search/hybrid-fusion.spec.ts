import { fuseCandidates } from './hybrid-fusion';
import type { LexicalSearchHit } from './lexical-search.service';
import type { VectorSearchHit } from '../embeddings/vector-search.service';

describe('hybrid-fusion', () => {
  const semantic = (overrides: Partial<VectorSearchHit>): VectorSearchHit => ({
    chunkId: 'c1',
    observationId: 'o1',
    chunkIndex: 0,
    content: 'Redis caching',
    distance: 0.2,
    similarity: 0.8,
    ...overrides,
  });

  const lexical = (overrides: Partial<LexicalSearchHit>): LexicalSearchHit => ({
    chunkId: 'c1',
    observationId: 'o1',
    chunkIndex: 0,
    content: 'Redis caching',
    filename: 'notes.txt',
    ftsRank: 0.1,
    filenameMatch: false,
    contentExactMatch: false,
    ...overrides,
  });

  it('dedupes the same chunk from both branches', () => {
    const fused = fuseCandidates({
      query: 'Redis',
      semanticHits: [semantic({ chunkId: 'c1', similarity: 0.7 })],
      lexicalHits: [lexical({ chunkId: 'c1', ftsRank: 0.5 })],
    });
    expect(fused).toHaveLength(1);
    expect(fused[0]?.chunkId).toBe('c1');
  });

  it('boosts exact filename matches above weaker semantic-only hits', () => {
    const fused = fuseCandidates({
      query: 'redis-production-config.pdf',
      semanticHits: [
        semantic({
          chunkId: 'c_sem',
          observationId: 'o_sem',
          content: 'PostgreSQL caching strategies',
          similarity: 0.55,
        }),
      ],
      lexicalHits: [
        lexical({
          chunkId: 'c_file',
          observationId: 'o_file',
          content:
            'Production Redis configuration uses maxmemory-policy allkeys-lru.',
          filename: 'redis-production-config.pdf',
          ftsRank: 0.2,
          filenameMatch: true,
          contentExactMatch: false,
        }),
      ],
      weights: {
        semanticWeight: 0.55,
        lexicalWeight: 0.35,
        exactBoost: 0.1,
      },
    });

    expect(fused[0]?.chunkId).toBe('c_file');
  });

  it('keeps strong semantic hits competitive for paraphrase queries', () => {
    const fused = fuseCandidates({
      query: 'What did I use Redis for?',
      semanticHits: [
        semantic({
          chunkId: 'c_redis',
          observationId: 'o_redis',
          content: 'The backend uses Redis for caching.',
          similarity: 0.92,
        }),
      ],
      lexicalHits: [
        lexical({
          chunkId: 'c_pg',
          observationId: 'o_pg',
          content: 'PostgreSQL caching strategies can reduce database load.',
          filename: 'postgres-caching.txt',
          ftsRank: 0.05,
          contentExactMatch: false,
        }),
      ],
    });

    expect(fused[0]?.chunkId).toBe('c_redis');
  });
});
