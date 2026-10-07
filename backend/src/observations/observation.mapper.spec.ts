import {
  CaptureSource,
  ObservationType,
  ProcessingStatus,
} from '@prisma/client';
import {
  stageLabelForStatus,
  toObservationResponse,
} from './observation.mapper';

describe('observation.mapper', () => {
  const now = new Date('2026-09-12T12:42:00.000Z');

  function base(overrides: Record<string, unknown> = {}) {
    return {
      id: 'obs_1',
      userId: 'user_a',
      type: ObservationType.PDF,
      originalFilename: 'research-paper.pdf',
      mimeType: 'application/pdf',
      storageKey: 'key',
      fileSizeBytes: 100,
      processingStatus: ProcessingStatus.EMBEDDING,
      extractedText: null,
      summary: null,
      processingError: null,
      source: CaptureSource.MANUAL,
      sourceMetadata: null,
      pageCount: null,
      characterCount: null,
      wordCount: null,
      chunkCount: null,
      capturedAt: now,
      createdAt: now,
      updatedAt: now,
      observationTopics: [],
      observationEntities: [],
      projectObservations: [],
      _count: { chunks: 0 },
      ...overrides,
    };
  }

  it('exposes READY status fields for COMPLETED observations', () => {
    const response = toObservationResponse(
      base({ processingStatus: ProcessingStatus.COMPLETED }),
    );
    expect(response.status).toBe(ProcessingStatus.COMPLETED);
    expect(response.stageLabel).toBe('Memory ready');
    expect(response.processedAt).toBe(now.toISOString());
  });

  it('exposes PROCESSING stage labels without fabricating progress', () => {
    expect(stageLabelForStatus(ProcessingStatus.PENDING)).toBe('Saved');
    expect(stageLabelForStatus(ProcessingStatus.EXTRACTING)).toBe(
      'Processing memory…',
    );
    expect(stageLabelForStatus(ProcessingStatus.EXTRACTING, ObservationType.AUDIO)).toBe(
      'Transcribing…',
    );
    expect(stageLabelForStatus(ProcessingStatus.EMBEDDING)).toBe(
      'Processing memory…',
    );
    const response = toObservationResponse(base());
    expect(response.status).toBe(ProcessingStatus.EMBEDDING);
    expect(response.stageLabel).toBe('Processing memory…');
    expect(response.processedAt).toBeNull();
  });

  it('exposes FAILED status with processingError', () => {
    const response = toObservationResponse(
      base({
        processingStatus: ProcessingStatus.FAILED,
        processingError: 'No extractor for type',
      }),
    );
    expect(response.status).toBe(ProcessingStatus.FAILED);
    expect(response.stageLabel).toBe("Couldn't process");
    expect(response.processingError).toBe('No extractor for type');
    expect(response.processedAt).toBeNull();
  });
});
