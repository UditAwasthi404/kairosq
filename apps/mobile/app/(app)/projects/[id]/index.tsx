import { Feather } from '@expo/vector-icons';
import { useAuth } from '@clerk/expo';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '../../../../components/ThemedText';
import {
  EmptyState,
  ErrorState,
  FadeInContent,
  LoadingSkeleton,
  SoftRefreshBar,
} from '../../../../components/ui/EmptyState';
import { CollectionHeader } from '../../../../components/ui/CollectionHeader';
import { ListRow } from '../../../../components/ui/ListRow';
import { SoftLinkList, SoftPage } from '../../../../components/ui/SoftScreen';
import { ThemedButton } from '../../../../components/ui/ThemedButton';
import { useAsync } from '../../../../hooks/useAsync';
import {
  ApiError,
  deleteProject,
  fetchProject,
  removeObservationFromProject,
} from '../../../../lib/api';
import { relativeMemoryLabel } from '../../../../lib/searchHints';
import { useAppTheme } from '../../../../providers/ThemeProvider';

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const { getToken } = useAuth();
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) throw new Error('Sign in required');
    return fetchProject({ token, id: String(id), limit: 50 });
  }, [getToken, id]);

  const { data, error, loading, refreshing, reload } = useAsync(load, [id], {
    resetKey: String(id),
    cacheKey: 'project',
  });

  if (loading && !data) return <LoadingSkeleton rows={10} />;
  if ((error && !data) || !data) {
    return <ErrorState title="Unable to load" onRetry={reload} />;
  }

  const removeObservation = (observationId: string, filename: string) => {
    Alert.alert('Remove?', filename, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true);
            try {
              const token = await getToken();
              if (!token) throw new ApiError('You must be signed in.', 401);
              await removeObservationFromProject({
                token,
                projectId: data.id,
                observationId,
              });
              await reload();
            } catch (err) {
              Alert.alert(
                'Unable to remove',
                err instanceof ApiError ? err.message : 'Try again.',
              );
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  };

  const confirmDelete = () => {
    Alert.alert('Delete project?', data.name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true);
            try {
              const token = await getToken();
              if (!token) throw new ApiError('You must be signed in.', 401);
              await deleteProject({ token, id: data.id });
              router.replace('/(app)/projects');
            } catch (err) {
              Alert.alert(
                'Unable to delete',
                err instanceof ApiError ? err.message : 'Try again.',
              );
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  };

  return (
    <FadeInContent>
      <SoftRefreshBar active={refreshing} />
      <SoftPage>
        <CollectionHeader
          kicker="Project"
          title={data.name}
          description={data.description}
          count={data.observationCount}
          dates={data.observations.map((observation) => observation.capturedAt)}
        />

        <SoftLinkList
          items={[
            {
              label: 'Ask',
              icon: 'message-circle',
              onPress: () =>
                router.push({
                  pathname: '/(app)/(tabs)/ask',
                  params: {
                    scopeType: 'project',
                    scopeId: data.id,
                    scopeName: data.name,
                  },
                }),
            },
            {
              label: 'Search',
              icon: 'search',
              onPress: () =>
                router.push({
                  pathname: '/(app)/search',
                  params: { projectId: data.id, projectName: data.name },
                }),
            },
            {
              label: 'Add memories',
              icon: 'plus',
              onPress: () => router.push(`/(app)/projects/${data.id}/add`),
            },
          ]}
        />

        <ThemedText colorKey="textMuted" style={styles.kicker}>
          Memories
        </ThemedText>

        {data.observations.length === 0 ? (
          <EmptyState
            icon="folder-open"
            title="An empty project is a fresh start"
            message="Add a few memories and Kairos can answer questions across all of them."
            actionLabel="Add memories"
            onAction={() => router.push(`/(app)/projects/${data.id}/add`)}
          />
        ) : (
          data.observations.map((observation, index) => (
            <View key={observation.id} style={styles.obsRow}>
              <View style={styles.obsMain}>
                <ListRow
                  title={observation.filename}
                  subtitle={relativeMemoryLabel(observation.capturedAt)}
                  titleLines={2}
                  index={index}
                  onPress={() => router.push(`/(app)/observation/${observation.id}`)}
                />
              </View>
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  removeObservation(observation.id, observation.filename);
                }}
                disabled={busy}
                accessibilityLabel="Remove from project"
                style={({ pressed }) => [
                  styles.removeBtn,
                  { backgroundColor: colors.surfaceElevated, opacity: busy ? 0.4 : pressed ? 0.85 : 1 },
                ]}
              >
                <Feather name="x" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
          ))
        )}

        <ThemedButton
          label="Delete"
          variant="outline"
          disabled={busy}
          onPress={confirmDelete}
        />
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
  obsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  obsMain: { flex: 1 },
  removeBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
