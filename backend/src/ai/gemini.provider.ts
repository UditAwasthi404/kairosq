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
  validateGroundedAnswerPayload,
} from './ai-output.validation';
import type {
  AIProvider,
  AudioTranscriptionResult,
  ConversationHistoryTurn,
  DocumentAnalysis,
  ExtractedEntity,
  ExtractedTopic,
  GroundedAnswerResult,
  GroundedContextItem,
} from './ai.types';
import {
  geminiChatModelChain,
  geminiThinkingConfig,
  readIngestModel,
} from './gemini-models';
import { RAG_SYSTEM_PROMPT } from './rag.prompt';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

const ANALYSIS_EXCERPT_CHARS = 24_000;
const ASK_MAX_OUTPUT_TOKENS = 700;
const INGEST_MAX_OUTPUT_TOKENS = 2048;
const DEFAULT_GEMINI_BASE = 'https://generativelanguage.googleapis.com';

@Injectable()
export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';
  private readonly logger = new Logger(GeminiProvider.name);
  private keyPool: AiApiKeyPool;
  private readonly baseUrl: string;
  private readonly models: string[];
  private modelIndex = 0;
  private readonly maxRetries: number;
  private gate: AiRequestGate;

  constructor() {
    const keys = readAiApiKeys();
    this.keyPool = new AiApiKeyPool(keys);
    this.baseUrl = normalizeGeminiChatBaseUrl(
      process.env.AI_BASE_URL?.trim() || DEFAULT_GEMINI_BASE,
    );
    this.models = geminiChatModelChain(process.env.AI_MODEL);
    this.maxRetries = readAiChatMaxRetries();
    const concurrency = readAiChatConcurrency(process.env, keys.length);
    this.gate = new AiRequestGate(concurrency);
    if (keys.length > 0) {
      this.logger.log(
        `AI chat ready: ${keys.length} Gemini key(s), concurrency=${concurrency}, model=${this.model} fallbacks=${this.models.slice(1).join(',') || 'none'}`,
      );
    }
  }

  get model(): string {
    return this.models[this.modelIndex] ?? this.models[0] ?? 'gemini-3.8-flash';
  }

  replaceGateForTests(gate: AiRequestGate): void {
    this.gate = gate;
  }

  replaceKeyPoolForTests(pool: AiApiKeyPool): void {
    this.keyPool = pool;
  }

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

    const { data, model } = await this.chatJson(
      [
        { role: 'system', content: RAG_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Recent conversation (for resolving references only; not a knowledge source):\n${historyBlock}\n\nCurrent question:\n${params.question}\n\nRetrieved Kairos context (source of truth):\n${contextBlock}`,
        },
      ],
      { maxOutputTokens: ASK_MAX_OUTPUT_TOKENS },
    );

    const validated = validateGroundedAnswerPayload(data, allowedRefs);
    return {
      answer: validated.answer,
      citationRefs: validated.citationRefs,
      provider: this.name,
      model,
    };
  }

  async transcribeAudio(
    buffer: Buffer,
    mimeType: string,
  ): Promise<AudioTranscriptionResult> {
    if (!this.isConfigured()) {
      throw new Error(
        'AI provider is not configured. Set AI_API_KEY to enable voice transcription.',
      );
    }
    if (!buffer.byteLength) {
      throw new Error('Audio recording is empty.');
    }

    const models = geminiChatModelChain(
      process.env.TRANSCRIPTION_MODEL?.trim() || readIngestModel(),
    );
    const selected = this.keyPool.acquire();
    if (!selected) {
      throw new Error('No AI API key available for transcription.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);
    try {
      let lastError: Error | undefined;
      for (const model of models) {
        const response = await fetch(this.generateUrl(model), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': selected.key,
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inline_data: {
                      mime_type: mimeType || 'audio/mp4',
                      data: buffer.toString('base64'),
                    },
                  },
                  {
                    text: 'Transcribe this audio. Return only the spoken words as plain text. Do not add commentary.',
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: INGEST_MAX_OUTPUT_TOKENS,
              thinkingConfig: geminiThinkingConfig(model),
            },
          }),
          signal: controller.signal,
        });

        if (response.status === 429) {
          this.keyPool.markRateLimited(
            selected.slot,
            parseRetryAfterMs(response.headers.get('retry-after')) ?? 1_000,
          );
          throw new Error('Transcription rate-limited. Try again in a moment.');
        }
        if (response.status === 503 || response.status === 404) {
          lastError = new Error(
            `Transcription failed with status ${response.status} (model=${model})${await readErrorDetail(response)}`,
          );
          if (model !== models.at(-1)) {
            this.logger.warn(
              `Transcription model ${model} unavailable, trying next: ${lastError.message}`,
            );
            continue;
          }
          throw lastError;
        }
        if (!response.ok) {
          throw new Error(
            `Transcription failed with status ${response.status}${await readErrorDetail(response)}`,
          );
        }

        const text = extractGeminiText(await response.json()).trim();
        if (!text) {
          throw new Error('Transcription returned no speech.');
        }
        return { text, provider: this.name, model };
      }
      throw lastError ?? new Error('Transcription returned no speech.');
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
    const models = geminiChatModelChain(readIngestModel());
    const { data, model } = await this.chatJson(
      [
        { role: 'system', content: DOCUMENT_ANALYSIS_SYSTEM_PROMPT },
        { role: 'user', content: `Analyze this document:\n${text}` },
      ],
      { maxOutputTokens: INGEST_MAX_OUTPUT_TOKENS, models },
    );
    return validateDocumentAnalysis(data, {
      provider: this.name,
      model,
    });
  }

  private async chatJson(
    messages: ChatMessage[],
    options: { maxOutputTokens: number; models?: string[] },
  ): Promise<{ data: Record<string, unknown>; model: string }> {
    const models = options.models?.length ? options.models : this.models;
    const pinned = Boolean(options.models?.length);
    let cursor = pinned ? 0 : this.modelIndex;
    let attempt = 0;
    let lastError: Error | undefined;

    while (attempt <= this.maxRetries) {
      const model = models[Math.min(cursor, models.length - 1)] ?? models[0];
      if (this.keyPool.availableCount() === 0) {
        const waitMs = Math.max(200, this.keyPool.msUntilAnyAvailable() || 1_000);
        this.gate.noteCooldownFor(waitMs);
        this.logger.warn(
          `All Gemini API keys cooling down; waiting ${waitMs}ms before retry`,
        );
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
            const data = await this.chatJsonOnce(
              messages,
              attempt,
              selected.key,
              selected.slot,
              model,
              options.maxOutputTokens,
            );
            return { data, model };
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

        if (
          error instanceof ModelUnavailableError &&
          cursor + 1 < models.length
        ) {
          cursor += 1;
          if (!pinned) this.modelIndex = cursor;
          this.logger.warn(
            `Gemini falling back to ${models[cursor]} after capacity/unavailable error`,
          );
          attempt += 1;
          continue;
        }

        if (!isRetryableAiError(lastError) || attempt === this.maxRetries) {
          throw lastError;
        }

        if (error instanceof RateLimitError) {
          if (this.keyPool.availableCount() > 0) {
            this.logger.warn(
              `Gemini key rate-limited; rotating to next key (attempt ${attempt + 1}/${this.maxRetries + 1})`,
            );
            attempt += 1;
            continue;
          }
          const waitMs =
            (retryAfterMs ?? this.keyPool.msUntilAnyAvailable()) || 1_000;
          this.gate.noteCooldownFor(waitMs);
          this.logger.warn(
            `Gemini call failed (attempt ${attempt + 1}/${this.maxRetries + 1}): ${lastError.message}. All keys hot; cooling ${waitMs}ms then re-queueing`,
          );
          attempt += 1;
          continue;
        }

        const delayMs = Math.min(1000 * 2 ** attempt, 12_000);
        this.logger.warn(
          `Gemini call failed (attempt ${attempt + 1}/${this.maxRetries + 1}): ${lastError.message}. Retrying in ${delayMs}ms`,
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
    model: string,
    maxOutputTokens: number,
  ): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);

    try {
      const response = await fetch(this.generateUrl(model), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(
          toGeminiGenerateBody(messages, {
            json: true,
            maxOutputTokens,
            model,
          }),
        ),
        signal: controller.signal,
      });

      if (response.status === 503 || response.status === 404) {
        throw new ModelUnavailableError(
          `AI request failed with status ${response.status} (model=${model})${await readErrorDetail(response)}`,
          response.status,
        );
      }
      if (response.status === 429) {
        this.logger.warn(
          `AI_REQUEST_FAILED ${JSON.stringify({
            operation: 'generateContent',
            event: 'rate_limited',
            provider: this.name,
            model,
            status: 429,
            attempt: attempt + 1,
            keySlot: keySlot + 1,
            keyCount: this.keyPool.size,
            retryAfter: response.headers.get('retry-after') ?? undefined,
          })}`,
        );
        throw new RateLimitError(
          'AI rate limit exceeded',
          parseRetryAfterMs(response.headers.get('retry-after')),
        );
      }
      if (!response.ok) {
        const message = `AI request failed with status ${response.status} (model=${model})${await readErrorDetail(response)}`;
        throw new Error(message);
      }

      const content = extractGeminiText(await response.json());
      if (!content) {
        throw new Error('AI returned empty content');
      }
      const parsed = JSON.parse(stripJsonFence(content)) as unknown;
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

  private generateUrl(model: string): string {
    return `${this.baseUrl}/models/${encodeURIComponent(model)}:generateContent`;
  }
}

export function normalizeGeminiChatBaseUrl(baseUrl: string): string {
  const raw = baseUrl.replace(/\/+$/, '');
  if (raw.endsWith('/v1beta')) return raw;
  if (raw.endsWith('/v1')) return `${raw}beta`;
  return `${raw}/v1beta`;
}

function toGeminiGenerateBody(
  messages: ChatMessage[],
  options: { json: boolean; maxOutputTokens: number; model: string },
) {
  const system = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n');
  const contents = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    }));

  return {
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: options.maxOutputTokens,
      thinkingConfig: geminiThinkingConfig(options.model),
      ...(options.json ? { responseMimeType: 'application/json' } : {}),
    },
  };
}

function extractGeminiText(body: unknown): string {
  const payload = body as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return (
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim() ?? ''
  );
}

function stripJsonFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1]?.trim() || trimmed;
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const errBody = (await response.json()) as { error?: { message?: string } };
    return errBody.error?.message ? `: ${errBody.error.message}` : '';
  } catch {
    return '';
  }
}

const DOCUMENT_ANALYSIS_SYSTEM_PROMPT = `You analyze personal documents. Return strict JSON only with this shape:
{"summary":"string","topics":[{"name":"string","confidence":0.0}],"entities":[{"name":"string","type":"PERSON|ORGANIZATION|TECHNOLOGY|PRODUCT|LOCATION|CONCEPT","confidence":0.0}]}
Rules:
- Be conservative. Do not hallucinate.
- Topics should be short labels (2-4 words).
- Entities must use only the allowed types.
- Prefer precision over recall.`;

class ModelUnavailableError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ModelUnavailableError';
  }
}

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
  if (error instanceof ModelUnavailableError) return true;
  return /timeout|rate limit|429|502|503|504|network|ECONNRESET|fetch failed|cooling down/i.test(
    error.message,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
