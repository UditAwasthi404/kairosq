import { BadRequestException } from '@nestjs/common';
import { SearchService } from './search.service';

describe('SearchService', () => {
  function buildService(overrides?: {
    hits?: Array<{
      chunkId: string;
      observationId: string;
      chunkIndex: number;
      content: string;
      distance: number;
      similarity: number;
    }>;
  }) {
    const user = { id: 'user_a', clerkUserId: 'clerk_a' };
    const users = {
      findOrCreateByClerkId: jest.fn().mockResolvedValue(user),
    };
    const prisma = {
      observation: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'obs_1',
            originalFilename: 'redis.txt',
            type: 'TEXT',
            mimeType: 'text/plain',
            createdAt: new Date('2026-09-01T00:00:00.000Z'),
            capturedAt: new Date('2026-09-01T00:00:00.000Z'),
            summary: 'About Redis',
          },
        ]),
      },
    };
    const vectorSearch = {
      search: jest.fn().mockResolvedValue(
        overrides?.hits ?? [
          {
            chunkId: 'chunk_1',
            observationId: 'obs_1',
            chunkIndex: 0,
            content: 'Redis is an in-memory data structure store.',
            distance: 0.1,
            similarity: 0.9,
          },
        ],
      ),
    };
    const lexicalSearch = {
      search: jest.fn().mockResolvedValue([]),
    };
    const embeddings = {
      name: 'test',
      model: 'test-model',
      dimensions: 1536,
      isConfigured: () => true,
      embedText: jest.fn().mockResolvedValue({
        embedding: Array.from({ length: 1536 }, () => 0.01),
        model: 'test-model',
        dimensions: 1536,
      }),
      embedTexts: jest.fn(),
    };

    const service = new SearchService(
      users as never,
      prisma as never,
      vectorSearch as never,
      lexicalSearch as never,
      embeddings,
    );

    return { service, users, prisma, vectorSearch, lexicalSearch, embeddings };
  }

  it('rejects empty queries via validation', async () => {
    const { service } = buildService();
    await expect(
      service.search('clerk_a', { query: '' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('embeds once and scopes search to the authenticated user', async () => {
    const { service, users, vectorSearch, embeddings } = buildService();
    const response = await service.search('clerk_a', {
      query: 'What did I learn about Redis?',
      limit: 5,
    });

    expect(users.findOrCreateByClerkId).toHaveBeenCalledWith('clerk_a');
    expect(embeddings.embedText).toHaveBeenCalledTimes(1);
    expect(vectorSearch.search).toHaveBeenCalledWith(
      'user_a',
      expect.any(Array),
      expect.objectContaining({
        minSimilarity: expect.any(Number),
      }),
    );
    expect(response.results[0]?.observation.filename).toBe('redis.txt');
    expect(response.total).toBe(1);
  });

  it('returns empty results when nothing is relevant', async () => {
    const { service } = buildService({ hits: [] });
    const response = await service.search('clerk_a', {
      query: 'unrelated astronomy notes',
    });
    expect(response.results).toEqual([]);
    expect(response.total).toBe(0);
  });

  it('caps results per observation', async () => {
    process.env.SEARCH_MAX_PER_OBSERVATION = '1';
    const { service, prisma } = buildService({
      hits: [
        {
          chunkId: 'c1',
          observationId: 'obs_1',
          chunkIndex: 0,
          content: 'Redis caching',
          distance: 0.1,
          similarity: 0.9,
        },
        {
          chunkId: 'c2',
          observationId: 'obs_1',
          chunkIndex: 1,
          content: 'Redis temporary data',
          distance: 0.12,
          similarity: 0.88,
        },
      ],
    });

    const response = await service.search('clerk_a', {
      query: 'temporary backend speed',
      limit: 10,
    });

    expect(response.results).toHaveLength(1);
    expect(prisma.observation.findMany).toHaveBeenCalled();
    delete process.env.SEARCH_MAX_PER_OBSERVATION;
  });

  it('respects result limit after per-observation capping', async () => {
    process.env.SEARCH_MAX_PER_OBSERVATION = '2';
    const { service, prisma } = buildService({
      hits: [
        {
          chunkId: 'c1',
          observationId: 'obs_1',
          chunkIndex: 0,
          content: 'first',
          distance: 0.1,
          similarity: 0.9,
        },
        {
          chunkId: 'c2',
          observationId: 'obs_2',
          chunkIndex: 0,
          content: 'second',
          distance: 0.2,
          similarity: 0.8,
        },
        {
          chunkId: 'c3',
          observationId: 'obs_3',
          chunkIndex: 0,
          content: 'third',
          distance: 0.3,
          similarity: 0.7,
        },
      ],
    });
    prisma.observation.findMany.mockResolvedValue([
      {
        id: 'obs_1',
        originalFilename: 'a.txt',
        type: 'TEXT',
        mimeType: 'text/plain',
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
        capturedAt: new Date('2026-09-01T00:00:00.000Z'),
        summary: null,
      },
      {
        id: 'obs_2',
        originalFilename: 'b.txt',
        type: 'TEXT',
        mimeType: 'text/plain',
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
        capturedAt: new Date('2026-09-01T00:00:00.000Z'),
        summary: null,
      },
    ]);

    const response = await service.search('clerk_a', {
      query: 'limit check',
      limit: 2,
    });

    expect(response.results).toHaveLength(2);
    expect(response.results.map((r) => r.chunkId)).toEqual(['c1', 'c2']);
    delete process.env.SEARCH_MAX_PER_OBSERVATION;
  });

  it('passes configured similarity threshold to vector search', async () => {
    process.env.SEARCH_MIN_SIMILARITY = '0.42';
    const { service, vectorSearch } = buildService({ hits: [] });
    await service.search('clerk_a', { query: 'threshold check' });
    expect(vectorSearch.search).toHaveBeenCalledWith(
      'user_a',
      expect.any(Array),
      expect.objectContaining({ minSimilarity: 0.42 }),
    );
    delete process.env.SEARCH_MIN_SIMILARITY;
  });

  it('does not call lexical search when SEARCH_HYBRID_ENABLED is off', async () => {
    delete process.env.SEARCH_HYBRID_ENABLED;
    const { service, lexicalSearch } = buildService();
    await service.search('clerk_a', { query: 'Redis' });
    expect(lexicalSearch.search).not.toHaveBeenCalled();
  });

  it('calls lexical search and fuses when SEARCH_HYBRID_ENABLED is on', async () => {
    process.env.SEARCH_HYBRID_ENABLED = 'true';
    process.env.SEARCH_SEMANTIC_CANDIDATES = '30';
    process.env.SEARCH_LEXICAL_CANDIDATES = '30';
    const { service, vectorSearch, lexicalSearch, prisma } = buildService({
      hits: [
        {
          chunkId: 'c_sem',
          observationId: 'obs_1',
          chunkIndex: 0,
          content: 'PostgreSQL caching strategies',
          distance: 0.4,
          similarity: 0.6,
        },
      ],
    });
    lexicalSearch.search.mockResolvedValue([
      {
        chunkId: 'c_sem',
        observationId: 'obs_1',
        chunkIndex: 0,
        content: 'The backend uses Redis for caching.',
        filename: 'backend-stack.txt',
        ftsRank: 0.4,
        filenameMatch: false,
        contentExactMatch: true,
      },
    ]);
    prisma.observation.findMany.mockResolvedValue([
      {
        id: 'obs_1',
        originalFilename: 'backend-stack.txt',
        type: 'TEXT',
        mimeType: 'text/plain',
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
        capturedAt: new Date('2026-09-01T00:00:00.000Z'),
        summary: null,
      },
    ]);

    const response = await service.search('clerk_a', {
      query: 'Redis',
      limit: 5,
    });

    expect(lexicalSearch.search).toHaveBeenCalledWith(
      'user_a',
      'Redis',
      expect.objectContaining({ limit: 30 }),
    );
    expect(vectorSearch.search).toHaveBeenCalled();
    expect(response.results.length).toBeGreaterThan(0);
    // Same observation from both branches must appear once after dedupe+cap.
    expect(new Set(response.results.map((r) => r.chunkId)).size).toBe(
      response.results.length,
    );

    delete process.env.SEARCH_HYBRID_ENABLED;
    delete process.env.SEARCH_SEMANTIC_CANDIDATES;
    delete process.env.SEARCH_LEXICAL_CANDIDATES;
  });
});
