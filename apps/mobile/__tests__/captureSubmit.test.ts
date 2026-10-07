import { ApiError } from '../lib/api';
import { flushCaptureQueue, submitCapture } from '../lib/capture';
import { enqueueCapture, listPendingCaptures } from '../lib/captureQueue';

jest.mock('../lib/api', () => {
  const actual = jest.requireActual('../lib/api');
  return {
    ...actual,
    createCapture: jest.fn(),
    uploadCapture: jest.fn(),
  };
});

jest.mock('../lib/captureQueue', () => ({
  enqueueCapture: jest.fn(async (_userId, item) => ({
    ...item,
    id: 'cap_1',
    capturedAt: '2026-09-23T00:00:00.000Z',
    attempts: 0,
  })),
  listPendingCaptures: jest.fn(async () => []),
  markCaptureAttempt: jest.fn(),
  removePendingCapture: jest.fn(),
}));

const api = jest.requireMock('../lib/api') as {
  createCapture: jest.Mock;
  uploadCapture: jest.Mock;
};

describe('submitCapture', () => {
  it('returns the observation when the network succeeds', async () => {
    api.createCapture.mockResolvedValue({ id: 'obs_1', status: 'PENDING' });
    const result = await submitCapture({
      userId: 'user_a',
      token: 'tok',
      source: 'QUICK_CAPTURE',
      content: 'hello',
    });
    expect(result.queued).toBe(false);
    expect(result.observation?.id).toBe('obs_1');
  });

  it('queues on network failure instead of dropping the thought', async () => {
    api.createCapture.mockRejectedValue(new ApiError('offline', 500));
    const result = await submitCapture({
      userId: 'user_a',
      token: 'tok',
      source: 'VOICE',
      content: 'spoken thought',
    });
    expect(result.queued).toBe(true);
    expect(enqueueCapture).toHaveBeenCalledWith(
      'user_a',
      expect.objectContaining({ clientCaptureId: expect.any(String) }),
    );
    expect(listPendingCaptures).not.toHaveBeenCalled();
  });

  it('shares one flush between overlapping triggers so nothing uploads twice', async () => {
    const queue = jest.requireMock('../lib/captureQueue') as {
      listPendingCaptures: jest.Mock;
    };
    queue.listPendingCaptures
      .mockResolvedValueOnce([{ id: 'cap_1', kind: 'text', source: 'MANUAL', content: 'a', capturedAt: 'x', attempts: 0 }])
      .mockResolvedValue([]);
    api.createCapture.mockReset();
    api.createCapture.mockResolvedValue({ id: 'obs_1', status: 'PENDING' });

    const [first, second] = await Promise.all([
      flushCaptureQueue('user_a', 'tok'),
      flushCaptureQueue('user_a', 'tok'),
    ]);
    expect(first).toEqual({ flushed: 1, remaining: 0 });
    expect(second).toBe(first);
    expect(api.createCapture).toHaveBeenCalledTimes(1);
  });

  it('stops flushing at the first network failure', async () => {
    const queue = jest.requireMock('../lib/captureQueue') as {
      listPendingCaptures: jest.Mock;
    };
    const items = [1, 2, 3].map((n) => ({ id: `cap_${n}`, kind: 'text', source: 'MANUAL', content: `${n}`, capturedAt: 'x', attempts: 0 }));
    queue.listPendingCaptures.mockReset();
    queue.listPendingCaptures.mockResolvedValueOnce(items).mockResolvedValue(items);
    api.createCapture.mockReset();
    api.createCapture.mockRejectedValue(new ApiError('No connection to Kairos.', 0, 'NETWORK'));

    const result = await flushCaptureQueue('user_a', 'tok');
    expect(api.createCapture).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ flushed: 0, remaining: 3 });
  });

  it('does not queue validation errors', async () => {
    api.createCapture.mockRejectedValue(new ApiError('Write a thought first.', 400));
    await expect(
      submitCapture({
        userId: 'user_a',
        token: 'tok',
        source: 'QUICK_CAPTURE',
        content: '',
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
