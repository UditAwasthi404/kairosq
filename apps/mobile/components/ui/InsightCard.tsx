import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '../ThemedText';
import type { InsightEvidence, TodayInsight } from '../../lib/api';
import { GlassPanel } from './Glass';

const MATURITY_LABEL = {
  single: 'Single observation',
  repeated: 'Repeated observation',
  pattern: 'Recurring pattern',
  stable: 'Stable knowledge',
} as const;

export function EvidenceRow({
  item,
  onPress,
}: {
  item: InsightEvidence;
  onPress?: () => void;
}) {
  const when = new Date(item.capturedAt).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const content = (
    <View style={styles.evidenceRow}>
      <ThemedText colorKey="textMuted" style={styles.evidenceWhen}>
        {when}
        {item.topicName ? ` · ${item.topicName}` : ''}
      </ThemedText>
      <ThemedText colorKey="text" style={styles.evidenceTitle} numberOfLines={1}>
        {item.filename}
      </ThemedText>
      <ThemedText colorKey="textMuted" style={styles.evidenceSnippet} numberOfLines={2}>
        {item.snippet}
      </ThemedText>
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.filename}
    >
      {content}
    </Pressable>
  );
}

export function InsightCard({
  insight,
  onPress,
  onExplore,
}: {
  insight: TodayInsight;
  onPress?: () => void;
  onExplore?: () => void;
}) {
  const inner = (
    <GlassPanel>
      <ThemedText colorKey="textMuted" style={styles.kicker}>
        {insight.title}
      </ThemedText>
      <ThemedText colorKey="text" style={styles.body}>
        {insight.body}
      </ThemedText>
      {insight.why ? (
        <ThemedText colorKey="textMuted" style={styles.why}>
          {insight.why}
        </ThemedText>
      ) : null}
      {!insight.empty ? (
        <ThemedText colorKey="textMuted" style={styles.maturity}>
          {MATURITY_LABEL[insight.maturity]}
        </ThemedText>
      ) : null}
      {insight.evidence.slice(0, 3).map((item) => (
        <EvidenceRow key={item.observationId} item={item} />
      ))}
      {onExplore && insight.evidence.length > 0 ? (
        <ThemedText colorKey="accent" style={styles.explore}>
          Explore evidence
        </ThemedText>
      ) : null}
    </GlassPanel>
  );

  if (!onPress && !onExplore) return inner;
  return (
    <Pressable
      onPress={onExplore || onPress}
      accessibilityRole="button"
      accessibilityLabel={insight.title}
    >
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  kicker: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 13,
    marginBottom: 8,
  },
  body: { fontFamily: 'Roboto_400Regular', fontSize: 17, lineHeight: 25 },
  why: { fontFamily: 'Roboto_400Regular', fontSize: 13, marginTop: 10 },
  maturity: { fontFamily: 'Roboto_400Regular', fontSize: 12, marginTop: 4 },
  explore: { fontFamily: 'Roboto_500Medium', fontSize: 13, marginTop: 12 },
  evidenceRow: { marginTop: 12, gap: 3 },
  evidenceWhen: { fontFamily: 'Roboto_400Regular', fontSize: 12 },
  evidenceTitle: { fontFamily: 'Roboto_500Medium', fontSize: 14 },
  evidenceSnippet: { fontFamily: 'Roboto_400Regular', fontSize: 13, lineHeight: 18 },
});
