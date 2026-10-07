import { selectRevenueCatApiKey } from '../lib/revenuecatApiKey';

describe('selectRevenueCatApiKey', () => {
  it.each(['ios', 'android'] as const)(
    'uses the Test Store key on %s in development',
    (platform) => {
      expect(
        selectRevenueCatApiKey({
          isDevelopment: true,
          platform,
          testStoreKey: ' test_public_key ',
          iosApiKey: 'ios_store_key',
          androidApiKey: 'android_store_key',
        }),
      ).toBe('test_public_key');
    },
  );

  it.each(['ios', 'android'] as const)(
    'does not fall back to a store key on %s in development',
    (platform) => {
      expect(
        selectRevenueCatApiKey({
          isDevelopment: true,
          platform,
          iosApiKey: 'ios_store_key',
          androidApiKey: 'android_store_key',
        }),
      ).toBeUndefined();
    },
  );

  it('keeps the configured platform key in release builds', () => {
    expect(
      selectRevenueCatApiKey({
        isDevelopment: false,
        platform: 'ios',
        testStoreKey: 'test_public_key',
        iosApiKey: 'ios_store_key',
        androidApiKey: 'android_store_key',
      }),
    ).toBe('ios_store_key');
    expect(
      selectRevenueCatApiKey({
        isDevelopment: false,
        platform: 'android',
        testStoreKey: 'test_public_key',
        iosApiKey: 'ios_store_key',
        androidApiKey: 'android_store_key',
      }),
    ).toBe('android_store_key');
  });
});
