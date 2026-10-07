import type {
  CaptureSource,
  Entity,
  EntityType,
  Observation,
  ObservationType,
  ProcessingStatus,
  Project,
  Topic,
} from '@prisma/client';
import { CAPTURE_SOURCE_LABELS } from './capture-source';

export type ObservationTopicResponse = {
  id: string;
  name: string;
  confidence: number | null;
};

export type ObservationEntityResponse = {
  id: string;
  name: string;
  type: EntityType;
  confidence: number | null;
};

export type ObservationProjectResponse = {
  id: string;
  name: string;
};

export type ObservationMetadataResponse = {
  filename: string;
  mimeType: string;
  fileSizeBytes: number;
  pageCount: number | null;
  characterCount: number | null;
  wordCount: number | null;
  chunkCount: number | null;
};

export type ObservationResponse = {
  id: string;
  filename: string;
  mimeType: string;
  type: ObservationType;
  source: CaptureSource;
  sourceLabel: string;
  status: ProcessingStatus;
  /** Human-readable stage derived from processingStatus — not a second state machine. */
  stageLabel: string;
  createdAt: string;
  updatedAt: string;
  capturedAt: string;
  /** ISO timestamp when processing reached COMPLETED; null otherwise. */
  processedAt: string | null;
  extractedText: string | null;
  summary: string | null;
  processingError: string | null;
  sourceMetadata: Record<string, unknown> | null;
  metadata: ObservationMetadataResponse;
  topics: ObservationTopicResponse[];
  entities: ObservationEntityResponse[];
  projects: ObservationProjectResponse[];
  chunkCount: number;
};

/** Truthful labels from existing ProcessingStatus — never invent percentages. */
export function stageLabelForStatus(
  status: ProcessingStatus,
  type?: ObservationType,
): string {
  switch (status) {
    case 'PENDING':
      return 'Saved';
    case 'EXTRACTING':
      return type === 'AUDIO' ? 'Transcribing…' : 'Processing memory…';
    case 'PROCESSING':
    case 'NORMALIZING':
    case 'CHUNKING':
    case 'ANALYZING':
    case 'EMBEDDING':
      return 'Processing memory…';
    case 'COMPLETED':
      return 'Memory ready';
    case 'FAILED':
      return type === 'AUDIO' ? "Couldn't transcribe" : "Couldn't process";
    default:
      return 'Processing memory…';
  }
}

type ObservationWithRelations = Observation & {
  observationTopics?: Array<{
    confidence: number | null;
    topic: Topic;
  }>;
  observationEntities?: Array<{
    confidence: number | null;
    entity: Entity;
  }>;
  projectObservations?: Array<{
    project: Project;
  }>;
  _count?: { chunks?: number };
};

export function toObservationResponse(
  observation: ObservationWithRelations,
): ObservationResponse {
  const topics = (observation.observationTopics ?? []).map((row) => ({
    id: row.topic.id,
    name: row.topic.name,
    confidence: row.confidence,
  }));
  const entities = (observation.observationEntities ?? []).map((row) => ({
    id: row.entity.id,
    name: row.entity.name,
    type: row.entity.type,
    confidence: row.confidence,
  }));
  const projects = (observation.projectObservations ?? []).map((row) => ({
    id: row.project.id,
    name: row.project.name,
  }));

  const status = observation.processingStatus;
  return {
    id: observation.id,
    filename: observation.originalFilename,
    mimeType: observation.mimeType,
    type: observation.type,
    source: observation.source ?? 'MANUAL',
    sourceLabel:
      CAPTURE_SOURCE_LABELS[observation.source ?? 'MANUAL'] || 'Manual',
    status,
    stageLabel: stageLabelForStatus(status, observation.type),
    createdAt: observation.createdAt.toISOString(),
    updatedAt: observation.updatedAt.toISOString(),
    capturedAt: observation.capturedAt.toISOString(),
    processedAt:
      status === 'COMPLETED' ? observation.updatedAt.toISOString() : null,
    extractedText: observation.extractedText,
    summary: observation.summary,
    processingError: observation.processingError,
    sourceMetadata:
      observation.sourceMetadata &&
      typeof observation.sourceMetadata === 'object'
        ? (observation.sourceMetadata as Record<string, unknown>)
        : null,
    metadata: {
      filename: observation.originalFilename,
      mimeType: observation.mimeType,
      fileSizeBytes: observation.fileSizeBytes,
      pageCount: observation.pageCount,
      characterCount: observation.characterCount,
      wordCount: observation.wordCount,
      chunkCount: observation.chunkCount,
    },
    topics,
    entities,
    projects,
    chunkCount: observation.chunkCount ?? observation._count?.chunks ?? 0,
  };
}
