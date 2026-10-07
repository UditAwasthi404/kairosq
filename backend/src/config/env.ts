import { readStubGrantAll } from '../entitlements/stub-entitlement.provider';
import { readS3ConfigFromEnv } from '../storage/s3-storage.service';

export type AppEnv = 'development' | 'test' | 'production';

export function readAppEnv(env: NodeJS.ProcessEnv = process.env): AppEnv {
  const raw = (env.NODE_ENV ?? 'development').trim().toLowerCase();
  if (raw === 'production' || raw === 'prod') return 'production';
  if (raw === 'test') return 'test';
  return 'development';
}

export function isProduction(env: NodeJS.ProcessEnv = process.env): boolean {
  return readAppEnv(env) === 'production';
}

export function isTestEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return readAppEnv(env) === 'test';
}

/**
 * Fail-fast in production when required config is missing or a
 * development bypass is still enabled.
 */
export function assertProductionConfig(
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (!isProduction(env)) return;

  const missing: string[] = [];
  const requireValue = (name: string) => {
    if (!env[name]?.trim()) missing.push(name);
  };

  requireValue('CLERK_SECRET_KEY');
  requireValue('DATABASE_URL');
  requireValue('DIRECT_URL');
  requireValue('REVENUECAT_WEBHOOK_AUTHORIZATION');
  requireValue('REVENUECAT_SECRET_API_KEY');

  const storageProvider = (env.STORAGE_PROVIDER ?? '').trim().toLowerCase();
  const s3Config = readS3ConfigFromEnv();
  const cloudStorage =
    storageProvider === 's3' ||
    storageProvider === 'r2' ||
    (!storageProvider && Boolean(s3Config));
  if (!cloudStorage || !s3Config) {
    missing.push(
      'STORAGE_PROVIDER=s3|r2 with S3_BUCKET/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY',
    );
  }

  if (missing.length > 0) {
    throw new Error(
      `Production configuration is incomplete: ${missing.join('; ')}`,
    );
  }

  if (env.SKIP_DB_CONNECT === 'true') {
    throw new Error('SKIP_DB_CONNECT cannot be enabled in production.');
  }

  if ((env.EMBEDDING_PROVIDER ?? '').trim().toLowerCase() === 'local') {
    throw new Error('EMBEDDING_PROVIDER=local is not allowed in production.');
  }

  if (readStubGrantAll()) {
    throw new Error(
      'RECALL_STUB_GRANT_ALL cannot be enabled in production. Use real entitlements.',
    );
  }

  const stubDefault = (env.RECALL_STUB_DEFAULT_STATUS ?? '').trim();
  if (stubDefault && stubDefault !== 'inactive') {
    throw new Error(
      'RECALL_STUB_DEFAULT_STATUS cannot grant access in production.',
    );
  }
}

/**
 * CORS: native mobile clients typically send no Origin.
 * Allow those. Browser origins must match CORS_ORIGINS in production.
 */
export function resolveCorsOrigin(
  origin: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean | string {
  if (!origin) return true;

  const raw = env.CORS_ORIGINS?.trim();
  if (!raw) {
    return isProduction(env) ? false : true;
  }
  if (raw === '*') {
    return isProduction(env) ? false : true;
  }

  const allowed = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return allowed.includes(origin) ? origin : false;
}

export function contentDispositionAttachment(filename: string): string {
  const cleaned = filename
    .replace(/[\r\n\x00-\x1f\x7f"]/g, '')
    .replace(/[\\/]/g, '')
    .slice(0, 180)
    .trim();
  const fallback = cleaned || 'download';
  const encoded = encodeURIComponent(fallback);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
