import type { CustomerInfo } from 'react-native-purchases';

export function hasRecallEntitlement(customerInfo: CustomerInfo): boolean {
  return Boolean(customerInfo.entitlements.active.recall);
}

export async function getCustomerInfoAfterAction(
  action: () => Promise<unknown>,
  getCustomerInfo: () => Promise<CustomerInfo>,
): Promise<CustomerInfo> {
  await action();
  return getCustomerInfo();
}
