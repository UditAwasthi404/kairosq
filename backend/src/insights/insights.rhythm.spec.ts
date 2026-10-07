import {
  buildDashboardRhythm,
  currentStreak,
  countsByDay,
  dayKey,
  longestStreak,
  startOfLocalDay,
} from './insights.rhythm';

function atDay(offset: number, hour = 10): Date {
  const date = startOfLocalDay();
  date.setDate(date.getDate() + offset);
  date.setHours(hour, 0, 0, 0);
  return date;
}

describe('insights rhythm', () => {
  it('keeps a streak alive when today is still empty', () => {
    const counts = countsByDay([atDay(-2), atDay(-1)]);
    expect(currentStreak(counts, startOfLocalDay())).toBe(2);
  });

  it('counts today and consecutive previous days', () => {
    const counts = countsByDay([atDay(-2), atDay(-1), atDay(0)]);
    expect(currentStreak(counts, startOfLocalDay())).toBe(3);
  });

  it('breaks the streak after a missed day', () => {
    const counts = countsByDay([atDay(-3), atDay(0)]);
    expect(currentStreak(counts, startOfLocalDay())).toBe(1);
  });

  it('finds the longest run in a window', () => {
    const counts = countsByDay([
      atDay(-10),
      atDay(-9),
      atDay(-8),
      atDay(-2),
      atDay(-1),
    ]);
    expect(
      longestStreak(counts, atDay(-14), startOfLocalDay()),
    ).toBe(3);
  });

  it('builds activity, streak, and habit from capture dates', () => {
    const now = startOfLocalDay();
    const rhythm = buildDashboardRhythm({
      capturedAt: [atDay(-2), atDay(-1), atDay(-1, 18), atDay(0)],
      now,
      todayCount: 1,
    });

    expect(rhythm.activity).toHaveLength(14);
    expect(rhythm.heatmap).toHaveLength(84);
    expect(rhythm.heatmap.find((day) => day.date === dayKey(now))?.count).toBe(1);
    expect(rhythm.heatmap.filter((day) => day.future)).toHaveLength(6 - now.getDay());
    expect(rhythm.activity[13]?.date).toBe(dayKey(now));
    expect(rhythm.activity[13]?.count).toBe(1);
    expect(rhythm.activity[12]?.count).toBe(2);
    expect(rhythm.streak.current).toBe(3);
    expect(rhythm.streak.longest).toBe(3);
    expect(rhythm.streak.capturedToday).toBe(true);
    expect(rhythm.habit.week).toHaveLength(7);
    expect(rhythm.habit.weekDaysCompleted).toBe(3);
    expect(rhythm.habit.todayProgress).toBe(1);
  });
});
