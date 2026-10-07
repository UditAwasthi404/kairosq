import { useAuth } from '@clerk/expo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ThemedText } from '../../../components/ThemedText';
import { CollectionHeader } from '../../../components/ui/CollectionHeader';
import {
  EmptyState,
  ErrorState,
  FadeInContent,
  LoadingSkeleton,
  SoftRefreshBar,
} from '../../../components/ui/EmptyState';
import { ListRow } from '../../../components/ui/ListRow';
import { SoftLinkList, SoftPage } from '../../../components/ui/SoftScreen';
import { useAsync } from '../../../hooks/useAsync';
import { fetchTopic } from '../../../lib/api';
import { relativeMemoryLabel } from '../../../lib/searchHints';

export default function TopicDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getToken } = useAuth();
  const { data, error, loading, refreshing, reload } = useAsync(
    async () => {
      const token = await getToken();
      if (!token) throw new Error('Sign in required');
      return fetchTopic({ token, id: String(id) });
    },
    [getToken, id],
    { resetKey: String(id), cacheKey: 'topic' },
  );

  if (loading && !data) return <LoadingSkeleton rows={8} />;
  if ((error && !data) || !data) {
    return <ErrorState title="Unable to load" onRetry={reload} />;
  }

  return (
    <FadeInContent>
      <SoftRefreshBar active={refreshing} />
      <SoftPage>
        <CollectionHeader
          kicker="Topic"
          title={data.name}
          count={data.observationCount}
          dates={data.observations.map((observation) => observation.capturedAt)}
        />

        <SoftLinkList
          items={[
            {
              label: `Ask about ${data.name}`,
              icon: 'message-circle',
              onPress: () =>
                router.push({
                  pathname: '/(app)/(tabs)/ask',
                  params: { scopeType: 'topic', scopeId: data.id, scopeName: data.name },
                }),
            },
            {
              label: 'Search within topic',
              icon: 'search',
              onPress: () =>
                router.push({
                  pathname: '/(app)/search',
                  params: { topicId: data.id, topicName: data.name },
                }),
            },
          ]}
        />

        <ThemedText colorKey="textMuted" style={styles.kicker}>
          Memories
        </ThemedText>

        {data.observations.length === 0 ? (
          <EmptyState
            icon="sell"
            title="Nothing filed here yet"
            message="New memories about this topic will land here automatically."
          />
        ) : (
          data.observations.map((observation, index) => (
            <ListRow
              key={observation.id}
              title={observation.filename}
              subtitle={relativeMemoryLabel(observation.capturedAt)}
              titleLines={2}
              index={index}
              onPress={() => router.push(`/(app)/observation/${observation.id}`)}
            />
          ))
        )}
      </SoftPage>
    </FadeInContent>
  );
}

const styles = StyleSheet.create({
  kicker: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 4,
  },
});
