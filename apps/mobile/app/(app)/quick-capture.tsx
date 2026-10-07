import { useAuth } from '@clerk/expo';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ReduceMotion, ZoomIn } from 'react-native-reanimated';

import { ThemedText } from '../../components/ThemedText';
import { SurfaceCard } from '../../components/ui/SectionHeader';
import { SoftPage, SoftTitle } from '../../components/ui/SoftScreen';
import { ThemedButton } from '../../components/ui/ThemedButton';
import { CircularControl } from '../../components/ui/system/CircularControl';
import { ThemedInput } from '../../components/ui/ThemedInput';
import { DotBurst } from '../../components/ui/Motion';
import { ApiError } from '../../lib/api';
import { submitCapture } from '../../lib/capture';
import { saveMessage } from '../../lib/engagement';
import { useAppTheme } from '../../providers/ThemeProvider';
import { useProgression } from '../../providers/ProgressionProvider';

type Mode = 'text' | 'voice';

export default function QuickCaptureScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { getToken, userId } = useAuth();
  const { refresh: refreshProgression } = useProgression();
  const params = useLocalSearchParams<{
    mode?: string;
    text?: string;
    url?: string;
    title?: string;
    source?: string;
    prompt?: string;
  }>();
  const prompt = params.prompt ? String(params.prompt) : null;

  const initialMode: Mode = params.mode === 'voice' ? 'voice' : 'text';
  const [mode, setMode] = useState<Mode>(initialMode);
  const [text, setText] = useState(params.text || '');
  const [url, setUrl] = useState(params.url || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  useEffect(() => {
    if (params.text) setText(String(params.text));
    if (params.url) setUrl(String(params.url));
    if (params.mode === 'voice') setMode('voice');
  }, [params.text, params.url, params.mode]);

  const onSave = async () => {
    const content = text.trim();
    const link = url.trim();
    if (!content && !link) {
      setError('Write a thought or paste a link.');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const token = await getToken();
      if (!token || !userId) throw new ApiError('Sign in required.', 401);
      const source =
        params.source === 'WIDGET'
          ? 'WIDGET'
          : params.source === 'SHARE'
            ? 'SHARE'
            : 'QUICK_CAPTURE';
      const result = await submitCapture({
        userId,
        token,
        source,
        content: content || undefined,
        url: link || undefined,
        title: params.title ? String(params.title) : undefined,
      });
      if (!result.queued) void refreshProgression();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSavedCount((count) => count + 1);
      if (result.queued) {
        setMessage('Saved on this device. Will sync when you are online.');
      } else {
        setMessage(saveMessage());
        setText('');
        setUrl('');
      }
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err instanceof ApiError ? err.message : 'Could not save that capture.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SoftPage>
      <SoftTitle>Capture</SoftTitle>
      <ThemedText colorKey="textSecondary" style={styles.lead}>
        What's on your mind? Kairos will infer topics and meaning automatically.
      </ThemedText>

      <View style={styles.modes}>
        <CircularControl
          icon="edit-3"
          caption="Text"
          primary={mode === 'text'}
          onPress={() => setMode('text')}
        />
        <CircularControl
          icon="mic"
          caption="Voice"
          onPress={() => router.push('/(app)/voice-capture')}
        />
        <CircularControl
          icon="paperclip"
          caption="File"
          onPress={() => router.push('/(app)/capture-file')}
        />
      </View>

      {prompt ? (
        <Animated.View entering={FadeInDown.duration(320).reduceMotion(ReduceMotion.System)}>
          <SurfaceCard style={{ borderColor: colors.borderAccent, backgroundColor: colors.primaryContainer }}>
            <ThemedText colorKey="primary" style={styles.promptKicker}>
              TODAY’S REFLECTION
            </ThemedText>
            <ThemedText colorKey="text" style={styles.promptText}>
              {prompt}
            </ThemedText>
          </SurfaceCard>
        </Animated.View>
      ) : null}

      <View>
        <ThemedInput
          value={text}
          onChangeText={(next) => {
            setText(next);
            if (message) setMessage(null);
            if (error) setError(null);
          }}
          placeholder={prompt ? 'A sentence is enough…' : 'Type a thought, reflection, or note…'}
          multiline
          autoFocus
          accessibilityLabel={prompt ? `Answer: ${prompt}` : 'Capture text'}
          style={styles.note}
        />
        {words > 0 ? (
          <Animated.View entering={FadeIn.duration(200)} style={styles.depthRow}>
            <View style={[styles.depthTrack, { backgroundColor: colors.surfaceContainer }]}>
              <View
                style={[
                  styles.depthFill,
                  { backgroundColor: colors.primary, width: `${Math.min(100, (words / 20) * 100)}%` },
                ]}
              />
            </View>
            <ThemedText colorKey={words >= 20 ? 'primary' : 'textMuted'} style={styles.depthText}>
              {words >= 20 ? 'Rich detail. Easy to find later.' : words >= 8 ? 'Good. A little more context helps.' : `${words} ${words === 1 ? 'word' : 'words'}`}
            </ThemedText>
          </Animated.View>
        ) : null}
      </View>
      <ThemedInput
        value={url}
        onChangeText={setUrl}
        placeholder="Optional link (https://…)"
        autoCapitalize="none"
        accessibilityLabel="Optional URL"
      />

      {busy ? (
        <View style={styles.busyRow}>
          <ActivityIndicator color={colors.primary} />
          <ThemedText colorKey="textSecondary" style={{ fontSize: 14 }}>
            Kairos is saving your memory…
          </ThemedText>
        </View>
      ) : null}

      {message ? (
        <Animated.View key={savedCount} entering={ZoomIn.springify().damping(14).reduceMotion(ReduceMotion.System)}>
          <SurfaceCard style={{ borderColor: colors.success, backgroundColor: colors.tintGreen, overflow: 'visible' }}>
            <View style={styles.successRow}>
              <View style={styles.successIcon}>
                <DotBurst color={colors.success} size={90} />
                <MaterialIcons name="check-circle" size={22} color={colors.success} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <ThemedText colorKey="text" style={{ fontWeight: '600' }}>
                  {message}
                </ThemedText>
                {savedCount > 1 ? (
                  <ThemedText colorKey="textSecondary" style={styles.sessionText}>
                    {savedCount} kept this session.
                  </ThemedText>
                ) : null}
              </View>
            </View>
          </SurfaceCard>
        </Animated.View>
      ) : null}

      {error ? (
        <Animated.View entering={FadeIn.duration(180)}>
          <SurfaceCard style={{ borderColor: colors.error, backgroundColor: colors.errorSurface }}>
            <View style={styles.successRow}>
              <MaterialIcons name="error-outline" size={20} color={colors.error} />
              <ThemedText colorKey="error" style={styles.error}>
                {error}
              </ThemedText>
            </View>
          </SurfaceCard>
        </Animated.View>
      ) : null}

      <ThemedButton
        label={busy ? 'Saving…' : 'Save to Kairos'}
        size="lg"
        variant="primary"
        disabled={busy || (!text.trim() && !url.trim())}
        onPress={() => void onSave()}
      />
      <ThemedButton
        label="Done"
        variant="secondary"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/(app)'))}
      />
    </SoftPage>
  );
}

const styles = StyleSheet.create({
  lead: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 8,
  },
  modes: {
    flexDirection: 'row',
    gap: 12,
  },
  mode: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    paddingVertical: 12,
  },
  modeLabel: {
    fontSize: 15,
  },
  note: {
    minHeight: 140,
    textAlignVertical: 'top',
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  successIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionText: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 13,
  },
  promptKicker: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  promptText: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 19,
    lineHeight: 26,
  },
  depthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  depthTrack: {
    width: 56,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  depthFill: {
    height: '100%',
    borderRadius: 2,
  },
  depthText: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 12,
  },
  error: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 14,
  },
});
