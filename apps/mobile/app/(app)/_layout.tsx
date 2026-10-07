import { useAuth } from '@clerk/expo';
import * as Notifications from 'expo-notifications';
import { Redirect, Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Platform, StyleSheet, View } from 'react-native';

import { OfflineBanner } from '../../components/ui/NetworkStatus';
import { RewardToast } from '../../components/ui/RewardToast';
import { ApiError, fetchDashboard } from '../../lib/api';
import { flushCaptureQueue, resumeCaptureQueue } from '../../lib/capture';
import { listPendingCaptures } from '../../lib/captureQueue';
import { onReconnect } from '../../lib/network';
import { hydrateCache, writeCache } from '../../lib/persistentCache';
import {
  flushedCopy,
  hrefFromNotificationData,
  presentLocalNotification,
  registerPushForSignedInUser,
} from '../../lib/notifications';
import { recordCaptureSync, setCaptureSyncInflight } from '../../lib/syncStatus';
import { consumePendingOsCapture, KairosOs } from '../../lib/osIntegrations';
import { noteSegments } from '../../lib/lastRoute';
import { ensureRecallReady } from '../../lib/recallSync';
import { useAppTheme } from '../../providers/ThemeProvider';
import Recall from 'kairos-recall';
import { ProgressionProvider } from '../../providers/ProgressionProvider';
import * as SecureStore from 'expo-secure-store';

function RememberRoute() {
  const segments = useSegments();
  useEffect(() => {
    noteSegments(segments as string[]);
  }, [segments]);
  return null;
}

export default function AppLayout() {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const { colors } = useAppTheme();
  const router = useRouter();
  const handledResponseRef = useRef<string | null>(null);
  const [cacheUser, setCacheUser] = useState<string | null>(null);

  // Keep a fresh auth token in the native Recall service so background uploads
  // do not 401 and (previously) tear down MediaProjection.
  useEffect(() => {
    if (!isSignedIn || !userId) return;
    resumeCaptureQueue(userId);

    let cancelled = false;

    const syncNative = (force = false) => {
      if (cancelled) return;
      void getToken().then(async (token) => {
        if (!token) return;
        await KairosOs.setAuthToken(token);
        try {
          const dashboard = await fetchDashboard(token);
          writeCache('dashboard', dashboard);
          await KairosOs.refreshWidget(
            dashboard.insight.empty
              ? dashboard.insight.body
              : `You've captured ${dashboard.todayCount} memories today.\n\n${dashboard.insight.body}`,
          );
        } catch {
          // Widget keeps its last cached insight.
        }
      });
      if (Platform.OS === 'android' && Recall.isAvailable()) {
        void ensureRecallReady(getToken, { force, userId });
      }
    };

    const flush = async () => {
      setCaptureSyncInflight(true);
      try {
        const token = await getToken();
        if (token) {
          let result;
          try {
            result = await flushCaptureQueue(userId, token);
          } catch (error) {
            if (!(error instanceof ApiError) || error.status !== 401) throw error;
            const freshToken = await getToken({ skipCache: true });
            if (!freshToken) throw error;
            result = await flushCaptureQueue(userId, freshToken);
          }
          recordCaptureSync(result.flushed, result.remaining);
          const flushed = flushedCopy(result.flushed);
          if (flushed) void presentLocalNotification(flushed);
        }
      } catch {
        // Queue remains local until the next successful flush.
      } finally {
        setCaptureSyncInflight(false);
      }
    };

    void SecureStore.getItemAsync('kairos.device.pushEnabled').then((enabled) => {
      if (enabled !== 'false') void registerPushForSignedInUser(getToken);
    });
    void listPendingCaptures(userId).then((items) => {
      recordCaptureSync(0, items.length);
    }).catch(() => undefined);
    syncNative();
    void consumePendingOsCapture(getToken, userId);
    void flush();
    const interval = setInterval(() => syncNative(true), 3 * 60_000);
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        syncNative();
        void consumePendingOsCapture(getToken, userId);
        void flush();
      }
    });
    const unsubscribeReconnect = onReconnect(() => {
      syncNative();
      void consumePendingOsCapture(getToken, userId);
      void flush();
    });

    return () => {
      cancelled = true;
      clearInterval(interval);
      sub.remove();
      unsubscribeReconnect();
    };
  }, [isSignedIn, getToken, userId]);

  useEffect(() => {
    if (!isSignedIn || !userId) return;
    let cancelled = false;
    setCacheUser(null);
    void hydrateCache(userId).finally(() => {
      if (!cancelled) setCacheUser(userId);
    });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, userId]);

  useEffect(() => {
    if (!isSignedIn) return;

    const openFromData = (data: Record<string, unknown> | undefined) => {
      const href = hrefFromNotificationData(data);
      if (!href) return;
      const key = `${href}:${JSON.stringify(data ?? {})}`;
      if (handledResponseRef.current === key) return;
      handledResponseRef.current = key;
      router.push(href as `/${string}`);
    };

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      openFromData(response.notification.request.content.data as Record<string, unknown>);
    });

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      openFromData(response.notification.request.content.data as Record<string, unknown>);
    });

    return () => {
      sub.remove();
    };
  }, [isSignedIn, router]);

  if (!isLoaded) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.text} />
      </View>
    );
  }

  if (!isSignedIn) {
    return <Redirect href="/" />;
  }

  if (cacheUser !== userId) {
    return <View style={[styles.loading, { backgroundColor: colors.background }]} />;
  }

  return (
    <ProgressionProvider>
    <View style={styles.root}>
    <RememberRoute />
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontFamily: 'Roboto_600SemiBold',
          fontSize: 16,
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'ios_from_right',
        animationDuration: 300,
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
        gestureDirection: 'horizontal',
        animationTypeForReplace: 'push',
        ...(Platform.OS === 'ios'
          ? {
              headerBackButtonDisplayMode: 'minimal' as const,
            }
          : null),
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="quick-capture"
        options={{
          title: 'Capture',
          presentation: 'modal',
          animation: 'slide_from_bottom',
          gestureEnabled: true,
          gestureDirection: 'vertical',
        }}
      />
      <Stack.Screen
        name="voice-capture"
        options={{
          title: 'Voice',
          presentation: 'modal',
          animation: 'slide_from_bottom',
          gestureEnabled: true,
          gestureDirection: 'vertical',
        }}
      />
      <Stack.Screen
        name="capture-file"
        options={{
          title: 'Photo or file',
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen name="insight" options={{ title: 'Today' }} />
      <Stack.Screen name="dashboard" options={{ title: 'Dashboard' }} />
      <Stack.Screen name="predictions" options={{ title: 'Predictions' }} />
      <Stack.Screen name="brief" options={{ title: 'Brief' }} />
      <Stack.Screen name="timeline" options={{ title: 'Timeline' }} />
      <Stack.Screen name="memory/[id]" options={{ title: 'Memory' }} />
      <Stack.Screen name="observation/[id]" options={{ title: 'Memory' }} />
      <Stack.Screen name="search" options={{ title: 'Search' }} />
      <Stack.Screen name="topics/index" options={{ title: 'Topics' }} />
      <Stack.Screen name="topics/[id]" options={{ title: 'Topic' }} />
      <Stack.Screen name="entities/index" options={{ title: 'Entities' }} />
      <Stack.Screen name="entities/[id]" options={{ title: 'Entity' }} />
      <Stack.Screen name="projects/index" options={{ title: 'Projects' }} />
      <Stack.Screen name="projects/new" options={{ title: 'New' }} />
      <Stack.Screen name="projects/[id]/index" options={{ title: 'Project' }} />
      <Stack.Screen name="projects/[id]/add" options={{ title: 'Add' }} />
      <Stack.Screen name="observation/projects" options={{ title: 'Projects' }} />
      <Stack.Screen name="related/[id]" options={{ title: 'Related' }} />
      <Stack.Screen name="activity" options={{ title: 'Activity' }} />
      <Stack.Screen name="notifications" options={{ title: 'Updates' }} />
      <Stack.Screen name="devices" options={{ title: 'Devices' }} />
      <Stack.Screen name="screen-memory" options={{ title: 'Screen memory' }} />
      <Stack.Screen name="progress" options={{ title: 'Progress' }} />
      <Stack.Screen name="insights" options={{ title: 'Insights' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen name="privacy" options={{ title: 'Privacy' }} />
      <Stack.Screen name="data" options={{ title: 'Data' }} />
      <Stack.Screen name="how-it-works/index" options={{ title: 'How it works' }} />
      <Stack.Screen name="how-it-works/[id]" options={{ title: 'How it works' }} />
      <Stack.Screen name="about" options={{ title: 'About' }} />
    </Stack>
    <OfflineBanner />
    <RewardToast />
    </View>
    </ProgressionProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
