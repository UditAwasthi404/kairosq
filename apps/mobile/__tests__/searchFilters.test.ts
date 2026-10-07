import {
  buildSemanticFilters,
  dateRangeForPreset,
  removeLibraryFilter,
  toggleLibraryScopeFilter,
  searchDateLabel,
  searchSourceLabel,
} from '../lib/searchFilters';

describe('search filter chips', () => {
  const now = new Date('2026-09-24T12:00:00.000Z');

  it('maps Kairos capture sources', () => {
    expect(searchSourceLabel('QUICK_CAPTURE')).toBe('Quick Capture');
    expect(searchSourceLabel('SHARE')).toBe('Share');
    expect(searchSourceLabel('WIDGET')).toBe('Widget');
  });

  it('builds backend date ranges for presets', () => {
    const today = dateRangeForPreset('today', now);
    expect(today.from).toBe(new Date('2026-09-24T00:00:00.000').toISOString());
    expect(searchDateLabel('this_week')).toBe('This week');

    const yesterday = dateRangeForPreset('yesterday', now);
    expect(new Date(yesterday.from).getDate()).toBe(23);
    expect(new Date(yesterday.to).getDate()).toBe(23);

    const month = dateRangeForPreset('this_month', now);
    expect(new Date(month.from).getDate()).toBe(1);
  });

  it('builds semantic filters and removes a date range as one chip', () => {
    expect(buildSemanticFilters({ source: 'VOICE', topicId: 'topic-1', from: 'a', to: 'b' })).toEqual({
      source: 'VOICE', topicId: 'topic-1', from: 'a', to: 'b',
    });
    expect(removeLibraryFilter({ from: 'a', to: 'b', entity: 'Mira' }, 'from')).toEqual({ entity: 'Mira' });
    expect(toggleLibraryScopeFilter({}, { type: 'project', id: 'p1', name: 'Work' })).toEqual({ projectId: 'p1' });
    expect(toggleLibraryScopeFilter({ topicId: 't1', topic: 'Ideas' }, { type: 'topic', id: 't1', name: 'Ideas' })).toEqual({});
  });
});
