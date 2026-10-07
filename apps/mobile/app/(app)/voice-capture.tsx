import { useAuth } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '../../components/ThemedText';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { saveMessage } from '../../lib/engagement';
import { GlassPanel } from '../../components/ui/Glass';
import { SoftPage, SoftTitle } from '../../components/ui/SoftScreen';
import { ThemedButton } from '../../components/ui/ThemedButton';
import {
  ApiError,
  observationStageLabel,
  pollObservationUntilSettled,
  reprocessObservation,
  type ApiObservation,
} from '../../lib/api';
import { submitCapture } from '../../lib/capture';
import { useAppTheme } from '../../providers/ThemeProvider';
import { useProgression } from '../../providers/ProgressionProvider';

type VoiceState =
  | 'idle'
  | 'permission_denied'
  | 'recording'
  | 'saving'
  | 'saved'
  | 'queued'
  | 'transcribing'
  | 'ready'
  | 'transcribe_failed'
  | 'failed';

function PulseRing({ active, color, delay }: { active: boolean; color: string; delay: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    if (active) {
      progress.value = 0;
      progress.value = withDelay(
        delay,
        withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false),
      );
    } else {
      cancelAnimation(progress);
      progress.value = 0;
    }
    return () => cancelAnimation(progress);
  }, [active, delay, progress]);
  const style = useAnimatedStyle(() => ({
    opacity: progress.value === 0 ? 0 : 0.35 * (1 - progress.value),
    transform: [{ scale: 1 + progress.value * 0.9 }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.ring, { borderColor: color }, style]} />;
}

function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export default function VoiceCaptureScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const reduced = useReducedMotion();
  const { getToken, userId } = useAuth();
  const { refresh: refreshProgression } = useProgression();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const [readyLine, setReadyLine] = useState('');
  const [state, setState] = useState<VoiceState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [observation, setObservation] = useState<ApiObservation | null>(null);

  useEffect(() => {
    if (state === 'ready') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setReadyLine(saveMessage());
    } else if (state === 'failed' || state === 'transcribe_failed') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [state]);

  useEffect(() => {
    return () => {
      if (recorder.isRecording) {
        void recorder.stop();
      }
    };
  }, [recorder]);

  const requestMic = async (): Promise<boolean> => {
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setState('permission_denied');
      setError('Microphone permission was denied. Enable it in system settings to use voice capture.');
      return false;
    }
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });
    return true;
  };

  const startRecording = async () => {
    setError(null);
    try {
      const allowed = await requestMic();
      if (!allowed) return;
      await recorder.prepareToRecordAsync();
      recorder.record();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setState('recording');
    } catch {
      setState('failed');
      setError('Could not start recording. Try again.');
    }
  };

  const cancelRecording = async () => {
    try {
      if (recorder.isRecording) {
        await recorder.stop();
      }
    } catch {
      // ignore
    }
    setState('idle');
    setError(null);
  };

  const saveRecording = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setState('saving');
    setError(null);
    try {
      if (recorder.isRecording) {
        await recorder.stop();
      }
      const uri = recorder.uri;
      if (!uri) {
        setState('failed');
        setError('The recording was empty. Try speaking again.');
        return;
      }
      const token = await getToken();
      if (!token || !userId) throw new ApiError('Sign in required.', 401);
      const result = await submitCapture({
        userId,
        token,
        source: 'VOICE',
        fileUri: uri,
        fileName: `voice-${Date.now()}.m4a`,
        mimeType: 'audio/mp4',
      });
      if (!result.queued) void refreshProgression();
      if (result.queued) {
        setState('queued');
        return;
      }
      setState('saved');
      if (!result.observation) return;
      setObservation(result.observation);
      setState('transcribing');
      try {
        const settled = await pollObservationUntilSettled({
          token,
          id: result.observation.id,
          onUpdate: (next) => {
            setObservation(next);
            if (next.status === 'EXTRACTING' || next.status === 'PENDING') {
              setState('transcribing');
            }
          },
        });
        setObservation(settled);
        setState(settled.status === 'FAILED' ? 'transcribe_failed' : 'ready');
      } catch {
        setState('transcribe_failed');
      }
    } catch (err) {
      setState('failed');
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Voice capture failed. Your recording was not discarded if it could be queued.');
      }
    }
  };

  return (
    <SoftPage>
      <SoftTitle>Voice</SoftTitle>
      <ThemedText colorKey="textMuted" style={styles.lead}>
        Speak a thought. Kairos transcribes it and files it as memory.
      </ThemedText>

      <GlassPanel contentStyle={styles.orbWrap}>
        <View style={styles.orbStage}>
        <PulseRing active={state === 'recording' && !reduced} color={colors.accent} delay={0} />
        <PulseRing active={state === 'recording' && !reduced} color={colors.accent} delay={800} />
        <Pressable
          onPress={() => {
            if (state === 'recording') {
              void saveRecording();
              return;
            }
            if (
              state === 'idle' ||
              state === 'ready' ||
              state === 'queued' ||
              state === 'failed' ||
              state === 'transcribe_failed' ||
              state === 'permission_denied'
            ) {
              void startRecording();
            }
          }}
          disabled={state === 'saving'}
          accessibilityRole="button"
          accessibilityLabel={state === 'recording' ? 'Stop and save' : 'Start recording'}
          style={[
            styles.orb,
            { backgroundColor: state === 'recording' ? colors.accent : colors.accentGlow },
          ]}
        >
          {state === 'saving' ? (
            <ActivityIndicator color={colors.accent} />
          ) : state === 'ready' ? (
            <Feather name="check" size={34} color={colors.accent} />
          ) : (
            <Feather
              name={state === 'recording' ? 'square' : 'mic'}
              size={state === 'recording' ? 26 : 32}
              color={state === 'recording' ? colors.inverseText : colors.accent}
            />
          )}
        </Pressable>
        </View>
        {state === 'recording' ? (
          <ThemedText colorKey="text" style={styles.timer}>
            {formatDuration(recorderState.durationMillis ?? 0)}
          </ThemedText>
        ) : null}
        <ThemedText colorKey="text" style={styles.status}>
          {state === 'recording'
            ? 'Listening. Tap to save.'
            : state === 'saving'
              ? 'Saving…'
              : state === 'saved'
                ? 'Saved'
                : state === 'transcribing'
                  ? observation
                    ? observationStageLabel(observation)
                    : 'Transcribing…'
                  : state === 'ready'
                    ? readyLine || 'Memory ready'
                    : state === 'transcribe_failed'
                      ? "Couldn't transcribe"
                    : state === 'queued'
                      ? 'Saved on this device. Will sync when you are online.'
                      : state === 'permission_denied'
                        ? 'Microphone blocked'
                        : 'Tap and start talking'}
        </ThemedText>
      </GlassPanel>

      {error ? (
        <ThemedText colorKey="error" style={styles.error}>
          {error}
        </ThemedText>
      ) : null}

      <View style={styles.actions}>
        {state === 'recording' ? (
          <>
            <ThemedButton label="Save" onPress={() => void saveRecording()} />
            <ThemedButton label="Cancel" variant="outline" onPress={() => void cancelRecording()} />
          </>
        ) : state === 'transcribe_failed' ? (
          <>
            <ThemedButton
              label="Try again"
              onPress={() => {
                void (async () => {
                  if (!observation) {
                    void startRecording();
                    return;
                  }
                  try {
                    const token = await getToken();
                    if (!token) return;
                    setState('transcribing');
                    const retried = await reprocessObservation(token, observation.id);
                    setObservation(retried);
                    const settled = await pollObservationUntilSettled({
                      token,
                      id: retried.id,
                      onUpdate: setObservation,
                    });
                    setObservation(settled);
                    setState(settled.status === 'FAILED' ? 'transcribe_failed' : 'ready');
                  } catch {
                    setState('transcribe_failed');
                  }
                })();
              }}
            />
            <ThemedButton
              label="Done"
              variant="outline"
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(app)'))}
            />
          </>
        ) : (
          <ThemedButton
            label="Done"
            variant="outline"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(app)'))}
          />
        )}
      </View>
    </SoftPage>
  );
}

const styles = StyleSheet.create({
  lead: { fontFamily: 'Roboto_400Regular', fontSize: 15 },
  orbWrap: { alignItems: 'center', gap: 16, paddingVertical: 36 },
  orbStage: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
  },
  timer: { fontFamily: 'Roboto_600SemiBold', fontSize: 28, letterSpacing: 1, fontVariant: ['tabular-nums'] },
  orb: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: { fontFamily: 'Roboto_500Medium', fontSize: 15, textAlign: 'center' },
  error: { fontFamily: 'Roboto_400Regular', fontSize: 13, textAlign: 'center' },
  actions: { gap: 10 },
});
