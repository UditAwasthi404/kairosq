type SyncSnapshot = {
  flushed: number;
  remaining: number;
  at: number;
  inflight: boolean;
};

let snapshot: SyncSnapshot | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function setCaptureSyncInflight(inflight: boolean): void {
  snapshot = {
    flushed: snapshot?.flushed ?? 0,
    remaining: snapshot?.remaining ?? 0,
    at: snapshot?.at ?? Date.now(),
    inflight,
  };
  emit();
}

export function recordCaptureSync(flushed: number, remaining: number): void {
  snapshot = {
    flushed,
    remaining,
    at: Date.now(),
    inflight: snapshot?.inflight ?? false,
  };
  emit();
}

/** A capture was saved to the on-device queue instead of uploading. */
export function noteCaptureQueued(): void {
  snapshot = {
    flushed: 0,
    remaining: (snapshot?.remaining ?? 0) + 1,
    at: Date.now(),
    inflight: snapshot?.inflight ?? false,
  };
  emit();
}

export function getCaptureSync(): SyncSnapshot | null {
  return snapshot;
}

export function subscribeCaptureSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function syncBannerText(now = Date.now()): string | null {
  if (!snapshot) return null;
  if (snapshot.remaining > 0) {
    return snapshot.remaining === 1
      ? 'Saved on this device. Will sync when you are online.'
      : `${snapshot.remaining} memories saved on this device. They will sync when you are online.`;
  }
  if (snapshot.flushed > 0 && now - snapshot.at < 60_000) {
    return snapshot.flushed === 1
      ? '1 memory synced'
      : `${snapshot.flushed} memories synced`;
  }
  return null;
}

export function profileSyncCopy(
  pendingCount: number,
  now = Date.now(),
): { title: string; detail: string } {
  const remaining = Math.max(pendingCount, snapshot?.remaining ?? 0);
  if (snapshot?.inflight && remaining > 0) {
    return {
      title: remaining === 1 ? 'Syncing 1 memory…' : `Syncing ${remaining} memories…`,
      detail: 'Will finish automatically',
    };
  }
  if (remaining > 0) {
    return {
      title:
        remaining === 1
          ? '1 saved on this device'
          : `${remaining} saved on this device`,
      detail: 'Will sync automatically',
    };
  }
  if (snapshot && snapshot.flushed > 0 && now - snapshot.at < 60_000) {
    return { title: 'All memories synced ✓', detail: 'Nothing waiting to upload' };
  }
  return { title: 'All memories synced', detail: 'Nothing waiting to upload' };
}
