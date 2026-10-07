import { normalizeLexicalQuery, escapeIlikePattern } from './lexical-query';

describe('lexical-query', () => {
  it('tokenizes hyphenated and dotted technical terms', () => {
    expect(normalizeLexicalQuery('maxmemory-policy allkeys-lru')).toEqual(
      expect.objectContaining({
        ftsInput: 'maxmemory policy allkeys lru',
        tokens: ['maxmemory', 'policy', 'allkeys', 'lru'],
      }),
    );
    expect(normalizeLexicalQuery('redis.io').ftsInput).toBe('redis io');
    expect(normalizeLexicalQuery('redis-production-config.pdf').ftsInput).toBe(
      'redis production config pdf',
    );
  });

  it('escapes ILIKE wildcards', () => {
    expect(escapeIlikePattern('100%_done')).toBe('100\\%\\_done');
  });
});
