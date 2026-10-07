import { BadRequestException } from '@nestjs/common';

export function parseLeaderboardScope(value: unknown): 'global' | 'circle' {
  if (value == null || value === 'global') return 'global';
  if (value === 'circle') return 'circle';
  throw new BadRequestException({
    error: { code: 'INVALID_SCOPE', message: 'Scope must be global or circle.' },
  });
}

export function parseDisplayName(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'string') {
    throw new BadRequestException({
      error: { code: 'INVALID_NAME', message: 'Display name must be text.' },
    });
  }
  const name = value.trim().replace(/\s+/g, ' ').slice(0, 32);
  return name.length > 0 ? name : undefined;
}

export function parseBooleanFlag(value: unknown, field: string): boolean | undefined {
  if (value == null) return undefined;
  if (typeof value === 'boolean') return value;
  throw new BadRequestException({
    error: { code: 'INVALID_FLAG', message: `${field} must be true or false.` },
  });
}

export function parseCosmeticKey(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException({
      error: { code: 'INVALID_COSMETIC', message: 'Cosmetic key is required.' },
    });
  }
  return value.trim();
}

export function parsePeerId(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length < 8) {
    throw new BadRequestException({
      error: { code: 'INVALID_PEER', message: 'A peer user id is required.' },
    });
  }
  return value.trim();
}
