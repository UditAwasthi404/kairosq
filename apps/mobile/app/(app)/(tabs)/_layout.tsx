import { Easing } from 'react-native';
import { Tabs } from 'expo-router';

import { FloatingTabBar } from '../../../components/FloatingTabBar';
import { useAppTheme } from '../../../providers/ThemeProvider';
import { motion } from '../../../theme';

export default function TabsLayout() {
  const { colors } = useAppTheme();

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontFamily: 'Roboto_500Medium',
          fontSize: 18,
        },
        headerShadowVisible: false,
        tabBarStyle: {
          position: 'absolute',
          height: 0,
          overflow: 'hidden',
          opacity: 0,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarHideOnKeyboard: true,
        lazy: true,
        freezeOnBlur: true,
        animation: 'shift',
        transitionSpec: {
          animation: 'timing',
          config: {
            duration: motion.page,
            easing: Easing.out(Easing.cubic),
          },
        },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          headerShown: false,
          tabBarAccessibilityLabel: 'Today',
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          headerShown: false,
          tabBarAccessibilityLabel: 'Library',
        }}
      />
      <Tabs.Screen
        name="ask"
        options={{
          title: 'Ask',
          headerShown: false,
          tabBarAccessibilityLabel: 'Ask',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'You',
          headerShown: false,
          tabBarAccessibilityLabel: 'You',
        }}
      />
      <Tabs.Screen
        name="capture"
        options={{
          title: 'Capture',
          headerShown: false,
          tabBarAccessibilityLabel: 'Capture',
        }}
      />
      <Tabs.Screen name="recall" options={{ href: null }} />
      <Tabs.Screen name="recall-screen" options={{ href: null }} />
    </Tabs>
  );
}
