import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  CaptureSource,
  ObservationType,
  Prisma,
  ProcessingStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  STORAGE_SERVICE,
  type SignedDownload,
  type StorageService,
} from '../storage/storage.types';
import { UsersService } from '../users/users.service';
import { validateUpload } from './file-validation';
import {
  toObservationResponse,
  type ObservationResponse,
} from './observation.mapper';
import { ObservationJobsService } from '../queue/observation-jobs.service';
import { ObservationProcessor } from './observation.processor';
import {
  resolveEntityFilter,
  resolveProjectFilter,
  resolveTopicFilter,
} from '../metadata/resolve-filters';
import { fetchUrlContent } from './url-ingest';
import {
  CAPTURE_SOURCE_LABELS,
  parseCaptureSource,
  parseOptionalCaptureSource,
  parseOptionalCapturedAt,
} from './capture-source';
import { VectorSearchService } from '../embeddings/vector-search.service';
import { ProgressionService } from '../progression/progression.service';
import {
  scoreRelatedMemory,
  shouldKeepRelated,
  type RelatedReason,
} from './related-memories';

export type RelatedMemoryItem = {
  observationId: string;
  filename: string;
  snippet: string;
  capturedAt: string;
  sourceLabel: string;
  score: number;
  reasons: RelatedReason[];
};

const observationInclude = {
  observationTopics: { include: { topic: true } },
  observationEntities: { include: { entity: true } },
  projectObservations: { include: { project: true } },
  _count: { select: { chunks: true } },
} as const;

const MAX_NOTE_CHARS = 100_000;

@Injectable()
export class ObservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly processor: ObservationProcessor,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    private readonly vectorSearch: VectorSearchService,
    @Optional() private readonly progression?: ProgressionService,
    @Optional() private readonly jobs?: ObservationJobsService,
  ) {}

  async capture(params: {
    clerkUserId: string;
    clientCaptureId?: string;
    content?: string;
    source?: string;
    capturedAt?: string;
    url?: string;
    title?: string;
    metadata?: Record<string, unknown>;
    projectId?: string;
    file?: Express.Multer.File;
  }): Promise<ObservationResponse> {
    const clientCaptureId = params.clientCaptureId?.trim() || undefined;
    if (clientCaptureId && clientCaptureId.length > 128) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_CLIENT_CAPTURE_ID',
          message: 'clientCaptureId must be 128 characters or fewer.',
        },
      });
    }
    if (clientCaptureId) {
      const existing = await this.findByClientCaptureId(
        params.clerkUserId,
        clientCaptureId,
      );
      if (existing) return existing;
    }
    const source = parseCaptureSource(params.source);
    const capturedAt = parseOptionalCapturedAt(params.capturedAt);
    const title = params.title?.trim() || undefined;
    const extraMeta =
      params.metadata && typeof params.metadata === 'object'
        ? params.metadata
        : {};

    if (params.file) {
      return this.upload({
        clerkUserId: params.clerkUserId,
        file: params.file,
        source,
        capturedAt,
        title,
        extraMeta: {
          ...extraMeta,
          ...(params.url ? { url: params.url } : {}),
        },
        projectId: params.projectId,
        clientCaptureId,
      });
    }

    const url = params.url?.trim() || '';
    const content = params.content?.trim() || '';

    if (url && !content) {
      return this.createFromUrl({
        clerkUserId: params.clerkUserId,
        url,
        source,
        capturedAt,
        extraMeta: {
          ...extraMeta,
          ...(title ? { title } : {}),
        },
        projectId: params.projectId,
        clientCaptureId,
      });
    }

    if (content) {
      const body = url ? `${content}\n\nSource: ${url}` : content;
      return this.createFromText({
        clerkUserId: params.clerkUserId,
        text: body,
        title,
        source,
        capturedAt,
        extraMeta: {
          ...extraMeta,
          ...(url ? { url } : {}),
        },
        projectId: params.projectId,
        clientCaptureId,
      });
    }

    throw new BadRequestException({
      error: {
        code: 'MISSING_CONTENT',
        message: 'Provide content, a URL, or a file.',
      },
    });
  }

  async upload(params: {
    clerkUserId: string;
    file: Express.Multer.File;
    source?: CaptureSource;
    capturedAt?: Date;
    title?: string;
    extraMeta?: Record<string, unknown>;
    projectId?: string;
    clientCaptureId?: string;
  }): Promise<ObservationResponse> {
    if (!params.file) {
      throw new BadRequestException({
        error: {
          code: 'MISSING_FILE',
          message: 'A file field named "file" is required.',
        },
      });
    }

    const validated = await validateUpload({
      buffer: params.file.buffer,
      originalFilename: params.file.originalname,
      declaredMimeType: params.file.mimetype,
    });

    const user = await this.users.findOrCreateByClerkId(params.clerkUserId);
    await this.assertOwnedProject(user.id, params.projectId);
    const storageKey = buildStorageKey(user.id, validated.safeFilename);

    try {
      await this.storage.upload(
        storageKey,
        params.file.buffer,
        validated.mimeType,
      );
    } catch {
      throw new BadRequestException({
        error: {
          code: 'STORAGE_FAILURE',
          message: 'Failed to store the uploaded file.',
        },
      });
    }

    const source = params.source ?? CaptureSource.MANUAL;
    let observation;
    try {
      observation = await this.prisma.observation.create({
        data: {
          userId: user.id,
          clientCaptureId: params.clientCaptureId,
          type: validated.observationType,
          source,
          originalFilename: validated.safeFilename,
          mimeType: validated.mimeType,
          storageKey,
          fileSizeBytes: params.file.buffer.byteLength,
          processingStatus: ProcessingStatus.PENDING,
          sourceMetadata: {
            captureKind: source.toLowerCase(),
            source,
            clientMimeType: params.file.mimetype ?? null,
            ...(params.title ? { title: params.title } : {}),
            ...(params.extraMeta ?? {}),
          },
          ...(params.capturedAt ? { capturedAt: params.capturedAt } : {}),
        },
        include: observationInclude,
      });
    } catch (error) {
      try {
        await this.storage.delete(storageKey);
      } catch {
        // Best-effort orphan cleanup.
      }
      throw error;
    }

    if (params.projectId) {
      await this.attachProjectIfRequested({
        clerkUserId: params.clerkUserId,
        observationId: observation.id,
        projectId: params.projectId,
      });
    }

    this.scheduleProcess(observation.id);
    this.noteCapture(user.id, observation.id);

    if (params.projectId) {
      return this.getForClerkUser(params.clerkUserId, observation.id);
    }
    return toObservationResponse(observation);
  }

  async createFromText(params: {
    clerkUserId: string;
    text: string;
    title?: string;
    source?: CaptureSource;
    capturedAt?: Date;
    extraMeta?: Record<string, unknown>;
    projectId?: string;
    clientCaptureId?: string;
  }): Promise<ObservationResponse> {
    const text = params.text?.trim() ?? '';
    if (!text) {
      throw new BadRequestException({
        error: {
          code: 'MISSING_TEXT',
          message: 'Note text is required.',
        },
      });
    }
    if (text.length > MAX_NOTE_CHARS) {
      throw new BadRequestException({
        error: {
          code: 'TEXT_TOO_LARGE',
          message: 'Note text is too long.',
        },
      });
    }

    const title = (params.title?.trim() || text.slice(0, 48)).slice(0, 80);
    const source = params.source ?? CaptureSource.MANUAL;
    const safeFilename = `${slugFilename(title)}.txt`;
    const buffer = Buffer.from(text, 'utf8');
    return this.createStoredObservation({
      clerkUserId: params.clerkUserId,
      buffer,
      mimeType: 'text/plain',
      observationType: ObservationType.TEXT,
      source,
      safeFilename,
      sourceMetadata: {
        captureKind:
          source === CaptureSource.MANUAL ? 'note' : source.toLowerCase(),
        source,
        title,
        ...(params.extraMeta ?? {}),
      },
      capturedAt: params.capturedAt,
      projectId: params.projectId,
      clientCaptureId: params.clientCaptureId,
    });
  }

  /**
   * Recall derived-text ingest. Already OCR'd on device — TEXT path only.
   * Does not accept or store raw screenshots.
   */
  async createFromRecall(params: {
    clerkUserId: string;
    event: {
      clientEventId: string;
      capturedAt: Date;
      sessionId?: string;
      extractedText: string;
      fingerprint: string;
      appPackage?: string;
      appLabel?: string;
      url?: string;
      title?: string;
      ocrConfidence?: number;
      pipelineVersion: string;
      clientProcessingVersion: string;
    };
  }): Promise<ObservationResponse> {
    const text = params.event.extractedText.trim();
    if (!text) {
      throw new BadRequestException({
        error: {
          code: 'MISSING_TEXT',
          message: 'Recall extractedText is required.',
        },
      });
    }

    const title = (
      params.event.title?.trim() ||
      params.event.appLabel?.trim() ||
      text.slice(0, 48)
    ).slice(0, 80);
    const safeFilename = `recall-${slugFilename(title)}.txt`;
    const buffer = Buffer.from(text, 'utf8');

    const sourceMetadata: Prisma.InputJsonValue = {
      captureKind: 'recall',
      source: CaptureSource.RECALL,
      clientEventId: params.event.clientEventId,
      fingerprint: params.event.fingerprint,
      pipelineVersion: params.event.pipelineVersion,
      clientProcessingVersion: params.event.clientProcessingVersion,
      ...(params.event.sessionId ? { sessionId: params.event.sessionId } : {}),
      ...(params.event.appPackage
        ? { appPackage: params.event.appPackage }
        : {}),
      ...(params.event.appLabel ? { appLabel: params.event.appLabel } : {}),
      ...(params.event.url ? { url: params.event.url } : {}),
      ...(params.event.title ? { title: params.event.title } : {}),
      ...(typeof params.event.ocrConfidence === 'number'
        ? { ocrConfidence: params.event.ocrConfidence }
        : {}),
    };

    return this.createStoredObservation({
      clerkUserId: params.clerkUserId,
      buffer,
      mimeType: 'text/plain',
      observationType: ObservationType.TEXT,
      source: CaptureSource.RECALL,
      safeFilename,
      sourceMetadata,
      capturedAt: params.event.capturedAt,
    });
  }

  async createFromUrl(params: {
    clerkUserId: string;
    url: string;
    source?: CaptureSource;
    capturedAt?: Date;
    extraMeta?: Record<string, unknown>;
    projectId?: string;
    clientCaptureId?: string;
  }): Promise<ObservationResponse> {
    const fetched = await fetchUrlContent(params.url);
    const body = `${fetched.title}\nSource: ${fetched.url}\n\n${fetched.text}`;
    const buffer = Buffer.from(body, 'utf8');
    const safeFilename = `${slugFilename(fetched.title)}.txt`;
    const source = params.source ?? CaptureSource.MANUAL;
    return this.createStoredObservation({
      clerkUserId: params.clerkUserId,
      buffer,
      mimeType: 'text/plain',
      observationType: ObservationType.TEXT,
      source,
      safeFilename,
      sourceMetadata: {
        captureKind:
          source === CaptureSource.MANUAL ? 'url' : source.toLowerCase(),
        source,
        sourceUrl: fetched.url,
        title: fetched.title,
        fetchedContentType: fetched.contentType,
        ...(params.extraMeta ?? {}),
      },
      capturedAt: params.capturedAt,
      projectId: params.projectId,
      clientCaptureId: params.clientCaptureId,
    });
  }

  async deleteForClerkUser(
    clerkUserId: string,
    observationId: string,
  ): Promise<void> {
    const observation = await this.findOwned(clerkUserId, observationId);
    const storageKey = observation.storageKey;
    await this.prisma.observation.delete({ where: { id: observation.id } });
    try {
      await this.storage.delete(storageKey);
    } catch {
      // DB row is gone; storage cleanup is best-effort.
    }
  }

  private async createStoredObservation(params: {
    clerkUserId: string;
    buffer: Buffer;
    mimeType: string;
    observationType: ObservationType;
    source?: CaptureSource;
    safeFilename: string;
    sourceMetadata: Prisma.InputJsonValue;
    capturedAt?: Date;
    projectId?: string;
    clientCaptureId?: string;
  }): Promise<ObservationResponse> {
    const user = await this.users.findOrCreateByClerkId(params.clerkUserId);
    await this.assertOwnedProject(user.id, params.projectId);
    const storageKey = buildStorageKey(user.id, params.safeFilename);

    try {
      await this.storage.upload(storageKey, params.buffer, params.mimeType);
    } catch {
      throw new BadRequestException({
        error: {
          code: 'STORAGE_FAILURE',
          message: 'Failed to store the observation.',
        },
      });
    }

    const source = params.source ?? CaptureSource.MANUAL;
    let observation;
    try {
      observation = await this.prisma.observation.create({
        data: {
          userId: user.id,
          clientCaptureId: params.clientCaptureId,
          type: params.observationType,
          source,
          originalFilename: params.safeFilename,
          mimeType: params.mimeType,
          storageKey,
          fileSizeBytes: params.buffer.byteLength,
          processingStatus: ProcessingStatus.PENDING,
          sourceMetadata: params.sourceMetadata,
          ...(params.capturedAt ? { capturedAt: params.capturedAt } : {}),
        },
        include: observationInclude,
      });
    } catch (error) {
      try {
        await this.storage.delete(storageKey);
      } catch {
        // Best-effort orphan cleanup.
      }
      throw error;
    }

    if (params.projectId) {
      await this.attachProjectIfRequested({
        clerkUserId: params.clerkUserId,
        observationId: observation.id,
        projectId: params.projectId,
      });
    }

    this.scheduleProcess(observation.id);
    this.noteCapture(user.id, observation.id);

    if (params.projectId) {
      return this.getForClerkUser(params.clerkUserId, observation.id);
    }
    return toObservationResponse(observation);
  }

  async findByClientCaptureId(
    clerkUserId: string,
    clientCaptureId: string,
  ): Promise<ObservationResponse | null> {
    const user = await this.users.findOrCreateByClerkId(clerkUserId);
    const observation = await this.prisma.observation.findUnique({
      where: {
        userId_clientCaptureId: { userId: user.id, clientCaptureId },
      },
      include: observationInclude,
    });
    return observation ? toObservationResponse(observation) : null;
  }

  private noteCapture(userId: string, observationId: string): void {
    void this.progression
      ?.recordCapture({ userId, observationId })
      .catch(() => undefined);
  }

  private async attachProjectIfRequested(params: {
    clerkUserId: string;
    observationId: string;
    projectId?: string;
  }): Promise<void> {
    const projectId = params.projectId?.trim();
    if (!projectId) return;
    const user = await this.users.findOrCreateByClerkId(params.clerkUserId);
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId: user.id },
    });
    if (!project) {
      throw new BadRequestException({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'The requested project was not found.',
        },
      });
    }
    await this.prisma.projectObservation.upsert({
      where: {
        projectId_observationId: {
          projectId: project.id,
          observationId: params.observationId,
        },
      },
      create: {
        projectId: project.id,
        observationId: params.observationId,
      },
      update: {},
    });
  }

  async listForClerkUser(
    clerkUserId: string,
    filters?: {
      topicId?: string;
      entityId?: string;
      projectId?: string;
      topic?: string;
      entity?: string;
      source?: string;
      from?: string;
      to?: string;
      limit?: number;
      cursor?: string;
    },
  ): Promise<{ items: ObservationResponse[]; nextCursor: string | null }> {
    const user = await this.users.findOrCreateByClerkId(clerkUserId);
    const topicId = await resolveTopicFilter({
      prisma: this.prisma,
      userId: user.id,
      topicId: filters?.topicId,
      topic: filters?.topic,
    });
    const entityId = await resolveEntityFilter({
      prisma: this.prisma,
      userId: user.id,
      entityId: filters?.entityId,
      entity: filters?.entity,
    });
    const projectId = await resolveProjectFilter({
      prisma: this.prisma,
      userId: user.id,
      projectId: filters?.projectId,
    });
    const source = parseOptionalCaptureSource(filters?.source);
    const from = parseListDate(filters?.from);
    const to = parseListDate(filters?.to);
    const take = Math.min(Math.max(filters?.limit ?? 40, 1), 80);
    const cursor = decodeObservationCursor(filters?.cursor);
    const capturedAtFilter = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };

    const observations = await this.prisma.observation.findMany({
      where: {
        userId: user.id,
        ...(topicId ? { observationTopics: { some: { topicId } } } : {}),
        ...(entityId ? { observationEntities: { some: { entityId } } } : {}),
        ...(projectId ? { projectObservations: { some: { projectId } } } : {}),
        ...(source ? { source } : {}),
        ...(from || to ? { capturedAt: capturedAtFilter } : {}),
        ...(cursor
          ? {
              OR: [
                { capturedAt: { lt: cursor.capturedAt } },
                { capturedAt: cursor.capturedAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ capturedAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      include: observationInclude,
    });
    const page = observations.slice(0, take);
    const last = page[page.length - 1];
    return {
      items: page.map(toObservationResponse),
      nextCursor:
        observations.length > take && last
          ? encodeObservationCursor(last.capturedAt, last.id)
          : null,
    };
  }

  async updateForClerkUser(
    clerkUserId: string,
    observationId: string,
    patch: { title?: string; content?: string },
  ): Promise<ObservationResponse> {
    const observation = await this.findOwned(clerkUserId, observationId);
    const title = patch.title?.trim();
    const content = patch.content;
    if (!title && content === undefined) {
      throw new BadRequestException({
        error: {
          code: 'EMPTY_UPDATE',
          message: 'Provide a title or memory text to save.',
        },
      });
    }
    if (content !== undefined && content.length > MAX_NOTE_CHARS) {
      throw new BadRequestException({
        error: {
          code: 'CONTENT_TOO_LONG',
          message: `Memory text exceeds ${MAX_NOTE_CHARS} characters.`,
        },
      });
    }

    const data: Prisma.ObservationUpdateInput = {};
    if (title) {
      data.originalFilename = applyEditedTitle(
        observation.originalFilename,
        title,
      );
    }
    const textChanged =
      content !== undefined && content !== (observation.extractedText ?? '');
    if (textChanged) {
      data.extractedText = content;
      data.processingStatus = ProcessingStatus.PENDING;
      data.processingError = null;
    }

    await this.prisma.observation.update({
      where: { id: observation.id },
      data,
    });

    if (textChanged) {
      this.scheduleReindex(observation.id, content ?? '');
    }

    const refreshed = await this.findOwned(clerkUserId, observationId);
    return toObservationResponse(refreshed);
  }

  async relatedForClerkUser(
    clerkUserId: string,
    observationId: string,
  ): Promise<RelatedMemoryItem[]> {
    const seed = await this.findOwned(clerkUserId, observationId);
    const topicIds = seed.observationTopics.map((row) => row.topic.id);
    const entityIds = seed.observationEntities.map((row) => row.entity.id);
    const projectIds = seed.projectObservations.map((row) => row.project.id);
    const seedTopicCount = topicIds.length;
    const seedEntityCount = entityIds.length;

    const similar = new Map<string, number>();
    const query =
      seed.summary?.trim() ||
      seed.extractedText?.trim().slice(0, 400) ||
      seed.originalFilename;
    try {
      const hits = await this.vectorSearch.searchText(seed.userId, query, {
        candidateLimit: 20,
        minSimilarity: 0.2,
        filters: { excludeObservationId: seed.id },
      });
      for (const hit of hits) {
        const current = similar.get(hit.observationId) ?? 0;
        if (hit.similarity > current)
          similar.set(hit.observationId, hit.similarity);
      }
    } catch {
      // Embeddings may be unconfigured; topic/entity overlap still works.
    }

    const overlapWhere: Prisma.ObservationWhereInput[] = [];
    if (topicIds.length > 0) {
      overlapWhere.push({
        observationTopics: { some: { topicId: { in: topicIds } } },
      });
    }
    if (entityIds.length > 0) {
      overlapWhere.push({
        observationEntities: { some: { entityId: { in: entityIds } } },
      });
    }
    if (projectIds.length > 0) {
      overlapWhere.push({
        projectObservations: { some: { projectId: { in: projectIds } } },
      });
    }

    const candidateIds = new Set<string>([...similar.keys()]);
    if (overlapWhere.length > 0) {
      const overlap = await this.prisma.observation.findMany({
        where: {
          userId: seed.userId,
          id: { not: seed.id },
          processingStatus: ProcessingStatus.COMPLETED,
          OR: overlapWhere,
        },
        select: { id: true },
        take: 20,
        orderBy: { capturedAt: 'desc' },
      });
      for (const row of overlap) candidateIds.add(row.id);
    }

    if (candidateIds.size === 0) return [];

    const candidates = await this.prisma.observation.findMany({
      where: { id: { in: [...candidateIds] }, userId: seed.userId },
      include: observationInclude,
    });

    const ranked = candidates
      .map((item) => {
        const sharedTopics = item.observationTopics.filter((row) =>
          topicIds.includes(row.topic.id),
        ).length;
        const sharedEntities = item.observationEntities.filter((row) =>
          entityIds.includes(row.entity.id),
        ).length;
        const sharedProject = item.projectObservations.some((row) =>
          projectIds.includes(row.project.id),
        );
        const hoursApart =
          Math.abs(item.capturedAt.getTime() - seed.capturedAt.getTime()) /
          36e5;
        const { score, reasons } = scoreRelatedMemory({
          similarity: similar.get(item.id),
          sharedTopicCount: sharedTopics,
          seedTopicCount,
          sharedEntityCount: sharedEntities,
          seedEntityCount,
          sharedProject,
          hoursApart,
        });
        return { item, score, reasons };
      })
      .filter((row) => shouldKeepRelated(row.score, row.reasons))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    return ranked.map(({ item, score, reasons }) => ({
      observationId: item.id,
      filename: item.originalFilename,
      snippet: (item.summary || item.extractedText || item.originalFilename)
        .trim()
        .slice(0, 180),
      capturedAt: item.capturedAt.toISOString(),
      sourceLabel: CAPTURE_SOURCE_LABELS[item.source] || item.source,
      score,
      reasons,
    }));
  }

  async getForClerkUser(
    clerkUserId: string,
    observationId: string,
  ): Promise<ObservationResponse> {
    const observation = await this.findOwned(clerkUserId, observationId);
    return toObservationResponse(observation);
  }

  async getFileForClerkUser(
    clerkUserId: string,
    observationId: string,
  ): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
    const observation = await this.findOwned(clerkUserId, observationId);
    const exists = await this.storage.exists(observation.storageKey);
    if (!exists) {
      throw new NotFoundException({
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'The original file could not be found in storage.',
        },
      });
    }
    const buffer = await this.storage.get(observation.storageKey);
    return {
      buffer,
      mimeType: observation.mimeType,
      filename: observation.originalFilename,
    };
  }

  async getDownloadUrlForClerkUser(
    clerkUserId: string,
    observationId: string,
  ): Promise<SignedDownload & { mode: 'signed' | 'stream' }> {
    const observation = await this.findOwned(clerkUserId, observationId);
    try {
      const signed = await this.storage.getSignedDownloadUrl(
        observation.storageKey,
        300,
      );
      return { ...signed, mode: 'signed' };
    } catch {
      return {
        url: `/observations/${observation.id}/file`,
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
        mode: 'stream',
      };
    }
  }

  async reprocessForClerkUser(
    clerkUserId: string,
    observationId: string,
  ): Promise<ObservationResponse> {
    const observation = await this.findOwned(clerkUserId, observationId);
    await this.prisma.observation.update({
      where: { id: observation.id },
      data: {
        processingStatus: ProcessingStatus.PENDING,
        processingError: null,
      },
    });
    this.scheduleProcess(observation.id);
    const refreshed = await this.findOwned(clerkUserId, observationId);
    return toObservationResponse(refreshed);
  }

  private scheduleProcess(observationId: string): void {
    if (this.jobs) {
      void this.jobs.enqueueProcess(observationId).catch(() => {
        void this.processor.process(observationId);
      });
      return;
    }
    void this.processor.process(observationId);
  }

  private scheduleReindex(observationId: string, text: string): void {
    if (this.jobs) {
      void this.jobs.enqueueReindex(observationId, text).catch(() => {
        void this.processor.reindexFromText(observationId, text);
      });
      return;
    }
    void this.processor.reindexFromText(observationId, text);
  }

  private async assertOwnedProject(
    userId: string,
    projectId?: string,
  ): Promise<void> {
    const id = projectId?.trim();
    if (!id) return;
    const project = await this.prisma.project.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!project) {
      throw new BadRequestException({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'That project was not found.',
        },
      });
    }
  }

  private async findOwned(clerkUserId: string, observationId: string) {
    const user = await this.users.findOrCreateByClerkId(clerkUserId);
    const observation = await this.prisma.observation.findFirst({
      where: {
        id: observationId,
        userId: user.id,
      },
      include: observationInclude,
    });

    if (!observation) {
      throw new NotFoundException({
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'The requested resource was not found.',
        },
      });
    }

    return observation;
  }
}

function buildStorageKey(userId: string, safeFilename: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `observations/${userId}/${stamp}/${randomUUID()}-${safeFilename}`;
}

function parseListDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function encodeObservationCursor(capturedAt: Date, id: string): string {
  return Buffer.from(`${capturedAt.toISOString()}|${id}`).toString('base64url');
}

function decodeObservationCursor(
  raw?: string,
): { capturedAt: Date; id: string } | undefined {
  if (!raw) return undefined;
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    const sep = decoded.lastIndexOf('|');
    if (sep <= 0) return undefined;
    const capturedAt = new Date(decoded.slice(0, sep));
    const id = decoded.slice(sep + 1);
    if (!id || Number.isNaN(capturedAt.getTime())) return undefined;
    return { capturedAt, id };
  } catch {
    return undefined;
  }
}

function applyEditedTitle(currentFilename: string, title: string): string {
  const ext = currentFilename.includes('.')
    ? currentFilename.slice(currentFilename.lastIndexOf('.'))
    : '';
  const safe = title
    .replace(/[\r\n\x00-\x1f\x7f\\/:*?"<>|]/g, '')
    .slice(0, 120)
    .trim();
  if (!safe) return currentFilename;
  if (ext && !safe.toLowerCase().endsWith(ext.toLowerCase())) {
    return `${safe}${ext}`;
  }
  return safe;
}

function slugFilename(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'note';
}
