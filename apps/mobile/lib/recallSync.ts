import { Platform } from 'react-native';
import Recall from 'kairos-recall';

import {
  ApiError,
  fetchRecallEntitlement,
  type RecallEntitlement,
} from './api';
import { apiBaseUrl } from './config';

type GetToken = (options?: { skipCache?: boolean }) => Promise<string | null>;

const ENTITLEMENT_TTL_MS = 90_000;
const MIN_SYNC_GAP_MS = 4_000;

let cachedEntitlement: RecallEntitlement | null = null;
let cachedAt = 0;
let lastSyncAt = 0;
let inFlight: Promise<RecallEntitlement | null> | null = null;
let cachedUserId: string | null = null;

export function getCachedRecallEntitlement(userId?: string): RecallEntitlement | null {
  if (!cachedEntitlement) return null;
  if (userId !== undefined && userId !== cachedUserId) return null;
  if (Date.now() - cachedAt > ENTITLEMENT_TTL_MS) return null;
  return cachedEntitlement;
}

function rememberEntitlement(ent: RecallEntitlement): void {
  cachedEntitlement = ent;
  cachedAt = Date.now();
}

async function applyNativeAuth(
  token: string,
  entitlement: RecallEntitlement | null,
): Promise<void> {
  if (Platform.OS !== 'android' || !Recall.isAvailable()) return;
  await Recall.setAuthToken(token);
  await Recall.setConfig({
    apiBaseUrl: apiBaseUrl.replace(/\/+$/, ''),
    ...(entitlement ? { entitlementAllowed: entitlement.allowed } : {}),
  });
}

async function fetchEntitlementWithTokenRetry(
  getToken: GetToken,
  token: string,
): Promise<{ token: string; entitlement: RecallEntitlement }> {
  try {
    const entitlement = await fetchRecallEntitlement(token);
    return { token, entitlement };
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;
    const fresh = await getToken({ skipCache: true });
    if (!fresh) throw err;
    const entitlement = await fetchRecallEntitlement(fresh);
    return { token: fresh, entitlement };
  }
}

/**
 * Single-flight recall auth + entitlement sync.
 * Dedupes concurrent callers (layout + Recall tab) and retries once
 * with a fresh Clerk JWT after a 401.
 */
export async function ensureRecallReady(
  getToken: GetToken,
  options?: { force?: boolean; userId?: string },
): Promise<RecallEntitlement | null> {
  const force = options?.force === true;
  const userId = options?.userId ?? null;
  if (userId !== cachedUserId) {
    cachedEntitlement = null;
    cachedAt = 0;
    lastSyncAt = 0;
    inFlight = null;
    cachedUserId = userId;
  }
  const warm = getCachedRecallEntitlement();

  if (!force && warm && Date.now() - lastSyncAt < MIN_SYNC_GAP_MS) {
    return warm;
  }

  if (inFlight) {
    return inFlight;
  }

  if (!force && warm && Date.now() - cachedAt < ENTITLEMENT_TTL_MS) {
    // Refresh native token in the background without another entitlement round-trip.
    void (async () => {
      try {
        const token = await getToken();
        if (token && cachedUserId === userId) await applyNativeAuth(token, warm);
        if (cachedUserId === userId) lastSyncAt = Date.now();
      } catch {
        /* ignore */
      }
    })();
    return warm;
  }

  let run!: Promise<RecallEntitlement | null>;
  run = (async (): Promise<RecallEntitlement | null> => {
    try {
      let token = await getToken();
      if (!token || cachedUserId !== userId) return null;

      // Push token immediately so native uploads don't wait on entitlement.
      await applyNativeAuth(token, warm);

      const result = await fetchEntitlementWithTokenRetry(getToken, token);
      if (cachedUserId !== userId) return null;
      token = result.token;
      rememberEntitlement(result.entitlement);
      await applyNativeAuth(token, result.entitlement);
      lastSyncAt = Date.now();
      return result.entitlement;
    } catch {
      return warm;
    } finally {
      if (inFlight === run) inFlight = null;
    }
  })();

  inFlight = run;
  return run;
}

/** Test helper — resets module state. */
export function __resetRecallSyncForTests(): void {
  cachedEntitlement = null;
  cachedAt = 0;
  lastSyncAt = 0;
  inFlight = null;
  cachedUserId = null;
}
