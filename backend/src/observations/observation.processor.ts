import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  EntityType,
  ObservationType,
  Prisma,
  ProcessingStatus,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { ObservationJobsService } from '../queue/observation-jobs.service';
import { readIngestModel } from '../ai/gemini-models';
import { AI_PROVIDER, type AIProvider } from '../ai/ai.types';
import { ChunkEmbeddingService } from '../embeddings/chunk-embedding.service';
import {
  EMBEDDING_PROVIDER,
  type EmbeddingProvider,
} from '../embeddings/embedding.types';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_SERVICE, type StorageService } from '../storage/storage.types';
import { chunkText, computeTextStats } from './chunking';
import { AudioExtractor } from './extractors/audio.extractor';
import { ImageExtractor } from './extractors/image.extractor';
import { PdfExtractor } from './extractors/pdf.extractor';
import { TextExtractor } from './extractors/text.extractor';
import type {
  ContentExtractor,
  ExtractionResult,
} from './extractors/extractor.types';
import { normalizeDocumentText } from './normalize';

@Injectable()
export class ObservationProcessor {
  private readonly logger = new Logger(ObservationProcessor.name);
  private readonly extractors: ContentExtractor[];

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    @Inject(AI_PROVIDER) private readonly ai: AIProvider,
    @Inject(EMBEDDING_PROVIDER)
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly chunkEmbeddings: ChunkEmbeddingService,
    private readonly notifications: NotificationsService,
    @Optional() private readonly jobs?: ObservationJobsService,
  ) {
    this.extractors = [
      new TextExtractor(),
      new PdfExtractor(),
      new ImageExtractor(),
      new AudioExtractor((buffer, mimeType) =>
        this.ai.transcribeAudio(buffer, mimeType),
      ),
    ];
  }

  /** Entry point for async processing after upload. Safe to retry. */
  async process(observationId: string): Promise<void> {
    const observation = await this.prisma.observation.findUnique({
      where: { id: observationId },
    });

    if (!observation) {
      this.logger.warn(`Observation ${observationId} not found for processing`);
      return;
    }

    if (observation.processingStatus === ProcessingStatus.COMPLETED) {
      return;
    }

    const claimed = await this.claimForProcessing(observationId);
    if (!claimed) {
      this.logger.warn(
        `Skip concurrent processing for ${observationId} (status=${observation.processingStatus})`,
      );
      return;
    }

    try {
      const buffer = await this.storage.get(observation.storageKey);
      const extracted = await this.extract(
        observation.type,
        observation.mimeType,
        buffer,
      );

      await this.setStatus(observationId, ProcessingStatus.NORMALIZING);
      const normalized = this.normalize(extracted.text);
      await this.indexNormalized(
        observationId,
        observation.userId,
        normalized,
        {
          pageCount:
            typeof extracted.metadata.pageCount === 'number'
              ? extracted.metadata.pageCount
              : null,
          sourceMetadata: {
            ...(typeof observation.sourceMetadata === 'object' &&
            observation.sourceMetadata !== null
              ? (observation.sourceMetadata as Record<string, unknown>)
              : {}),
            extraction: extracted.metadata,
            processingNote: extracted.notes ?? null,
          },
        },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Processing failed';
      this.logger.error(
        `Processing failed for observation ${observationId}: ${message}`,
      );

      await this.prisma.observation.update({
        where: { id: observationId },
        data: {
          processingStatus: ProcessingStatus.FAILED,
          processingError: toSafeProcessingError(message),
        },
      });
      await this.emitSettledNotification(observationId);
    }
  }

  /**
   * Re-chunk, re-analyze, and re-embed from edited text.
   * Skips file extraction so user edits are not overwritten.
   */
  async reindexFromText(observationId: string, text: string): Promise<void> {
    const observation = await this.prisma.observation.findUnique({
      where: { id: observationId },
    });
    if (!observation) {
      this.logger.warn(`Observation ${observationId} not found for reindex`);
      return;
    }
    try {
      await this.setStatus(observationId, ProcessingStatus.NORMALIZING);
      const normalized = this.normalize(text);
      await this.indexNormalized(
        observationId,
        observation.userId,
        normalized,
        {
          sourceMetadata:
            typeof observation.sourceMetadata === 'object' &&
            observation.sourceMetadata !== null
              ? (observation.sourceMetadata as Record<string, unknown>)
              : {},
        },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Processing failed';
      this.logger.error(
        `Reindex failed for observation ${observationId}: ${message}`,
      );
      await this.prisma.observation.update({
        where: { id: observationId },
        data: {
          processingStatus: ProcessingStatus.FAILED,
          processingError: toSafeProcessingError(message),
        },
      });
      await this.emitSettledNotification(observationId);
    }
  }

  private async indexNormalized(
    observationId: string,
    userId: string,
    normalized: string | null,
    extras: {
      pageCount?: number | null;
      sourceMetadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    const stats = computeTextStats(normalized);
    await this.prisma.observation.update({
      where: { id: observationId },
      data: {
        extractedText: normalized,
        characterCount: stats.characterCount,
        wordCount: stats.wordCount,
        ...(extras.pageCount !== undefined
          ? { pageCount: extras.pageCount }
          : {}),
        processingError: null,
        sourceMetadata: extras.sourceMetadata as Prisma.InputJsonValue,
      },
    });

    await this.setStatus(observationId, ProcessingStatus.CHUNKING);
    const chunks = chunkText(normalized ?? '');
    await this.replaceChunks(observationId, chunks);

    await this.prisma.observation.update({
      where: { id: observationId },
      data: { chunkCount: chunks.length },
    });

    await this.setStatus(observationId, ProcessingStatus.ANALYZING);

    const embedPromise =
      chunks.length > 0 && this.embeddingProvider.isConfigured()
        ? this.chunkEmbeddings.embedMissingChunks(observationId)
        : null;
    if (embedPromise) void embedPromise.catch(() => undefined);

    let analysisNote: string | undefined;
    let analysisModel: string | undefined;
    if (!normalized || chunks.length === 0) {
      analysisNote =
        'No extractable text available for summary/topics/entities.';
      await this.clearAnalysisLinks(observationId);
      await this.prisma.observation.update({
        where: { id: observationId },
        data: { summary: null },
      });
    } else if (!this.ai.isConfigured()) {
      analysisNote =
        'AI provider is not configured. Chunks and metadata were saved without summary/topics/entities.';
      await this.clearAnalysisLinks(observationId);
      await this.prisma.observation.update({
        where: { id: observationId },
        data: { summary: null },
      });
    } else {
      try {
        const analysis = await this.ai.analyzeDocument(
          chunks.map((c) => c.content),
        );
        analysisModel = analysis.model;
        await this.persistAnalysis(observationId, userId, analysis);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'AI analysis failed';
        this.logger.warn(`AI analysis failed for ${observationId}: ${message}`);
        analysisNote = `AI analysis skipped: ${toSafeProcessingError(message)}`;
        // Keep extracted text + chunks; do not fail the whole observation.
      }
    }

    if (chunks.length > 0 && !this.embeddingProvider.isConfigured()) {
      throw new Error(
        'Embedding provider is not configured. Set EMBEDDING_API_KEY / AI_API_KEY or EMBEDDING_PROVIDER=local.',
      );
    }

    const embedStats = embedPromise ? await embedPromise : null;

    const current = await this.prisma.observation.findUnique({
      where: { id: observationId },
    });
    const sourceMetadata = {
      ...(typeof current?.sourceMetadata === 'object' &&
      current.sourceMetadata !== null
        ? current.sourceMetadata
        : {}),
      ...(analysisNote ? { analysisNote } : {}),
      analysisProvider: this.ai.isConfigured() ? this.ai.name : 'none',
      ...(this.ai.isConfigured()
        ? { analysisModel: analysisModel ?? readIngestModel() }
        : {}),
      ...(embedStats
        ? {
            embeddingProvider: this.embeddingProvider.name,
            embeddingModel: this.embeddingProvider.model,
            embeddingDimensions: this.embeddingProvider.dimensions,
            embeddingsCreated: embedStats.newlyEmbedded,
            embeddingsReused: embedStats.alreadyEmbedded,
          }
        : {}),
    } as Prisma.InputJsonValue;

    await this.prisma.observation.update({
      where: { id: observationId },
      data: {
        sourceMetadata,
      },
    });

    await this.prisma.observation.update({
      where: { id: observationId },
      data: {
        processingStatus: ProcessingStatus.COMPLETED,
        processingError: null,
      },
    });
    await this.emitSettledNotification(observationId);
  }

  async extract(
    type: ObservationType,
    mimeType: string,
    buffer: Buffer,
  ): Promise<ExtractionResult> {
    const extractor = this.extractors.find((item) =>
      item.supports(type, mimeType),
    );
    if (!extractor) {
      throw new Error(`No extractor for type=${type} mime=${mimeType}`);
    }
    return extractor.extract(buffer, mimeType);
  }

  normalize(text: string | null): string | null {
    return normalizeDocumentText(text);
  }

  /** Explicit embedding stage entry (used by pipeline). */
  async embed(observationId: string): Promise<void> {
    await this.chunkEmbeddings.embedMissingChunks(observationId);
  }

  private async emitSettledNotification(observationId: string): Promise<void> {
    try {
      const row = await this.prisma.observation.findUnique({
        where: { id: observationId },
        select: {
          id: true,
          userId: true,
          originalFilename: true,
          summary: true,
          processingStatus: true,
          source: true,
        },
      });
      if (!row) return;
      if (this.jobs) {
        await this.jobs.enqueueNotify(observationId);
        return;
      }
      await this.notifications.notifyObservationSettled(row);
    } catch (error) {
      this.logger.warn(
        `Push notify failed for ${observationId}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }
  }

  private async claimForProcessing(observationId: string): Promise<boolean> {
    const updated = await this.prisma.$executeRaw`
      UPDATE "observations"
      SET
        "processingStatus" = 'EXTRACTING'::"ProcessingStatus",
        "processingError" = NULL,
        "updatedAt" = NOW()
      WHERE "id" = ${observationId}
        AND (
          "processingStatus" IN (
            'PENDING'::"ProcessingStatus",
            'FAILED'::"ProcessingStatus"
          )
          OR (
            "processingStatus" IN (
              'EXTRACTING'::"ProcessingStatus",
              'NORMALIZING'::"ProcessingStatus",
              'CHUNKING'::"ProcessingStatus",
              'ANALYZING'::"ProcessingStatus",
              'EMBEDDING'::"ProcessingStatus",
              'PROCESSING'::"ProcessingStatus"
            )
            AND "updatedAt" < NOW() - INTERVAL '10 minutes'
          )
        )
    `;
    return Number(updated) > 0;
  }

  private async setStatus(
    observationId: string,
    status: ProcessingStatus,
  ): Promise<void> {
    await this.prisma.observation.update({
      where: { id: observationId },
      data: { processingStatus: status, processingError: null },
    });
  }

  private async replaceChunks(
    observationId: string,
    chunks: ReturnType<typeof chunkText>,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.observationChunk.deleteMany({ where: { observationId } });
      if (chunks.length === 0) return;
      await tx.observationChunk.createMany({
        data: chunks.map((chunk) => ({
          observationId,
          content: chunk.content,
          chunkIndex: chunk.chunkIndex,
          startOffset: chunk.startOffset,
          endOffset: chunk.endOffset,
        })),
      });
    });
  }

  private async clearAnalysisLinks(observationId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.observationTopic.deleteMany({ where: { observationId } }),
      this.prisma.observationEntity.deleteMany({ where: { observationId } }),
    ]);
  }

  private async persistAnalysis(
    observationId: string,
    userId: string,
    analysis: {
      summary: string;
      topics: Array<{ name: string; confidence?: number }>;
      entities: Array<{
        name: string;
        type: keyof typeof EntityType;
        confidence?: number;
      }>;
      provider: string;
      model: string;
    },
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.observationTopic.deleteMany({ where: { observationId } });
      await tx.observationEntity.deleteMany({ where: { observationId } });

      await tx.observation.update({
        where: { id: observationId },
        data: {
          summary: analysis.summary,
        },
      });

      for (const topic of analysis.topics) {
        const normalizedName = normalizeLabel(topic.name);
        const saved = await tx.topic.upsert({
          where: {
            userId_normalizedName: { userId, normalizedName },
          },
          create: {
            userId,
            name: topic.name.trim(),
            normalizedName,
          },
          update: {
            name: topic.name.trim(),
          },
        });
        await tx.observationTopic.create({
          data: {
            observationId,
            topicId: saved.id,
            confidence: topic.confidence ?? null,
          },
        });
      }

      for (const entity of analysis.entities) {
        const normalizedName = normalizeLabel(entity.name);
        const type = EntityType[entity.type];
        const saved = await tx.entity.upsert({
          where: {
            userId_normalizedName_type: {
              userId,
              normalizedName,
              type,
            },
          },
          create: {
            userId,
            name: entity.name.trim(),
            normalizedName,
            type,
          },
          update: {
            name: entity.name.trim(),
          },
        });
        await tx.observationEntity.create({
          data: {
            observationId,
            entityId: saved.id,
            confidence: entity.confidence ?? null,
          },
        });
      }
    });
  }
}

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 120);
}

function toSafeProcessingError(message: string): string {
  const cleaned = message.replace(/\s+/g, ' ').trim().slice(0, 500);
  if (/rate limit|429/i.test(cleaned)) {
    return 'AI provider rate limit hit. Retry processing in a minute.';
  }
  if (/stack|ECONNREFUSED|ENOENT|secret|token|api[_-]?key/i.test(cleaned)) {
    return 'Processing failed while understanding the document.';
  }
  return cleaned || 'Processing failed.';
}
