import { Injectable, Logger } from '@nestjs/common';
import { geminiThinkingConfig } from '../../ai/gemini-models';
import {
  OCR_MAX_IMAGE_BYTES,
  OCR_SUPPORTED_MIME,
  readOcrConfig,
  type OcrProvider,
  type OcrResult,
} from './ocr.types';

const OCR_PROMPT = `You extract content from a personal memory capture (screenshot, photo, or document image).

Rules:
1. Transcribe all readable text exactly as it appears (OCR). Preserve line breaks when helpful.
2. If there is little or no text, add a short factual description of what the image shows.
3. Do not invent text that is not visible.
4. Return plain text only — no markdown fences, no JSON, no preamble.`;

/**
 * Gemini multimodal OCR via generateContent + inline image bytes.
 */
@Injectable()
export class GeminiOcrProvider implements OcrProvider {
  readonly name = 'gemini';
  readonly model: string;
  private readonly logger = new Logger(GeminiOcrProvider.name);
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;

  constructor() {
    const config = readOcrConfig();
    this.model = config.model.replace(/^models\//, '');
    this.apiKey = config.apiKey;
    this.baseUrl = normalizeGeminiOcrBaseUrl(config.baseUrl);
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async extractText(buffer: Buffer, mimeType: string): Promise<OcrResult> {
    if (!this.isConfigured()) {
      throw new Error('OCR provider is not configured');
    }
    if (!OCR_SUPPORTED_MIME.has(mimeType)) {
      throw new Error(`OCR does not support mime type ${mimeType}`);
    }
    if (buffer.byteLength > OCR_MAX_IMAGE_BYTES) {
      throw new Error(
        `Image exceeds OCR size limit of ${OCR_MAX_IMAGE_BYTES} bytes`,
      );
    }

    const modelsToTry = uniqueModels([
      this.model,
      'gemini-3.8-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
    ]);

    let lastError: Error | undefined;
    for (const model of modelsToTry) {
      try {
        const text = await this.requestOnce(buffer, mimeType, model);
        return { text, provider: this.name, model };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const retryableUnavailable =
          /status 404|status 503/i.test(lastError.message) &&
          model !== modelsToTry.at(-1);
        if (retryableUnavailable) {
          this.logger.warn(
            `OCR model ${model} unavailable, trying next: ${lastError.message}`,
          );
          continue;
        }
        throw lastError;
      }
    }

    throw lastError ?? new Error('OCR request failed');
  }

  private async requestOnce(
    buffer: Buffer,
    mimeType: string,
    model: string,
  ): Promise<string> {
    const url = `${this.baseUrl}/models/${encodeURIComponent(model)}:generateContent`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey!,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: buffer.toString('base64'),
                  },
                },
                { text: OCR_PROMPT },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
            thinkingConfig: geminiThinkingConfig(model),
          },
        }),
        signal: controller.signal,
      });

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
          `OCR request failed with status ${response.status}${detail}`,
        );
      }

      const body = (await response.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };
      const text = body.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? '')
        .join('')
        .trim();

      if (!text) {
        this.logger.warn('OCR returned empty candidates');
        return '';
      }

      return text;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('OCR request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function uniqueModels(models: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const model of models) {
    const id = model.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function createOcrProvider(): OcrProvider | null {
  const config = readOcrConfig();
  if (config.provider === 'none' || config.provider === 'off') {
    return null;
  }
  if (config.provider === 'gemini') {
    const gemini = new GeminiOcrProvider();
    return gemini.isConfigured() ? gemini : null;
  }
  return null;
}

export function normalizeGeminiOcrBaseUrl(baseUrl: string): string {
  const raw = baseUrl.replace(/\/+$/, '');
  if (raw.endsWith('/v1beta')) return raw;
  if (raw.endsWith('/v1')) return `${raw}beta`;
  return `${raw}/v1beta`;
}
