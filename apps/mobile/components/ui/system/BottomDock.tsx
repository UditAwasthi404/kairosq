import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { useAppTheme } from '../../../providers/ThemeProvider';
import { control } from '../../../theme';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

export type DockItem = {
  key: string;
  label: string;
  icon: FeatherName;
  active: boolean;
  onPress: () => void;
  onLongPress?: () => void;
};

type BottomDockProps = {
  items: DockItem[];
};

const dockSpring = { damping: 16, stiffness: 240, mass: 0.8 } as const;

/**
 * Embedded bottom dock. The selected tab lifts, turns red, and gains a dot indicator.
 *
 * ```tsx
 * <BottomDock
 *   items={[{ key: 'today', label: 'Today', icon: 'sun', active: true, onPress: goToday }]}
 * />
 * ```
 */
export function BottomDock({ items }: BottomDockProps) {
  const { colors, radius, spacing } = useAppTheme();

  return (
    <View
      style={[
        styles.dock,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          paddingTop: spacing['2'],
          paddingBottom: spacing['2'],
          minHeight: control.dock,
        },
      ]}
    >
      {items.map((item) => (
        <DockButton key={item.key} item={item} />
      ))}
    </View>
  );
}

function DockButton({ item }: { item: DockItem }) {
  const { colors, typography, motion } = useAppTheme();
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const selected = useSharedValue(item.active ? 1 : 0);

  useEffect(() => {
    const target = item.active ? 1 : 0;
    selected.value = reduced ? target : withSpring(target, dockSpring);
  }, [item.active, reduced, selected]);

  const innerStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: interpolate(selected.value, [0, 1], [0, -2]) },
    ],
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(selected.value, [0, 1], [1, 1.12]) }],
  }));
  const dotStyle = useAnimatedStyle(() => ({
    opacity: selected.value,
    transform: [{ scale: selected.value }],
  }));

  const color = item.active ? colors.primary : colors.textMuted;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={item.active ? { selected: true } : {}}
      accessibilityLabel={item.label}
      onPress={() => {
        void Haptics.selectionAsync();
        item.onPress();
      }}
      onLongPress={item.onLongPress}
      onPressIn={() => {
        scale.value = withTiming(0.9, {
          duration: reduced ? 0 : motion.fast,
          easing: Easing.out(Easing.cubic),
        });
      }}
      onPressOut={() => {
        scale.value = reduced ? 1 : withSpring(1, dockSpring);
      }}
      style={styles.item}
    >
      <Animated.View style={[styles.itemInner, innerStyle]}>
        <Animated.View style={iconStyle}>
          <Feather name={item.icon} size={20} color={color} />
        </Animated.View>
        <Text
          style={{
            color,
            fontFamily: typography.overline.fontFamily,
            fontSize: typography.overline.size,
            lineHeight: typography.overline.lineHeight,
            letterSpacing: 0,
          }}
        >
          {item.label}
        </Text>
        <Animated.View style={[styles.dot, { backgroundColor: colors.primary }, dotStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
  },
  item: {
    flex: 1,
    minHeight: control.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 1,
  },
});
