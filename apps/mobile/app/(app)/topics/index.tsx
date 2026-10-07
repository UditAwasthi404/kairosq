import { useAuth } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { SoftPage } from '../../../components/ui/SoftScreen';
import {
  EmptyState,
  ErrorState,
  FadeInContent,
  LoadingSkeleton,
  SoftRefreshBar,
} from '../../../components/ui/EmptyState';
import { ListRow } from '../../../components/ui/ListRow';
import { ThemedText } from '../../../components/ThemedText';
import { useAsync } from '../../../hooks/useAsync';
import { fetchTopics } from '../../../lib/api';

export default function TopicsScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { data, error, loading, refreshing, reload } = useAsync(async () => {
    const token = await getToken();
    if (!token) throw new Error('Sign in required');
    return fetchTopics({ token, limit: 100 });
  }, [getToken], { cacheKey: 'topics' });

  if (loading && !data) return <LoadingSkeleton rows={8} label="Gathering your topics" />;
  if (error && !data) {
    return <ErrorState title="Unable to load" onRetry={reload} />;
  }
  if (!data || data.items.length === 0) {
    return (
      <SoftPage>
        <EmptyState
          icon="sell"
          title="Topics appear on their own"
          message="As you save memories, Kairos groups them by what they are about."
          actionLabel="Capture something"
          onAction={() => router.push('/(app)/quick-capture')}
        />
      </SoftPage>
    );
  }

  const items = [...data.items].sort((a, b) => b.observationCount - a.observationCount);
  const max = Math.max(1, items[0]?.observationCount ?? 1);

  return (
    <FadeInContent>
      <SoftRefreshBar active={refreshing} />
      <SoftPage>
        <ThemedText colorKey="textMuted" style={styles.lead}>
          {items.length} {items.length === 1 ? 'topic' : 'topics'} across your memories. The longest bar is what
          you return to most.
        </ThemedText>
        {items.map((topic, index) => (
          <ListRow
            key={topic.id}
            title={topic.name}
            count={topic.observationCount}
            weight={topic.observationCount / max}
            lead={index === 0}
            index={index}
            onPress={() => router.push(`/(app)/topics/${topic.id}`)}
          />
        ))}
      </SoftPage>
    </FadeInContent>
  );
}

const styles = StyleSheet.create({
  lead: { fontFamily: 'Roboto_400Regular', fontSize: 14, lineHeight: 20 },
});
