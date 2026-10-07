import { ObservationType, ProcessingStatus } from '@prisma/client';
import { ObservationProcessor } from './observation.processor';

describe('ObservationProcessor', () => {
  function buildProcessor(overrides?: {
    aiConfigured?: boolean;
    embeddingConfigured?: boolean;
    analyzeImpl?: () => Promise<unknown>;
  }) {
    const updates: unknown[] = [];
    const prisma = {
      observation: {
        findUnique: jest.fn(),
        update: jest.fn(async ({ data }: { data: unknown }) => {
          updates.push(data);
          return {};
        }),
      },
      observationChunk: {
        deleteMany: jest.fn().mockResolvedValue({}),
        createMany: jest.fn().mockResolvedValue({}),
      },
      observationTopic: {
        deleteMany: jest.fn().mockResolvedValue({}),
      },
      observationEntity: {
        deleteMany: jest.fn().mockResolvedValue({}),
      },
      topic: { upsert: jest.fn() },
      entity: { upsert: jest.fn() },
      $executeRaw: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn(async (arg: unknown) => {
        if (typeof arg === 'function') {
          return (arg as (tx: typeof prisma) => Promise<unknown>)(prisma);
        }
        return Promise.all(arg as Promise<unknown>[]);
      }),
    };

    const storage = {
      upload: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
      getSignedDownloadUrl: jest.fn(),
    };

    const ai = {
      name: 'test-ai',
      isConfigured: jest.fn(() => overrides?.aiConfigured ?? false),
      summarize: jest.fn(),
      extractTopics: jest.fn(),
      extractEntities: jest.fn(),
      analyzeDocument:
        overrides?.analyzeImpl ??
        jest.fn().mockResolvedValue({
          summary: 'A useful summary of the document.',
          topics: [{ name: 'Kairos' }],
          entities: [{ name: 'NestJS', type: 'TECHNOLOGY' }],
          provider: 'test-ai',
          model: 'test',
        }),
      generateGroundedAnswer: jest.fn(),
      transcribeAudio: jest.fn().mockResolvedValue({
        text: 'transcribed speech',
        provider: 'test-ai',
        model: 'whisper-1',
      }),
    };

    const embeddingProvider = {
      name: 'test-embed',
      model: 'test-model',
      dimensions: 1536,
      isConfigured: jest.fn(() => overrides?.embeddingConfigured ?? true),
      embedText: jest.fn(),
      embedTexts: jest.fn(),
    };

    const chunkEmbeddings = {
      embedMissingChunks: jest.fn().mockResolvedValue({
        totalEligible: 1,
        alreadyEmbedded: 0,
        newlyEmbedded: 1,
      }),
    };

    const notifications = {
      notifyObservationSettled: jest.fn().mockResolvedValue(undefined),
    };

    const processor = new ObservationProcessor(
      prisma as never,
      storage,
      ai as never,
      embeddingProvider,
      chunkEmbeddings as never,
      notifications as never,
    );

    return {
      prisma,
      storage,
      ai,
      embeddingProvider,
      chunkEmbeddings,
      processor,
      updates,
    };
  }

  it('saves extracted text, chunks, embeddings, and marks COMPLETED', async () => {
    const { prisma, storage, processor, chunkEmbeddings, updates } =
      buildProcessor({
        aiConfigured: false,
        embeddingConfigured: true,
      });

    prisma.observation.findUnique
      .mockResolvedValueOnce({
        id: 'obs_1',
        userId: 'user_a',
        type: ObservationType.TEXT,
        mimeType: 'text/plain',
        storageKey: 'k',
        processingStatus: ProcessingStatus.PENDING,
        sourceMetadata: {},
      })
      .mockResolvedValue({
        id: 'obs_1',
        sourceMetadata: { extraction: {} },
      });

    storage.get.mockResolvedValue(Buffer.from('  hello\r\n\r\nworld  '));

    await processor.process('obs_1');

    expect(chunkEmbeddings.embedMissingChunks).toHaveBeenCalledWith('obs_1');
    expect(
      updates.some(
        (u) =>
          (u as { processingStatus?: string }).processingStatus ===
          ProcessingStatus.COMPLETED,
      ),
    ).toBe(true);
  });

  it('marks FAILED when extraction throws', async () => {
    const { prisma, storage, processor, updates } = buildProcessor();

    prisma.observation.findUnique.mockResolvedValue({
      id: 'obs_fail',
      userId: 'user_a',
      type: ObservationType.PDF,
      mimeType: 'application/pdf',
      storageKey: 'k',
      processingStatus: ProcessingStatus.PENDING,
      sourceMetadata: {},
    });
    storage.get.mockRejectedValue(new Error('disk exploded'));

    await processor.process('obs_fail');

    expect(
      updates.some(
        (u) =>
          (u as { processingStatus?: string }).processingStatus ===
            ProcessingStatus.FAILED &&
          typeof (u as { processingError?: string }).processingError ===
            'string',
      ),
    ).toBe(true);
  });

  it('keeps extracted content when AI analysis fails and still embeds', async () => {
    const { prisma, storage, processor, chunkEmbeddings, updates } =
      buildProcessor({
        aiConfigured: true,
        embeddingConfigured: true,
        analyzeImpl: () => Promise.reject(new Error('AI rate limit exceeded')),
      });

    prisma.observation.findUnique
      .mockResolvedValueOnce({
        id: 'obs_ai',
        userId: 'user_a',
        type: ObservationType.TEXT,
        mimeType: 'text/plain',
        storageKey: 'k',
        processingStatus: ProcessingStatus.PENDING,
        sourceMetadata: {},
      })
      .mockResolvedValue({
        id: 'obs_ai',
        sourceMetadata: { extraction: {} },
      });
    storage.get.mockResolvedValue(Buffer.from('Document about retrieval.'));

    await processor.process('obs_ai');

    expect(chunkEmbeddings.embedMissingChunks).toHaveBeenCalled();
    expect(
      updates.some(
        (u) =>
          (u as { processingStatus?: string }).processingStatus ===
          ProcessingStatus.COMPLETED,
      ),
    ).toBe(true);
  });

  it('fails when embeddings are required but provider is missing', async () => {
    const { prisma, storage, processor, updates } = buildProcessor({
      embeddingConfigured: false,
    });

    prisma.observation.findUnique
      .mockResolvedValueOnce({
        id: 'obs_no_embed',
        userId: 'user_a',
        type: ObservationType.TEXT,
        mimeType: 'text/plain',
        storageKey: 'k',
        processingStatus: ProcessingStatus.PENDING,
        sourceMetadata: {},
      })
      .mockResolvedValue({
        id: 'obs_no_embed',
        sourceMetadata: {},
      });
    storage.get.mockResolvedValue(Buffer.from('needs embeddings'));

    await processor.process('obs_no_embed');

    expect(
      updates.some(
        (u) =>
          (u as { processingStatus?: string }).processingStatus ===
          ProcessingStatus.FAILED,
      ),
    ).toBe(true);
  });
});
