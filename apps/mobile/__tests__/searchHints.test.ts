import { inferSearchHints, relativeMemoryLabel } from '../lib/searchHints';

describe('search hints', () => {
  const now = new Date('2026-09-24T12:00:00.000Z');

  it('detects last week and share sources', () => {
    const hints = inferSearchHints('things I saved from Chrome last week', now);
    expect(hints.source).toBe('SHARE');
    expect(hints.from).toBeTruthy();
    expect(hints.labels).toEqual(expect.arrayContaining(['Share', 'Last 7 days']));
  });

  it('detects yesterday', () => {
    const hints = inferSearchHints('Kairos memories from yesterday', now);
    expect(hints.labels).toContain('Yesterday');
    expect(hints.to).toBeTruthy();
  });

  it('formats related-memory recency', () => {
    expect(relativeMemoryLabel('2026-09-23T12:00:00.000Z', now)).toBe('1 day earlier');
    expect(relativeMemoryLabel('2026-09-10T12:00:00.000Z', now)).toBe('2 weeks earlier');
  });
});
