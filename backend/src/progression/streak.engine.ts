export type StreakState = {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  freezeTokens: number;
};

export type StreakAdvance = {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string;
  freezeTokens: number;
  freezeUsed: number;
  broke: boolean;
  firstOfDay: boolean;
};

function parseDay(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

export function dayGap(from: string, to: string): number {
  const start = parseDay(from).getTime();
  const end = parseDay(to).getTime();
  return Math.round((end - start) / 86_400_000);
}

/**
 * Apply one active day. A freeze covers each missed day between last activity and today.
 * If freezes cannot cover the gap, the streak is terminal and restarts at 1.
 */
export function advanceStreak(state: StreakState, today: string): StreakAdvance {
  if (state.lastActiveDate === today) {
    return {
      currentStreak: state.currentStreak,
      longestStreak: state.longestStreak,
      lastActiveDate: today,
      freezeTokens: state.freezeTokens,
      freezeUsed: 0,
      broke: false,
      firstOfDay: false,
    };
  }

  if (!state.lastActiveDate) {
    return {
      currentStreak: 1,
      longestStreak: Math.max(state.longestStreak, 1),
      lastActiveDate: today,
      freezeTokens: state.freezeTokens,
      freezeUsed: 0,
      broke: false,
      firstOfDay: true,
    };
  }

  const gap = dayGap(state.lastActiveDate, today);
  if (gap <= 0) {
    return {
      currentStreak: state.currentStreak,
      longestStreak: state.longestStreak,
      lastActiveDate: today,
      freezeTokens: state.freezeTokens,
      freezeUsed: 0,
      broke: false,
      firstOfDay: false,
    };
  }

  const missed = gap - 1;
  if (missed === 0) {
    const currentStreak = state.currentStreak + 1;
    return {
      currentStreak,
      longestStreak: Math.max(state.longestStreak, currentStreak),
      lastActiveDate: today,
      freezeTokens: state.freezeTokens,
      freezeUsed: 0,
      broke: false,
      firstOfDay: true,
    };
  }

  if (state.freezeTokens >= missed) {
    const currentStreak = state.currentStreak + 1;
    return {
      currentStreak,
      longestStreak: Math.max(state.longestStreak, currentStreak),
      lastActiveDate: today,
      freezeTokens: state.freezeTokens - missed,
      freezeUsed: missed,
      broke: false,
      firstOfDay: true,
    };
  }

  return {
    currentStreak: 1,
    longestStreak: state.longestStreak,
    lastActiveDate: today,
    freezeTokens: state.freezeTokens,
    freezeUsed: 0,
    broke: true,
    firstOfDay: true,
  };
}
