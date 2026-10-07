import { PrismaClient } from '@prisma/client';
import { ChunkEmbeddingService } from './chunk-embedding.service';
import { LocalDeterministicEmbeddingProvider } from './local-deterministic-embedding.provider';
import { VectorSearchService } from './vector-search.service';

const shouldRun = process.env.RUN_PGVECTOR_IT === '1';

(shouldRun ? describe : describe.skip)('pgvector integration', () => {
  let prisma: PrismaClient;
  let provider: LocalDeterministicEmbeddingProvider;
  let embeddings: ChunkEmbeddingService;
  let search: VectorSearchService;

  const userA = { id: '', clerkUserId: 'clerk_vec_a' };
  const userB = { id: '', clerkUserId: 'clerk_vec_b' };
  let obsA = '';
  let obsB = '';
  let sharedId = '';

  beforeAll(async () => {
    process.env.EMBEDDING_DIMENSIONS = '1536';
    process.env.EMBEDDING_PROVIDER = 'local';

    prisma = new PrismaClient();
    provider = new LocalDeterministicEmbeddingProvider();
    embeddings = new ChunkEmbeddingService(prisma as never, provider);
    search = new VectorSearchService(prisma as never, provider);

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

    const createdA = await prisma.observation.create({
      data: {
        userId: userA.id,
        type: 'TEXT',
        originalFilename: 'pg.txt',
        mimeType: 'text/plain',
        storageKey: `test/${userA.id}/pg.txt`,
        fileSizeBytes: 100,
        processingStatus: 'COMPLETED',
        chunks: {
          create: {
            content:
              'PostgreSQL can use pgvector to store and search embedding vectors.',
            chunkIndex: 0,
            startOffset: 0,
            endOffset: 70,
          },
        },
      },
    });
    const createdB = await prisma.observation.create({
      data: {
        userId: userB.id,
        type: 'TEXT',
        originalFilename: 'rn.txt',
        mimeType: 'text/plain',
        storageKey: `test/${userB.id}/rn.txt`,
        fileSizeBytes: 100,
        processingStatus: 'COMPLETED',
        chunks: {
          create: {
            content:
              'React Native is a framework for building mobile applications.',
            chunkIndex: 0,
            startOffset: 0,
            endOffset: 70,
          },
        },
      },
    });
    obsA = createdA.id;
    obsB = createdB.id;

    await embeddings.embedMissingChunks(obsA);
    await embeddings.embedMissingChunks(obsB);
  }, 60_000);

  afterAll(async () => {
    if (sharedId) {
      await prisma.observation
        .delete({ where: { id: sharedId } })
        .catch(() => undefined);
    }
    if (obsA)
      await prisma.observation
        .delete({ where: { id: obsA } })
        .catch(() => undefined);
    if (obsB)
      await prisma.observation
        .delete({ where: { id: obsB } })
        .catch(() => undefined);
    await prisma?.$disconnect();
  });

  it('stores embeddings idempotently', async () => {
    const second = await embeddings.embedMissingChunks(obsA);
    expect(second.newlyEmbedded).toBe(0);
    expect(second.alreadyEmbedded).toBeGreaterThan(0);
  });

  it('ranks related chunk higher for a semantic query', async () => {
    const shared = await prisma.observation.create({
      data: {
        userId: userA.id,
        type: 'TEXT',
        originalFilename: 'rn-shared.txt',
        mimeType: 'text/plain',
        storageKey: `test/${userA.id}/rn-shared.txt`,
        fileSizeBytes: 80,
        processingStatus: 'COMPLETED',
        chunks: {
          create: {
            content:
              'React Native is a framework for building mobile applications.',
            chunkIndex: 0,
            startOffset: 0,
            endOffset: 70,
          },
        },
      },
    });
    sharedId = shared.id;
    await embeddings.embedMissingChunks(shared.id);

    const hits = await search.searchText(
      userA.id,
      'How can PostgreSQL store AI vectors?',
      { limit: 5 },
    );

    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.content.toLowerCase()).toContain('postgresql');
    for (let i = 1; i < hits.length; i += 1) {
      expect(hits[i - 1].distance).toBeLessThanOrEqual(hits[i].distance);
    }
  });

  it('enforces user isolation', async () => {
    const hits = await search.searchText(
      userB.id,
      'How can PostgreSQL store AI vectors?',
      { limit: 5 },
    );
    expect(hits.every((hit) => hit.observationId === obsB)).toBe(true);
    expect(hits.some((hit) => hit.observationId === obsA)).toBe(false);
  });

  it('respects result limits', async () => {
    const hits = await search.searchText(userA.id, 'PostgreSQL vectors', {
      limit: 1,
    });
    expect(hits).toHaveLength(1);
  });
});
