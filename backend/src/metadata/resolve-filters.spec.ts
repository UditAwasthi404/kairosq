import { BadRequestException } from '@nestjs/common';
import {
  normalizeLabel,
  resolveEntityFilter,
  resolveProjectFilter,
  resolveTopicFilter,
} from './resolve-filters';

describe('resolve-filters', () => {
  it('normalizes labels', () => {
    expect(normalizeLabel('  Redis  Cache ')).toBe('redis cache');
  });

  it('resolves topic by id for the owning user only', async () => {
    const prisma = {
      topic: {
        findFirst: jest.fn().mockResolvedValue({ id: 'topic_1' }),
      },
    };
    await expect(
      resolveTopicFilter({
        prisma: prisma as never,
        userId: 'user_a',
        topicId: 'topic_1',
      }),
    ).resolves.toBe('topic_1');
    expect(prisma.topic.findFirst).toHaveBeenCalledWith({
      where: { id: 'topic_1', userId: 'user_a' },
      select: { id: true },
    });
  });

  it('rejects unknown entity filters', async () => {
    const prisma = {
      entity: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    await expect(
      resolveEntityFilter({
        prisma: prisma as never,
        userId: 'user_a',
        entity: 'Redis',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resolves project filters for the owning user only', async () => {
    const prisma = {
      project: {
        findFirst: jest.fn().mockResolvedValue({ id: 'proj_1' }),
      },
    };
    await expect(
      resolveProjectFilter({
        prisma: prisma as never,
        userId: 'user_a',
        projectId: 'proj_1',
      }),
    ).resolves.toBe('proj_1');
    expect(prisma.project.findFirst).toHaveBeenCalledWith({
      where: { id: 'proj_1', userId: 'user_a' },
      select: { id: true },
    });
  });

  it('rejects another user project filter', async () => {
    const prisma = {
      project: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    await expect(
      resolveProjectFilter({
        prisma: prisma as never,
        userId: 'user_a',
        projectId: 'proj_b',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
