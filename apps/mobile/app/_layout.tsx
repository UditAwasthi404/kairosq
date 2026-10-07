import { ClerkProvider } from '@clerk/expo';
import { resourceCache } from '@clerk/expo/resource-cache';
import { tokenCache } from '@clerk/expo/token-cache';
import { Slot } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { assertClerkPublishableKey } from '../lib/config';
import '../lib/notifications';
import { OnboardingProvider } from '../providers/OnboardingProvider';
import { ThemeProvider } from '../providers/ThemeProvider';
import { SubscriptionProvider } from '../providers/SubscriptionProvider';

export default function RootLayout() {
  const publishableKey = assertClerkPublishableKey();

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      tokenCache={tokenCache}
      __experimental_resourceCache={resourceCache}
    >
      <GestureHandlerRootView style={styles.root}>
        <KeyboardProvider>
          <ThemeProvider>
            <SubscriptionProvider>
              <OnboardingProvider>
                <Slot />
              </OnboardingProvider>
            </SubscriptionProvider>
          </ThemeProvider>
        </KeyboardProvider>
      </GestureHandlerRootView>
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
