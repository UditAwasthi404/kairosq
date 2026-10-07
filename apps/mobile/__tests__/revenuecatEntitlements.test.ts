import type { CustomerInfo } from 'react-native-purchases';
import {
  getCustomerInfoAfterAction,
  hasRecallEntitlement,
} from '../lib/revenuecatEntitlements';

function customerInfo(active: Record<string, unknown>): CustomerInfo {
  return { entitlements: { active } } as CustomerInfo;
}

describe('Recall RevenueCat entitlement', () => {
  it('unlocks Recall only when the active recall entitlement exists', () => {
    expect(hasRecallEntitlement(customerInfo({ recall: { isActive: true } }))).toBe(true);
  });

  it('keeps free users and expired subscriptions locked', () => {
    expect(hasRecallEntitlement(customerInfo({}))).toBe(false);
    // RevenueCat places only currently active entitlements in this map.
    expect(hasRecallEntitlement(customerInfo({ other: { isActive: true } }))).toBe(false);
  });

  it('checks refreshed CustomerInfo after purchase and restore before unlocking', async () => {
    const purchased = customerInfo({ recall: { isActive: true } });
    const restored = customerInfo({ recall: { isActive: true } });
    const purchase = jest.fn().mockResolvedValue({});
    const restore = jest.fn().mockResolvedValue({});
    const getPurchasedInfo = jest.fn().mockResolvedValue(purchased);
    const getRestoredInfo = jest.fn().mockResolvedValue(restored);

    const afterPurchase = await getCustomerInfoAfterAction(purchase, getPurchasedInfo);
    const afterRestore = await getCustomerInfoAfterAction(restore, getRestoredInfo);
    expect(hasRecallEntitlement(afterPurchase)).toBe(true);
    expect(hasRecallEntitlement(afterRestore)).toBe(true);
    expect(purchase.mock.invocationCallOrder[0]).toBeLessThan(getPurchasedInfo.mock.invocationCallOrder[0]);
    expect(restore.mock.invocationCallOrder[0]).toBeLessThan(getRestoredInfo.mock.invocationCallOrder[0]);
  });
});
