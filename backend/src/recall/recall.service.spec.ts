import { EntitlementFeature, EntitlementStatus, Prisma } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';
import { RecallService } from './recall.service';
import { RECALL_ENTITLEMENT_REQUIRED } from '../entitlements/entitlement.types';

describe('RecallService', () => {
  const clerkUserId = 'clerk_recall_user';
  const user = { id: 'user_recall', clerkUserId };

  let prisma: {
    recallEventReceipt: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      deleteMany: jest.Mock;
    };
    observation: { findMany: jest.Mock };
    entitlement: { findUnique: jest.Mock };
  };
  let users: { findOrCreateByClerkId: jest.Mock };
  let entitlements: {
    isAllowed: jest.Mock;
    getEntitlement: jest.Mock;
  };
  let observations: {
    createFromRecall: jest.Mock;
    deleteForClerkUser: jest.Mock;
  };
  let service: RecallService;

  function baseEvent(overrides: Record<string, unknown> = {}) {
    return {
      clientEventId: 'evt_recall_001',
      capturedAt: new Date().toISOString(),
      eventKind: 'screen_text',
      extractedText: 'Hybrid retrieval notes from GitHub pull request',
      fingerprint: 'b'.repeat(40),
      appPackage: 'com.github.android',
      pipelineVersion: '1.0.0',
      clientProcessingVersion: '1.0.0',
      ...overrides,
    };
  }

  beforeEach(() => {
    process.env.RECALL_ENABLED = 'true';
    process.env.RECALL_STUB_GRANT_ALL = 'false';
    delete process.env.RECALL_STUB_DEFAULT_STATUS;

    prisma = {
      recallEventReceipt: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'receipt_1' }),
        update: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      observation: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      entitlement: {
        findUnique: jest.fn(),
      },
    };
    users = {
      findOrCreateByClerkId: jest.fn().mockResolvedValue(user),
    };
    entitlements = {
      isAllowed: jest.fn().mockResolvedValue(true),
      getEntitlement: jest.fn().mockResolvedValue({
        feature: 'RECALL',
        status: EntitlementStatus.active,
        allowed: true,
        validUntil: null,
        source: 'test',
      }),
    };
    observations = {
      createFromRecall: jest.fn().mockResolvedValue({
        id: 'obs_recall_1',
        type: 'TEXT',
        sourceMetadata: { captureKind: 'recall' },
      }),
      deleteForClerkUser: jest.fn().mockResolvedValue(undefined),
    };

    service = new RecallService(
      prisma as never,
      users as never,
      entitlements as never,
      observations as never,
    );
    service.resetRateLimiter();
  });

  it('rejects when entitlement is not allowed', async () => {
    entitlements.isAllowed.mockResolvedValue(false);
    await expect(
      service.ingestEventsForClerkUser(clerkUserId, {
        events: [baseEvent()],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    try {
      await service.ingestEventsForClerkUser(clerkUserId, {
        events: [baseEvent()],
      });
    } catch (err) {
      const body = (err as ForbiddenException).getResponse() as {
        error?: { code?: string };
      };
      expect(body.error?.code).toBe(RECALL_ENTITLEMENT_REQUIRED);
    }
    expect(observations.createFromRecall).not.toHaveBeenCalled();
  });

  it('accepts a valid event and maps to TEXT observation', async () => {
    const result = await service.ingestEventsForClerkUser(clerkUserId, {
      events: [baseEvent()],
    });
    expect(result.results).toEqual([
      {
        clientEventId: 'evt_recall_001',
        status: 'accepted',
        observationId: 'obs_recall_1',
        deduped: false,
      },
    ]);
    expect(observations.createFromRecall).toHaveBeenCalledTimes(1);
    expect(prisma.recallEventReceipt.create).toHaveBeenCalled();
  });

  it('dedupes by clientEventId', async () => {
    prisma.recallEventReceipt.findUnique.mockResolvedValue({
      observationId: 'obs_existing',
      clientEventId: 'evt_recall_001',
    });
    const result = await service.ingestEventsForClerkUser(clerkUserId, {
      events: [baseEvent()],
    });
    expect(result.results[0]).toMatchObject({
      status: 'deduped',
      observationId: 'obs_existing',
      deduped: true,
    });
    expect(observations.createFromRecall).not.toHaveBeenCalled();
  });

  it('soft-dedupes by fingerprint within window', async () => {
    prisma.recallEventReceipt.findFirst.mockResolvedValue({
      observationId: 'obs_fp',
      fingerprint: 'b'.repeat(40),
    });
    const result = await service.ingestEventsForClerkUser(clerkUserId, {
      events: [baseEvent({ clientEventId: 'evt_recall_002' })],
    });
    expect(result.results[0]).toMatchObject({
      status: 'deduped',
      observationId: 'obs_fp',
      deduped: true,
    });
    expect(observations.createFromRecall).not.toHaveBeenCalled();
  });

  it('returns rejected for invalid events without failing the batch', async () => {
    const result = await service.ingestEventsForClerkUser(clerkUserId, {
      events: [
        baseEvent({ clientEventId: 'evt_ok_00002' }),
        baseEvent({ clientEventId: 'x', extractedText: '' }),
      ],
    });
    expect(result.results).toHaveLength(2);
    expect(result.results.some((r) => r.status === 'accepted')).toBe(true);
    expect(result.results.some((r) => r.status === 'rejected')).toBe(true);
  });

  it('rate limits when minute capacity is exhausted', async () => {
    const first = Array.from({ length: 20 }, (_, i) =>
      baseEvent({
        clientEventId: `evt_rate_a_${String(i).padStart(4, '0')}`,
        fingerprint: `fp_a_${String(i).padStart(8, '0')}_${'c'.repeat(20)}`,
      }),
    );
    const firstResult = await service.ingestEventsForClerkUser(clerkUserId, {
      events: first,
    });
    expect(
      firstResult.results.every(
        (r) => r.status === 'accepted' || r.status === 'deduped',
      ),
    ).toBe(true);

    const overflow = await service.ingestEventsForClerkUser(clerkUserId, {
      events: [
        baseEvent({
          clientEventId: 'evt_rate_b_0001',
          fingerprint: `fp_b_${'d'.repeat(28)}`,
        }),
      ],
    });
    expect(overflow.results[0]).toMatchObject({
      status: 'rejected',
      reason: 'Rate limited; retry later.',
    });
  });

  it('reserves the receipt before creating an observation on concurrent duplicates', async () => {
    prisma.recallEventReceipt.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    prisma.recallEventReceipt.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'receipt_won',
        observationId: 'obs_winner',
        clientEventId: 'evt_recall_001',
      });

    const result = await service.ingestEventsForClerkUser(clerkUserId, {
      events: [baseEvent()],
    });
    expect(result.results[0]).toMatchObject({
      status: 'deduped',
      observationId: 'obs_winner',
      deduped: true,
    });
    expect(observations.createFromRecall).not.toHaveBeenCalled();
  });

  it('accepts a partial batch when only some capacity remains', async () => {
    const first = Array.from({ length: 15 }, (_, i) =>
      baseEvent({
        clientEventId: `evt_part_a_${String(i).padStart(4, '0')}`,
        fingerprint: `fp_pa_${String(i).padStart(8, '0')}_${'e'.repeat(20)}`,
      }),
    );
    await service.ingestEventsForClerkUser(clerkUserId, { events: first });

    const second = Array.from({ length: 10 }, (_, i) =>
      baseEvent({
        clientEventId: `evt_part_b_${String(i).padStart(4, '0')}`,
        fingerprint: `fp_pb_${String(i).padStart(8, '0')}_${'f'.repeat(20)}`,
      }),
    );
    const result = await service.ingestEventsForClerkUser(clerkUserId, {
      events: second,
    });
    const accepted = result.results.filter((r) => r.status === 'accepted');
    const deferred = result.results.filter(
      (r) => r.status === 'rejected' && r.reason?.includes('Rate limited'),
    );
    expect(accepted).toHaveLength(5);
    expect(deferred).toHaveLength(5);
  });

  it('exposes entitlement for UI', async () => {
    const view = await service.getEntitlementForClerkUser(clerkUserId);
    expect(entitlements.getEntitlement).toHaveBeenCalledWith(
      user.id,
      EntitlementFeature.RECALL,
    );
    expect(view.allowed).toBe(true);
  });
});
