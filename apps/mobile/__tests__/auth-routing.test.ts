import { resolveAuthRoute } from '../lib/auth-routing';

describe('resolveAuthRoute', () => {
  it('returns loading while Clerk is initializing', () => {
    expect(resolveAuthRoute(false, false, false)).toBe('loading');
    expect(resolveAuthRoute(false, true, true)).toBe('loading');
  });

  it('routes authenticated users to the app shell', () => {
    expect(resolveAuthRoute(true, true, false)).toBe('/(app)');
  });

  it('routes unauthenticated users to onboarding when not complete', () => {
    expect(resolveAuthRoute(true, false, false)).toBe('/onboarding');
  });

  it('routes unauthenticated users to sign-in after onboarding', () => {
    expect(resolveAuthRoute(true, false, true)).toBe('/(auth)/sign-in');
  });
});
