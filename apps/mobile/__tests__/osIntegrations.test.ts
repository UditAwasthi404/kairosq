jest.mock('kairos-os', () => ({
  __esModule: true,
  default: {
    isAvailable: jest.fn(() => true),
    getPendingCapture: jest.fn(),
    clearPendingCapture: jest.fn(),
    setAuthToken: jest.fn(),
    setApiBaseUrl: jest.fn(),
    refreshWidget: jest.fn(),
  },
}));

jest.mock('../lib/capture', () => ({
  submitCapture: jest.fn(),
}));

jest.mock('../lib/notifications', () => ({
  presentLocalNotification: jest.fn(),
  uploadCopy: jest.fn(() => ({ title: 'Saved' })),
}));

import { submitCapture } from '../lib/capture';
import { consumePendingOsCapture } from '../lib/osIntegrations';

const mockNative = jest.requireMock('kairos-os').default as {
  getPendingCapture: jest.Mock;
  clearPendingCapture: jest.Mock;
};

describe('consumePendingOsCapture', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNative.getPendingCapture.mockResolvedValue({
      content: 'shared thought',
      source: 'SHARE',
    });
  });

  it('does not acknowledge the native payload without authentication', async () => {
    await consumePendingOsCapture(async () => null, 'user_a');
    expect(submitCapture).not.toHaveBeenCalled();
    expect(mockNative.clearPendingCapture).not.toHaveBeenCalled();
  });

  it('does not acknowledge the native payload when durable submission fails', async () => {
    (submitCapture as jest.Mock).mockRejectedValue(new Error('disk full'));
    await expect(
      consumePendingOsCapture(async () => 'tok', 'user_a'),
    ).rejects.toThrow('disk full');
    expect(mockNative.clearPendingCapture).not.toHaveBeenCalled();
  });

  it('acknowledges only after upload or local queueing succeeds', async () => {
    (submitCapture as jest.Mock).mockResolvedValue({ queued: true });
    await consumePendingOsCapture(async () => 'tok', 'user_a');

    expect(submitCapture).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user_a', token: 'tok' }),
    );
    expect(mockNative.clearPendingCapture).toHaveBeenCalledTimes(1);
  });

  it('shares overlapping native-consume attempts', async () => {
    (submitCapture as jest.Mock).mockResolvedValue({ queued: false });
    const getToken = jest.fn(async () => 'tok');

    const first = consumePendingOsCapture(getToken, 'user_a');
    const second = consumePendingOsCapture(getToken, 'user_a');

    expect(second).toBe(first);
    await Promise.all([first, second]);
    expect(mockNative.getPendingCapture).toHaveBeenCalledTimes(1);
    expect(submitCapture).toHaveBeenCalledTimes(1);
  });
});
