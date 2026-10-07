import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

type Nav = {
  getState?: () => { type?: string; index?: number; routes?: Array<{ name: string; params?: object }> } | undefined;
  getParent?: () => Nav | undefined;
  navigate: (name: string, params?: object) => void;
};

function findTabNavigation(navigation: Nav): Nav {
  let current: Nav | undefined = navigation;
  while (current) {
    if (current.getState?.()?.type === 'tab') return current;
    current = current.getParent?.();
  }
  return navigation;
}

export function useTabPagerGesture() {
  const navigation = useNavigation() as unknown as Nav;
  const navRef = useRef(navigation);
  navRef.current = navigation;

  const goRelative = (dir: 1 | -1) => {
    const tabNav = findTabNavigation(navRef.current);
    const state = tabNav.getState?.();
    const routes = state?.routes ?? [];
    const index = state?.index ?? 0;
    const tabNames = ['index', 'library', 'ask', 'profile'];
    const tabs = tabNames.flatMap((name) => routes.filter((route) => route.name === name));
    const current = tabs.findIndex((route) => route.name === routes[index]?.name);
    const route = tabs[current + dir];
    if (!route) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    tabNav.navigate(route.name, route.params);
  };

  return Gesture.Pan()
    .activeOffsetX([-36, 36])
    .failOffsetY([-20, 20])
    .onEnd((event) => {
      'worklet';
      if (Math.abs(event.translationY) > Math.abs(event.translationX) * 0.7) return;
      if (Math.abs(event.translationX) < 56 && Math.abs(event.velocityX) < 750) return;
      const dir = event.translationX < 0 || event.velocityX < -500 ? 1 : -1;
      runOnJS(goRelative)(dir);
    });
}

export function TabScreenSwipe({ children }: { children: React.ReactNode }) {
  const swipe = useTabPagerGesture();

  return (
    <GestureDetector gesture={swipe}>
      <View style={styles.fill}>{children}</View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
