import { EntitiesService } from './entities.service';

describe('EntitiesService isolation', () => {
  it('queries entities only for the authenticated user', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const users = {
      findOrCreateByClerkId: jest.fn().mockResolvedValue({
        id: 'user_a',
        clerkUserId: 'clerk_a',
      }),
    };
    const prisma = { entity: { findMany } };
    const service = new EntitiesService(prisma as never, users as never);

    await service.listForClerkUser('clerk_a');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user_a' },
      }),
    );
  });
});
