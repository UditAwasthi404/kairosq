import { BadRequestException } from '@nestjs/common';

export const MAX_RECALL_BATCH = 20;
export const MAX_EXTRACTED_TEXT_CHARS = 32_000;
export const MAX_CLIENT_EVENT_ID_LENGTH = 64;
export const MAX_FINGERPRINT_LENGTH = 128;
export const MAX_SESSION_ID_LENGTH = 64;
export const MAX_APP_PACKAGE_LENGTH = 255;
export const MAX_APP_LABEL_LENGTH = 120;
export const MAX_TITLE_LENGTH = 200;
export const MAX_URL_LENGTH = 2048;
export const MAX_VERSION_LENGTH = 32;
/** Reject client clocks more than this far from server time. */
export const MAX_CAPTURED_AT_SKEW_MS = 24 * 60 * 60 * 1000;
export const FINGERPRINT_DEDUPE_WINDOW_MS = 10 * 60 * 1000;
export const MAX_EVENTS_PER_MINUTE = 20;
export const MAX_EVENTS_PER_DAY = 500;
export const MAX_REQUEST_BODY_CHARS = 512_000;

export type RecallEventInput = {
  clientEventId?: unknown;
  capturedAt?: unknown;
  sessionId?: unknown;
  eventKind?: unknown;
  extractedText?: unknown;
  fingerprint?: unknown;
  appPackage?: unknown;
  appLabel?: unknown;
  url?: unknown;
  title?: unknown;
  ocrConfidence?: unknown;
  pipelineVersion?: unknown;
  clientProcessingVersion?: unknown;
  userId?: unknown;
  isPremium?: unknown;
  embedding?: unknown;
  embeddingVector?: unknown;
  screenshot?: unknown;
  imageBase64?: unknown;
};

export type ValidatedRecallEvent = {
  clientEventId: string;
  capturedAt: Date;
  sessionId?: string;
  eventKind: 'screen_text';
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

export type RecallEventBatchBody = {
  events?: unknown;
};

export type ValidatedRecallBatch = {
  events: ValidatedRecallEvent[];
};

function bad(code: string, message: string): never {
  throw new BadRequestException({ error: { code, message } });
}

function asOptionalString(
  value: unknown,
  field: string,
  max: number,
): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    bad('INVALID_RECALL_EVENT', `${field} must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > max) {
    bad('INVALID_RECALL_EVENT', `${field} exceeds ${max} characters.`);
  }
  return trimmed;
}

function asRequiredString(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || !value.trim()) {
    bad('INVALID_RECALL_EVENT', `${field} is required.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    bad('INVALID_RECALL_EVENT', `${field} exceeds ${max} characters.`);
  }
  return trimmed;
}

const CLIENT_EVENT_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const FINGERPRINT_RE = /^[A-Za-z0-9+/=_-]{8,128}$/;
const PACKAGE_RE = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;

export function validateRecallEvent(
  raw: RecallEventInput,
  now = new Date(),
): ValidatedRecallEvent {
  if (raw && typeof raw === 'object') {
    if ('userId' in raw && raw.userId !== undefined) {
      bad('INVALID_RECALL_EVENT', 'userId must not be provided.');
    }
    if ('isPremium' in raw && raw.isPremium !== undefined) {
      bad('INVALID_RECALL_EVENT', 'isPremium must not be provided.');
    }
    if (
      ('embedding' in raw && raw.embedding !== undefined) ||
      ('embeddingVector' in raw && raw.embeddingVector !== undefined) ||
      ('screenshot' in raw && raw.screenshot !== undefined) ||
      ('imageBase64' in raw && raw.imageBase64 !== undefined)
    ) {
      bad(
        'INVALID_RECALL_EVENT',
        'Raw media, embeddings, and premium flags are not accepted.',
      );
    }
  }

  const clientEventId = asRequiredString(
    raw.clientEventId,
    'clientEventId',
    MAX_CLIENT_EVENT_ID_LENGTH,
  );
  if (!CLIENT_EVENT_ID_RE.test(clientEventId)) {
    bad('INVALID_RECALL_EVENT', 'clientEventId format is invalid.');
  }

  if (typeof raw.capturedAt !== 'string' || !raw.capturedAt.trim()) {
    bad('INVALID_RECALL_EVENT', 'capturedAt is required.');
  }
  const capturedAt = new Date(raw.capturedAt);
  if (Number.isNaN(capturedAt.getTime())) {
    bad('INVALID_RECALL_EVENT', 'capturedAt must be a valid ISO timestamp.');
  }
  const skew = Math.abs(capturedAt.getTime() - now.getTime());
  if (skew > MAX_CAPTURED_AT_SKEW_MS) {
    bad(
      'INVALID_RECALL_EVENT',
      'capturedAt is outside the allowed time window.',
    );
  }

  const eventKind = asRequiredString(raw.eventKind, 'eventKind', 32);
  if (eventKind !== 'screen_text') {
    bad('INVALID_RECALL_EVENT', 'eventKind must be screen_text.');
  }

  const extractedText = asRequiredString(
    raw.extractedText,
    'extractedText',
    MAX_EXTRACTED_TEXT_CHARS,
  );

  const fingerprint = asRequiredString(
    raw.fingerprint,
    'fingerprint',
    MAX_FINGERPRINT_LENGTH,
  );
  if (!FINGERPRINT_RE.test(fingerprint)) {
    bad('INVALID_RECALL_EVENT', 'fingerprint format is invalid.');
  }

  const pipelineVersion = asRequiredString(
    raw.pipelineVersion,
    'pipelineVersion',
    MAX_VERSION_LENGTH,
  );
  const clientProcessingVersion = asRequiredString(
    raw.clientProcessingVersion,
    'clientProcessingVersion',
    MAX_VERSION_LENGTH,
  );

  const sessionId = asOptionalString(
    raw.sessionId,
    'sessionId',
    MAX_SESSION_ID_LENGTH,
  );
  const appPackage = asOptionalString(
    raw.appPackage,
    'appPackage',
    MAX_APP_PACKAGE_LENGTH,
  );
  if (appPackage && !PACKAGE_RE.test(appPackage) && appPackage.length > 3) {
    // Allow simple names in tests/dev but prefer package form.
    if (appPackage.includes(' ') || appPackage.includes('/')) {
      bad('INVALID_RECALL_EVENT', 'appPackage format is invalid.');
    }
  }
  const appLabel = asOptionalString(
    raw.appLabel,
    'appLabel',
    MAX_APP_LABEL_LENGTH,
  );
  const title = asOptionalString(raw.title, 'title', MAX_TITLE_LENGTH);

  let url: string | undefined;
  if (raw.url !== undefined && raw.url !== null && raw.url !== '') {
    url = asRequiredString(raw.url, 'url', MAX_URL_LENGTH);
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      bad('INVALID_RECALL_EVENT', 'url must be a valid http(s) URL.');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      bad('INVALID_RECALL_EVENT', 'url must use http or https.');
    }
    if (parsed.username || parsed.password) {
      bad('INVALID_RECALL_EVENT', 'url must not contain credentials.');
    }
  }

  let ocrConfidence: number | undefined;
  if (raw.ocrConfidence !== undefined && raw.ocrConfidence !== null) {
    if (
      typeof raw.ocrConfidence !== 'number' ||
      Number.isNaN(raw.ocrConfidence)
    ) {
      bad('INVALID_RECALL_EVENT', 'ocrConfidence must be a number.');
    }
    if (raw.ocrConfidence < 0 || raw.ocrConfidence > 1) {
      bad('INVALID_RECALL_EVENT', 'ocrConfidence must be between 0 and 1.');
    }
    ocrConfidence = raw.ocrConfidence;
  }

  return {
    clientEventId,
    capturedAt,
    sessionId,
    eventKind: 'screen_text',
    extractedText,
    fingerprint,
    appPackage,
    appLabel,
    url,
    title,
    ocrConfidence,
    pipelineVersion,
    clientProcessingVersion,
  };
}

export type PerEventValidation =
  | { ok: true; event: ValidatedRecallEvent }
  | { ok: false; clientEventId: string | null; reason: string };

export function validateRecallBatch(
  body: RecallEventBatchBody,
  now = new Date(),
): { events: PerEventValidation[]; rejectedBatch?: string } {
  if (!body || typeof body !== 'object' || !Array.isArray(body.events)) {
    return { events: [], rejectedBatch: 'events must be an array.' };
  }
  if (body.events.length === 0) {
    return { events: [], rejectedBatch: 'events must not be empty.' };
  }
  if (body.events.length > MAX_RECALL_BATCH) {
    return {
      events: [],
      rejectedBatch: `At most ${MAX_RECALL_BATCH} events per batch.`,
    };
  }

  const approxSize = JSON.stringify(body).length;
  if (approxSize > MAX_REQUEST_BODY_CHARS) {
    return { events: [], rejectedBatch: 'Request body too large.' };
  }

  return {
    events: body.events.map((item) => {
      const raw = (item ?? {}) as RecallEventInput;
      const idHint =
        typeof raw.clientEventId === 'string'
          ? raw.clientEventId.slice(0, 64)
          : null;
      try {
        return { ok: true as const, event: validateRecallEvent(raw, now) };
      } catch (err) {
        const message =
          err instanceof BadRequestException
            ? ((err.getResponse() as { error?: { message?: string } })?.error
                ?.message ?? 'Invalid event.')
            : 'Invalid event.';
        return {
          ok: false as const,
          clientEventId: idHint,
          reason: message,
        };
      }
    }),
  };
}
