import { useAuth } from '@clerk/expo';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '../../../components/ThemedText';
import {
  EmptyState,
  ErrorState,
  FadeInContent,
  LoadingSkeleton,
  SoftRefreshBar,
} from '../../../components/ui/EmptyState';
import { GlassPanel } from '../../../components/ui/Glass';
import { PressScale } from '../../../components/ui/Motion';
import { SoftPage, SoftTitle } from '../../../components/ui/SoftScreen';
import { useAsync } from '../../../hooks/useAsync';
import { fetchRelatedMemories } from '../../../lib/api';
import { relativeMemoryLabel } from '../../../lib/searchHints';
import { useAppTheme } from '../../../providers/ThemeProvider';

const REASON_LABEL = {
  similar: 'Similar meaning',
  shared_topic: 'Shared topic',
  shared_entity: 'Shared entity',
  shared_project: 'Same project',
  nearby_in_time: 'Nearby in time',
} as const;

export default function RelatedMemoriesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const { getToken } = useAuth();
  const { data, error, loading, refreshing, reload } = useAsync(
    async () => {
      const token = await getToken();
      if (!token) throw new Error('Sign in required');
      return fetchRelatedMemories(token, String(id));
    },
    [getToken, id],
    { resetKey: String(id), cacheKey: 'related' },
  );

  if (loading && !data) return <LoadingSkeleton rows={6} label="Tracing connections" />;
  if (error && !data) {
    return <ErrorState title="Unable to load" onRetry={reload} />;
  }
  if (!data || data.length === 0) {
    return (
      <SoftPage>
        <EmptyState
          icon="hub"
          title="No connections yet"
          message="As you save more, Kairos links memories that share ideas, people or moments."
          actionLabel="Search"
          onAction={() => router.push('/(app)/search')}
        />
      </SoftPage>
    );
  }

  return (
    <FadeInContent>
      <SoftRefreshBar active={refreshing} />
      <SoftPage>
        <SoftTitle>Related memories</SoftTitle>
        <ThemedText colorKey="textMuted" style={styles.lead}>
          {data.length} {data.length === 1 ? 'memory connects' : 'memories connect'} to this one.
        </ThemedText>
        {data.map((item) => (
          <PressScale
            key={item.observationId}
            onPress={() => {
              void Haptics.selectionAsync();
              router.push({
                pathname: '/(app)/observation/[id]',
                params: { id: item.observationId, highlight: item.snippet },
              });
            }}
            accessibilityLabel={item.filename}
          >
            <GlassPanel>
              <ThemedText colorKey="textMuted" style={styles.when}>
                {relativeMemoryLabel(item.capturedAt)} · {item.sourceLabel}
              </ThemedText>
              <ThemedText colorKey="text" style={styles.title} numberOfLines={2}>
                {item.filename}
              </ThemedText>
              <ThemedText colorKey="textMuted" style={styles.snippet} numberOfLines={3}>
                {item.snippet}
              </ThemedText>
              <View style={styles.reasons}>
                {item.reasons.map((reason, index) => (
                  <View
                    key={reason}
                    style={[
                      styles.reason,
                      { backgroundColor: index === 0 ? colors.primaryContainer : colors.surfaceContainer },
                    ]}
                  >
                    <ThemedText colorKey={index === 0 ? 'primary' : 'textSecondary'} style={styles.reasonText}>
                      {REASON_LABEL[reason]}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </GlassPanel>
          </PressScale>
        ))}
      </SoftPage>
    </FadeInContent>
  );
}

const styles = StyleSheet.create({
  lead: { fontFamily: 'Roboto_400Regular', fontSize: 14, lineHeight: 20 },
  when: { fontFamily: 'Roboto_400Regular', fontSize: 12, marginBottom: 6 },
  title: { fontFamily: 'Roboto_500Medium', fontSize: 16 },
  snippet: { fontFamily: 'Roboto_400Regular', fontSize: 14, lineHeight: 21, marginTop: 6 },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  reason: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  reasonText: { fontFamily: 'Roboto_500Medium', fontSize: 11 },
});
