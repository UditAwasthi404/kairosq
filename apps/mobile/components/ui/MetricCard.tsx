import React from 'react';
import { StyleSheet, StyleProp, Text, View, ViewStyle } from 'react-native';

import { ThemedText } from '../ThemedText';
import { useAppTheme } from '../../providers/ThemeProvider';
import { SurfaceCard } from './SectionHeader';

type MetricCardProps = {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function MetricCard({ label, value, hint, icon, style }: MetricCardProps) {
  const { colors, typography, spacing, radius } = useAppTheme();

  return (
    <SurfaceCard style={[styles.metric, style]}>
      <View style={styles.metricTop}>
        <ThemedText
          colorKey="textSecondary"
          style={{
            fontFamily: typography.overline.fontFamily,
            fontSize: typography.overline.size,
            lineHeight: typography.overline.lineHeight,
            letterSpacing: typography.overline.letterSpacing,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </ThemedText>
        {icon ? <View style={[styles.iconWrap, { backgroundColor: colors.primaryContainer, borderRadius: radius.full }]}>{icon}</View> : null}
      </View>
      <ThemedText
        colorKey="text"
        style={{
          fontFamily: typography.stat.fontFamily,
          fontSize: typography.stat.size,
          letterSpacing: typography.stat.letterSpacing,
          lineHeight: typography.stat.lineHeight,
          marginTop: spacing['1'],
        }}
      >
        {value}
      </ThemedText>
      {hint ? (
        <ThemedText
          colorKey="textMuted"
          style={{
            fontFamily: typography.caption.fontFamily,
            fontSize: typography.caption.size,
            lineHeight: typography.caption.lineHeight,
            marginTop: spacing['0.5'],
          }}
        >
          {hint}
        </ThemedText>
      ) : null}
    </SurfaceCard>
  );
}

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning';

type BadgeProps = {
  label: string;
  tone?: BadgeTone;
};

export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  const { colors, radius, typography, spacing } = useAppTheme();

  const config = {
    accent: {
      bg: colors.primaryContainer,
      text: colors.primary,
      border: colors.borderAccent,
    },
    success: {
      bg: colors.tintGreen,
      text: colors.success,
      border: 'transparent',
    },
    warning: {
      bg: colors.tintYellow,
      text: colors.warning,
      border: 'transparent',
    },
    neutral: {
      bg: colors.surfaceContainer,
      text: colors.textSecondary,
      border: colors.border,
    },
  }[tone];

  return (
    <View
      style={{
        borderRadius: radius.full,
        paddingHorizontal: spacing['2'] + 4,
        paddingVertical: spacing['0.5'] + 1,
        backgroundColor: config.bg,
        borderColor: config.border,
        borderWidth: config.border === 'transparent' ? 0 : 1,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        style={{
          fontFamily: typography.overline.fontFamily,
          fontSize: typography.overline.size - 1,
          letterSpacing: typography.overline.letterSpacing,
          color: config.text,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

type ProgressBarProps = {
  progress: number;
  height?: number;
  color?: string;
  trackColor?: string;
  style?: StyleProp<ViewStyle>;
};

export function ProgressBar({
  progress,
  height = 8,
  color,
  trackColor,
  style,
}: ProgressBarProps) {
  const { colors, radius } = useAppTheme();
  const width = `${Math.max(0, Math.min(100, progress * 100))}%` as `${number}%`;
  const activeColor = color ?? colors.primary;
  const inactiveColor = trackColor ?? colors.surfaceContainer;

  return (
    <View
      style={[
        {
          height,
          borderRadius: radius.full,
          overflow: 'hidden',
          backgroundColor: inactiveColor,
        },
        style,
      ]}
    >
      <View
        style={{
          height: '100%',
          borderRadius: radius.full,
          backgroundColor: activeColor,
          width,
        }}
      />
    </View>
  );
}

type InsightCardProps = {
  title: string;
  body: string;
  meta?: string;
  badge?: string;
  onPress?: () => void;
};

export function InsightCard({ title, body, meta, badge }: InsightCardProps) {
  const { typography, spacing } = useAppTheme();

  return (
    <SurfaceCard>
      <View style={[styles.insightHeader, { gap: spacing['2'], marginBottom: spacing['1'] }]}>
        <ThemedText
          colorKey="text"
          style={{
            fontFamily: typography.title3.fontFamily,
            fontSize: typography.title3.size,
            flex: 1,
            letterSpacing: typography.title3.letterSpacing,
            lineHeight: typography.title3.lineHeight,
          }}
        >
          {title}
        </ThemedText>
        {badge ? <Badge label={badge} tone="accent" /> : null}
      </View>
      <ThemedText
        colorKey="textSecondary"
        style={{
          fontFamily: typography.bodySmall.fontFamily,
          fontSize: typography.bodySmall.size,
          lineHeight: typography.bodySmall.lineHeight + 2,
          letterSpacing: typography.bodySmall.letterSpacing,
        }}
      >
        {body}
      </ThemedText>
      {meta ? (
        <ThemedText
          colorKey="textMuted"
          style={{
            fontFamily: typography.caption.fontFamily,
            fontSize: typography.caption.size,
            letterSpacing: typography.caption.letterSpacing,
            marginTop: spacing['2'],
          }}
        >
          {meta}
        </ThemedText>
      ) : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  metric: {
    minWidth: 120,
    flexGrow: 1,
    flexBasis: '30%',
  },
  metricTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
});