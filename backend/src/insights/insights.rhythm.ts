export const HISTORY_DAYS = 180;
export const ACTIVITY_DAYS = 14;
export const HEATMAP_WEEKS = 12;
export const HABIT_WEEK_DAYS = 7;
export const HABIT_WEEK_GOAL = 5;
export const DAILY_CAPTURE_GOAL = 1;

export type ActivityDay = {
  date: string;
  label: string;
  count: number;
};

export type HeatmapDay = ActivityDay & {
  future: boolean;
};

export type HabitWeekDay = {
  date: string;
  label: string;
  done: boolean;
  count: number;
};

export type CaptureStreak = {
  current: number;
  longest: number;
  capturedToday: boolean;
};

export type CaptureHabit = {
  dailyGoal: number;
  todayProgress: number;
  weekGoalDays: number;
  weekDaysCompleted: number;
  week: HabitWeekDay[];
};

export type DashboardRhythm = {
  activity: ActivityDay[];
  heatmap: HeatmapDay[];
  streak: CaptureStreak;
  habit: CaptureHabit;
};

export function startOfLocalDay(date = new Date()): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function dayKey(date: Date): string {
  const local = startOfLocalDay(date);
  const year = local.getFullYear();
  const month = String(local.getMonth() + 1).padStart(2, '0');
  const day = String(local.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function countsByDay(dates: Date[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const date of dates) {
    const key = dayKey(date);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

export function currentStreak(counts: Map<string, number>, today: Date): number {
  let cursor = startOfLocalDay(today);
  if ((counts.get(dayKey(cursor)) ?? 0) === 0) {
    cursor = addDays(cursor, -1);
  }
  let streak = 0;
  while ((counts.get(dayKey(cursor)) ?? 0) > 0) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function longestStreak(
  counts: Map<string, number>,
  from: Date,
  to: Date,
): number {
  let best = 0;
  let run = 0;
  const end = startOfLocalDay(to);
  for (
    let cursor = startOfLocalDay(from);
    cursor.getTime() <= end.getTime();
    cursor = addDays(cursor, 1)
  ) {
    if ((counts.get(dayKey(cursor)) ?? 0) > 0) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  return best;
}

export function seriesForDays(
  counts: Map<string, number>,
  end: Date,
  length: number,
): ActivityDay[] {
  const start = addDays(startOfLocalDay(end), -(length - 1));
  const days: ActivityDay[] = [];
  for (let index = 0; index < length; index += 1) {
    const date = addDays(start, index);
    const key = dayKey(date);
    days.push({
      date: key,
      label: date.toLocaleDateString('en-US', { weekday: 'narrow' }),
      count: counts.get(key) ?? 0,
    });
  }
  return days;
}

/** Twelve full weeks, Sunday through Saturday, ending with the current week. */
export function heatmapSeries(
  counts: Map<string, number>,
  end: Date,
  weeks = HEATMAP_WEEKS,
): HeatmapDay[] {
  const today = startOfLocalDay(end);
  const weekStart = addDays(today, -today.getDay());
  const start = addDays(weekStart, -(weeks - 1) * 7);
  const days: HeatmapDay[] = [];
  for (let index = 0; index < weeks * 7; index += 1) {
    const date = addDays(start, index);
    const key = dayKey(date);
    const future = date.getTime() > today.getTime();
    days.push({
      date: key,
      label: date.toLocaleDateString('en-US', { weekday: 'narrow' }),
      count: future ? 0 : (counts.get(key) ?? 0),
      future,
    });
  }
  return days;
}

export function buildDashboardRhythm(params: {
  capturedAt: Date[];
  now?: Date;
  todayCount?: number;
}): DashboardRhythm {
  const now = params.now ?? new Date();
  const today = startOfLocalDay(now);
  const historyStart = addDays(today, -(HISTORY_DAYS - 1));
  const counts = countsByDay(params.capturedAt);
  const activity = seriesForDays(counts, today, ACTIVITY_DAYS);
  const heatmap = heatmapSeries(counts, today);
  const week = seriesForDays(counts, today, HABIT_WEEK_DAYS).map((day) => ({
    date: day.date,
    label: day.label,
    count: day.count,
    done: day.count >= DAILY_CAPTURE_GOAL,
  }));
  const todayKey = dayKey(today);
  const todayProgress = params.todayCount ?? counts.get(todayKey) ?? 0;

  return {
    activity,
    heatmap,
    streak: {
      current: currentStreak(counts, today),
      longest: longestStreak(counts, historyStart, today),
      capturedToday: todayProgress > 0,
    },
    habit: {
      dailyGoal: DAILY_CAPTURE_GOAL,
      todayProgress,
      weekGoalDays: HABIT_WEEK_GOAL,
      weekDaysCompleted: week.filter((day) => day.done).length,
      week,
    },
  };
}
