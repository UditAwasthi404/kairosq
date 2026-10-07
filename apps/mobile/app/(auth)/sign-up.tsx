import { useAuth, useSignUp } from '@clerk/expo';
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

export default function SignUpScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  const { signUp } = useSignUp();
  const { themeProgress, isLight, colors } = useAppTheme();
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (errorMessage) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }, [errorMessage]);

  useEffect(() => {
    if (isVerifying) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [isVerifying]);

  useEffect(() => {
    if (isSignedIn) {
      navigateToApp(router);
    }
  }, [isSignedIn, router]);

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

  const errorTextColor = colors.error;

  const handleSignUp = async () => {
    if (!signUp) {
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const { error } = await signUp.password({
        username: username.trim() || undefined,
        emailAddress: emailAddress.trim(),
        password,
      });

      if (error) {
        setErrorMessage(error.message ?? 'Sign up failed');
        return;
      }

      const { error: sendError } = await signUp.verifications.sendEmailCode();

      if (sendError) {
        setErrorMessage(sendError.message ?? 'Could not send verification code');
        return;
      }

      setIsVerifying(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Sign up failed',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (!signUp) {
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const { error } = await signUp.verifications.verifyEmailCode({
        code: verificationCode,
      });

      if (error) {
        setErrorMessage(error.message ?? 'Verification failed');
        return;
      }

      const { error: finalizeError } = await signUp.finalize();

      if (finalizeError) {
        setErrorMessage(finalizeError.message ?? 'Sign up could not be completed');
        return;
      }

      navigateToApp(router);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Verification failed',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const footer = (
    <View style={styles.footerRow}>
      <ThemedText
        themeProgress={themeProgress}
        colorKey="textMuted"
        style={styles.footer}
      >
        Have an account?{' '}
      </ThemedText>
      <ThemedLink href="/(auth)/sign-in" label="Sign in" />
    </View>
  );

  if (isVerifying) {
    return (
      <AuthScreenLayout title="Verify" footer={footer}>
        <ThemedInput
          editable={!isSubmitting}
          keyboardType="number-pad"
          placeholder="Code"
          value={verificationCode}
          onChangeText={setVerificationCode}
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
          label={isSubmitting ? '…' : 'Continue'}
          onPress={() => void handleVerify()}
        />
        <View nativeID="clerk-captcha" />
      </AuthScreenLayout>
    );
  }

  return (
    <AuthScreenLayout title="Sign up" footer={footer}>
      <ThemedInput
        autoCapitalize="none"
        autoCorrect={false}
        editable={!isSubmitting}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
      />
      <ThemedInput
        autoCapitalize="none"
        autoCorrect={false}
        editable={!isSubmitting}
        keyboardType="email-address"
        placeholder="Email address"
        value={emailAddress}
        onChangeText={setEmailAddress}
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
        label={isSubmitting ? '…' : 'Sign up'}
        onPress={() => void handleSignUp()}
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
  footer: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 14,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
});
