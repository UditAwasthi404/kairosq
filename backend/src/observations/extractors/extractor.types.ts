import type { ObservationType } from '@prisma/client';
import { normalizeDocumentText } from '../normalize';

export type ExtractionResult = {
  text: string | null;
  metadata: Record<string, unknown>;
  notes?: string;
};

export interface ContentExtractor {
  supports(type: ObservationType, mimeType: string): boolean;
  extract(buffer: Buffer, mimeType: string): Promise<ExtractionResult>;
}

/** @deprecated Prefer normalizeDocumentText — kept for older imports. */
export function normalizeExtractedText(text: string | null): string | null {
  return normalizeDocumentText(text);
}
