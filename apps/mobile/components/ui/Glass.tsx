import { StyleProp, View, ViewStyle } from 'react-native';

import { useAppTheme } from '../../providers/ThemeProvider';
import { AmbientBackground } from './system/AmbientBackground';

type ScreenGradientProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function ScreenGradient({ children, style }: ScreenGradientProps) {
  return <AmbientBackground style={style}>{children}</AmbientBackground>;
}

type AccentGradientProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  soft?: boolean;
};

export function AccentGradient({ children, style, soft = false }: AccentGradientProps) {
  const { colors, radius } = useAppTheme();

  return (
    <View
      style={[
        {
          borderRadius: radius.xl,
          overflow: 'hidden',
          backgroundColor: soft ? colors.primaryContainer : colors.primary,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

type GlassPanelProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  intensity?: number;
  elevated?: boolean;
  padded?: boolean;
};

export function GlassPanel({
  children,
  style,
  contentStyle,
  elevated = false,
  padded = true,
}: GlassPanelProps) {
  const { colors, radius, spacing } = useAppTheme();
  const shadow = elevated ? colors.shadowElevated : undefined;

  return (
    <View
      style={[
        {
          borderRadius: radius.xl,
          overflow: 'hidden',
          backgroundColor: colors.surfaceElevated,
          borderWidth: 1,
          borderColor: colors.border,
          ...(shadow ?? {}),
        },
        style,
      ]}
    >
      <View style={[padded && { padding: spacing['6'], gap: spacing['4'] }, contentStyle]}>
        {children}
      </View>
    </View>
  );
}
