import { Injectable, Logger } from '@nestjs/common';
import type { CaptureSource, ObservationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { escapeIlikePattern, normalizeLexicalQuery } from './lexical-query';

export type LexicalSearchFilters = {
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

export type LexicalSearchHit = {
  chunkId: string;
  observationId: string;
  chunkIndex: number;
  content: string;
  filename: string;
  /** Raw ts_rank_cd (may be 0 when only ILIKE matched) */
  ftsRank: number;
  filenameMatch: boolean;
  contentExactMatch: boolean;
};

@Injectable()
export class LexicalSearchService {
  private readonly logger = new Logger(LexicalSearchService.name);

  constructor(private readonly prisma: PrismaService) {}

  async search(
    userId: string,
    query: string,
    options: {
      limit?: number;
      filters?: LexicalSearchFilters;
    } = {},
  ): Promise<LexicalSearchHit[]> {
    if (!userId) {
      throw new Error('userId is required for lexical search');
    }

    const normalized = normalizeLexicalQuery(query);
    if (!normalized.needle) {
      return [];
    }

    const limit = Math.min(Math.max(options.limit ?? 30, 1), 100);
    const filters = options.filters ?? {};
    const params: unknown[] = [];
    let idx = 1;
    const where: string[] = [];

    where.push(`o."userId" = $${idx}`);
    params.push(userId);
    idx += 1;

    where.push(`o."processingStatus" = 'COMPLETED'`);

    let ftsParam: number | null = null;
    const matchClauses: string[] = [];

    if (normalized.ftsInput.length > 0) {
      ftsParam = idx;
      matchClauses.push(`
        to_tsvector('simple', c.content || ' ' || o."originalFilename")
        @@ plainto_tsquery('simple', $${ftsParam})
      `);
      params.push(normalized.ftsInput);
      idx += 1;
    }

    const ilikeParam = idx;
    const ilikeNeedle = `%${escapeIlikePattern(normalized.needle)}%`;
    matchClauses.push(`o."originalFilename" ILIKE $${ilikeParam} ESCAPE '\\'`);
    params.push(ilikeNeedle);
    idx += 1;

    if (normalized.needle.length >= 3) {
      matchClauses.push(`c.content ILIKE $${ilikeParam} ESCAPE '\\'`);
    }

    where.push(`(${matchClauses.join(' OR ')})`);

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

    const ftsRankExpr =
      ftsParam != null
        ? `ts_rank_cd(
            to_tsvector('simple', c.content || ' ' || o."originalFilename"),
            plainto_tsquery('simple', $${ftsParam})
          )`
        : '0::float';

    const limitParam = idx;
    params.push(limit);

    const sql = `
      SELECT * FROM (
        SELECT
          c.id AS "chunkId",
          c."observationId" AS "observationId",
          c."chunkIndex" AS "chunkIndex",
          c.content AS content,
          o."originalFilename" AS filename,
          ${ftsRankExpr} AS "ftsRank",
          CASE
            WHEN o."originalFilename" ILIKE $${ilikeParam} ESCAPE '\\' THEN true
            ELSE false
          END AS "filenameMatch",
          CASE
            WHEN c.content ILIKE $${ilikeParam} ESCAPE '\\' THEN true
            ELSE false
          END AS "contentExactMatch"
        FROM observation_chunks c
        INNER JOIN observations o ON o.id = c."observationId"
        WHERE ${where.join(' AND ')}
      ) ranked
      ORDER BY
        (ranked."filenameMatch"::int) DESC,
        (ranked."contentExactMatch"::int) DESC,
        ranked."ftsRank" DESC,
        ranked."chunkIndex" ASC
      LIMIT $${limitParam}
    `;

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        chunkId: string;
        observationId: string;
        chunkIndex: number;
        content: string;
        filename: string;
        ftsRank: number;
        filenameMatch: boolean;
        contentExactMatch: boolean;
      }>
    >(sql, ...params);

    this.logger.log(
      JSON.stringify({
        event: 'lexical_search',
        userId,
        limit,
        resultCount: rows.length,
        hasFilters: Object.values(filters).some((v) => v != null),
        ftsInput: normalized.ftsInput,
      }),
    );

    return rows.map((row) => ({
      chunkId: row.chunkId,
      observationId: row.observationId,
      chunkIndex: row.chunkIndex,
      content: row.content,
      filename: row.filename,
      ftsRank: Number(row.ftsRank) || 0,
      filenameMatch: Boolean(row.filenameMatch),
      contentExactMatch: Boolean(row.contentExactMatch),
    }));
  }
}
