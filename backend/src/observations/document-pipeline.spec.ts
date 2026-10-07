import { chunkText, computeTextStats } from './chunking';
import { normalizeDocumentText } from './normalize';

describe('normalizeDocumentText', () => {
  it('collapses whitespace and control characters', () => {
    const input = 'Hello\u0000  world\r\n\r\n\r\nNext';
    expect(normalizeDocumentText(input)).toBe('Hello world\n\nNext');
  });

  it('returns null for empty input', () => {
    expect(normalizeDocumentText('   ')).toBeNull();
    expect(normalizeDocumentText(null)).toBeNull();
  });

  it('joins hyphenated line breaks from PDF extraction', () => {
    expect(normalizeDocumentText('informa-\ntion retrieval')).toBe(
      'information retrieval',
    );
  });
});

describe('chunkText', () => {
  it('returns empty for empty input', () => {
    expect(chunkText('')).toEqual([]);
  });

  it('keeps small documents as a single chunk', () => {
    const chunks = chunkText('short document');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.chunkIndex).toBe(0);
    expect(chunks[0]?.content).toBe('short document');
  });

  it('preserves ordering and indexes for large documents', () => {
    const text = Array.from({ length: 200 }, (_, i) => `word${i}`).join(' ');
    const chunks = chunkText(text, { maxChars: 80, overlapChars: 10 });
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk, index) => {
      expect(chunk.chunkIndex).toBe(index);
      expect(chunk.content.length).toBeGreaterThan(0);
      expect(chunk.endOffset).toBeGreaterThan(chunk.startOffset);
    });
    for (let i = 1; i < chunks.length; i += 1) {
      expect(chunks[i].startOffset).toBeGreaterThanOrEqual(0);
      expect(chunks[i].chunkIndex).toBe(chunks[i - 1].chunkIndex + 1);
    }
  });

  it('avoids cutting mid-word when possible', () => {
    const text = 'alpha beta gamma delta epsilon zeta eta theta';
    const chunks = chunkText(text, { maxChars: 20, overlapChars: 4 });
    for (const chunk of chunks) {
      expect(chunk.content.startsWith(' ')).toBe(false);
      expect(chunk.content.endsWith(' ')).toBe(false);
    }
  });
});

describe('computeTextStats', () => {
  it('counts characters and words', () => {
    expect(computeTextStats('one two three')).toEqual({
      characterCount: 13,
      wordCount: 3,
    });
  });
});
