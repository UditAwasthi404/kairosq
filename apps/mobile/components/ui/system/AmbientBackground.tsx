import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { dayPart, type DayPart } from '../../../lib/engagement';
import { useAppTheme } from '../../../providers/ThemeProvider';

type AmbientBackgroundProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** How far the red wash reaches down the screen at each part of the day. */
const REACH: Record<DayPart, readonly [number, number, number]> = {
  dawn: [0, 0.3, 0.58],
  morning: [0, 0.34, 0.64],
  afternoon: [0, 0.32, 0.62],
  evening: [0, 0.28, 0.56],
  night: [0, 0.22, 0.48],
};

/** Red falling into black. Light mode falls into the light field so body text stays readable. */
export function AmbientBackground({ children, style }: AmbientBackgroundProps) {
  const { colors, isLight } = useAppTheme();
  const part = dayPart();
  const mid = part === 'night' ? '#1F0E10' : part === 'evening' ? '#261114' : '#2A1214';
  const wash = isLight
    ? ([colors.primary, colors.background, colors.background] as const)
    : ([colors.primary, mid, colors.background] as const);

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }, style]}>
      <LinearGradient
        colors={wash}
        locations={REACH[part]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}
