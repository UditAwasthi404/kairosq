import { ForbiddenException } from '@nestjs/common';
import { EntitlementFeature, EntitlementStatus } from '@prisma/client';

export { EntitlementFeature, EntitlementStatus };

export type EntitlementView = {
  feature: 'RECALL';
  status: EntitlementStatus;
  allowed: boolean;
  /** Same as allowed. Stored on the Neon entitlement row as `isPro`. */
  isPro: boolean;
  validUntil: string | null;
  source: string;
  store: string | null;
};

export const RECALL_ENTITLEMENT_REQUIRED = 'RECALL_ENTITLEMENT_REQUIRED';

export function entitlementForbidden(): ForbiddenException {
  return new ForbiddenException({
    error: {
      code: RECALL_ENTITLEMENT_REQUIRED,
      message: 'Recall requires an active entitlement.',
    },
  });
}

export function isEntitlementStatusAllowed(
  status: EntitlementStatus,
  validUntil: Date | null | undefined,
  now = new Date(),
): boolean {
  if (
    status !== EntitlementStatus.active &&
    status !== EntitlementStatus.trial &&
    status !== EntitlementStatus.grace
  ) {
    return false;
  }
  if (validUntil && validUntil.getTime() < now.getTime()) {
    return false;
  }
  return true;
}

/** Billing provider abstraction. RevenueCat covers App Store, Play, and Stripe. */
export interface EntitlementProvider {
  readonly name: string;
  /**
   * Optional remote refresh. Stub returns null (DB/config is source of truth).
   */
  resolveRemote?(
    userId: string,
    feature: EntitlementFeature,
  ): Promise<{
    status: EntitlementStatus;
    validUntil: Date | null;
    source: string;
  } | null>;
}
