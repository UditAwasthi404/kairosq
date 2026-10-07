import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useAppTheme } from '../../providers/ThemeProvider';
import { control } from '../../theme';
import { TextAction } from './TextAction';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ThemedButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** `primary` = chunky lavender 3D tactile button
   *  `secondary` = soft lavender tinted button with purple depth
   *  `outline` = bordered tactile button
   *  `text` = text-only button
   */
  variant?: 'primary' | 'secondary' | 'outline' | 'text';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export function ThemedButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  size = 'md',
  icon,
  style,
  textStyle,
}: ThemedButtonProps) {
  const { colors, typography, radius, motion } = useAppTheme();
  const reduced = useReducedMotion();
  const press = useSharedValue(1);

  if (variant === 'text') {
    return <TextAction label={label} onPress={onPress} disabled={disabled || loading} />;
  }

  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isOutline = variant === 'outline';

  const heights = {
    sm: { height: control.buttonSm, paddingH: 14, fontSize: typography.caption.size },
    md: { height: control.buttonMd, paddingH: 20, fontSize: typography.button.size },
    lg: { height: control.buttonLg, paddingH: 24, fontSize: typography.button.size },
  }[size];

  const topBg = isPrimary
    ? colors.buttonFill
    : isSecondary
      ? colors.buttonSecondaryFill
      : colors.surface;

  const textColor = isPrimary
    ? colors.buttonText
    : isSecondary
      ? colors.buttonSecondaryText
      : colors.text;

  const borderStroke = isOutline ? colors.border : 'transparent';

  const innerAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value }],
  }));

  const handlePressIn = () => {
    if (!disabled && !loading) {
      press.value = withTiming(motion.pressScale, {
        duration: reduced ? 0 : motion.fast,
        easing: Easing.out(Easing.cubic),
      });
    }
  };

  const handlePressOut = () => {
    press.value = reduced ? 1 : withSpring(1, { damping: 16, stiffness: 280, mass: 0.7 });
  };

  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  const borderRadius = radius.lg;

  return (
    <View style={style}>
      <AnimatedPressable
        disabled={disabled || loading}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: disabled || loading }}
        style={[
          styles.innerButton,
          {
            height: heights.height,
            borderRadius,
            backgroundColor: disabled ? colors.buttonDisabledFill : topBg,
            borderWidth: isOutline ? 1 : 0,
            borderColor: borderStroke,
            paddingHorizontal: heights.paddingH,
            opacity: disabled ? 0.55 : 1,
          },
          innerAnimStyle,
        ]}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={disabled ? colors.buttonDisabledText : textColor}
          />
        ) : (
          <View style={styles.contentRow}>
            {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
            <Text
              style={[
                styles.label,
                {
                  fontSize: heights.fontSize,
                  letterSpacing: typography.button.letterSpacing,
                  color: disabled ? colors.buttonDisabledText : textColor,
                  fontFamily: typography.button.fontFamily,
                },
                textStyle,
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </View>
        )}
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  innerButton: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});
