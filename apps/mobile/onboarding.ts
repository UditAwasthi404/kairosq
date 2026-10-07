import type { AppTheme } from './theme';

export const ONBOARDING_STEPS = [
  {
    id: 'opening',
    statement: 'Your world, remembered.',
    mark: 'Kairos',
    hint: 'Thoughts. Plans. Moments.',
    cta: 'Begin',
  },
  {
    id: 'anchors',
    title: 'What matters?',
    hint: 'Choose a few.',
    horizons: [
      'Thoughts',
      'Ideas',
      'Learning',
      'Goals',
      'Projects',
      'People',
      'Work',
      'Home',
      'Health',
      'Places',
      'Family',
      'Travel',
      'Moments',
      'Questions',
    ],
    cta: 'Continue',
  },
  {
    id: 'first-memory',
    title: "What's on your mind?",
    placeholder: "A thought you don't want to lose.",
    hint: 'Write it once. Find it later.',
    fallback: 'Finish the kitchen before summer.',
    cta: 'Remember',
  },
  {
    id: 'connections',
    title: 'Connected.',
    hint: 'Kept with what you chose.',
    cta: 'Continue',
  },
  {
    id: 'enter',
    statement: 'It remembers.',
    hint: 'Ready when you are.',
    cta: 'Enter Kairos →',
  },
] as const;

export const LIFE_HORIZONS = ONBOARDING_STEPS[1].horizons;
export const FIRST_MEMORY_PLACEHOLDER = ONBOARDING_STEPS[2].placeholder;
export const FIRST_MEMORY_HINT = ONBOARDING_STEPS[2].hint;
export const FIRST_MEMORY_FALLBACK = ONBOARDING_STEPS[2].fallback;
export const DEFAULT_CONNECTIONS = ['Thoughts', 'Goals', 'Projects'] as const;

export type OnboardingSurface = {
  canvas: string;
  text: string;
  muted: string;
  lavender: string;
  lavenderInk: string;
  blob: string;
  line: string;
  cta: string;
  ctaText: string;
  remember: string;
  rememberText: string;
};

export function onboardingSurface(colors: AppTheme, isLight: boolean): OnboardingSurface {
  return {
    canvas: colors.background,
    text: colors.text,
    muted: colors.textMuted,
    lavender: isLight ? colors.accentLavender : colors.accentLilac,
    lavenderInk: isLight ? colors.accentPurple : colors.accentRose,
    blob: isLight ? colors.accentLilac : '#2A2230',
    line: colors.border,
    cta: colors.buttonFill,
    ctaText: colors.buttonText,
    remember: isLight ? colors.accentLavender : colors.accentLilac,
    rememberText: colors.text,
  };
}

export function rememberedText(draft: string): string {
  const trimmed = draft.trim();
  return trimmed.length > 0 ? trimmed : FIRST_MEMORY_FALLBACK;
}

export function memoryFocus(text: string): string {
  const clean = rememberedText(text).replace(/[.?!].*$/, '').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  return words.slice(0, 4).join(' ');
}

export function memoryConnections(draft: string, horizons: string[]): {
  memory: string;
  focus: string;
  related: string[];
  evidence: string;
} {
  const memory = rememberedText(draft);
  const related = (horizons.length > 0 ? horizons : [...DEFAULT_CONNECTIONS]).slice(0, 3);
  return {
    memory,
    focus: memoryFocus(memory),
    related,
    evidence: `1 memory · ${related.length} connections`,
  };
}

export function quietTagsForCapture(draft: string, horizons: string[]): string[] {
  const related = memoryConnections(draft, horizons).related;
  return related;
}

export const FLOATING_HORIZONS = [
  { name: 'Thoughts', x: 0.00, y: 0.46, size: 26 },
  { name: 'Ideas', x: 0.52, y: 0.42, size: 20 },
  { name: 'Learning', x: 0.04, y: 0.58, size: 28 },
  { name: 'Goals', x: 0.50, y: 0.56, size: 22 },
  { name: 'Projects', x: 0.00, y: 0.70, size: 24 },
  { name: 'People', x: 0.54, y: 0.68, size: 20 },
  { name: 'Work', x: 0.10, y: 0.36, size: 22 },
  { name: 'Home', x: 0.58, y: 0.34, size: 20 },
  { name: 'Health', x: 0.02, y: 0.82, size: 22 },
  { name: 'Places', x: 0.50, y: 0.80, size: 20 },
  { name: 'Family', x: 0.24, y: 0.50, size: 22 },
  { name: 'Travel', x: 0.28, y: 0.74, size: 20 },
  { name: 'Moments', x: 0.28, y: 0.38, size: 20 },
  { name: 'Questions', x: 0.22, y: 0.64, size: 20 },
] as const;
