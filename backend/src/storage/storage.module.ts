import { Logger, Module } from '@nestjs/common';
import { isProduction } from '../config/env';
import { LocalStorageService } from './local-storage.service';
import { readS3ConfigFromEnv, S3StorageService } from './s3-storage.service';
import { STORAGE_SERVICE, type StorageService } from './storage.types';

const logger = new Logger('StorageModule');

function createStorageService(): StorageService {
  const provider = (process.env.STORAGE_PROVIDER ?? '').toLowerCase();
  const s3Config = readS3ConfigFromEnv();

  if (provider === 's3' || provider === 'r2' || (!provider && s3Config)) {
    if (!s3Config) {
      throw new Error(
        'STORAGE_PROVIDER requires S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY',
      );
    }
    return new S3StorageService(s3Config);
  }

  if (isProduction()) {
    throw new Error(
      'Production requires STORAGE_PROVIDER=s3 or r2 with complete S3 credentials. Local filesystem fallback is disabled.',
    );
  }

  logger.warn(
    'Using local filesystem storage. Set STORAGE_PROVIDER=s3 (or r2) with credentials for object storage.',
  );
  return new LocalStorageService();
}

@Module({
  providers: [
    LocalStorageService,
    {
      provide: STORAGE_SERVICE,
      useFactory: createStorageService,
    },
  ],
  exports: [STORAGE_SERVICE, LocalStorageService],
})
export class StorageModule {}
