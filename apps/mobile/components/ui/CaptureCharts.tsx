import { StyleSheet, View } from 'react-native';

import type { DashboardHeatmapDay } from '../../lib/api';
import { useAppTheme } from '../../providers/ThemeProvider';
import { ThemedText } from '../ThemedText';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

const BINS = [
  { label: '0', test: (count: number) => count === 0 },
  { label: '1', test: (count: number) => count === 1 },
  { label: '2', test: (count: number) => count === 2 },
  { label: '3', test: (count: number) => count === 3 },
  { label: '4+', test: (count: number) => count >= 4 },
] as const;

function chunkWeeks(days: DashboardHeatmapDay[]): DashboardHeatmapDay[][] {
  const weeks: DashboardHeatmapDay[][] = [];
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }
  return weeks;
}

function monthLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return '';
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short' });
}

function heatOpacity(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 0.35;
  if (count === 2) return 0.55;
  if (count === 3) return 0.78;
  return 1;
}

export function CaptureHeatmap({
  days,
  compact = false,
}: {
  days: DashboardHeatmapDay[];
  compact?: boolean;
}) {
  const { colors, radius } = useAppTheme();
  if (days.length === 0) return null;

  const weeks = chunkWeeks(days);
  const recorded = days.filter((day) => !day.future);
  const active = recorded.filter((day) => day.count > 0).length;
  let previousMonth = '';

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`Capture heatmap for the last ${weeks.length} weeks. ${active} days with a memory.`}
      style={[
        styles.card,
        compact && styles.cardCompact,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.xl,
        },
      ]}
    >
      {compact ? null : (
        <>
          <ThemedText colorKey="text" style={styles.title}>
            Capture heatmap
          </ThemedText>
          <ThemedText colorKey="textMuted" style={styles.note}>
            {active} of {recorded.length} days in the last {weeks.length} weeks
          </ThemedText>
        </>
      )}
      <View style={styles.grid}>
        <View style={styles.monthCol}>
          <View style={styles.headerSpacer} />
          {weeks.map((week) => {
            const label = monthLabel(week[0]?.date ?? '');
            const show = label !== '' && label !== previousMonth;
            if (label) previousMonth = label;
            return (
              <ThemedText key={week[0]?.date ?? label} colorKey="textMuted" style={styles.month}>
                {show ? label : ''}
              </ThemedText>
            );
          })}
        </View>
        <View style={styles.cells}>
          <View style={styles.headerRow}>
            {WEEKDAYS.map((day, index) => (
              <ThemedText key={`${day}-${index}`} colorKey="textMuted" style={styles.weekday}>
                {day}
              </ThemedText>
            ))}
          </View>
          {weeks.map((week) => (
            <View key={week[0]?.date ?? 'week'} style={styles.weekRow}>
              {week.map((day) => (
                <View
                  key={day.date}
                  style={[
                    styles.cell,
                    {
                      borderRadius: radius.sm,
                      backgroundColor: day.future
                        ? 'transparent'
                        : day.count > 0
                          ? colors.primary
                          : colors.surfaceContainer,
                      opacity: day.future ? 1 : day.count > 0 ? heatOpacity(day.count) : 1,
                      borderWidth: day.future ? 1 : 0,
                      borderColor: colors.border,
                    },
                  ]}
                />
              ))}
            </View>
          ))}
        </View>
      </View>
      <View style={styles.legend}>
        {compact ? null : (
          <ThemedText colorKey="textMuted" style={styles.legendLabel}>
            Fewer
          </ThemedText>
        )}
        {[0, 1, 2, 3, 4].map((step) => (
          <View
            key={step}
            style={[
              styles.legendCell,
              {
                borderRadius: radius.sm,
                backgroundColor: step === 0 ? colors.surfaceContainer : colors.primary,
                opacity: step === 0 ? 1 : heatOpacity(step),
              },
            ]}
          />
        ))}
        {compact ? null : (
          <ThemedText colorKey="textMuted" style={styles.legendLabel}>
            More
          </ThemedText>
        )}
      </View>
    </View>
  );
}

export function CaptureHistogram({
  days,
  compact = false,
}: {
  days: DashboardHeatmapDay[];
  compact?: boolean;
}) {
  const { colors, radius } = useAppTheme();
  const recorded = days.filter((day) => !day.future);
  if (recorded.length === 0) return null;

  const counts = BINS.map((bin) => ({
    label: bin.label,
    count: recorded.filter((day) => bin.test(day.count)).length,
  }));
  const max = Math.max(1, ...counts.map((bin) => bin.count));
  const busiest = counts.reduce((best, bin) => (bin.count > best.count ? bin : best), counts[0]);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`Histogram of daily captures. Most days have ${busiest.label} ${busiest.label === '1' ? 'memory' : 'memories'}.`}
      style={[
        styles.card,
        compact && styles.cardCompact,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.xl,
        },
      ]}
    >
      {compact ? null : (
        <>
          <ThemedText colorKey="text" style={styles.title}>
            Daily histogram
          </ThemedText>
          <ThemedText colorKey="textMuted" style={styles.note}>
            How many memories you save on a typical day
          </ThemedText>
        </>
      )}
      <View style={styles.bins}>
        {counts.map((bin) => (
          <View key={bin.label} style={styles.binRow}>
            <ThemedText colorKey="textSecondary" style={styles.binLabel}>
              {bin.label}
            </ThemedText>
            <View style={[styles.binTrack, { backgroundColor: colors.surfaceContainer }]}>
              <View
                style={[
                  styles.binFill,
                  {
                    width: `${Math.max(bin.count === 0 ? 0 : 6, (bin.count / max) * 100)}%`,
                    backgroundColor: bin.label === '0' ? colors.textMuted : colors.primary,
                    borderRadius: radius.full,
                  },
                ]}
              />
            </View>
            <ThemedText colorKey="text" style={styles.binCount}>
              {bin.count}
            </ThemedText>
          </View>
        ))}
      </View>
      {compact ? null : (
        <ThemedText colorKey="textMuted" style={styles.note}>
          {busiest.count} {busiest.count === 1 ? 'day' : 'days'} with {busiest.label}{' '}
          {busiest.label === '1' ? 'memory' : 'memories'}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  cardCompact: {
    padding: 12,
    gap: 8,
  },
  title: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 22,
  },
  note: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 16,
    lineHeight: 22,
  },
  grid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  monthCol: {
    width: 32,
    gap: 3,
  },
  headerSpacer: {
    height: 14,
  },
  month: {
    height: 14,
    fontFamily: 'Roboto_500Medium',
    fontSize: 10,
    lineHeight: 14,
  },
  cells: {
    flex: 1,
    gap: 3,
  },
  headerRow: {
    flexDirection: 'row',
    gap: 3,
    height: 14,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Roboto_500Medium',
    fontSize: 10,
    lineHeight: 14,
  },
  weekRow: {
    flexDirection: 'row',
    gap: 3,
    height: 14,
  },
  cell: {
    flex: 1,
    height: 14,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 2,
  },
  legendLabel: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 11,
    marginHorizontal: 2,
  },
  legendCell: {
    width: 12,
    height: 12,
  },
  bins: {
    gap: 8,
    marginTop: 4,
  },
  binRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  binLabel: {
    width: 24,
    fontFamily: 'Roboto_500Medium',
    fontSize: 13,
    textAlign: 'right',
  },
  binTrack: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  binFill: {
    height: '100%',
  },
  binCount: {
    width: 28,
    fontFamily: 'Roboto_500Medium',
    fontSize: 13,
  },
});
