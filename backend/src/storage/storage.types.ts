export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');

export type StoredObject = {
  key: string;
  size: number;
  contentType: string;
};

export type SignedDownload = {
  url: string;
  expiresAt: string;
};

export interface StorageService {
  upload(key: string, data: Buffer, contentType: string): Promise<StoredObject>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getSignedDownloadUrl(
    key: string,
    expiresInSeconds?: number,
  ): Promise<SignedDownload>;
}
