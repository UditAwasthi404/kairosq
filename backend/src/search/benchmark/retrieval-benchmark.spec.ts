import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { ChunkEmbeddingService } from '../../embeddings/chunk-embedding.service';
import { LocalDeterministicEmbeddingProvider } from '../../embeddings/local-deterministic-embedding.provider';
import { VectorSearchService } from '../../embeddings/vector-search.service';
import { LexicalSearchService } from '../lexical-search.service';
import { SearchService } from '../search.service';
import {
  RETRIEVAL_BENCH_CLERK_USER,
  RETRIEVAL_BENCH_QUERIES,
  RETRIEVAL_FIXTURES,
  type RetrievalFixtureKey,
} from './retrieval-fixtures';
import {
  evaluateRankedResults,
  formatPercent,
  type QueryBenchmarkResult,
} from './retrieval-metrics';

/**
 * Phase 1 + Phase 2 retrieval benchmark.
 * Runs semantic-only and hybrid against the SAME fixtures/queries.
 *
 * Enable with:
 *   RUN_RETRIEVAL_BENCH=1
 * (or RUN_PGVECTOR_IT=1)
 */
const shouldRun =
  process.env.RUN_RETRIEVAL_BENCH === '1' ||
  process.env.RUN_PGVECTOR_IT === '1';

(shouldRun ? describe : describe.skip)(
  'retrieval benchmark (semantic vs hybrid)',
  () => {
    let prisma: PrismaClient;
    let provider: LocalDeterministicEmbeddingProvider;
    let vectorSearch: VectorSearchService;
    let lexicalSearch: LexicalSearchService;
    const clerkUserId = RETRIEVAL_BENCH_CLERK_USER;
    let userId = '';
    const keyToObservationId = new Map<RetrievalFixtureKey, string>();
    const observationIdToKey = new Map<string, RetrievalFixtureKey>();
    const baselineResults: QueryBenchmarkResult[] = [];
    const hybridResults: QueryBenchmarkResult[] = [];

    function buildSearchService(hybrid: boolean): SearchService {
      process.env.SEARCH_HYBRID_ENABLED = hybrid ? 'true' : 'false';
      process.env.SEARCH_SEMANTIC_CANDIDATES = '30';
      process.env.SEARCH_LEXICAL_CANDIDATES = '30';
      const users = {
        findOrCreateByClerkId: async (id: string) => {
          const found = await prisma.user.findUnique({
            where: { clerkUserId: id },
          });
          if (!found) throw new Error(`Bench user missing for ${id}`);
          return found;
        },
      };
      return new SearchService(
        users as never,
        prisma as never,
        vectorSearch,
        lexicalSearch,
        provider,
      );
    }

    async function runSuite(
      hybrid: boolean,
      sink: QueryBenchmarkResult[],
    ): Promise<void> {
      const searchService = buildSearchService(hybrid);
      sink.length = 0;
      for (const benchQuery of RETRIEVAL_BENCH_QUERIES) {
        const started = Date.now();
        const response = await searchService.search(clerkUserId, {
          query: benchQuery.query,
          limit: 10,
        });
        const latencyMs = Date.now() - started;
        const rankedObservationIds = response.results.map(
          (row) => row.observationId,
        );
        expect(
          rankedObservationIds.every((id) => observationIdToKey.has(id)),
        ).toBe(true);

        const relevantObservationIds = new Set(
          benchQuery.relevantKeys.map((key) => {
            const id = keyToObservationId.get(key);
            if (!id) throw new Error(`Missing fixture key ${key}`);
            return id;
          }),
        );

        sink.push(
          evaluateRankedResults({
            queryId: benchQuery.id,
            query: benchQuery.query,
            rankedObservationIds,
            rankedFilenames: response.results.map(
              (row) => row.observation.filename,
            ),
            relevantObservationIds,
            relevantKeys: benchQuery.relevantKeys,
            latencyMs,
          }),
        );
      }
    }

    beforeAll(async () => {
      process.env.EMBEDDING_DIMENSIONS = '1536';
      process.env.EMBEDDING_PROVIDER = 'local';
      process.env.SEARCH_MIN_SIMILARITY = '0.05';
      process.env.SEARCH_MAX_PER_OBSERVATION = '2';
      delete process.env.SEARCH_HYBRID_ENABLED;

      prisma = new PrismaClient();
      provider = new LocalDeterministicEmbeddingProvider();
      const embeddings = new ChunkEmbeddingService(prisma as never, provider);
      vectorSearch = new VectorSearchService(prisma as never, provider);
      lexicalSearch = new LexicalSearchService(prisma as never);

      const user = await prisma.user.upsert({
        where: { clerkUserId },
        create: { clerkUserId },
        update: {},
      });
      userId = user.id;
      await prisma.observation.deleteMany({ where: { userId } });

      for (const fixture of RETRIEVAL_FIXTURES) {
        const created = await prisma.observation.create({
          data: {
            userId,
            type: fixture.filename.endsWith('.pdf') ? 'PDF' : 'TEXT',
            originalFilename: fixture.filename,
            mimeType: fixture.filename.endsWith('.pdf')
              ? 'application/pdf'
              : 'text/plain',
            storageKey: `test/retrieval-bench/${userId}/${fixture.key}`,
            fileSizeBytes: fixture.content.length,
            processingStatus: 'COMPLETED',
            capturedAt: fixture.capturedAt
              ? new Date(fixture.capturedAt)
              : undefined,
            extractedText: fixture.content,
            summary: fixture.content.slice(0, 120),
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
        keyToObservationId.set(fixture.key, created.id);
        observationIdToKey.set(created.id, fixture.key);
        await embeddings.embedMissingChunks(created.id);
      }
    }, 120_000);

    afterAll(async () => {
      if (userId) {
        await prisma.observation
          .deleteMany({ where: { userId } })
          .catch(() => undefined);
      }
      delete process.env.SEARCH_HYBRID_ENABLED;
      await prisma?.$disconnect();
    });

    it('seeds the Phase 1 fixture corpus unchanged', () => {
      expect(RETRIEVAL_FIXTURES).toHaveLength(10);
      expect(keyToObservationId.size).toBe(10);
    });

    it('records semantic-only baseline (flag OFF)', async () => {
      await runSuite(false, baselineResults);
      expect(baselineResults).toHaveLength(RETRIEVAL_BENCH_QUERIES.length);
    });

    it('records hybrid results (flag ON)', async () => {
      await runSuite(true, hybridResults);
      expect(hybridResults).toHaveLength(RETRIEVAL_BENCH_QUERIES.length);
    });

    it('writes comparison artifact for docs/retrieval-benchmark.md', () => {
      expect(baselineResults).toHaveLength(RETRIEVAL_BENCH_QUERIES.length);
      expect(hybridResults).toHaveLength(RETRIEVAL_BENCH_QUERIES.length);

      const mean = (values: number[]) =>
        values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1);

      const comparison = RETRIEVAL_BENCH_QUERIES.map((q) => {
        const baseline = baselineResults.find((r) => r.queryId === q.id)!;
        const hybrid = hybridResults.find((r) => r.queryId === q.id)!;
        return {
          queryId: q.id,
          query: q.query,
          baselineRecallAt5: baseline.recallAt5,
          hybridRecallAt5: hybrid.recallAt5,
          baselineMrr: baseline.mrr,
          hybridMrr: hybrid.mrr,
          baselineLatencyMs: baseline.latencyMs,
          hybridLatencyMs: hybrid.latencyMs,
          baselineTop: baseline.topFilename,
          hybridTop: hybrid.topFilename,
          baselineRankedKeys: baseline.rankedObservationIds.map(
            (id) => observationIdToKey.get(id) ?? 'unknown',
          ),
          hybridRankedKeys: hybrid.rankedObservationIds.map(
            (id) => observationIdToKey.get(id) ?? 'unknown',
          ),
        };
      });

      const artifact = {
        generatedAt: new Date().toISOString(),
        dataset: {
          observations: RETRIEVAL_FIXTURES.length,
          chunks: RETRIEVAL_FIXTURES.length,
          clerkUserId: RETRIEVAL_BENCH_CLERK_USER,
        },
        baseline: {
          mode: 'semantic-only',
          meanRecallAt5: mean(baselineResults.map((r) => r.recallAt5)),
          meanRecallAt10: mean(baselineResults.map((r) => r.recallAt10)),
          meanMrr: mean(baselineResults.map((r) => r.mrr)),
          meanLatencyMs: mean(baselineResults.map((r) => r.latencyMs)),
          results: baselineResults,
        },
        hybrid: {
          mode: 'semantic+lexical+heuristic-fusion',
          meanRecallAt5: mean(hybridResults.map((r) => r.recallAt5)),
          meanRecallAt10: mean(hybridResults.map((r) => r.recallAt10)),
          meanMrr: mean(hybridResults.map((r) => r.mrr)),
          meanLatencyMs: mean(hybridResults.map((r) => r.latencyMs)),
          results: hybridResults,
        },
        comparison,
      };

      const outDir = join(__dirname, '..', '..', '..', 'test-artifacts');
      mkdirSync(outDir, { recursive: true });
      const outPath = join(outDir, 'retrieval-benchmark-phase2.json');
      writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');

      console.log('\n# Retrieval benchmark Phase 2 comparison\n');

      console.log(
        '| Query | Baseline R@5 | Hybrid R@5 | Baseline MRR | Hybrid MRR | Baseline Latency | Hybrid Latency |',
      );

      console.log('|---|---|---|---|---|---|---|');
      for (const row of comparison) {
        console.log(
          `| ${row.queryId}: ${row.query} | ${formatPercent(row.baselineRecallAt5)} | ${formatPercent(row.hybridRecallAt5)} | ${row.baselineMrr.toFixed(2)} | ${row.hybridMrr.toFixed(2)} | ${row.baselineLatencyMs} ms | ${row.hybridLatencyMs} ms |`,
        );
      }

      console.log(
        `\nMeans — baseline latency ${artifact.baseline.meanLatencyMs.toFixed(0)} ms, hybrid latency ${artifact.hybrid.meanLatencyMs.toFixed(0)} ms (Δ ${(artifact.hybrid.meanLatencyMs - artifact.baseline.meanLatencyMs).toFixed(0)} ms)`,
      );

      console.log(`Wrote ${outPath}`);
    });
  },
);
