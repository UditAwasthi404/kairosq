import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { isStale } from '../lib/freshness';
import { getNetworkState, isNetworkError, onReconnect } from '../lib/network';
import { readCache, writeCache } from '../lib/persistentCache';

export function readQueryCache<T>(key: string): T | null {
  return readCache<T>(key)?.value ?? null;
}

export function readQueryCacheAge(key: string): number | null {
  const entry = readCache(key);
  return entry ? Date.now() - entry.updatedAt : null;
}

export function writeQueryCache<T>(key: string, value: T) {
  writeCache(key, value);
}

const inflight = new Map<string, Promise<unknown>>();

/** Share one request between every screen asking for the same cache key. */
export function dedupeRequest<T>(key: string | null, run: () => Promise<T>): Promise<T> {
  if (!key) return run();
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const promise = run().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, promise);
  return promise;
}

export type AsyncErrorKind = 'network' | 'other';

type AsyncResult<T> = {
  data: T | null;
  /** Only set when there is nothing to show; stale data wins over an error. */
  error: string | null;
  errorKind: AsyncErrorKind | null;
  /** True only while the first load is in flight (no data yet). */
  loading: boolean;
  /** True while refreshing with existing data still on screen. */
  refreshing: boolean;
  /** Epoch ms of the data on screen (from network or device cache). */
  updatedAt: number | null;
  reload: () => void;
};

type UseAsyncOptions = {
  /**
   * When this key changes (e.g. route id), drop previous data and show the
   * skeleton instead of briefly painting the wrong entity.
   */
  resetKey?: string | number | null;
  /** Persist the last successful payload on-device so screens open instantly. */
  cacheKey?: string;
  /** Refetch when the screen regains focus if data is older than this (ms). */
  staleTime?: number;
};

const DEFAULT_STALE_MS = 30_000;

/**
 * Stale-while-revalidate loader: paints cached data immediately, refreshes in
 * the background, refetches on focus when stale and when the network returns.
 * Screens should gate the skeleton on `loading` (not `refreshing`).
 */
export function useAsync<T>(
  loader: () => Promise<T>,
  deps: unknown[] = [],
  options: UseAsyncOptions = {},
): AsyncResult<T> {
  const { resetKey, cacheKey, staleTime = DEFAULT_STALE_MS } = options;
  const fullKey = cacheKey ? (resetKey != null ? `${cacheKey}:${resetKey}` : cacheKey) : null;
  const initial = fullKey ? readCache<T>(fullKey) : null;
  const [data, setData] = useState<T | null>(initial?.value ?? null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(initial?.updatedAt ?? null);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<AsyncErrorKind | null>(null);
  const [loading, setLoading] = useState(initial == null);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);
  const dataRef = useRef<T | null>(initial?.value ?? null);
  const updatedAtRef = useRef<number | null>(initial?.updatedAt ?? null);
  const resetKeyRef = useRef(resetKey);
  const loaderRef = useRef(loader);
  const mountedAtTick = useRef(true);
  loaderRef.current = loader;
  dataRef.current = data;
  updatedAtRef.current = updatedAt;

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const valueDeps = deps.filter((value) => typeof value !== 'function');

  useEffect(() => {
    let cancelled = false;
    const keyChanged = resetKey !== undefined && resetKeyRef.current !== resetKey;
    resetKeyRef.current = resetKey;

    if (keyChanged) {
      const next = fullKey ? readCache<T>(fullKey) : null;
      dataRef.current = next?.value ?? null;
      setData(next?.value ?? null);
      setUpdatedAt(next?.updatedAt ?? null);
      setLoading(next == null);
      setRefreshing(next != null);
    } else if (dataRef.current !== null) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    setErrorKind(null);

    void dedupeRequest(fullKey, () => loaderRef.current())
      .then((result) => {
        if (cancelled) return;
        dataRef.current = result;
        setData(result);
        setUpdatedAt(Date.now());
        setLoading(false);
        setRefreshing(false);
        if (fullKey) writeCache(fullKey, result);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setLoading(false);
        setRefreshing(false);
        if (dataRef.current === null) {
          const network = isNetworkError(cause) || !getNetworkState().online;
          setErrorKind(network ? 'network' : 'other');
          setError(network ? 'No connection to Kairos.' : 'Unable to load data.');
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, resetKey, cacheKey, ...valueDeps]);

  useEffect(() => onReconnect(reload), [reload]);

  useFocusEffect(
    useCallback(() => {
      if (mountedAtTick.current) {
        mountedAtTick.current = false;
        return;
      }
      if (isStale(updatedAtRef.current, staleTime)) reload();
    }, [reload, staleTime]),
  );

  return { data, error, errorKind, loading, refreshing, updatedAt, reload };
}
