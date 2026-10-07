import { useAuth, useSignIn } from '@clerk/expo';
import * as Haptics from 'expo-haptics';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AuthScreenLayout } from '../../components/auth/AuthScreenLayout';
import { OAuthButtons } from '../../components/auth/OAuthButtons';
import { ThemedButton } from '../../components/ui/ThemedButton';
import { ThemedInput } from '../../components/ui/ThemedInput';
import { ThemedLink } from '../../components/ui/ThemedLink';
import { ThemedText } from '../../components/ThemedText';
import { navigateToApp } from '../../lib/auth-navigation';
import { useAppTheme } from '../../providers/ThemeProvider';

export default function SignInScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  const { signIn } = useSignIn();
  const { themeProgress, isLight, colors } = useAppTheme();
  const router = useRouter();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (errorMessage) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }, [errorMessage]);

  if (!isLoaded) {
    return (
      <View
        style={[
          styles.loading,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={colors.text} />
      </View>
    );
  }

  if (isSignedIn) {
    return <Redirect href="/(app)" />;
  }

  const handleSignIn = async () => {
    if (!signIn) {
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const { error } = await signIn.password({ identifier, password });

      if (error) {
        setErrorMessage(error.message ?? 'Sign in failed');
        return;
      }

      const { error: finalizeError } = await signIn.finalize();

      if (finalizeError) {
        setErrorMessage(
          finalizeError.message ?? 'Sign in could not be completed',
        );
        return;
      }

      navigateToApp(router);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Sign in failed',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const errorTextColor = colors.error;

  return (
    <AuthScreenLayout
      title="Sign in"
      footer={
        <View style={styles.footerRow}>
          <ThemedText
            themeProgress={themeProgress}
            colorKey="textMuted"
            style={styles.footerText}
          >
            New?{' '}
          </ThemedText>
          <ThemedLink href="/(auth)/sign-up" label="Sign up" />
        </View>
      }
    >
      <ThemedInput
        autoCapitalize="none"
        autoCorrect={false}
        editable={!isSubmitting}
        keyboardType="email-address"
        placeholder="Email or username"
        value={identifier}
        onChangeText={setIdentifier}
      />
      <ThemedInput
        editable={!isSubmitting}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {errorMessage ? (
        <View style={[styles.errorContainer, { backgroundColor: colors.errorSurface, borderColor: colors.error }]}>
          <Text style={[styles.errorText, { color: errorTextColor }]}>
            {errorMessage}
          </Text>
        </View>
      ) : null}

      <ThemedButton
        size="lg"
        disabled={isSubmitting}
        label={isSubmitting ? 'Signing in…' : 'Sign in'}
        onPress={() => void handleSignIn()}
      />

      <OAuthButtons disabled={isSubmitting} onError={setErrorMessage} />
      <View nativeID="clerk-captcha" />
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 4,
  },
  errorText: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 13,
  },
  footerText: {
    fontSize: 14,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
});