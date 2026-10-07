import {
  REFLECTIONS,
  dailyReflection,
  dayPart,
  greetingFor,
  isMilestone,
  levelTitle,
  nextMilestone,
  paceState,
  saveMessage,
  streakNudge,
} from '../lib/engagement';

describe('engagement copy', () => {
  it('maps hours to day parts', () => {
    expect(dayPart(new Date(2026, 8, 30, 3))).toBe('night');
    expect(dayPart(new Date(2026, 8, 30, 6))).toBe('dawn');
    expect(dayPart(new Date(2026, 8, 30, 10))).toBe('morning');
    expect(dayPart(new Date(2026, 8, 30, 14))).toBe('afternoon');
    expect(dayPart(new Date(2026, 8, 30, 19))).toBe('evening');
    expect(dayPart(new Date(2026, 8, 30, 23))).toBe('night');
  });

  it('keeps the greeting and reflection stable within a day', () => {
    const morning = new Date(2026, 8, 30, 9);
    const later = new Date(2026, 8, 30, 11, 59);
    expect(greetingFor(morning)).toBe(greetingFor(later));
    expect(dailyReflection(morning)).toBe(dailyReflection(new Date(2026, 8, 30, 22)));
  });

  it('rotates reflections across consecutive days', () => {
    const seen = new Set<string>();
    for (let day = 1; day <= REFLECTIONS.length; day += 1) {
      seen.add(dailyReflection(new Date(2026, 0, day)).prompt);
    }
    expect(seen.size).toBe(REFLECTIONS.length);
  });

  it('phrases every reflection as a question, never as a finding', () => {
    for (const reflection of REFLECTIONS) {
      expect(reflection.prompt.endsWith('?')).toBe(true);
      expect(reflection.lead.toLowerCase()).not.toMatch(/kairos (found|noticed|detected)|your data/);
    }
  });

  it('frames pace with a goal gradient', () => {
    expect(paceState(0, 5)).toMatchObject({ remaining: 5, reached: false, message: 'One capture starts the ring.' });
    expect(paceState(1, 5).message).toBe('4 more to close today’s ring.');
    expect(paceState(3, 5).message).toBe('Past halfway. 2 to go.');
    expect(paceState(4, 5).message).toBe('One more closes today’s ring.');
    expect(paceState(5, 5)).toMatchObject({ reached: true, ratio: 1, message: 'Ring closed for today.' });
    expect(paceState(7, 5).message).toBe('Ring closed, plus 2 more.');
    expect(paceState(2, 0).ratio).toBe(1);
  });

  it('frames streaks without shaming a reset', () => {
    expect(streakNudge(0, false).tone).toBe('start');
    expect(streakNudge(4, false)).toMatchObject({ tone: 'keep', title: 'Keep your 4-day streak' });
    expect(streakNudge(7, true).tone).toBe('milestone');
    expect(streakNudge(5, true)).toMatchObject({ tone: 'safe', detail: '2 days to your 7-day mark.' });
    expect(streakNudge(6, true).detail).toBe('1 day to your 7-day mark.');
  });

  it('finds milestones and level titles', () => {
    expect(isMilestone(7)).toBe(true);
    expect(isMilestone(8)).toBe(false);
    expect(nextMilestone(0)).toBe(3);
    expect(nextMilestone(30)).toBe(50);
    expect(nextMilestone(400)).toBe(500);
    expect(levelTitle(1)).toBe('Newcomer');
    expect(levelTitle(0)).toBe('Newcomer');
    expect(levelTitle(99)).toBe('Sage');
  });

  it('varies save confirmations', () => {
    expect(saveMessage(0)).not.toBe(saveMessage(1));
  });
});
