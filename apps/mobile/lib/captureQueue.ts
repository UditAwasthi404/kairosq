import * as FileSystem from 'expo-file-system/legacy';

import type { CaptureSource } from './api';

export type PendingCapture = {
  id: string;
  clientCaptureId: string;
  kind: 'text' | 'url' | 'file';
  source: CaptureSource;
  content?: string;
  url?: string;
  title?: string;
  capturedAt: string;
  fileUri?: string;
  fileName?: string;
  mimeType?: string;
  metadata?: Record<string, unknown>;
  lastError?: string;
  attempts: number;
};

const QUEUE_DIR = 'kairos-capture-queue/';
const QUEUE_NAME = 'queue.json';
const operations = new Map<string, Promise<unknown>>();
let legacyQueueRemoved = false;

function queueDir(userId: string): string {
  const base = FileSystem.documentDirectory;
  if (!base) {
    throw new Error('Local storage is unavailable on this device.');
  }
  const scope = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${base}${QUEUE_DIR}${scope}/`;
}

function queueUri(userId: string): string {
  return `${queueDir(userId)}${QUEUE_NAME}`;
}

async function ensureQueueDir(userId: string): Promise<void> {
  if (!legacyQueueRemoved) {
    legacyQueueRemoved = true;
    const base = FileSystem.documentDirectory;
    if (base) {
      await FileSystem.deleteAsync(`${base}kairos-capture-queue.json`, {
        idempotent: true,
      }).catch(() => undefined);
    }
  }
  const dir = queueDir(userId);
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

async function readQueue(userId: string): Promise<PendingCapture[]> {
  await ensureQueueDir(userId);
  const uri = queueUri(userId);
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) return [];
  const raw = await FileSystem.readAsStringAsync(uri);
  const parsed = JSON.parse(raw) as PendingCapture[];
  if (!Array.isArray(parsed)) throw new Error('The local capture queue is invalid.');
  return parsed;
}

async function writeQueue(userId: string, items: PendingCapture[]): Promise<void> {
  await ensureQueueDir(userId);
  const uri = queueUri(userId);
  const tmp = `${uri}.tmp`;
  await FileSystem.writeAsStringAsync(tmp, JSON.stringify(items), {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await FileSystem.moveAsync({ from: tmp, to: uri });
}

function serialize<T>(userId: string, operation: () => Promise<T>): Promise<T> {
  const previous = operations.get(userId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  operations.set(userId, next);
  const cleanup = () => {
    if (operations.get(userId) === next) operations.delete(userId);
  };
  void next.then(cleanup, cleanup);
  return next;
}

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'capture';
}

async function persistAttachment(
  userId: string,
  id: string,
  sourceUri: string,
  fileName: string,
): Promise<string> {
  await ensureQueueDir(userId);
  const target = `${queueDir(userId)}${id}-${safeFileName(fileName)}`;
  if (sourceUri !== target) await FileSystem.copyAsync({ from: sourceUri, to: target });
  return target;
}

export async function enqueueCapture(
  userId: string,
  item: Omit<PendingCapture, 'id' | 'attempts' | 'capturedAt'> & {
    capturedAt?: string;
  },
): Promise<PendingCapture> {
  return serialize(userId, async () => {
    const id = `cap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fileUri =
      item.fileUri && item.fileName
        ? await persistAttachment(userId, id, item.fileUri, item.fileName)
        : item.fileUri;
    const pending: PendingCapture = {
      ...item,
      fileUri,
      id,
      capturedAt: item.capturedAt || new Date().toISOString(),
      attempts: 0,
    };
    const queue = await readQueue(userId);
    queue.push(pending);
    try {
      await writeQueue(userId, queue);
    } catch (error) {
      if (fileUri && fileUri !== item.fileUri) {
        await FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => undefined);
      }
      throw error;
    }
    return pending;
  });
}

export function listPendingCaptures(userId: string): Promise<PendingCapture[]> {
  return serialize(userId, () => readQueue(userId));
}

export function removePendingCapture(userId: string, id: string): Promise<void> {
  return serialize(userId, async () => {
    const queue = await readQueue(userId);
    const removed = queue.find((item) => item.id === id);
    await writeQueue(userId, queue.filter((item) => item.id !== id));
    if (removed?.fileUri?.startsWith(queueDir(userId))) {
      await FileSystem.deleteAsync(removed.fileUri, { idempotent: true }).catch(() => undefined);
    }
  });
}

export function markCaptureAttempt(
  userId: string,
  id: string,
  error: string,
): Promise<void> {
  return serialize(userId, async () => {
    const queue = await readQueue(userId);
    await writeQueue(
      userId,
      queue.map((item) =>
        item.id === id
          ? { ...item, attempts: item.attempts + 1, lastError: error }
          : item,
      ),
    );
  });
}

export async function clearCaptureQueue(userId: string): Promise<void> {
  await serialize(userId, async () => {
    await FileSystem.deleteAsync(queueDir(userId), { idempotent: true });
  });
}
