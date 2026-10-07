import * as SecureStore from 'expo-secure-store';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

const ONBOARDING_KEY = 'kairos_onboarding_complete';

type OnboardingContextValue = {
  isReady: boolean;
  hasCompletedOnboarding: boolean;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const value = await SecureStore.getItemAsync(ONBOARDING_KEY);
        setHasCompletedOnboarding(value === 'true');
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  const completeOnboarding = useCallback(async () => {
    await SecureStore.setItemAsync(ONBOARDING_KEY, 'true');
    setHasCompletedOnboarding(true);
  }, []);

  const resetOnboarding = useCallback(async () => {
    await SecureStore.deleteItemAsync(ONBOARDING_KEY);
    setHasCompletedOnboarding(false);
  }, []);

  return (
    <OnboardingContext.Provider
      value={{ isReady, hasCompletedOnboarding, completeOnboarding, resetOnboarding }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);

  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }

  return context;
}
