const mockFiles = new Map<string, string>();

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///docs/',
  EncodingType: { UTF8: 'utf8' },
  getInfoAsync: jest.fn(async (uri: string) => ({
    exists: mockFiles.has(uri) || [...mockFiles.keys()].some((key) => key.startsWith(uri)),
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
    if (value !== undefined) mockFiles.set(to, value);
    mockFiles.delete(from);
  }),
  makeDirectoryAsync: jest.fn(async () => undefined),
  deleteAsync: jest.fn(async (uri: string) => {
    for (const key of [...mockFiles.keys()]) if (key.startsWith(uri)) mockFiles.delete(key);
  }),
}));

import {
  clearCache,
  flushCache,
  hydrateCache,
  invalidateObservationCaches,
  readCache,
  removeCache,
  writeCache,
} from '../lib/persistentCache';

describe('persistentCache', () => {
  beforeEach(async () => {
    await clearCache();
    mockFiles.clear();
  });

  it('survives a restart for the same user', async () => {
    await hydrateCache('user_a');
    writeCache('dashboard', { todayCount: 3 });
    await flushCache();

    // Simulate a cold start: memory is gone, disk remains.
    const disk = new Map(mockFiles);
    await clearCache();
    for (const [key, value] of disk) mockFiles.set(key, value);

    await hydrateCache('user_a');
    expect(readCache<{ todayCount: number }>('dashboard')?.value.todayCount).toBe(3);
  });

  it('keeps users isolated', async () => {
    await hydrateCache('user_a');
    writeCache('dashboard', { owner: 'a' });
    await flushCache();

    await hydrateCache('user_b');
    expect(readCache('dashboard')).toBeNull();
  });

  it('removes entries and wipes everything on clear', async () => {
    await hydrateCache('user_a');
    writeCache('observation:1', { id: '1' });
    removeCache('observation:1');
    expect(readCache('observation:1')).toBeNull();

    writeCache('observation:2', { id: '2' });
    await flushCache();
    await clearCache();
    expect(readCache('observation:2')).toBeNull();
    expect(mockFiles.size).toBe(0);
  });

  it('ignores a corrupt cache file', async () => {
    mockFiles.set('file:///docs/kairos-cache/user_a.json', '{not json');
    await hydrateCache('user_a');
    expect(readCache('anything')).toBeNull();
  });

  it('invalidates observation detail and derived list caches after delete', async () => {
    await hydrateCache('user_a');
    writeCache('observation:1', { id: '1' });
    writeCache('library:timeline', [{ id: '1' }]);
    writeCache('timeline:all:', [{ id: '1' }]);
    writeCache('dashboard', { totalCount: 1 });
    writeCache('ask:conversations', [{ id: 'keep' }]);

    invalidateObservationCaches(['1']);

    expect(readCache('observation:1')).toBeNull();
    expect(readCache('library:timeline')).toBeNull();
    expect(readCache('timeline:all:')).toBeNull();
    expect(readCache('dashboard')).toBeNull();
    expect(readCache('ask:conversations')).not.toBeNull();
  });
});
