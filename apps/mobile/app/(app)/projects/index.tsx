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
import { ThemedButton } from '../../../components/ui/ThemedButton';
import { InsightCard as SuggestionCard } from '../../../components/ui/system/InsightCard';
import { useAsync } from '../../../hooks/useAsync';
import { fetchProjects } from '../../../lib/api';

export default function ProjectsScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { data, error, loading, refreshing, reload } = useAsync(async () => {
    const token = await getToken();
    if (!token) throw new Error('Sign in required');
    return fetchProjects({ token, limit: 100 });
  }, [getToken], { cacheKey: 'projects' });

  if (loading && !data) return <LoadingSkeleton rows={8} label="Opening your projects" />;
  if (error && !data) {
    return <ErrorState title="Unable to load" onRetry={reload} />;
  }

  const items = data?.items ?? [];
  const max = Math.max(1, ...items.map((project) => project.observationCount));

  return (
    <FadeInContent>
      <SoftRefreshBar active={refreshing} />
      <SoftPage>
        <SuggestionCard message="Group related memories into a project Kairos can revisit." />
        <ThemedButton
          label="New project"
          onPress={() => router.push('/(app)/projects/new')}
          style={styles.newBtn}
        />

        {items.length === 0 ? (
          <EmptyState
            icon="folder-open"
            title="Start your first project"
            message="A trip, a thesis, a side project. Anything you want Kairos to keep together."
            actionLabel="New project"
            onAction={() => router.push('/(app)/projects/new')}
          />
        ) : (
          items.map((project, index) => (
            <ListRow
              key={project.id}
              icon="folder"
              title={project.name}
              count={project.observationCount}
              weight={project.observationCount / max}
              lead={project.observationCount === max}
              index={index}
              onPress={() => router.push(`/(app)/projects/${project.id}`)}
            />
          ))
        )}
      </SoftPage>
    </FadeInContent>
  );
}

const styles = StyleSheet.create({
  newBtn: { alignSelf: 'flex-start', minWidth: 88, paddingHorizontal: 18 },
});
