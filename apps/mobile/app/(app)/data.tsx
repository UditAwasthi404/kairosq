import { useAuth } from '@clerk/expo';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet } from 'react-native';

import { SoftPage, SoftRow } from '../../components/ui/SoftScreen';
import { ThemedButton } from '../../components/ui/ThemedButton';
import { ThemedText } from '../../components/ThemedText';
import { readQueryCache } from '../../hooks/useAsync';
import { ApiError, deleteMyData, type DashboardSummary } from '../../lib/api';
import { useProgression } from '../../providers/ProgressionProvider';
import { pauseCaptureQueue, resumeCaptureQueue } from '../../lib/capture';
import { clearCaptureQueue } from '../../lib/captureQueue';
import { clearCache } from '../../lib/persistentCache';
import { useOnboarding } from '../../providers/OnboardingProvider';
import Recall from 'kairos-recall';

export default function DataScreen() {
  const router = useRouter();
  const { getToken, signOut, userId } = useAuth();
  const { resetOnboarding } = useOnboarding();
  const { progression } = useProgression();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const memoryCount = readQueryCache<DashboardSummary>('dashboard')?.totalCount ?? null;
  const streak = progression?.currentStreak ?? 0;
  const losses = [
    memoryCount != null ? `${memoryCount} ${memoryCount === 1 ? 'memory' : 'memories'}` : 'every memory',
    'all topics, projects and insights',
    streak > 0 ? `your ${streak}-day streak` : '',
  ].filter(Boolean);

  const onDeleteMyData = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert('Delete all data?', `This permanently removes ${losses.join(', ')}. It cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            let queuePaused = false;
            try {
              setBusy(true);
              setMessage(null);
              const token = await getToken();
              if (!token) throw new ApiError('Sign in required.', 401);
              await Recall.stop().catch(() => undefined);
              await Recall.clearLocalData().catch(() => undefined);
              if (userId) {
                await pauseCaptureQueue(userId);
                queuePaused = true;
              }
              const result = await deleteMyData(token);
              setMessage(`Deleted ${result.deletedObservations} memories`);
              if (userId) await clearCaptureQueue(userId);
              await clearCache();
              await signOut();
              await resetOnboarding();
              router.replace('/');
            } catch (err) {
              if (queuePaused && userId) resumeCaptureQueue(userId);
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
    <SoftPage>
      <SoftRow icon="download" label="Export" meta="Soon" />
      <SoftRow icon="trash-2" label="Delete everything" />

      <ThemedText colorKey="textMuted" style={styles.warning}>
        Deleting removes {losses.join(', ')} from Kairos and this device.
      </ThemedText>

      <ThemedButton
        label={busy ? 'Deleting…' : 'Delete my data'}
        variant="outline"
        disabled={busy}
        onPress={onDeleteMyData}
      />

      {message ? (
        <ThemedText colorKey="textMuted" style={styles.message}>
          {message}
        </ThemedText>
      ) : null}
    </SoftPage>
  );
}

const styles = StyleSheet.create({
  warning: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 4,
  },
  message: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 13,
    textAlign: 'center',
  },
});
