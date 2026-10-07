import {
  flushedCopy,
  hrefFromNotificationData,
  observationHref,
  uploadCopy,
} from '../lib/notifications';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
}));

jest.mock('expo-constants', () => ({
  expoConfig: { extra: { eas: { projectId: 'test-project' } } },
}));

describe('notification copy', () => {
  it('maps observation ids onto the memory route', () => {
    expect(observationHref('obs_1')).toBe('/(app)/observation/obs_1');
    expect(
      hrefFromNotificationData({
        href: '/(app)/observation/obs_1',
        observationId: 'obs_1',
      }),
    ).toBe('/(app)/observation/obs_1');
    expect(hrefFromNotificationData({ observationId: 'obs_9' })).toBe(
      '/(app)/observation/obs_9',
    );
    expect(hrefFromNotificationData({})).toBeNull();
  });

  it('describes share uploads and offline queue', () => {
    expect(uploadCopy({ queued: false, source: 'SHARE', observationId: 'obs_1' })).toMatchObject({
      kind: 'upload_saved',
      title: 'Saved to Kairos',
      observationId: 'obs_1',
    });
    expect(uploadCopy({ queued: true, source: 'KEYBOARD' })).toMatchObject({
      kind: 'upload_queued',
      title: 'Saved on this device',
    });
  });

  it('summarizes flushed offline captures', () => {
    expect(flushedCopy(0)).toBeNull();
    expect(flushedCopy(1)?.title).toBe('Capture uploaded');
    expect(flushedCopy(3)?.title).toBe('3 captures uploaded');
  });
});
