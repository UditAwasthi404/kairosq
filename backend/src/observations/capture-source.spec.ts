import { CaptureSource } from '@prisma/client';
import { parseCaptureSource, parseOptionalCapturedAt } from './capture-source';

describe('parseCaptureSource', () => {
  it('normalizes known sources', () => {
    expect(parseCaptureSource('voice')).toBe(CaptureSource.VOICE);
    expect(parseCaptureSource('quick-capture')).toBe(
      CaptureSource.QUICK_CAPTURE,
    );
    expect(parseCaptureSource('SHARE')).toBe(CaptureSource.SHARE);
    expect(parseCaptureSource('keyboard')).toBe(CaptureSource.KEYBOARD);
    expect(parseCaptureSource('widget')).toBe(CaptureSource.WIDGET);
  });

  it('maps aliases and falls back', () => {
    expect(parseCaptureSource('note')).toBe(CaptureSource.MANUAL);
    expect(parseCaptureSource('unknown', CaptureSource.SHARE)).toBe(
      CaptureSource.SHARE,
    );
    expect(parseCaptureSource(undefined)).toBe(CaptureSource.MANUAL);
  });
});

describe('parseOptionalCapturedAt', () => {
  it('accepts recent ISO timestamps', () => {
    const iso = new Date().toISOString();
    expect(parseOptionalCapturedAt(iso)?.toISOString()).toBe(iso);
  });

  it('rejects invalid and ancient dates', () => {
    expect(parseOptionalCapturedAt('not-a-date')).toBeUndefined();
    expect(parseOptionalCapturedAt('1990-01-01T00:00:00.000Z')).toBeUndefined();
  });
});
