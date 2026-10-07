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
import { fetchEntity } from '../../../lib/api';
import { relativeMemoryLabel } from '../../../lib/searchHints';

const TYPE_LABEL: Record<string, string> = {
  TECHNOLOGY: 'Technology',
  PERSON: 'Person',
  ORGANIZATION: 'Organization',
  PRODUCT: 'Product',
  LOCATION: 'Place',
  CONCEPT: 'Concept',
};

export default function EntityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getToken } = useAuth();
  const { data, error, loading, refreshing, reload } = useAsync(
    async () => {
      const token = await getToken();
      if (!token) throw new Error('Sign in required');
      return fetchEntity({ token, id: String(id) });
    },
    [getToken, id],
    { resetKey: String(id), cacheKey: 'entity' },
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
          kicker={TYPE_LABEL[data.type] ?? data.type}
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
                  params: { scopeType: 'entity', scopeId: data.id, scopeName: data.name },
                }),
            },
            {
              label: 'Search mentions',
              icon: 'search',
              onPress: () =>
                router.push({
                  pathname: '/(app)/search',
                  params: { entityId: data.id, entityName: data.name },
                }),
            },
          ]}
        />

        <ThemedText colorKey="textMuted" style={styles.kicker}>
          Mentioned in
        </ThemedText>

        {data.observations.length === 0 ? (
          <EmptyState
            icon="hub"
            title="No mentions yet"
            message="Memories that mention this will be collected here."
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
