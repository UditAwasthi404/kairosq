import { NativeModulesProxy, requireNativeModule } from 'expo-modules-core';
import { PermissionsAndroid, Platform } from 'react-native';

export type RecallDiagnostics = {
  framesSampled: number;
  framesChanged: number;
  ocrRuns: number;
  ocrNonEmpty: number;
  averageOcrTextLength: number;
  maxOcrTextLength?: number;
  averageOcrConfidence?: number | null;
  eventsCreated: number;
  eventsCoalesced: number;
  eventsDropped: number;
  lastOcrAt: number | null;
  lastEventAt: number | null;
  lastOcrTextLength: number;
  lastRelation: string;
};

export type RecallStatus = {
  state: string;
  permission: string;
  capturing: boolean;
  /** True while the foreground service is actively sampling screens. */
  on?: boolean;
  /** User asked Recall to stay on until they turn it off. */
  userEnabled?: boolean;
  paused?: boolean;
  queuedCount: number;
  lastError: string | null;
  lastUploadAt: number | null;
  /** True while a sync batch is uploading to the server. */
  uploading?: boolean;
  /** How many events were drained in the last successful upload. */
  lastUploadBatchSize?: number;
  entitlementCached: boolean | null;
  notificationPermission?: boolean;
  platform?: string;
  diagnostics?: RecallDiagnostics;
};

export type RecallConfig = {
  apiBaseUrl?: string;
  sampleIntervalMs?: number;
  maxOcrPerMinute?: number;
  denylistPackages?: string[];
  entitlementAllowed?: boolean;
};

export type ConsentResult = {
  granted: boolean;
  permission: string;
};

type KairosRecallNative = {
  prepare(): Promise<RecallStatus>;
  requestConsent(): Promise<ConsentResult>;
  start(): Promise<RecallStatus>;
  pause(): Promise<RecallStatus>;
  resume(): Promise<RecallStatus>;
  stop(): Promise<RecallStatus>;
  getStatus(): Promise<RecallStatus>;
  flushUploads?: () => Promise<RecallStatus>;
  setAuthToken(token: string | null): Promise<void>;
  clearLocalData(): Promise<RecallStatus>;
  setConfig(config: RecallConfig): Promise<RecallStatus>;
  hasNotificationPermission?: () => Promise<boolean>;
};

const IDLE: RecallStatus = {
  state: 'unavailable',
  permission: 'unsupported',
  capturing: false,
  on: false,
  userEnabled: false,
  queuedCount: 0,
  lastError: Platform.OS === 'android' ? 'Native Recall module unavailable' : 'Android only',
  lastUploadAt: null,
  uploading: false,
  lastUploadBatchSize: 0,
  entitlementCached: null,
  platform: Platform.OS,
};

function getNative(): KairosRecallNative | null {
  if (Platform.OS !== 'android') return null;
  try {
    return requireNativeModule<KairosRecallNative>('KairosRecall');
  } catch {
    if (NativeModulesProxy?.KairosRecall) {
      return NativeModulesProxy.KairosRecall as KairosRecallNative;
    }
    return null;
  }
}

async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (typeof Platform.Version === 'number' && Platform.Version < 33) return true;

  const granted = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  );
  if (granted) return true;

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    {
      title: 'Recall notification permission',
      message:
        'Kairos shows a persistent notification while Recall is capturing your screen.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    },
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export const Recall = {
  isAvailable(): boolean {
    return Platform.OS === 'android' && getNative() != null;
  },

  async prepare(): Promise<RecallStatus> {
    const native = getNative();
    if (!native) return IDLE;
    return native.prepare();
  },

  async requestConsent(): Promise<ConsentResult> {
    const native = getNative();
    if (!native) return { granted: false, permission: 'unsupported' };
    return native.requestConsent();
  },

  async ensureNotificationPermission(): Promise<boolean> {
    return ensureNotificationPermission();
  },

  /**
   * Turn Recall on: notifications → MediaProjection consent → start capture.
   * Capture keeps running in a foreground service until turnOff().
   */
  async turnOn(): Promise<RecallStatus> {
    return Recall.enable();
  },

  /** @deprecated Prefer turnOn() */
  async enable(): Promise<RecallStatus> {
    const native = getNative();
    if (!native) return IDLE;

    const notificationsOk = await ensureNotificationPermission();
    if (!notificationsOk) {
      throw new Error(
        'Notification permission is required so Recall can run as a foreground service.',
      );
    }

    const consent = await native.requestConsent();
    if (!consent.granted) {
      throw new Error('Screen capture permission was denied.');
    }

    return native.start();
  },

  async start(): Promise<RecallStatus> {
    const native = getNative();
    if (!native) return IDLE;
    return native.start();
  },

  async pause(): Promise<RecallStatus> {
    const native = getNative();
    if (!native) return IDLE;
    return native.pause();
  },

  async resume(): Promise<RecallStatus> {
    const native = getNative();
    if (!native) return IDLE;

    const current = await native.getStatus().catch(() => null);
    if (current?.state === 'paused' && current.permission === 'granted') {
      return native.resume();
    }

    return Recall.turnOn();
  },

  /** Turn Recall off until the user turns it on again. */
  async turnOff(): Promise<RecallStatus> {
    return Recall.stop();
  },

  async stop(): Promise<RecallStatus> {
    const native = getNative();
    if (!native) return IDLE;
    return native.stop();
  },

  async getStatus(): Promise<RecallStatus> {
    const native = getNative();
    if (!native) return IDLE;
    return native.getStatus();
  },

  /** Push queued events to the server now (drains outbox in batches). */
  async flushUploads(): Promise<RecallStatus> {
    const native = getNative();
    if (!native) return IDLE;
    if (typeof native.flushUploads === 'function') {
      return native.flushUploads();
    }
    return native.getStatus();
  },

  isOn(status?: RecallStatus | null): boolean {
    return Boolean(status?.capturing || status?.on);
  },

  async setAuthToken(token: string | null): Promise<void> {
    const native = getNative();
    if (!native) return;
    // Only push non-empty tokens. Clearing happens via stop/clearLocalData.
    if (token == null || token === '') return;
    await native.setAuthToken(token);
  },

  async clearLocalData(): Promise<RecallStatus> {
    const native = getNative();
    if (!native) return IDLE;
    return native.clearLocalData();
  },

  async setConfig(config: RecallConfig): Promise<RecallStatus> {
    const native = getNative();
    if (!native) return IDLE;
    return native.setConfig(config);
  },
};

export default Recall;
