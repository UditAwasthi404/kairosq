import { ColorSchemeName, ImageSourcePropType } from 'react-native';

/**
 * Nothing OS theme.
 * Soft black (#121212), warm gray type, and a quieter red. Roboto for display and body.
 * `lavender` remains as the legacy scale name; its values are Nothing Red.
 */

export const nothingRed = {
  50: '#FFF1F2',
  100: '#FFD5D8',
  200: '#FF9AA0',
  300: '#F25C64',
  400: '#E0232C',
  500: '#D71921',
  600: '#B01219',
  700: '#8A0E14',
  800: '#5C0A0E',
  900: '#3A0A0A',
  950: '#1A0506',
} as const;

export const lavender = nothingRed;

export const plum = lavender;

export const mist = {
  50: '#F5F5F5',
  100: '#E8E8E8',
  200: '#CCCCCC',
  300: '#999999',
  400: '#666666',
  500: '#555555',
  600: '#333333',
  700: '#242424',
  800: '#1A1A1A',
  900: '#111111',
  950: '#000000',
} as const;

/** Retained for backwards compatibility */
export const ink = mist;
export const signal = lavender;

export const nord = {
  polarNight: {
    0: '#000000',
    1: '#111111',
    2: '#1A1A1A',
    3: '#242424',
  },
  snowStorm: {
    0: '#999999',
    1: '#E8E8E8',
    2: '#FFFFFF',
  },
  frost: {
    0: '#D71921',
    1: '#B01219',
    2: '#FFFFFF',
    3: '#3A0A0A',
  },
  aurora: {
    red: '#D71921',
    orange: '#D4A843',
    yellow: '#D4A843',
    green: '#4A9E5C',
    purple: '#D71921',
  },
} as const;

export type FontWeight = '400' | '500' | '600' | '700';

export type TypographyScale = {
  hero: { size: number; lineHeight: number; weight: FontWeight; letterSpacing: number; fontFamily: string };
  display: { size: number; lineHeight: number; weight: FontWeight; letterSpacing: number; fontFamily: string };
  title1: { size: number; lineHeight: number; weight: FontWeight; letterSpacing: number; fontFamily: string };
  title2: { size: number; lineHeight: number; weight: FontWeight; letterSpacing: number; fontFamily: string };
  title3: { size: number; lineHeight: number; weight: FontWeight; letterSpacing: number; fontFamily: string };
  body: { size: number; lineHeight: number; weight: FontWeight; letterSpacing: number; fontFamily: string };
  bodySmall: { size: number; lineHeight: number; weight: FontWeight; letterSpacing: number; fontFamily: string };
  caption: { size: number; lineHeight: number; weight: FontWeight; letterSpacing: number; fontFamily: string };
  overline: { size: number; lineHeight: number; weight: FontWeight; letterSpacing: number; fontFamily: string };
  button: { size: number; lineHeight: number; weight: FontWeight; letterSpacing: number; fontFamily: string };
  stat: { size: number; lineHeight: number; weight: FontWeight; letterSpacing: number; fontFamily: string };
};

const regular = 'Roboto_400Regular';
const medium = 'Roboto_500Medium';

export const typography: TypographyScale = {
  hero: { size: 40, lineHeight: 48, weight: '400', letterSpacing: 0, fontFamily: regular },
  display: { size: 34, lineHeight: 42, weight: '400', letterSpacing: 0, fontFamily: regular },
  title1: { size: 26, lineHeight: 34, weight: '400', letterSpacing: 0, fontFamily: regular },
  title2: { size: 22, lineHeight: 30, weight: '400', letterSpacing: 0, fontFamily: regular },
  title3: { size: 18, lineHeight: 26, weight: '400', letterSpacing: 0, fontFamily: regular },
  body: { size: 17, lineHeight: 26, weight: '400', letterSpacing: 0, fontFamily: regular },
  bodySmall: { size: 15, lineHeight: 22, weight: '400', letterSpacing: 0, fontFamily: regular },
  caption: { size: 14, lineHeight: 20, weight: '500', letterSpacing: 0, fontFamily: medium },
  overline: { size: 12, lineHeight: 16, weight: '500', letterSpacing: 0.4, fontFamily: medium },
  button: { size: 16, lineHeight: 22, weight: '500', letterSpacing: 0, fontFamily: medium },
  stat: { size: 40, lineHeight: 48, weight: '400', letterSpacing: 0, fontFamily: regular },
};

export const spacing = {
  '0': 0,
  '0.5': 2,
  '1': 4,
  '2': 8,
  '3': 12,
  '4': 16,
  '5': 20,
  '6': 24,
  '8': 32,
  '10': 40,
  '12': 48,
  '16': 64,
  '20': 80,
  '24': 96,
} as const;

export type SpacingToken = keyof typeof spacing;

/** Ease-out motion. No spring overshoot. Durations in ms. */
export const motion = {
  instant: 80,
  fast: 140,
  normal: 280,
  smooth: 320,
  expressive: 340,
  page: 300,
  stagger: 50,
  pressScale: 0.97,
  subtleScale: 0.98,
} as const;

export type MotionToken = keyof typeof motion;

/** Soft corners. Pills stay fully round. */
export const radius = {
  none: 0,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  '2xl': 36,
  full: 999,
} as const;

/** Touch targets meet 44. Icon buttons sit at 40 inside that hit area. */
export const control = {
  touch: 44,
  icon: 40,
  circular: 44,
  buttonSm: 48,
  buttonMd: 54,
  buttonLg: 60,
  dock: 64,
  insight: 64,
} as const;

export const mascotSize = {
  sm: 28,
  md: 48,
  lg: 72,
} as const;

export type ShadowToken = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
};

/** Depth comes from surface shade. Shadows stay short and neutral. */
export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 2,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 28,
    elevation: 4,
  },
  xl: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 32,
    elevation: 5,
  },
  glow: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
} as const;

export type ThemeGradients = {
  background: readonly [string, string, string];
  surface: readonly [string, string];
  accent: readonly [string, string];
  accentSoft: readonly [string, string];
  glass: readonly [string, string];
  composer: readonly [string, string];
  vitality: readonly [string, string];
};

export type AppTheme = {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceGlass: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;

  /** Glass & panel tokens */
  glassFill: string;
  glassBorder: string;
  glassHighlight: string;
  glassIntensity: number;

  text: string;
  textSecondary: string;
  textMuted: string;
  textDisabled: string;

  primary: string;
  primaryPressed: string;
  primarySoft: string;
  primaryContainer: string;
  onPrimary: string;
  onPrimaryContainer: string;

  secondary: string;
  secondaryContainer: string;
  onSecondary: string;
  onSecondaryContainer: string;

  tertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;

  accent: string;
  accentGlow: string;
  accentRose: string;
  accentLavender: string;
  accentPeach: string;
  accentMorningBlue: string;
  accentLilac: string;

  accentTeal: string;
  accentGreen: string;
  accentPurple: string;
  accentOrange: string;
  accentYellow: string;
  accentCoral: string;
  accentCream: string;

  tintFrost: string;
  tintTeal: string;
  tintGreen: string;
  tintPurple: string;
  tintOrange: string;
  tintYellow: string;
  tintCoral: string;

  border: string;
  borderSubtle: string;
  borderActive: string;
  borderAccent: string;

  successSurface: string;

  buttonFill: string;
  buttonText: string;
  buttonPressedFill: string;
  buttonPressedText: string;
  buttonDisabledFill: string;
  buttonDisabledText: string;
  buttonBottom: string;
  buttonSecondaryFill: string;
  buttonSecondaryText: string;
  buttonSecondaryBottom: string;

  inputFill: string;
  inputBorder: string;
  inputBorderFocused: string;
  inputPlaceholder: string;

  dot: string;
  dotInactive: string;
  divider: string;
  overlay: string;

  success: string;
  warning: string;
  error: string;
  errorSurface: string;

  shadow: ShadowToken;
  shadowElevated: ShadowToken;

  scrim: string;
  inverseText: string;
};

export const lightGradients: ThemeGradients = {
  background: ['#F5F5F5', '#F5F5F5', '#F5F5F5'],
  surface: ['#FFFFFF', '#FFFFFF'],
  accent: ['#D71921', '#D71921'],
  accentSoft: ['#FFF1F2', '#FFF1F2'],
  glass: ['#FFFFFF', '#FFFFFF'],
  composer: ['#FFFFFF', '#FFFFFF'],
  vitality: ['#FFFFFF', '#FFFFFF'],
};

export const darkGradients: ThemeGradients = {
  background: ['#121212', '#121212', '#121212'],
  surface: ['#1A1A1A', '#1A1A1A'],
  accent: ['#D71921', '#D71921'],
  accentSoft: ['#1C1C1C', '#1C1C1C'],
  glass: ['#1C1C1C', '#1C1C1C'],
  composer: ['#1C1C1C', '#1C1C1C'],
  vitality: ['#D71921', '#D71921'],
};

export const lightTheme: AppTheme = {
  background: '#F5F5F5',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceGlass: '#FFFFFF',
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#F5F5F5',
  surfaceContainer: '#EEEEEE',
  surfaceContainerHigh: '#E0E0E0',

  glassFill: '#FFFFFF',
  glassBorder: '#E0E0E0',
  glassHighlight: '#FFFFFF',
  glassIntensity: 0,

  text: '#000000',
  textSecondary: '#666666',
  textMuted: '#999999',
  textDisabled: '#BBBBBB',

  primary: '#D71921',
  primaryPressed: '#B01219',
  primarySoft: '#FFF1F2',
  primaryContainer: '#FFF1F2',
  onPrimary: '#FFFFFF',
  onPrimaryContainer: '#3A0A0A',

  secondary: '#666666',
  secondaryContainer: '#EEEEEE',
  onSecondary: '#000000',
  onSecondaryContainer: '#000000',

  tertiary: '#000000',
  tertiaryContainer: '#EEEEEE',
  onTertiaryContainer: '#000000',

  accent: '#D71921',
  accentGlow: 'rgba(215, 25, 33, 0.12)',
  accentRose: '#D71921',
  accentLavender: '#D71921',
  accentPeach: '#000000',
  accentMorningBlue: '#000000',
  accentLilac: '#666666',

  accentTeal: '#000000',
  accentGreen: '#4A9E5C',
  accentPurple: '#D71921',
  accentOrange: '#000000',
  accentYellow: '#000000',
  accentCoral: '#D71921',
  accentCream: '#FFFFFF',

  tintFrost: 'rgba(215, 25, 33, 0.08)',
  tintTeal: '#EEEEEE',
  tintGreen: 'rgba(74, 158, 92, 0.12)',
  tintPurple: 'rgba(215, 25, 33, 0.08)',
  tintOrange: '#EEEEEE',
  tintYellow: '#EEEEEE',
  tintCoral: 'rgba(215, 25, 33, 0.08)',

  border: '#E0E0E0',
  borderSubtle: '#EEEEEE',
  borderActive: '#D71921',
  borderAccent: '#D71921',

  successSurface: '#F3F8F4',

  buttonFill: '#000000',
  buttonText: '#FFFFFF',
  buttonPressedFill: '#1A1A1A',
  buttonPressedText: '#FFFFFF',
  buttonDisabledFill: '#E0E0E0',
  buttonDisabledText: '#999999',
  buttonBottom: '#000000',
  buttonSecondaryFill: '#FFFFFF',
  buttonSecondaryText: '#000000',
  buttonSecondaryBottom: '#E0E0E0',

  inputFill: '#FFFFFF',
  inputBorder: '#CCCCCC',
  inputBorderFocused: '#D71921',
  inputPlaceholder: '#999999',

  dot: '#D71921',
  dotInactive: '#CCCCCC',
  divider: '#E0E0E0',
  overlay: 'rgba(0, 0, 0, 0.04)',

  success: '#2F7A3A',
  warning: '#8A6A1E',
  error: '#D71921',
  errorSurface: '#FFF1F2',

  shadow: shadows.none,
  shadowElevated: shadows.none,

  scrim: 'rgba(0, 0, 0, 0.45)',
  inverseText: '#FFFFFF',
};

export const darkTheme: AppTheme = {
  background: '#121212',
  surface: '#1C1C1C',
  surfaceElevated: '#222222',
  surfaceGlass: '#1C1C1C',
  surfaceContainerLowest: '#121212',
  surfaceContainerLow: '#181818',
  surfaceContainer: '#222222',
  surfaceContainerHigh: '#2A2A2A',

  glassFill: '#1C1C1C',
  glassBorder: '#333333',
  glassHighlight: '#F2F2F2',
  glassIntensity: 0,

  text: '#F0F0F0',
  textSecondary: '#B5B5B5',
  textMuted: '#8A8A8A',
  textDisabled: '#666666',

  primary: '#D71921',
  primaryPressed: '#B01219',
  primarySoft: 'rgba(215, 25, 33, 0.16)',
  primaryContainer: '#3A1214',
  onPrimary: '#FFFFFF',
  onPrimaryContainer: '#F0F0F0',

  secondary: '#A3A3A3',
  secondaryContainer: '#1A1A1A',
  onSecondary: '#121212',
  onSecondaryContainer: '#E6E6E6',

  tertiary: '#E6E6E6',
  tertiaryContainer: '#1A1A1A',
  onTertiaryContainer: '#E6E6E6',

  accent: '#D71921',
  accentGlow: 'rgba(215, 25, 33, 0.16)',
  accentRose: '#D71921',
  accentLavender: '#D71921',
  accentPeach: '#E6E6E6',
  accentMorningBlue: '#E6E6E6',
  accentLilac: '#A3A3A3',

  accentTeal: '#E6E6E6',
  accentGreen: '#6AAA72',
  accentPurple: '#D71921',
  accentOrange: '#E6E6E6',
  accentYellow: '#E6E6E6',
  accentCoral: '#D71921',
  accentCream: '#E6E6E6',

  tintFrost: 'rgba(215, 25, 33, 0.14)',
  tintTeal: '#1C1C1C',
  tintGreen: 'rgba(106, 170, 114, 0.14)',
  tintPurple: 'rgba(215, 25, 33, 0.14)',
  tintOrange: '#1C1C1C',
  tintYellow: '#1C1C1C',
  tintCoral: 'rgba(215, 25, 33, 0.14)',

  border: '#333333',
  borderSubtle: '#2A2A2A',
  borderActive: '#D71921',
  borderAccent: '#D71921',

  successSurface: '#16211A',

  buttonFill: '#D71921',
  buttonText: '#FFFFFF',
  buttonPressedFill: '#B01219',
  buttonPressedText: '#FFFFFF',
  buttonDisabledFill: '#2A2A2A',
  buttonDisabledText: '#8A8A8A',
  buttonBottom: '#B01219',
  buttonSecondaryFill: '#1A1A1A',
  buttonSecondaryText: '#E6E6E6',
  buttonSecondaryBottom: '#1A1A1A',

  inputFill: '#1A1A1A',
  inputBorder: '#333333',
  inputBorderFocused: '#D71921',
  inputPlaceholder: '#7A7A7A',

  dot: '#F0F0F0',
  dotInactive: '#3A3A3A',
  divider: '#2C2C2C',
  overlay: 'rgba(255, 255, 255, 0.04)',

  success: '#6AAA72',
  warning: '#C4A15A',
  error: '#D71921',
  errorSurface: '#3A1214',

  shadow: shadows.none,
  shadowElevated: shadows.none,

  scrim: 'rgba(18, 18, 18, 0.72)',
  inverseText: '#121212',
};

export function getThemeGradients(isLight: boolean): ThemeGradients {
  return isLight ? lightGradients : darkGradients;
}

export type AuroraTone = 'frost' | 'teal' | 'green' | 'purple' | 'orange' | 'yellow' | 'coral';

export function auroraToneColors(theme: AppTheme, tone: AuroraTone) {
  switch (tone) {
    case 'teal':
      return { accent: theme.accentTeal, tint: theme.tintTeal };
    case 'frost':
      return { accent: theme.accent, tint: theme.tintFrost };
    case 'green':
      return { accent: theme.accentGreen, tint: theme.tintGreen };
    case 'purple':
      return { accent: theme.accentPurple, tint: theme.tintPurple };
    case 'orange':
      return { accent: theme.accentOrange, tint: theme.tintOrange };
    case 'yellow':
      return { accent: theme.accentYellow, tint: theme.tintYellow };
    case 'coral':
      return { accent: theme.accentCoral, tint: theme.tintCoral };
    default:
      return { accent: theme.accent, tint: theme.tintFrost };
  }
}

export const AURORA_TONES: AuroraTone[] = [
  'purple',
  'frost',
  'teal',
  'green',
  'orange',
  'yellow',
  'coral',
];

const logos = {
  light: require('./assets/logo-dark.png') as ImageSourcePropType,
  dark: require('./assets/logo-light.png') as ImageSourcePropType,
};

export function getDeviceTheme(scheme: ColorSchemeName): AppTheme {
  return scheme === 'dark' ? darkTheme : lightTheme;
}

export function getLogoForScheme(scheme: ColorSchemeName): ImageSourcePropType {
  return scheme === 'dark' ? logos.dark : logos.light;
}

export function isDarkScheme(scheme: ColorSchemeName): boolean {
  return scheme === 'dark';
}

export function getGlassSurface(scheme: ColorSchemeName) {
  const isDark = scheme === 'dark';
  const theme = isDark ? darkTheme : lightTheme;
  return {
    backgroundColor: theme.surfaceElevated,
    borderColor: theme.border,
    borderWidth: 1,
  };
}

export function shouldUseAccent(isInterrupt: boolean): string | undefined {
  return isInterrupt ? lavender[400] : undefined;
}

export function getTextColor(
  theme: AppTheme,
  level: 'primary' | 'secondary' | 'muted' | 'disabled',
): string {
  switch (level) {
    case 'primary':
      return theme.text;
    case 'secondary':
      return theme.textSecondary;
    case 'muted':
      return theme.textMuted;
    case 'disabled':
      return theme.textDisabled;
  }
}

export const nothing = {
  red: lavender[500],
} as const;

export const nordPalette = {
  frost: {
    0: nord.frost[0],
    1: nord.frost[1],
    2: nord.frost[2],
    3: nord.frost[3],
  },
  aurora: {
    red: nord.aurora.red,
    orange: nord.aurora.orange,
    yellow: nord.aurora.yellow,
    green: nord.aurora.green,
    purple: nord.aurora.purple,
  },
  polarNight: {
    0: nord.polarNight[0],
    1: nord.polarNight[1],
    2: nord.polarNight[2],
    3: nord.polarNight[3],
  },
} as const;

export const tokyoPalette = {
  accent: {
    blue: lavender[500],
    cyan: lavender[400],
    magenta: '#A142F4',
    green: '#4A9E5C',
    orange: '#F97316',
    red: '#EF4444',
    yellow: '#F59E0B',
    teal: '#14B8A6',
  },
} as const;

export const kairosPalette = { ink: mist, signal: lavender } as const;

export type ThemeColorKey = {
  [K in keyof AppTheme]: AppTheme[K] extends string ? K : never;
}[keyof AppTheme];
