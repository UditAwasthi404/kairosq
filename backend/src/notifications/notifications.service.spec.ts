import { BadRequestException } from '@nestjs/common';
import { CaptureSource, DevicePlatform, ProcessingStatus } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import * as expoPush from './expo-push.client';

jest.mock('./expo-push.client', () => ({
  sendExpoPush: jest.fn(),
}));

describe('NotificationsService', () => {
  const sendExpoPush = expoPush.sendExpoPush as jest.Mock;

  function buildService() {
    const prisma = {
      deviceToken: {
        upsert: jest.fn(),
        deleteMany: jest.fn(),
        findMany: jest.fn(),
      },
    };
    const users = {
      findOrCreateByClerkId: jest.fn().mockResolvedValue({ id: 'user_a' }),
      findByClerkId: jest.fn().mockResolvedValue({ id: 'user_a' }),
    };
    const service = new NotificationsService(prisma as never, users as never);
    return { service, prisma, users };
  }

  beforeEach(() => {
    sendExpoPush.mockReset();
    sendExpoPush.mockResolvedValue({ sent: 1, invalidTokens: [] });
  });

  it('registers a valid Expo token', async () => {
    const { service, prisma } = buildService();
    prisma.deviceToken.upsert.mockResolvedValue({
      id: 'tok_1',
      platform: DevicePlatform.ANDROID,
    });

    const result = await service.registerToken({
      clerkUserId: 'clerk_a',
      token: 'ExponentPushToken[abc123]',
      platform: 'android',
    });

    expect(result).toEqual({ id: 'tok_1', platform: DevicePlatform.ANDROID });
    expect(prisma.deviceToken.upsert).toHaveBeenCalled();
  });

  it('rejects a malformed token', async () => {
    const { service } = buildService();
    await expect(
      service.registerToken({
        clerkUserId: 'clerk_a',
        token: 'not-a-token',
        platform: 'ANDROID',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sends a processing-complete push and skips Recall', async () => {
    const { service, prisma } = buildService();
    prisma.deviceToken.findMany.mockResolvedValue([
      { token: 'ExponentPushToken[abc123]', userId: 'user_a' },
    ]);

    await service.notifyObservationSettled({
      id: 'obs_1',
      userId: 'user_a',
      originalFilename: 'note.txt',
      summary: 'A useful summary of the document.',
      processingStatus: ProcessingStatus.COMPLETED,
      source: CaptureSource.SHARE,
    });

    expect(sendExpoPush).toHaveBeenCalledWith([
      expect.objectContaining({
        to: 'ExponentPushToken[abc123]',
        title: 'Memory ready',
        channelId: 'kairos_updates',
        data: expect.objectContaining({
          observationId: 'obs_1',
          kind: 'processing_complete',
        }),
      }),
    ]);

    sendExpoPush.mockClear();
    await service.notifyObservationSettled({
      id: 'obs_recall',
      userId: 'user_a',
      originalFilename: 'recall.txt',
      summary: null,
      processingStatus: ProcessingStatus.COMPLETED,
      source: CaptureSource.RECALL,
    });
    expect(sendExpoPush).not.toHaveBeenCalled();
  });

  it('drops DeviceNotRegistered tokens', async () => {
    const { service, prisma } = buildService();
    prisma.deviceToken.findMany.mockResolvedValue([
      { token: 'ExponentPushToken[dead]', userId: 'user_a' },
    ]);
    sendExpoPush.mockResolvedValue({
      sent: 0,
      invalidTokens: ['ExponentPushToken[dead]'],
    });

    await service.notifyObservationSettled({
      id: 'obs_1',
      userId: 'user_a',
      originalFilename: 'note.txt',
      summary: null,
      processingStatus: ProcessingStatus.FAILED,
      source: CaptureSource.VOICE,
    });

    expect(prisma.deviceToken.deleteMany).toHaveBeenCalledWith({
      where: { token: { in: ['ExponentPushToken[dead]'] } },
    });
  });
});
