import { ObservationsService } from './observations.service';

describe('ObservationsService cursor pagination', () => {
  function row(id: string, capturedAt: string) {
    const at = new Date(capturedAt);
    return {
      id,
      userId: 'user_a',
      type: 'TEXT',
      originalFilename: `${id}.txt`,
      mimeType: 'text/plain',
      storageKey: `observations/${id}`,
      fileSizeBytes: 8,
      processingStatus: 'COMPLETED',
      extractedText: id,
      summary: id,
      processingError: null,
      source: 'MANUAL',
      sourceMetadata: {},
      pageCount: null,
      characterCount: 4,
      wordCount: 1,
      chunkCount: 1,
      capturedAt: at,
      createdAt: at,
      updatedAt: at,
      observationTopics: [],
      observationEntities: [],
      projectObservations: [],
      _count: { chunks: 1 },
    };
  }

  it('returns a next cursor instead of a hard cutoff', async () => {
    const findMany = jest.fn().mockResolvedValue([
      row('obs_newer', '2026-09-24T12:00:00.000Z'),
      row('obs_older', '2026-09-23T12:00:00.000Z'),
    ]);
    const service = new ObservationsService(
      {
        observation: { findMany },
      } as never,
      {
        findOrCreateByClerkId: jest.fn().mockResolvedValue({
          id: 'user_a',
          clerkUserId: 'clerk_a',
        }),
      } as never,
      {} as never,
      {} as never,
      { searchText: jest.fn() } as never,
    );

    const page = await service.listForClerkUser('clerk_a', { limit: 1 });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.id).toBe('obs_newer');
    expect(page.nextCursor).toBeTruthy();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 2,
        orderBy: [{ capturedAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });

  it('applies the cursor when loading the next page', async () => {
    const findMany = jest.fn().mockResolvedValue([
      row('obs_older', '2026-09-23T12:00:00.000Z'),
    ]);
    const service = new ObservationsService(
      {
        observation: { findMany },
      } as never,
      {
        findOrCreateByClerkId: jest.fn().mockResolvedValue({
          id: 'user_a',
          clerkUserId: 'clerk_a',
        }),
      } as never,
      {} as never,
      {} as never,
      { searchText: jest.fn() } as never,
    );

    const first = await service.listForClerkUser('clerk_a', { limit: 1 });
    findMany.mockResolvedValueOnce([row('obs_older', '2026-09-23T12:00:00.000Z')]);
    const cursor = Buffer.from(
      '2026-09-24T12:00:00.000Z|obs_newer',
    ).toString('base64url');
    const page = await service.listForClerkUser('clerk_a', { limit: 1, cursor });
    expect(page.items[0]?.id).toBe('obs_older');
    expect(page.nextCursor).toBeNull();
    expect(findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { capturedAt: { lt: new Date('2026-09-24T12:00:00.000Z') } },
            {
              capturedAt: new Date('2026-09-24T12:00:00.000Z'),
              id: { lt: 'obs_newer' },
            },
          ],
        }),
      }),
    );
    expect(first).toBeDefined();
  });
});
