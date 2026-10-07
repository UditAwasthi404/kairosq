import { useAuth } from '@clerk/expo';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '../../../../components/ThemedText';
import {
  EmptyState,
  ErrorState,
  FadeInContent,
  LoadingSkeleton,
  SoftRefreshBar,
} from '../../../../components/ui/EmptyState';
import { Checkbox } from '../../../../components/ui/Checkbox';
import { GlassPanel } from '../../../../components/ui/Glass';
import { PressScale } from '../../../../components/ui/Motion';
import { SoftPage, SoftTitle } from '../../../../components/ui/SoftScreen';
import { ThemedButton } from '../../../../components/ui/ThemedButton';
import { useAsync } from '../../../../hooks/useAsync';
import {
  ApiError,
  addObservationToProject,
  fetchObservations,
  fetchProject,
} from '../../../../lib/api';
import { relativeMemoryLabel } from '../../../../lib/searchHints';
import { useAppTheme } from '../../../../providers/ThemeProvider';

export default function AddProjectObservationsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const { getToken } = useAuth();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) throw new Error('Sign in required');
    const [project, observations] = await Promise.all([
      fetchProject({ token, id: String(id), limit: 200 }),
      fetchObservations(token),
    ]);
    return { project, observations };
  }, [getToken, id]);

  const { data, error, loading, refreshing, reload } = useAsync(load, [id], {
    resetKey: String(id),
    cacheKey: 'project-add',
  });

  const memberIds = useMemo(
    () => new Set(data?.project.observations.map((o) => o.id) ?? []),
    [data],
  );

  const candidates = useMemo(
    () =>
      (data?.observations ?? []).filter(
        (o) => o.status === 'COMPLETED' && !memberIds.has(o.id),
      ),
    [data, memberIds],
  );

  if (loading && !data) return <LoadingSkeleton rows={10} />;
  if ((error && !data) || !data) {
    return <ErrorState title="Unable to load" onRetry={reload} />;
  }

  const toggle = (observationId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(observationId)) next.delete(observationId);
      else next.add(observationId);
      return next;
    });
  };

  const save = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) throw new ApiError('You must be signed in.', 401);
      for (const observationId of selected) {
        await addObservationToProject({
          token,
          projectId: data.project.id,
          observationId,
        });
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err) {
      Alert.alert(
        'Unable to add',
        err instanceof ApiError ? err.message : 'Try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const addLabel =
    saving
      ? 'Adding…'
      : selected.size > 0
        ? `Add ${selected.size} ${selected.size === 1 ? 'memory' : 'memories'}`
        : 'Select memories to add';

  return (
    <FadeInContent>
      <SoftRefreshBar active={refreshing} />
      <SoftPage>
        <SoftTitle>{data.project.name}</SoftTitle>

        {candidates.length === 0 ? (
          <EmptyState
            icon="done-all"
            title="Everything is already here"
            message="All your ready memories are in this project. New ones can be added once they finish processing."
          />
        ) : (
          candidates.map((observation) => {
            const isOn = selected.has(observation.id);
            return (
              <PressScale
                key={observation.id}
                onPress={() => {
                  void Haptics.selectionAsync();
                  toggle(observation.id);
                }}
                accessibilityLabel={`${isOn ? 'Deselect' : 'Select'} ${observation.filename}`}
              >
                <GlassPanel
                  padded={false}
                  contentStyle={[styles.row, isOn && { backgroundColor: colors.primaryContainer }]}
                >
                  <Checkbox checked={isOn} />
                  <View style={styles.copy}>
                    <ThemedText colorKey="text" style={styles.title} numberOfLines={2}>
                      {observation.filename}
                    </ThemedText>
                    <ThemedText colorKey="textMuted" style={styles.meta}>
                      {relativeMemoryLabel(observation.capturedAt)}
                    </ThemedText>
                  </View>
                </GlassPanel>
              </PressScale>
            );
          })
        )}

        <ThemedButton
          label={addLabel}
          disabled={saving || selected.size === 0}
          onPress={() => void save()}
        />
      </SoftPage>
    </FadeInContent>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  copy: { flex: 1, gap: 2 },
  title: { fontFamily: 'Roboto_500Medium', fontSize: 15 },
  meta: { fontFamily: 'Roboto_400Regular', fontSize: 12 },
});
