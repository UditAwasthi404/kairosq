import {
  FIRST_MEMORY_FALLBACK,
  FIRST_MEMORY_HINT,
  FIRST_MEMORY_PLACEHOLDER,
  LIFE_HORIZONS,
  ONBOARDING_STEPS,
  memoryConnections,
  memoryFocus,
  quietTagsForCapture,
  rememberedText,
} from '../onboarding';

describe('Kairos onboarding copy', () => {
  it('keeps the five specified screens and their copy', () => {
    expect(ONBOARDING_STEPS.map((step) => step.id)).toEqual([
      'opening',
      'anchors',
      'first-memory',
      'connections',
      'enter',
    ]);
    expect(ONBOARDING_STEPS[0].statement).toBe('Your world, remembered.');
    expect(ONBOARDING_STEPS[0].hint).toBe('Thoughts. Plans. Moments.');
    expect(ONBOARDING_STEPS[1].title).toBe('What matters?');
    expect(ONBOARDING_STEPS[1].hint).toBe('Choose a few.');
    expect(LIFE_HORIZONS).toEqual([
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
    ]);
    expect(ONBOARDING_STEPS[2].title).toBe("What's on your mind?");
    expect(FIRST_MEMORY_PLACEHOLDER).toBe("A thought you don't want to lose.");
    expect(FIRST_MEMORY_HINT).toBe('Write it once. Find it later.');
    expect(FIRST_MEMORY_FALLBACK).toBe('Finish the kitchen before summer.');
    expect(ONBOARDING_STEPS[3].title).toBe('Connected.');
    expect(ONBOARDING_STEPS[3].hint).toBe('Kept with what you chose.');
    expect(ONBOARDING_STEPS[4].statement).toBe('It remembers.');
    expect(ONBOARDING_STEPS[4].hint).toBe('Ready when you are.');
  });

  it('uses the written thought and chosen horizons as the connection', () => {
    expect(rememberedText('')).toBe(FIRST_MEMORY_FALLBACK);
    expect(rememberedText('  Call mom this weekend.  ')).toBe('Call mom this weekend.');
    expect(memoryFocus('Finish the kitchen before summer.')).toBe('Finish the kitchen before');
    expect(memoryConnections('Call mom this weekend.', ['People', 'Goals'])).toEqual({
      memory: 'Call mom this weekend.',
      focus: 'Call mom this weekend',
      related: ['People', 'Goals'],
      evidence: '1 memory · 2 connections',
    });
    expect(quietTagsForCapture('', [])).toEqual(['Thoughts', 'Goals', 'Projects']);
    expect(quietTagsForCapture('anything', ['Learning', 'Projects'])).toEqual([
      'Learning',
      'Projects',
    ]);
  });
});
