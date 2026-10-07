import {
  fetchRecallEntitlement,
  postRecallEvents,
  ApiError,
} from '../lib/api';

describe('recall API client', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('fetches entitlement', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          feature: 'RECALL',
          status: 'active',
          allowed: true,
          validUntil: null,
          source: 'stub_grant_all',
        },
      }),
    }) as unknown as typeof fetch;

    const data = await fetchRecallEntitlement('tok');
    expect(data.allowed).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/recall\/entitlement$/),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('posts recall events', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          results: [
            {
              clientEventId: 'evt_1',
              status: 'accepted',
              observationId: 'obs_1',
              deduped: false,
            },
          ],
        },
      }),
    }) as unknown as typeof fetch;

    const data = await postRecallEvents({
      token: 'tok',
      events: [{ clientEventId: 'evt_1' }],
    });
    expect(data.results[0].status).toBe('accepted');
  });

  it('surfaces entitlement errors', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: {
          code: 'RECALL_ENTITLEMENT_REQUIRED',
          message: 'Recall requires an active entitlement.',
        },
      }),
    }) as unknown as typeof fetch;

    await expect(
      postRecallEvents({ token: 'tok', events: [] }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
