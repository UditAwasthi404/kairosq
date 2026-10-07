import { useAuth } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '../../components/ThemedText';
import {
  EmptyState,
  ErrorState,
  FadeInContent,
  LoadingSkeleton,
  SoftRefreshBar,
} from '../../components/ui/EmptyState';
import { GlassPanel } from '../../components/ui/Glass';
import { EvidenceRow } from '../../components/ui/InsightCard';
import { PressScale } from '../../components/ui/Motion';
import { SoftPage, SoftTitle } from '../../components/ui/SoftScreen';
import { useAsync } from '../../hooks/useAsync';
import { fetchPredictions, type PredictionItem } from '../../lib/api';
import { useAppTheme } from '../../providers/ThemeProvider';

function iconForKind(kind: PredictionItem['kind']): React.ComponentProps<typeof Feather>['name'] {
  switch (kind) {
    case 'revisit':
      return 'rotate-ccw';
    case 'focus':
      return 'crosshair';
    case 'emerging':
      return 'trending-up';
    case 'next':
    default:
      return 'zap';
  }
}

export default function PredictionsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { getToken } = useAuth();
  const { data, error, loading, refreshing, reload } = useAsync(async () => {
    const token = await getToken();
    if (!token) throw new Error('Sign in required');
    return fetchPredictions(token);
  }, [getToken], { cacheKey: 'predictions' });

  if (loading && !data) return <LoadingSkeleton rows={6} label="Looking for patterns" />;
  if (error && !data) {
    return <ErrorState title="Unable to load" onRetry={reload} />;
  }
  if (!data || data.items.length === 0) {
    return (
      <SoftPage>
        <EmptyState
          icon="insights"
          title="Patterns need a little history"
          message="After a week or so of memories, Kairos can suggest what to revisit and what is emerging."
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
        <SoftTitle>Predictions</SoftTitle>
        <ThemedText colorKey="textMuted" style={styles.lead}>
          These are cautious patterns from your memories — not claims about the future.
        </ThemedText>
        {data.items.map((item, index) => {
          const href = item.observationId
            ? `/(app)/observation/${item.observationId}`
            : item.topicId
              ? `/(app)/topics/${item.topicId}`
              : '/(app)/quick-capture';
          return (
            <PressScale
              key={`${item.kind}-${index}`}
              onPress={() => {
                void Haptics.selectionAsync();
                router.push(href);
              }}
              accessibilityLabel={item.title}
            >
              <GlassPanel>
                <View style={styles.header}>
                  <View
                    style={[
                      styles.icon,
                      { backgroundColor: index === 0 ? colors.accentGlow : colors.surfaceContainer },
                    ]}
                  >
                    <Feather
                      name={iconForKind(item.kind)}
                      size={16}
                      color={index === 0 ? colors.accent : colors.textSecondary}
                    />
                  </View>
                  <ThemedText colorKey="text" style={styles.title}>
                    {item.title}
                  </ThemedText>
                </View>
                <ThemedText colorKey="textMuted" style={styles.body}>
                  {item.body}
                </ThemedText>
                <ThemedText colorKey="textMuted" style={styles.why}>
                  Why this appeared · {item.why}
                </ThemedText>
                {item.evidence.slice(0, 3).map((evidence) => (
                  <EvidenceRow
                    key={evidence.observationId}
                    item={evidence}
                    onPress={() => router.push(`/(app)/observation/${evidence.observationId}`)}
                  />
                ))}
                {item.evidence.length > 0 ? (
                  <View style={styles.exploreRow}>
                    <ThemedText colorKey="accent" style={styles.explore}>
                      Explore related memories
                    </ThemedText>
                    <Feather name="arrow-right" size={14} color={colors.accent} />
                  </View>
                ) : null}
              </GlassPanel>
            </PressScale>
          );
        })}
      </SoftPage>
    </FadeInContent>
  );
}

const styles = StyleSheet.create({
  lead: { fontFamily: 'Roboto_400Regular', fontSize: 14, lineHeight: 20 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontFamily: 'Roboto_600SemiBold', fontSize: 16, letterSpacing: -0.2 },
  body: { fontFamily: 'Roboto_400Regular', fontSize: 14, lineHeight: 21 },
  why: { fontFamily: 'Roboto_400Regular', fontSize: 12, marginTop: 10 },
  exploreRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  explore: { fontFamily: 'Roboto_500Medium', fontSize: 13 },
});
