import { Inject, Injectable, Logger } from '@nestjs/common';
import type { CaptureSource, ObservationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EMBEDDING_PROVIDER, type EmbeddingProvider } from './embedding.types';
import {
  toPgVectorLiteral,
  validateEmbeddingVector,
} from './embedding.validation';

export type VectorSearchHit = {
  chunkId: string;
  observationId: string;
  chunkIndex: number;
  content: string;
  distance: number;
  similarity: number;
};

export type VectorSearchFilters = {
  observationType?: ObservationType;
  mimeType?: string;
  from?: Date;
  to?: Date;
  topicId?: string;
  entityId?: string;
  projectId?: string;
  source?: CaptureSource;
  observationId?: string;
  excludeObservationId?: string;
};

export type VectorSearchOptions = {
  limit?: number;
  /** Over-fetch before caller-side dedupe/threshold. */
  candidateLimit?: number;
  minSimilarity?: number;
  filters?: VectorSearchFilters;
};

@Injectable()
export class VectorSearchService {
  private readonly logger = new Logger(VectorSearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMBEDDING_PROVIDER) private readonly embeddings: EmbeddingProvider,
  ) {}

  async search(
    userId: string,
    queryEmbedding: number[],
    options: VectorSearchOptions = {},
  ): Promise<VectorSearchHit[]> {
    if (!userId) {
      throw new Error('userId is required for vector search');
    }

    const vector = validateEmbeddingVector(
      queryEmbedding,
      this.embeddings.dimensions,
    );
    const limit = Math.min(
      Math.max(options.candidateLimit ?? options.limit ?? 8, 1),
      100,
    );
    const literal = toPgVectorLiteral(vector);
    const minSimilarity = options.minSimilarity;
    const maxDistance =
      typeof minSimilarity === 'number'
        ? Math.max(0, Math.min(2, 1 - minSimilarity))
        : undefined;

    const params: unknown[] = [literal, userId, this.embeddings.model];
    let idx = 4;
    const where: string[] = [
      'o."userId" = $2',
      `o."processingStatus" = 'COMPLETED'`,
      'c.embedding IS NOT NULL',
      'c."embeddingModel" = $3',
    ];

    const filters = options.filters ?? {};
    if (filters.observationType) {
      where.push(`o.type = $${idx}`);
      params.push(filters.observationType);
      idx += 1;
    }
    if (filters.mimeType) {
      where.push(`o."mimeType" = $${idx}`);
      params.push(filters.mimeType);
      idx += 1;
    }
    if (filters.from) {
      where.push(`o."capturedAt" >= $${idx}`);
      params.push(filters.from);
      idx += 1;
    }
    if (filters.to) {
      where.push(`o."capturedAt" <= $${idx}`);
      params.push(filters.to);
      idx += 1;
    }
    if (filters.topicId) {
      where.push(`EXISTS (
        SELECT 1 FROM observation_topics ot
        WHERE ot."observationId" = o.id AND ot."topicId" = $${idx}
      )`);
      params.push(filters.topicId);
      idx += 1;
    }
    if (filters.entityId) {
      where.push(`EXISTS (
        SELECT 1 FROM observation_entities oe
        WHERE oe."observationId" = o.id AND oe."entityId" = $${idx}
      )`);
      params.push(filters.entityId);
      idx += 1;
    }
    if (filters.projectId) {
      where.push(`EXISTS (
        SELECT 1 FROM project_observations po
        WHERE po."observationId" = o.id AND po."projectId" = $${idx}
      )`);
      params.push(filters.projectId);
      idx += 1;
    }
    if (filters.source) {
      where.push(`o.source = $${idx}`);
      params.push(filters.source);
      idx += 1;
    }
    if (filters.observationId) {
      where.push(`o.id = $${idx}`);
      params.push(filters.observationId);
      idx += 1;
    }
    if (filters.excludeObservationId) {
      where.push(`o.id <> $${idx}`);
      params.push(filters.excludeObservationId);
      idx += 1;
    }
    if (maxDistance !== undefined) {
      where.push(`(c.embedding <=> $1::vector) <= $${idx}`);
      params.push(maxDistance);
      idx += 1;
    }

    params.push(limit);
    const limitParam = idx;

    const sql = `
      SELECT
        c.id AS "chunkId",
        c."observationId" AS "observationId",
        c."chunkIndex" AS "chunkIndex",
        c.content AS content,
        (c.embedding <=> $1::vector) AS distance
      FROM observation_chunks c
      INNER JOIN observations o ON o.id = c."observationId"
      WHERE ${where.join(' AND ')}
      ORDER BY c.embedding <=> $1::vector ASC
      LIMIT $${limitParam}
    `;

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        chunkId: string;
        observationId: string;
        chunkIndex: number;
        content: string;
        distance: number;
      }>
    >(sql, ...params);

    this.logger.log(
      JSON.stringify({
        event: 'vector_search',
        userId,
        limit,
        resultCount: rows.length,
        hasFilters: Object.keys(filters).length > 0,
      }),
    );

    return rows.map((row) => ({
      chunkId: row.chunkId,
      observationId: row.observationId,
      chunkIndex: row.chunkIndex,
      content: row.content,
      distance: Number(row.distance),
      similarity: 1 - Number(row.distance),
    }));
  }

  async searchText(
    userId: string,
    query: string,
    options: VectorSearchOptions = {},
  ): Promise<VectorSearchHit[]> {
    if (!this.embeddings.isConfigured()) {
      throw new Error('Embedding provider is not configured');
    }
    const trimmed = query.trim();
    if (!trimmed) {
      return [];
    }
    const embedded = await this.embeddings.embedText(trimmed);
    return this.search(userId, embedded.embedding, options);
  }
}
