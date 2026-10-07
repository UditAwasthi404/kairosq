import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  ReduceMotion,
  ZoomIn,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useReducedMotion } from '../../hooks/useReducedMotion';
import { motion } from '../../theme';

const easeOut = Easing.out(Easing.cubic);
const softSpring = { damping: 18, stiffness: 260, mass: 0.7 } as const;

export const pageEntering = (delay = 0) =>
  FadeInDown.duration(motion.page)
    .easing(easeOut)
    .delay(delay)
    .reduceMotion(ReduceMotion.System);

export const fadeEntering = (delay = 0) =>
  FadeIn.duration(motion.normal).delay(delay).reduceMotion(ReduceMotion.System);

export const itemEntering = (index: number) =>
  FadeInDown.duration(motion.normal)
    .easing(easeOut)
    .delay(Math.min(index, 8) * motion.stagger)
    .reduceMotion(ReduceMotion.System);

export const messageEntering = () =>
  FadeInUp.duration(motion.normal).easing(easeOut).reduceMotion(ReduceMotion.System);

export const popEntering = (delay = 160) =>
  ZoomIn.duration(motion.normal)
    .easing(easeOut)
    .delay(delay)
    .reduceMotion(ReduceMotion.System);

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PressScaleProps = {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'search';
};

export function PressScale({
  children,
  onPress,
  onLongPress,
  disabled,
  style,
  accessibilityLabel,
  accessibilityRole = 'button',
}: PressScaleProps) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => {
        if (!disabled) {
          scale.value = withTiming(motion.pressScale, {
            duration: reduced ? 0 : motion.fast,
            easing: easeOut,
          });
        }
      }}
      onPressOut={() => {
        scale.value = reduced ? 1 : withSpring(1, softSpring);
      }}
      style={[animatedStyle, style]}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </AnimatedPressable>
  );
}

/** Counts from the previous value to the next so changes register as progress. */
export function CountUp({
  value,
  duration = 700,
  style,
  format = (n: number) => n.toLocaleString(),
}: {
  value: number;
  duration?: number;
  style?: StyleProp<TextStyle>;
  format?: (n: number) => string;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  const from = useRef(reduced ? value : 0);

  useEffect(() => {
    if (reduced || from.current === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = from.current;
    const began = Date.now();
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - began) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(start + (value - start) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, reduced, value]);

  return <Text style={style}>{format(shown)}</Text>;
}

/** Slow, low-amplitude pulse for the one element on screen that deserves attention. */
export function Breathe({
  children,
  active = true,
  amount = 0.04,
  period = 2400,
  style,
}: {
  children: React.ReactNode;
  active?: boolean;
  amount?: number;
  period?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!active || reduced) {
      cancelAnimation(pulse);
      pulse.value = withTiming(0, { duration: motion.fast });
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: period / 2, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [active, period, pulse, reduced]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * amount }],
  }));

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}

/** Springs in once when `trigger` changes. Use on values that just improved. */
export function Pop({
  trigger,
  children,
  style,
}: {
  trigger: unknown;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced) return;
    scale.value = withSequence(withTiming(1.14, { duration: 120, easing: easeOut }), withSpring(1, softSpring));
  }, [reduced, scale, trigger]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Progress ring that draws from empty to its value, then eases between updates. */
export function ProgressRing({
  size,
  stroke,
  progress,
  color,
  track,
  children,
  delay = 180,
}: {
  size: number;
  stroke: number;
  progress: number;
  color: string;
  track: string;
  children?: React.ReactNode;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const target = Math.max(0, Math.min(1, progress));
  const drawn = useSharedValue(reduced ? target : 0);

  useEffect(() => {
    if (reduced) {
      drawn.value = target;
      return;
    }
    drawn.value = withDelay(delay, withTiming(target, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [delay, drawn, reduced, target]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - drawn.value),
  }));

  const center = size / 2;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={center} cy={center} r={radius} stroke={track} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.ringCenter]}>{children}</View>
    </View>
  );
}

const BURST_DOTS = 12;

/**
 * Nothing-style dot burst. Plain Animated.Views, not SVG groups, so Android never
 * composites layered opacity. Remount with a new `key` to replay.
 */
export function DotBurst({ color, size = 120 }: { color: string; size?: number }) {
  const reduced = useReducedMotion();
  if (reduced) return null;
  return (
    <View pointerEvents="none" style={[styles.burst, { width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }]}>
      {Array.from({ length: BURST_DOTS }, (_, index) => (
        <BurstDot key={index} index={index} color={color} reach={size / 2} />
      ))}
    </View>
  );
}

function BurstDot({ index, color, reach }: { index: number; color: string; reach: number }) {
  const t = useSharedValue(0);
  const angle = (index / BURST_DOTS) * Math.PI * 2;
  const distance = reach * (index % 2 === 0 ? 0.95 : 0.7);
  const dot = index % 3 === 0 ? 7 : 5;

  useEffect(() => {
    t.value = withDelay((index % 3) * 30, withTiming(1, { duration: 720, easing: Easing.out(Easing.cubic) }));
  }, [index, t]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: t.value < 0.6 ? 1 : 1 - (t.value - 0.6) / 0.4,
    transform: [
      { translateX: Math.cos(angle) * distance * t.value },
      { translateY: Math.sin(angle) * distance * t.value },
      { scale: 1 - t.value * 0.4 },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.burstDot,
        { width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color, marginLeft: -dot / 2, marginTop: -dot / 2 },
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  ringCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  burst: {
    position: 'absolute',
    left: '50%',
    top: '50%',
  },
  burstDot: {
    position: 'absolute',
    left: '50%',
    top: '50%',
  },
});
