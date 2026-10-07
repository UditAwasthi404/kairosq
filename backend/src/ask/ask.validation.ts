import { BadRequestException } from '@nestjs/common';
import type { CaptureSource, ObservationType } from '@prisma/client';
import { parseOptionalStringId } from '../metadata/resolve-filters';
import { parseOptionalCaptureSource } from '../observations/capture-source';

export const MAX_ASK_QUESTION_LENGTH = 500;
export const MAX_ASK_LIMIT = 10;
export const DEFAULT_ASK_LIMIT = 6;
export const MAX_CLIENT_REQUEST_ID_LENGTH = 120;

export type AskRequestBody = {
  question?: unknown;
  query?: unknown;
  limit?: unknown;
  conversationId?: unknown;
  clientRequestId?: unknown;
  filters?: {
    from?: unknown;
    to?: unknown;
    observationType?: unknown;
    mimeType?: unknown;
    topicId?: unknown;
    entityId?: unknown;
    projectId?: unknown;
    topic?: unknown;
    entity?: unknown;
    source?: unknown;
    observationId?: unknown;
  };
  topic?: unknown;
  entity?: unknown;
  projectId?: unknown;
  observationId?: unknown;
};

export type ValidatedAskRequest = {
  question: string;
  limit: number;
  conversationId?: string;
  clientRequestId?: string;
  filters: {
    from?: Date;
    to?: Date;
    observationType?: ObservationType;
    mimeType?: string;
    topicId?: string;
    entityId?: string;
    projectId?: string;
    topic?: string;
    entity?: string;
    source?: CaptureSource;
    observationId?: string;
  };
};

const OBSERVATION_TYPES = new Set(['DOCUMENT', 'PDF', 'IMAGE', 'TEXT', 'AUDIO']);

export function validateAskRequest(body: AskRequestBody): ValidatedAskRequest {
  const rawQuestion =
    typeof body.question === 'string'
      ? body.question
      : typeof body.query === 'string'
        ? body.query
        : null;

  if (rawQuestion === null) {
    throw badRequest('INVALID_QUESTION', 'Question must be a string.');
  }

  const question = rawQuestion.trim();
  if (!question) {
    throw badRequest('EMPTY_QUESTION', 'Question must not be empty.');
  }
  if (question.length > MAX_ASK_QUESTION_LENGTH) {
    throw badRequest(
      'QUESTION_TOO_LONG',
      `Question exceeds ${MAX_ASK_QUESTION_LENGTH} characters.`,
    );
  }

  let limit = DEFAULT_ASK_LIMIT;
  if (body.limit !== undefined && body.limit !== null) {
    if (typeof body.limit !== 'number' || !Number.isFinite(body.limit)) {
      throw badRequest('INVALID_LIMIT', 'Limit must be a number.');
    }
    limit = Math.floor(body.limit);
    if (limit < 1 || limit > MAX_ASK_LIMIT) {
      throw badRequest(
        'INVALID_LIMIT',
        `Limit must be between 1 and ${MAX_ASK_LIMIT}.`,
      );
    }
  }

  let conversationId: string | undefined;
  if (body.conversationId !== undefined && body.conversationId !== null) {
    if (
      typeof body.conversationId !== 'string' ||
      !body.conversationId.trim()
    ) {
      throw badRequest('INVALID_CONVERSATION', 'Invalid conversationId.');
    }
    conversationId = body.conversationId.trim();
  }

  let clientRequestId: string | undefined;
  if (body.clientRequestId !== undefined && body.clientRequestId !== null) {
    if (
      typeof body.clientRequestId !== 'string' ||
      !body.clientRequestId.trim()
    ) {
      throw badRequest('INVALID_REQUEST_ID', 'Invalid clientRequestId.');
    }
    clientRequestId = body.clientRequestId
      .trim()
      .slice(0, MAX_CLIENT_REQUEST_ID_LENGTH);
  }

  const filters = body.filters ?? {};
  const from = parseOptionalDate(filters.from, 'from');
  const to = parseOptionalDate(filters.to, 'to');
  if (from && to && from > to) {
    throw badRequest('INVALID_DATE_RANGE', '`from` must be before `to`.');
  }

  let observationType: ObservationType | undefined;
  if (
    filters.observationType !== undefined &&
    filters.observationType !== null
  ) {
    if (
      typeof filters.observationType !== 'string' ||
      !OBSERVATION_TYPES.has(filters.observationType)
    ) {
      throw badRequest('INVALID_FILTER', 'Invalid observationType filter.');
    }
    observationType = filters.observationType as ObservationType;
  }

  let mimeType: string | undefined;
  if (filters.mimeType !== undefined && filters.mimeType !== null) {
    if (typeof filters.mimeType !== 'string' || !filters.mimeType.trim()) {
      throw badRequest('INVALID_FILTER', 'Invalid mimeType filter.');
    }
    mimeType = filters.mimeType.trim().slice(0, 120);
  }

  const topicId = parseOptionalStringId(filters.topicId, 'topicId');
  const entityId = parseOptionalStringId(filters.entityId, 'entityId');
  const projectId = parseOptionalStringId(
    filters.projectId ?? body.projectId,
    'projectId',
  );
  const topic =
    parseOptionalStringId(filters.topic ?? body.topic, 'topic') ?? undefined;
  const entity =
    parseOptionalStringId(filters.entity ?? body.entity, 'entity') ?? undefined;
  const observationId = parseOptionalStringId(
    filters.observationId ?? body.observationId,
    'observationId',
  );
  let source: CaptureSource | undefined;
  if (filters.source !== undefined && filters.source !== null && filters.source !== '') {
    source = parseOptionalCaptureSource(filters.source);
    if (!source) {
      throw badRequest('INVALID_FILTER', 'Invalid source filter.');
    }
  }

  return {
    question,
    limit,
    conversationId,
    clientRequestId,
    filters: {
      from,
      to,
      observationType,
      mimeType,
      topicId,
      entityId,
      projectId,
      topic,
      entity,
      source,
      observationId,
    },
  };
}

function parseOptionalDate(value: unknown, field: string): Date | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw badRequest('INVALID_FILTER', `Invalid ${field} filter.`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw badRequest('INVALID_FILTER', `Invalid ${field} filter.`);
  }
  return date;
}

function badRequest(code: string, message: string): BadRequestException {
  return new BadRequestException({
    error: { code, message },
  });
}
