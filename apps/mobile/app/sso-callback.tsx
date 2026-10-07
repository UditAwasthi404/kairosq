import { useAuth } from '@clerk/expo';
import { getClerkInstance } from '@clerk/expo';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '../components/ThemedText';
import { navigateToApp, navigateToSignIn } from '../lib/auth-navigation';
import {
  isSsoFlowInProgress,
  logOAuthDevEvent,
  navigateToAppWhenSignedIn,
} from '../lib/auth-oauth';
import { useAppTheme } from '../providers/ThemeProvider';

function sanitizeNonce(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.replace(/#.*$/, '').trim() || undefined;
}

export default function SsoCallbackScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  const params = useLocalSearchParams<{ rotating_token_nonce?: string }>();
  const router = useRouter();
  const { themeProgress, isLight } = useAppTheme();
  const hasRun = useRef(false);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      navigateToApp(router);
    }
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (!isLoaded || hasRun.current) {
      return;
    }

    hasRun.current = true;

    void (async () => {
      if (isSignedIn) {
        return;
      }

      if (isSsoFlowInProgress()) {
        logOAuthDevEvent('incomplete_flow', {
          reason: 'sso_callback_waiting_for_start_sso_flow',
        });
        return;
      }

      const nonce = sanitizeNonce(
        typeof params.rotating_token_nonce === 'string'
          ? params.rotating_token_nonce
          : undefined,
      );

      if (!nonce) {
        logOAuthDevEvent('redirect_failure', {
          reason: 'missing_rotating_token_nonce',
        });
        navigateToSignIn(router);
        return;
      }

      try {
        const clerk = getClerkInstance();

        if (!clerk.client) {
          logOAuthDevEvent('clerk_auth_failure', {
            reason: 'clerk_client_unavailable',
          });
          navigateToSignIn(router);
          return;
        }

        const signIn = await clerk.client.signIn.reload({ rotatingTokenNonce: nonce });

        if (signIn.status === 'complete' && signIn.createdSessionId) {
          await clerk.setActive({ session: signIn.createdSessionId });
          const navigated = await navigateToAppWhenSignedIn(router);
          if (navigated) {
            logOAuthDevEvent('success', { reason: 'sso_callback_cold_start' });
            return;
          }
          logOAuthDevEvent('session_activation_failure', {
            reason: 'set_active_without_signed_in_state',
          });
          navigateToSignIn(router);
          return;
        }

        if (signIn.firstFactorVerification?.status === 'transferable') {
          const signUp = await clerk.client.signUp.create({ transfer: true });

          if (signUp.createdSessionId) {
            await clerk.setActive({ session: signUp.createdSessionId });
            const navigated = await navigateToAppWhenSignedIn(router);
            if (navigated) {
              logOAuthDevEvent('success', {
                reason: 'sso_callback_transfer_sign_up',
              });
              return;
            }
          }
        }

        logOAuthDevEvent('incomplete_flow', {
          reason: 'sso_callback_sign_in_not_complete',
          status: signIn.status ?? 'unknown',
        });
        navigateToSignIn(router);
      } catch (error) {
        logOAuthDevEvent('clerk_auth_failure', {
          reason: 'sso_callback_exception',
          message: error instanceof Error ? error.message : 'unknown',
        });
        navigateToSignIn(router);
      }
    })();
  }, [isLoaded, isSignedIn, params.rotating_token_nonce, router]);

  if (isSignedIn) {
    return <Redirect href="/(app)" />;
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={isLight ? '#111' : '#fff'} />
      <ThemedText themeProgress={themeProgress} colorKey="textSecondary" style={styles.label}>
        Completing sign in…
      </ThemedText>
      <View nativeID="clerk-captcha" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  label: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 15,
  },
});
