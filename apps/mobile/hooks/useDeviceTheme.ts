import { useColorScheme } from 'react-native';

import {
  AppTheme,
  getDeviceTheme,
  getLogoForScheme,
  isDarkScheme,
} from '../theme';

export function useDeviceTheme() {
  const colorScheme = useColorScheme();

  return {
    colorScheme,
    isDark: isDarkScheme(colorScheme),
    theme: getDeviceTheme(colorScheme),
    logo: getLogoForScheme(colorScheme),
  };
}

export type { AppTheme };
