import { ObservationType } from '@prisma/client';
import type { ContentExtractor, ExtractionResult } from './extractor.types';

export class TextExtractor implements ContentExtractor {
  supports(type: ObservationType, mimeType: string): boolean {
    return type === ObservationType.TEXT || mimeType === 'text/plain';
  }

  extract(buffer: Buffer): Promise<ExtractionResult> {
    const text = buffer.toString('utf8');
    return Promise.resolve({
      text,
      metadata: {
        encoding: 'utf8',
        byteLength: buffer.byteLength,
      },
    });
  }
}
