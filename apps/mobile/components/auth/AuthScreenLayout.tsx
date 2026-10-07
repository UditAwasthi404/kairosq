import React, { ReactNode, useEffect, useState } from 'react';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { itemEntering } from '../ui/Motion';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { useAppTheme } from '../../providers/ThemeProvider';
import { ThemeToggleButton } from '../ThemeToggleButton';
import { ThemedText } from '../ThemedText';

const VALUE_LINES = [
  'Remember what matters.',
  'Ask your past anything.',
  'See your patterns over time.',
  'Private by design.',
] as const;

type AuthScreenLayoutProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthScreenLayout({
  title,
  subtitle,
  children,
  footer,
}: AuthScreenLayoutProps) {
  const { toggleTheme, spacing, isLight, colors, typography, radius } = useAppTheme();
  const [line, setLine] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setLine((n) => (n + 1) % VALUE_LINES.length), 3200);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.root}
      >
        <View style={[styles.topBar, { paddingHorizontal: spacing['5'] }]}>
          <Image
            source={isLight ? require('../../assets/logo-dark.png') : require('../../assets/logo-light.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="Kairos"
          />
          <ThemeToggleButton onToggle={toggleTheme} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingHorizontal: spacing['6'], paddingBottom: spacing['8'], gap: spacing['4'] },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View entering={itemEntering(0)} style={styles.header}>
            <View style={[styles.markBadge, { backgroundColor: colors.primaryContainer, borderRadius: radius.full }]}>
              <ThemedText colorKey="primary" style={styles.markBadgeText}>
                WELCOME TO KAIROS
              </ThemedText>
            </View>
            <ThemedText
              colorKey="text"
              style={[
                styles.title,
                {
                  fontFamily: typography.display.fontFamily,
                  fontSize: 28,
                },
              ]}
            >
              {title}
            </ThemedText>
            {subtitle ? (
              <ThemedText colorKey="textSecondary" style={styles.subtitle}>
                {subtitle}
              </ThemedText>
            ) : null}
            <View style={styles.valueSlot}>
              <Animated.View key={line} entering={FadeIn.duration(360)} exiting={FadeOut.duration(200)}>
                <ThemedText colorKey="primary" style={styles.valueLine}>
                  {VALUE_LINES[line]}
                </ThemedText>
              </Animated.View>
            </View>
          </Animated.View>

          <Animated.View entering={itemEntering(1)} style={styles.formCard}>
            {children}
          </Animated.View>

          <Animated.View entering={itemEntering(2)}>{footer}</Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 54,
    paddingBottom: 8,
  },
  logo: {
    width: 90,
    height: 32,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  markBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  markBadgeText: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  title: {
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 14,
    textAlign: 'center',
  },
  formCard: {
    gap: 14,
  },
  valueSlot: {
    height: 22,
    justifyContent: 'center',
  },
  valueLine: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 14,
    textAlign: 'center',
  },
});
