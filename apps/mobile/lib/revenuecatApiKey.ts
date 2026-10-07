export type RevenueCatPlatform = 'ios' | 'android' | 'web';

export function selectRevenueCatApiKey(args: {
  isDevelopment: boolean;
  platform: RevenueCatPlatform;
  testStoreKey?: string;
  iosApiKey?: string;
  androidApiKey?: string;
}): string | undefined {
  if (args.isDevelopment) return args.testStoreKey?.trim() || undefined;

  if (args.platform === 'ios') return args.iosApiKey?.trim() || undefined;
  if (args.platform === 'android')
    return args.androidApiKey?.trim() || undefined;
  return undefined;
}
