import { Injectable, NotFoundException } from '@nestjs/common';
import { ProcessingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import {
  toObservationResponse,
  type ObservationResponse,
} from '../observations/observation.mapper';

export type TopicSummary = {
  id: string;
  name: string;
  observationCount: number;
  updatedAt: string;
};

export type TopicDetail = TopicSummary & {
  observations: ObservationResponse[];
};

const observationInclude = {
  observationTopics: { include: { topic: true } },
  observationEntities: { include: { entity: true } },
  projectObservations: { include: { project: true } },
  _count: { select: { chunks: true } },
} as const;

@Injectable()
export class TopicsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async listForClerkUser(
    clerkUserId: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<{ items: TopicSummary[]; nextCursor: string | null }> {
    const user = await this.users.findOrCreateByClerkId(clerkUserId);
    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);

    const rows = await this.prisma.topic.findMany({
      where: { userId: user.id },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      ...(options?.cursor
        ? {
            cursor: { id: options.cursor },
            skip: 1,
          }
        : {}),
      take: limit + 1,
      include: {
        _count: {
          select: {
            observationTopics: {
              where: {
                observation: {
                  processingStatus: ProcessingStatus.COMPLETED,
                },
              },
            },
          },
        },
      },
    });

    const page = rows.slice(0, limit);
    const items = page
      .map((row) => ({
        id: row.id,
        name: row.name,
        observationCount: row._count.observationTopics,
        updatedAt: row.updatedAt.toISOString(),
      }))
      .filter((row) => row.observationCount > 0);

    return {
      items,
      nextCursor:
        rows.length > limit ? (page[page.length - 1]?.id ?? null) : null,
    };
  }

  async getForClerkUser(
    clerkUserId: string,
    topicId: string,
  ): Promise<TopicDetail> {
    const user = await this.users.findOrCreateByClerkId(clerkUserId);
    const topic = await this.prisma.topic.findFirst({
      where: { id: topicId, userId: user.id },
      include: {
        observationTopics: {
          where: {
            observation: { processingStatus: ProcessingStatus.COMPLETED },
          },
          include: {
            observation: { include: observationInclude },
          },
          orderBy: { createdAt: 'desc' },
          take: 40,
        },
      },
    });

    if (!topic) {
      throw new NotFoundException({
        error: { code: 'TOPIC_NOT_FOUND', message: 'Topic not found.' },
      });
    }

    const observations = topic.observationTopics.map((link) =>
      toObservationResponse(link.observation),
    );

    return {
      id: topic.id,
      name: topic.name,
      observationCount: observations.length,
      updatedAt: topic.updatedAt.toISOString(),
      observations,
    };
  }
}
