import {
  assertProductionConfig,
  contentDispositionAttachment,
  resolveCorsOrigin,
} from './env';

describe('production config safeguards', () => {
  const backup = { ...process.env };

  afterEach(() => {
    process.env = { ...backup };
  });

  function productionEnv() {
    process.env.NODE_ENV = 'production';
    process.env.CLERK_SECRET_KEY = 'sk_test';
    process.env.DATABASE_URL = 'postgres://example';
    process.env.DIRECT_URL = 'postgres://example';
    process.env.STORAGE_PROVIDER = 's3';
    process.env.S3_BUCKET = 'bucket';
    process.env.S3_ACCESS_KEY_ID = 'id';
    process.env.S3_SECRET_ACCESS_KEY = 'secret';
    process.env.REVENUECAT_WEBHOOK_AUTHORIZATION = 'Bearer test-secret';
    process.env.REVENUECAT_SECRET_API_KEY = 'sk_test';
    delete process.env.RECALL_STUB_GRANT_ALL;
    delete process.env.RECALL_STUB_DEFAULT_STATUS;
    delete process.env.SKIP_DB_CONNECT;
    delete process.env.EMBEDDING_PROVIDER;
  }

  it('accepts a complete production configuration', () => {
    productionEnv();
    expect(() => assertProductionConfig()).not.toThrow();
  });

  it('rejects Recall stub grant-all in production', () => {
    productionEnv();
    process.env.RECALL_STUB_GRANT_ALL = 'true';
    expect(() => assertProductionConfig()).toThrow(/RECALL_STUB_GRANT_ALL/);
  });

  it('rejects local embeddings in production', () => {
    productionEnv();
    process.env.EMBEDDING_PROVIDER = 'local';
    expect(() => assertProductionConfig()).toThrow(/local/);
  });

  it('rejects SKIP_DB_CONNECT in production', () => {
    productionEnv();
    process.env.SKIP_DB_CONNECT = 'true';
    expect(() => assertProductionConfig()).toThrow(/SKIP_DB_CONNECT/);
  });

  it('allows unknown browser origins only outside production', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.CORS_ORIGINS;
    expect(resolveCorsOrigin('https://evil.example')).toBe(true);
    process.env.NODE_ENV = 'production';
    expect(resolveCorsOrigin('https://evil.example')).toBe(false);
    expect(resolveCorsOrigin(undefined)).toBe(true);
  });

  it('sanitizes Content-Disposition filenames', () => {
    const header = contentDispositionAttachment('note\r\nX.txt');
    expect(header).not.toMatch(/\r|\n/);
    expect(header).toContain('filename=');
  });
});
