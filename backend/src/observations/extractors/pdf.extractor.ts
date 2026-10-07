import { ObservationType } from '@prisma/client';
import type { ContentExtractor, ExtractionResult } from './extractor.types';

export class PdfExtractor implements ContentExtractor {
  supports(type: ObservationType, mimeType: string): boolean {
    return type === ObservationType.PDF || mimeType === 'application/pdf';
  }

  async extract(buffer: Buffer): Promise<ExtractionResult> {
    // Lazy import: pdf-parse@2 needs Node >= 20; avoid crashing boot on older runtimes.
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    try {
      const textResult = await parser.getText();
      let pageCount: number | null = null;
      try {
        const info = await parser.getInfo();
        pageCount = info?.total ?? null;
      } catch {
        pageCount = null;
      }

      return {
        text: textResult.text ?? '',
        metadata: {
          pageCount,
        },
      };
    } finally {
      await parser.destroy();
    }
  }
}
