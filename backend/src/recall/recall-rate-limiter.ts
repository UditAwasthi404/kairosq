import {
  FINGERPRINT_DEDUPE_WINDOW_MS,
  MAX_EVENTS_PER_DAY,
  MAX_EVENTS_PER_MINUTE,
} from './recall.validation';

type Bucket = { minute: number[]; day: number[] };

/**
 * Process-local rate limiter (same durability class as setImmediate processing).
 * Replace with Redis later without changing call sites.
 */
export class RecallRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly perMinute = MAX_EVENTS_PER_MINUTE,
    private readonly perDay = MAX_EVENTS_PER_DAY,
  ) {}

  /** How many more events this user can accept right now. */
  remaining(userId: string, now = Date.now()): number {
    const bucket = this.prune(userId, now);
    const minuteLeft = this.perMinute - bucket.minute.length;
    const dayLeft = this.perDay - bucket.day.length;
    return Math.max(0, Math.min(minuteLeft, dayLeft));
  }

  /**
   * Consume up to `count` slots. Returns how many were actually consumed
   * (0..count). Never overshoots the minute/day caps.
   */
  tryConsumeUpTo(userId: string, count: number, now = Date.now()): number {
    if (count <= 0) return 0;
    const allowed = Math.min(count, this.remaining(userId, now));
    if (allowed <= 0) return 0;
    const bucket = this.prune(userId, now);
    for (let i = 0; i < allowed; i += 1) {
      bucket.minute.push(now);
      bucket.day.push(now);
    }
    this.buckets.set(userId, bucket);
    return allowed;
  }

  /** Returns true if `count` additional events are allowed (all-or-nothing). */
  tryConsume(userId: string, count: number, now = Date.now()): boolean {
    if (count <= 0) return true;
    if (this.remaining(userId, now) < count) return false;
    return this.tryConsumeUpTo(userId, count, now) === count;
  }

  /** Test helper */
  reset(): void {
    this.buckets.clear();
  }

  private prune(userId: string, now: number): Bucket {
    const bucket = this.buckets.get(userId) ?? { minute: [], day: [] };
    const minuteCutoff = now - 60_000;
    const dayCutoff = now - 86_400_000;
    bucket.minute = bucket.minute.filter((t) => t >= minuteCutoff);
    bucket.day = bucket.day.filter((t) => t >= dayCutoff);
    this.buckets.set(userId, bucket);
    return bucket;
  }
}

export { FINGERPRINT_DEDUPE_WINDOW_MS };
