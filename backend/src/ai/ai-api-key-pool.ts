/**
 * Rotating pool of Gemini API keys (chat and embeddings).
 * On 429, the hot key cools down while the next free key is used immediately.
 * In-flight checkouts prefer idle keys so N keys ≈ N parallel requests.
 */

export class AiApiKeyPool {
  private readonly keys: string[];
  private readonly cooldownUntilMs: number[];
  private readonly inUse: number[];
  private cursor = 0;

  constructor(keys: string[]) {
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const raw of keys) {
      const key = raw.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      unique.push(key);
    }
    this.keys = unique;
    this.cooldownUntilMs = unique.map(() => 0);
    this.inUse = unique.map(() => 0);
  }

  get size(): number {
    return this.keys.length;
  }

  isConfigured(): boolean {
    return this.keys.length > 0;
  }

  /** How many keys are not currently cooling down. */
  availableCount(now = Date.now()): number {
    return this.keys.reduce(
      (n, _k, i) => n + (this.cooldownUntilMs[i] <= now ? 1 : 0),
      0,
    );
  }

  /**
   * Checkout a key for an in-flight request.
   * Prefers non-cooling, idle keys (round-robin); falls back to the
   * least-loaded non-cooling key when every key is already in use.
   * Returns null when every key is still cooling down.
   */
  acquire(now = Date.now()): { key: string; slot: number } | null {
    if (this.keys.length === 0) return null;
    const n = this.keys.length;

    // Pass 1: idle + not cooling
    for (let i = 0; i < n; i += 1) {
      const slot = (this.cursor + i) % n;
      if (this.cooldownUntilMs[slot] <= now && this.inUse[slot] === 0) {
        this.cursor = (slot + 1) % n;
        this.inUse[slot] += 1;
        return { key: this.keys[slot], slot };
      }
    }

    // Pass 2: not cooling, least in-use (allows concurrency > key count)
    let bestSlot = -1;
    let bestLoad = Number.POSITIVE_INFINITY;
    for (let i = 0; i < n; i += 1) {
      const slot = (this.cursor + i) % n;
      if (this.cooldownUntilMs[slot] > now) continue;
      if (this.inUse[slot] < bestLoad) {
        bestLoad = this.inUse[slot];
        bestSlot = slot;
      }
    }
    if (bestSlot < 0) return null;

    this.cursor = (bestSlot + 1) % n;
    this.inUse[bestSlot] += 1;
    return { key: this.keys[bestSlot], slot: bestSlot };
  }

  /** @deprecated Prefer acquire() — kept for older call sites/tests. */
  select(now = Date.now()): { key: string; slot: number } | null {
    return this.acquire(now);
  }

  release(slot: number): void {
    if (slot < 0 || slot >= this.keys.length) return;
    this.inUse[slot] = Math.max(0, this.inUse[slot] - 1);
  }

  markRateLimited(slot: number, retryAfterMs: number, now = Date.now()): void {
    if (slot < 0 || slot >= this.keys.length) return;
    const wait =
      Number.isFinite(retryAfterMs) && retryAfterMs > 0 ? retryAfterMs : 1_000;
    const until = now + wait;
    this.cooldownUntilMs[slot] = Math.max(this.cooldownUntilMs[slot], until);
  }

  /** Earliest time any key becomes free again (0 if one is free now). */
  msUntilAnyAvailable(now = Date.now()): number {
    if (this.keys.length === 0) return 0;
    if (this.availableCount(now) > 0) return 0;
    let min = Number.POSITIVE_INFINITY;
    for (const until of this.cooldownUntilMs) {
      min = Math.min(min, Math.max(0, until - now));
    }
    return Number.isFinite(min) ? min : 0;
  }
}

/**
 * Collect keys from:
 * - AI_API_KEY (primary)
 * - AI_API_KEY_1 .. AI_API_KEY_8
 * - AI_API_KEYS=comma,separated,list
 */
export function readAiApiKeys(env: NodeJS.ProcessEnv = process.env): string[] {
  return readPrefixedApiKeys('AI_API_KEY', env);
}

/**
 * Embedding keys: EMBEDDING_API_KEY / _1.._8 / EMBEDDING_API_KEYS.
 * Falls back to the chat Gemini key pool so one set of keys can serve both.
 */
export function readEmbeddingApiKeys(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const dedicated = readPrefixedApiKeys('EMBEDDING_API_KEY', env);
  return dedicated.length > 0 ? dedicated : readAiApiKeys(env);
}

export function readPrefixedApiKeys(
  prefix: string,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (value: string | undefined) => {
    const key = value?.trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(key);
  };

  push(env[prefix]);

  for (let i = 1; i <= 8; i += 1) {
    push(env[`${prefix}_${i}`]);
  }

  const list = env[`${prefix}S`]?.trim();
  if (list) {
    for (const part of list.split(/[,;\s]+/)) {
      push(part);
    }
  }

  return out;
}
