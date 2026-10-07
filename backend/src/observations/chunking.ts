export type TextChunk = {
  content: string;
  chunkIndex: number;
  startOffset: number;
  endOffset: number;
};

export type ChunkOptions = {
  maxChars?: number;
  overlapChars?: number;
};

const DEFAULT_MAX_CHARS = 1800;
const DEFAULT_OVERLAP_CHARS = 200;

/**
 * Deterministic character chunking with overlap.
 * Prefers breaking on whitespace near the window end.
 */
export function chunkText(
  text: string,
  options: ChunkOptions = {},
): TextChunk[] {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const overlapChars = Math.min(
    options.overlapChars ?? DEFAULT_OVERLAP_CHARS,
    Math.max(0, maxChars - 1),
  );

  if (!text || text.length === 0) {
    return [];
  }

  if (text.length <= maxChars) {
    return [
      {
        content: text,
        chunkIndex: 0,
        startOffset: 0,
        endOffset: text.length,
      },
    ];
  }

  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);

    if (end < text.length) {
      const window = text.slice(start, end);
      const breakAt = findBreakIndex(window);
      if (breakAt > Math.floor(maxChars * 0.4)) {
        end = start + breakAt;
      }
    }

    const content = text.slice(start, end).trim();
    if (content.length > 0) {
      chunks.push({
        content,
        chunkIndex: index,
        startOffset: start,
        endOffset: end,
      });
      index += 1;
    }

    if (end >= text.length) {
      break;
    }

    const nextStart = Math.max(end - overlapChars, start + 1);
    start = nextStart;
  }

  return chunks;
}

function findBreakIndex(window: string): number {
  const candidates = ['\n\n', '\n', '. ', ' ', '\t'];
  for (const token of candidates) {
    const idx = window.lastIndexOf(token);
    if (idx >= 0) {
      return idx + token.length;
    }
  }
  return window.length;
}

export function computeTextStats(text: string | null): {
  characterCount: number;
  wordCount: number;
} {
  if (!text) {
    return { characterCount: 0, wordCount: 0 };
  }
  const characterCount = text.length;
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return { characterCount, wordCount };
}
