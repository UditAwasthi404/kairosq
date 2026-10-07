import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  EMBEDDING_PROVIDER,
  readEmbeddingConfig,
  type EmbeddingProvider,
} from './embedding.types';
import {
  isNonEmptyChunkContent,
  toPgVectorLiteral,
  validateEmbeddingVector,
} from './embedding.validation';

type ChunkRow = {
  id: string;
  content: string;
  hasEmbedding: boolean;
  embeddingModel: string | null;
};

@Injectable()
export class ChunkEmbeddingService {
  private readonly logger = new Logger(ChunkEmbeddingService.name);
  private readonly batchSize: number;
  private readonly expectedModel: string;
  private readonly expectedDimensions: number;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMBEDDING_PROVIDER) private readonly embeddings: EmbeddingProvider,
  ) {
    const config = readEmbeddingConfig();
    this.batchSize = config.batchSize;
    this.expectedModel = this.embeddings.model;
    this.expectedDimensions = this.embeddings.dimensions;
  }

  async embedMissingChunks(observationId: string): Promise<{
    totalEligible: number;
    alreadyEmbedded: number;
    newlyEmbedded: number;
  }> {
    if (!this.embeddings.isConfigured()) {
      throw new Error('Embedding provider is not configured');
    }

    const started = Date.now();
    const rows = await this.prisma.$queryRaw<ChunkRow[]>`
      SELECT
        id,
        content,
        (embedding IS NOT NULL) AS "hasEmbedding",
        "embeddingModel"
      FROM observation_chunks
      WHERE "observationId" = ${observationId}
      ORDER BY "chunkIndex" ASC
    `;

    const eligible = rows.filter((row) => isNonEmptyChunkContent(row.content));
    const pending = eligible.filter(
      (row) =>
        !row.hasEmbedding ||
        !row.embeddingModel ||
        row.embeddingModel !== this.expectedModel,
    );
    const alreadyEmbedded = eligible.length - pending.length;

    this.logger.log(
      JSON.stringify({
        event: 'embedding_started',
        observationId,
        eligible: eligible.length,
        pending: pending.length,
        alreadyEmbedded,
        batchSize: this.batchSize,
        provider: this.embeddings.name,
        model: this.expectedModel,
        dimensions: this.expectedDimensions,
      }),
    );

    let newlyEmbedded = 0;
    for (let i = 0; i < pending.length; i += this.batchSize) {
      const batch = pending.slice(i, i + this.batchSize);
      const results = await this.embeddings.embedTexts(
        batch.map((row) => row.content),
      );

      if (results.length !== batch.length) {
        throw new Error('Embedding batch size mismatch');
      }

      for (let j = 0; j < batch.length; j += 1) {
        const chunk = batch[j];
        const result = results[j];
        const vector = validateEmbeddingVector(
          result.embedding,
          this.expectedDimensions,
        );
        if (result.model !== this.expectedModel) {
          throw new Error(
            `Embedding model mismatch: expected ${this.expectedModel}, got ${result.model}`,
          );
        }

        const literal = toPgVectorLiteral(vector);
        await this.prisma.$executeRawUnsafe(
          `UPDATE observation_chunks
           SET embedding = $1::vector,
               "embeddingModel" = $2,
               "embeddedAt" = NOW()
           WHERE id = $3`,
          literal,
          result.model,
          chunk.id,
        );
        newlyEmbedded += 1;
      }

      this.logger.log(
        JSON.stringify({
          event: 'embedding_batch_completed',
          observationId,
          batchIndex: Math.floor(i / this.batchSize) + 1,
          batchSize: batch.length,
        }),
      );
    }

    const missing = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM observation_chunks
      WHERE "observationId" = ${observationId}
        AND LENGTH(TRIM(content)) > 0
        AND (
          embedding IS NULL
          OR "embeddingModel" IS DISTINCT FROM ${this.expectedModel}
        )
    `;
    const missingCount = Number(missing[0]?.count ?? 0);
    if (missingCount > 0) {
      throw new Error(
        `Embedding incomplete: ${missingCount} eligible chunks still missing vectors`,
      );
    }

    this.logger.log(
      JSON.stringify({
        event: 'embedding_completed',
        observationId,
        newlyEmbedded,
        alreadyEmbedded,
        durationMs: Date.now() - started,
      }),
    );

    return {
      totalEligible: eligible.length,
      alreadyEmbedded,
      newlyEmbedded,
    };
  }
}
