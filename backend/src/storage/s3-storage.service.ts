import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';
import type {
  SignedDownload,
  StorageService,
  StoredObject,
} from './storage.types';

export type S3StorageConfig = {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
};

@Injectable()
export class S3StorageService implements StorageService {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: S3StorageConfig) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle ?? Boolean(config.endpoint),
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    this.logger.log(
      `Object storage ready (bucket=${config.bucket}, endpoint=${config.endpoint ?? 'aws'})`,
    );
  }

  async upload(
    key: string,
    data: Buffer,
    contentType: string,
  ): Promise<StoredObject> {
    const safeKey = assertSafeKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: safeKey,
        Body: data,
        ContentType: contentType,
      }),
    );
    return { key: safeKey, size: data.byteLength, contentType };
  }

  async get(key: string): Promise<Buffer> {
    const safeKey = assertSafeKey(key);
    const result = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: safeKey,
      }),
    );
    if (!result.Body) {
      throw new Error('Object body missing');
    }
    const bytes = await result.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  async delete(key: string): Promise<void> {
    const safeKey = assertSafeKey(key);
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: safeKey,
      }),
    );
  }

  async exists(key: string): Promise<boolean> {
    const safeKey = assertSafeKey(key);
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: safeKey,
        }),
      );
      return true;
    } catch (error) {
      const err = error as {
        name?: string;
        $metadata?: { httpStatusCode?: number };
      };
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  async getSignedDownloadUrl(
    key: string,
    expiresInSeconds = 300,
  ): Promise<SignedDownload> {
    const safeKey = assertSafeKey(key);
    const expiresIn = Math.min(Math.max(expiresInSeconds, 30), 3600);
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: safeKey,
      }),
      { expiresIn },
    );
    return {
      url,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  }
}

export function readS3ConfigFromEnv(): S3StorageConfig | null {
  const bucket = process.env.S3_BUCKET?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  if (!bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return {
    bucket,
    region: process.env.S3_REGION?.trim() || 'auto',
    endpoint: process.env.S3_ENDPOINT?.trim() || undefined,
    accessKeyId,
    secretAccessKey,
    forcePathStyle:
      process.env.S3_FORCE_PATH_STYLE === 'true' ||
      Boolean(process.env.S3_ENDPOINT?.trim()),
  };
}

function assertSafeKey(key: string): string {
  const normalizedKey = key.replace(/\\/g, '/').replace(/^\/+/, '');
  if (
    !normalizedKey ||
    normalizedKey.includes('..') ||
    normalizedKey.startsWith('/')
  ) {
    throw new Error('Invalid storage key');
  }
  return normalizedKey;
}
