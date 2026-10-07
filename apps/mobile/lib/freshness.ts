/**
 * Tracks when the user last changed server data (capture, edit, delete…) so
 * throttled screens know their cached copy is out of date on next focus.
 */
let lastMutationAt = 0;

export function noteMutation(at = Date.now()): void {
  lastMutationAt = Math.max(lastMutationAt, at);
}

export function getLastMutationAt(): number {
  return lastMutationAt;
}

/** True when data loaded at `loadedAt` should be refetched on focus. */
export function isStale(loadedAt: number | null, staleMs: number, now = Date.now()): boolean {
  if (!loadedAt) return true;
  return now - loadedAt > staleMs || lastMutationAt >= loadedAt;
}
