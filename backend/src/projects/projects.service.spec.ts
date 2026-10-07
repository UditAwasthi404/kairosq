import { ProjectsService } from './projects.service';

describe('ProjectsService ownership', () => {
  it('lists only projects for the authenticated user', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const users = {
      findOrCreateByClerkId: jest.fn().mockResolvedValue({
        id: 'user_a',
        clerkUserId: 'clerk_a',
      }),
    };
    const prisma = { project: { findMany } };
    const service = new ProjectsService(prisma as never, users as never);

    await service.listForClerkUser('clerk_a');

    expect(users.findOrCreateByClerkId).toHaveBeenCalledWith('clerk_a');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user_a' },
      }),
    );
  });

  it('rejects adding another user observation by ownership check', async () => {
    const users = {
      findOrCreateByClerkId: jest.fn().mockResolvedValue({
        id: 'user_a',
        clerkUserId: 'clerk_a',
      }),
    };
    const prisma = {
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'proj_a',
          userId: 'user_a',
          name: 'Backend',
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      },
      observation: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      projectObservation: {
        create: jest.fn(),
      },
    };
    const service = new ProjectsService(prisma as never, users as never);

    await expect(
      service.addObservationForClerkUser('clerk_a', 'proj_a', {
        observationId: 'obs_b',
      }),
    ).rejects.toMatchObject({
      response: {
        error: { code: 'OBSERVATION_NOT_FOUND' },
      },
    });
    expect(prisma.projectObservation.create).not.toHaveBeenCalled();
  });

  it('returns idempotent membership when relation already exists', async () => {
    const users = {
      findOrCreateByClerkId: jest.fn().mockResolvedValue({
        id: 'user_a',
        clerkUserId: 'clerk_a',
      }),
    };
    const prisma = {
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'proj_a',
          userId: 'user_a',
          name: 'Backend',
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      },
      observation: {
        findFirst: jest.fn().mockResolvedValue({ id: 'obs_a' }),
      },
      projectObservation: {
        create: jest.fn().mockRejectedValue({ code: 'P2002' }),
      },
    };
    const service = new ProjectsService(prisma as never, users as never);

    await expect(
      service.addObservationForClerkUser('clerk_a', 'proj_a', {
        observationId: 'obs_a',
      }),
    ).resolves.toEqual({
      projectId: 'proj_a',
      observationId: 'obs_a',
      created: false,
    });
  });

  it('deletes the project without touching observations', async () => {
    const users = {
      findOrCreateByClerkId: jest.fn().mockResolvedValue({
        id: 'user_a',
        clerkUserId: 'clerk_a',
      }),
    };
    const prisma = {
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'proj_a',
          userId: 'user_a',
        }),
        delete: jest.fn().mockResolvedValue({}),
      },
      observation: {
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    const service = new ProjectsService(prisma as never, users as never);

    await service.deleteForClerkUser('clerk_a', 'proj_a');

    expect(prisma.project.delete).toHaveBeenCalledWith({
      where: { id: 'proj_a' },
    });
    expect(prisma.observation.delete).not.toHaveBeenCalled();
    expect(prisma.observation.deleteMany).not.toHaveBeenCalled();
  });
});
