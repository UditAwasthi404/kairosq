import { BadRequestException } from '@nestjs/common';
import type {
  DocumentAnalysis,
  ExtractedEntity,
  ExtractedTopic,
} from './ai.types';

const ENTITY_TYPES = new Set([
  'PERSON',
  'ORGANIZATION',
  'TECHNOLOGY',
  'PRODUCT',
  'LOCATION',
  'CONCEPT',
]);

export function validateSummary(value: unknown): string {
  if (typeof value !== 'string') {
    throw invalidAi('summary must be a string');
  }
  const summary = value.replace(/\s+/g, ' ').trim();
  if (summary.length < 8 || summary.length > 4000) {
    throw invalidAi('summary length is invalid');
  }
  return summary;
}

export function validateTopics(value: unknown): ExtractedTopic[] {
  if (!Array.isArray(value)) {
    throw invalidAi('topics must be an array');
  }
  const topics: ExtractedTopic[] = [];
  for (const item of value.slice(0, 12)) {
    const row = asRecord(item);
    if (!row) continue;
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    if (name.length < 2 || name.length > 80) continue;
    const confidence = readConfidence(row);
    topics.push({ name, confidence });
  }
  return dedupeTopics(topics);
}

export function validateEntities(value: unknown): ExtractedEntity[] {
  if (!Array.isArray(value)) {
    throw invalidAi('entities must be an array');
  }
  const entities: ExtractedEntity[] = [];
  for (const item of value.slice(0, 30)) {
    const row = asRecord(item);
    if (!row) continue;
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    const typeRaw =
      typeof row.type === 'string' ? row.type.trim().toUpperCase() : '';
    if (name.length < 2 || name.length > 120) continue;
    if (!ENTITY_TYPES.has(typeRaw)) continue;
    entities.push({
      name,
      type: typeRaw as ExtractedEntity['type'],
      confidence: readConfidence(row),
    });
  }
  return dedupeEntities(entities);
}

export function validateDocumentAnalysis(
  value: unknown,
  meta: { provider: string; model: string },
): DocumentAnalysis {
  if (!value || typeof value !== 'object') {
    throw invalidAi('analysis payload must be an object');
  }
  const obj = value as Record<string, unknown>;
  return {
    summary: validateSummary(obj.summary),
    topics: validateTopics(obj.topics ?? []),
    entities: validateEntities(obj.entities ?? []),
    provider: meta.provider,
    model: meta.model,
  };
}

/** Validates structured grounded-answer JSON from the LLM. */
export function validateGroundedAnswerPayload(
  value: unknown,
  allowedRefs: Set<number>,
): { answer: string; citationRefs: number[] } {
  if (!value || typeof value !== 'object') {
    throw invalidAi('grounded answer must be an object');
  }
  const obj = value as Record<string, unknown>;
  if (typeof obj.answer !== 'string') {
    throw invalidAi('answer must be a string');
  }
  const answer = obj.answer.replace(/\s+/g, ' ').trim();
  if (answer.length < 1 || answer.length > 8000) {
    throw invalidAi('answer length is invalid');
  }

  const rawCitations = obj.citations ?? obj.citationRefs ?? [];
  if (!Array.isArray(rawCitations)) {
    throw invalidAi('citations must be an array');
  }

  const citationRefs: number[] = [];
  const seen = new Set<number>();
  for (const item of rawCitations) {
    const ref = parseCitationRef(item);
    if (ref === null) continue;
    if (!allowedRefs.has(ref)) continue;
    if (seen.has(ref)) continue;
    seen.add(ref);
    citationRefs.push(ref);
  }

  return { answer, citationRefs };
}

export function parseCitationRef(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const bracket = trimmed.match(/^\[(\d+)\]$/);
    const raw = bracket ? bracket[1] : trimmed;
    const n = Number.parseInt(raw, 10);
    if (Number.isInteger(n) && n >= 1 && String(n) === raw) {
      return n;
    }
  }
  return null;
}

function readConfidence(item: object): number | undefined {
  const confidence = (item as { confidence?: unknown }).confidence;
  if (typeof confidence !== 'number' || Number.isNaN(confidence)) {
    return undefined;
  }
  return Math.min(1, Math.max(0, confidence));
}

function asRecord(item: unknown): Record<string, unknown> | null {
  if (!item || typeof item !== 'object') return null;
  return item as Record<string, unknown>;
}

function dedupeTopics(topics: ExtractedTopic[]): ExtractedTopic[] {
  const seen = new Set<string>();
  const out: ExtractedTopic[] = [];
  for (const topic of topics) {
    const key = topic.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(topic);
  }
  return out;
}

function dedupeEntities(entities: ExtractedEntity[]): ExtractedEntity[] {
  const seen = new Set<string>();
  const out: ExtractedEntity[] = [];
  for (const entity of entities) {
    const key = `${entity.type}:${entity.name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entity);
  }
  return out;
}

function invalidAi(message: string): BadRequestException {
  return new BadRequestException({
    error: {
      code: 'INVALID_AI_OUTPUT',
      message,
    },
  });
}
