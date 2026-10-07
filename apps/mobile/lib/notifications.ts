import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import {
  registerDevicePushToken,
  type CaptureSource,
  type DevicePlatform,
} from './api';

export const UPDATES_CHANNEL = 'kairos_updates';

export type NotificationKind =
  | 'upload_saved'
  | 'upload_queued'
  | 'upload_flushed'
  | 'recall_uploaded';

export type LocalNotifyInput = {
  kind: NotificationKind;
  title: string;
  body: string;
  observationId?: string;
  count?: number;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function observationHref(observationId: string): string {
  return `/(app)/observation/${observationId}`;
}

export function hrefFromNotificationData(
  data: Record<string, unknown> | undefined | null,
): string | null {
  if (!data) return null;
  if (typeof data.href === 'string' && data.href.startsWith('/')) {
    return data.href;
  }
  if (typeof data.observationId === 'string' && data.observationId) {
    return observationHref(data.observationId);
  }
  return null;
}

export function uploadCopy(params: {
  queued: boolean;
  source?: CaptureSource | string | null;
  observationId?: string;
}): LocalNotifyInput {
  const source = (params.source || '').toUpperCase();
  const fromShare =
    source === 'SHARE' || source === 'KEYBOARD' || source === 'WIDGET';
  if (params.queued) {
    return {
      kind: 'upload_queued',
      title: fromShare ? 'Saved on this device' : 'Waiting to sync',
      body: 'Kairos will upload this capture when you are back online.',
      observationId: params.observationId,
    };
  }
  return {
    kind: 'upload_saved',
    title: fromShare ? 'Saved to Kairos' : 'Uploaded',
    body: 'Your capture is processing. You will get a notification when it is ready.',
    observationId: params.observationId,
  };
}

export function flushedCopy(count: number): LocalNotifyInput | null {
  if (count <= 0) return null;
  return {
    kind: 'upload_flushed',
    title: count === 1 ? 'Capture uploaded' : `${count} captures uploaded`,
    body:
      count === 1
        ? 'The note waiting on this device is now in Kairos.'
        : 'The notes waiting on this device are now in Kairos.',
    count,
  };
}

export async function ensureUpdatesChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(UPDATES_CHANNEL, {
    name: 'Kairos updates',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 180],
    lightColor: '#4A2341',
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  await ensureUpdatesChannel();
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  return status === 'granted';
}

export async function presentLocalNotification(
  input: LocalNotifyInput,
): Promise<void> {
  try {
    const allowed = await requestNotificationPermission();
    if (!allowed) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: input.title,
        body: input.body,
        data: {
          kind: input.kind,
          href: input.observationId
            ? observationHref(input.observationId)
            : '/(app)/notifications',
          ...(input.observationId ? { observationId: input.observationId } : {}),
        },
        ...(Platform.OS === 'android' ? { channelId: UPDATES_CHANNEL } : null),
      },
      trigger: null,
    });
  } catch {
    // Local notification is best-effort.
  }
}

export async function registerPushForSignedInUser(
  getToken: () => Promise<string | null>,
): Promise<string | null> {
  try {
    const allowed = await requestNotificationPermission();
    if (!allowed) return null;
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    if (!projectId) return null;
    const expoToken = await Notifications.getExpoPushTokenAsync({ projectId });
    const authToken = await getToken();
    if (!authToken) return expoToken.data;
    const platform: DevicePlatform =
      Platform.OS === 'ios' ? 'IOS' : 'ANDROID';
    await registerDevicePushToken({
      token: authToken,
      expoPushToken: expoToken.data,
      platform,
    });
    await SecureStore.setItemAsync('kairos.device.expoPushToken', expoToken.data);
    await SecureStore.setItemAsync('kairos.device.pushEnabled', 'true');
    return expoToken.data;
  } catch {
    // Expo Go / missing FCM still allows local notifications.
    return null;
  }
}
