const mockFiles = new Map<string, string>();
const mockDirs = new Set<string>();

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///docs/',
  EncodingType: { UTF8: 'utf8' },
  getInfoAsync: jest.fn(async (uri: string) => ({
    exists: mockFiles.has(uri) || mockDirs.has(uri),
  })),
  readAsStringAsync: jest.fn(async (uri: string) => {
    const value = mockFiles.get(uri);
    if (value === undefined) throw new Error('missing');
    return value;
  }),
  writeAsStringAsync: jest.fn(async (uri: string, value: string) => {
    mockFiles.set(uri, value);
  }),
  moveAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
    const value = mockFiles.get(from);
    if (value === undefined) throw new Error('missing temporary file');
    mockFiles.set(to, value);
    mockFiles.delete(from);
  }),
  copyAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
    const value = mockFiles.get(from);
    if (value === undefined) throw new Error('missing attachment');
    mockFiles.set(to, value);
  }),
  makeDirectoryAsync: jest.fn(async (uri: string) => {
    mockDirs.add(uri);
  }),
  deleteAsync: jest.fn(async (uri: string) => {
    for (const key of [...mockFiles.keys()]) {
      if (key === uri || key.startsWith(uri)) mockFiles.delete(key);
    }
    for (const key of [...mockDirs]) {
      if (key === uri || key.startsWith(uri)) mockDirs.delete(key);
    }
  }),
}));

import {
  clearCaptureQueue,
  enqueueCapture,
  listPendingCaptures,
  removePendingCapture,
} from '../lib/captureQueue';

const capture = (clientCaptureId: string) => ({
  clientCaptureId,
  kind: 'text' as const,
  source: 'MANUAL' as const,
  content: clientCaptureId,
});

describe('captureQueue', () => {
  beforeEach(() => {
    mockFiles.clear();
    mockDirs.clear();
  });

  it('isolates queues by signed-in user', async () => {
    await enqueueCapture('user_a', capture('capture_a'));
    await enqueueCapture('user_b', capture('capture_b'));

    expect((await listPendingCaptures('user_a')).map((item) => item.content)).toEqual([
      'capture_a',
    ]);
    expect((await listPendingCaptures('user_b')).map((item) => item.content)).toEqual([
      'capture_b',
    ]);
  });

  it('serializes concurrent enqueues without dropping either capture', async () => {
    await Promise.all([
      enqueueCapture('user_a', capture('capture_1')),
      enqueueCapture('user_a', capture('capture_2')),
    ]);

    expect(await listPendingCaptures('user_a')).toHaveLength(2);
  });

  it('copies queued attachments into user-owned durable storage', async () => {
    mockFiles.set('file:///cache/photo.jpg', 'image bytes');
    const pending = await enqueueCapture('user_a', {
      ...capture('capture_file'),
      kind: 'file',
      fileUri: 'file:///cache/photo.jpg',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
    });

    expect(pending.fileUri).toMatch(
      /^file:\/\/\/docs\/kairos-capture-queue\/user_a\/cap_.+-photo\.jpg$/,
    );
    expect(mockFiles.get(pending.fileUri!)).toBe('image bytes');

    await removePendingCapture('user_a', pending.id);
    expect(mockFiles.has(pending.fileUri!)).toBe(false);
  });

  it('surfaces corruption instead of silently replacing the queue', async () => {
    mockFiles.set(
      'file:///docs/kairos-capture-queue/user_a/queue.json',
      '{broken',
    );
    await expect(listPendingCaptures('user_a')).rejects.toBeInstanceOf(SyntaxError);
  });

  it('clears only the requested user queue', async () => {
    await enqueueCapture('user_a', capture('capture_a'));
    await enqueueCapture('user_b', capture('capture_b'));
    await clearCaptureQueue('user_a');

    expect(await listPendingCaptures('user_a')).toEqual([]);
    expect(await listPendingCaptures('user_b')).toHaveLength(1);
  });
});
