import { useAuth } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

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
import { fetchEntities, type ApiEntitySummary } from '../../../lib/api';

function groupByType(items: ApiEntitySummary[]) {
  const map = new Map<string, ApiEntitySummary[]>();
  for (const item of items) {
    const list = map.get(item.type) ?? [];
    list.push(item);
    map.set(item.type, list);
  }
  return [...map.entries()]
    .map(([type, list]) => [type, list.sort((a, b) => b.observationCount - a.observationCount)] as const)
    .sort((a, b) => b[1].length - a[1].length);
}

function typeLabel(type: string): string {
  switch (type) {
    case 'TECHNOLOGY':
      return 'Tech';
    case 'PERSON':
      return 'People';
    case 'ORGANIZATION':
      return 'Orgs';
    case 'PRODUCT':
      return 'Products';
    case 'LOCATION':
      return 'Places';
    case 'CONCEPT':
      return 'Concepts';
    default:
      return type;
  }
}

function typeIcon(type: string): ComponentProps<typeof Feather>['name'] {
  switch (type) {
    case 'TECHNOLOGY':
      return 'cpu';
    case 'PERSON':
      return 'user';
    case 'ORGANIZATION':
      return 'briefcase';
    case 'PRODUCT':
      return 'package';
    case 'LOCATION':
      return 'map-pin';
    case 'CONCEPT':
      return 'zap';
    default:
      return 'circle';
  }
}

export default function EntitiesScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { data, error, loading, refreshing, reload } = useAsync(async () => {
    const token = await getToken();
    if (!token) throw new Error('Sign in required');
    return fetchEntities({ token, limit: 100 });
  }, [getToken], { cacheKey: 'entities' });

  if (loading && !data) return <LoadingSkeleton rows={8} label="Finding people, places and ideas" />;
  if (error && !data) {
    return <ErrorState title="Unable to load" onRetry={reload} />;
  }
  if (!data || data.items.length === 0) {
    return (
      <SoftPage>
        <EmptyState
          icon="hub"
          title="People, places and ideas show up here"
          message="Kairos picks them out of your memories so you can revisit everything about one of them."
          actionLabel="Capture something"
          onAction={() => router.push('/(app)/quick-capture')}
        />
      </SoftPage>
    );
  }

  const groups = groupByType(data.items);
  const max = Math.max(1, ...data.items.map((item) => item.observationCount));

  return (
    <FadeInContent>
      <SoftRefreshBar active={refreshing} />
      <SoftPage>
        {groups.map(([type, items]) => (
          <View key={type} style={styles.group}>
            <View style={styles.groupHeader}>
              <ThemedText colorKey="textMuted" style={styles.kicker}>
                {typeLabel(type)}
              </ThemedText>
              <ThemedText colorKey="textMuted" style={styles.kicker}>
                {items.length}
              </ThemedText>
            </View>
            {items.map((entity, index) => (
              <ListRow
                key={entity.id}
                title={entity.name}
                icon={typeIcon(type)}
                count={entity.observationCount}
                weight={entity.observationCount / max}
                lead={entity.observationCount === max}
                index={index}
                onPress={() => router.push(`/(app)/entities/${entity.id}`)}
              />
            ))}
          </View>
        ))}
      </SoftPage>
    </FadeInContent>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingHorizontal: 4 },
  kicker: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
