import { useAuth } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { CaptureHeatmap, CaptureHistogram } from '../../components/ui/CaptureCharts';
import { ThemedText } from '../../components/ThemedText';
import { ErrorState, LoadingSkeleton } from '../../components/ui/EmptyState';
import { SurfaceCard } from '../../components/ui/SectionHeader';
import { SoftPage } from '../../components/ui/SoftScreen';
import { CountUp, PressScale } from '../../components/ui/Motion';
import { fetchDashboard, type DashboardSummary } from '../../lib/api';
import { useAppTheme } from '../../providers/ThemeProvider';

function ShareBar({ share, color, track, delay }: { share: number; color: string; track: string; delay: number }) {
  const width = useSharedValue(0);
  useEffect(() => {
    width.value = withDelay(delay, withTiming(Math.max(0.03, share), { duration: 800, easing: Easing.out(Easing.cubic) }));
  }, [delay, share, width]);
  const style = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));
  return (
    <View style={[styles.shareTrack, { backgroundColor: track }]}>
      <Animated.View style={[styles.shareFill, { backgroundColor: color }, style]} />
    </View>
  );
}

function records(data: DashboardSummary | null) {
  const days = (data?.heatmap ?? []).filter((day) => !day.future);
  const best = days.reduce<(typeof days)[number] | null>((top, day) => (!top || day.count > top.count ? day : top), null);
  return {
    longest: data?.streak.longest ?? 0,
    activeDays: days.filter((day) => day.count > 0).length,
    best: best && best.count > 0 ? best : null,
  };
}

export default function InsightsScreen() {
  const { getToken } = useAuth();
  const { colors } = useAppTheme();
  const router = useRouter();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const token = await getToken();
      if (token) setData(await fetchDashboard(token));
      else setError(true);
    } catch { setError(true); }
    finally { setLoading(false); }
  }, [getToken]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (loading && !data) return <LoadingSkeleton rows={5} />;
  if (error && !data) return <ErrorState title="Insights unavailable" onRetry={() => void load()} />;

  const total = (data?.sources ?? []).reduce((acc, s) => acc + s.count, 0);
  const sources = (data?.sources ?? []).filter((source) => source.count > 0).sort((a, b) => b.count - a.count);
  const rec = records(data);

  return (
    <SoftPage>
      {/* Summary stats row */}
      <View style={styles.summaryRow}>
        <SurfaceCard style={styles.summaryChip}>
          <CountUp value={data?.weekCount ?? 0} style={[styles.summaryValue, { color: colors.text }]} />
          <ThemedText colorKey="textMuted" style={styles.summaryLabel}>This week</ThemedText>
        </SurfaceCard>
        <SurfaceCard style={styles.summaryChip}>
          <CountUp value={data?.todayCount ?? 0} style={[styles.summaryValue, { color: colors.text }]} />
          <ThemedText colorKey="textMuted" style={styles.summaryLabel}>Today</ThemedText>
        </SurfaceCard>
        <SurfaceCard style={styles.summaryChip}>
          <CountUp value={data?.totalCount ?? total} style={[styles.summaryValue, { color: colors.text }]} />
          <ThemedText colorKey="textMuted" style={styles.summaryLabel}>Total</ThemedText>
        </SurfaceCard>
      </View>

      <SurfaceCard style={styles.card}>
        <ThemedText colorKey="text" style={styles.cardTitle}>Personal records</ThemedText>
        <View style={styles.recordRow}>
          <Feather name="zap" size={16} color={colors.primary} />
          <ThemedText colorKey="textSecondary" style={styles.recordLabel}>Longest streak</ThemedText>
          <ThemedText colorKey="text" style={styles.recordValue}>
            {rec.longest} {rec.longest === 1 ? 'day' : 'days'}
          </ThemedText>
        </View>
        <View style={styles.recordRow}>
          <Feather name="calendar" size={16} color={colors.textSecondary} />
          <ThemedText colorKey="textSecondary" style={styles.recordLabel}>Active days, 12 weeks</ThemedText>
          <ThemedText colorKey="text" style={styles.recordValue}>{rec.activeDays}</ThemedText>
        </View>
        {rec.best ? (
          <View style={styles.recordRow}>
            <Feather name="trending-up" size={16} color={colors.textSecondary} />
            <ThemedText colorKey="textSecondary" style={styles.recordLabel}>Best day</ThemedText>
            <ThemedText colorKey="text" style={styles.recordValue}>
              {rec.best.count} on{' '}
              {new Date(`${rec.best.date.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </ThemedText>
          </View>
        ) : null}
      </SurfaceCard>

      <ThemedText colorKey="textMuted" style={styles.lead}>
        A view of how your memory has grown over the last twelve weeks.
      </ThemedText>

      <CaptureHeatmap days={data?.heatmap ?? []} />
      <CaptureHistogram days={data?.heatmap ?? []} />

      {/* Sources breakdown */}
      <SurfaceCard style={styles.card}>
        <ThemedText colorKey="text" style={styles.cardTitle}>Where memories come from</ThemedText>
        {sources.map((source, index) => (
          <View key={source.source} style={styles.sourceBlock}>
            <View style={styles.sourceRow}>
              <ThemedText colorKey="text" style={styles.sourceLabel}>{source.label}</ThemedText>
              <ThemedText colorKey="textMuted" style={styles.sourceBadgeText}>
                {source.count} · {Math.round((source.count / Math.max(1, total)) * 100)}%
              </ThemedText>
            </View>
            <ShareBar
              share={source.count / Math.max(1, total)}
              color={index === 0 ? colors.primary : colors.textSecondary}
              track={colors.surfaceContainer}
              delay={200 + index * 90}
            />
          </View>
        ))}
        {sources.length === 0 ? (
          <ThemedText colorKey="textMuted" style={styles.emptyNote}>
            Sources will appear as you save memories.
          </ThemedText>
        ) : null}
      </SurfaceCard>

      {/* Nav links */}
      <View style={styles.navRow}>
        <PressScale
          onPress={() => router.push('/(app)/dashboard')}
          accessibilityLabel="Open full dashboard"
          style={[styles.navLink, { backgroundColor: colors.primaryContainer }]}
        >
          <Feather name="bar-chart-2" size={16} color={colors.primary} />
          <ThemedText colorKey="primary" style={styles.navLinkText}>Full dashboard</ThemedText>
          <Feather name="chevron-right" size={16} color={colors.primary} style={{ marginLeft: 'auto' }} />
        </PressScale>
        <PressScale
          onPress={() => router.push('/(app)/activity')}
          accessibilityLabel="Open processing activity"
          style={[styles.navLink, { backgroundColor: colors.surfaceContainer }]}
        >
          <Feather name="activity" size={16} color={colors.textSecondary} />
          <ThemedText colorKey="text" style={styles.navLinkText}>Processing activity</ThemedText>
          <Feather name="chevron-right" size={16} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
        </PressScale>
      </View>
    </SoftPage>
  );
}

const styles = StyleSheet.create({
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryChip: { flex: 1, padding: 14, alignItems: 'center', gap: 2 },
  summaryValue: { fontFamily: 'Roboto_700Bold', fontSize: 22, letterSpacing: -0.3 },
  summaryLabel: { fontFamily: 'Roboto_500Medium', fontSize: 12 },
  lead: { fontFamily: 'Roboto_400Regular', fontSize: 14, lineHeight: 21 },
  card: { padding: 16, gap: 12 },
  cardTitle: { fontFamily: 'Roboto_700Bold', fontSize: 17 },
  recordRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  recordLabel: { fontFamily: 'Roboto_400Regular', fontSize: 14, flex: 1 },
  recordValue: { fontFamily: 'Roboto_600SemiBold', fontSize: 14 },
  sourceBlock: { gap: 6 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sourceLabel: { fontFamily: 'Roboto_500Medium', fontSize: 14, flex: 1 },
  sourceBadgeText: { fontFamily: 'Roboto_500Medium', fontSize: 13 },
  shareTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  shareFill: { height: '100%', borderRadius: 3 },
  emptyNote: { fontFamily: 'Roboto_400Regular', fontSize: 13, lineHeight: 18 },
  navRow: { gap: 8 },
  navLink: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 14 },
  navLinkText: { fontFamily: 'Roboto_600SemiBold', fontSize: 14 },
});
