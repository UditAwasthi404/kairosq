import React, { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { ThemedText } from '../ThemedText';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { loadingLine } from '../../lib/engagement';
import { useNetworkStatus } from '../../lib/network';
import { useAppTheme } from '../../providers/ThemeProvider';
import { NetworkErrorScreen } from './NetworkStatus';
import { Breathe, fadeEntering, itemEntering, pageEntering } from './Motion';
import { ThemedButton } from './ThemedButton';

type EmptyStateProps = {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: keyof typeof MaterialIcons.glyphMap;
  style?: StyleProp<ViewStyle>;
};

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
  icon = 'auto-awesome',
  style,
}: EmptyStateProps) {
  const { colors, spacing, radius, typography } = useAppTheme();

  return (
    <Animated.View
      entering={fadeEntering(40)}
      style={[styles.container, { padding: spacing['8'], gap: spacing['3'] }, style]}
    >
      <Breathe amount={0.06} period={3200}>
        <View
          style={[
            styles.iconOrb,
            {
              backgroundColor: colors.primaryContainer,
              borderColor: colors.borderAccent,
              borderRadius: radius.full,
            },
          ]}
        >
          <MaterialIcons name={icon} size={32} color={colors.primary} />
        </View>
      </Breathe>
      <ThemedText
        colorKey="text"
        style={[
          styles.emptyTitle,
          {
            fontFamily: typography.title2.fontFamily,
            fontSize: typography.title2.size,
          },
        ]}
      >
        {title}
      </ThemedText>
      {message ? (
        <ThemedText
          colorKey="textSecondary"
          style={[
            styles.emptyMessage,
            {
              fontFamily: typography.body.fontFamily,
              fontSize: typography.bodySmall.size,
              lineHeight: typography.bodySmall.lineHeight + 2,
            },
          ]}
        >
          {message}
        </ThemedText>
      ) : null}
      {actionLabel && onAction ? (
        <ThemedButton
          label={actionLabel}
          onPress={onAction}
          style={{ marginTop: spacing['3'], minWidth: 160 }}
        />
      ) : null}
    </Animated.View>
  );
}

type ErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
};

export function OfflineState({ onRetry }: { onRetry?: () => void }) {
  return <NetworkErrorScreen onRetry={onRetry} />;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  compact,
}: ErrorStateProps) {
  const { spacing, colors, radius, typography } = useAppTheme();
  const { online } = useNetworkStatus();

  if (!online) return <NetworkErrorScreen onRetry={onRetry} compact={compact} />;

  if (compact) {
    return (
      <View
        style={[
          styles.compactError,
          {
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.border,
            borderRadius: radius.md,
            padding: spacing['3'],
          },
        ]}
      >
        <MaterialIcons name="error-outline" size={18} color={colors.error} />
        <ThemedText colorKey="text" style={{ flex: 1, fontSize: 13 }}>
          {title}
        </ThemedText>
        {onRetry ? (
          <ThemedButton
            label="Retry"
            size="sm"
            variant="secondary"
            onPress={onRetry}
          />
        ) : null}
      </View>
    );
  }

  return (
    <Animated.View
      entering={fadeEntering()}
      style={[styles.container, { padding: spacing['8'], gap: spacing['4'] }]}
    >
      <View
        style={[
          styles.iconOrb,
          {
            backgroundColor: colors.errorSurface,
            borderColor: colors.error,
            borderRadius: radius.full,
          },
        ]}
      >
        <MaterialIcons name="error-outline" size={32} color={colors.error} />
      </View>
      <ThemedText
        colorKey="text"
        style={[
          styles.emptyTitle,
          {
            fontFamily: typography.title2.fontFamily,
            fontSize: typography.title2.size,
          },
        ]}
      >
        {title}
      </ThemedText>
      {message ? (
        <ThemedText colorKey="textSecondary" style={styles.emptyMessage}>
          {message}
        </ThemedText>
      ) : null}
      {onRetry ? <ThemedButton label="Try again" onPress={onRetry} style={{ minWidth: 150 }} /> : null}
    </Animated.View>
  );
}

type LoadingSkeletonProps = {
  rows?: number;
  label?: string;
};

/**
 * Shimmer skeleton with a rotating status line. Occupied waits feel shorter than
 * empty ones, so the copy changes while the sweep moves.
 */
export function LoadingSkeleton({ rows = 4, label }: LoadingSkeletonProps) {
  const { colors, spacing, radius, typography } = useAppTheme();
  const reduced = useReducedMotion();
  const sweep = useSharedValue(0);
  const [step, setStep] = useState(0);
  const line = label && step === 0 ? label : loadingLine(step);

  useEffect(() => {
    if (reduced) {
      cancelAnimation(sweep);
      sweep.value = 0.5;
      return;
    }
    sweep.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1, false);
    return () => cancelAnimation(sweep);
  }, [reduced, sweep]);

  useEffect(() => {
    const timer = setInterval(() => setStep((s) => s + 1), 1800);
    return () => clearInterval(timer);
  }, []);

  return (
    <Animated.View
      style={{ padding: spacing['6'], gap: spacing['3'], flex: 1 }}
      accessibilityLabel={line}
      accessibilityLiveRegion="polite"
    >
      <Animated.View key={line} entering={FadeIn.duration(260)} exiting={FadeOut.duration(160)}>
        <ThemedText
          colorKey="textMuted"
          style={{
            fontFamily: typography.caption.fontFamily,
            fontSize: typography.caption.size,
            letterSpacing: 0.2,
            textAlign: 'center',
            marginBottom: spacing['2'],
          }}
        >
          {line}
        </ThemedText>
      </Animated.View>
      {Array.from({ length: rows }).map((_, i) => {
        const isBlock = i % 3 === 0;
        return (
          <Animated.View
            key={i}
            entering={itemEntering(i)}
            style={{
              height: isBlock ? 68 : 16,
              borderRadius: isBlock ? radius.lg : radius.full,
              backgroundColor: colors.surfaceContainer,
              borderColor: colors.border,
              borderWidth: isBlock ? 1 : 0,
              width: isBlock ? '100%' : (`${85 - (i % 4) * 12}%` as `${number}%`),
              overflow: 'hidden',
            }}
          >
            <ShimmerBand sweep={sweep} highlight={colors.surfaceContainerHigh} offset={i * 0.06} />
          </Animated.View>
        );
      })}
    </Animated.View>
  );
}

function ShimmerBand({
  sweep,
  highlight,
  offset,
}: {
  sweep: SharedValue<number>;
  highlight: string;
  offset: number;
}) {
  const style = useAnimatedStyle(() => {
    const t = (sweep.value + offset) % 1;
    return {
      opacity: interpolate(t, [0, 0.5, 1], [0, 0.9, 0]),
      transform: [{ translateX: interpolate(t, [0, 1], [-160, 420]) }, { skewX: '-18deg' }],
    };
  });
  return <Animated.View pointerEvents="none" style={[styles.shimmer, { backgroundColor: highlight }, style]} />;
}

type FadeInContentProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function FadeInContent({ children, style }: FadeInContentProps) {
  return (
    <Animated.View entering={pageEntering()} style={[{ flex: 1 }, style]}>
      {children}
    </Animated.View>
  );
}

type SoftRefreshProps = {
  active: boolean;
};

export function SoftRefreshBar({ active }: SoftRefreshProps) {
  if (!active) return null;
  return (
    <View
      pointerEvents="none"
      style={styles.refreshOverlay}
      accessibilityLabel="Refreshing"
    />
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOrb: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    marginBottom: 4,
  },
  emptyTitle: {
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  emptyMessage: {
    textAlign: 'center',
    maxWidth: 280,
  },
  compactError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginVertical: 6,
    borderWidth: 1,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 90,
  },
  refreshOverlay: {
    position: 'absolute',
    width: 0,
    height: 0,
    opacity: 0,
  },
});
