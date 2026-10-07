import { EntitlementFeature, EntitlementStatus } from '@prisma/client';
import { EntitlementService } from './entitlement.service';

describe('EntitlementService', () => {
  let prisma: {
    entitlement: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
  };
  let service: EntitlementService;

  beforeEach(() => {
    process.env.RECALL_ENABLED = 'true';
    delete process.env.RECALL_STUB_GRANT_ALL;
    delete process.env.RECALL_STUB_DEFAULT_STATUS;
    prisma = {
      entitlement: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
      },
    };
    service = new EntitlementService(prisma as never);
  });

  it('denies when no entitlement row exists', async () => {
    const view = await service.getEntitlement(
      'user_1',
      EntitlementFeature.RECALL,
    );
    expect(view.allowed).toBe(false);
    expect(view.status).toBe(EntitlementStatus.inactive);
  });

  it('allows stub grant-all without DB row', async () => {
    process.env.RECALL_STUB_GRANT_ALL = 'true';
    const view = await service.getEntitlement(
      'user_1',
      EntitlementFeature.RECALL,
    );
    expect(view.allowed).toBe(true);
    expect(view.source).toBe('stub_grant_all');
  });

  it('keeps an inactive DB row inactive even when stub grant-all is on', async () => {
    process.env.RECALL_STUB_GRANT_ALL = 'true';
    prisma.entitlement.findUnique.mockResolvedValue({
      status: EntitlementStatus.inactive,
      validUntil: null,
      source: 'admin',
      feature: EntitlementFeature.RECALL,
      store: null,
    });
    const view = await service.getEntitlement('user_1');
    expect(view.allowed).toBe(false);
    expect(view.isPro).toBe(false);
  });

  it('respects DB active entitlement', async () => {
    prisma.entitlement.findUnique.mockResolvedValue({
      status: EntitlementStatus.active,
      validUntil: null,
      source: 'admin',
      feature: EntitlementFeature.RECALL,
    });
    await expect(service.isAllowed('user_1')).resolves.toBe(true);
  });

  it('persists isPro and ignores an older billing event', async () => {
    prisma.entitlement.findUnique.mockResolvedValueOnce({
      lastEventAt: new Date('2026-09-30T12:00:00.000Z'),
    });
    const result = await service.recordBillingSnapshot({
      userId: 'user_1',
      status: EntitlementStatus.inactive,
      validUntil: null,
      source: 'revenuecat',
      store: 'play_store',
      productId: null,
      eventAt: new Date('2026-09-29T12:00:00.000Z'),
    });
    expect(result).toBe('stale');
    expect(prisma.entitlement.upsert).not.toHaveBeenCalled();
  });

  it('saves a Stripe grant as Pro', async () => {
    prisma.entitlement.findUnique.mockResolvedValueOnce(null);
    const result = await service.recordBillingSnapshot({
      userId: 'user_1',
      status: EntitlementStatus.active,
      validUntil: new Date('2026-10-30T12:00:00.000Z'),
      source: 'stripe',
      store: 'stripe',
      productId: 'kairos_pro_monthly',
      eventAt: new Date('2026-09-30T12:00:00.000Z'),
    });
    expect(result).toBe('applied');
    expect(prisma.entitlement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ isPro: true, store: 'stripe', source: 'stripe' }),
        update: expect.objectContaining({ isPro: true, store: 'stripe' }),
      }),
    );
  });

  it('denies when feature disabled', async () => {
    process.env.RECALL_ENABLED = 'false';
    process.env.RECALL_STUB_GRANT_ALL = 'true';
    const view = await service.getEntitlement('user_1');
    expect(view.allowed).toBe(false);
    expect(view.source).toBe('disabled');
  });
});
