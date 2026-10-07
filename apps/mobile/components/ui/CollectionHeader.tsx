import { StyleSheet, View } from 'react-native';

import { ThemedText } from '../ThemedText';
import { relativeMemoryLabel } from '../../lib/searchHints';
import { useAppTheme } from '../../providers/ThemeProvider';
import { CountUp } from './Motion';
import { SoftTitle } from './SoftScreen';

type Props = {
  kicker: string;
  title: string;
  count: number;
  /** ISO timestamps of the memories in this collection, any order. */
  dates?: string[];
  description?: string | null;
};

export function CollectionHeader({ kicker, title, count, dates = [], description }: Props) {
  const { colors } = useAppTheme();
  const sorted = dates.filter(Boolean).sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  return (
    <View style={styles.wrap}>
      <ThemedText colorKey="primary" style={styles.kicker}>
        {kicker}
      </ThemedText>
      <SoftTitle>{title}</SoftTitle>
      {description ? (
        <ThemedText colorKey="textSecondary" style={styles.description}>
          {description}
        </ThemedText>
      ) : null}
      <View style={styles.stats}>
        <View style={styles.stat}>
          <CountUp value={count} style={[styles.value, { color: colors.text }]} />
          <ThemedText colorKey="textMuted" style={styles.label}>
            {count === 1 ? 'memory' : 'memories'}
          </ThemedText>
        </View>
        {first ? (
          <View style={[styles.stat, styles.divided, { borderLeftColor: colors.border }]}>
            <ThemedText colorKey="text" style={styles.valueSmall}>
              {new Date(first).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
            </ThemedText>
            <ThemedText colorKey="textMuted" style={styles.label}>first seen</ThemedText>
          </View>
        ) : null}
        {last ? (
          <View style={[styles.stat, styles.divided, { borderLeftColor: colors.border }]}>
            <ThemedText colorKey="text" style={styles.valueSmall}>
              {relativeMemoryLabel(last)}
            </ThemedText>
            <ThemedText colorKey="textMuted" style={styles.label}>latest</ThemedText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  kicker: { fontFamily: 'Roboto_600SemiBold', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  description: { fontFamily: 'Roboto_400Regular', fontSize: 14, lineHeight: 20 },
  stats: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 8 },
  stat: { gap: 2, paddingRight: 16 },
  divided: { borderLeftWidth: StyleSheet.hairlineWidth, paddingLeft: 16 },
  value: { fontFamily: 'Roboto_700Bold', fontSize: 26, letterSpacing: -0.4 },
  valueSmall: { fontFamily: 'Roboto_600SemiBold', fontSize: 15, paddingBottom: 3 },
  label: { fontFamily: 'Roboto_500Medium', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 },
});
