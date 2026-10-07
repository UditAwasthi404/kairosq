import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ObservationsService } from './observations.service';

describe('ObservationsService.updateForClerkUser', () => {
  const user = { id: 'user_a', clerkUserId: 'clerk_a' };
  const owned = {
    id: 'obs_1',
    userId: 'user_a',
    originalFilename: 'note.txt',
    extractedText: 'Old text',
    source: 'QUICK_CAPTURE',
    capturedAt: new Date('2026-09-20T00:00:00.000Z'),
    sourceMetadata: { source: 'QUICK_CAPTURE' },
    observationTopics: [],
    observationEntities: [],
    projectObservations: [],
    _count: { chunks: 1 },
    type: 'TEXT',
    mimeType: 'text/plain',
    fileSizeBytes: 8,
    processingStatus: 'COMPLETED',
    processingError: null,
    summary: 'Old',
    pageCount: null,
    characterCount: 8,
    wordCount: 2,
    chunkCount: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function service(overrides?: { findFirst?: unknown; update?: unknown }) {
    const reindexFromText = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      observation: {
        findFirst: jest.fn().mockResolvedValue(
          overrides && 'findFirst' in overrides ? overrides.findFirst : owned,
        ),
        update: jest.fn().mockResolvedValue(owned),
      },
    };
    return {
      reindexFromText,
      svc: new ObservationsService(
        prisma as never,
        { findOrCreateByClerkId: jest.fn().mockResolvedValue(user) } as never,
        { reindexFromText, process: jest.fn() } as never,
        {} as never,
        { searchText: jest.fn() } as never,
      ),
      prisma,
    };
  }

  it('updates title and text then reindexes', async () => {
    const { svc, prisma, reindexFromText } = service();
    const result = await svc.updateForClerkUser('clerk_a', 'obs_1', {
      title: 'New title',
      content: 'New text',
    });
    expect(prisma.observation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'obs_1' },
        data: expect.objectContaining({
          originalFilename: 'New title.txt',
          extractedText: 'New text',
        }),
      }),
    );
    await new Promise((resolve) => setImmediate(resolve));
    expect(reindexFromText).toHaveBeenCalledWith('obs_1', 'New text');
    expect(result.id).toBe('obs_1');
  });

  it('rejects empty edits', async () => {
    const { svc } = service();
    await expect(svc.updateForClerkUser('clerk_a', 'obs_1', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('does not reindex when only the title changes', async () => {
    const { svc, reindexFromText } = service();
    await svc.updateForClerkUser('clerk_a', 'obs_1', { title: 'Renamed' });
    await new Promise((resolve) => setImmediate(resolve));
    expect(reindexFromText).not.toHaveBeenCalled();
  });

  it('does not edit another user\'s memory', async () => {
    const { svc } = service({ findFirst: null });
    await expect(
      svc.updateForClerkUser('clerk_a', 'obs_other', { content: 'nope' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
