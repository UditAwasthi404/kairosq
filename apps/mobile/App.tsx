/**
 * Legacy standalone entry. Production uses expo-router (`app/_layout.tsx`).
 * Kept in sync so typecheck passes.
 */
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

import { OnboardingCarousel } from './components/OnboardingCarousel';
import { ThemeProvider, useAppTheme } from './providers/ThemeProvider';

function LegacyOnboarding() {
  const { toggleTheme } = useAppTheme();
  return <OnboardingCarousel onToggleTheme={toggleTheme} />;
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider>
        <LegacyOnboarding />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
