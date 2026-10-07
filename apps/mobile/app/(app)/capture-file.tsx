import { useAuth } from '@clerk/expo';
import { MaterialIcons } from '@expo/vector-icons';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FLOATING_TAB_BAR_CONTENT } from '../../components/FloatingTabBar';
import { TabScreenSwipe } from '../../components/TabScreenSwipe';
import { FadeInContent } from '../../components/ui/EmptyState';
import { ScreenGradient } from '../../components/ui/Glass';
import { PressScale } from '../../components/ui/Motion';
import {
  ApiError,
  observationStatusLabel,
  pollObservationUntilSettled,
  type ApiObservation,
} from '../../lib/api';
import { submitCapture } from '../../lib/capture';
import { useAppTheme } from '../../providers/ThemeProvider';
import { useProgression } from '../../providers/ProgressionProvider';

type Attachment = {
  kind: 'file' | 'voice';
  uri: string;
  name: string;
  mimeType: string;
};

const URL_ONLY = /^(https?:\/\/\S+|www\.\S+)$/i;
const URL_IN_TEXT = /https?:\/\/[^\s]+/i;

function guessMimeType(name: string, fallback?: string | null): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.txt') || lower.endsWith('.md')) return 'text/plain';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) return 'audio/mp4';
  return fallback || 'application/octet-stream';
}

function extractPayload(text: string): { content?: string; url?: string } {
  const trimmed = text.trim();
  if (!trimmed) return {};
  if (URL_ONLY.test(trimmed)) {
    return { url: trimmed.startsWith('www.') ? `https://${trimmed}` : trimmed };
  }
  const match = trimmed.match(URL_IN_TEXT);
  if (match) {
    const url = match[0];
    const content = trimmed.replace(url, '').trim();
    return { url, content: content || undefined };
  }
  return { content: trimmed };
}

function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function statusLabel(status: ApiObservation['status'] | 'UPLOADING'): string {
  if (status === 'UPLOADING') return 'Saving…';
  return observationStatusLabel(status);
}

export default function CaptureScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isLight } = useAppTheme();
  const { getToken, userId } = useAuth();
  const { refresh: refreshProgression } = useProgression();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stageLabel, setStageLabel] = useState<string | null>(null);
  const [observationId, setObservationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      if (recorder.isRecording) {
        void recorder.stop();
      }
    };
  }, [recorder]);

  const payload = extractPayload(text);
  const canSend =
    !busy && !recording && Boolean(attachment || payload.content || payload.url);

  const settle = async (token: string, id: string) => {
    const settled = await pollObservationUntilSettled({
      token,
      id,
      intervalMs: 2000,
      shouldContinue: () => activeRef.current,
      onUpdate: (obs) => setStageLabel(statusLabel(obs.status)),
    });
    setStageLabel(statusLabel(settled.status));
    if (settled.status === 'FAILED') {
      setError(settled.processingError || 'Failed');
    }
  };

  const resetComposer = () => {
    setText('');
    setAttachment(null);
    setRecording(false);
  };

  const pickFile = async () => {
    if (busy || recording) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const picked = await DocumentPicker.getDocumentAsync({
      type: [
        'image/*',
        'application/pdf',
        'text/plain',
        'text/markdown',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    setAttachment({
      kind: 'file',
      uri: asset.uri,
      name: asset.name || `capture-${Date.now()}`,
      mimeType: guessMimeType(asset.name || '', asset.mimeType),
    });
    setError(null);
    setStageLabel(null);
    setObservationId(null);
  };

  const startRecording = async () => {
    if (busy) return;
    setError(null);
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError('Microphone permission was denied.');
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
      setAttachment(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      setError('Could not start recording.');
    }
  };

  const stopRecording = async (): Promise<Attachment | null> => {
    try {
      if (recorder.isRecording) {
        await recorder.stop();
      }
    } catch {
      setRecording(false);
      return null;
    }
    setRecording(false);
    const uri = recorder.uri;
    if (!uri) {
      setError('The recording was empty.');
      return null;
    }
    const next: Attachment = {
      kind: 'voice',
      uri,
      name: `voice-${Date.now()}.m4a`,
      mimeType: 'audio/mp4',
    };
    setAttachment(next);
    return next;
  };

  const cancelRecording = async () => {
    try {
      if (recorder.isRecording) {
        await recorder.stop();
      }
    } catch {
      // ignore
    }
    setRecording(false);
  };

  const send = async () => {
    if (busy) return;

    let nextAttachment = attachment;
    if (recording) {
      nextAttachment = await stopRecording();
      if (!nextAttachment) return;
    }

    const next = extractPayload(text);
    if (!nextAttachment && !next.content && !next.url) return;

    setBusy(true);
    setError(null);
    setObservationId(null);
    setStageLabel(statusLabel('UPLOADING'));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const token = await getToken();
      if (!token || !userId) throw new ApiError('Sign in required.', 401);

      const submitted = nextAttachment
        ? await submitCapture({
            userId,
            token,
            source: nextAttachment.kind === 'voice' ? 'VOICE' : 'MANUAL',
            fileUri: nextAttachment.uri,
            fileName: nextAttachment.name,
            mimeType: nextAttachment.mimeType,
            title: next.content?.slice(0, 80),
            content: next.content,
            url: next.url,
          })
        : await submitCapture({
            userId,
            token,
            source: 'MANUAL',
            content: next.content,
            url: next.url,
            title: next.content?.slice(0, 80),
          });

      if (submitted.queued) {
        setStageLabel('Saved on this device');
        resetComposer();
        return;
      }
      void refreshProgression();
      const uploaded = submitted.observation;
      if (!uploaded) throw new ApiError('Capture failed.', 500);
      setObservationId(uploaded.id);
      setStageLabel(statusLabel(uploaded.status));
      resetComposer();
      await settle(token, uploaded.id);
    } catch (err) {
      if (err instanceof ApiError && err.status === 499) {
        setStageLabel('Saved');
        resetComposer();
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Could not save that.');
      setStageLabel(null);
    } finally {
      setBusy(false);
    }
  };

  const attachmentIcon =
    attachment?.kind === 'voice'
      ? 'mic'
      : attachment?.mimeType.startsWith('image/')
        ? 'image'
        : 'insert-drive-file';

  return (
    <TabScreenSwipe>
      <ScreenGradient>
        <FadeInContent>
          <View
            style={[
              styles.screen,
              {
                paddingTop: insets.top + 8,
                paddingBottom: insets.bottom + FLOATING_TAB_BAR_CONTENT + 16,
              },
            ]}
          >
            <Animated.View entering={FadeIn.duration(240)} style={styles.hero}>
              <Text style={[styles.title, { color: colors.text }]}>Capture</Text>
              <Text style={[styles.lead, { color: colors.textSecondary }]}>
                What’s on your mind?
              </Text>
            </Animated.View>

            <View style={[styles.widget, { backgroundColor: colors.surfaceElevated }]}>
              {recording ? (
                <View style={[styles.recordBar, { backgroundColor: colors.primaryContainer }]}>
                  <View style={[styles.recordDot, { backgroundColor: colors.text }]} />
                  <Text style={[styles.recordLabel, { color: colors.text }]}>
                    Recording {formatClock(recorderState.durationMillis ?? 0)}
                  </Text>
                  <Pressable
                    onPress={() => void cancelRecording()}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel recording"
                  >
                    <Text style={[styles.recordCancel, { color: colors.textSecondary }]}>Cancel</Text>
                  </Pressable>
                </View>
              ) : null}

              {attachment && !recording ? (
                <View style={[styles.chip, { backgroundColor: colors.primaryContainer }]}>
                  <MaterialIcons name={attachmentIcon} size={18} color={colors.text} />
                  <Text style={[styles.chipName, { color: colors.text }]} numberOfLines={1}>
                    {attachment.kind === 'voice' ? 'Voice note' : attachment.name}
                  </Text>
                  <Pressable
                    onPress={() => setAttachment(null)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Remove attachment"
                  >
                    <MaterialIcons name="close" size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
              ) : null}

              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={
                  recording
                    ? 'Add a title if you want…'
                    : attachment
                      ? 'Add a note or paste a link…'
                      : 'Write a note, paste a link…'
                }
                placeholderTextColor={colors.inputPlaceholder}
                multiline
                editable={!busy}
                keyboardAppearance={isLight ? 'light' : 'dark'}
                accessibilityLabel="Capture"
                style={[styles.input, { color: colors.text }]}
              />

              <View style={styles.toolbar}>
                <Pressable
                  onPress={() => void pickFile()}
                  disabled={busy || recording}
                  accessibilityRole="button"
                  accessibilityLabel="Attach a file"
                  style={[styles.toolBtn, { opacity: busy || recording ? 0.35 : 1 }]}
                >
                  <MaterialIcons name="add" size={24} color={colors.text} />
                </Pressable>

                <View style={styles.toolbarSpacer} />

                <Pressable
                  onPress={() => {
                    if (recording) {
                      void stopRecording();
                      return;
                    }
                    void startRecording();
                  }}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={recording ? 'Stop recording' : 'Record voice'}
                  style={[
                    styles.toolBtn,
                    recording && { backgroundColor: colors.primaryContainer },
                    { opacity: busy ? 0.35 : 1 },
                  ]}
                >
                  <MaterialIcons
                    name={recording ? 'stop' : 'mic'}
                    size={22}
                    color={colors.text}
                  />
                </Pressable>

                <Pressable
                  onPress={() => void send()}
                  disabled={!canSend && !recording}
                  accessibilityRole="button"
                  accessibilityLabel="Save capture"
                  style={[
                    styles.send,
                    {
                      backgroundColor:
                        canSend || recording ? colors.primary : colors.surfaceContainerHigh,
                    },
                  ]}
                >
                  {busy ? (
                    <ActivityIndicator color={colors.onPrimary} size="small" />
                  ) : (
                    <MaterialIcons
                      name="arrow-upward"
                      size={20}
                      color={canSend || recording ? colors.onPrimary : colors.textDisabled}
                    />
                  )}
                </Pressable>
              </View>
            </View>

            <Text style={[styles.hint, { color: colors.textMuted }]}>
              One place for files, voice, notes, and links
            </Text>

            {stageLabel ? (
              <View style={[styles.statusCard, { backgroundColor: colors.surfaceElevated }]}>
                {busy ? <ActivityIndicator color={colors.text} /> : null}
                <Text style={[styles.status, { color: colors.textSecondary }]}>{stageLabel}</Text>
              </View>
            ) : null}

            {error ? (
              <Text style={[styles.error, { color: colors.text }]}>{error}</Text>
            ) : null}

            {observationId ? (
              <PressScale
                onPress={() => router.push(`/(app)/observation/${observationId}`)}
                accessibilityLabel="Open memory"
                style={[styles.openBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.openLabel, { color: colors.onPrimary }]}>Open</Text>
              </PressScale>
            ) : null}
          </View>
        </FadeInContent>
      </ScreenGradient>
    </TabScreenSwipe>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
    gap: 16,
  },
  hero: {
    alignItems: 'center',
    gap: 6,
    paddingBottom: 4,
  },
  title: {
    fontFamily: 'Roboto_600SemiBold',
    fontSize: 34,
    lineHeight: 41,
    letterSpacing: 0.4,
  },
  lead: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.41,
  },
  widget: {
    borderRadius: 26,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  recordBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  recordDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  recordLabel: {
    flex: 1,
    fontFamily: 'Roboto_500Medium',
    fontSize: 14,
  },
  recordCancel: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 14,
  },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 7,
    maxWidth: '100%',
  },
  chipName: {
    flexShrink: 1,
    fontFamily: 'Roboto_500Medium',
    fontSize: 14,
    maxWidth: 220,
  },
  input: {
    minHeight: 96,
    maxHeight: 180,
    fontFamily: 'Roboto_400Regular',
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.41,
    paddingHorizontal: 4,
    paddingTop: Platform.OS === 'ios' ? 6 : 4,
    textAlignVertical: 'top',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toolbarSpacer: { flex: 1 },
  toolBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  send: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 13,
    textAlign: 'center',
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  status: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 15,
  },
  error: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 14,
    textAlign: 'center',
  },
  openBtn: {
    alignSelf: 'center',
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  openLabel: {
    fontFamily: 'Roboto_600SemiBold',
    fontSize: 17,
    letterSpacing: -0.41,
  },
});
