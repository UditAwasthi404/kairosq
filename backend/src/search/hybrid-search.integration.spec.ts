import { PrismaClient } from '@prisma/client';
import { ChunkEmbeddingService } from '../embeddings/chunk-embedding.service';
import { LocalDeterministicEmbeddingProvider } from '../embeddings/local-deterministic-embedding.provider';
import { VectorSearchService } from '../embeddings/vector-search.service';
import { LexicalSearchService } from './lexical-search.service';
import { SearchService } from './search.service';

const shouldRun =
  process.env.RUN_RETRIEVAL_BENCH === '1' ||
  process.env.RUN_PGVECTOR_IT === '1';

(shouldRun ? describe : describe.skip)('hybrid search integration', () => {
  let prisma: PrismaClient;
  let provider: LocalDeterministicEmbeddingProvider;
  let userA = { id: '', clerkUserId: 'clerk_hybrid_a' };
  let userB = { id: '', clerkUserId: 'clerk_hybrid_b' };
  const observationIds: string[] = [];
  let redisObs = '';
  let fileObs = '';
  let urlObs = '';
  let configObs = '';
  let pgObs = '';
  let projectId = '';
  let topicId = '';
  let entityId = '';

  beforeAll(async () => {
    process.env.EMBEDDING_DIMENSIONS = '1536';
    process.env.EMBEDDING_PROVIDER = 'local';
    process.env.SEARCH_MIN_SIMILARITY = '0.05';
    process.env.SEARCH_MAX_PER_OBSERVATION = '2';
    process.env.SEARCH_HYBRID_ENABLED = 'true';
    process.env.SEARCH_SEMANTIC_CANDIDATES = '30';
    process.env.SEARCH_LEXICAL_CANDIDATES = '30';

    prisma = new PrismaClient();
    provider = new LocalDeterministicEmbeddingProvider();
    const embeddings = new ChunkEmbeddingService(prisma as never, provider);

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
    userA = { id: a.id, clerkUserId: userA.clerkUserId };
    userB = { id: b.id, clerkUserId: userB.clerkUserId };

    async function createObs(params: {
      userId: string;
      filename: string;
      content: string;
    }) {
      const created = await prisma.observation.create({
        data: {
          userId: params.userId,
          type: 'TEXT',
          originalFilename: params.filename,
          mimeType: 'text/plain',
          storageKey: `test/hybrid/${params.userId}/${params.filename}`,
          fileSizeBytes: params.content.length,
          processingStatus: 'COMPLETED',
          chunks: {
            create: {
              content: params.content,
              chunkIndex: 0,
              startOffset: 0,
              endOffset: params.content.length,
            },
          },
        },
      });
      observationIds.push(created.id);
      await embeddings.embedMissingChunks(created.id);
      return created.id;
    }

    redisObs = await createObs({
      userId: userA.id,
      filename: 'backend-stack.txt',
      content: 'The backend uses Redis for caching.',
    });
    fileObs = await createObs({
      userId: userA.id,
      filename: 'redis-production-config.pdf',
      content:
        'Production Redis configuration uses maxmemory-policy allkeys-lru.',
    });
    urlObs = await createObs({
      userId: userA.id,
      filename: 'bookmarks.txt',
      content:
        'Useful reference: https://redis.io/docs/latest/develop/data-types/',
    });
    configObs = fileObs;
    pgObs = await createObs({
      userId: userA.id,
      filename: 'postgres-caching.txt',
      content:
        'PostgreSQL caching strategies can reduce database load for frequently accessed information.',
    });
    await createObs({
      userId: userB.id,
      filename: 'secret-redis.txt',
      content: 'User B private Redis notes must never leak.',
    });

    const topic = await prisma.topic.create({
      data: {
        userId: userA.id,
        name: 'Caching',
        normalizedName: 'caching',
      },
    });
    topicId = topic.id;
    await prisma.observationTopic.create({
      data: { observationId: redisObs, topicId },
    });

    const entity = await prisma.entity.create({
      data: {
        userId: userA.id,
        name: 'Redis',
        normalizedName: 'redis',
        type: 'TECHNOLOGY',
      },
    });
    entityId = entity.id;
    await prisma.observationEntity.create({
      data: { observationId: redisObs, entityId },
    });

    const project = await prisma.project.create({
      data: {
        userId: userA.id,
        name: 'Hybrid Bench',
        description: null,
      },
    });
    projectId = project.id;
    await prisma.projectObservation.create({
      data: { projectId, observationId: redisObs },
    });
  }, 120_000);

  afterAll(async () => {
    for (const id of observationIds) {
      await prisma.observation.delete({ where: { id } }).catch(() => undefined);
    }
    if (topicId)
      await prisma.topic
        .delete({ where: { id: topicId } })
        .catch(() => undefined);
    if (entityId)
      await prisma.entity
        .delete({ where: { id: entityId } })
        .catch(() => undefined);
    if (projectId)
      await prisma.project
        .delete({ where: { id: projectId } })
        .catch(() => undefined);
    delete process.env.SEARCH_HYBRID_ENABLED;
    await prisma?.$disconnect();
  });

  function buildService(): SearchService {
    const users = {
      findOrCreateByClerkId: async (clerkUserId: string) =>
        prisma.user.findUniqueOrThrow({ where: { clerkUserId } }),
    };
    return new SearchService(
      users as never,
      prisma as never,
      new VectorSearchService(prisma as never, provider),
      new LexicalSearchService(prisma as never),
      provider,
    );
  }

  it('ranks Redis keyword observations for exact Redis query', async () => {
    const service = buildService();
    const response = await service.search(userA.clerkUserId, {
      query: 'Redis',
      limit: 10,
    });
    expect(response.results.some((r) => r.observationId === redisObs)).toBe(
      true,
    );
  });

  it('finds filename observation for redis-production-config.pdf', async () => {
    const service = buildService();
    const response = await service.search(userA.clerkUserId, {
      query: 'redis-production-config.pdf',
      limit: 5,
    });
    expect(response.results[0]?.observationId).toBe(fileObs);
  });

  it('finds configuration phrase observation', async () => {
    const service = buildService();
    const response = await service.search(userA.clerkUserId, {
      query: 'maxmemory-policy allkeys-lru',
      limit: 5,
    });
    expect(response.results[0]?.observationId).toBe(configObs);
  });

  it('finds URL observation for redis.io', async () => {
    const service = buildService();
    const response = await service.search(userA.clerkUserId, {
      query: 'redis.io',
      limit: 5,
    });
    expect(response.results.some((r) => r.observationId === urlObs)).toBe(true);
  });

  it('keeps semantic Redis usage query working without postgres dominance', async () => {
    const service = buildService();
    const response = await service.search(userA.clerkUserId, {
      query: 'What did I use Redis for?',
      limit: 5,
    });
    expect(response.results[0]?.observationId).not.toBe(pgObs);
    expect(response.results.some((r) => r.observationId === redisObs)).toBe(
      true,
    );
  });

  it('respects project/topic/entity filters on hybrid path', async () => {
    const service = buildService();
    const byProject = await service.search(userA.clerkUserId, {
      query: 'Redis',
      limit: 10,
      filters: { projectId },
    });
    expect(byProject.results.every((r) => r.observationId === redisObs)).toBe(
      true,
    );

    const byTopic = await service.search(userA.clerkUserId, {
      query: 'Redis',
      limit: 10,
      filters: { topicId },
    });
    expect(byTopic.results.every((r) => r.observationId === redisObs)).toBe(
      true,
    );

    const byEntity = await service.search(userA.clerkUserId, {
      query: 'Redis',
      limit: 10,
      filters: { entityId },
    });
    expect(byEntity.results.every((r) => r.observationId === redisObs)).toBe(
      true,
    );
  });

  it('never returns another user lexical/semantic hits', async () => {
    const service = buildService();
    const response = await service.search(userA.clerkUserId, {
      query: 'Redis',
      limit: 20,
    });
    const owned = new Set(
      (
        await prisma.observation.findMany({
          where: { userId: userA.id },
          select: { id: true },
        })
      ).map((o) => o.id),
    );
    expect(response.results.every((r) => owned.has(r.observationId))).toBe(
      true,
    );
    expect(
      response.results.some(
        (r) => r.observation.filename === 'secret-redis.txt',
      ),
    ).toBe(false);
  });
});
