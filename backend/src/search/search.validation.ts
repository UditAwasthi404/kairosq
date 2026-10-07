import { BadRequestException } from '@nestjs/common';
import type { CaptureSource, ObservationType } from '@prisma/client';
import { parseOptionalStringId } from '../metadata/resolve-filters';
import { parseOptionalCaptureSource } from '../observations/capture-source';

export const MAX_SEARCH_QUERY_LENGTH = 500;
export const MAX_SEARCH_LIMIT = 20;
export const DEFAULT_SEARCH_LIMIT = 10;

export type SearchRequestBody = {
  query?: unknown;
  limit?: unknown;
  /** Optional convenience aliases for filters.topic / filters.entity / filters.projectId */
  topic?: unknown;
  entity?: unknown;
  projectId?: unknown;
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
    excludeObservationId?: unknown;
  };
};

export type ValidatedSearchRequest = {
  query: string;
  limit: number;
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
    excludeObservationId?: string;
  };
};

const OBSERVATION_TYPES = new Set(['DOCUMENT', 'PDF', 'IMAGE', 'TEXT', 'AUDIO']);

export function validateSearchRequest(
  body: SearchRequestBody,
): ValidatedSearchRequest {
  if (typeof body.query !== 'string') {
    throw badRequest('INVALID_QUERY', 'Query must be a string.');
  }

  const query = body.query.trim();
  if (!query) {
    throw badRequest('EMPTY_QUERY', 'Query must not be empty.');
  }
  if (query.length > MAX_SEARCH_QUERY_LENGTH) {
    throw badRequest(
      'QUERY_TOO_LONG',
      `Query exceeds ${MAX_SEARCH_QUERY_LENGTH} characters.`,
    );
  }

  let limit = DEFAULT_SEARCH_LIMIT;
  if (body.limit !== undefined && body.limit !== null) {
    if (typeof body.limit !== 'number' || !Number.isFinite(body.limit)) {
      throw badRequest('INVALID_LIMIT', 'Limit must be a number.');
    }
    limit = Math.floor(body.limit);
    if (limit < 1 || limit > MAX_SEARCH_LIMIT) {
      throw badRequest(
        'INVALID_LIMIT',
        `Limit must be between 1 and ${MAX_SEARCH_LIMIT}.`,
      );
    }
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
    filters.observationId,
    'observationId',
  );
  const excludeObservationId = parseOptionalStringId(
    filters.excludeObservationId,
    'excludeObservationId',
  );
  let source: CaptureSource | undefined;
  if (filters.source !== undefined && filters.source !== null && filters.source !== '') {
    source = parseOptionalCaptureSource(filters.source);
    if (!source) {
      throw badRequest('INVALID_FILTER', 'Invalid source filter.');
    }
  }

  return {
    query,
    limit,
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
      excludeObservationId,
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
