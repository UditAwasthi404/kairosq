import { Injectable } from '@nestjs/common';
import type { GroundedContextItem } from '../ai/ai.types';
import type { SemanticSearchResult } from '../search/search.service';

export type RagContextBuildOptions = {
  maxChunks?: number;
  maxChars?: number;
};

@Injectable()
export class RagContextBuilder {
  build(
    hits: SemanticSearchResult[],
    options: RagContextBuildOptions = {},
  ): GroundedContextItem[] {
    const maxChunks = Math.max(
      1,
      options.maxChunks ?? Math.floor(readFloatEnv('ASK_MAX_CHUNKS', 6)),
    );
    const maxChars = Math.max(
      500,
      options.maxChars ??
        Math.floor(readFloatEnv('ASK_MAX_CONTEXT_CHARS', 8000)),
    );

    const context: GroundedContextItem[] = [];
    let usedChars = 0;

    for (const hit of hits) {
      if (context.length >= maxChunks) break;

      const content = hit.content.replace(/\s+/g, ' ').trim();
      if (!content) continue;

      // Prefer dropping lower-ranked chunks over mid-chunk truncation.
      if (usedChars + content.length > maxChars && context.length > 0) {
        break;
      }

      let clipped = content;
      if (content.length > maxChars && context.length === 0) {
        clipped = clipAtSentenceBoundary(content, maxChars);
      } else if (usedChars + content.length > maxChars) {
        break;
      }

      context.push({
        ref: context.length + 1,
        chunkId: hit.chunkId,
        observationId: hit.observationId,
        title: hit.observation.filename,
        content: clipped,
        createdAt: hit.observation.capturedAt,
        similarity: hit.similarity,
      });
      usedChars += clipped.length;
    }

    return context;
  }
}

function clipAtSentenceBoundary(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const lastStop = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('? '),
    slice.lastIndexOf('! '),
  );
  if (lastStop > maxChars * 0.5) {
    return slice.slice(0, lastStop + 1).trim();
  }
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace > maxChars * 0.5) {
    return `${slice.slice(0, lastSpace).trim()}…`;
  }
  return `${slice.trim()}…`;
}

function readFloatEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : fallback;
}
