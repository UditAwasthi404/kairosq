import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '../ThemedText';
import { ThemedButton } from './ThemedButton';
import { checkConnection, onReconnect, useNetworkStatus } from '../../lib/network';
import { getCaptureSync, subscribeCaptureSync } from '../../lib/syncStatus';
import { useAppTheme } from '../../providers/ThemeProvider';

function useSecondsUntil(at: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (at === null) return;
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [at]);
  if (at === null) return null;
  return Math.max(0, Math.ceil((at - now) / 1_000));
}

function usePendingCaptures(): number {
  const [pending, setPending] = useState(() => getCaptureSync()?.remaining ?? 0);
  useEffect(
    () => subscribeCaptureSync(() => setPending(getCaptureSync()?.remaining ?? 0)),
    [],
  );
  return pending;
}

function openConnectionSettings(): void {
  if (Platform.OS === 'android') {
    void Linking.sendIntent('android.settings.WIRELESS_SETTINGS').catch(() => {
      void Linking.openSettings();
    });
    return;
  }
  void Linking.openSettings();
}

function statusLine(checking: boolean, seconds: number | null): string {
  if (checking) return 'Checking your connection…';
  if (seconds !== null && seconds > 0) return `Trying again in ${seconds}s`;
  return 'Reconnecting automatically';
}

/**
 * Slim top banner shown app-wide while offline. Screens keep showing their
 * on-device copy underneath, so the app never looks frozen.
 */
export function OfflineBanner() {
  const { online, checking, nextCheckAt } = useNetworkStatus();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const seconds = useSecondsUntil(online ? null : nextCheckAt);
  const pending = usePendingCaptures();
  const [backOnline, setBackOnline] = useState(false);

  useEffect(
    () =>
      onReconnect(() => {
        setBackOnline(true);
        setTimeout(() => setBackOnline(false), 2_200);
      }),
    [],
  );

  if (online && !backOnline) return null;

  const title = online
    ? 'Back online · syncing'
    : pending > 0
      ? `Offline · ${pending} ${pending === 1 ? 'capture' : 'captures'} saved on device`
      : 'Offline · showing saved memories';

  return (
    <Animated.View
      entering={FadeInUp.duration(220)}
      exiting={FadeOutUp.duration(220)}
      pointerEvents="box-none"
      style={[styles.bannerWrap, { top: insets.top + 6 }]}
    >
      <Pressable
        onPress={() => {
          if (!online) void checkConnection();
        }}
        accessibilityRole="button"
        accessibilityLabel={online ? title : `${title}. Tap to retry now`}
        style={[
          styles.banner,
          { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
        ]}
      >
        {checking ? (
          <ActivityIndicator size="small" color={colors.textSecondary} />
        ) : (
          <Feather name={online ? 'check-circle' : 'wifi-off'} size={14} color={colors.text} />
        )}
        <ThemedText colorKey="text" style={styles.bannerText} numberOfLines={1}>
          {title}
        </ThemedText>
        {!online ? (
          <ThemedText colorKey="textMuted" style={styles.bannerMeta}>
            {checking ? '' : seconds ? `${seconds}s` : 'Retry'}
          </ThemedText>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

type NetworkErrorScreenProps = {
  /** Re-run the screen's load. Called automatically when the connection returns. */
  onRetry?: () => void;
  /** Optional escape hatch, e.g. open the capture composer (works offline). */
  onCapture?: () => void;
  /** Render inside a section instead of taking the whole screen. */
  compact?: boolean;
};

/**
 * Shown when a screen has nothing cached and cannot reach Kairos. Explains
 * what happened, retries on its own with backoff, reloads the screen the
 * moment the connection returns, and offers the fixes a user can make.
 */
export function NetworkErrorScreen({ onRetry, onCapture, compact = false }: NetworkErrorScreenProps) {
  const { online, checking, nextCheckAt } = useNetworkStatus();
  const { colors } = useAppTheme();
  const seconds = useSecondsUntil(online ? null : nextCheckAt);
  const pending = usePendingCaptures();

  useEffect(() => {
    if (!onRetry) return;
    return onReconnect(onRetry);
  }, [onRetry]);

  useEffect(() => {
    if (!online && nextCheckAt === null && !checking) void checkConnection();
  }, [online, nextCheckAt, checking]);

  const retry = async () => {
    const reachable = await checkConnection();
    if (reachable) onRetry?.();
  };

  const title = online ? 'Kairos is not responding' : 'You are offline';
  const body = online
    ? 'Your connection works, but Kairos did not answer in time. This is usually brief.'
    : 'Kairos could not reach the internet. Nothing is lost: memories already on this device stay readable, and new captures are saved here until you are back.';

  const content = (
    <View style={[styles.errorInner, compact && styles.errorInnerCompact]}>
      <View style={[styles.iconRing, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
        <Feather name={online ? 'cloud-off' : 'wifi-off'} size={compact ? 22 : 30} color={colors.text} />
      </View>
      <ThemedText colorKey="text" style={[styles.errorTitle, compact && styles.errorTitleCompact]}>
        {title}
      </ThemedText>
      <ThemedText colorKey="textSecondary" style={styles.errorBody}>
        {body}
      </ThemedText>

      <View style={styles.statusRow} accessibilityLiveRegion="polite">
        {checking ? <ActivityIndicator size="small" color={colors.textSecondary} /> : null}
        <ThemedText colorKey="textMuted" style={styles.statusText}>
          {statusLine(checking, online ? null : seconds)}
        </ThemedText>
      </View>

      <ThemedButton
        label={checking ? 'Checking…' : 'Try again now'}
        disabled={checking}
        onPress={() => void retry()}
        style={styles.primaryButton}
      />
      {!online ? (
        <ThemedButton
          label="Open network settings"
          variant="outline"
          onPress={openConnectionSettings}
          style={styles.primaryButton}
        />
      ) : null}
      {onCapture ? (
        <ThemedButton label="Capture something offline" variant="text" onPress={onCapture} />
      ) : null}

      {!compact && !online ? (
        <View style={[styles.tips, { borderColor: colors.border }]}>
          {[
            'Check that Wi-Fi or mobile data is on',
            'Turn off Airplane mode',
            'If you use a VPN or private DNS, try switching it off',
          ].map((tip) => (
            <View key={tip} style={styles.tipRow}>
              <Feather name="check" size={14} color={colors.textMuted} />
              <ThemedText colorKey="textSecondary" style={styles.tipText}>
                {tip}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}

      {pending > 0 ? (
        <ThemedText colorKey="textMuted" style={styles.pendingText}>
          {pending === 1
            ? '1 capture is waiting on this device and will sync automatically.'
            : `${pending} captures are waiting on this device and will sync automatically.`}
        </ThemedText>
      ) : null}
    </View>
  );

  if (compact) return content;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.errorScroll}
    >
      {content}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bannerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '92%',
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  bannerText: { fontFamily: 'Roboto_500Medium', fontSize: 13, flexShrink: 1 },
  bannerMeta: { fontFamily: 'Roboto_400Regular', fontSize: 12 },
  errorScroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  errorInner: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  errorInnerCompact: { paddingVertical: 16, gap: 10 },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  errorTitle: { fontFamily: 'Roboto_600SemiBold', fontSize: 22, textAlign: 'center' },
  errorTitleCompact: { fontSize: 17 },
  errorBody: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 320,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 22 },
  statusText: { fontFamily: 'Roboto_400Regular', fontSize: 13 },
  primaryButton: { alignSelf: 'stretch', maxWidth: 320, width: '100%' },
  tips: {
    alignSelf: 'stretch',
    maxWidth: 320,
    width: '100%',
    marginTop: 8,
    paddingTop: 14,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tipText: { fontFamily: 'Roboto_400Regular', fontSize: 14, flex: 1 },
  pendingText: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 300,
    marginTop: 4,
  },
});
