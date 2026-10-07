import { useAuth } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ThemedText } from '../../components/ThemedText';
import {
  EmptyState,
  ErrorState,
  FadeInContent,
  LoadingSkeleton,
} from '../../components/ui/EmptyState';
import { InsightCard } from '../../components/ui/InsightCard';
import { SoftPage, SoftTitle } from '../../components/ui/SoftScreen';
import { ThemedButton } from '../../components/ui/ThemedButton';
import { useAsync } from '../../hooks/useAsync';
import { fetchTodayInsight } from '../../lib/api';
import { dailyReflection } from '../../lib/engagement';
import { KairosOs } from '../../lib/osIntegrations';

export default function InsightScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const reflection = dailyReflection();
  const { data, error, loading, reload } = useAsync(async () => {
    const token = await getToken();
    if (!token) throw new Error('Sign in required');
    const insight = await fetchTodayInsight(token);
    void KairosOs.refreshWidget(
      insight.empty
        ? insight.body
        : `${insight.observationCount} memories this week.\n\n${insight.body}`,
    );
    return insight;
  }, [getToken], { cacheKey: 'today-insight' });

  if (loading && !data) return <LoadingSkeleton rows={5} label="Reading this week" />;
  if (error && !data) {
    return <ErrorState title="Unable to load" onRetry={reload} />;
  }

  return (
    <FadeInContent>
      <SoftPage>
        <SoftTitle>Today</SoftTitle>
        {data ? (
          <InsightCard
            insight={data}
            onExplore={
              data.evidence[0]
                ? () => router.push(`/(app)/observation/${data.evidence[0].observationId}`)
                : undefined
            }
          />
        ) : (
          <EmptyState
            icon="lightbulb-outline"
            title="Insights grow with your memories"
            message="Save a few things this week and Kairos will point out what stands out."
            actionLabel="Capture something"
            onAction={() => router.push('/(app)/quick-capture')}
          />
        )}
        <ThemedText colorKey="textMuted" style={styles.prompt}>
          {reflection.prompt}
        </ThemedText>
        <ThemedButton
          label="Answer in a sentence"
          onPress={() =>
            router.push({ pathname: '/(app)/quick-capture', params: { prompt: reflection.prompt, source: 'WIDGET' } })
          }
        />
        <ThemedButton
          label="Ask Kairos"
          variant="outline"
          onPress={() => router.push('/(app)/(tabs)/ask')}
        />
      </SoftPage>
    </FadeInContent>
  );
}

const styles = StyleSheet.create({
  prompt: { fontFamily: 'Roboto_500Medium', fontSize: 15, lineHeight: 22, textAlign: 'center', paddingHorizontal: 8 },
});
