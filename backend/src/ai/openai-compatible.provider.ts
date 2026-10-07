import { Injectable, Logger } from '@nestjs/common';
import {
  AiRequestGate,
  parseRetryAfterMs,
  readAiChatConcurrency,
  readAiChatMaxRetries,
} from './ai-request-gate';
import { AiApiKeyPool, readAiApiKeys } from './ai-api-key-pool';
import {
  validateDocumentAnalysis,
  validateEntities,
  validateGroundedAnswerPayload,
  validateSummary,
  validateTopics,
} from './ai-output.validation';
import type {
  AIProvider,
  DocumentAnalysis,
  ExtractedEntity,
  ExtractedTopic,
  GroundedAnswerResult,
  GroundedContextItem,
  ConversationHistoryTurn,
} from './ai.types';
import { RAG_SYSTEM_PROMPT } from './rag.prompt';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

const ANALYSIS_EXCERPT_CHARS = 24_000;
const ASK_MAX_OUTPUT_TOKENS = 700;
const INGEST_MAX_OUTPUT_TOKENS = 2048;
@Injectable()
export class OpenAICompatibleProvider implements AIProvider {
  readonly name = 'openai-compatible';
  private readonly logger = new Logger(OpenAICompatibleProvider.name);
  private keyPool: AiApiKeyPool;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly maxRetries: number;
  private gate: AiRequestGate;

  constructor() {
    const keys = readAiApiKeys();
    this.keyPool = new AiApiKeyPool(keys);
    this.baseUrl = (
      process.env.AI_BASE_URL?.trim() || 'https://api.openai.com/v1'
    ).replace(/\/+$/, '');
    this.model = process.env.AI_MODEL?.trim() || 'gpt-4o-mini';
    this.maxRetries = readAiChatMaxRetries();
    const concurrency = readAiChatConcurrency(process.env, keys.length);
    this.gate = new AiRequestGate(concurrency);
    if (keys.length > 0) {
      this.logger.log(
        `AI chat ready: ${keys.length} key(s), concurrency=${concurrency}, model=${this.model}`,
      );
    }
  }

  /** Test-only: swap the shared chat gate without Nest DI. */
  replaceGateForTests(gate: AiRequestGate): void {
    this.gate = gate;
  }

  /** Test-only: replace key pool without Nest DI. */
  replaceKeyPoolForTests(pool: AiApiKeyPool): void {
    this.keyPool = pool;
  }

  /** Exposed for diagnostics/tests. */
  get chatConcurrency(): number {
    return this.gate.concurrencyLimit;
  }

  get apiKeyCount(): number {
    return this.keyPool.size;
  }

  isConfigured(): boolean {
    return this.keyPool.isConfigured();
  }

  async summarize(text: string): Promise<string> {
    const analysis = await this.analyzeDocument([text]);
    return analysis.summary;
  }

  async extractTopics(text: string): Promise<ExtractedTopic[]> {
    const analysis = await this.analyzeDocument([text]);
    return analysis.topics;
  }

  async extractEntities(text: string): Promise<ExtractedEntity[]> {
    const analysis = await this.analyzeDocument([text]);
    return analysis.entities;
  }

  async analyzeDocument(chunks: string[]): Promise<DocumentAnalysis> {
    if (!this.isConfigured()) {
      throw new Error('AI provider is not configured');
    }
    if (chunks.length === 0) {
      throw new Error('No content available for analysis');
    }

    const joined = chunks.join('\n\n').trim();
    const excerpt =
      joined.length <= ANALYSIS_EXCERPT_CHARS
        ? joined
        : joined.slice(0, ANALYSIS_EXCERPT_CHARS);
    return this.analyzeSinglePass(excerpt);
  }

  async generateGroundedAnswer(params: {
    question: string;
    context: GroundedContextItem[];
    conversationHistory?: ConversationHistoryTurn[];
  }): Promise<GroundedAnswerResult> {
    if (!this.isConfigured()) {
      throw new Error('AI provider is not configured');
    }
    if (params.context.length === 0) {
      throw new Error('No context available for grounded answer');
    }

    const allowedRefs = new Set(params.context.map((item) => item.ref));
    const contextBlock = params.context
      .map(
        (item) =>
          `[${item.ref}]\nfilename: ${item.title}\ndate: ${item.createdAt}\ncontent: ${item.content}`,
      )
      .join('\n\n');

    const history = params.conversationHistory ?? [];
    const historyBlock =
      history.length === 0
        ? 'None.'
        : history.map((turn) => `${turn.role}: ${turn.content}`).join('\n');

    const payload = await this.chatJson(
      [
        { role: 'system', content: RAG_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Recent conversation (for resolving references only; not a knowledge source):\n${historyBlock}\n\nCurrent question:\n${params.question}\n\nRetrieved Kairos context (source of truth):\n${contextBlock}`,
        },
      ],
      ASK_MAX_OUTPUT_TOKENS,
    );

    const validated = validateGroundedAnswerPayload(payload, allowedRefs);
    return {
      answer: validated.answer,
      citationRefs: validated.citationRefs,
      provider: this.name,
      model: this.model,
    };
  }

  async transcribeAudio(
    buffer: Buffer,
    mimeType: string,
  ): Promise<import('./ai.types').AudioTranscriptionResult> {
    if (!this.isConfigured()) {
      throw new Error(
        'AI provider is not configured. Set AI_API_KEY to enable voice transcription.',
      );
    }
    if (!buffer.byteLength) {
      throw new Error('Audio recording is empty.');
    }

    const model = process.env.TRANSCRIPTION_MODEL?.trim() || 'whisper-1';
    const filename = `capture.${extensionForAudioMime(mimeType)}`;
    const selected = this.keyPool.acquire();
    if (!selected) {
      throw new Error('No AI API key available for transcription.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      const form = new FormData();
      form.append(
        'file',
        new Blob([new Uint8Array(buffer)], { type: mimeType || 'audio/mp4' }),
        filename,
      );
      form.append('model', model);

      const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${selected.key}`,
        },
        body: form,
        signal: controller.signal,
      });

      if (response.status === 429) {
        this.keyPool.markRateLimited(
          selected.slot,
          parseRetryAfterMs(response.headers.get('retry-after')) ?? 1_000,
        );
        throw new Error('Transcription rate-limited. Try again in a moment.');
      }
      if (!response.ok) {
        let detail = '';
        try {
          const errBody = (await response.json()) as {
            error?: { message?: string };
          };
          if (errBody.error?.message) {
            detail = `: ${errBody.error.message}`;
          }
        } catch {
          // ignore
        }
        throw new Error(
          `Transcription failed with status ${response.status}${detail}`,
        );
      }

      const body = (await response.json()) as { text?: string };
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      if (!text) {
        throw new Error('Transcription returned no speech.');
      }
      return { text, provider: this.name, model };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Transcription timed out.');
      }
      throw error;
    } finally {
      this.keyPool.release(selected.slot);
      clearTimeout(timeout);
    }
  }

  private async analyzeSinglePass(text: string): Promise<DocumentAnalysis> {
    const combined = await this.chatJson(
      [
        {
          role: 'system',
          content: DOCUMENT_ANALYSIS_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: `Analyze this document:\n${text}`,
        },
      ],
      INGEST_MAX_OUTPUT_TOKENS,
    );

    return validateDocumentAnalysis(combined, {
      provider: this.name,
      model: this.model,
    });
  }

  /**
   * Each attempt acquires the shared gate. On 429:
   * - cool that key and rotate to the next free key immediately when possible
   * - only apply a global gate cooldown when every key is hot
   */
  private async chatJson(
    messages: ChatMessage[],
    maxTokens: number,
  ): Promise<Record<string, unknown>> {
    let attempt = 0;
    let lastError: Error | undefined;

    while (attempt <= this.maxRetries) {
      if (this.keyPool.availableCount() === 0) {
        const waitMs = Math.max(
          200,
          this.keyPool.msUntilAnyAvailable() || 1_000,
        );
        this.gate.noteCooldownFor(waitMs);
        this.logger.warn(
          `All AI API keys cooling down; waiting ${waitMs}ms before retry`,
        );
        // Honor shared cooldown without issuing an HTTP call.
        await this.gate.run(async () => undefined);
        attempt += 1;
        continue;
      }

      try {
        return await this.gate.run(async () => {
          const selected = this.keyPool.acquire();
          if (!selected) {
            const waitMs = Math.max(
              200,
              this.keyPool.msUntilAnyAvailable() || 1_000,
            );
            throw new RateLimitError('All AI API keys cooling down', waitMs);
          }
          try {
            return await this.chatJsonOnce(
              messages,
              attempt,
              selected.key,
              selected.slot,
              maxTokens,
            );
          } catch (error) {
            if (error instanceof RateLimitError) {
              this.keyPool.markRateLimited(
                selected.slot,
                error.retryAfterMs ?? 1_000,
              );
            }
            throw error;
          } finally {
            this.keyPool.release(selected.slot);
          }
        });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const retryAfterMs =
          error instanceof RateLimitError ? error.retryAfterMs : undefined;

        if (!isRetryableAiError(lastError) || attempt === this.maxRetries) {
          throw lastError;
        }

        if (error instanceof RateLimitError) {
          const othersFree = this.keyPool.availableCount() > 0;
          if (othersFree) {
            this.logger.warn(
              `AI key rate-limited; rotating to next key (attempt ${attempt + 1}/${this.maxRetries + 1})`,
            );
            attempt += 1;
            continue;
          }
          const waitMs =
            (retryAfterMs ?? this.keyPool.msUntilAnyAvailable()) || 1_000;
          this.gate.noteCooldownFor(waitMs);
          this.logger.warn(
            `AI call failed (attempt ${attempt + 1}/${this.maxRetries + 1}): ${lastError.message}. All keys hot; cooling ${waitMs}ms then re-queueing`,
          );
          attempt += 1;
          continue;
        }

        const delayMs = Math.min(1000 * 2 ** attempt, 12_000);
        this.logger.warn(
          `AI call failed (attempt ${attempt + 1}/${this.maxRetries + 1}): ${lastError.message}. Retrying in ${delayMs}ms`,
        );
        await sleep(delayMs);
        attempt += 1;
      }
    }

    throw lastError ?? new Error('AI request failed');
  }

  private async chatJsonOnce(
    messages: ChatMessage[],
    attempt: number,
    apiKey: string,
    keySlot: number,
    maxTokens: number,
  ): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.2,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
          messages,
        }),
        signal: controller.signal,
      });

      if (response.status === 429) {
        await this.logRateLimitDiagnostics(response, attempt, keySlot);
        throw new RateLimitError(
          'AI rate limit exceeded',
          parseRetryAfterMs(response.headers.get('retry-after')),
        );
      }
      if (!response.ok) {
        let detail = '';
        try {
          const errBody = (await response.json()) as {
            error?: { message?: string };
          };
          if (errBody.error?.message) {
            detail = `: ${errBody.error.message}`;
          }
        } catch {
          // ignore body parse errors
        }
        const message = `AI request failed with status ${response.status} (model=${this.model})${detail}`;
        if (
          response.status === 502 ||
          response.status === 503 ||
          response.status === 504
        ) {
          throw new Error(message);
        }
        throw new Error(message);
      }

      const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = body.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('AI returned empty content');
      }

      const parsed = JSON.parse(content) as unknown;
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('AI returned non-object JSON');
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('AI request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Safe 429 diagnostics only — never logs keys, prompts, or document text. */
  private async logRateLimitDiagnostics(
    response: Response,
    attempt: number,
    keySlot: number,
  ): Promise<void> {
    const providerError = await readProviderErrorMeta(response);
    const rateLimitHeaders = collectRateLimitHeaders(response.headers);
    const requestId =
      response.headers.get('x-request-id') ||
      response.headers.get('x-goog-request-id') ||
      response.headers.get('x-groq-request-id') ||
      response.headers.get('cf-ray') ||
      undefined;

    this.logger.warn(
      `AI_REQUEST_FAILED ${JSON.stringify({
        operation: 'chat/completions',
        event: 'rate_limited',
        provider: this.name,
        model: this.model,
        baseUrlHost: hostnameOf(this.baseUrl),
        status: 429,
        attempt: attempt + 1,
        maxAttempts: this.maxRetries + 1,
        keySlot: keySlot + 1,
        keyCount: this.keyPool.size,
        concurrency: this.gate.concurrencyLimit,
        retryAfter: response.headers.get('retry-after') ?? undefined,
        providerErrorCode: providerError.code,
        providerErrorMessage: providerError.message,
        requestId,
        rateLimitHeaders,
      })}`,
    );
  }
}

const DOCUMENT_ANALYSIS_SYSTEM_PROMPT = `You analyze personal documents. Return strict JSON only with this shape:
{"summary":"string","topics":[{"name":"string","confidence":0.0}],"entities":[{"name":"string","type":"PERSON|ORGANIZATION|TECHNOLOGY|PRODUCT|LOCATION|CONCEPT","confidence":0.0}]}
Rules:
- Be conservative. Do not hallucinate.
- Topics should be short labels (2-4 words).
- Entities must use only the allowed types.
- Prefer precision over recall.`;

class RateLimitError extends Error {
  constructor(
    message: string,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

function isRetryableAiError(error: Error): boolean {
  if (error instanceof RateLimitError) return true;
  return /timeout|rate limit|429|502|503|504|network|ECONNRESET|fetch failed|cooling down/i.test(
    error.message,
  );
}

function hostnameOf(baseUrl: string): string {
  try {
    return new URL(baseUrl).hostname;
  } catch {
    return 'invalid-base-url';
  }
}

const RATE_LIMIT_HEADER_NAMES = [
  'retry-after',
  'x-ratelimit-limit-requests',
  'x-ratelimit-remaining-requests',
  'x-ratelimit-reset-requests',
  'x-ratelimit-limit-tokens',
  'x-ratelimit-remaining-tokens',
  'x-ratelimit-reset-tokens',
  'x-ratelimit-limit-tokens-minute',
  'x-ratelimit-remaining-tokens-minute',
  'x-ratelimit-reset-tokens-minute',
] as const;

function collectRateLimitHeaders(
  headers: Headers,
): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const name of RATE_LIMIT_HEADER_NAMES) {
    const value = headers.get(name);
    if (value) {
      out[name] = value;
    }
  }
  headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower.startsWith('x-ratelimit-') && !(lower in out)) {
      out[lower] = value;
    }
  });
  return Object.keys(out).length > 0 ? out : undefined;
}

async function readProviderErrorMeta(
  response: Response,
): Promise<{ code?: string; message?: string }> {
  try {
    const clone = response.clone();
    const body = (await clone.json()) as {
      error?: { code?: unknown; message?: unknown; type?: unknown };
    };
    const err = body.error;
    if (!err || typeof err !== 'object') {
      return {};
    }
    const code =
      typeof err.code === 'string'
        ? err.code.slice(0, 120)
        : typeof err.type === 'string'
          ? err.type.slice(0, 120)
          : undefined;
    const message =
      typeof err.message === 'string' ? err.message.slice(0, 400) : undefined;
    return { code, message };
  } catch {
    return {};
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extensionForAudioMime(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'mp3';
  if (normalized.includes('wav')) return 'wav';
  if (normalized.includes('ogg') || normalized.includes('oga')) return 'ogg';
  if (normalized.includes('webm')) return 'webm';
  if (normalized.includes('aac')) return 'aac';
  return 'm4a';
}

// Re-export validators for unit tests that don't need the provider.
export { validateTopics, validateEntities, validateSummary };
