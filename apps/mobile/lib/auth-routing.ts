export type AuthRoute = 'loading' | '/onboarding' | '/(app)' | '/(auth)/sign-in';

export function resolveAuthRoute(
  isLoaded: boolean,
  isSignedIn: boolean,
  hasCompletedOnboarding: boolean,
): AuthRoute {
  if (!isLoaded) {
    return 'loading';
  }

  if (isSignedIn) {
    return '/(app)';
  }

  if (!hasCompletedOnboarding) {
    return '/onboarding';
  }

  return '/(auth)/sign-in';
}
