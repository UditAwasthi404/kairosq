import { BadRequestException } from '@nestjs/common';
import {
  MAX_EXTRACTED_TEXT_CHARS,
  MAX_RECALL_BATCH,
  validateRecallBatch,
  validateRecallEvent,
} from './recall.validation';

function baseEvent(overrides: Record<string, unknown> = {}) {
  return {
    clientEventId: 'evt_abc12345',
    capturedAt: new Date().toISOString(),
    eventKind: 'screen_text',
    extractedText: 'Pull request #42 review notes about hybrid retrieval',
    fingerprint: 'a'.repeat(32),
    pipelineVersion: '1.0.0',
    clientProcessingVersion: '1.0.0',
    ...overrides,
  };
}

describe('recall.validation', () => {
  it('accepts a valid event', () => {
    const event = validateRecallEvent(baseEvent());
    expect(event.eventKind).toBe('screen_text');
    expect(event.extractedText.length).toBeGreaterThan(0);
  });

  it('rejects userId and isPremium', () => {
    expect(() => validateRecallEvent(baseEvent({ userId: 'u1' }))).toThrow(
      BadRequestException,
    );
    expect(() => validateRecallEvent(baseEvent({ isPremium: true }))).toThrow(
      BadRequestException,
    );
  });

  it('rejects raw screenshot / embedding fields', () => {
    expect(() =>
      validateRecallEvent(baseEvent({ imageBase64: 'AAAA' })),
    ).toThrow(BadRequestException);
    expect(() =>
      validateRecallEvent(baseEvent({ embedding: [0.1, 0.2] })),
    ).toThrow(BadRequestException);
  });

  it('rejects oversized extractedText', () => {
    expect(() =>
      validateRecallEvent(
        baseEvent({ extractedText: 'x'.repeat(MAX_EXTRACTED_TEXT_CHARS + 1) }),
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects credentialed URLs', () => {
    expect(() =>
      validateRecallEvent(
        baseEvent({ url: 'https://user:pass@example.com/path' }),
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects timestamps outside skew window', () => {
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    expect(() => validateRecallEvent(baseEvent({ capturedAt: old }))).toThrow(
      BadRequestException,
    );
  });

  it('rejects invalid ocrConfidence', () => {
    expect(() =>
      validateRecallEvent(baseEvent({ ocrConfidence: 1.5 })),
    ).toThrow(BadRequestException);
  });

  it('validates batches with per-event partial failures', () => {
    const result = validateRecallBatch({
      events: [
        baseEvent({ clientEventId: 'evt_ok_00001' }),
        baseEvent({ clientEventId: 'bad', extractedText: '' }),
      ],
    });
    expect(result.rejectedBatch).toBeUndefined();
    expect(result.events).toHaveLength(2);
    expect(result.events[0].ok).toBe(true);
    expect(result.events[1].ok).toBe(false);
  });

  it('rejects oversized batches', () => {
    const events = Array.from({ length: MAX_RECALL_BATCH + 1 }, (_, i) =>
      baseEvent({ clientEventId: `evt_batch_${String(i).padStart(4, '0')}` }),
    );
    const result = validateRecallBatch({ events });
    expect(result.rejectedBatch).toMatch(/At most/);
  });
});
