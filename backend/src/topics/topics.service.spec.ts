import { TopicsService } from './topics.service';

describe('TopicsService isolation', () => {
  it('queries topics only for the authenticated user', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const users = {
      findOrCreateByClerkId: jest.fn().mockResolvedValue({
        id: 'user_a',
        clerkUserId: 'clerk_a',
      }),
    };
    const prisma = { topic: { findMany } };
    const service = new TopicsService(prisma as never, users as never);

    await service.listForClerkUser('clerk_a');

    expect(users.findOrCreateByClerkId).toHaveBeenCalledWith('clerk_a');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user_a' },
      }),
    );
  });
});
