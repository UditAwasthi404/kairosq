import { useAuth, useUser } from '@clerk/expo';
import { MaterialIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';

import { ThemedText } from '../../../components/ThemedText';
import { EmptyState, ErrorState, LoadingSkeleton } from '../../../components/ui/EmptyState';
import { SurfaceCard } from '../../../components/ui/SectionHeader';
import { Badge } from '../../../components/ui/MetricCard';
import { CaptureHeatmap, CaptureHistogram } from '../../../components/ui/CaptureCharts';
import { ThemedButton } from '../../../components/ui/ThemedButton';
import { AmbientBackground } from '../../../components/ui/system/AmbientBackground';
import { InsightCard as SuggestionCard } from '../../../components/ui/system/InsightCard';
import { FLOATING_TAB_BAR_CONTENT } from '../../../components/FloatingTabBar';
import {
  fetchDailyBrief,
  fetchDashboard,
  fetchObservationsPage,
  fetchPredictions,
  fetchTodayInsight,
  observationStageLabel,
  observationStatusLabel,
  type ApiObservation,
  type DailyBrief,
  type DashboardSummary,
  type PredictionsSummary,
  type TodayInsight,
} from '../../../lib/api';
import { useAppTheme } from '../../../providers/ThemeProvider';
import { useProgression } from '../../../providers/ProgressionProvider';
import { TabScreenSwipe } from '../../../components/TabScreenSwipe';
import { NetworkErrorScreen } from '../../../components/ui/NetworkStatus';
import { dedupeRequest, readQueryCache, writeQueryCache } from '../../../hooks/useAsync';
import { isStale } from '../../../lib/freshness';
import { onReconnect, useNetworkStatus } from '../../../lib/network';
import { Breathe, CountUp, DotBurst, PressScale, ProgressRing, itemEntering } from '../../../components/ui/Motion';
import { Mascot } from '../../../components/ui/system/Mascot';
import { ActionArt, type ActionArtId } from '../../../components/home/ActionArt';
import { dailyReflection, greetingFor, paceState, streakNudge } from '../../../lib/engagement';

/** Shared with the Dashboard / Brief / Predictions / Today screens so either side warms the other. */
const CACHE = {
  dashboard: 'dashboard',
  brief: 'brief',
  predictions: 'predictions',
  insight: 'today-insight',
  memories: 'today:memories',
} as const;
const FOCUS_REFRESH_MS = 30_000;

function withoutExtractedText(observation: ApiObservation): ApiObservation {
  return { ...observation, extractedText: null };
}

const HOME_ACTIONS: Array<{ id: ActionArtId; label: string; route: string }> = [
  { id: 'ask', label: 'Ask', route: '/(app)/(tabs)/ask' },
  { id: 'search', label: 'Search', route: '/(app)/search' },
  { id: 'recall', label: 'Recall', route: '/(app)/screen-memory' },
  { id: 'projects', label: 'Projects', route: '/(app)/projects' },
  { id: 'timeline', label: 'Timeline', route: '/(app)/timeline' },
];

const MEMORY_TYPE_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  TEXT: 'edit-note',
  DOCUMENT: 'description',
  PDF: 'picture-as-pdf',
  IMAGE: 'image',
  AUDIO: 'mic',
};

const PREDICTION_LABEL = {
  revisit: 'REVISIT',
  focus: 'FOCUS',
  emerging: 'EMERGING PATTERN',
  next: 'NEXT STEP',
} as const;

export default function TodayScreen() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, radius } = useAppTheme();
  const { progression } = useProgression();
  const { online } = useNetworkStatus();
  const [dashboard, setDashboard] = useState(() => readQueryCache<DashboardSummary>(CACHE.dashboard));
  const [brief, setBrief] = useState(() => readQueryCache<DailyBrief>(CACHE.brief));
  const [todayInsight, setTodayInsight] = useState(() => readQueryCache<TodayInsight>(CACHE.insight));
  const [predictions, setPredictions] = useState(() => readQueryCache<PredictionsSummary>(CACHE.predictions));
  const [memories, setMemories] = useState<ApiObservation[]>(() => readQueryCache<ApiObservation[]>(CACHE.memories) ?? []);
  const [rawErrors, setErrors] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(() => !dashboard && !brief && !predictions);
  const [refreshing, setRefreshing] = useState(false);
  const lastLoadedAt = useRef(0);

  const load = useCallback(async () => {
    lastLoadedAt.current = Date.now();
    try {
      const token = await getToken();
      if (!token) return;
      const [dash, daily, predicted, insight, recent] = await Promise.allSettled([
        dedupeRequest(CACHE.dashboard, () => fetchDashboard(token)),
        dedupeRequest(CACHE.brief, () => fetchDailyBrief(token)),
        dedupeRequest(CACHE.predictions, () => fetchPredictions(token)),
        dedupeRequest(CACHE.insight, () => fetchTodayInsight(token)),
        fetchObservationsPage(token, { limit: 8 }),
      ]);
      const failed = (result: PromiseSettledResult<unknown>, key: string) =>
        result.status === 'rejected' && readQueryCache(key) == null;
      setErrors({
        dashboard: failed(dash, CACHE.dashboard),
        brief: failed(daily, CACHE.brief),
        predictions: failed(predicted, CACHE.predictions),
        insight: failed(insight, CACHE.insight),
        memories: failed(recent, CACHE.memories),
      });
      if (dash.status === 'fulfilled') { setDashboard(dash.value); writeQueryCache(CACHE.dashboard, dash.value); }
      if (daily.status === 'fulfilled') { setBrief(daily.value); writeQueryCache(CACHE.brief, daily.value); }
      if (predicted.status === 'fulfilled') { setPredictions(predicted.value); writeQueryCache(CACHE.predictions, predicted.value); }
      if (insight.status === 'fulfilled') { setTodayInsight(insight.value); writeQueryCache(CACHE.insight, insight.value); }
      if (recent.status === 'fulfilled') {
        const items = recent.value.items.map(withoutExtractedText);
        setMemories(items);
        writeQueryCache(CACHE.memories, items);
      }
    } catch {
      setErrors({
        dashboard: !readQueryCache(CACHE.dashboard),
        brief: !readQueryCache(CACHE.brief),
        predictions: !readQueryCache(CACHE.predictions),
        insight: !readQueryCache(CACHE.insight),
        memories: !readQueryCache(CACHE.memories),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken]);

  useFocusEffect(useCallback(() => {
    if (isStale(lastLoadedAt.current || null, FOCUS_REFRESH_MS)) void load();
  }, [load]));
  useEffect(() => onReconnect(() => void load()), [load]);

  const firstName = user?.firstName || user?.fullName?.split(' ')[0] || 'Friend';
  const greeting = greetingFor();
  const reflection = dailyReflection();
  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const errors: Record<string, boolean> = online ? rawErrors : { memories: rawErrors.memories };

  if (loading && !dashboard && !brief && !predictions) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <LoadingSkeleton rows={6} label="Kairos is preparing your day…" />
      </View>
    );
  }

  if (!online && !dashboard && !brief && !predictions && memories.length === 0) {
    return (
      <NetworkErrorScreen
        onRetry={() => void load()}
        onCapture={() => router.push('/(app)/quick-capture')}
      />
    );
  }

  const todayProgress = dashboard?.habit.todayProgress ?? memories.length;
  const dailyGoal = dashboard?.habit.dailyGoal ?? 5;
  const streakDays = dashboard?.streak.current ?? progression?.currentStreak ?? 0;
  const capturedToday = dashboard?.streak.capturedToday ?? todayProgress > 0;
  const insightMessage = (todayInsight && !todayInsight.empty ? todayInsight.body : brief?.noticed.body) || '';
  const pace = paceState(todayProgress, dailyGoal);
  const nudge = streakNudge(streakDays, capturedToday);
  const settling = memories.filter((memory) => !['COMPLETED', 'FAILED'].includes(memory.status));
  const todayIndex = dashboard?.habit.week ? dashboard.habit.week.length - 1 : -1;
  const openCapture = (prompt?: string) =>
    router.push(prompt ? { pathname: '/(app)/quick-capture', params: { prompt } } : '/(app)/quick-capture');

  return (
    <TabScreenSwipe>
      <AmbientBackground>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + FLOATING_TAB_BAR_CONTENT + 32,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <Animated.View entering={itemEntering(0)} style={styles.header}>
          <View style={styles.headerCopy}>
            <View style={styles.greetingRow}>
              <Text style={[styles.kicker, { color: colors.textMuted }]}>{greeting}</Text>
            </View>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {firstName}
            </Text>
            <Text style={[styles.dateLine, { color: colors.textSecondary }]}>{todayLabel}</Text>
          </View>
          <PressScale
            onPress={() => router.push('/(app)/progress')}
            accessibilityLabel={
              progression ? `Level ${progression.level}. View progress and streaks` : 'View progress and streaks'
            }
            style={[
              styles.progressButton,
              { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radius.md },
            ]}
          >
            {progression ? (
              <ProgressRing
                size={40}
                stroke={3}
                progress={progression.progress}
                color={colors.primary}
                track={colors.surfaceContainer}
                delay={500}
              >
                <Text style={[styles.levelText, { color: colors.text }]}>{progression.level}</Text>
              </ProgressRing>
            ) : (
              <MaterialIcons name="emoji-events" size={20} color={colors.primary} />
            )}
          </PressScale>
        </Animated.View>

        <Animated.View
          entering={itemEntering(1)}
          accessibilityRole="summary"
          accessibilityLabel={`${todayProgress} of ${dailyGoal} captured today, ${streakDays} day streak. ${pace.message}`}
          style={[
            styles.hero,
            {
              backgroundColor: colors.surface,
              borderColor: pace.reached ? colors.borderAccent : colors.border,
              borderRadius: radius.xl,
            },
          ]}
        >
          <View style={styles.heroTop}>
            <View>
              {pace.reached ? <DotBurst key={`burst-${todayProgress}`} color={colors.primary} size={150} /> : null}
              <ProgressRing
                size={84}
                stroke={7}
                progress={pace.ratio}
                color={colors.primary}
                track={colors.surfaceContainer}
              >
                <CountUp value={todayProgress} style={[styles.ringValue, { color: colors.text }]} />
              </ProgressRing>
            </View>
            <View style={styles.heroCopy}>
              <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>of {dailyGoal} today</Text>
              <Text style={[styles.heroNote, { color: pace.reached ? colors.primary : colors.textMuted }]}>
                {pace.message}
              </Text>
            </View>
            <View style={[styles.metricRule, { backgroundColor: colors.border }]} />
            <View style={styles.streak}>
              <View style={styles.streakValueRow}>
                <CountUp value={streakDays} style={[styles.streakValue, { color: colors.text }]} />
                <Breathe active={nudge.tone === 'keep'} amount={0.14} period={1800}>
                  <MaterialIcons
                    name="local-fire-department"
                    size={22}
                    color={capturedToday && streakDays > 0 ? colors.primary : colors.textMuted}
                  />
                </Breathe>
              </View>
              <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>day streak</Text>
            </View>
          </View>

          <PressScale
            onPress={() => (nudge.tone === 'keep' || nudge.tone === 'start' ? openCapture() : router.push('/(app)/progress'))}
            accessibilityLabel={`${nudge.title}. ${nudge.detail}`}
            style={[
              styles.nudge,
              {
                backgroundColor: nudge.tone === 'keep' ? colors.primaryContainer : colors.surfaceContainerLow,
                borderRadius: radius.md,
              },
            ]}
          >
            <Mascot
              state={nudge.tone === 'milestone' ? 'celebrating' : nudge.tone === 'safe' ? 'happy' : 'idle'}
              size={24}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.nudgeTitle, { color: nudge.tone === 'keep' ? colors.primary : colors.text }]}>
                {nudge.title}
              </Text>
              <Text style={[styles.nudgeDetail, { color: colors.textSecondary }]}>{nudge.detail}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
          </PressScale>

          {dashboard?.habit.week ? (
            <View style={styles.weekDotsRow}>
              {dashboard.habit.week.map((day, index) => {
                const isToday = index === todayIndex;
                const dot = (
                  <View
                    style={[
                      styles.dayDot,
                      {
                        backgroundColor: day.done ? colors.primary : colors.surfaceContainer,
                        borderColor: day.done || isToday ? colors.primary : colors.border,
                        borderWidth: isToday && !day.done ? 2 : 1,
                      },
                    ]}
                  />
                );
                return (
                  <View key={`${day.date}-${index}`} style={styles.dayDotCol}>
                    {isToday && !day.done ? <Breathe amount={0.2} period={2000}>{dot}</Breathe> : dot}
                    <Text
                      style={[
                        styles.dayLabel,
                        { color: day.done || isToday ? colors.text : colors.textMuted },
                        isToday && styles.dayLabelToday,
                      ]}
                    >
                      {day.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}
        </Animated.View>

        <Animated.View entering={itemEntering(2)}>
          <PressScale
            onPress={() => openCapture(reflection.prompt)}
            accessibilityLabel={`Daily reflection. ${reflection.prompt}`}
            style={[
              styles.reflection,
              { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radius.xl },
            ]}
          >
            <View style={styles.reflectionHead}>
              <View style={[styles.reflectionBadge, { backgroundColor: colors.primaryContainer, borderRadius: radius.full }]}>
                <MaterialIcons name="wb-twilight" size={14} color={colors.primary} />
                <Text style={[styles.reflectionBadgeText, { color: colors.primary }]}>TODAY’S REFLECTION</Text>
              </View>
            </View>
            <Text style={[styles.reflectionLead, { color: colors.textSecondary }]}>{reflection.lead}</Text>
            <Text style={[styles.reflectionPrompt, { color: colors.text }]}>{reflection.prompt}</Text>
            <View style={styles.reflectionCta}>
              <Text style={[styles.reflectionCtaText, { color: colors.primary }]}>Answer in a line</Text>
              <MaterialIcons name="arrow-forward" size={16} color={colors.primary} />
            </View>
          </PressScale>
        </Animated.View>

        <Animated.View
          entering={itemEntering(3)}
          style={[
            styles.actionBand,
            { backgroundColor: colors.primaryContainer, borderColor: colors.borderAccent, borderWidth: 1, borderRadius: radius.xl },
          ]}
        >
          <ThemedButton
            label="Capture"
            icon={<ActionArt id="capture" size={22} color={colors.buttonText} accent={colors.buttonText} />}
            onPress={() => openCapture()}
          />
          <View style={styles.shortcutRow}>
            {HOME_ACTIONS.map((action) => (
              <PressScale
                key={action.id}
                onPress={() => router.push(action.route as never)}
                accessibilityLabel={action.label}
                style={styles.shortcut}
              >
                <View
                  style={[
                    styles.shortcutIcon,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.primary,
                      borderRadius: radius.full,
                    },
                  ]}
                >
                  <ActionArt id={action.id} size={26} color={colors.text} accent={colors.primary} />
                </View>
                <Text style={[styles.shortcutLabel, { color: colors.text }]} numberOfLines={1}>
                  {action.label}
                </Text>
              </PressScale>
            ))}
          </View>
        </Animated.View>

        {insightMessage ? (
          <View style={styles.sectionPad}>
            <SuggestionCard message={insightMessage} onPress={() => router.push('/(app)/brief')} />
          </View>
        ) : null}

        {dashboard?.heatmap?.length ? (
          <View style={styles.sectionPad}>
            <View style={styles.sectionHeadRow}>
              <ThemedText colorKey="text" style={styles.sectionHeaderTitle}>
                Rhythm
              </ThemedText>
              <Pressable
                onPress={() => router.push('/(app)/insights')}
                accessibilityRole="button"
                accessibilityLabel="Open insights"
                hitSlop={8}
              >
                <ThemedText colorKey="primary" style={styles.seeAllText}>
                  Insights
                </ThemedText>
              </Pressable>
            </View>
            <View style={styles.chartStack}>
              <CaptureHeatmap days={dashboard.heatmap} />
              <CaptureHistogram days={dashboard.heatmap} />
            </View>
          </View>
        ) : null}

        {brief && (brief.attentionTopics.length > 0 || brief.revisit) ? (
          <View style={styles.sectionBlock}>
            <SurfaceCard elevated style={styles.insightCard}>
              {brief.attentionTopics.length > 0 ? (
                <View style={styles.attentionRow}>
                  <ThemedText colorKey="textMuted" style={styles.attentionLabel}>
                    On your mind
                  </ThemedText>
                  {brief.attentionTopics.slice(0, 3).map((topic) => (
                    <Pressable
                      key={topic.id || topic.name}
                      onPress={() => router.push(topic.id ? `/(app)/topics/${topic.id}` : '/(app)/topics')}
                      accessibilityRole="button"
                      accessibilityLabel={topic.name}
                      style={[
                        styles.attentionChip,
                        { backgroundColor: colors.primaryContainer, borderRadius: radius.full },
                      ]}
                    >
                      <Text style={[styles.attentionChipText, { color: colors.primary }]}>{topic.name}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {brief.revisit ? (
                <Pressable
                  onPress={() =>
                    router.push(
                      brief.revisit?.observationId
                        ? `/(app)/observation/${brief.revisit.observationId}`
                        : '/(app)/predictions',
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Revisit ${brief.revisit.title}`}
                  style={[styles.revisitBox, { borderColor: colors.border }]}
                >
                  <View style={styles.revisitHeader}>
                    <MaterialIcons name="replay" size={16} color={colors.primary} />
                    <ThemedText colorKey="text" style={styles.revisitTitle}>
                      Revisit · {brief.revisit.title}
                    </ThemedText>
                  </View>
                  <ThemedText colorKey="textSecondary" style={styles.revisitWhy}>
                    {brief.revisit.why}
                  </ThemedText>
                </Pressable>
              ) : null}
            </SurfaceCard>
          </View>
        ) : errors.brief ? (
          <ErrorState compact title="Daily brief unavailable" onRetry={() => void load()} />
        ) : null}

        {predictions?.items[0] ? (
          <View style={styles.sectionBlock}>
            <SurfaceCard style={{ borderColor: colors.borderAccent }}>
              <Badge label={PREDICTION_LABEL[predictions.items[0].kind]} tone="accent" />
              <ThemedText colorKey="text" style={styles.predictionTitle}>
                {predictions.items[0].title}
              </ThemedText>
              <ThemedText colorKey="textSecondary" style={styles.predictionWhy}>
                {predictions.items[0].why}
              </ThemedText>
            </SurfaceCard>
          </View>
        ) : null}

        {settling.length > 0 ? (
          <View style={styles.sectionBlock}>
            <SurfaceCard style={{ borderColor: colors.borderActive }}>
              <View style={styles.settlingHead}>
                <MaterialIcons name="sync" size={18} color={colors.primary} />
                <ThemedText colorKey="text" style={styles.settlingTitle}>
                  Connecting the dots…
                </ThemedText>
              </View>
              {settling.map((memory) => (
                <Pressable
                  key={memory.id}
                  onPress={() => router.push(`/(app)/observation/${memory.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${memory.filename}`}
                  style={[styles.memoryRow, { backgroundColor: colors.surfaceContainer }]}
                >
                  <ThemedText colorKey="text" style={styles.memoryTitle} numberOfLines={1}>
                    {memory.filename}
                  </ThemedText>
                  <Badge
                    label={observationStageLabel(memory) || observationStatusLabel(memory.status)}
                    tone="accent"
                  />
                </Pressable>
              ))}
            </SurfaceCard>
          </View>
        ) : null}

        <View style={styles.sectionHeadRowPadded}>
          <ThemedText colorKey="text" style={styles.sectionHeaderTitle}>
            Recent
          </ThemedText>
          <Pressable
            onPress={() => router.push('/(app)/timeline')}
            accessibilityRole="button"
            accessibilityLabel="See all memories"
            hitSlop={8}
          >
            <ThemedText colorKey="primary" style={styles.seeAllText}>
              See all
            </ThemedText>
          </Pressable>
        </View>

        {errors.memories && memories.length === 0 ? (
          <ErrorState compact title="Memories unavailable" onRetry={() => void load()} />
        ) : memories.length === 0 ? (
          <EmptyState
            title="Your memory is still growing"
            message="Start capturing moments, thoughts, or links, and Kairos will build understanding from there."
            actionLabel="Capture something"
            onAction={() => openCapture()}
          />
        ) : (
          <View style={styles.memoriesList}>
            {memories.slice(0, 6).map((memory, index) => {
              const iconName = MEMORY_TYPE_ICONS[memory.type] ?? 'edit-note';
              return (
                <Animated.View key={memory.id} entering={itemEntering(index + 4)}>
                <PressScale
                  onPress={() => router.push(`/(app)/observation/${memory.id}`)}
                  accessibilityLabel={`Open memory ${memory.filename}`}
                >
                  <View
                    style={[
                      styles.memoryCardItem,
                      {
                        backgroundColor: colors.surfaceElevated,
                        borderColor: colors.border,
                        borderRadius: radius.lg,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.memIconBubble,
                        { backgroundColor: colors.surfaceContainer, borderRadius: radius.md },
                      ]}
                    >
                      <MaterialIcons name={iconName} size={20} color={colors.textSecondary} />
                    </View>
                    <View style={styles.memoryCopy}>
                      <ThemedText colorKey="text" style={styles.memoryTitle} numberOfLines={1}>
                        {memory.filename}
                      </ThemedText>
                      <ThemedText colorKey="textSecondary" numberOfLines={2} style={styles.memorySnippet}>
                        {memory.summary || memory.sourceLabel || memory.type}
                      </ThemedText>
                    </View>
                    <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} />
                  </View>
                </PressScale>
                </Animated.View>
              );
            })}
          </View>
        )}

        <Pressable
          onPress={() => router.push('/(app)/dashboard')}
          accessibilityRole="button"
          accessibilityLabel="Open dashboard"
          style={styles.dashboardLink}
        >
          <ThemedText colorKey="textSecondary" style={styles.dashboardLinkText}>
            Open the full dashboard
          </ThemedText>
          <MaterialIcons name="arrow-forward" size={16} color={colors.textSecondary} />
        </Pressable>
      </ScrollView>
      </AmbientBackground>
    </TabScreenSwipe>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    marginBottom: 44,
    gap: 16,
  },
  headerCopy: { flex: 1, gap: 2 },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kicker: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 16,
  },
  name: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 42,
    lineHeight: 50,
    letterSpacing: -0.6,
  },
  dateLine: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 17,
  },
  progressButton: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginTop: 4,
  },
  levelText: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 14,
  },
  hero: {
    marginHorizontal: 28,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 20,
    gap: 22,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ringValue: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.6,
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  heroLabel: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 17,
  },
  heroNote: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 16,
    lineHeight: 22,
  },
  metricRule: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: 6,
  },
  streak: {
    alignItems: 'flex-start',
    gap: 2,
    minWidth: 72,
  },
  streakValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  streakValue: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -0.6,
  },
  nudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  nudgeTitle: {
    fontFamily: 'Roboto_600SemiBold',
    fontSize: 16,
  },
  nudgeDetail: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 14,
    marginTop: 1,
  },
  dayLabelToday: {
    fontFamily: 'Roboto_700Bold',
  },
  reflection: {
    marginHorizontal: 28,
    marginTop: 24,
    borderWidth: 1,
    padding: 20,
    gap: 8,
  },
  reflectionHead: {
    flexDirection: 'row',
  },
  reflectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  reflectionBadgeText: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  reflectionLead: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 15,
    lineHeight: 21,
    marginTop: 4,
  },
  reflectionPrompt: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 22,
    lineHeight: 30,
    letterSpacing: -0.2,
  },
  reflectionCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  reflectionCtaText: {
    fontFamily: 'Roboto_600SemiBold',
    fontSize: 15,
  },
  weekDotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayDotCol: {
    alignItems: 'center',
    gap: 4,
  },
  dayDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
  },
  dayLabel: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 13,
  },
  actionBand: {
    marginHorizontal: 28,
    marginTop: 24,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 20,
    gap: 20,
  },
  shortcutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  shortcut: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  shortcutIcon: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  shortcutLabel: {
    fontFamily: 'Roboto_600SemiBold',
    fontSize: 13,
  },
  sectionPad: {
    marginHorizontal: 28,
    marginTop: 48,
  },
  sectionHeadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionHeadRowPadded: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 28,
    marginTop: 48,
    marginBottom: 20,
  },
  sectionHeaderTitle: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 24,
    letterSpacing: -0.2,
  },
  seeAllText: {
    fontFamily: 'Roboto_600SemiBold',
    fontSize: 16,
  },
  chartStack: {
    gap: 28,
  },
  sectionBlock: {
    marginHorizontal: 28,
    marginTop: 44,
  },
  insightCard: {
    gap: 10,
  },
  attentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  attentionLabel: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 16,
  },
  attentionChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  attentionChipText: {
    fontFamily: 'Roboto_600SemiBold',
    fontSize: 15,
  },
  revisitBox: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    gap: 4,
    marginTop: 4,
  },
  revisitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  revisitTitle: {
    fontFamily: 'Roboto_600SemiBold',
    fontSize: 17,
    flex: 1,
  },
  revisitWhy: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 16,
    lineHeight: 22,
  },
  predictionTitle: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 20,
    marginTop: 4,
  },
  predictionWhy: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 16,
    lineHeight: 24,
  },
  settlingHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  settlingTitle: {
    fontFamily: 'Roboto_600SemiBold',
    fontSize: 18,
  },
  memoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 22,
    marginVertical: 3,
    gap: 8,
  },
  memoriesList: {
    paddingHorizontal: 28,
    gap: 22,
  },
  memoryCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  memIconBubble: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memoryCopy: {
    flex: 1,
    gap: 2,
  },
  memoryTitle: {
    fontFamily: 'Roboto_600SemiBold',
    fontSize: 18,
  },
  memorySnippet: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 16,
    lineHeight: 22,
  },
  dashboardLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 48,
    paddingVertical: 12,
  },
  dashboardLinkText: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 16,
  },
});
