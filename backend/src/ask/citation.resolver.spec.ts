import type { GroundedContextItem } from '../ai/ai.types';
import { resolveCitations } from './citation.resolver';

describe('resolveCitations', () => {
  const context: GroundedContextItem[] = [
    {
      ref: 1,
      chunkId: 'chunk_a',
      observationId: 'obs_a',
      title: 'redis.txt',
      content: 'Redis is used for caching.',
      createdAt: '2026-09-01T00:00:00.000Z',
      similarity: 0.9,
    },
    {
      ref: 2,
      chunkId: 'chunk_b',
      observationId: 'obs_b',
      title: 'pg.txt',
      content: 'PostgreSQL stores relational data.',
      createdAt: '2026-09-02T00:00:00.000Z',
      similarity: 0.8,
    },
  ];

  it('maps valid refs and drops invented ones', () => {
    const citations = resolveCitations([1, 99, 2, 1], context);
    expect(citations).toHaveLength(2);
    expect(citations[0]).toMatchObject({
      chunkId: 'chunk_a',
      observationId: 'obs_a',
      title: 'redis.txt',
    });
    expect(citations[1]?.chunkId).toBe('chunk_b');
  });

  it('returns empty for no valid refs', () => {
    expect(resolveCitations([7, 8], context)).toEqual([]);
  });
});
