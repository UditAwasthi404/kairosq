import { BadRequestException } from '@nestjs/common';
import { DevicePlatform } from '@prisma/client';

const MAX_TOKEN_LENGTH = 200;
const EXPO_PUSH_TOKEN = /^Expo(nent)?PushToken\[[^\s\]]+\]$/;

export function parseExpoPushToken(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException({
      error: {
        code: 'INVALID_PUSH_TOKEN',
        message: 'A valid Expo push token is required.',
      },
    });
  }
  const token = value.trim();
  if (token.length > MAX_TOKEN_LENGTH || !EXPO_PUSH_TOKEN.test(token)) {
    throw new BadRequestException({
      error: {
        code: 'INVALID_PUSH_TOKEN',
        message: 'A valid Expo push token is required.',
      },
    });
  }
  return token;
}

export function parseDevicePlatform(value: unknown): DevicePlatform {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (normalized === DevicePlatform.ANDROID || normalized === 'ANDROID') {
    return DevicePlatform.ANDROID;
  }
  if (normalized === DevicePlatform.IOS || normalized === 'IOS') {
    return DevicePlatform.IOS;
  }
  throw new BadRequestException({
    error: {
      code: 'INVALID_DEVICE_PLATFORM',
      message: 'platform must be ANDROID or IOS.',
    },
  });
}
