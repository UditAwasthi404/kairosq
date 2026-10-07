import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { EntitlementService } from './entitlement.service';
import type { EntitlementView } from './entitlement.types';
import {
  revenueCatStripeCheckoutUrl,
  snapshotFromSubscriber,
} from './revenuecat-access';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly users: UsersService,
    private readonly entitlements: EntitlementService,
  ) {}

  /**
   * Asks RevenueCat (App Store, Play, and Stripe) who this user is, then writes
   * `isPro` to Neon. A RevenueCat outage leaves the last saved row in place.
   */
  async syncClerkUser(clerkUserId: string): Promise<EntitlementView> {
    const user = await this.users.findOrCreateByClerkId(clerkUserId);
    const secret = process.env.REVENUECAT_SECRET_API_KEY?.trim();
    if (secret) {
      const snapshot = await this.fetchSubscriber(clerkUserId, secret);
      if (snapshot) {
        await this.entitlements.recordBillingSnapshot({
          userId: user.id,
          status: snapshot.status,
          validUntil: snapshot.validUntil,
          source: snapshot.store === 'stripe' ? 'stripe' : 'revenuecat',
          store: snapshot.store,
          productId: snapshot.productId,
          eventAt: new Date(),
        });
      }
    }
    return this.entitlements.getEntitlement(user.id);
  }

  /** Stripe checkout through RevenueCat when Play and the App Store are not the vendor. */
  async checkoutForClerkUser(clerkUserId: string): Promise<{ url: string; vendor: 'stripe' }> {
    const base = process.env.REVENUECAT_STRIPE_PURCHASE_URL?.trim();
    if (!base) {
      throw new ServiceUnavailableException(
        'Card checkout is not configured. Set REVENUECAT_STRIPE_PURCHASE_URL.',
      );
    }
    await this.users.findOrCreateByClerkId(clerkUserId);
    return {
      url: revenueCatStripeCheckoutUrl(base, clerkUserId),
      vendor: 'stripe',
    };
  }

  private async fetchSubscriber(appUserId: string, secret: string) {
    const url = `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`;
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${secret}`,
          Accept: 'application/json',
        },
      });
      if (!response.ok) {
        this.logger.warn(`RevenueCat subscriber lookup failed (${response.status}).`);
        return null;
      }
      return snapshotFromSubscriber(await response.json());
    } catch (error) {
      this.logger.warn(
        `RevenueCat subscriber lookup failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return null;
    }
  }
}
