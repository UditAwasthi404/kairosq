import { Logger } from '@nestjs/common';
import { ObservationType } from '@prisma/client';
import type { ContentExtractor, ExtractionResult } from './extractor.types';
import { createOcrProvider } from '../ocr/gemini-ocr.provider';
import { OCR_MAX_IMAGE_BYTES, OCR_SUPPORTED_MIME } from '../ocr/ocr.types';

/**
 * Image extraction with optional Gemini multimodal OCR.
 * When OCR is not configured, stores metadata only (no invented text).
 */
export class ImageExtractor implements ContentExtractor {
  private readonly logger = new Logger(ImageExtractor.name);

  supports(type: ObservationType, mimeType: string): boolean {
    return type === ObservationType.IMAGE || mimeType.startsWith('image/');
  }

  async extract(buffer: Buffer, mimeType: string): Promise<ExtractionResult> {
    const baseMeta = {
      mimeType,
      byteLength: buffer.byteLength,
    };

    const ocr = createOcrProvider();
    if (!ocr) {
      this.logger.warn(
        'OCR skipped: provider not configured (set OCR_PROVIDER=gemini and OCR_API_KEY, EMBEDDING_API_KEY, or AI_API_KEY)',
      );
      return {
        text: null,
        metadata: {
          ...baseMeta,
          ocrAvailable: false,
        },
        notes:
          'OCR is not configured. Set OCR_PROVIDER=gemini and OCR_API_KEY (or EMBEDDING_API_KEY / AI_API_KEY). Image metadata was stored without text.',
      };
    }

    if (!OCR_SUPPORTED_MIME.has(mimeType)) {
      return {
        text: null,
        metadata: { ...baseMeta, ocrAvailable: true, ocrSkipped: true },
        notes: `OCR skipped: unsupported image type ${mimeType}.`,
      };
    }

    if (buffer.byteLength > OCR_MAX_IMAGE_BYTES) {
      return {
        text: null,
        metadata: { ...baseMeta, ocrAvailable: true, ocrSkipped: true },
        notes: `OCR skipped: image exceeds ${OCR_MAX_IMAGE_BYTES} byte limit.`,
      };
    }

    try {
      this.logger.log(
        `OCR starting (provider=${ocr.name}, model=${ocr.model}, bytes=${buffer.byteLength}, mime=${mimeType})`,
      );
      const result = await ocr.extractText(buffer, mimeType);
      const text = result.text.trim() || null;
      this.logger.log(
        `OCR completed (model=${result.model}, textLength=${text?.length ?? 0})`,
      );
      return {
        text,
        metadata: {
          ...baseMeta,
          ocrAvailable: true,
          ocrProvider: result.provider,
          ocrModel: result.model,
          ocrTextLength: text?.length ?? 0,
        },
        notes: text
          ? undefined
          : 'OCR completed but found no readable text in the image.',
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'OCR request failed';
      this.logger.warn(`OCR failed: ${message}`);
      return {
        text: null,
        metadata: {
          ...baseMeta,
          ocrAvailable: true,
          ocrFailed: true,
          ocrError: message.slice(0, 240),
        },
        notes: `OCR failed: ${message.slice(0, 200)}`,
      };
    }
  }
}
