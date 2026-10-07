import { NotFoundException } from '@nestjs/common';
import { ObservationsService } from './observations.service';

describe('related memories isolation', () => {
  it('does not return another user\'s observation', async () => {
    const users = {
      findOrCreateByClerkId: jest.fn().mockResolvedValue({
        id: 'user_a',
        clerkUserId: 'clerk_a',
      }),
    };
    const prisma = {
      observation: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const service = new ObservationsService(
      prisma as never,
      users as never,
      {} as never,
      {} as never,
      { searchText: jest.fn() } as never,
    );

    await expect(
      service.relatedForClerkUser('clerk_a', 'obs_owned_by_b'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.observation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'obs_owned_by_b', userId: 'user_a' },
      }),
    );
  });
});
