import { createHash } from 'crypto';

/** Mirrors native FingerprintUtil for unit tests. */
export function normalizeRecallText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function recallFingerprint(text: string, appPackage?: string | null): string {
  const payload = `${normalizeRecallText(text)}|${appPackage ?? ''}`;
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

const TOKEN_RE = /[\p{L}\p{N}]{2,}/gu;
const NOISE = new Set(['skip', 'allow', 'deny', 'ok', 'cancel', 'done', 'close', 'back']);
const CHROME = new Set([
  'amazon',
  'flipkart',
  'chrome',
  'google',
  'youtube',
  'instagram',
  'whatsapp',
  'menu',
  'cart',
  'account',
  'home',
  'search',
  'shop',
  'buy',
  'now',
  'add',
  'deliver',
  'location',
  'orders',
  'prime',
  'wishlist',
  'filter',
  'sort',
  'results',
  'submit',
  'recent',
  'searches',
  'skip',
  'allow',
  'deny',
  'cancel',
  'close',
  'back',
  'next',
  'more',
  'less',
  'see',
  'all',
  'view',
  'open',
  'share',
  'save',
  'like',
  'follow',
  'settings',
  'notification',
  'notifications',
]);
const PRICE_RE =
  /(?:₹|rs\.?|inr|\$|€|£)\s?[\d,.]+|[\d,.]+\s?(?:rs\.?|inr)/gi;

/** Mirrors native TextSemantics.tokens */
export function recallTokens(text: string): Set<string> {
  const out = new Set<string>();
  const matches = text.toLowerCase().match(TOKEN_RE) ?? [];
  for (const m of matches) {
    if (!NOISE.has(m)) out.add(m);
  }
  return out;
}

/** Mirrors native TextSemantics.contentTokens */
export function recallContentTokens(text: string): Set<string> {
  const out = new Set<string>();
  const matches = text.toLowerCase().match(TOKEN_RE) ?? [];
  for (const m of matches) {
    if (!NOISE.has(m) && !CHROME.has(m)) out.add(m);
  }
  return out;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / (a.size + b.size - inter);
}

export function newTokenRatio(previous: Set<string>, incoming: Set<string>): number {
  if (incoming.size === 0) return 0;
  let novel = 0;
  for (const t of incoming) if (!previous.has(t)) novel += 1;
  return novel / incoming.size;
}

export function isMeaningfulRecallText(text: string): boolean {
  const cleaned = text.trim();
  if (cleaned.length < 20) return false;
  const content = recallContentTokens(cleaned);
  const all = recallTokens(cleaned);
  let alphaNum = 0;
  for (const ch of cleaned) {
    if (/[a-zA-Z0-9\u00C0-\u024F]/.test(ch)) alphaNum += 1;
  }
  if (alphaNum < 16) return false;
  if (content.size >= 2) return true;
  return all.size >= 4;
}

export function unionRecallLines(existing: string, incoming: string, maxChars = 32_000): string {
  const lines = new Map<string, string>();
  const addBlock = (block: string) => {
    for (const raw of block.split('\n')) {
      const line = raw.trim();
      if (line.length < 2) continue;
      const key = normalizeRecallText(line);
      if (key.length < 2) continue;
      const prev = lines.get(key);
      if (!prev || line.length > prev.length) lines.set(key, line);
    }
  };
  addBlock(existing);
  addBlock(incoming);
  return [...lines.values()].join('\n').slice(0, maxChars);
}

export function inferContentTitle(text: string): string | null {
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.length < 4 || line.length > 120) continue;
    const lower = line.toLowerCase();
    const toks = recallContentTokens(line);
    if (toks.size === 0) continue;
    if (CHROME.has(lower) || lower === 'search amazon' || lower === 'menu') continue;
    return line.slice(0, 100);
  }
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.length >= 4 && line.length <= 120) return line.slice(0, 80);
  }
  return null;
}

function prices(text: string): Set<string> {
  const out = new Set<string>();
  const matches = text.toLowerCase().match(PRICE_RE) ?? [];
  for (const m of matches) out.add(m.replace(/\s/g, ''));
  return out;
}

export type TextRelation = 'DUPLICATE' | 'RELATED_SCROLL' | 'MATERIAL';

/** Mirrors native TextSemantics.relation */
export function textRelation(previousText: string, incomingText: string): TextRelation {
  const aAll = recallTokens(previousText);
  const bAll = recallTokens(incomingText);
  const aContent = recallContentTokens(previousText);
  const bContent = recallContentTokens(incomingText);
  const a = aContent.size > 0 ? aContent : aAll;
  const b = bContent.size > 0 ? bContent : bAll;
  const jac = jaccard(a, b);
  const novel = newTokenRatio(a, b);
  let onlyPrev = 0;
  for (const t of a) if (!b.has(t)) onlyPrev += 1;
  let onlyNext = 0;
  for (const t of b) if (!a.has(t)) onlyNext += 1;
  const lenRatio =
    previousText.length === 0 ? 1 : incomingText.length / Math.max(previousText.length, 1);

  const prevTitle = inferContentTitle(previousText)?.toLowerCase() ?? null;
  const nextTitle = inferContentTitle(incomingText)?.toLowerCase() ?? null;
  const titleChanged =
    prevTitle != null &&
    nextTitle != null &&
    prevTitle !== nextTitle &&
    jaccard(recallContentTokens(prevTitle), recallContentTokens(nextTitle)) < 0.5;
  // Near-identical titles only — shared query tokens must not glue search→results.
  const sameTitleFamily =
    prevTitle != null &&
    nextTitle != null &&
    jaccard(recallContentTokens(prevTitle), recallContentTokens(nextTitle)) >= 0.85;

  const prevPrices = prices(previousText);
  const nextPrices = prices(incomingText);
  let priceOverlap = false;
  for (const p of prevPrices) {
    if (nextPrices.has(p)) {
      priceOverlap = true;
      break;
    }
  }
  const priceChanged =
    prevPrices.size > 0 && nextPrices.size > 0 && !priceOverlap;

  const contentTurnover = onlyNext >= 4 && novel >= 0.55 && jac < 0.35;

  if (jac >= 0.9 && novel < 0.1) return 'DUPLICATE';
  if (titleChanged) return 'MATERIAL';
  if (priceChanged && novel >= 0.15) return 'MATERIAL';
  // Same product title + newly revealed body (scroll) before contentTurnover.
  if (sameTitleFamily && novel >= 0.12) return 'RELATED_SCROLL';
  if (contentTurnover) return 'MATERIAL';
  if (onlyPrev >= 2 && onlyNext >= 2 && novel >= 0.2) return 'MATERIAL';
  if (jac >= 0.35 && novel >= 0.15) return 'RELATED_SCROLL';
  if (jac >= 0.5 && lenRatio >= 0.65 && lenRatio <= 1.5 && novel < 0.28) {
    return 'RELATED_SCROLL';
  }
  return 'MATERIAL';
}

export type CoalesceBuffer = {
  appPackage: string | null;
  text: string;
  fingerprint: string;
  startedAtMs: number;
  updatedAtMs?: number;
  snapshotCount?: number;
  title?: string | null;
};

/**
 * Legacy helper kept for fingerprint tests: exact duplicate only.
 * Prefer simulateEventAggregator for real aggregation behavior.
 */
export function shouldCoalesce(params: {
  open: CoalesceBuffer | null;
  appPackage: string | null;
  text: string;
  nowMs: number;
  windowMs?: number;
}): boolean {
  const open = params.open;
  if (!open) return false;
  if (open.appPackage !== params.appPackage) return false;
  const fp = recallFingerprint(params.text, params.appPackage);
  return (
    open.fingerprint === fp ||
    normalizeRecallText(open.text) === normalizeRecallText(params.text)
  );
}

export type AggregatorEvent = {
  extractedText: string;
  appPackage: string | null;
  fingerprint: string;
  capturedAtMs: number;
  title?: string | null;
};

/**
 * JS mirror of native EventAggregator for unit tests.
 */
export function simulateEventAggregator(
  snapshots: Array<{
    text: string;
    appPackage?: string | null;
    nowMs: number;
  }>,
  options?: { idleFlushMs?: number; forceFinalFlush?: boolean },
): AggregatorEvent[] {
  const idleFlushMs = options?.idleFlushMs ?? 8_000;
  const emitted: AggregatorEvent[] = [];
  const state: { open: CoalesceBuffer | null } = { open: null };

  const flush = () => {
    const buf = state.open;
    if (!buf || !isMeaningfulRecallText(buf.text)) {
      state.open = null;
      return;
    }
    emitted.push({
      extractedText: buf.text.slice(0, 32_000),
      appPackage: buf.appPackage,
      fingerprint: buf.fingerprint,
      capturedAtMs: buf.updatedAtMs ?? buf.startedAtMs,
      title: buf.title ?? inferContentTitle(buf.text),
    });
    state.open = null;
  };

  const openNew = (text: string, appPackage: string | null, nowMs: number) => {
    state.open = {
      appPackage,
      text: text.slice(0, 32_000),
      fingerprint: recallFingerprint(text, appPackage),
      startedAtMs: nowMs,
      updatedAtMs: nowMs,
      snapshotCount: 1,
      title: inferContentTitle(text),
    };
  };

  for (const snap of snapshots) {
    const cleaned = snap.text.trim();
    if (!isMeaningfulRecallText(cleaned)) continue;
    const appPackage = snap.appPackage ?? null;
    const nowMs = snap.nowMs;
    const existing = state.open;

    if (existing && nowMs - (existing.updatedAtMs ?? existing.startedAtMs) >= idleFlushMs) {
      flush();
    }

    if (!state.open) {
      openNew(cleaned, appPackage, nowMs);
      continue;
    }

    const current = state.open;
    const appChanged =
      current.appPackage != null &&
      appPackage != null &&
      current.appPackage !== appPackage;
    if (appChanged) {
      flush();
      openNew(cleaned, appPackage, nowMs);
      continue;
    }

    const relation = textRelation(current.text, cleaned);
    if (relation === 'DUPLICATE') {
      current.updatedAtMs = nowMs;
      continue;
    }
    if (relation === 'RELATED_SCROLL') {
      current.text = unionRecallLines(current.text, cleaned);
      current.fingerprint = recallFingerprint(current.text, appPackage);
      current.updatedAtMs = nowMs;
      current.snapshotCount = (current.snapshotCount ?? 1) + 1;
      const better = inferContentTitle(cleaned);
      if (better && (!current.title || better.length > current.title.length)) {
        current.title = better;
      }
      continue;
    }
    // MATERIAL
    flush();
    openNew(cleaned, appPackage, nowMs);
  }

  if (options?.forceFinalFlush !== false) {
    flush();
  }

  return emitted;
}

/**
 * DEV helper: preserve spatial reading order for OCR lines
 * (top→bottom within pre-sorted blocks).
 */
export function assembleOcrReadingOrder(
  blocks: Array<{ top: number; left: number; lines: Array<{ top: number; left: number; text: string }> }>,
): string {
  const sortedBlocks = [...blocks].sort((a, b) => a.top - b.top || a.left - b.left);
  const lines: string[] = [];
  for (const block of sortedBlocks) {
    const ordered = [...block.lines].sort((a, b) => a.top - b.top || a.left - b.left);
    for (const line of ordered) {
      const t = line.text.trim();
      if (t) lines.push(t);
    }
  }
  return lines.join('\n');
}
