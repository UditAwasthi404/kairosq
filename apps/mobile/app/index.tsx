import { useAuth } from '@clerk/expo';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { resolveAuthRoute } from '../lib/auth-routing';
import { checkConnection, useNetworkStatus } from '../lib/network';
import { useOnboarding } from '../providers/OnboardingProvider';
import { NetworkErrorScreen } from '../components/ui/NetworkStatus';
import { SplashLoading } from '../components/ui/SplashLoading';

const SLOW_START_MS = 8_000;

export default function SplashScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  const { isReady, hasCompletedOnboarding } = useOnboarding();
  const { online } = useNetworkStatus();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (isLoaded) return;
    const timer = setTimeout(() => {
      setSlow(true);
      void checkConnection();
    }, SLOW_START_MS);
    return () => clearTimeout(timer);
  }, [isLoaded]);

  if (!isLoaded || !isReady) {
    if (slow && !online) return <NetworkErrorScreen />;
    return <SplashLoading />;
  }

  const route = resolveAuthRoute(isLoaded, isSignedIn, hasCompletedOnboarding);

  if (route === 'loading') {
    return <SplashLoading />;
  }

  return <Redirect href={route} />;
}
