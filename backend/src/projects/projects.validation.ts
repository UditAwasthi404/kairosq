import { BadRequestException } from '@nestjs/common';

export const MAX_PROJECT_NAME_LENGTH = 120;
export const MAX_PROJECT_DESCRIPTION_LENGTH = 2000;
export const MAX_BULK_OBSERVATION_IDS = 50;

export type CreateProjectBody = {
  name?: unknown;
  description?: unknown;
};

export type UpdateProjectBody = {
  name?: unknown;
  description?: unknown;
};

export type AddObservationBody = {
  observationId?: unknown;
};

export type BulkAddObservationsBody = {
  observationIds?: unknown;
};

export type ValidatedCreateProject = {
  name: string;
  description: string | null;
};

export type ValidatedUpdateProject = {
  name?: string;
  description?: string | null;
};

export function validateCreateProject(
  body: CreateProjectBody,
): ValidatedCreateProject {
  const name = parseRequiredName(body.name);
  const description = parseOptionalDescription(body.description);
  return { name, description };
}

export function validateUpdateProject(
  body: UpdateProjectBody,
): ValidatedUpdateProject {
  const out: ValidatedUpdateProject = {};
  if (body.name !== undefined) {
    out.name = parseRequiredName(body.name);
  }
  if (body.description !== undefined) {
    out.description = parseOptionalDescription(body.description);
  }
  if (out.name === undefined && out.description === undefined) {
    throw badRequest(
      'EMPTY_UPDATE',
      'Provide at least one of name or description.',
    );
  }
  return out;
}

export function validateAddObservation(body: AddObservationBody): string {
  if (typeof body.observationId !== 'string' || !body.observationId.trim()) {
    throw badRequest('INVALID_OBSERVATION', 'observationId is required.');
  }
  return body.observationId.trim();
}

export function validateBulkAddObservations(
  body: BulkAddObservationsBody,
): string[] {
  if (!Array.isArray(body.observationIds)) {
    throw badRequest(
      'INVALID_OBSERVATIONS',
      'observationIds must be an array.',
    );
  }
  if (body.observationIds.length === 0) {
    throw badRequest('EMPTY_OBSERVATIONS', 'observationIds must not be empty.');
  }
  if (body.observationIds.length > MAX_BULK_OBSERVATION_IDS) {
    throw badRequest(
      'TOO_MANY_OBSERVATIONS',
      `At most ${MAX_BULK_OBSERVATION_IDS} observationIds allowed.`,
    );
  }

  const ids: string[] = [];
  const seen = new Set<string>();
  for (const value of body.observationIds) {
    if (typeof value !== 'string' || !value.trim()) {
      throw badRequest(
        'INVALID_OBSERVATION',
        'Each observationId must be a non-empty string.',
      );
    }
    const id = value.trim();
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function parseRequiredName(value: unknown): string {
  if (typeof value !== 'string') {
    throw badRequest('INVALID_NAME', 'Project name must be a string.');
  }
  const name = value.trim();
  if (!name) {
    throw badRequest('EMPTY_NAME', 'Project name must not be empty.');
  }
  if (name.length > MAX_PROJECT_NAME_LENGTH) {
    throw badRequest(
      'NAME_TOO_LONG',
      `Project name exceeds ${MAX_PROJECT_NAME_LENGTH} characters.`,
    );
  }
  return name;
}

function parseOptionalDescription(value: unknown): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    throw badRequest(
      'INVALID_DESCRIPTION',
      'Project description must be a string.',
    );
  }
  const description = value.trim();
  if (description.length > MAX_PROJECT_DESCRIPTION_LENGTH) {
    throw badRequest(
      'DESCRIPTION_TOO_LONG',
      `Project description exceeds ${MAX_PROJECT_DESCRIPTION_LENGTH} characters.`,
    );
  }
  return description.length > 0 ? description : null;
}

function badRequest(code: string, message: string): BadRequestException {
  return new BadRequestException({
    error: { code, message },
  });
}
