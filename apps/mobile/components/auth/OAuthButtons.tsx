import type { OAuthStrategy } from '@clerk/expo/types';
import { useSSO } from '@clerk/expo/experimental';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { AntDesign, FontAwesome } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import {
  beginSsoFlow,
  classifyOAuthResult,
  endSsoFlow,
  logOAuthDevEvent,
  navigateToAppWhenSignedIn,
  getOAuthRedirectUrl,
} from '../../lib/auth-oauth';
import { useAppTheme } from '../../providers/ThemeProvider';
import { ThemedText } from '../ThemedText';

WebBrowser.maybeCompleteAuthSession();

const OAUTH_PROVIDERS: {
  strategy: OAuthStrategy;
  label: string;
  icon: (color: string) => React.ReactNode;
}[] = [
  {
    strategy: 'oauth_google',
    label: 'Continue with Google',
    icon: (color: string) => <AntDesign name="google" size={20} color={color} />,
  },
  {
    strategy: 'oauth_github',
    label: 'Continue with GitHub',
    icon: (color: string) => <AntDesign name="github" size={20} color={color} />,
  },
  {
    strategy: 'oauth_linkedin_oidc',
    label: 'Continue with LinkedIn',
    icon: (color: string) => <FontAwesome name="linkedin-square" size={20} color={color} />,
  },
];

type OAuthButtonsProps = {
  disabled?: boolean;
  onError?: (message: string) => void;
};

function OAuthButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: (color: string) => React.ReactNode;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors, radius } = useAppTheme();

  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        {
          borderRadius: radius.full,
          borderColor: pressed ? colors.borderActive : colors.border,
          backgroundColor: pressed ? colors.buttonPressedFill : colors.buttonFill,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
      accessibilityLabel={label}
      accessibilityRole="button"
    >
      {icon(colors.buttonText)}
    </Pressable>
  );
}

export function OAuthButtons({ disabled = false, onError }: OAuthButtonsProps) {
  const { startSSOFlow } = useSSO();
  const { typography, spacing } = useAppTheme();
  const router = useRouter();
  const [activeStrategy, setActiveStrategy] = useState<OAuthStrategy | null>(null);

  const isOAuthBusy = activeStrategy !== null;
  const buttonsDisabled = disabled || isOAuthBusy;

  useEffect(() => {
    if (Platform.OS === 'android') {
      void WebBrowser.warmUpAsync();
      return () => {
        void WebBrowser.coolDownAsync();
      };
    }
  }, []);

  const handlePress = useCallback(
    async (strategy: OAuthStrategy) => {
      if (isOAuthBusy) {
        return;
      }

      setActiveStrategy(strategy);
      beginSsoFlow();

      try {
        const result = await startSSOFlow({
          strategy,
          redirectUrl: getOAuthRedirectUrl(),
        });

        if (
          result.authSessionResult?.type === 'cancel' ||
          result.authSessionResult?.type === 'dismiss'
        ) {
          logOAuthDevEvent('cancelled', { strategy });
          return;
        }

        const outcome = classifyOAuthResult(result);

        if (outcome.type === 'error') {
          logOAuthDevEvent(outcome.kind, { strategy });
          onError?.(outcome.message);
          return;
        }

        const navigated = await navigateToAppWhenSignedIn(router);

        if (navigated) {
          logOAuthDevEvent('success', { strategy });
          return;
        }

        if (outcome.type === 'pending') {
          logOAuthDevEvent('incomplete_flow', { strategy });
          onError?.('OAuth sign-in did not complete. Please try again.');
          return;
        }

        onError?.('Sign-in completed but the session could not be activated. Please try again.');
      } catch (error) {
        logOAuthDevEvent('clerk_auth_failure', {
          strategy,
          message: error instanceof Error ? error.message : 'unknown',
        });
        onError?.(
          error instanceof Error ? error.message : 'OAuth sign-in failed',
        );
      } finally {
        endSsoFlow();
        setActiveStrategy(null);
      }
    },
    [isOAuthBusy, onError, router, startSSOFlow],
  );

  return (
    <View style={[styles.container, { gap: spacing['2'] }]}>
      <ThemedText
        colorKey="textMuted"
        style={{
          textAlign: 'center',
          fontFamily: typography.overline.fontFamily,
          fontSize: typography.overline.size,
          letterSpacing: typography.overline.letterSpacing,
          marginBottom: spacing['1'],
        }}
      >
        OR CONTINUE WITH
      </ThemedText>
      <View style={styles.iconRow}>
        {OAUTH_PROVIDERS.map(({ strategy, label, icon }) => (
          <OAuthButton
            key={strategy}
            icon={icon}
            disabled={buttonsDisabled}
            label={label}
            onPress={() => void handlePress(strategy)}
          />
        ))}
      </View>
      {isOAuthBusy ? (
        <View style={styles.loading}>
          <ActivityIndicator />
        </View>
      ) : null}
    </View>
  );
}

export function OAuthButtonsLoading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  button: {
    borderWidth: 1,
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    alignItems: 'center',
    paddingVertical: 8,
  },
});
