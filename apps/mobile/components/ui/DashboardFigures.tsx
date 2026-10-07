import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import type {
  DashboardActivityDay,
  DashboardHabit,
  DashboardStreak,
} from '../../lib/api';
import { useAppTheme } from '../../providers/ThemeProvider';
import { ThemedText } from '../ThemedText';
import { AccentGradient, GlassPanel } from './Glass';

export function FigureKicker({ children }: { children: string }) {
  return (
    <ThemedText colorKey="textMuted" style={styles.kicker}>
      {children}
    </ThemedText>
  );
}

export function StreakCard({
  streak,
  onCapture,
}: {
  streak: DashboardStreak;
  onCapture: () => void;
}) {
  const { colors, radius } = useAppTheme();
  const headline =
    streak.current > 0
      ? `${streak.current} ${streak.current === 1 ? 'day' : 'days'} in a row`
      : 'Start a quiet streak';
  const hint = streak.capturedToday
    ? 'Today is already part of the run.'
    : streak.current > 0
      ? 'Capture once today to keep it going.'
      : 'One memory today begins the count.';

  return (
    <AccentGradient style={[styles.streakCard, { borderRadius: radius.xl }]}>
      <View style={styles.streakTop}>
        <View style={[styles.streakIcon, { backgroundColor: 'rgba(255,255,255,0.16)' }]}>
          <Feather name="zap" size={18} color={colors.inverseText} />
        </View>
        <ThemedText colorKey="inverseText" style={styles.streakEyebrow}>
          Capture streak
        </ThemedText>
      </View>
      <ThemedText colorKey="inverseText" style={styles.streakValue}>
        {streak.current}
      </ThemedText>
      <ThemedText colorKey="inverseText" style={styles.streakHeadline}>
        {headline}
      </ThemedText>
      <ThemedText colorKey="inverseText" style={styles.streakHint}>
        {hint}
        {streak.longest > 0 ? ` Longest: ${streak.longest}.` : ''}
      </ThemedText>
      {!streak.capturedToday ? (
        <Pressable
          onPress={onCapture}
          accessibilityRole="button"
          accessibilityLabel="Capture today"
          style={({ pressed }) => [
            styles.streakAction,
            { opacity: pressed ? 0.86 : 1 },
          ]}
        >
          <ThemedText colorKey="inverseText" style={styles.streakActionText}>
            Capture today
          </ThemedText>
        </Pressable>
      ) : null}
    </AccentGradient>
  );
}

export function HabitCard({ habit }: { habit: DashboardHabit }) {
  const { colors } = useAppTheme();
  const todayDone = habit.todayProgress >= habit.dailyGoal;
  const weekRatio =
    habit.weekGoalDays > 0
      ? Math.min(1, habit.weekDaysCompleted / habit.weekGoalDays)
      : 0;

  return (
    <GlassPanel>
      <FigureKicker>Daily capture habit</FigureKicker>
      <ThemedText colorKey="text" style={styles.habitTitle}>
        {todayDone ? 'Today is kept' : 'One memory today'}
      </ThemedText>
      <ThemedText colorKey="textMuted" style={styles.habitHint}>
        {habit.weekDaysCompleted} of {habit.weekGoalDays} days this week
      </ThemedText>
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.trackFill,
            {
              width: `${Math.max(6, weekRatio * 100)}%`,
              backgroundColor: colors.accent,
            },
          ]}
        />
      </View>
      <View style={styles.weekRow}>
        {habit.week.map((day, index) => (
          <View key={`${day.date}-${index}`} style={styles.weekItem}>
            <View
              style={[
                styles.weekDot,
                {
                  backgroundColor: day.done ? colors.accent : colors.surfaceContainerHigh,
                  borderColor: day.done ? colors.accent : colors.border,
                },
              ]}
            >
              {day.done ? (
                <Feather name="check" size={11} color={colors.inverseText} />
              ) : null}
            </View>
            <ThemedText colorKey="textMuted" style={styles.weekLabel}>
              {day.label}
            </ThemedText>
          </View>
        ))}
      </View>
    </GlassPanel>
  );
}

export function ActivityHistogram({
  days,
}: {
  days: DashboardActivityDay[];
}) {
  const { colors } = useAppTheme();
  if (days.length === 0) return null;
  const max = Math.max(1, ...days.map((day) => day.count));
  const total = days.reduce((sum, day) => sum + day.count, 0);

  return (
    <GlassPanel>
      <FigureKicker>Fourteen-day rhythm</FigureKicker>
      <ThemedText colorKey="text" style={styles.chartTitle}>
        {total} {total === 1 ? 'memory' : 'memories'} recently
      </ThemedText>
      <View
        style={styles.histogram}
        accessibilityRole="image"
        accessibilityLabel={`Capture histogram for the last ${days.length} days. ${total} memories.`}
      >
        {days.map((day, index) => {
          const height = day.count === 0 ? 4 : 18 + (day.count / max) * 72;
          const isToday = index === days.length - 1;
          return (
            <View key={day.date || index} style={styles.histCol}>
              <View
                style={[
                  styles.histBar,
                  {
                    height,
                    backgroundColor: isToday
                      ? colors.accent
                      : day.count > 0
                        ? colors.accentRose
                        : colors.surfaceContainerHigh,
                    opacity: day.count > 0 || isToday ? 1 : 0.7,
                  },
                ]}
              />
              <ThemedText colorKey="textMuted" style={styles.histLabel}>
                {day.label}
              </ThemedText>
            </View>
          );
        })}
      </View>
    </GlassPanel>
  );
}

export function ShareBars({
  title,
  items,
  onPressItem,
}: {
  title: string;
  items: Array<{ id: string; label: string; count: number }>;
  onPressItem?: (id: string) => void;
}) {
  const { colors } = useAppTheme();
  if (items.length === 0) return null;
  const max = Math.max(1, ...items.map((item) => item.count));

  return (
    <GlassPanel>
      <FigureKicker>{title}</FigureKicker>
      <View style={styles.barList}>
        {items.map((item) => {
          const row = (
            <View style={styles.barRow}>
              <View style={styles.barHead}>
                <ThemedText colorKey="text" style={styles.barLabel} numberOfLines={1}>
                  {item.label}
                </ThemedText>
                <ThemedText colorKey="textMuted" style={styles.barCount}>
                  {item.count}
                </ThemedText>
              </View>
              <View style={[styles.track, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.trackFill,
                    {
                      width: `${Math.max(8, (item.count / max) * 100)}%`,
                      backgroundColor: colors.accentPurple,
                    },
                  ]}
                />
              </View>
            </View>
          );
          if (!onPressItem) return <View key={item.id}>{row}</View>;
          return (
            <Pressable
              key={item.id}
              onPress={() => onPressItem(item.id)}
              accessibilityRole="button"
              accessibilityLabel={`${item.label}, ${item.count}`}
              style={({ pressed }) => [{ opacity: pressed ? 0.86 : 1 }]}
            >
              {row}
            </Pressable>
          );
        })}
      </View>
    </GlassPanel>
  );
}

export function StatGrid({
  items,
}: {
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <View style={styles.statGrid}>
      {items.map((item) => (
        <GlassPanel
          key={item.label}
          padded={false}
          style={styles.statCard}
          contentStyle={styles.statInner}
        >
          <ThemedText colorKey="text" style={styles.statValue}>
            {item.value}
          </ThemedText>
          <ThemedText colorKey="textMuted" style={styles.statLabel}>
            {item.label}
          </ThemedText>
        </GlassPanel>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  kicker: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  streakCard: { paddingHorizontal: 20, paddingVertical: 20, gap: 6 },
  streakTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  streakIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakEyebrow: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 12,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    opacity: 0.86,
  },
  streakValue: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 52,
    letterSpacing: -1.4,
    marginTop: 8,
    lineHeight: 58,
  },
  streakHeadline: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 20,
    letterSpacing: -0.3,
  },
  streakHint: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.86,
  },
  streakAction: {
    alignSelf: 'flex-start',
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  streakActionText: { fontFamily: 'Roboto_500Medium', fontSize: 13 },
  habitTitle: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 20,
    letterSpacing: -0.2,
  },
  habitHint: { fontFamily: 'Roboto_400Regular', fontSize: 13, marginTop: 4, marginBottom: 12 },
  track: { height: 8, borderRadius: 999, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 999 },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  weekItem: { alignItems: 'center', gap: 6, flex: 1 },
  weekDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekLabel: { fontFamily: 'Roboto_500Medium', fontSize: 11 },
  chartTitle: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 20,
    letterSpacing: -0.2,
    marginBottom: 16,
  },
  histogram: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 118,
  },
  histCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  histBar: { width: '78%', borderRadius: 7, minHeight: 4 },
  histLabel: { fontFamily: 'Roboto_500Medium', fontSize: 9 },
  barList: { gap: 12, marginTop: 4 },
  barRow: { gap: 6 },
  barHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  barLabel: { fontFamily: 'Roboto_500Medium', fontSize: 14, flex: 1 },
  barCount: { fontFamily: 'Roboto_400Regular', fontSize: 13 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { flexGrow: 1, flexBasis: '30%', minWidth: 96 },
  statInner: { paddingVertical: 14, paddingHorizontal: 14, gap: 4 },
  statValue: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 26,
    letterSpacing: -0.4,
  },
  statLabel: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
