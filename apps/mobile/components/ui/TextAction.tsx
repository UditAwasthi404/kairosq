import { Pressable, StyleSheet, TextStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '../ThemedText';
import { useAppTheme } from '../../providers/ThemeProvider';

type TextActionProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: TextStyle;
  accessibilityLabel?: string;
};

/** Text-only action — always accent red (Nothing interrupt for taps). */
export function TextAction({
  label,
  onPress,
  disabled = false,
  style,
  accessibilityLabel,
}: TextActionProps) {
  const { typography, spacing } = useAppTheme();

  return (
    <Pressable
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={8}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [{ opacity: disabled ? 0.4 : pressed ? 0.65 : 1 }]}
    >
      <ThemedText
        colorKey="accent"
        style={[
          styles.label,
          {
            fontSize: typography.bodySmall.size,
            paddingVertical: spacing['1'],
          },
          style,
        ]}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: 'Roboto_600SemiBold',
    letterSpacing: 0.2,
  },
});
