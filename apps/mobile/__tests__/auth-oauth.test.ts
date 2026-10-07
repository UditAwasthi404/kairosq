import type { StartSSOFlowReturnType } from '@clerk/expo/experimental';

import {
  beginSsoFlow,
  classifyOAuthResult,
  endSsoFlow,
  isSsoFlowInProgress,
  resetSsoFlowStateForTests,
} from '../lib/auth-oauth';

describe('auth-oauth flow guard', () => {
  beforeEach(() => {
    resetSsoFlowStateForTests();
  });

  it('tracks an in-progress SSO flow', () => {
    expect(isSsoFlowInProgress()).toBe(false);
    beginSsoFlow();
    expect(isSsoFlowInProgress()).toBe(true);
    endSsoFlow();
    expect(isSsoFlowInProgress()).toBe(false);
  });
});

describe('classifyOAuthResult', () => {
  const baseResult: StartSSOFlowReturnType = {
    createdSessionId: null,
    authSessionResult: null,
  };

  it('treats browser cancellation as cancelled', () => {
    expect(
      classifyOAuthResult({
        ...baseResult,
        authSessionResult: { type: 'cancel' } as StartSSOFlowReturnType['authSessionResult'],
      }),
    ).toEqual({ type: 'cancelled' });
  });

  it('treats browser dismiss as cancelled', () => {
    expect(
      classifyOAuthResult({
        ...baseResult,
        authSessionResult: { type: 'dismiss' } as StartSSOFlowReturnType['authSessionResult'],
      }),
    ).toEqual({ type: 'cancelled' });
  });

  it('does not treat cancellation as success', () => {
    const outcome = classifyOAuthResult({
      createdSessionId: 'sess_123',
      authSessionResult: { type: 'cancel' } as StartSSOFlowReturnType['authSessionResult'],
    });
    expect(outcome.type).toBe('cancelled');
  });

  it('treats createdSessionId as success', () => {
    expect(
      classifyOAuthResult({
        ...baseResult,
        createdSessionId: 'sess_123',
        authSessionResult: { type: 'success', url: 'kairos://sso-callback' },
      }),
    ).toEqual({ type: 'success' });
  });

  it('treats redirect failure as an error', () => {
    const outcome = classifyOAuthResult({
      ...baseResult,
      authSessionResult: { type: 'locked' } as StartSSOFlowReturnType['authSessionResult'],
    });
    expect(outcome).toEqual({
      type: 'error',
      kind: 'redirect_failure',
      message: 'OAuth redirect did not complete. Please try again.',
    });
  });

  it('treats successful redirect without session as pending', () => {
    const outcome = classifyOAuthResult({
      ...baseResult,
      authSessionResult: {
        type: 'success',
        url: 'kairos://sso-callback?rotating_token_nonce=abc',
      },
    });
    expect(outcome).toEqual({ type: 'pending' });
  });
});

describe('resolveAuthRoute auth guards', () => {
  const { resolveAuthRoute } = require('../lib/auth-routing');

  it('keeps authenticated users out of sign-in routing target', () => {
    expect(resolveAuthRoute(true, true, true)).toBe('/(app)');
  });

  it('keeps unauthenticated users out of the app shell', () => {
    expect(resolveAuthRoute(true, false, true)).toBe('/(auth)/sign-in');
  });
});
