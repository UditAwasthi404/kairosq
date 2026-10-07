import { Feather } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useAppTheme } from '../../providers/ThemeProvider';

export function Checkbox({ checked, size = 22 }: { checked: boolean; size?: number }) {
  const { colors } = useAppTheme();
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced) return;
    scale.value = withSequence(
      withTiming(checked ? 1.18 : 0.88, { duration: 90 }),
      withSpring(1, { damping: 12, stiffness: 320 }),
    );
  }, [checked, reduced, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View
      style={[
        styles.box,
        {
          width: size,
          height: size,
          borderRadius: size * 0.3,
          borderColor: checked ? colors.primary : colors.textMuted,
          backgroundColor: checked ? colors.primary : 'transparent',
        },
        style,
      ]}
    >
      {checked ? <Feather name="check" size={size * 0.68} color={colors.onPrimary} /> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
