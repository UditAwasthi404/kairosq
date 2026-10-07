/**
 * Process-local gate for OpenAI-compatible chat calls.
 * Limits concurrent HTTP requests and applies a shared cooldown after 429s
 * so retries do not stampede the same TPM window.
 */
import { readAiApiKeys } from './ai-api-key-pool';

export class AiRequestGate {
  private active = 0;
  private readonly waiters: Array<() => void> = [];
  private cooldownUntilMs = 0;

  constructor(private readonly concurrency: number) {
    if (!Number.isFinite(concurrency) || concurrency < 1) {
      throw new Error('AiRequestGate concurrency must be >= 1');
    }
  }

  get concurrencyLimit(): number {
    return this.concurrency;
  }

  /** In-flight requests currently holding a slot (for tests). */
  get activeCount(): number {
    return this.active;
  }

  /** Queued waiters not yet running (for tests). */
  get waitingCount(): number {
    return this.waiters.length;
  }

  getCooldownRemainingMs(now = Date.now()): number {
    return Math.max(0, this.cooldownUntilMs - now);
  }

  /**
   * Extend the shared cooldown so no new request starts before `untilMs`.
   * Used when a provider returns Retry-After on 429.
   */
  noteCooldownUntil(untilMs: number): void {
    if (!Number.isFinite(untilMs) || untilMs <= 0) return;
    this.cooldownUntilMs = Math.max(this.cooldownUntilMs, untilMs);
  }

  noteCooldownFor(retryAfterMs: number, now = Date.now()): void {
    if (!Number.isFinite(retryAfterMs) || retryAfterMs <= 0) return;
    this.noteCooldownUntil(now + retryAfterMs);
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      await this.waitForCooldown();
      return await fn();
    } finally {
      this.release();
    }
  }

  private async acquire(): Promise<void> {
    if (this.active < this.concurrency) {
      this.active += 1;
      return;
    }
    await new Promise<void>((resolve) => {
      this.waiters.push(resolve);
    });
    // Slot transferred by release() — already counted in `active`.
  }

  private release(): void {
    const next = this.waiters.shift();
    if (next) {
      // Hand the slot to the next waiter without decrementing.
      next();
      return;
    }
    this.active = Math.max(0, this.active - 1);
  }

  private async waitForCooldown(): Promise<void> {
    // Loop in case another 429 extends the cooldown while we sleep.
    for (;;) {
      const remaining = this.getCooldownRemainingMs();
      if (remaining <= 0) return;
      await sleep(remaining);
    }
  }
}

export function readAiChatConcurrency(
  env: NodeJS.ProcessEnv = process.env,
  keyCount?: number,
): number {
  const keys =
    typeof keyCount === 'number' && Number.isFinite(keyCount)
      ? Math.max(0, Math.floor(keyCount))
      : readAiApiKeys(env).length;
  // Default: one in-flight chat call per configured key (capped).
  const auto = Math.max(1, Math.min(keys || 1, 8));

  const raw = env.AI_CHAT_CONCURRENCY?.trim();
  if (!raw) return auto;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return auto;
  // Hard ceiling keeps a misconfigured env from opening a stampede.
  return Math.min(parsed, 8);
}

export function readAiChatMaxRetries(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env.AI_CHAT_MAX_RETRIES?.trim();
  if (!raw) return 4; // 5 total attempts
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 4;
  return Math.min(parsed, 8);
}

/**
 * Parse Retry-After. Prefer exact provider delay; only clamp extreme values
 * so a bad header cannot hang a worker forever.
 */
export function parseRetryAfterMs(
  header: string | null | undefined,
  now = Date.now(),
): number | undefined {
  if (header == null || header === '') return undefined;
  const asSeconds = Number(header);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return clampRetryMs(asSeconds * 1000);
  }
  const asDate = Date.parse(header);
  if (Number.isFinite(asDate)) {
    return clampRetryMs(Math.max(0, asDate - now));
  }
  return undefined;
}

const MAX_RETRY_AFTER_MS = 5 * 60_000;

function clampRetryMs(ms: number): number {
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.min(ms, MAX_RETRY_AFTER_MS);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
