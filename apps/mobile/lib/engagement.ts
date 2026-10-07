/**
 * Copy that keeps Today, Capture, and Profile feeling alive between visits.
 *
 * Reflections are open prompts, never claims about the user's data. Anything that
 * reads as an observation ("You tend to…") must stay phrased as an invitation to
 * reflect so it is never mistaken for an insight Kairos derived from memories.
 */

export type DayPart = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night';

export function dayPart(date: Date = new Date()): DayPart {
  const hour = date.getHours();
  if (hour < 5) return 'night';
  if (hour < 8) return 'dawn';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

const GREETINGS: Record<DayPart, readonly string[]> = {
  dawn: ['Early start', 'Quiet hours', 'Good morning'],
  morning: ['Good morning', 'Fresh page', 'Morning'],
  afternoon: ['Good afternoon', 'Midday check-in', 'Afternoon'],
  evening: ['Good evening', 'Winding down', 'Evening'],
  night: ['Late thoughts', 'Still up', 'Good night'],
};

/** Stable for the whole day so the greeting never flickers between renders. */
export function greetingFor(date: Date = new Date()): string {
  const options = GREETINGS[dayPart(date)];
  return options[dayIndex(date) % options.length];
}

export type Reflection = {
  lead: string;
  prompt: string;
};

export const REFLECTIONS: readonly Reflection[] = [
  { lead: 'Some people notice more than they say.', prompt: 'What did you notice today that nobody else did?' },
  { lead: 'Small moments often matter more than big ones.', prompt: 'Which small moment from today do you want to keep?' },
  { lead: 'Ideas tend to show up at odd times.', prompt: 'What idea surprised you recently?' },
  { lead: 'Many of us carry a question for weeks.', prompt: 'What question keeps coming back to you?' },
  { lead: 'Progress is easy to miss up close.', prompt: 'What moved forward for you this week, even a little?' },
  { lead: 'People you talk to leave traces.', prompt: 'Who said something worth remembering lately?' },
  { lead: 'Some days are for starting, some for finishing.', prompt: 'What are you in the middle of right now?' },
  { lead: 'Future you will want the details.', prompt: 'What would you want to remember about today in a year?' },
  { lead: 'A plan feels lighter once it is written down.', prompt: 'What is one thing you intend to do tomorrow?' },
  { lead: 'Energy has a rhythm.', prompt: 'When did you feel most like yourself today?' },
  { lead: 'Lessons fade faster than we expect.', prompt: 'What did today teach you?' },
  { lead: 'Gratitude is a form of memory.', prompt: 'What are you glad happened today?' },
  { lead: 'Unfinished thoughts still count.', prompt: 'What half-formed thought is worth saving?' },
  { lead: 'Places hold memories too.', prompt: 'Where were you when something clicked today?' },
];

/** One reflection per calendar day, the same on every screen that asks. */
export function dailyReflection(date: Date = new Date()): Reflection {
  return REFLECTIONS[dayIndex(date) % REFLECTIONS.length];
}

export type PaceState = {
  remaining: number;
  ratio: number;
  reached: boolean;
  message: string;
};

/** Goal-gradient copy: effort feels smaller the closer the finish line looks. */
export function paceState(progress: number, goal: number): PaceState {
  const safeGoal = Math.max(1, goal);
  const clamped = Math.max(0, progress);
  const ratio = Math.min(1, clamped / safeGoal);
  const remaining = Math.max(0, safeGoal - clamped);

  if (remaining === 0) {
    const extra = clamped - safeGoal;
    return {
      remaining,
      ratio,
      reached: true,
      message: extra > 0 ? `Ring closed, plus ${extra} more.` : 'Ring closed for today.',
    };
  }
  if (clamped === 0) {
    return { remaining, ratio, reached: false, message: 'One capture starts the ring.' };
  }
  if (remaining === 1) {
    return { remaining, ratio, reached: false, message: 'One more closes today’s ring.' };
  }
  if (ratio >= 0.5) {
    return { remaining, ratio, reached: false, message: `Past halfway. ${remaining} to go.` };
  }
  return { remaining, ratio, reached: false, message: `${remaining} more to close today’s ring.` };
}

export type StreakNudge = {
  tone: 'start' | 'keep' | 'safe' | 'milestone';
  title: string;
  detail: string;
};

const MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365] as const;

export function nextMilestone(streak: number): number {
  return MILESTONES.find((m) => m > streak) ?? streak + 100;
}

export function isMilestone(streak: number): boolean {
  return (MILESTONES as readonly number[]).includes(streak);
}

/** Honest streak framing: protect what exists, celebrate milestones, never shame a reset. */
export function streakNudge(streak: number, capturedToday: boolean): StreakNudge {
  if (streak <= 0) {
    return {
      tone: 'start',
      title: 'Start a streak today',
      detail: 'One capture is all it takes.',
    };
  }
  if (capturedToday && isMilestone(streak)) {
    return {
      tone: 'milestone',
      title: `${streak} days in a row`,
      detail: 'A real habit is forming.',
    };
  }
  if (capturedToday) {
    const next = nextMilestone(streak);
    return {
      tone: 'safe',
      title: 'Streak safe for today',
      detail: `${next - streak} ${next - streak === 1 ? 'day' : 'days'} to your ${next}-day mark.`,
    };
  }
  return {
    tone: 'keep',
    title: `Keep your ${streak}-day streak`,
    detail: 'Capture anything before midnight.',
  };
}

const SAVE_MESSAGES = [
  'Saved. Kairos is connecting it to what you know.',
  'Kept. This one is safe now.',
  'Remembered. It will surface when it matters.',
  'Saved. Your memory just got a little richer.',
  'Got it. Kairos is finding where this fits.',
] as const;

/** Varied confirmations keep the save moment from going numb. */
export function saveMessage(seed: number = Date.now()): string {
  return SAVE_MESSAGES[Math.abs(Math.floor(seed)) % SAVE_MESSAGES.length];
}

const LOADING_LINES = [
  'Connecting the dots…',
  'Gathering your memories…',
  'Finding the threads…',
  'Almost there…',
] as const;

export function loadingLine(step: number): string {
  return LOADING_LINES[Math.abs(step) % LOADING_LINES.length];
}

export const LEVEL_TITLES = [
  'Newcomer',
  'Noticer',
  'Collector',
  'Explorer',
  'Keeper',
  'Archivist',
  'Cartographer',
  'Sage',
] as const;

export function levelTitle(level: number): string {
  const index = Math.max(0, Math.min(LEVEL_TITLES.length - 1, level - 1));
  return LEVEL_TITLES[index];
}

function dayIndex(date: Date): number {
  const start = Date.UTC(date.getFullYear(), 0, 0);
  const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((today - start) / 86_400_000) + date.getFullYear() * 7;
}
