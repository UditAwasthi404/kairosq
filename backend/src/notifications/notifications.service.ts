import { Injectable, Logger } from '@nestjs/common';
import {
  CaptureSource,
  DevicePlatform,
  ProcessingStatus,
  type DeviceToken,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { sendExpoPush } from './expo-push.client';
import {
  parseDevicePlatform,
  parseExpoPushToken,
} from './notifications.validation';

const UPDATES_CHANNEL = 'kairos_updates';

export type ObservationSettledInput = {
  id: string;
  userId: string;
  originalFilename: string;
  summary: string | null;
  processingStatus: ProcessingStatus;
  source: CaptureSource;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async registerToken(params: {
    clerkUserId: string;
    token: unknown;
    platform: unknown;
  }): Promise<{ id: string; platform: DevicePlatform }> {
    const token = parseExpoPushToken(params.token);
    const platform = parseDevicePlatform(params.platform);
    const user = await this.users.findOrCreateByClerkId(params.clerkUserId);
    const row = await this.prisma.deviceToken.upsert({
      where: { token },
      create: {
        userId: user.id,
        token,
        platform,
        lastSeenAt: new Date(),
      },
      update: {
        userId: user.id,
        platform,
        lastSeenAt: new Date(),
      },
    });
    return { id: row.id, platform: row.platform };
  }

  async unregisterToken(params: {
    clerkUserId: string;
    token: unknown;
  }): Promise<{ removed: boolean }> {
    const token = parseExpoPushToken(params.token);
    const user = await this.users.findByClerkId(params.clerkUserId);
    if (!user) {
      return { removed: false };
    }
    const result = await this.prisma.deviceToken.deleteMany({
      where: { userId: user.id, token },
    });
    return { removed: result.count > 0 };
  }

  async notifyObservationSettled(
    observation: ObservationSettledInput,
  ): Promise<void> {
    if (observation.source === CaptureSource.RECALL) {
      return;
    }
    if (
      observation.processingStatus !== ProcessingStatus.COMPLETED &&
      observation.processingStatus !== ProcessingStatus.FAILED
    ) {
      return;
    }

    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId: observation.userId },
    });
    if (tokens.length === 0) {
      return;
    }

    const failed = observation.processingStatus === ProcessingStatus.FAILED;
    const title = failed ? "Couldn't process this memory" : 'Memory ready';
    const body = failed
      ? observation.originalFilename || 'Kairos could not finish this capture.'
      : trimBody(observation.summary) ||
        observation.originalFilename ||
        'Your capture is ready to search.';

    await this.dispatch(tokens, {
      title,
      body,
      data: {
        observationId: observation.id,
        href: `/(app)/observation/${observation.id}`,
        kind: failed ? 'processing_failed' : 'processing_complete',
      },
    });
  }

  private async dispatch(
    tokens: DeviceToken[],
    message: {
      title: string;
      body: string;
      data: Record<string, string>;
    },
  ): Promise<void> {
    try {
      const result = await sendExpoPush(
        tokens.map((row) => ({
          to: row.token,
          title: message.title,
          body: message.body,
          data: message.data,
          sound: 'default',
          channelId: UPDATES_CHANNEL,
        })),
      );
      if (result.invalidTokens.length > 0) {
        await this.prisma.deviceToken.deleteMany({
          where: { token: { in: result.invalidTokens } },
        });
      }
    } catch (error) {
      this.logger.warn(
        `Push dispatch failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }
}

function trimBody(value: string | null | undefined): string {
  const text = (value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > 140 ? `${text.slice(0, 137)}…` : text;
}
