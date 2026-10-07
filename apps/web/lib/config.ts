/** True only when both Clerk keys are present. Safe to call from server code. */
export function isClerkConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() &&
      process.env.CLERK_SECRET_KEY?.trim(),
  );
}

export function clerkPublishableKey(): string | undefined {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  return key || undefined;
}
