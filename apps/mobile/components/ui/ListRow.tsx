import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '../ThemedText';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useAppTheme } from '../../providers/ThemeProvider';
import { GlassPanel } from './Glass';
import { PressScale } from './Motion';

type ListRowProps = {
  title: string;
  subtitle?: string;
  count?: number;
  /** 0–1 share relative to the largest sibling; draws a thin bar under the title. */
  weight?: number;
  /** Highlights the row as the strongest in its list (red weight bar). */
  lead?: boolean;
  icon?: ComponentProps<typeof Feather>['name'];
  titleLines?: number;
  index?: number;
  onPress: () => void;
  accessibilityLabel?: string;
};

function WeightBar({ weight, color, track, index }: { weight: number; color: string; track: string; index: number }) {
  const reduced = useReducedMotion();
  const width = useSharedValue(reduced ? weight : 0);
  useEffect(() => {
    const target = Math.max(0.04, Math.min(1, weight));
    width.value = reduced
      ? target
      : withDelay(160 + Math.min(index, 8) * 50, withTiming(target, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [index, reduced, weight, width]);
  const style = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));
  return (
    <View style={[styles.track, { backgroundColor: track }]}>
      <Animated.View style={[styles.fill, { backgroundColor: color }, style]} />
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  count,
  weight,
  lead,
  icon,
  titleLines = 1,
  index = 0,
  onPress,
  accessibilityLabel,
}: ListRowProps) {
  const { colors } = useAppTheme();

  return (
    <PressScale
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      accessibilityLabel={accessibilityLabel ?? (count != null ? `${title}, ${count} memories` : title)}
    >
      <GlassPanel padded={false} contentStyle={styles.row}>
        {icon ? (
          <View style={[styles.icon, { backgroundColor: lead ? colors.primaryContainer : colors.surfaceContainer }]}>
            <Feather name={icon} size={16} color={lead ? colors.primary : colors.textSecondary} />
          </View>
        ) : null}
        <View style={styles.copy}>
          <ThemedText colorKey="text" style={styles.title} numberOfLines={titleLines}>
            {title}
          </ThemedText>
          {subtitle ? (
            <ThemedText colorKey="textMuted" style={styles.subtitle} numberOfLines={2}>
              {subtitle}
            </ThemedText>
          ) : null}
          {weight != null ? (
            <WeightBar
              weight={weight}
              index={index}
              color={lead ? colors.primary : colors.textMuted}
              track={colors.surfaceContainer}
            />
          ) : null}
        </View>
        {count != null ? (
          <ThemedText colorKey={lead ? 'primary' : 'textSecondary'} style={styles.count}>
            {count}
          </ThemedText>
        ) : null}
        <Feather name="chevron-right" size={18} color={colors.textMuted} />
      </GlassPanel>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 4 },
  title: { fontFamily: 'Roboto_500Medium', fontSize: 15 },
  subtitle: { fontFamily: 'Roboto_400Regular', fontSize: 13, lineHeight: 18 },
  track: { height: 3, borderRadius: 2, overflow: 'hidden', marginTop: 4 },
  fill: { height: '100%', borderRadius: 2 },
  count: { fontFamily: 'Roboto_600SemiBold', fontSize: 14 },
});
