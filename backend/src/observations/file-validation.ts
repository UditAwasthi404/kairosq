import { BadRequestException } from '@nestjs/common';
import { ObservationType } from '@prisma/client';
import FileType from 'file-type';
import * as path from 'path';

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB

const ALLOWED_BY_MIME: Record<
  string,
  { extensions: string[]; type: ObservationType }
> = {
  'application/pdf': { extensions: ['.pdf'], type: ObservationType.PDF },
  'text/plain': {
    extensions: ['.txt', '.text', '.md'],
    type: ObservationType.TEXT,
  },
  'image/jpeg': { extensions: ['.jpg', '.jpeg'], type: ObservationType.IMAGE },
  'image/png': { extensions: ['.png'], type: ObservationType.IMAGE },
  'image/webp': { extensions: ['.webp'], type: ObservationType.IMAGE },
  'image/gif': { extensions: ['.gif'], type: ObservationType.IMAGE },
  'audio/mpeg': {
    extensions: ['.mp3', '.mpga', '.mpeg'],
    type: ObservationType.AUDIO,
  },
  'audio/mp4': { extensions: ['.m4a', '.mp4'], type: ObservationType.AUDIO },
  'audio/x-m4a': { extensions: ['.m4a'], type: ObservationType.AUDIO },
  'audio/m4a': { extensions: ['.m4a'], type: ObservationType.AUDIO },
  'audio/wav': { extensions: ['.wav'], type: ObservationType.AUDIO },
  'audio/wave': { extensions: ['.wav'], type: ObservationType.AUDIO },
  'audio/x-wav': { extensions: ['.wav'], type: ObservationType.AUDIO },
  'audio/vnd.wave': { extensions: ['.wav'], type: ObservationType.AUDIO },
  'audio/webm': { extensions: ['.webm'], type: ObservationType.AUDIO },
  'audio/ogg': { extensions: ['.ogg', '.oga'], type: ObservationType.AUDIO },
  'audio/aac': { extensions: ['.aac'], type: ObservationType.AUDIO },
  'audio/x-aac': { extensions: ['.aac'], type: ObservationType.AUDIO },
};

const AUDIO_EXTENSIONS = new Set([
  '.mp3',
  '.mpga',
  '.mpeg',
  '.m4a',
  '.mp4',
  '.wav',
  '.webm',
  '.ogg',
  '.oga',
  '.aac',
]);

const MIME_ALIASES: Record<string, string> = {
  'audio/x-m4a': 'audio/mp4',
  'audio/m4a': 'audio/mp4',
  'audio/wave': 'audio/wav',
  'audio/x-wav': 'audio/wav',
  'audio/vnd.wave': 'audio/wav',
  'audio/x-aac': 'audio/aac',
  'video/mp4': 'audio/mp4',
};

export type ValidatedUpload = {
  mimeType: string;
  extension: string;
  observationType: ObservationType;
  safeFilename: string;
};

export async function validateUpload(params: {
  buffer: Buffer;
  originalFilename: string;
  declaredMimeType?: string;
}): Promise<ValidatedUpload> {
  const { buffer, originalFilename, declaredMimeType } = params;

  if (!buffer?.length) {
    throw new BadRequestException({
      error: {
        code: 'EMPTY_FILE',
        message: 'Uploaded file is empty.',
      },
    });
  }

  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new BadRequestException({
      error: {
        code: 'FILE_TOO_LARGE',
        message: `File exceeds the maximum size of ${MAX_UPLOAD_BYTES} bytes.`,
      },
    });
  }

  const detected = await FileType.fromBuffer(buffer);
  const extension = path.extname(originalFilename).toLowerCase();
  const safeFilename = sanitizeFilename(originalFilename);

  // text/plain often has no magic bytes — fall back carefully
  let mimeType: string | undefined = detected?.mime
    ? MIME_ALIASES[detected.mime] || detected.mime
    : undefined;
  if (!mimeType) {
    if (
      declaredMimeType === 'text/plain' ||
      ['.txt', '.text', '.md'].includes(extension)
    ) {
      if (!looksLikeUtf8Text(buffer)) {
        throw new BadRequestException({
          error: {
            code: 'UNSUPPORTED_FILE',
            message: 'Unsupported or unrecognized file type.',
          },
        });
      }
      mimeType = 'text/plain';
    } else if (
      AUDIO_EXTENSIONS.has(extension) &&
      (declaredMimeType?.startsWith('audio/') ||
        declaredMimeType === 'video/mp4')
    ) {
      mimeType = MIME_ALIASES[declaredMimeType] || declaredMimeType;
    }
  }

  if (!mimeType || !ALLOWED_BY_MIME[mimeType]) {
    throw new BadRequestException({
      error: {
        code: 'UNSUPPORTED_FILE',
        message:
          'Unsupported file type. Allowed: PDF, TXT, JPEG, PNG, WebP, GIF, MP3, M4A, WAV, OGG, WEBM, AAC.',
      },
    });
  }

  const rule = ALLOWED_BY_MIME[mimeType];
  const genericExtension = !extension || ['.bin', '.dat', '.tmp', '.file'].includes(extension);
  if (extension && !genericExtension && !rule.extensions.includes(extension)) {
    throw new BadRequestException({
      error: {
        code: 'UNSUPPORTED_FILE',
        message: 'File extension does not match the detected file type.',
      },
    });
  }

  const finalExtension = rule.extensions.includes(extension)
    ? extension
    : rule.extensions[0];
  const named = safeFilename.includes('.')
    ? safeFilename.replace(/\.[^.]+$/, finalExtension)
    : `${safeFilename}${finalExtension}`;

  return {
    mimeType,
    extension: finalExtension,
    observationType: rule.type,
    safeFilename: named,
  };
}

export function sanitizeFilename(filename: string): string {
  const base = path
    .basename(filename || 'upload')
    .replace(/[^\w.\-()+ ]+/g, '_');
  const trimmed = base.trim().slice(0, 180);
  return trimmed || 'upload';
}

function looksLikeUtf8Text(buffer: Buffer): boolean {
  // Reject buffers with too many nulls / control chars (except common whitespace)
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
  let suspicious = 0;
  for (const byte of sample) {
    if (byte === 0) return false;
    if (byte < 7 || (byte > 14 && byte < 32)) {
      suspicious += 1;
    }
  }
  return suspicious / sample.length < 0.05;
}
