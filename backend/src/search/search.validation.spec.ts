import {
  validateSearchRequest,
  MAX_SEARCH_QUERY_LENGTH,
} from './search.validation';

describe('validateSearchRequest', () => {
  it('rejects empty query', () => {
    expect(() => validateSearchRequest({ query: '   ' })).toThrow();
  });

  it('rejects non-string query', () => {
    expect(() => validateSearchRequest({ query: 123 })).toThrow();
  });

  it('rejects oversized query', () => {
    expect(() =>
      validateSearchRequest({ query: 'a'.repeat(MAX_SEARCH_QUERY_LENGTH + 1) }),
    ).toThrow();
  });

  it('rejects invalid limit', () => {
    expect(() => validateSearchRequest({ query: 'redis', limit: 0 })).toThrow();
    expect(() =>
      validateSearchRequest({ query: 'redis', limit: 99 }),
    ).toThrow();
  });

  it('accepts a valid request', () => {
    const result = validateSearchRequest({
      query: '  What did I learn about Redis? ',
      limit: 5,
      filters: {
        observationType: 'TEXT',
        from: '2026-01-01T00:00:00.000Z',
      },
    });
    expect(result.query).toBe('What did I learn about Redis?');
    expect(result.limit).toBe(5);
    expect(result.filters.observationType).toBe('TEXT');
    expect(result.filters.from?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('accepts source and observation filters', () => {
    const result = validateSearchRequest({
      query: 'screenshot from last week',
      filters: {
        source: 'SHARE',
        excludeObservationId: 'obs_self',
      },
    });
    expect(result.filters.source).toBe('SHARE');
    expect(result.filters.excludeObservationId).toBe('obs_self');
  });

  it('rejects an unknown source filter', () => {
    expect(() =>
      validateSearchRequest({
        query: 'redis',
        filters: { source: 'NOT_A_SOURCE' },
      }),
    ).toThrow();
  });

  it('combines source and date filters with the query', () => {
    const result = validateSearchRequest({
      query: 'redis notes',
      filters: {
        source: 'VOICE',
        from: '2026-09-01T00:00:00.000Z',
        to: '2026-09-24T23:59:59.999Z',
      },
    });
    expect(result.query).toBe('redis notes');
    expect(result.filters.source).toBe('VOICE');
    expect(result.filters.from?.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(result.filters.to?.toISOString()).toBe('2026-09-24T23:59:59.999Z');
  });

  it('accepts projectId filter', () => {
    const result = validateSearchRequest({
      query: 'caching',
      projectId: 'proj_1',
      filters: { projectId: 'proj_1' },
    });
    expect(result.filters.projectId).toBe('proj_1');
  });
});
