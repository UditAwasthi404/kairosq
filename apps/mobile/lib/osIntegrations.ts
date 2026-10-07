import NativeKairosOs from 'kairos-os';

import { apiBaseUrl } from './config';
import { submitCapture } from './capture';
import type { CaptureSource } from './api';
import { presentLocalNotification, uploadCopy } from './notifications';

type PendingOsCapture = {
  content?: string;
  url?: string;
  title?: string;
  source?: CaptureSource;
  fileUri?: string;
  fileName?: string;
  mimeType?: string;
};

export const KairosOs = {
  isAvailable(): boolean {
    return NativeKairosOs.isAvailable();
  },

  async setAuthToken(token: string | null): Promise<void> {
    if (!NativeKairosOs.isAvailable()) return;
    await NativeKairosOs.setAuthToken(token);
    await NativeKairosOs.setApiBaseUrl(apiBaseUrl);
  },

  async refreshWidget(insight?: string): Promise<void> {
    if (!NativeKairosOs.isAvailable()) return;
    await NativeKairosOs.refreshWidget(insight);
  },

  async takePendingCapture(): Promise<PendingOsCapture | null> {
    if (!NativeKairosOs.isAvailable()) return null;
    return (await NativeKairosOs.getPendingCapture()) as PendingOsCapture | null;
  },

  async clearPendingCapture(): Promise<void> {
    if (!NativeKairosOs.isAvailable()) return;
    await NativeKairosOs.clearPendingCapture();
  },
};

const consumeInflight = new Map<string, Promise<void>>();

export function consumePendingOsCapture(
  getToken: () => Promise<string | null>,
  userId: string,
): Promise<void> {
  let inflight = consumeInflight.get(userId);
  if (!inflight) {
    inflight = consumePendingOsCaptureOnce(getToken, userId).finally(() => {
      consumeInflight.delete(userId);
    });
    consumeInflight.set(userId, inflight);
  }
  return inflight;
}

async function consumePendingOsCaptureOnce(
  getToken: () => Promise<string | null>,
  userId: string,
): Promise<void> {
  const pending = await KairosOs.takePendingCapture();
  if (!pending) return;
  const token = await getToken();
  if (!token) return;
  if (!pending.content && !pending.url && !pending.fileUri) return;
  const fileUri = normalizeFileUri(pending.fileUri);
  const source = pending.source || 'SHARE';
  const result = await submitCapture({
    userId,
    token,
    source,
    content: pending.content,
    url: pending.url,
    title: pending.title,
    fileUri,
    fileName: pending.fileName,
    mimeType: pending.mimeType,
  });
  await KairosOs.clearPendingCapture();
  void presentLocalNotification(
    uploadCopy({
      queued: result.queued,
      source,
      observationId: result.observation?.id,
    }),
  );
}

function normalizeFileUri(uri?: string): string | undefined {
  if (!uri) return undefined;
  if (
    uri.startsWith('file:') ||
    uri.startsWith('content:') ||
    uri.startsWith('http:') ||
    uri.startsWith('https:')
  ) {
    return uri;
  }
  return `file://${uri}`;
}
