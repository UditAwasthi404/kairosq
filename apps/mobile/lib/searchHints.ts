import type { CaptureSource } from './api';

export type SearchHints = {
  query: string;
  from?: string;
  to?: string;
  source?: CaptureSource;
  labels: string[];
};

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function inferSearchHints(raw: string, now = new Date()): SearchHints {
  const labels: string[] = [];
  let source: CaptureSource | undefined;
  let from: string | undefined;
  let to: string | undefined;
  const lower = raw.toLowerCase();

  if (/\byesterday\b/.test(lower)) {
    const start = startOfDay(now);
    start.setDate(start.getDate() - 1);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    from = start.toISOString();
    to = end.toISOString();
    labels.push('Yesterday');
  } else if (/\blast week\b/.test(lower)) {
    const end = startOfDay(now);
    const start = new Date(end);
    start.setDate(start.getDate() - 7);
    from = start.toISOString();
    to = now.toISOString();
    labels.push('Last 7 days');
  } else if (/\bthis week\b/.test(lower)) {
    const start = startOfDay(now);
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    from = start.toISOString();
    labels.push('This week');
  }

  if (/\b(screenshot|chrome|photos|share)\b/.test(lower)) {
    source = 'SHARE';
    labels.push('Share');
  } else if (/\bkeyboard\b/.test(lower)) {
    source = 'KEYBOARD';
    labels.push('Keyboard');
  } else if (/\bvoice\b/.test(lower)) {
    source = 'VOICE';
    labels.push('Voice');
  } else if (/\bwidget\b/.test(lower)) {
    source = 'WIDGET';
    labels.push('Widget');
  }

  return { query: raw.trim(), from, to, source, labels };
}

export function relativeMemoryLabel(iso: string, now = new Date()): string {
  const then = new Date(iso).getTime();
  const hours = Math.round((now.getTime() - then) / 36e5);
  if (hours < 24) return 'Earlier today';
  const days = Math.round(hours / 24);
  if (days === 1) return '1 day earlier';
  if (days < 14) return `${days} days earlier`;
  const weeks = Math.round(days / 7);
  if (weeks === 1) return '1 week earlier';
  return `${weeks} weeks earlier`;
}
