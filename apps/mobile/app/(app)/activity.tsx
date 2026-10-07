import { useAuth } from '@clerk/expo';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import { ThemedText } from '../../components/ThemedText';

import { SoftPage } from '../../components/ui/SoftScreen';
import {
  EmptyState,
  ErrorState,
  FadeInContent,
  LoadingSkeleton,
} from '../../components/ui/EmptyState';
import { ObservationStatusCard } from '../../components/ui/ObservationStatusCard';
import { ThemedButton } from '../../components/ui/ThemedButton';
import {
  fetchObservations,
  isProcessingObservationStatus,
  reprocessObservation,
  type ApiObservation,
} from '../../lib/api';

const POLL_MS = 3000;

export default function ActivityScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [observations, setObservations] = useState<ApiObservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const focusedRef = useRef(true);
  const observationsRef = useRef<ApiObservation[]>([]);
  const hasDataRef = useRef(false);
  observationsRef.current = observations;

  const load = useCallback(async () => {
    try {
      setError(null);
      const token = await getToken();
      if (!token) throw new Error('Sign in required');
      const data = await fetchObservations(token);
      const wasProcessing = new Set(
        observationsRef.current.filter((o) => isProcessingObservationStatus(o.status)).map((o) => o.id),
      );
      if (data.some((o) => o.status === 'COMPLETED' && wasProcessing.has(o.id))) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setObservations(data);
      hasDataRef.current = true;
    } catch {
      setError('Unable to load');
    }
  }, [getToken]);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      let cancelled = false;
      void (async () => {
        if (!hasDataRef.current) setLoading(true);
        await load();
        if (!cancelled) setLoading(false);
      })();

      const timer = setInterval(() => {
        if (!focusedRef.current) return;
        if (
          observationsRef.current.some((o) => isProcessingObservationStatus(o.status))
        ) {
          void load();
        }
      }, POLL_MS);

      return () => {
        cancelled = true;
        focusedRef.current = false;
        clearInterval(timer);
      };
    }, [load]),
  );

  const active = observations.filter((o) => isProcessingObservationStatus(o.status));
  const failed = observations.filter((o) => o.status === 'FAILED');
  const recentReady = observations.filter((o) => o.status === 'COMPLETED').slice(0, 5);
  const visible = [...active, ...failed, ...recentReady];

  const onRetry = async (id: string) => {
    try {
      setRetryingId(id);
      const token = await getToken();
      if (!token) return;
      const updated = await reprocessObservation(token, id);
      setObservations((prev) => prev.map((item) => (item.id === id ? updated : item)));
    } catch {
      setError('Retry failed');
    } finally {
      setRetryingId(null);
    }
  };

  if (loading && observations.length === 0) return <LoadingSkeleton rows={8} label="Checking what is processing" />;
  if (error && observations.length === 0) {
    return <ErrorState title="Unable to load" onRetry={() => void load()} />;
  }
  if (visible.length === 0) {
    return (
      <SoftPage>
        <EmptyState
          icon="check-circle-outline"
          title="All caught up"
          message="Nothing is processing right now. New captures show their progress here."
          actionLabel="Capture something"
          onAction={() => router.push('/(app)/quick-capture')}
        />
      </SoftPage>
    );
  }

  const summary = [
    active.length ? `${active.length} processing` : '',
    failed.length ? `${failed.length} need${failed.length === 1 ? 's' : ''} a retry` : '',
    !active.length && !failed.length ? 'Everything is ready' : '',
  ].filter(Boolean).join(' · ');

  const card = (observation: ApiObservation) => (
    <ObservationStatusCard
      key={observation.id}
      observation={observation}
      retrying={retryingId === observation.id}
      onPress={() => router.push(`/(app)/observation/${observation.id}`)}
      onRetry={
        observation.status === 'FAILED'
          ? () => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              void onRetry(observation.id);
            }
          : undefined
      }
    />
  );

  return (
    <FadeInContent>
      <SoftPage>
        <ThemedText colorKey="textSecondary" style={styles.summary}>
          {summary}
        </ThemedText>
        {active.length > 0 ? (
          <ThemedText colorKey="textMuted" style={styles.kicker}>In progress</ThemedText>
        ) : null}
        {active.map(card)}
        {failed.length > 0 ? (
          <ThemedText colorKey="textMuted" style={styles.kicker}>Needs attention</ThemedText>
        ) : null}
        {failed.map(card)}
        {recentReady.length > 0 ? (
          <ThemedText colorKey="textMuted" style={styles.kicker}>Recently ready</ThemedText>
        ) : null}
        {recentReady.map(card)}

        <ThemedButton
          label="Capture something"
          onPress={() => router.push('/(app)/quick-capture')}
        />
      </SoftPage>
    </FadeInContent>
  );
}

const styles = StyleSheet.create({
  summary: { fontFamily: 'Roboto_500Medium', fontSize: 15 },
  kicker: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 4,
  },
});
