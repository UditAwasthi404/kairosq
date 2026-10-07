import { useAuth } from '@clerk/expo';
import { Redirect, useRouter } from 'expo-router';
import { useCallback } from 'react';

import { OnboardingCarousel } from '../components/OnboardingCarousel';
import { navigateToSignIn } from '../lib/auth-navigation';
import { SplashLoading } from '../components/ui/SplashLoading';
import { useOnboarding } from '../providers/OnboardingProvider';
import { useAppTheme } from '../providers/ThemeProvider';

export default function OnboardingScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const { completeOnboarding } = useOnboarding();
  const { toggleTheme } = useAppTheme();

  const handleComplete = useCallback(() => {
    void completeOnboarding().then(() => {
      navigateToSignIn(router);
    });
  }, [completeOnboarding, router]);

  if (!isLoaded) {
    return <SplashLoading />;
  }

  if (isSignedIn) {
    return <Redirect href="/(app)" />;
  }

  return (
    <OnboardingCarousel onToggleTheme={toggleTheme} onComplete={handleComplete} />
  );
}
