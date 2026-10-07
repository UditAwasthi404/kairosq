import { useAuth } from '@clerk/expo';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ThemedText } from '../../components/ThemedText';
import { CaptureHeatmap, CaptureHistogram } from '../../components/ui/CaptureCharts';
import {
  ActivityHistogram,
  HabitCard,
  ShareBars,
  StatGrid,
  StreakCard,
} from '../../components/ui/DashboardFigures';
import {
  EmptyState,
  ErrorState,
  FadeInContent,
  LoadingSkeleton,
  SoftRefreshBar,
} from '../../components/ui/EmptyState';
import { AccentGradient, GlassPanel } from '../../components/ui/Glass';
import { InsightCard } from '../../components/ui/InsightCard';
import { ListRow } from '../../components/ui/ListRow';
import { PressScale } from '../../components/ui/Motion';
import { SoftPage, SoftTitle } from '../../components/ui/SoftScreen';
import { HeroStatusWidget } from '../../components/ui/system/HeroStatusWidget';
import { InsightCard as SuggestionCard } from '../../components/ui/system/InsightCard';
import { useAsync } from '../../hooks/useAsync';
import { fetchDashboard } from '../../lib/api';
import { paceState } from '../../lib/engagement';
import { useAppTheme } from '../../providers/ThemeProvider';

export default function DashboardScreen() {
  const router = useRouter();
  const { radius } = useAppTheme();
  const { getToken } = useAuth();
  const { data, error, loading, refreshing, reload } = useAsync(async () => {
    const token = await getToken();
    if (!token) throw new Error('Sign in required');
    return fetchDashboard(token);
  }, [getToken], { cacheKey: 'dashboard' });

  if (loading && !data) return <LoadingSkeleton rows={8} label="Tallying your memories" />;
  if (error && !data) {
    return <ErrorState title="Unable to load" onRetry={reload} />;
  }
  if (!data) {
    return (
      <SoftPage>
        <EmptyState
          title="No memories yet"
          actionLabel="Capture something"
          onAction={() => router.push('/(app)/quick-capture')}
        />
      </SoftPage>
    );
  }

  return (
    <FadeInContent>
      <SoftRefreshBar active={refreshing} />
      <SoftPage>
        <SoftTitle>{data.greeting}</SoftTitle>
        <HeroStatusWidget
          value={String(data.todayCount)}
          label="Captured today"
          subtitle={data.daySummary}
          progress={data.habit.todayProgress / Math.max(1, data.habit.dailyGoal)}
          secondaryValue={String(data.streak.current)}
          secondaryLabel="day streak"
          mascot={data.habit.todayProgress >= data.habit.dailyGoal ? 'celebrating' : 'idle'}
        />
        {data.insight?.body ? (
          <SuggestionCard
            message={data.insight.body}
            onPress={() => router.push('/(app)/brief')}
          />
        ) : null}
        <ThemedText colorKey="textSecondary" style={styles.day}>
          {paceState(data.habit.todayProgress, data.habit.dailyGoal).message}
        </ThemedText>
        <ThemedText colorKey="textMuted" style={styles.dayMeta}>
          {data.weekCount} this week · {data.totalCount} remembered
        </ThemedText>

        <StreakCard
          streak={data.streak}
          onCapture={() => router.push('/(app)/quick-capture')}
        />

        <StatGrid
          items={[
            { label: 'Today', value: String(data.todayCount) },
            { label: 'This week', value: String(data.weekCount) },
            { label: 'All time', value: String(data.totalCount) },
          ]}
        />

        <HabitCard habit={data.habit} />
        <CaptureHeatmap days={data.heatmap} />
        <CaptureHistogram days={data.heatmap} />
        <ActivityHistogram days={data.activity} />

        <ShareBars
          title="How you capture"
          items={data.sources.map((source) => ({
            id: source.source,
            label: source.label,
            count: source.count,
          }))}
        />

        <ShareBars
          title="What’s emerging"
          items={data.topics.map((topic) => ({
            id: topic.id,
            label: topic.name,
            count: topic.observationCount,
          }))}
          onPressItem={(id) => router.push(`/(app)/topics/${id}`)}
        />

        <InsightCard
          insight={data.insight}
          onExplore={() => router.push('/(app)/insight')}
        />

        <ThemedText colorKey="textMuted" style={styles.section}>
          Recently remembered
        </ThemedText>
        {data.recent.length === 0 ? (
          <EmptyState
            icon="history"
            title="Your recent memories land here"
            actionLabel="Capture something"
            onAction={() => router.push('/(app)/quick-capture')}
          />
        ) : (
          data.recent.map((item, index) => (
            <ListRow
              key={item.id}
              title={item.filename}
              subtitle={`${item.sourceLabel}${item.summary ? ` · ${item.summary}` : ''}`}
              index={index}
              onPress={() => router.push(`/(app)/observation/${item.id}`)}
            />
          ))
        )}

        {data.processingCount > 0 ? (
          <PressScale
            onPress={() => {
              void Haptics.selectionAsync();
              router.push('/(app)/activity');
            }}
            accessibilityLabel="Current activity"
          >
            <GlassPanel>
              <ThemedText colorKey="textMuted" style={styles.kicker}>
                Current activity
              </ThemedText>
              <ThemedText colorKey="text" style={styles.recentTitle}>
                {data.processingCount} {data.processingCount === 1 ? 'memory' : 'memories'} still settling
              </ThemedText>
            </GlassPanel>
          </PressScale>
        ) : null}

        <PressScale
          onPress={() => {
            void Haptics.selectionAsync();
            router.push('/(app)/(tabs)/ask');
          }}
          accessibilityLabel="Ask Kairos"
        >
          <AccentGradient style={[styles.askCard, { borderRadius: radius.xl }]}>
            <ThemedText colorKey="inverseText" style={styles.askTitle}>
              Ask Kairos
            </ThemedText>
            <ThemedText colorKey="inverseText" style={styles.askHint}>
              What was I working on…
            </ThemedText>
          </AccentGradient>
        </PressScale>
      </SoftPage>
    </FadeInContent>
  );
}

const styles = StyleSheet.create({
  day: { fontFamily: 'Roboto_500Medium', fontSize: 15 },
  dayMeta: { fontFamily: 'Roboto_400Regular', fontSize: 13, marginBottom: 4 },
  section: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  kicker: { fontFamily: 'Roboto_500Medium', fontSize: 13, marginBottom: 6 },
  recentTitle: { fontFamily: 'Roboto_500Medium', fontSize: 15 },
  askCard: { paddingHorizontal: 20, paddingVertical: 18, gap: 4 },
  askTitle: { fontFamily: 'Roboto_600SemiBold', fontSize: 17 },
  askHint: { fontFamily: 'Roboto_400Regular', fontSize: 14, opacity: 0.86 },
});
