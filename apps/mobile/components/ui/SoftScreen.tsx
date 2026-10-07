import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '../ThemedText';
import { useAppTheme } from '../../providers/ThemeProvider';
import { AmbientBackground } from './system/AmbientBackground';
import { FLOATING_TAB_BAR_CONTENT } from '../FloatingTabBar';
import { SurfaceCard } from './SectionHeader';
import { fadeEntering, itemEntering, pageEntering, PressScale } from './Motion';

type IconName = React.ComponentProps<typeof Feather>['name'];

type SoftPageProps = {
  children: React.ReactNode;
  /** Extra bottom space for floating tab bar */
  tabBar?: boolean;
  /** Include top safe-area (only for headerless screens) */
  safeTop?: boolean;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

/** Atmospheric page shell with solid surface + generous padding. */
export function SoftPage({
  children,
  tabBar = false,
  safeTop = false,
  scroll = true,
  style,
  contentStyle,
}: SoftPageProps) {
  const insets = useSafeAreaInsets();
  const { spacing } = useAppTheme();
  const bottom = tabBar
    ? insets.bottom + FLOATING_TAB_BAR_CONTENT + spacing['5']
    : insets.bottom + spacing['6'];

  const pad = [
    styles.content,
    {
      paddingHorizontal: spacing['8'],
      gap: spacing['10'],
      paddingTop: safeTop ? insets.top + spacing['6'] : spacing['6'],
      paddingBottom: bottom,
    },
    contentStyle,
  ];

  return (
    <AmbientBackground style={style}>
      <Animated.View entering={scroll ? fadeEntering() : pageEntering()} style={{ flex: 1 }}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={pad}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {React.Children.toArray(children).map((child, index) => (
              <Animated.View
                key={React.isValidElement(child) && child.key != null ? child.key : index}
                entering={itemEntering(index)}
              >
                {child}
              </Animated.View>
            ))}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, pad]}>{children}</View>
        )}
      </Animated.View>
    </AmbientBackground>
  );
}

type SoftTitleProps = {
  children: string;
  trailing?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function SoftTitle({ children, trailing, style }: SoftTitleProps) {
  const { typography } = useAppTheme();

  return (
    <View style={[styles.titleRow, style]}>
      <ThemedText
        colorKey="text"
        style={[
          styles.title,
          {
            fontFamily: typography.title1.fontFamily,
            fontSize: typography.title1.size,
            lineHeight: typography.title1.lineHeight,
          },
        ]}
        numberOfLines={1}
      >
        {children}
      </ThemedText>
      {trailing}
    </View>
  );
}

type SoftRowProps = {
  label: string;
  icon?: IconName;
  meta?: string;
  onPress?: () => void;
  destructive?: boolean;
};

export function SoftRow({ label, icon, meta, onPress, destructive }: SoftRowProps) {
  const { colors, radius } = useAppTheme();

  const content = (
    <View style={styles.rowInner}>
      {icon ? (
        <View style={[styles.rowIcon, { backgroundColor: destructive ? colors.errorSurface : colors.surfaceContainer, borderRadius: radius.md }]}>
          <Feather
            name={icon}
            size={18}
            color={destructive ? colors.error : colors.textSecondary}
          />
        </View>
      ) : null}
      <ThemedText
        colorKey={destructive ? 'error' : 'text'}
        style={styles.rowLabel}
        numberOfLines={1}
      >
        {label}
      </ThemedText>
      {meta ? (
        <ThemedText colorKey="textSecondary" style={styles.rowMeta}>
          {meta}
        </ThemedText>
      ) : null}
      {onPress ? (
        <Feather name="chevron-right" size={18} color={colors.textMuted} />
      ) : null}
    </View>
  );

  if (!onPress) {
    return <SurfaceCard style={{ padding: 14 }}>{content}</SurfaceCard>;
  }

  return (
    <PressScale
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      accessibilityLabel={label}
    >
      <SurfaceCard style={{ padding: 14 }}>{content}</SurfaceCard>
    </PressScale>
  );
}

type SoftLink = {
  label: string;
  icon: IconName;
  onPress: () => void;
};

type SoftLinkListProps = {
  items: SoftLink[];
};

/** Grouped consumer-style list — solid card with clean rounded items and dividers. */
export function SoftLinkList({ items }: SoftLinkListProps) {
  const { colors, radius } = useAppTheme();

  return (
    <SurfaceCard style={{ padding: 0 }}>
      {items.map((item, index) => (
        <Animated.View key={item.label} entering={itemEntering(index)}>
          <PressScale
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              item.onPress();
            }}
            accessibilityLabel={item.label}
            style={[
              styles.linkRow,
              index < items.length - 1 && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <View style={[styles.rowIcon, { backgroundColor: colors.surfaceContainer, borderRadius: radius.md }]}>
              <Feather name={item.icon} size={18} color={colors.textSecondary} />
            </View>
            <ThemedText colorKey="text" style={styles.rowLabel} numberOfLines={1}>
              {item.label}
            </ThemedText>
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </PressScale>
        </Animated.View>
      ))}
    </SurfaceCard>
  );
}

type SoftTileProps = {
  icon: IconName;
  label: string;
  onPress: () => void;
  width?: number | `${number}%`;
};

export function SoftTile({ icon, label, onPress, width = '48%' }: SoftTileProps) {
  const { colors, radius } = useAppTheme();

  return (
    <PressScale
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      accessibilityLabel={label}
      style={{ width }}
    >
      <SurfaceCard style={styles.tileInner}>
        <View style={[styles.tileIcon, { backgroundColor: colors.surfaceContainer, borderRadius: radius.md }]}>
          <Feather name={icon} size={22} color={colors.textSecondary} />
        </View>
        <ThemedText colorKey="text" style={styles.tileLabel}>
          {label}
        </ThemedText>
      </SurfaceCard>
    </PressScale>
  );
}

type SoftIconBtnProps = {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export function SoftIconBtn({ icon, label, onPress, disabled }: SoftIconBtnProps) {
  const { colors, radius } = useAppTheme();

  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.iconBtn,
        {
          backgroundColor: colors.surfaceElevated,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.md,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <Feather name={icon} size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {},
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 40,
    marginBottom: 4,
  },
  title: {
    letterSpacing: -0.2,
    flex: 1,
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontFamily: 'Roboto_600SemiBold',
    fontSize: 16,
  },
  rowMeta: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 13,
  },
  linkRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 18,
    minHeight: 56,
  },
  tileInner: {
    minHeight: 96,
    padding: 16,
    justifyContent: 'space-between',
    gap: 12,
  },
  tileIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    fontFamily: 'Roboto_600SemiBold',
    fontSize: 15,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
