import * as FileSystem from 'expo-file-system/legacy';
import { AppState } from 'react-native';

/**
 * Per-user on-device copy of API responses. Everything lives in memory for
 * synchronous reads during render and is mirrored to one JSON file so a cold
 * start paints the last known data instantly instead of skeletons.
 */

export type CacheEntry<T = unknown> = { value: T; updatedAt: number };

const CACHE_DIR = 'kairos-cache/';
const CACHE_VERSION = 1;
const MAX_ENTRIES = 150;
/** Skip single payloads that would bloat the file (e.g. huge extracted text). */
const MAX_ENTRY_CHARS = 512_000;
const FLUSH_DELAY_MS = 750;

type CacheFile = {
  version: number;
  entries: Array<[string, CacheEntry]>;
};

const memory = new Map<string, CacheEntry>();
let scope: string | null = null;
let hydration: Promise<void> | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let dirty = false;

function cacheDir(): string | null {
  const base = FileSystem.documentDirectory;
  return base ? `${base}${CACHE_DIR}` : null;
}

function cacheFile(forScope: string): string | null {
  const dir = cacheDir();
  if (!dir) return null;
  return `${dir}${forScope.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
}

/** Load the signed-in user's cache from disk. Safe to call repeatedly. */
export function hydrateCache(userId: string): Promise<void> {
  if (scope === userId && hydration) return hydration;
  if (scope && scope !== userId) void flushCache();
  scope = userId;
  memory.clear();
  dirty = false;
  const forScope = userId;
  hydration = (async () => {
    const uri = cacheFile(forScope);
    if (!uri) return;
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) return;
      const raw = await FileSystem.readAsStringAsync(uri);
      const parsed = JSON.parse(raw) as CacheFile;
      if (scope !== forScope || parsed?.version !== CACHE_VERSION) return;
      if (!Array.isArray(parsed.entries)) return;
      for (const [key, entry] of parsed.entries) {
        // Anything written while hydrating is newer than the disk copy.
        if (!memory.has(key)) memory.set(key, entry);
      }
    } catch {
      // Corrupt or unreadable cache: start fresh, next flush overwrites it.
    }
  })();
  return hydration;
}

export function readCache<T>(key: string): CacheEntry<T> | null {
  return (memory.get(key) as CacheEntry<T> | undefined) ?? null;
}

export function writeCache<T>(key: string, value: T): void {
  memory.delete(key);
  memory.set(key, { value, updatedAt: Date.now() });
  while (memory.size > MAX_ENTRIES) {
    const oldest = memory.keys().next().value;
    if (oldest === undefined) break;
    memory.delete(oldest);
  }
  scheduleFlush();
}

export function removeCache(key: string): void {
  if (memory.delete(key)) scheduleFlush();
}

export function removeCacheWhere(match: (key: string) => boolean): void {
  let changed = false;
  for (const key of [...memory.keys()]) {
    if (match(key)) {
      memory.delete(key);
      changed = true;
    }
  }
  if (changed) scheduleFlush();
}

/** Remove API responses derived from observations after a mutation or delete. */
export function invalidateObservationCaches(observationIds: string[] = []): void {
  const detailKeys = new Set(observationIds.map((id) => `observation:${id}`));
  const derivedKeys = new Set([
    'dashboard',
    'brief',
    'predictions',
    'today-insight',
    'today:memories',
    'library:timeline',
    'library:topics',
    'library:entities',
    'library:projects',
  ]);
  removeCacheWhere(
    (key) =>
      detailKeys.has(key) ||
      derivedKeys.has(key) ||
      key.startsWith('timeline:'),
  );
}

function scheduleFlush(): void {
  dirty = true;
  if (!scope || flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushCache();
  }, FLUSH_DELAY_MS);
}

export async function flushCache(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!scope || !dirty) return;
  const dir = cacheDir();
  const uri = cacheFile(scope);
  if (!dir || !uri) return;
  dirty = false;
  const entries: Array<[string, CacheEntry]> = [];
  for (const [key, entry] of memory) {
    try {
      const size = JSON.stringify(entry.value)?.length ?? 0;
      if (size <= MAX_ENTRY_CHARS) entries.push([key, entry]);
    } catch {
      // Unserialisable values stay memory-only.
    }
  }
  const payload: CacheFile = { version: CACHE_VERSION, entries };
  try {
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
    const tmp = `${uri}.tmp`;
    await FileSystem.writeAsStringAsync(tmp, JSON.stringify(payload), {
      encoding: FileSystem.EncodingType.UTF8,
    });
    await FileSystem.moveAsync({ from: tmp, to: uri });
  } catch {
    dirty = true;
  }
}

/** Drop every cached response (sign-out / delete my data). */
export async function clearCache(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  memory.clear();
  dirty = false;
  scope = null;
  hydration = null;
  const dir = cacheDir();
  if (!dir) return;
  await FileSystem.deleteAsync(dir, { idempotent: true }).catch(() => undefined);
}

AppState.addEventListener('change', (next) => {
  if (next !== 'active') void flushCache();
});
