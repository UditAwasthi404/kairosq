import { BadRequestException } from '@nestjs/common';
import { ObservationType } from '@prisma/client';
import { MAX_UPLOAD_BYTES, validateUpload } from './file-validation';

describe('validateUpload', () => {
  it('accepts plain text', async () => {
    const result = await validateUpload({
      buffer: Buffer.from('hello world'),
      originalFilename: 'note.txt',
      declaredMimeType: 'text/plain',
    });
    expect(result.mimeType).toBe('text/plain');
    expect(result.observationType).toBe(ObservationType.TEXT);
  });

  it('rejects unsupported binary', async () => {
    await expect(
      validateUpload({
        buffer: Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]),
        originalFilename: 'x.bin',
        declaredMimeType: 'application/octet-stream',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts a PNG screenshot saved with a generic extension', async () => {
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
      0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
      0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xfe, 0xd4, 0x00, 0x00, 0x00,
      0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    const result = await validateUpload({
      buffer: png,
      originalFilename: 'share-123.bin',
      declaredMimeType: 'image/*',
    });
    expect(result.observationType).toBe(ObservationType.IMAGE);
    expect(result.mimeType).toBe('image/png');
    expect(result.safeFilename.endsWith('.png')).toBe(true);
  });

  it('accepts m4a audio by declared type', async () => {
    const result = await validateUpload({
      buffer: Buffer.from('not-magic-but-audio-bytes-for-test'),
      originalFilename: 'thought.m4a',
      declaredMimeType: 'audio/mp4',
    });
    expect(result.observationType).toBe(ObservationType.AUDIO);
    expect(result.mimeType).toBe('audio/mp4');
  });

  it('rejects oversized buffers', async () => {
    await expect(
      validateUpload({
        buffer: Buffer.alloc(MAX_UPLOAD_BYTES + 1, 0x61),
        originalFilename: 'big.txt',
        declaredMimeType: 'text/plain',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
