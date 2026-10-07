import { CaptureController } from './capture.controller';

describe('CaptureController', () => {
  it('forwards a normalized payload to observations.capture', async () => {
    const observations = {
      capture: jest.fn().mockResolvedValue({ id: 'obs_1', source: 'SHARE' }),
    };
    const controller = new CaptureController(observations as never);
    const result = await controller.capture(
      { id: 'clerk_a', authenticated: true },
      {
        content: 'Understanding Kafka consumer groups',
        url: 'https://example.com/kafka',
        source: 'SHARE',
        title: 'Kafka',
      },
    );
    expect(observations.capture).toHaveBeenCalledWith({
      clerkUserId: 'clerk_a',
      clientCaptureId: undefined,
      content: 'Understanding Kafka consumer groups',
      source: 'SHARE',
      capturedAt: undefined,
      url: 'https://example.com/kafka',
      title: 'Kafka',
      metadata: undefined,
      projectId: undefined,
    });
    expect(result.data.id).toBe('obs_1');
  });

  it('returns the existing capture when concurrent requests hit the unique key', async () => {
    const observations = {
      capture: jest.fn().mockRejectedValue({ code: 'P2002' }),
      findByClientCaptureId: jest
        .fn()
        .mockResolvedValue({ id: 'obs_existing', source: 'SHARE' }),
    };
    const controller = new CaptureController(observations as never);

    const result = await controller.capture(
      { id: 'clerk_a', authenticated: true },
      {
        clientCaptureId: 'capture_123',
        content: 'same capture',
        source: 'SHARE',
      },
    );

    expect(observations.findByClientCaptureId).toHaveBeenCalledWith(
      'clerk_a',
      'capture_123',
    );
    expect(result.data.id).toBe('obs_existing');
  });
});
