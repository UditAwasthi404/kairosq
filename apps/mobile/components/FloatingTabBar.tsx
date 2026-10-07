import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardState } from 'react-native-keyboard-controller';

import { rememberTab, rememberedTab, type StableTab } from '../lib/lastRoute';
import { useTabPagerGesture } from './TabScreenSwipe';
import { BottomDock, type DockItem } from './ui/system/BottomDock';
import { control } from '../theme';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

const TAB_META: Record<string, { label: string; icon: FeatherName }> = {
  index: { label: 'Today', icon: 'sun' },
  library: { label: 'Library', icon: 'book-open' },
  capture: { label: 'Capture', icon: 'plus' },
  ask: { label: 'Ask', icon: 'message-circle' },
  profile: { label: 'You', icon: 'user' },
};

/** Only these five routes are dock items. Recall stays a screen, not a tab. */
export const NAV_TABS = ['index', 'library', 'capture', 'ask', 'profile'] as const;

export const FLOATING_TAB_BAR_CONTENT = control.dock + 12;

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardState((s) => s.isVisible);
  const visibility = useSharedValue(1);

  useEffect(() => {
    visibility.value = withTiming(keyboardVisible ? 0 : 1, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [keyboardVisible, visibility]);

  const routeName = state.routes[state.index]?.name;

  useEffect(() => {
    if (!routeName) return;
    if (routeName === 'index' || routeName === 'library' || routeName === 'ask' || routeName === 'profile') {
      rememberTab(routeName);
      return;
    }
    if (routeName === 'capture') return;
    const fallback: StableTab = rememberedTab();
    if (routeName !== fallback) navigation.navigate(fallback);
  }, [navigation, routeName]);

  const swipe = useTabPagerGesture();
  const visibleRoutes = NAV_TABS.flatMap((name) => {
    const index = state.routes.findIndex((route) => route.name === name);
    if (index < 0) return [];
    const route = state.routes[index];
    return [{ route, index, options: descriptors[route.key]?.options }];
  });

  const goToIndex = (next: number) => {
    const route = state.routes[next];
    if (!route || next === state.index) return;
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });
    if (!event.defaultPrevented) {
      navigation.navigate(route.name, route.params);
    }
  };

  const shellStyle = useAnimatedStyle(() => ({
    opacity: visibility.value,
    transform: [{ translateY: interpolate(visibility.value, [0, 1], [16, 0]) }],
  }));

  const items: DockItem[] = visibleRoutes.map(({ route, index }) => {
    const meta = TAB_META[route.name as (typeof NAV_TABS)[number]];
    return {
      key: route.key,
      label: meta.label,
      icon: meta.icon,
      active: state.index === index,
      onPress: () => goToIndex(index),
      onLongPress: () => {
        navigation.emit({
          type: 'tabLongPress',
          target: route.key,
        });
      },
    };
  });

  return (
    <Animated.View
      pointerEvents={keyboardVisible ? 'none' : 'auto'}
      style={[styles.wrap, { paddingBottom: insets.bottom }, shellStyle]}
      accessibilityRole="tablist"
    >
      <GestureDetector gesture={swipe}>
        <View>
          <BottomDock items={items} />
        </View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
