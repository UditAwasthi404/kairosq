import { EntitlementStatus } from '@prisma/client';
import {
  revenueCatStripeCheckoutUrl,
  snapshotFromSubscriber,
} from './revenuecat-access';

describe('RevenueCat subscriber snapshots', () => {
  const now = new Date('2026-09-30T12:00:00.000Z');

  it('marks a Play subscriber as Pro', () => {
    const snapshot = snapshotFromSubscriber(
      {
        subscriber: {
          entitlements: {
            recall: {
              expires_date: '2026-10-30T12:00:00.000Z',
              product_identifier: 'kairos_pro_monthly',
            },
          },
          subscriptions: {
            kairos_pro_monthly: {
              store: 'play_store',
              expires_date: '2026-10-30T12:00:00.000Z',
              period_type: 'normal',
            },
          },
        },
      },
      now,
    );
    expect(snapshot).toMatchObject({
      isPro: true,
      status: EntitlementStatus.active,
      store: 'play_store',
      productId: 'kairos_pro_monthly',
    });
  });

  it('marks a Stripe subscriber as Pro when the stores are not the vendor', () => {
    const snapshot = snapshotFromSubscriber(
      {
        subscriber: {
          entitlements: {
            recall: {
              expires_date: '2026-10-30T12:00:00.000Z',
              product_identifier: 'kairos_pro_monthly',
            },
          },
          subscriptions: {
            kairos_pro_monthly: {
              store: 'stripe',
              expires_date: '2026-10-30T12:00:00.000Z',
              period_type: 'normal',
            },
          },
        },
      },
      now,
    );
    expect(snapshot.isPro).toBe(true);
    expect(snapshot.store).toBe('stripe');
  });

  it('keeps a billing-issue subscription in grace', () => {
    const snapshot = snapshotFromSubscriber(
      {
        subscriber: {
          entitlements: {
            recall: {
              expires_date: '2026-09-01T12:00:00.000Z',
              product_identifier: 'kairos_pro_monthly',
            },
          },
          subscriptions: {
            kairos_pro_monthly: {
              store: 'app_store',
              billing_issues_detected_at: '2026-09-28T12:00:00.000Z',
              grace_period_expires_date: '2026-10-12T12:00:00.000Z',
              period_type: 'normal',
            },
          },
        },
      },
      now,
    );
    expect(snapshot).toMatchObject({
      isPro: true,
      status: EntitlementStatus.grace,
      store: 'app_store',
    });
  });

  it('clears Pro after the entitlement expires', () => {
    const snapshot = snapshotFromSubscriber(
      {
        subscriber: {
          entitlements: {
            recall: {
              expires_date: '2026-09-01T12:00:00.000Z',
              product_identifier: 'kairos_pro_monthly',
            },
          },
          subscriptions: {
            kairos_pro_monthly: { store: 'stripe', period_type: 'normal' },
          },
        },
      },
      now,
    );
    expect(snapshot.isPro).toBe(false);
    expect(snapshot.status).toBe(EntitlementStatus.inactive);
  });

  it('builds an identified Stripe checkout URL', () => {
    expect(
      revenueCatStripeCheckoutUrl('https://pay.rev.cat/sandbox-link/', 'user_abc'),
    ).toBe(
      'https://pay.rev.cat/sandbox-link/user_abc?skip_purchase_success=true',
    );
  });

  it('rejects a non-https purchase link', () => {
    expect(() => revenueCatStripeCheckoutUrl('http://pay.rev.cat/link', 'user_abc')).toThrow(
      /https/,
    );
  });
});
