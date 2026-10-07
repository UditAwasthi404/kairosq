import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme } from '../providers/ThemeProvider';
import { kairosPalette } from '../theme';

/** Subtle brand atmosphere — slow looping drift, not a rainbow. */
export function SoftAurora({ compact = false }: { compact?: boolean }) {
  const { isLight } = useAppTheme();
  const s = kairosPalette.signal;
  const drift = useSharedValue(0);

  useEffect(() => {
    drift.value = withRepeat(
      withTiming(1, { duration: 8200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [drift]);

  const blobA = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(drift.value, [0, 1], [0, 14]) },
      { translateY: interpolate(drift.value, [0, 1], [0, -10]) },
      { scale: interpolate(drift.value, [0, 1], [1, 1.08]) },
    ],
  }));

  const blobB = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(drift.value, [0, 1], [0, -12]) },
      { translateY: interpolate(drift.value, [0, 1], [0, 8]) },
      { scale: interpolate(drift.value, [0, 1], [1.05, 0.92]) },
    ],
  }));

  const blobC = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(drift.value, [0, 1], [0, 10]) },
      { translateY: interpolate(drift.value, [0, 1], [0, -6]) },
      { scale: interpolate(drift.value, [0, 1], [0.94, 1.1]) },
    ],
  }));

  return (
    <Animated.View
      style={[styles.wrap, compact && styles.compact]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View
        style={[
          styles.blob,
          styles.blobA,
          { backgroundColor: isLight ? `${s[500]}22` : `${s[400]}18` },
          blobA,
        ]}
      />
      <Animated.View
        style={[
          styles.blob,
          styles.blobB,
          { backgroundColor: isLight ? `${s[600]}18` : `${s[300]}14` },
          blobB,
        ]}
      />
      <Animated.View
        style={[
          styles.blob,
          styles.blobC,
          { backgroundColor: isLight ? `${s[400]}14` : `${s[500]}10` },
          blobC,
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: -20,
    top: -16,
    width: 200,
    height: 160,
  },
  compact: {
    width: 130,
    height: 110,
    right: -10,
    top: -6,
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  blobA: {
    width: 130,
    height: 130,
    right: 0,
    top: 0,
  },
  blobB: {
    width: 80,
    height: 80,
    right: 70,
    top: 60,
  },
  blobC: {
    width: 48,
    height: 48,
    right: 24,
    top: 96,
  },
});
