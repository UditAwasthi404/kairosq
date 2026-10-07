import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../../../providers/ThemeProvider';
import { control, mascotSize } from '../../../theme';
import { PressScale } from '../Motion';
import { Mascot } from './Mascot';

type InsightCardProps = {
  message: string;
  onPress?: () => void;
  accessibilityLabel?: string;
};

/**
 * Compact suggestion. One line, a mini mascot, and a forward affordance.
 *
 * ```tsx
 * <InsightCard
 *   message="You captured 7 related ideas this week."
 *   onPress={openInsight}
 * />
 * ```
 */
export function InsightCard({ message, onPress, accessibilityLabel }: InsightCardProps) {
  const { colors, radius, spacing, typography } = useAppTheme();

  const body = (
    <View
      style={[
        styles.row,
        {
          backgroundColor: colors.surfaceElevated,
          borderColor: colors.border,
          borderRadius: radius.full,
          paddingHorizontal: spacing['3'],
          paddingVertical: spacing['2'],
          minHeight: control.insight,
          gap: spacing['2'],
        },
      ]}
    >
      <Mascot state="thinking" size={mascotSize.sm} />
      <Text
        style={[
          styles.message,
          {
            color: colors.text,
            fontFamily: typography.bodySmall.fontFamily,
            fontSize: typography.bodySmall.size,
            lineHeight: typography.bodySmall.lineHeight,
          },
        ]}
        numberOfLines={2}
      >
        {message}
      </Text>
      <Feather name="chevron-right" size={16} color={colors.textMuted} />
    </View>
  );

  if (!onPress) return body;

  return (
    <PressScale onPress={onPress} accessibilityLabel={accessibilityLabel ?? message}>
      {body}
    </PressScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  message: {
    flex: 1,
  },
});
