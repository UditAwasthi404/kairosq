import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService privacy deletion', () => {
  it('deletes owned user data and storage objects', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user_a',
          clerkUserId: 'clerk_a',
          observations: [
            { id: 'obs_1', storageKey: 'k1' },
            { id: 'obs_2', storageKey: 'k2' },
          ],
        }),
        delete: jest.fn().mockResolvedValue({ id: 'user_a' }),
      },
    };
    const storage = { delete: jest.fn().mockResolvedValue(undefined) };
    const service = new UsersService(prisma as never, storage as never);

    const result = await service.deleteAllDataForClerkUser('clerk_a');

    expect(result.deletedObservations).toBe(2);
    expect(prisma.user.delete).toHaveBeenCalledWith({
      where: { id: 'user_a' },
    });
    expect(storage.delete).toHaveBeenCalledWith('k1');
    expect(storage.delete).toHaveBeenCalledWith('k2');
  });

  it('does not delete when the clerk user has no Kairos row', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        delete: jest.fn(),
      },
    };
    const storage = { delete: jest.fn() };
    const service = new UsersService(prisma as never, storage as never);

    await expect(
      service.deleteAllDataForClerkUser('missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.user.delete).not.toHaveBeenCalled();
    expect(storage.delete).not.toHaveBeenCalled();
  });
});
