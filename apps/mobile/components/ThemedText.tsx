import { StyleSheet, Text, TextProps, TextStyle, ImageStyle } from 'react-native';
import Animated, {
  AnimatedStyle,
  SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { ThemeColorKey } from '../theme';
import { useAppTheme } from '../providers/ThemeProvider';
import { themeColor } from '../themeAnimation';

type ThemedTextProps = TextProps & {
  /**
   * @deprecated Ignored for static text. Colors come from ThemeContext.colors.
   */
  themeProgress?: SharedValue<number>;
  colorKey: ThemeColorKey;
  style?: TextStyle | TextStyle[] | (TextStyle | undefined)[];
};

/**
 * App text uses static ThemeContext.colors (fast).
 * Change theme.ts → colors update everywhere this is used.
 */
export function ThemedText({
  themeProgress: _themeProgress,
  colorKey,
  style,
  ...props
}: ThemedTextProps) {
  const { colors } = useAppTheme();

  return <Text style={[{ color: colors[colorKey] }, style]} {...props} />;
}

/** Smooth color crossfade — only for onboarding (few nodes). */
export function AnimatedThemedText({
  themeProgress,
  colorKey,
  style,
  ...props
}: ThemedTextProps & { themeProgress: SharedValue<number> }) {
  const colorStyle = useAnimatedStyle(() => ({
    color: themeColor(themeProgress.value, colorKey),
  }));

  return <Animated.Text style={[style, colorStyle]} {...props} />;
}

type ThemedLogoProps = {
  themeProgress: SharedValue<number>;
  logoStyle: AnimatedStyle<ImageStyle>;
};

export function ThemedLogo({ themeProgress, logoStyle }: ThemedLogoProps) {
  const darkLogoStyle = useAnimatedStyle(() => ({
    opacity: 1 - themeProgress.value,
  }));

  const lightLogoStyle = useAnimatedStyle(() => ({
    opacity: themeProgress.value,
  }));

  return (
    <Animated.View style={styles.logoWrap}>
      <Animated.Image
        source={require('../assets/logo-light.png')}
        style={[styles.logo, logoStyle, darkLogoStyle]}
        resizeMode="contain"
      />
      <Animated.Image
        source={require('../assets/logo-dark.png')}
        style={[styles.logo, styles.logoOverlay, logoStyle, lightLogoStyle]}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  logoWrap: {
    width: 120,
    height: 120,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 120,
    height: 120,
  },
  logoOverlay: {
    position: 'absolute',
  },
});
