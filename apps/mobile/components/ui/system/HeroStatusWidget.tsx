import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useAppTheme } from '../../../providers/ThemeProvider';
import { mascotSize } from '../../../theme';
import { Mascot, type MascotState } from './Mascot';

type HeroStatusWidgetProps = {
  value: string;
  label: string;
  subtitle?: string;
  /** 0–1 */
  progress?: number;
  secondaryValue?: string;
  secondaryLabel?: string;
  mascot?: MascotState;
  accessibilityLabel?: string;
};

/**
 * Large status card: mascot inside a progress ring, one big number, one quiet secondary metric.
 *
 * ```tsx
 * <HeroStatusWidget
 *   value="4"
 *   label="Daily progress"
 *   subtitle="1 more to reach today's pace."
 *   progress={0.8}
 *   secondaryValue="6"
 *   secondaryLabel="day streak"
 * />
 * ```
 */
export function HeroStatusWidget({
  value,
  label,
  subtitle,
  progress = 0,
  secondaryValue,
  secondaryLabel,
  mascot = 'idle',
  accessibilityLabel,
}: HeroStatusWidgetProps) {
  const { colors, radius, spacing, typography, shadows } = useAppTheme();
  const ring = mascotSize.lg + spacing['4'];
  const stroke = spacing['1'];
  const r = (ring - stroke * 2) / 2;
  const c = 2 * Math.PI * r;
  const ratio = Math.max(0, Math.min(1, progress));
  const center = ring / 2;

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={accessibilityLabel ?? `${label}, ${value}`}
      style={[
        styles.card,
        shadows.md,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.xl,
          padding: spacing['5'],
          gap: spacing['4'],
        },
      ]}
    >
      <View style={[styles.row, { gap: spacing['4'] }]}>
        <View style={{ width: ring, height: ring }}>
          <Svg width={ring} height={ring}>
            <Circle
              cx={center}
              cy={center}
              r={r}
              stroke={colors.border}
              strokeWidth={stroke}
              fill="none"
            />
            <Circle
              cx={center}
              cy={center}
              r={r}
              stroke={colors.primary}
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${c} ${c}`}
              strokeDashoffset={c * (1 - ratio)}
              transform={`rotate(-90 ${center} ${center})`}
            />
          </Svg>
          <View style={styles.mascotSlot}>
            <Mascot state={mascot} size={mascotSize.md} />
          </View>
        </View>
        <View style={[styles.copy, { gap: spacing['1'] }]}>
          <Text
            style={{
              color: colors.text,
              fontFamily: typography.stat.fontFamily,
              fontSize: typography.stat.size,
              lineHeight: typography.stat.lineHeight,
              letterSpacing: typography.stat.letterSpacing,
            }}
          >
            {value}
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.title3.fontFamily,
              fontSize: typography.body.size,
              lineHeight: typography.body.lineHeight,
            }}
          >
            {label}
          </Text>
          {subtitle ? (
            <Text
              style={{
                color: colors.textMuted,
                fontFamily: typography.bodySmall.fontFamily,
                fontSize: typography.bodySmall.size,
                lineHeight: typography.bodySmall.lineHeight,
              }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {secondaryValue ? (
        <Text
          style={[
            styles.secondary,
            {
              color: colors.textSecondary,
              borderTopColor: colors.border,
              paddingTop: spacing['3'],
              fontFamily: typography.caption.fontFamily,
              fontSize: typography.caption.size,
              lineHeight: typography.caption.lineHeight,
            },
          ]}
        >
          {secondaryValue}
          {secondaryLabel ? `  ${secondaryLabel}` : ''}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  copy: {
    flex: 1,
  },
  mascotSlot: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
