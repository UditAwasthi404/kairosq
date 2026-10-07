import {
  __resetNetworkForTests,
  checkConnection,
  getNetworkState,
  isNetworkError,
  onReconnect,
  reportNetworkFailure,
  reportNetworkSuccess,
} from '../lib/network';
import { ApiError, fetchTopics } from '../lib/api';
import { getLastMutationAt, isStale, noteMutation } from '../lib/freshness';

describe('network status', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.useFakeTimers();
    __resetNetworkForTests();
  });

  afterEach(() => {
    __resetNetworkForTests();
    jest.useRealTimers();
    global.fetch = originalFetch;
  });

  it('goes offline on transport failure and notifies once on reconnect', () => {
    const reconnect = jest.fn();
    const unsubscribe = onReconnect(reconnect);
    reportNetworkFailure();
    expect(getNetworkState().online).toBe(false);
    expect(getNetworkState().nextCheckAt).not.toBeNull();
    reportNetworkSuccess();
    reportNetworkSuccess();
    expect(getNetworkState().online).toBe(true);
    expect(reconnect).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('probes the API host and recovers when it answers', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 }) as typeof fetch;
    reportNetworkFailure();
    await expect(checkConnection()).resolves.toBe(true);
    expect(getNetworkState().online).toBe(true);
  });

  it('stays offline and schedules another probe when the host is unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as typeof fetch;
    await expect(checkConnection()).resolves.toBe(false);
    expect(getNetworkState().online).toBe(false);
    expect(getNetworkState().nextCheckAt).not.toBeNull();
  });

  it('maps fetch transport errors to ApiError status 0 and flips offline', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as typeof fetch;
    const error = await fetchTopics({ token: 'tok' }).catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 0, code: 'NETWORK' });
    expect(isNetworkError(error)).toBe(true);
    expect(getNetworkState().online).toBe(false);
  });

  it('classifies network errors', () => {
    expect(isNetworkError(new ApiError('x', 0))).toBe(true);
    expect(isNetworkError(new TypeError('Network request failed'))).toBe(true);
    expect(isNetworkError(new ApiError('Not found', 404))).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});

describe('freshness', () => {
  it('treats data as stale after the window or after a mutation', () => {
    const now = Date.now();
    expect(isStale(null, 30_000, now)).toBe(true);
    expect(isStale(now - 60_000, 30_000, now)).toBe(true);
    const loadedAt = now - 1_000;
    if (getLastMutationAt() < loadedAt) {
      expect(isStale(loadedAt, 30_000, now)).toBe(false);
    }
    noteMutation(now);
    expect(isStale(loadedAt, 30_000, now)).toBe(true);
  });
});
