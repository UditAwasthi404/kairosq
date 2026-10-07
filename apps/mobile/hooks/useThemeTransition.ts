import { useCallback, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import {
  Easing,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  THEME_TRANSITION_DURATION_MS,
  THEME_TRANSITION_EASING,
} from '../themeAnimation';

export function useThemeTransition() {
  const colorScheme = useColorScheme();
  const themeProgress = useSharedValue(colorScheme === 'dark' ? 0 : 1);

  useEffect(() => {
    themeProgress.value = colorScheme === 'dark' ? 0 : 1;
  }, [colorScheme, themeProgress]);

  const toggleTheme = useCallback(() => {
    const target = themeProgress.value > 0.5 ? 0 : 1;
    themeProgress.value = withTiming(target, {
      duration: THEME_TRANSITION_DURATION_MS,
      easing: Easing.bezier(
        THEME_TRANSITION_EASING.x1,
        THEME_TRANSITION_EASING.y1,
        THEME_TRANSITION_EASING.x2,
        THEME_TRANSITION_EASING.y2,
      ),
    });
  }, [themeProgress]);

  return { themeProgress, toggleTheme };
}
