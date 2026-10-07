import { profileSyncCopy, recordCaptureSync, setCaptureSyncInflight } from '../lib/syncStatus';

describe('profile offline sync copy', () => {
  it('shows device-saved count while waiting', () => {
    const copy = profileSyncCopy(3);
    expect(copy.title).toBe('3 saved on this device');
    expect(copy.detail).toBe('Will sync automatically');
  });

  it('shows syncing copy while a flush is in flight', () => {
    setCaptureSyncInflight(true);
    recordCaptureSync(0, 2);
    const copy = profileSyncCopy(2);
    expect(copy.title).toBe('Syncing 2 memories…');
    setCaptureSyncInflight(false);
  });

  it('shows synced when the queue is empty', () => {
    recordCaptureSync(1, 0);
    const copy = profileSyncCopy(0);
    expect(copy.title).toMatch(/All memories synced/);
  });
});
