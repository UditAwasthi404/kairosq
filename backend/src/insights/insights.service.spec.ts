import { ProcessingStatus } from '@prisma/client';
import { InsightsService } from './insights.service';

describe('InsightsService', () => {
  const user = { id: 'user_a', clerkUserId: 'clerk_a' };

  it('returns an empty-state insight when there are no recent memories', async () => {
    const prisma = {
      observation: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new InsightsService(
      prisma as never,
      { findOrCreateByClerkId: jest.fn().mockResolvedValue(user) } as never,
      { isConfigured: () => false } as never,
    );

    const result = await service.todayForClerkUser('clerk_a');
    expect(result.empty).toBe(true);
    expect(result.observationCount).toBe(0);
    expect(result.body).toMatch(/Capture something today/i);
    expect(result.evidence).toEqual([]);
  });

  it('falls back to the latest summary when AI is off', async () => {
    const prisma = {
      observation: {
        findMany: jest.fn().mockResolvedValue([
          {
            summary: 'You spent more time on backend work this week.',
            extractedText: 'notes',
            originalFilename: 'note.txt',
            source: 'QUICK_CAPTURE',
            capturedAt: new Date(),
            processingStatus: ProcessingStatus.COMPLETED,
          },
        ]),
      },
    };
    const service = new InsightsService(
      prisma as never,
      { findOrCreateByClerkId: jest.fn().mockResolvedValue(user) } as never,
      { isConfigured: () => false } as never,
    );

    const result = await service.todayForClerkUser('clerk_a');
    expect(result.empty).toBe(false);
    expect(result.body).toMatch(/backend work/i);
  });

  it('builds a dashboard from existing observation counts', async () => {
    const prisma = {
      observation: {
        count: jest.fn().mockResolvedValue(3),
        groupBy: jest.fn().mockResolvedValue([
          { source: 'SHARE', _count: { _all: 2 } },
        ]),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'obs_1',
            originalFilename: 'shot.png',
            source: 'SHARE',
            capturedAt: new Date(),
            summary: 'A screenshot',
            processingStatus: ProcessingStatus.COMPLETED,
          },
        ]),
      },
      topic: {
        findMany: jest.fn().mockResolvedValue([
          { id: 't1', name: 'Kafka', _count: { observationTopics: 2 } },
        ]),
      },
    };
    const service = new InsightsService(
      prisma as never,
      { findOrCreateByClerkId: jest.fn().mockResolvedValue(user) } as never,
      { isConfigured: () => false } as never,
    );
    jest.spyOn(service, 'todayForClerkUser').mockResolvedValue({
      title: 'Something I noticed',
      body: 'Backend work this week.',
      generatedAt: new Date().toISOString(),
      observationCount: 3,
      empty: false,
      evidence: [],
      why: 'Based on 3 memories across 1 day',
      maturity: 'pattern',
    });

    const result = await service.dashboardForClerkUser('clerk_a');
    expect(result.totalCount).toBe(3);
    expect(result.sources[0].source).toBe('SHARE');
    expect(result.topics[0].name).toBe('Kafka');
    expect(result.activity).toHaveLength(14);
    expect(result.heatmap).toHaveLength(84);
    expect(result.streak.capturedToday).toBe(true);
    expect(result.habit.week).toHaveLength(7);
    expect(result.habit.dailyGoal).toBe(1);
  });

  it('returns a starter prediction when memory is empty', async () => {
    const prisma = {
      observation: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const service = new InsightsService(
      prisma as never,
      { findOrCreateByClerkId: jest.fn().mockResolvedValue(user) } as never,
      { isConfigured: () => false } as never,
    );
    const result = await service.predictionsForClerkUser('clerk_a');
    expect(result.empty).toBe(true);
    expect(result.items[0].kind).toBe('next');
  });
});
