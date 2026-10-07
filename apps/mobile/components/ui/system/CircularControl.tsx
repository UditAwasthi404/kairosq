import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../../../providers/ThemeProvider';
import { control } from '../../../theme';
import { PressScale } from '../Motion';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

type CircularControlProps = {
  icon: FeatherName;
  caption: string;
  onPress: () => void;
  /** Lavender treatment, still the same modest size. */
  primary?: boolean;
  disabled?: boolean;
};

/**
 * Small round control with a caption. Only `primary` picks up lavender.
 *
 * ```tsx
 * <CircularControl icon="mic" caption="Voice" primary onPress={startVoice} />
 * ```
 */
export function CircularControl({
  icon,
  caption,
  onPress,
  primary = false,
  disabled = false,
}: CircularControlProps) {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <PressScale
      disabled={disabled}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      accessibilityLabel={caption}
      style={[styles.wrap, { gap: spacing['2'], opacity: disabled ? 0.4 : 1 }]}
    >
      <View
        style={[
          styles.circle,
          {
            width: control.circular,
            height: control.circular,
            backgroundColor: primary ? colors.primary : colors.surfaceElevated,
            borderColor: primary ? colors.primary : colors.border,
          },
        ]}
      >
        <Feather name={icon} size={18} color={primary ? colors.onPrimary : colors.textSecondary} />
      </View>
      <Text
        style={{
          color: primary ? colors.primary : colors.textMuted,
          fontFamily: typography.overline.fontFamily,
          fontSize: typography.overline.size,
          lineHeight: typography.overline.lineHeight,
        }}
      >
        {caption}
      </Text>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  circle: {
    borderRadius: control.circular,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
