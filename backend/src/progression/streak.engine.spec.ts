import { advanceStreak, dayGap } from './streak.engine';

describe('advanceStreak', () => {
  it('starts a streak on the first active day', () => {
    const next = advanceStreak(
      { currentStreak: 0, longestStreak: 0, lastActiveDate: null, freezeTokens: 0 },
      '2026-09-27',
    );
    expect(next.currentStreak).toBe(1);
    expect(next.firstOfDay).toBe(true);
    expect(next.broke).toBe(false);
  });

  it('is idempotent on the same day', () => {
    const next = advanceStreak(
      { currentStreak: 4, longestStreak: 4, lastActiveDate: '2026-09-27', freezeTokens: 1 },
      '2026-09-27',
    );
    expect(next.currentStreak).toBe(4);
    expect(next.firstOfDay).toBe(false);
    expect(next.freezeUsed).toBe(0);
  });

  it('increments after a consecutive day', () => {
    const next = advanceStreak(
      { currentStreak: 4, longestStreak: 4, lastActiveDate: '2026-09-26', freezeTokens: 0 },
      '2026-09-27',
    );
    expect(next.currentStreak).toBe(5);
    expect(next.longestStreak).toBe(5);
  });

  it('uses a freeze to cover one missed day instead of breaking', () => {
    const next = advanceStreak(
      { currentStreak: 10, longestStreak: 10, lastActiveDate: '2026-09-25', freezeTokens: 1 },
      '2026-09-27',
    );
    expect(next.broke).toBe(false);
    expect(next.currentStreak).toBe(11);
    expect(next.freezeTokens).toBe(0);
    expect(next.freezeUsed).toBe(1);
  });

  it('breaks when the gap cannot be covered', () => {
    const next = advanceStreak(
      { currentStreak: 10, longestStreak: 12, lastActiveDate: '2026-09-24', freezeTokens: 0 },
      '2026-09-27',
    );
    expect(next.broke).toBe(true);
    expect(next.currentStreak).toBe(1);
    expect(next.longestStreak).toBe(12);
  });

  it('measures calendar gaps', () => {
    expect(dayGap('2026-09-25', '2026-09-27')).toBe(2);
  });
});
