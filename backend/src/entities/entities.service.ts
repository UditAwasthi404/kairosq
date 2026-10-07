import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityType, ProcessingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import {
  toObservationResponse,
  type ObservationResponse,
} from '../observations/observation.mapper';

export type EntitySummary = {
  id: string;
  name: string;
  type: EntityType;
  observationCount: number;
  updatedAt: string;
};

export type EntityDetail = EntitySummary & {
  observations: ObservationResponse[];
};

const observationInclude = {
  observationTopics: { include: { topic: true } },
  observationEntities: { include: { entity: true } },
  projectObservations: { include: { project: true } },
  _count: { select: { chunks: true } },
} as const;

@Injectable()
export class EntitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async listForClerkUser(
    clerkUserId: string,
    options?: { limit?: number; cursor?: string; type?: EntityType },
  ): Promise<{ items: EntitySummary[]; nextCursor: string | null }> {
    const user = await this.users.findOrCreateByClerkId(clerkUserId);
    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);

    const rows = await this.prisma.entity.findMany({
      where: {
        userId: user.id,
        ...(options?.type ? { type: options.type } : {}),
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }, { id: 'asc' }],
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
            observationEntities: {
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
        type: row.type,
        observationCount: row._count.observationEntities,
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
    entityId: string,
  ): Promise<EntityDetail> {
    const user = await this.users.findOrCreateByClerkId(clerkUserId);
    const entity = await this.prisma.entity.findFirst({
      where: { id: entityId, userId: user.id },
      include: {
        observationEntities: {
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

    if (!entity) {
      throw new NotFoundException({
        error: { code: 'ENTITY_NOT_FOUND', message: 'Entity not found.' },
      });
    }

    const observations = entity.observationEntities.map((link) =>
      toObservationResponse(link.observation),
    );

    return {
      id: entity.id,
      name: entity.name,
      type: entity.type,
      observationCount: observations.length,
      updatedAt: entity.updatedAt.toISOString(),
      observations,
    };
  }
}
