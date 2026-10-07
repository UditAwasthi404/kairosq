import { getClerkInstance } from '@clerk/expo';
import type { StartSSOFlowReturnType } from '@clerk/expo/experimental';
import * as AuthSession from 'expo-auth-session';
import type { Router } from 'expo-router';

import { navigateToApp } from './auth-navigation';

/** Matches app.json `"scheme": "kairos"` and the expo-router `sso-callback` route. */
let cachedOAuthRedirectUrl: string | undefined;

export function getOAuthRedirectUrl(): string {
  if (!cachedOAuthRedirectUrl) {
    // Match @clerk/expo/experimental default: no hardcoded scheme so Expo Go gets
    // exp://…/--/sso-callback and dev/production builds get kairos://sso-callback.
    cachedOAuthRedirectUrl = AuthSession.makeRedirectUri({
      path: 'sso-callback',
    });

    if (__DEV__) {
      console.info('[auth:oauth] redirectUrl', cachedOAuthRedirectUrl);
    }
  }

  return cachedOAuthRedirectUrl;
}

/**
 * Redirect URIs by environment (from AuthSession.makeRedirectUri({ path: 'sso-callback' })):
 * - Dev client / production build (scheme in app.json): kairos://sso-callback
 * - Expo Go: exp://<host>:<port>/--/sso-callback
 *
 * Whitelist the URI from getOAuthRedirectUrl() in Clerk Dashboard → Redirect URLs.
 */
export const oauthRedirectUriDocs = {
  devClientOrProduction: 'kairos://sso-callback',
  expoGo: 'exp://<host>:<port>/--/sso-callback',
} as const;

let ssoFlowInProgress = false;

export function isSsoFlowInProgress(): boolean {
  return ssoFlowInProgress;
}

export function beginSsoFlow(): void {
  ssoFlowInProgress = true;
}

export function endSsoFlow(): void {
  ssoFlowInProgress = false;
}

/** Reset for unit tests. */
export function resetSsoFlowStateForTests(): void {
  ssoFlowInProgress = false;
}

export type OAuthFailureKind =
  | 'cancelled'
  | 'redirect_failure'
  | 'provider_failure'
  | 'clerk_auth_failure'
  | 'session_activation_failure'
  | 'navigation_failure'
  | 'incomplete_flow';

export function logOAuthDevEvent(
  kind: OAuthFailureKind | 'success',
  detail: Record<string, string | boolean | undefined>,
): void {
  if (!__DEV__) {
    return;
  }

  console.info('[auth:oauth]', kind, detail);
}

function isClerkSessionActive(): boolean {
  const clerk = getClerkInstance();
  return Boolean(clerk.session?.id || clerk.user?.id);
}

export async function waitForSignedIn(timeoutMs = 15_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (isClerkSessionActive()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return false;
}

export function didOAuthRedirectSucceed(
  result: StartSSOFlowReturnType,
): boolean {
  return result.authSessionResult?.type === 'success';
}

export async function navigateToAppWhenSignedIn(
  router: Router,
): Promise<boolean> {
  const signedIn = await waitForSignedIn();

  if (!signedIn) {
    logOAuthDevEvent('session_activation_failure', {
      reason: 'timeout_waiting_for_clerk_session',
    });
    return false;
  }

  try {
    navigateToApp(router);
    return true;
  } catch {
    logOAuthDevEvent('navigation_failure', {
      reason: 'router_replace_failed',
    });
    return false;
  }
}

export type OAuthFlowOutcome =
  | { type: 'cancelled' }
  | { type: 'success' }
  | { type: 'pending' }
  | { type: 'error'; message: string; kind: OAuthFailureKind };

export function classifyOAuthResult(
  result: StartSSOFlowReturnType,
): OAuthFlowOutcome {
  if (result.authSessionResult?.type === 'cancel') {
    return { type: 'cancelled' };
  }

  if (result.authSessionResult?.type === 'dismiss') {
    return { type: 'cancelled' };
  }

  if (
    result.authSessionResult &&
    result.authSessionResult.type !== 'success'
  ) {
    return {
      type: 'error',
      kind: 'redirect_failure',
      message: 'OAuth redirect did not complete. Please try again.',
    };
  }

  if (result.createdSessionId) {
    return { type: 'success' };
  }

  if (result.signUp?.status === 'complete' || result.signIn?.status === 'complete') {
    return { type: 'success' };
  }

  if (result.authSessionResult?.type === 'success') {
    return { type: 'pending' };
  }

  return {
    type: 'error',
    kind: 'provider_failure',
    message: 'OAuth sign-in did not complete. Please try again.',
  };
}
