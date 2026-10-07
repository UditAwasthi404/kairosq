import React from 'react';
import { StyleSheet, StyleProp, View, ViewStyle } from 'react-native';

import { ThemedText } from '../ThemedText';
import { TextAction } from './TextAction';
import { useAppTheme } from '../../providers/ThemeProvider';

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
  style,
}: SectionHeaderProps) {
  const { typography } = useAppTheme();

  return (
    <View style={[styles.row, style]}>
      <View style={styles.textCol}>
        <ThemedText
          colorKey="text"
          style={{
            fontFamily: typography.title3.fontFamily,
            fontSize: typography.title3.size,
            lineHeight: typography.title3.lineHeight,
            letterSpacing: typography.title3.letterSpacing,
          }}
        >
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText colorKey="textSecondary" style={styles.subtitle}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <TextAction label={actionLabel} onPress={onAction} />
      ) : null}
    </View>
  );
}

type SurfaceCardProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
  highlighted?: boolean;
};

export function SurfaceCard({
  children,
  style,
  elevated = false,
  highlighted = false,
}: SurfaceCardProps) {
  const { colors, radius, spacing } = useAppTheme();
  const shadow = elevated ? colors.shadowElevated : colors.shadow;

  return (
    <View
      style={[
        styles.cardBase,
        {
          borderRadius: radius.xl,
          backgroundColor: elevated ? colors.surfaceElevated : colors.surface,
          borderColor: highlighted ? colors.borderActive : colors.border,
          borderWidth: 1,
          padding: spacing['4'],
          gap: spacing['2'],
          ...(shadow ?? {}),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  subtitle: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 13,
    lineHeight: 18,
  },
  cardBase: {
    overflow: 'hidden',
  },
});
