import { useEffect } from 'react';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { useAppTheme } from '../providers/ThemeProvider';

export type OnboardingArtId = 'patterns' | 'memory' | 'ask' | 'insights' | 'model';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

type Palette = {
  card: string;
  raised: string;
  mute: string;
  ink: string;
  red: string;
  onRed: string;
  wash: string;
};

function reveal(play: number, delay: number) {
  'worklet';
  const t = Math.min(1, Math.max(0, (play - delay) / 0.55));
  return 1 - (1 - t) * (1 - t) * (1 - t);
}

function GrowBar({
  play,
  idle,
  index,
  x,
  height,
  base,
  width,
  radius,
  fill,
  accent,
}: {
  play: SharedValue<number>;
  idle: SharedValue<number>;
  index: number;
  x: number;
  height: number;
  base: number;
  width: number;
  radius: number;
  fill: string;
  accent?: boolean;
}) {
  const groupProps = useAnimatedProps(() => {
    const t = reveal(play.value, index * 0.07);
    const wobble = 1 + Math.sin(idle.value * Math.PI * 2 + index * 0.65) * (accent ? 0.1 : 0.06);
    return {
      scaleY: Math.max(0.08, t * wobble),
    };
  });
  const fillProps = useAnimatedProps(() => {
    const t = reveal(play.value, index * 0.07);
    return { opacity: 0.25 + 0.75 * t };
  });

  return (
    <AnimatedG originX={x + width / 2} originY={base} animatedProps={groupProps}>
      <AnimatedRect
        animatedProps={fillProps}
        x={x}
        y={base - height}
        width={width}
        height={height}
        rx={radius}
        fill={fill}
      />
    </AnimatedG>
  );
}

function Patterns({
  palette,
  play,
  idle,
}: {
  palette: Palette;
  play: SharedValue<number>;
  idle: SharedValue<number>;
}) {
  const bars = [
    { x: 46, h: 52 },
    { x: 98, h: 84 },
    { x: 150, h: 64 },
    { x: 202, h: 118 },
    { x: 254, h: 78 },
  ];
  const base = 198;
  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: 36 - reveal(play.value, 0.18) * 20 - idle.value * 64,
    opacity: reveal(play.value, 0.12),
  }));
  const cardProps = useAnimatedProps(() => ({
    scale: 0.94 + 0.06 * reveal(play.value, 0),
  }));

  return (
    <>
      <AnimatedG originX={160} originY={130} animatedProps={cardProps}>
        <Rect x="24" y="28" width="272" height="204" rx="28" fill={palette.card} />
      </AnimatedG>
      <AnimatedPath
        d="M62 150 C90 150 90 118 114 118 C138 118 138 138 166 138 C194 138 194 84 218 84 C242 84 242 124 270 124"
        stroke={palette.red}
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        strokeDasharray="7 11"
        animatedProps={lineProps}
      />
      {bars.map((bar, index) => (
        <GrowBar
          key={bar.x}
          play={play}
          idle={idle}
          index={index}
          x={bar.x}
          height={bar.h}
          base={base}
          width={28}
          radius={10}
          fill={index === 3 ? palette.red : palette.raised}
          accent={index === 3}
        />
      ))}
    </>
  );
}

function Memory({
  palette,
  play,
  idle,
}: {
  palette: Palette;
  play: SharedValue<number>;
  idle: SharedValue<number>;
}) {
  const bars = [28, 48, 36, 62, 42];
  const backProps = useAnimatedProps(() => {
    const t = reveal(play.value, 0);
    const sway = Math.sin(idle.value * Math.PI * 2) * 2.6;
    return { rotation: -18 * t + sway, translateY: (1 - t) * 18 + sway };
  });
  const sideProps = useAnimatedProps(() => {
    const t = reveal(play.value, 0.12);
    const float = Math.sin(idle.value * Math.PI * 2 + 0.8) * 7;
    return { rotation: 14 * t, translateY: (1 - t) * 20 + float, translateX: (1 - t) * 16 + float * 0.35 };
  });
  const frontProps = useAnimatedProps(() => {
    const t = reveal(play.value, 0.22);
    const bob = Math.sin(idle.value * Math.PI * 2 + 0.4) * 5;
    return {
      scale: 0.86 + 0.14 * t,
      translateY: (1 - t) * 28 + bob,
      rotation: Math.sin(idle.value * Math.PI * 2) * 2,
    };
  });

  return (
    <>
      <AnimatedG originX={108} originY={150} animatedProps={backProps}>
        <Rect x="28" y="72" width="136" height="156" rx="22" fill={palette.raised} />
        <Path d="M128 72 H142 a22 22 0 0 1 22 22 V108 L128 72 Z" fill={palette.mute} />
      </AnimatedG>
      <AnimatedG originX={214} originY={156} animatedProps={sideProps}>
        <Rect x="156" y="78" width="136" height="156" rx="22" fill={palette.card} />
        {bars.map((height, index) => (
          <GrowBar
            key={index}
            play={play}
            idle={idle}
            index={index + 2}
            x={178 + index * 18}
            height={height}
            base={168}
            width={8}
            radius={4}
            fill={index === 3 ? palette.red : palette.mute}
            accent={index === 3}
          />
        ))}
      </AnimatedG>
      <AnimatedG originX={154} originY={128} animatedProps={frontProps}>
        <Rect x="78" y="40" width="152" height="176" rx="22" fill={palette.card} />
        <Rect x="100" y="68" width="48" height="8" rx="4" fill={palette.red} />
        <Rect x="100" y="100" width="108" height="8" rx="4" fill={palette.ink} opacity={0.88} />
        <Rect x="100" y="120" width="84" height="8" rx="4" fill={palette.mute} />
        <Rect x="100" y="140" width="96" height="8" rx="4" fill={palette.mute} />
        <Rect x="100" y="160" width="64" height="8" rx="4" fill={palette.mute} />
      </AnimatedG>
    </>
  );
}

function Ask({
  palette,
  play,
  idle,
}: {
  palette: Palette;
  play: SharedValue<number>;
  idle: SharedValue<number>;
}) {
  const questionProps = useAnimatedProps(() => {
    const t = reveal(play.value, 0);
    return {
      translateX: (1 - t) * -36,
      translateY: Math.sin(idle.value * Math.PI * 2) * -6,
    };
  });
  const answerProps = useAnimatedProps(() => {
    const t = reveal(play.value, 0.18);
    return {
      translateX: (1 - t) * 40,
      translateY: Math.sin(idle.value * Math.PI * 2) * 6,
    };
  });

  return (
    <>
      <AnimatedG animatedProps={questionProps}>
        <Rect x="24" y="36" width="176" height="92" rx="26" fill={palette.raised} />
        <Path d="M52 128 L78 128 L58 150 Z" fill={palette.raised} />
        <Rect x="48" y="64" width="112" height="8" rx="4" fill={palette.mute} />
        <Rect x="48" y="84" width="78" height="8" rx="4" fill={palette.mute} />
      </AnimatedG>
      <AnimatedG animatedProps={answerProps}>
        <Rect x="112" y="128" width="184" height="96" rx="26" fill={palette.red} />
        <Path d="M252 224 L228 224 L258 246 Z" fill={palette.red} />
        <Rect x="136" y="156" width="128" height="8" rx="4" fill={palette.onRed} />
        <Rect x="136" y="176" width="72" height="8" rx="4" fill={palette.onRed} opacity={0.72} />
        <TypingDots play={play} idle={idle} color={palette.onRed} />
      </AnimatedG>
    </>
  );
}

function TypingDots({
  play,
  idle,
  color,
}: {
  play: SharedValue<number>;
  idle: SharedValue<number>;
  color: string;
}) {
  return (
    <>
      {[0, 1, 2].map((index) => (
        <TypingDot key={index} play={play} idle={idle} index={index} color={color} />
      ))}
    </>
  );
}

function TypingDot({
  play,
  idle,
  index,
  color,
}: {
  play: SharedValue<number>;
  idle: SharedValue<number>;
  index: number;
  color: string;
}) {
  const animatedProps = useAnimatedProps(() => {
    const t = reveal(play.value, 0.42 + index * 0.08);
    const phase = Math.sin(idle.value * Math.PI * 2 - index * 0.9);
    const lift = phase > 0 ? phase : 0;
    return {
      opacity: t * (0.35 + lift * 0.65),
      cy: 200 - lift * 7 - (1 - t) * 10,
    };
  });

  return <AnimatedCircle animatedProps={animatedProps} cx={148 + index * 16} r={4.5} fill={color} />;
}

function Insights({
  palette,
  play,
  idle,
}: {
  palette: Palette;
  play: SharedValue<number>;
  idle: SharedValue<number>;
}) {
  const bars = [46, 72, 58, 96, 64, 128, 88];
  const base = 200;
  const cardProps = useAnimatedProps(() => ({
    scale: 0.96 + 0.04 * reveal(play.value, 0),
  }));

  return (
    <>
      <AnimatedG originX={160} originY={130} animatedProps={cardProps}>
        <Rect x="20" y="24" width="280" height="212" rx="28" fill={palette.card} />
        <Rect x="40" y="44" width="36" height="10" rx="5" fill={palette.red} />
        <Rect x="84" y="44" width="22" height="10" rx="5" fill={palette.mute} />
        <Path d="M44 200 H276" stroke={palette.mute} strokeWidth={1.5} strokeLinecap="round" />
      </AnimatedG>
      {bars.map((height, index) => (
        <GrowBar
          key={index}
          play={play}
          idle={idle}
          index={index}
          x={48 + index * 34}
          height={height}
          base={base}
          width={22}
          radius={8}
          fill={index === 5 ? palette.red : palette.raised}
          accent={index === 5}
        />
      ))}
      <Sweep play={play} idle={idle} color={palette.red} />
    </>
  );
}

function Sweep({
  play,
  idle,
  color,
}: {
  play: SharedValue<number>;
  idle: SharedValue<number>;
  color: string;
}) {
  const animatedProps = useAnimatedProps(() => {
    const t = reveal(play.value, 0.32);
    return {
      x: 46 + idle.value * 196,
      opacity: t * (0.18 + 0.45 * Math.sin(idle.value * Math.PI)),
    };
  });

  return <AnimatedRect animatedProps={animatedProps} y={58} width={4} height={132} rx={2} fill={color} />;
}

function Model({
  palette,
  play,
  idle,
}: {
  palette: Palette;
  play: SharedValue<number>;
  idle: SharedValue<number>;
}) {
  const washProps = useAnimatedProps(() => ({
    scale: 0.82 + 0.18 * reveal(play.value, 0),
  }));
  const spokeProps = useAnimatedProps(() => ({
    opacity: Math.max(0.02, reveal(play.value, 0.16)),
  }));
  const centerProps = useAnimatedProps(() => {
    const t = reveal(play.value, 0.34);
    const pulse = 1 + Math.sin(idle.value * Math.PI * 2) * 0.07;
    return { scale: (0.7 + 0.3 * t) * pulse };
  });

  return (
    <>
      <AnimatedG originX={160} originY={136} animatedProps={washProps}>
        <Circle cx="160" cy="136" r="108" fill={palette.wash} />
        <Circle cx="160" cy="136" r="78" fill={palette.card} />
      </AnimatedG>
      <AnimatedPath
        d="M160 136 L160 52 M160 136 L62 168 M160 136 L250 112"
        stroke={palette.mute}
        strokeWidth={8}
        strokeLinecap="round"
        animatedProps={spokeProps}
      />
      <Satellite play={play} idle={idle} index={0} x={132} y={28} width={56} height={40} fill={palette.raised} />
      <Satellite play={play} idle={idle} index={1} x={28} y={150} width={68} height={40} fill={palette.raised} />
      <Satellite play={play} idle={idle} index={2} x={216} y={92} width={68} height={40} fill={palette.raised} />
      <AnimatedG originX={160} originY={136} animatedProps={centerProps}>
        <Rect x="136" y="112" width="48" height="48" rx="14" fill={palette.red} />
      </AnimatedG>
    </>
  );
}

function Satellite({
  play,
  idle,
  index,
  x,
  y,
  width,
  height,
  fill,
}: {
  play: SharedValue<number>;
  idle: SharedValue<number>;
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
}) {
  const animatedProps = useAnimatedProps(() => {
    const t = reveal(play.value, 0.2 + index * 0.08);
    const angle = idle.value * Math.PI * 2 + index * 2.1;
    return {
      scale: 0.72 + 0.28 * t,
      translateX: Math.cos(angle) * 8,
      translateY: (1 - t) * 18 + Math.sin(angle) * 8,
    };
  });

  return (
    <AnimatedG originX={x + width / 2} originY={y + height / 2} animatedProps={animatedProps}>
      <Rect x={x} y={y} width={width} height={height} rx={12} fill={fill} />
    </AnimatedG>
  );
}

/** Filled vector scenes. Each one draws in as its page centers, then keeps a quiet idle motion. */
export function OnboardingArt({
  id,
  active,
  index,
  width,
  translateX,
}: {
  id: OnboardingArtId;
  active: boolean;
  index: number;
  width: number;
  translateX: SharedValue<number>;
}) {
  const { colors } = useAppTheme();
  const reducedMotion = useReducedMotion();
  const intro = useSharedValue(reducedMotion ? 1 : 0);
  const reduced = useSharedValue(reducedMotion ? 1 : 0);
  const idle = useSharedValue(0);
  const palette: Palette = {
    card: colors.surface,
    raised: colors.surfaceContainerHigh,
    mute: colors.border,
    ink: colors.text,
    red: colors.primary,
    onRed: colors.onPrimary,
    wash: colors.primarySoft,
  };

  const play = useDerivedValue(() => {
    if (reduced.value === 1) return 1;
    const shift = (translateX.value + index * width) / Math.max(width, 1);
    const centered = Math.max(0, Math.min(1, 1 - Math.abs(shift)));
    const eased = centered * centered * (3 - 2 * centered);
    const drawn = 0.35 + 0.65 * eased;
    return index === 0 ? drawn * intro.value : drawn;
  }, [index, width]);

  useEffect(() => {
    reduced.value = reducedMotion ? 1 : 0;
    if (reducedMotion) {
      intro.value = 1;
      cancelAnimation(idle);
      idle.value = 0;
      return;
    }

    intro.value = withTiming(1, { duration: 980, easing: Easing.out(Easing.cubic) });
    if (!active) {
      cancelAnimation(idle);
      idle.value = 0;
      return;
    }

    idle.value = withRepeat(
      withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );

    return () => {
      cancelAnimation(idle);
    };
  }, [active, idle, intro, reduced, reducedMotion]);

  return (
    <Svg width={300} height={244} viewBox="0 0 320 260" accessibilityElementsHidden>
      {id === 'patterns' ? <Patterns palette={palette} play={play} idle={idle} /> : null}
      {id === 'memory' ? <Memory palette={palette} play={play} idle={idle} /> : null}
      {id === 'ask' ? <Ask palette={palette} play={play} idle={idle} /> : null}
      {id === 'insights' ? <Insights palette={palette} play={play} idle={idle} /> : null}
      {id === 'model' ? <Model palette={palette} play={play} idle={idle} /> : null}
    </Svg>
  );
}
