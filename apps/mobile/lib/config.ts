const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

export const clerkPublishableKey = publishableKey ?? '';

export const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_URL ??
  'https://kairos-production-774a.up.railway.app/';

export function assertClerkPublishableKey(): string {
  if (!clerkPublishableKey) {
    throw new Error(
      'Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in apps/mobile/.env',
    );
  }

  return clerkPublishableKey;
}
