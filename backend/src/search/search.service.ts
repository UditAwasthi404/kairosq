import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ObservationType } from '@prisma/client';
import {
  EMBEDDING_PROVIDER,
  type EmbeddingProvider,
} from '../embeddings/embedding.types';
import {
  VectorSearchService,
  type VectorSearchHit,
} from '../embeddings/vector-search.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import {
  resolveEntityFilter,
  resolveProjectFilter,
  resolveTopicFilter,
} from '../metadata/resolve-filters';
import { fuseCandidates, readFusionWeights } from './hybrid-fusion';
import { LexicalSearchService } from './lexical-search.service';
import {
  type SearchRequestBody,
  validateSearchRequest,
} from './search.validation';

export type SemanticSearchResult = {
  chunkId: string;
  observationId: string;
  chunkIndex: number;
  content: string;
  similarity: number;
  observation: {
    id: string;
    filename: string;
    type: ObservationType;
    mimeType: string;
    createdAt: string;
    capturedAt: string;
    summary: string | null;
  };
};

export type SemanticSearchResponse = {
  query: string;
  results: SemanticSearchResult[];
  total: number;
};

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly minSimilarity: number;
  private readonly maxPerObservation: number;
  private readonly hybridEnabled: boolean;
  private readonly semanticCandidateLimit: number;
  private readonly lexicalCandidateLimit: number;

  constructor(
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
    private readonly vectorSearch: VectorSearchService,
    private readonly lexicalSearch: LexicalSearchService,
    @Inject(EMBEDDING_PROVIDER) private readonly embeddings: EmbeddingProvider,
  ) {
    this.minSimilarity = readFloatEnv('SEARCH_MIN_SIMILARITY', 0.2);
    this.maxPerObservation = Math.max(
      1,
      Math.floor(readFloatEnv('SEARCH_MAX_PER_OBSERVATION', 2)),
    );
    this.hybridEnabled = readBoolEnv('SEARCH_HYBRID_ENABLED', false);
    this.semanticCandidateLimit = Math.min(
      Math.max(Math.floor(readFloatEnv('SEARCH_SEMANTIC_CANDIDATES', 30)), 1),
      100,
    );
    this.lexicalCandidateLimit = Math.min(
      Math.max(Math.floor(readFloatEnv('SEARCH_LEXICAL_CANDIDATES', 30)), 1),
      100,
    );
  }

  embedQuery(text: string): Promise<number[]> {
    return this.embeddings.embedText(text).then((result) => result.embedding);
  }

  async search(
    clerkUserId: string,
    body: SearchRequestBody,
    precomputedEmbedding?: number[],
  ): Promise<SemanticSearchResponse> {
    const started = Date.now();
    const request = validateSearchRequest(body);

    if (!this.embeddings.isConfigured()) {
      throw new Error('Embedding provider is not configured');
    }

    const user = await this.users.findOrCreateByClerkId(clerkUserId);
    const topicId = await resolveTopicFilter({
      prisma: this.prisma,
      userId: user.id,
      topicId: request.filters.topicId,
      topic: request.filters.topic,
    });
    const entityId = await resolveEntityFilter({
      prisma: this.prisma,
      userId: user.id,
      entityId: request.filters.entityId,
      entity: request.filters.entity,
    });
    const projectId = await resolveProjectFilter({
      prisma: this.prisma,
      userId: user.id,
      projectId: request.filters.projectId,
    });

    const filters = {
      observationType: request.filters.observationType,
      mimeType: request.filters.mimeType,
      from: request.filters.from,
      to: request.filters.to,
      topicId,
      entityId,
      projectId,
      source: request.filters.source,
      observationId: request.filters.observationId,
      excludeObservationId: request.filters.excludeObservationId,
    };

    let embedMs = 0;
    let embedding = precomputedEmbedding;
    if (!embedding || embedding.length === 0) {
      const embedStarted = Date.now();
      embedding = (await this.embeddings.embedText(request.query)).embedding;
      embedMs = Date.now() - embedStarted;
    }

    const semanticLimit = this.hybridEnabled
      ? this.semanticCandidateLimit
      : Math.min(request.limit * Math.max(3, this.maxPerObservation + 1), 100);

    const searchStarted = Date.now();
    let hits: VectorSearchHit[];
    let lexicalMs = 0;

    if (this.hybridEnabled) {
      const lexicalStarted = Date.now();
      const [semanticHits, lexicalHits] = await Promise.all([
        this.vectorSearch.search(user.id, embedding, {
          candidateLimit: semanticLimit,
          minSimilarity: this.minSimilarity,
          filters,
        }),
        this.lexicalSearch.search(user.id, request.query, {
          limit: this.lexicalCandidateLimit,
          filters,
        }),
      ]);
      lexicalMs = Date.now() - lexicalStarted;

      const fused = fuseCandidates({
        query: request.query,
        semanticHits,
        lexicalHits,
        weights: readFusionWeights(),
      });

      hits = fused.map((row) => ({
        chunkId: row.chunkId,
        observationId: row.observationId,
        chunkIndex: row.chunkIndex,
        content: row.content,
        distance: row.distance,
        similarity: row.similarity,
      }));
    } else {
      hits = await this.vectorSearch.search(user.id, embedding, {
        candidateLimit: semanticLimit,
        minSimilarity: this.minSimilarity,
        filters,
      });
    }
    const searchMs = Date.now() - searchStarted;

    const capped = applyPerObservationCap(hits, this.maxPerObservation).slice(
      0,
      request.limit,
    );
    const results = await this.hydrateResults(user.id, capped);

    this.logger.log(
      JSON.stringify({
        event: this.hybridEnabled ? 'hybrid_search' : 'semantic_search',
        userId: user.id,
        resultCount: results.length,
        embedMs,
        searchMs,
        lexicalMs: this.hybridEnabled ? lexicalMs : undefined,
        totalMs: Date.now() - started,
        limit: request.limit,
        minSimilarity: this.minSimilarity,
        hybridEnabled: this.hybridEnabled,
        semanticCandidates: semanticLimit,
        lexicalCandidates: this.hybridEnabled
          ? this.lexicalCandidateLimit
          : undefined,
      }),
    );

    return {
      query: request.query,
      results,
      total: results.length,
    };
  }

  private async hydrateResults(
    userId: string,
    hits: VectorSearchHit[],
  ): Promise<SemanticSearchResult[]> {
    if (hits.length === 0) return [];

    const observationIds = [...new Set(hits.map((hit) => hit.observationId))];
    const observations = await this.prisma.observation.findMany({
      where: { id: { in: observationIds }, userId },
      select: {
        id: true,
        originalFilename: true,
        type: true,
        mimeType: true,
        createdAt: true,
        capturedAt: true,
        summary: true,
      },
    });
    const byId = new Map(observations.map((obs) => [obs.id, obs]));

    return hits.flatMap((hit) => {
      const observation = byId.get(hit.observationId);
      if (!observation) return [];
      return [
        {
          chunkId: hit.chunkId,
          observationId: hit.observationId,
          chunkIndex: hit.chunkIndex,
          content: hit.content,
          similarity: hit.similarity,
          observation: {
            id: observation.id,
            filename: observation.originalFilename,
            type: observation.type,
            mimeType: observation.mimeType,
            createdAt: observation.createdAt.toISOString(),
            capturedAt: observation.capturedAt.toISOString(),
            summary: observation.summary,
          },
        },
      ];
    });
  }
}

function applyPerObservationCap(
  hits: VectorSearchHit[],
  maxPerObservation: number,
): VectorSearchHit[] {
  const counts = new Map<string, number>();
  const out: VectorSearchHit[] = [];
  for (const hit of hits) {
    const count = counts.get(hit.observationId) ?? 0;
    if (count >= maxPerObservation) continue;
    counts.set(hit.observationId, count + 1);
    out.push(hit);
  }
  return out;
}

function readFloatEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : fallback;
}

function readBoolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === '') return fallback;
  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}
