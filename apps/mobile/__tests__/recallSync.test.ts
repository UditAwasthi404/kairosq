import { ApiError } from '../lib/api';
import {
  __resetRecallSyncForTests,
  ensureRecallReady,
  getCachedRecallEntitlement,
} from '../lib/recallSync';

jest.mock('kairos-recall', () => ({
  __esModule: true,
  default: {
    isAvailable: () => false,
    setAuthToken: jest.fn(),
    setConfig: jest.fn(),
  },
}));

describe('ensureRecallReady', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    __resetRecallSyncForTests();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('single-flights concurrent callers', async () => {
    let resolveFetch!: (value: unknown) => void;
    const fetchGate = new Promise<void>((resolveReady) => {
      global.fetch = jest.fn(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
            resolveReady();
          }),
      ) as unknown as typeof fetch;
    });

    const getToken = jest.fn().mockResolvedValue('tok-1');
    const a = ensureRecallReady(getToken);
    const b = ensureRecallReady(getToken);

    await fetchGate;
    resolveFetch({
      ok: true,
      json: async () => ({
        data: {
          feature: 'RECALL',
          status: 'active',
          allowed: true,
          validUntil: null,
          source: 'stub',
        },
      }),
    });

    const [entA, entB] = await Promise.all([a, b]);
    expect(entA?.allowed).toBe(true);
    expect(entB?.allowed).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(getCachedRecallEntitlement()?.allowed).toBe(true);
  });

  it('retries once with skipCache after 401', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            feature: 'RECALL',
            status: 'active',
            allowed: true,
            validUntil: null,
            source: 'stub',
          },
        }),
      }) as unknown as typeof fetch;

    const getToken = jest
      .fn()
      .mockResolvedValueOnce('stale')
      .mockResolvedValueOnce('fresh');

    const ent = await ensureRecallReady(getToken);
    expect(ent?.allowed).toBe(true);
    expect(getToken).toHaveBeenCalledWith({ skipCache: true });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('serves warm cache without a second network call', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          feature: 'RECALL',
          status: 'active',
          allowed: true,
          validUntil: null,
          source: 'stub',
        },
      }),
    }) as unknown as typeof fetch;

    const getToken = jest.fn().mockResolvedValue('tok');
    await ensureRecallReady(getToken);
    await ensureRecallReady(getToken);

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('surfaces non-401 failures as null without throwing', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: 'boom' }),
    }) as unknown as typeof fetch;

    const getToken = jest.fn().mockResolvedValue('tok');
    await expect(ensureRecallReady(getToken)).resolves.toBeNull();
    expect(ApiError).toBeDefined();
  });

  it('clears the Recall entitlement cache when the authenticated account changes', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { feature: 'RECALL', status: 'active', allowed: true, validUntil: null, source: 'revenuecat' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { feature: 'RECALL', status: 'inactive', allowed: false, validUntil: null, source: 'none' } }),
      }) as unknown as typeof fetch;

    const getToken = jest.fn().mockResolvedValue('token');
    await ensureRecallReady(getToken, { userId: 'user-a' });
    expect(getCachedRecallEntitlement('user-a')?.allowed).toBe(true);

    const userB = await ensureRecallReady(getToken, { userId: 'user-b' });
    expect(userB?.allowed).toBe(false);
    expect(getCachedRecallEntitlement('user-b')?.allowed).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('ignores a late entitlement response from the previous account', async () => {
    let resolveA!: (response: unknown) => void;
    let resolveB!: (response: unknown) => void;
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(
        () => new Promise((resolve) => { resolveA = resolve; }),
      )
      .mockImplementationOnce(
        () => new Promise((resolve) => { resolveB = resolve; }),
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    const getToken = jest.fn().mockResolvedValue('token');
    const response = (allowed: boolean) => ({
      ok: true,
      json: async () => ({
        data: {
          feature: 'RECALL',
          status: allowed ? 'active' : 'inactive',
          allowed,
          validUntil: null,
          source: allowed ? 'revenuecat' : 'none',
        },
      }),
    });
    const userA = ensureRecallReady(getToken, { userId: 'user-a' });
    while (fetchMock.mock.calls.length < 1) await Promise.resolve();
    const userB = ensureRecallReady(getToken, { userId: 'user-b' });
    while (fetchMock.mock.calls.length < 2) await Promise.resolve();

    resolveB(response(false));
    await expect(userB).resolves.toMatchObject({ allowed: false });
    resolveA(response(true));
    await expect(userA).resolves.toBeNull();
    expect(getCachedRecallEntitlement('user-b')?.allowed).toBe(false);
  });
});
