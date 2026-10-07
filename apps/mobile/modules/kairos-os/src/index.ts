import { NativeModulesProxy, requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

export type PendingOsCapture = {
  content?: string;
  url?: string;
  title?: string;
  source?: 'KEYBOARD' | 'SHARE' | 'WIDGET' | 'VOICE' | 'QUICK_CAPTURE' | 'MANUAL';
  fileUri?: string;
  fileName?: string;
  mimeType?: string;
};

type KairosOsNative = {
  setAuthToken(token: string | null): Promise<void>;
  setApiBaseUrl(url: string): Promise<void>;
  getPendingCapture(): Promise<PendingOsCapture | null>;
  clearPendingCapture(): Promise<void>;
  refreshWidget(insight?: string): Promise<void>;
};

function getNative(): KairosOsNative | null {
  try {
    return requireNativeModule<KairosOsNative>('KairosOs');
  } catch {
    if (NativeModulesProxy?.KairosOs) {
      return NativeModulesProxy.KairosOs as KairosOsNative;
    }
    return null;
  }
}

export const KairosOs = {
  isAvailable(): boolean {
    return getNative() != null;
  },

  async setAuthToken(token: string | null): Promise<void> {
    const native = getNative();
    if (!native || !token) return;
    await native.setAuthToken(token);
  },

  async setApiBaseUrl(url: string): Promise<void> {
    const native = getNative();
    if (!native) return;
    await native.setApiBaseUrl(url);
  },

  async getPendingCapture(): Promise<PendingOsCapture | null> {
    const native = getNative();
    if (!native) return null;
    return native.getPendingCapture();
  },

  async clearPendingCapture(): Promise<void> {
    const native = getNative();
    if (!native) return;
    await native.clearPendingCapture();
  },

  async refreshWidget(insight?: string): Promise<void> {
    const native = getNative();
    if (!native) return;
    await native.refreshWidget(insight);
  },

  platform: Platform.OS,
};

export default KairosOs;
