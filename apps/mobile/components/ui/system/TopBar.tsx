import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../../../providers/ThemeProvider';
import { control } from '../../../theme';
import { PressScale } from '../Motion';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

type TopBarAction = {
  icon: FeatherName;
  label: string;
  onPress: () => void;
};

type TopBarProps = {
  title: string;
  leading?: TopBarAction;
  trailing?: TopBarAction;
};

/**
 * Compact bar: elevated icon buttons and a small centered title.
 *
 * ```tsx
 * <TopBar
 *   title="Today"
 *   trailing={{ icon: 'award', label: 'Progress', onPress: openProgress }}
 * />
 * ```
 */
export function TopBar({ title, leading, trailing }: TopBarProps) {
  const { colors, radius, spacing, typography } = useAppTheme();

  return (
    <View style={[styles.bar, { paddingHorizontal: spacing['5'], minHeight: control.touch }]}>
      <Slot action={leading} />
      <Text
        style={{
          flex: 1,
          textAlign: 'center',
          color: colors.text,
          fontFamily: typography.title3.fontFamily,
          fontSize: typography.title3.size,
          lineHeight: typography.title3.lineHeight,
          letterSpacing: typography.title3.letterSpacing,
        }}
        numberOfLines={1}
      >
        {title}
      </Text>
      <Slot action={trailing} />
    </View>
  );
}

function Slot({ action }: { action?: TopBarAction }) {
  const { colors, radius } = useAppTheme();
  if (!action) {
    return <View style={{ width: control.touch, height: control.touch }} />;
  }
  return (
    <PressScale
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        action.onPress();
      }}
      accessibilityLabel={action.label}
      style={[
        styles.button,
        {
          width: control.touch,
          height: control.touch,
          borderRadius: radius.md,
          backgroundColor: colors.surfaceElevated,
          borderColor: colors.border,
        },
      ]}
    >
      <Feather name={action.icon} size={18} color={colors.textSecondary} />
    </PressScale>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
