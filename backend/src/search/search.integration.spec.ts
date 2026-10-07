import { PrismaClient } from '@prisma/client';
import { ChunkEmbeddingService } from '../embeddings/chunk-embedding.service';
import { LocalDeterministicEmbeddingProvider } from '../embeddings/local-deterministic-embedding.provider';
import { VectorSearchService } from '../embeddings/vector-search.service';
import { LexicalSearchService } from './lexical-search.service';
import { SearchService } from './search.service';

const shouldRun = process.env.RUN_PGVECTOR_IT === '1';

(shouldRun ? describe : describe.skip)('semantic search integration', () => {
  let prisma: PrismaClient;
  let provider: LocalDeterministicEmbeddingProvider;
  let embeddings: ChunkEmbeddingService;
  let searchService: SearchService;

  const userA = { id: '', clerkUserId: 'clerk_search_a' };
  const userB = { id: '', clerkUserId: 'clerk_search_b' };
  const observationIds: string[] = [];

  beforeAll(async () => {
    process.env.EMBEDDING_DIMENSIONS = '1536';
    process.env.EMBEDDING_PROVIDER = 'local';
    process.env.SEARCH_MIN_SIMILARITY = '0.05';
    process.env.SEARCH_MAX_PER_OBSERVATION = '2';

    prisma = new PrismaClient();
    provider = new LocalDeterministicEmbeddingProvider();
    embeddings = new ChunkEmbeddingService(prisma as never, provider);
    const vectorSearch = new VectorSearchService(prisma as never, provider);
    const lexicalSearch = new LexicalSearchService(prisma as never);

    const users = {
      findOrCreateByClerkId: async (clerkUserId: string) => {
        const user = await prisma.user.findUnique({ where: { clerkUserId } });
        if (!user) {
          throw new Error(`User not found for ${clerkUserId}`);
        }
        return user;
      },
    };

    searchService = new SearchService(
      users as never,
      prisma as never,
      vectorSearch,
      lexicalSearch,
      provider,
    );

    const a = await prisma.user.upsert({
      where: { clerkUserId: userA.clerkUserId },
      create: { clerkUserId: userA.clerkUserId },
      update: {},
    });
    const b = await prisma.user.upsert({
      where: { clerkUserId: userB.clerkUserId },
      create: { clerkUserId: userB.clerkUserId },
      update: {},
    });
    userA.id = a.id;
    userB.id = b.id;

    const fixtures: Array<{
      userId: string;
      filename: string;
      content: string;
    }> = [
      {
        userId: userA.id,
        filename: 'redis.txt',
        content:
          'Redis is an in-memory data structure store commonly used for caching and fast temporary data.',
      },
      {
        userId: userA.id,
        filename: 'postgres.txt',
        content:
          'PostgreSQL is a relational database used for persistent structured data.',
      },
      {
        userId: userA.id,
        filename: 'react-native.txt',
        content: 'React Native allows developers to build mobile applications.',
      },
      {
        userId: userB.id,
        filename: 'postgres-b.txt',
        content: 'PostgreSQL is a relational database.',
      },
    ];

    for (const fixture of fixtures) {
      const created = await prisma.observation.create({
        data: {
          userId: fixture.userId,
          type: 'TEXT',
          originalFilename: fixture.filename,
          mimeType: 'text/plain',
          storageKey: `test/${fixture.userId}/${fixture.filename}`,
          fileSizeBytes: fixture.content.length,
          processingStatus: 'COMPLETED',
          chunks: {
            create: {
              content: fixture.content,
              chunkIndex: 0,
              startOffset: 0,
              endOffset: fixture.content.length,
            },
          },
        },
      });
      observationIds.push(created.id);
      await embeddings.embedMissingChunks(created.id);
    }
  }, 60_000);

  afterAll(async () => {
    for (const id of observationIds) {
      await prisma.observation.delete({ where: { id } }).catch(() => undefined);
    }
    await prisma?.$disconnect();
  });

  it('returns Redis for User A and never User B postgres', async () => {
    const response = await searchService.search(userA.clerkUserId, {
      query: 'What did I learn about Redis?',
      limit: 10,
    });

    expect(response.results.length).toBeGreaterThan(0);
    expect(response.results[0]?.content.toLowerCase()).toContain('redis');
    expect(
      response.results.every(
        (r) => r.observation.filename !== 'postgres-b.txt',
      ),
    ).toBe(true);
    const ownedIds = new Set(
      (
        await prisma.observation.findMany({
          where: { userId: userA.id },
          select: { id: true },
        })
      ).map((o) => o.id),
    );
    expect(response.results.every((r) => ownedIds.has(r.observationId))).toBe(
      true,
    );
  });

  it('ranks caching/temporary-data memory highly for backend-speed query', async () => {
    const response = await searchService.search(userA.clerkUserId, {
      query: 'How can I make my backend faster using temporary data?',
      limit: 5,
    });

    expect(response.results.length).toBeGreaterThan(0);
    expect(response.results[0]?.observation.filename).toBe('redis.txt');
  });

  it('returns empty results when nothing clears the threshold', async () => {
    const previous = process.env.SEARCH_MIN_SIMILARITY;
    process.env.SEARCH_MIN_SIMILARITY = '0.999';
    const strict = new SearchService(
      {
        findOrCreateByClerkId: async () =>
          prisma.user.findUniqueOrThrow({
            where: { clerkUserId: userA.clerkUserId },
          }),
      } as never,
      prisma as never,
      new VectorSearchService(prisma as never, provider),
      new LexicalSearchService(prisma as never),
      provider,
    );

    const response = await strict.search(userA.clerkUserId, {
      query: 'completely unrelated quantum xylophone poetry',
      limit: 5,
    });
    expect(response.results).toEqual([]);

    process.env.SEARCH_MIN_SIMILARITY = previous;
  });
});
