import { readEmbeddingApiKeys } from '../../ai/ai-api-key-pool';
import { readIngestModel, resolveGeminiChatModel } from '../../ai/gemini-models';

export type OcrConfig = {
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl: string;
};

export type OcrResult = {
  text: string;
  provider: string;
  model: string;
};

export interface OcrProvider {
  readonly name: string;
  readonly model: string;
  isConfigured(): boolean;
  extractText(buffer: Buffer, mimeType: string): Promise<OcrResult>;
}

export function readOcrConfig(): OcrConfig {
  const provider = (process.env.OCR_PROVIDER ?? 'gemini').toLowerCase();
  return {
    provider,
    model: resolveGeminiChatModel(process.env.OCR_MODEL?.trim() || readIngestModel()),
    apiKey:
      process.env.OCR_API_KEY?.trim() || readEmbeddingApiKeys()[0] || undefined,
    baseUrl: (
      process.env.OCR_BASE_URL?.trim() ||
      process.env.EMBEDDING_BASE_URL?.trim() ||
      'https://generativelanguage.googleapis.com'
    ).replace(/\/+$/, ''),
  };
}

/** Inline multimodal requests get large once base64-encoded; stay under ~12MB raw. */
export const OCR_MAX_IMAGE_BYTES = 12 * 1024 * 1024;

export const OCR_SUPPORTED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);
