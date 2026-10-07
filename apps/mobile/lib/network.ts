import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { apiBaseUrl } from './config';

export type NetworkState = {
  online: boolean;
  /** A reachability probe is in flight. */
  checking: boolean;
  /** When the current online/offline state began. */
  since: number;
  /** When the next automatic probe will run while offline. */
  nextCheckAt: number | null;
};

const PROBE_TIMEOUT_MS = 6_000;
const BACKOFF_MS = [2_000, 4_000, 8_000, 15_000, 30_000];

let state: NetworkState = {
  online: true,
  checking: false,
  since: Date.now(),
  nextCheckAt: null,
};
let attempt = 0;
let probeTimer: ReturnType<typeof setTimeout> | null = null;
let probeInflight: Promise<boolean> | null = null;
const listeners = new Set<() => void>();
const reconnectListeners = new Set<() => void>();

function setState(next: Partial<NetworkState>): void {
  const wasOnline = state.online;
  state = {
    ...state,
    ...next,
    since: next.online !== undefined && next.online !== wasOnline ? Date.now() : state.since,
  };
  for (const listener of listeners) listener();
  if (!wasOnline && state.online) {
    for (const listener of reconnectListeners) listener();
  }
}

function clearProbeTimer(): void {
  if (probeTimer) {
    clearTimeout(probeTimer);
    probeTimer = null;
  }
}

function scheduleProbe(): void {
  clearProbeTimer();
  const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
  attempt += 1;
  setState({ nextCheckAt: Date.now() + delay });
  probeTimer = setTimeout(() => {
    probeTimer = null;
    void checkConnection();
  }, delay);
}

export function getNetworkState(): NetworkState {
  return state;
}

export function subscribeNetwork(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Called once each time the app goes from offline back to online. */
export function onReconnect(listener: () => void): () => void {
  reconnectListeners.add(listener);
  return () => {
    reconnectListeners.delete(listener);
  };
}

export function reportNetworkSuccess(): void {
  attempt = 0;
  clearProbeTimer();
  if (!state.online || state.nextCheckAt !== null) {
    setState({ online: true, nextCheckAt: null });
  }
}

/** A request could not reach the server at all (no response). */
export function reportNetworkFailure(): void {
  if (state.online) setState({ online: false });
  if (!probeTimer && !probeInflight) scheduleProbe();
}

/** A request was slow enough to time out; confirm with a probe before flipping state. */
export function reportNetworkSlow(): void {
  if (!probeInflight) void checkConnection();
}

/**
 * Probe the API host. Any HTTP response means the device can reach Kairos;
 * only a transport failure or timeout counts as offline.
 */
export function checkConnection(): Promise<boolean> {
  if (probeInflight) return probeInflight;
  clearProbeTimer();
  setState({ checking: true, nextCheckAt: null });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  probeInflight = fetch(apiBaseUrl, {
    method: 'GET',
    cache: 'no-store',
    signal: controller.signal,
  })
    .then(() => true)
    .catch(() => false)
    .then((reachable) => {
      clearTimeout(timer);
      probeInflight = null;
      setState({ checking: false });
      if (reachable) {
        reportNetworkSuccess();
      } else {
        if (state.online) setState({ online: false });
        scheduleProbe();
      }
      return reachable;
    });
  return probeInflight;
}

export function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { status, name, message } = error as {
    status?: unknown;
    name?: unknown;
    message?: unknown;
  };
  if (status === 0) return true;
  if (name === 'AbortError') return true;
  return (
    typeof message === 'string' &&
    /network request failed|network error|failed to fetch|timed out|unreachable/i.test(message)
  );
}

export function useNetworkStatus(): NetworkState {
  return useSyncExternalStore(subscribeNetwork, getNetworkState, getNetworkState);
}

AppState.addEventListener('change', (next) => {
  if (next === 'active' && !state.online) void checkConnection();
});

/** Test-only: reset module state between cases. */
export function __resetNetworkForTests(): void {
  clearProbeTimer();
  probeInflight = null;
  attempt = 0;
  state = { online: true, checking: false, since: Date.now(), nextCheckAt: null };
}
