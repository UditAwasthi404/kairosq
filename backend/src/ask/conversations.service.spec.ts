import { NotFoundException } from '@nestjs/common';
import { ConversationsService } from './conversations.service';

describe('ConversationsService ownership', () => {
  function build() {
    const userA = { id: 'user_a', clerkUserId: 'clerk_a' };
    const userB = { id: 'user_b', clerkUserId: 'clerk_b' };
    const convA = {
      id: 'conv_a',
      userId: 'user_a',
      title: 'A',
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
      updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    };
    const convB = {
      id: 'conv_b',
      userId: 'user_b',
      title: 'B',
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
      updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    };

    const prisma = {
      conversation: {
        findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
          if (where.id === 'conv_a') return convA;
          if (where.id === 'conv_b') return convB;
          return null;
        }),
        findMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
      },
      conversationMessage: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const users = {
      findOrCreateByClerkId: jest.fn(async (clerkUserId: string) => {
        if (clerkUserId === 'clerk_a') return userA;
        if (clerkUserId === 'clerk_b') return userB;
        throw new Error('unknown user');
      }),
    };

    const service = new ConversationsService(prisma as never, users as never);
    return { service, prisma };
  }

  it('hides User B conversation from User A as not found', async () => {
    const { service } = build();
    await expect(
      service.getForClerkUser('clerk_a', 'conv_b'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('hides User B conversation on delete as not found', async () => {
    const { service } = build();
    await expect(
      service.deleteForClerkUser('clerk_a', 'conv_b'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns not found for missing conversations', async () => {
    const { service } = build();
    await expect(
      service.getForClerkUser('clerk_a', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows User A to ensure ownership of Conversation A', async () => {
    const { service } = build();
    await expect(
      service.ensureOwned('clerk_a', 'conv_a'),
    ).resolves.toMatchObject({
      userId: 'user_a',
      conversation: { id: 'conv_a' },
    });
  });
});
