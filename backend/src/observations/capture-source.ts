import { CaptureSource } from '@prisma/client';

export const CAPTURE_SOURCES: CaptureSource[] = [
  CaptureSource.MANUAL,
  CaptureSource.KEYBOARD,
  CaptureSource.SHARE,
  CaptureSource.QUICK_CAPTURE,
  CaptureSource.VOICE,
  CaptureSource.WIDGET,
  CaptureSource.RECALL,
];

export const CAPTURE_SOURCE_LABELS: Record<CaptureSource, string> = {
  MANUAL: 'Manual',
  KEYBOARD: 'Keyboard',
  SHARE: 'Share',
  QUICK_CAPTURE: 'Quick capture',
  VOICE: 'Voice',
  WIDGET: 'Widget',
  RECALL: 'Recall',
};

const SOURCE_ALIASES: Record<string, CaptureSource> = {
  NOTE: CaptureSource.MANUAL,
  URL: CaptureSource.MANUAL,
  LINK: CaptureSource.SHARE,
  TEXT: CaptureSource.MANUAL,
  QUICK: CaptureSource.QUICK_CAPTURE,
  QUICKCAPTURE: CaptureSource.QUICK_CAPTURE,
  HOME_SCREEN: CaptureSource.WIDGET,
  IME: CaptureSource.KEYBOARD,
  SCREENSHOT: CaptureSource.SHARE,
  CHROME: CaptureSource.SHARE,
};

export function parseCaptureSource(
  value: string | undefined | null,
  fallback: CaptureSource = CaptureSource.MANUAL,
): CaptureSource {
  return parseOptionalCaptureSource(value) ?? fallback;
}

export function parseOptionalCaptureSource(
  value: unknown,
): CaptureSource | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (SOURCE_ALIASES[normalized]) return SOURCE_ALIASES[normalized];
  return (CAPTURE_SOURCES as string[]).includes(normalized)
    ? (normalized as CaptureSource)
    : undefined;
}

export function parseOptionalCapturedAt(
  value: string | undefined | null,
): Date | undefined {
  if (!value || typeof value !== 'string') return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  const skewMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  if (date.getTime() > now + skewMs || date.getTime() < now - 365 * skewMs) {
    return undefined;
  }
  return date;
}
