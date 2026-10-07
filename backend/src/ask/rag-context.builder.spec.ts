import type { SemanticSearchResult } from '../search/search.service';
import { RagContextBuilder } from './rag-context.builder';

function hit(
  overrides: Partial<SemanticSearchResult> & {
    content: string;
    chunkId: string;
  },
): SemanticSearchResult {
  return {
    chunkId: overrides.chunkId,
    observationId: overrides.observationId ?? 'obs_1',
    chunkIndex: overrides.chunkIndex ?? 0,
    content: overrides.content,
    similarity: overrides.similarity ?? 0.9,
    observation: overrides.observation ?? {
      id: overrides.observationId ?? 'obs_1',
      filename: 'notes.txt',
      type: 'TEXT',
      mimeType: 'text/plain',
      createdAt: '2026-09-01T00:00:00.000Z',
      capturedAt: '2026-09-01T00:00:00.000Z',
      summary: null,
    },
  };
}

describe('RagContextBuilder', () => {
  const builder = new RagContextBuilder();

  it('assigns stable refs and keeps ranking order', () => {
    const context = builder.build(
      [
        hit({ chunkId: 'c1', content: 'Redis is used for caching.' }),
        hit({
          chunkId: 'c2',
          content: 'PostgreSQL stores relational data.',
          observationId: 'obs_2',
          similarity: 0.7,
          observation: {
            id: 'obs_2',
            filename: 'pg.txt',
            type: 'TEXT',
            mimeType: 'text/plain',
            createdAt: '2026-09-02T00:00:00.000Z',
            capturedAt: '2026-09-02T00:00:00.000Z',
            summary: null,
          },
        }),
      ],
      { maxChunks: 6, maxChars: 8000 },
    );

    expect(context).toHaveLength(2);
    expect(context[0]?.ref).toBe(1);
    expect(context[0]?.chunkId).toBe('c1');
    expect(context[1]?.ref).toBe(2);
  });

  it('respects max chunk and character budgets by dropping lower hits', () => {
    const context = builder.build(
      [
        hit({ chunkId: 'c1', content: 'AAAA'.repeat(20) }),
        hit({ chunkId: 'c2', content: 'BBBB'.repeat(20) }),
        hit({ chunkId: 'c3', content: 'CCCC'.repeat(20) }),
      ],
      { maxChunks: 2, maxChars: 200 },
    );

    expect(context.length).toBeLessThanOrEqual(2);
    expect(context.every((item) => item.content.length > 0)).toBe(true);
    expect(
      context.reduce((sum, item) => sum + item.content.length, 0),
    ).toBeLessThanOrEqual(200);
  });
});
