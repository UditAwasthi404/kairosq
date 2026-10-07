import { ObservationsService } from './observations.service';

describe('ObservationsService metadata filters', () => {
  it('applies topic, entity, and project filters in the observation query', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const users = {
      findOrCreateByClerkId: jest.fn().mockResolvedValue({
        id: 'user_a',
        clerkUserId: 'clerk_a',
      }),
    };
    const prisma = {
      topic: {
        findFirst: jest.fn().mockResolvedValue({ id: 'topic_redis' }),
      },
      entity: {
        findFirst: jest.fn().mockResolvedValue({ id: 'entity_redis' }),
      },
      project: {
        findFirst: jest.fn().mockResolvedValue({ id: 'proj_backend' }),
      },
      observation: { findMany },
    };
    const service = new ObservationsService(
      prisma as never,
      users as never,
      {} as never,
      {} as never,
      { searchText: jest.fn().mockResolvedValue([]) } as never,
    );

    await service.listForClerkUser('clerk_a', {
      topicId: 'topic_redis',
      entityId: 'entity_redis',
      projectId: 'proj_backend',
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user_a',
          observationTopics: { some: { topicId: 'topic_redis' } },
          observationEntities: { some: { entityId: 'entity_redis' } },
          projectObservations: { some: { projectId: 'proj_backend' } },
        }),
        take: 41,
      }),
    );
  });
});
