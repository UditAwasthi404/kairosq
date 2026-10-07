import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LocalStorageService } from './local-storage.service';

describe('LocalStorageService', () => {
  let root: string;
  let storage: LocalStorageService;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'kairos-storage-'));
    process.env.STORAGE_ROOT = root;
    storage = new LocalStorageService();
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('uploads and reads objects', async () => {
    const key = 'observations/user/a.txt';
    await storage.upload(key, Buffer.from('hello'), 'text/plain');
    const data = await storage.get(key);
    expect(data.toString('utf8')).toBe('hello');
    await expect(storage.exists(key)).resolves.toBe(true);
  });

  it('rejects path traversal keys', async () => {
    await expect(
      storage.upload('../escape.txt', Buffer.from('x'), 'text/plain'),
    ).rejects.toThrow('Invalid storage key');
  });

  it('reports missing objects via exists()', async () => {
    await expect(storage.exists('missing/file.txt')).resolves.toBe(false);
  });
});
