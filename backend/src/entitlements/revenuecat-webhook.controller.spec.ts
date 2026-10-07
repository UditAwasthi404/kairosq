import { EntitlementStatus } from '@prisma/client';
import { RevenueCatWebhookController } from './revenuecat-webhook.controller';

describe('RevenueCatWebhookController', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
  };
  const entitlements = {
    recordBillingSnapshot: jest.fn(),
  };
  let controller: RevenueCatWebhookController;
  const previousSecret = process.env.REVENUECAT_WEBHOOK_AUTHORIZATION;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.REVENUECAT_WEBHOOK_AUTHORIZATION = 'Bearer test-secret';
    prisma.user.findUnique.mockResolvedValue({ id: 'internal-user-a' });
    entitlements.recordBillingSnapshot.mockResolvedValue('applied');
    controller = new RevenueCatWebhookController(
      prisma as never,
      entitlements as never,
    );
  });

  afterAll(() => {
    if (previousSecret === undefined)
      delete process.env.REVENUECAT_WEBHOOK_AUTHORIZATION;
    else process.env.REVENUECAT_WEBHOOK_AUTHORIZATION = previousSecret;
  });

  it('writes active recall only for the exact app user ID', async () => {
    await controller.receive('Bearer test-secret', {
      event: {
        app_user_id: 'clerk-user-a',
        type: 'INITIAL_PURCHASE',
        entitlement_ids: ['recall'],
        expiration_at_ms: Date.now() + 60_000,
        store: 'PLAY_STORE',
        product_id: 'kairos_pro',
      },
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { clerkUserId: 'clerk-user-a' },
      select: { id: true },
    });
    expect(entitlements.recordBillingSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'internal-user-a',
        status: EntitlementStatus.active,
        source: 'revenuecat',
        store: 'play_store',
        productId: 'kairos_pro',
      }),
    );
  });

  it('records Stripe purchases as Pro with the stripe vendor', async () => {
    await controller.receive('Bearer test-secret', {
      event: {
        app_user_id: 'clerk-user-a',
        type: 'INITIAL_PURCHASE',
        entitlement_ids: ['recall'],
        expiration_at_ms: Date.now() + 60_000,
        store: 'STRIPE',
      },
    });
    expect(entitlements.recordBillingSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'stripe',
        store: 'stripe',
        status: EntitlementStatus.active,
      }),
    );
  });

  it('expires access when RevenueCat reports expiration', async () => {
    await controller.receive('Bearer test-secret', {
      event: {
        app_user_id: 'clerk-user-a',
        type: 'EXPIRATION',
        entitlement_ids: ['recall'],
        expiration_at_ms: Date.now() - 60_000,
      },
    });
    expect(entitlements.recordBillingSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ status: EntitlementStatus.inactive }),
    );
  });

  it('keeps canceled subscriptions active through their paid expiration', async () => {
    await controller.receive('Bearer test-secret', {
      event: {
        app_user_id: 'clerk-user-a',
        type: 'CANCELLATION',
        entitlement_ids: ['recall'],
        expiration_at_ms: Date.now() + 60_000,
      },
    });
    expect(entitlements.recordBillingSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ status: EntitlementStatus.active }),
    );
  });

  it('rejects webhooks without the configured authorization header', async () => {
    await expect(
      controller.receive(undefined, { event: {} }),
    ).rejects.toThrow();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('does not apply another entitlement or resolve RevenueCat aliases', async () => {
    await controller.receive('Bearer test-secret', {
      event: {
        app_user_id: '$RCAnonymousID:123',
        type: 'INITIAL_PURCHASE',
        entitlement_ids: ['other'],
      },
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(entitlements.recordBillingSnapshot).not.toHaveBeenCalled();
  });

  it('ignores RevenueCat event types that do not change access', async () => {
    await controller.receive('Bearer test-secret', {
      event: {
        app_user_id: 'clerk-user-a',
        type: 'TEST',
        entitlement_ids: ['recall'],
      },
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(entitlements.recordBillingSnapshot).not.toHaveBeenCalled();
  });

  it('reports when a newer snapshot already won', async () => {
    entitlements.recordBillingSnapshot.mockResolvedValue('stale');
    const result = await controller.receive('Bearer test-secret', {
      event: {
        app_user_id: 'clerk-user-a',
        type: 'EXPIRATION',
        entitlement_ids: ['recall'],
      },
    });
    expect(result).toEqual({ received: true, updated: false });
  });
});
