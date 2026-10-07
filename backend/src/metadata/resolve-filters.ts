import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function parseOptionalStringId(
  value: unknown,
  field: string,
): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException({
      error: { code: 'INVALID_FILTER', message: `Invalid ${field} filter.` },
    });
  }
  return value.trim();
}

export async function resolveTopicFilter(params: {
  prisma: PrismaService;
  userId: string;
  topicId?: string;
  topic?: string;
}): Promise<string | undefined> {
  if (params.topicId) {
    const topic = await params.prisma.topic.findFirst({
      where: { id: params.topicId, userId: params.userId },
      select: { id: true },
    });
    if (!topic) {
      throw new BadRequestException({
        error: {
          code: 'TOPIC_NOT_FOUND',
          message: 'Topic filter does not match your topics.',
        },
      });
    }
    return topic.id;
  }

  if (!params.topic) return undefined;
  const normalizedName = normalizeLabel(params.topic);
  const topic = await params.prisma.topic.findFirst({
    where: { userId: params.userId, normalizedName },
    select: { id: true },
  });
  if (!topic) {
    throw new BadRequestException({
      error: {
        code: 'TOPIC_NOT_FOUND',
        message: 'Topic filter does not match your topics.',
      },
    });
  }
  return topic.id;
}

export async function resolveEntityFilter(params: {
  prisma: PrismaService;
  userId: string;
  entityId?: string;
  entity?: string;
}): Promise<string | undefined> {
  if (params.entityId) {
    const entity = await params.prisma.entity.findFirst({
      where: { id: params.entityId, userId: params.userId },
      select: { id: true },
    });
    if (!entity) {
      throw new BadRequestException({
        error: {
          code: 'ENTITY_NOT_FOUND',
          message: 'Entity filter does not match your entities.',
        },
      });
    }
    return entity.id;
  }

  if (!params.entity) return undefined;
  const normalizedName = normalizeLabel(params.entity);
  const entity = await params.prisma.entity.findFirst({
    where: { userId: params.userId, normalizedName },
    select: { id: true },
  });
  if (!entity) {
    throw new BadRequestException({
      error: {
        code: 'ENTITY_NOT_FOUND',
        message: 'Entity filter does not match your entities.',
      },
    });
  }
  return entity.id;
}

export async function resolveProjectFilter(params: {
  prisma: PrismaService;
  userId: string;
  projectId?: string;
}): Promise<string | undefined> {
  if (!params.projectId) return undefined;
  const project = await params.prisma.project.findFirst({
    where: { id: params.projectId, userId: params.userId },
    select: { id: true },
  });
  if (!project) {
    throw new BadRequestException({
      error: {
        code: 'PROJECT_NOT_FOUND',
        message: 'Project filter does not match your projects.',
      },
    });
  }
  return project.id;
}
