import { interpolateColor } from 'react-native-reanimated';

import { darkTheme, lightTheme, ThemeColorKey } from './theme';

/** 0 = dark, 1 = light */
export type ThemeProgress = number;

/** Keep short — only root/onboarding animate; app chrome uses static colors. */
export const THEME_TRANSITION_DURATION_MS = 420;

/** Recommended easing curve for theme transitions: quick response, soft settle. */
export const THEME_TRANSITION_EASING = {
  x1: 0.22,
  y1: 1,
  x2: 0.36,
  y2: 1,
} as const;

const pairs: Record<ThemeColorKey, [string, string]> = {
  background: [darkTheme.background, lightTheme.background],
  surface: [darkTheme.surface, lightTheme.surface],
  surfaceElevated: [darkTheme.surfaceElevated, lightTheme.surfaceElevated],
  surfaceGlass: [darkTheme.surfaceGlass, lightTheme.surfaceGlass],
  surfaceContainerLowest: [darkTheme.surfaceContainerLowest, lightTheme.surfaceContainerLowest],
  surfaceContainerLow: [darkTheme.surfaceContainerLow, lightTheme.surfaceContainerLow],
  surfaceContainer: [darkTheme.surfaceContainer, lightTheme.surfaceContainer],
  surfaceContainerHigh: [darkTheme.surfaceContainerHigh, lightTheme.surfaceContainerHigh],
  glassFill: [darkTheme.glassFill, lightTheme.glassFill],
  glassBorder: [darkTheme.glassBorder, lightTheme.glassBorder],
  glassHighlight: [darkTheme.glassHighlight, lightTheme.glassHighlight],
  text: [darkTheme.text, lightTheme.text],
  textSecondary: [darkTheme.textSecondary, lightTheme.textSecondary],
  textMuted: [darkTheme.textMuted, lightTheme.textMuted],
  textDisabled: [darkTheme.textDisabled, lightTheme.textDisabled],
  primary: [darkTheme.primary, lightTheme.primary],
  primaryPressed: [darkTheme.primaryPressed, lightTheme.primaryPressed],
  primarySoft: [darkTheme.primarySoft, lightTheme.primarySoft],
  primaryContainer: [darkTheme.primaryContainer, lightTheme.primaryContainer],
  onPrimary: [darkTheme.onPrimary, lightTheme.onPrimary],
  onPrimaryContainer: [darkTheme.onPrimaryContainer, lightTheme.onPrimaryContainer],
  secondary: [darkTheme.secondary, lightTheme.secondary],
  secondaryContainer: [darkTheme.secondaryContainer, lightTheme.secondaryContainer],
  onSecondary: [darkTheme.onSecondary, lightTheme.onSecondary],
  onSecondaryContainer: [darkTheme.onSecondaryContainer, lightTheme.onSecondaryContainer],
  tertiary: [darkTheme.tertiary, lightTheme.tertiary],
  tertiaryContainer: [darkTheme.tertiaryContainer, lightTheme.tertiaryContainer],
  onTertiaryContainer: [darkTheme.onTertiaryContainer, lightTheme.onTertiaryContainer],
  accent: [darkTheme.accent, lightTheme.accent],
  accentGlow: [darkTheme.accentGlow, lightTheme.accentGlow],
  accentRose: [darkTheme.accentRose, lightTheme.accentRose],
  accentLavender: [darkTheme.accentLavender, lightTheme.accentLavender],
  accentPeach: [darkTheme.accentPeach, lightTheme.accentPeach],
  accentMorningBlue: [darkTheme.accentMorningBlue, lightTheme.accentMorningBlue],
  accentLilac: [darkTheme.accentLilac, lightTheme.accentLilac],
  accentTeal: [darkTheme.accentTeal, lightTheme.accentTeal],
  accentGreen: [darkTheme.accentGreen, lightTheme.accentGreen],
  accentPurple: [darkTheme.accentPurple, lightTheme.accentPurple],
  accentOrange: [darkTheme.accentOrange, lightTheme.accentOrange],
  accentYellow: [darkTheme.accentYellow, lightTheme.accentYellow],
  accentCoral: [darkTheme.accentCoral, lightTheme.accentCoral],
  accentCream: [darkTheme.accentCream, lightTheme.accentCream],
  tintFrost: [darkTheme.tintFrost, lightTheme.tintFrost],
  tintTeal: [darkTheme.tintTeal, lightTheme.tintTeal],
  tintGreen: [darkTheme.tintGreen, lightTheme.tintGreen],
  tintPurple: [darkTheme.tintPurple, lightTheme.tintPurple],
  tintOrange: [darkTheme.tintOrange, lightTheme.tintOrange],
  tintYellow: [darkTheme.tintYellow, lightTheme.tintYellow],
  tintCoral: [darkTheme.tintCoral, lightTheme.tintCoral],
  border: [darkTheme.border, lightTheme.border],
  borderSubtle: [darkTheme.borderSubtle, lightTheme.borderSubtle],
  borderActive: [darkTheme.borderActive, lightTheme.borderActive],
  borderAccent: [darkTheme.borderAccent, lightTheme.borderAccent],
  buttonFill: [darkTheme.buttonFill, lightTheme.buttonFill],
  buttonText: [darkTheme.buttonText, lightTheme.buttonText],
  buttonPressedFill: [darkTheme.buttonPressedFill, lightTheme.buttonPressedFill],
  buttonPressedText: [darkTheme.buttonPressedText, lightTheme.buttonPressedText],
  buttonDisabledFill: [darkTheme.buttonDisabledFill, lightTheme.buttonDisabledFill],
  buttonDisabledText: [darkTheme.buttonDisabledText, lightTheme.buttonDisabledText],
  buttonBottom: [darkTheme.buttonBottom, lightTheme.buttonBottom],
  buttonSecondaryFill: [darkTheme.buttonSecondaryFill, lightTheme.buttonSecondaryFill],
  buttonSecondaryText: [darkTheme.buttonSecondaryText, lightTheme.buttonSecondaryText],
  buttonSecondaryBottom: [darkTheme.buttonSecondaryBottom, lightTheme.buttonSecondaryBottom],
  inputFill: [darkTheme.inputFill, lightTheme.inputFill],
  inputBorder: [darkTheme.inputBorder, lightTheme.inputBorder],
  inputBorderFocused: [darkTheme.inputBorderFocused, lightTheme.inputBorderFocused],
  inputPlaceholder: [darkTheme.inputPlaceholder, lightTheme.inputPlaceholder],
  dot: [darkTheme.dot, lightTheme.dot],
  dotInactive: [darkTheme.dotInactive, lightTheme.dotInactive],
  divider: [darkTheme.divider, lightTheme.divider],
  overlay: [darkTheme.overlay, lightTheme.overlay],
  success: [darkTheme.success, lightTheme.success],
  warning: [darkTheme.warning, lightTheme.warning],
  error: [darkTheme.error, lightTheme.error],
  errorSurface: [darkTheme.errorSurface, lightTheme.errorSurface],
  successSurface: [darkTheme.successSurface, lightTheme.successSurface],
  scrim: [darkTheme.scrim, lightTheme.scrim],
  inverseText: [darkTheme.inverseText, lightTheme.inverseText],
};

/**
 * Theme interpolation is intentionally centralized so every surface, border,
 * and text token transitions through the same visual state.
 *
 * For the smoothest UX, drive `progress` with a Reanimated timing animation
 * using THEME_TRANSITION_DURATION_MS and THEME_TRANSITION_EASING.
 */
export const THEME_TRANSITION_DISTANCE = [0, 1] as const;

/** For onboarding / toggle transitions only — do not use on list rows. */
export function themeColor(progress: ThemeProgress, key: ThemeColorKey): string {
  'worklet';
  const [dark, light] = pairs[key];
  return interpolateColor(progress, [0, 1], [dark, light]);
}
