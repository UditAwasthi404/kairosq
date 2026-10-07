import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../../../providers/ThemeProvider';
import { control } from '../../../theme';
import { PressScale } from '../Motion';

type FeatherName = React.ComponentProps<typeof Feather>['name'];
export type ActionTint = 'blue' | 'teal' | 'amber';

type QuickActionTileProps = {
  icon: FeatherName;
  label: string;
  tint?: ActionTint;
  selected?: boolean;
  onPress: () => void;
};

/**
 * Compact action tile. Tint stays on the icon well; lavender is reserved for the selected state.
 *
 * ```tsx
 * <QuickActionTile icon="plus" label="Capture" tint="amber" onPress={openCapture} />
 * ```
 */
export function QuickActionTile({
  icon,
  label,
  tint = 'blue',
  selected = false,
  onPress,
}: QuickActionTileProps) {
  const { colors, radius, spacing, typography } = useAppTheme();
  const tone =
    tint === 'teal'
      ? { ink: colors.accentTeal, wash: colors.tintTeal }
      : tint === 'amber'
        ? { ink: colors.accentYellow, wash: colors.tintYellow }
        : { ink: colors.accentMorningBlue, wash: colors.tertiaryContainer };

  return (
    <PressScale
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      accessibilityLabel={label}
      style={styles.hit}
    >
      <View
        style={[
          styles.tile,
          {
            backgroundColor: selected ? colors.primarySoft : colors.surfaceElevated,
            borderColor: selected ? colors.borderActive : colors.border,
            borderRadius: radius.lg,
            padding: spacing['3'],
            gap: spacing['2'],
            minHeight: control.touch + spacing['8'],
          },
        ]}
      >
        <View
          style={[
            styles.iconWell,
            {
              backgroundColor: tone.wash,
              borderRadius: radius.md,
              width: control.icon,
              height: control.icon,
            },
          ]}
        >
          <Feather name={icon} size={18} color={selected ? colors.primary : tone.ink} />
        </View>
        <Text
          style={{
            color: colors.text,
            fontFamily: typography.caption.fontFamily,
            fontSize: typography.caption.size,
            lineHeight: typography.caption.lineHeight,
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </PressScale>
  );
}

type QuickActionGridProps = {
  actions: Array<QuickActionTileProps & { id: string }>;
};

/** Two-column grid of quick actions. */
export function QuickActionGrid({ actions }: QuickActionGridProps) {
  const { spacing } = useAppTheme();
  return (
    <View style={[styles.grid, { rowGap: spacing['3'] }]}>
      {actions.map((action) => (
        <View key={action.id} style={styles.cell}>
          <QuickActionTile {...action} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  hit: {
    width: '100%',
  },
  tile: {
    borderWidth: 1,
    justifyContent: 'space-between',
  },
  iconWell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  cell: {
    width: '31%',
  },
});
