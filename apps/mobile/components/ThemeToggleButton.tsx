import { Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { useAppTheme } from '../providers/ThemeProvider';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ThemeToggleButtonProps = {
  /** Kept for call-site compat; colors come from ThemeContext. */
  themeProgress?: unknown;
  onToggle: () => void;
};

export function ThemeToggleButton({ onToggle }: ThemeToggleButtonProps) {
  const { colors, radius } = useAppTheme();
  const press = useSharedValue(0);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(press.value, [0, 1], [1, 0.92]) }],
  }));

  return (
    <AnimatedPressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onToggle();
      }}
      onPressIn={() => {
        press.value = withSpring(1, { damping: 14, stiffness: 280 });
      }}
      onPressOut={() => {
        press.value = withSpring(0, { damping: 14, stiffness: 280 });
      }}
      style={[
        styles.button,
        {
          borderRadius: radius.full,
          borderColor: colors.borderActive,
          backgroundColor: colors.buttonFill,
        },
        buttonStyle,
      ]}
      accessibilityLabel="Toggle theme"
      accessibilityRole="button"
    >
      <Animated.Text style={[styles.icon, { color: colors.buttonText }]}>◐</Animated.Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 16,
    lineHeight: 18,
  },
});
