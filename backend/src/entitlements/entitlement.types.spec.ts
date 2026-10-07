import { EntitlementStatus } from '@prisma/client';
import { isEntitlementStatusAllowed } from './entitlement.types';

describe('isEntitlementStatusAllowed', () => {
  const now = new Date('2026-09-19T12:00:00.000Z');

  it('allows active/trial/grace without expiry', () => {
    expect(
      isEntitlementStatusAllowed(EntitlementStatus.active, null, now),
    ).toBe(true);
    expect(isEntitlementStatusAllowed(EntitlementStatus.trial, null, now)).toBe(
      true,
    );
    expect(isEntitlementStatusAllowed(EntitlementStatus.grace, null, now)).toBe(
      true,
    );
  });

  it('denies inactive/expired/revoked', () => {
    expect(
      isEntitlementStatusAllowed(EntitlementStatus.inactive, null, now),
    ).toBe(false);
    expect(
      isEntitlementStatusAllowed(EntitlementStatus.expired, null, now),
    ).toBe(false);
    expect(
      isEntitlementStatusAllowed(EntitlementStatus.revoked, null, now),
    ).toBe(false);
  });

  it('denies when validUntil is in the past', () => {
    expect(
      isEntitlementStatusAllowed(
        EntitlementStatus.active,
        new Date('2026-09-18T12:00:00.000Z'),
        now,
      ),
    ).toBe(false);
  });

  it('allows when validUntil is in the future', () => {
    expect(
      isEntitlementStatusAllowed(
        EntitlementStatus.active,
        new Date('2026-09-20T12:00:00.000Z'),
        now,
      ),
    ).toBe(true);
  });
});
