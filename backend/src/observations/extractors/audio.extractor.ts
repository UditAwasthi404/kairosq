import { Logger } from '@nestjs/common';
import { ObservationType } from '@prisma/client';
import type { ContentExtractor, ExtractionResult } from './extractor.types';

export type AudioTranscriber = (
  buffer: Buffer,
  mimeType: string,
) => Promise<{ text: string; provider: string; model: string }>;

/**
 * Voice / audio extraction. Transcribes via the existing AI provider
 * (Gemini generateContent, or OpenAI-compatible /audio/transcriptions) and preserves the transcript
 * for the standard chunk → analyze → embed pipeline.
 */
export class AudioExtractor implements ContentExtractor {
  private readonly logger = new Logger(AudioExtractor.name);

  constructor(private readonly transcribe: AudioTranscriber) {}

  supports(type: ObservationType, mimeType: string): boolean {
    return type === ObservationType.AUDIO || mimeType.startsWith('audio/');
  }

  async extract(buffer: Buffer, mimeType: string): Promise<ExtractionResult> {
    const baseMeta = {
      mimeType,
      byteLength: buffer.byteLength,
    };

    if (!buffer.byteLength) {
      throw new Error('Audio recording is empty.');
    }

    try {
      const result = await this.transcribe(buffer, mimeType);
      const text = result.text.trim();
      this.logger.log(
        `Transcription completed (provider=${result.provider}, model=${result.model}, chars=${text.length})`,
      );
      if (!text) {
        throw new Error('Transcription returned no speech.');
      }
      return {
        text,
        metadata: {
          ...baseMeta,
          transcript: text,
          transcriptionProvider: result.provider,
          transcriptionModel: result.model,
        },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Transcription failed';
      this.logger.warn(`Transcription failed: ${message}`);
      throw new Error(`Transcription failed: ${message}`);
    }
  }
}
