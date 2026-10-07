import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeOutUp, ReduceMotion, SlideInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { levelTitle } from '../../lib/engagement';
import { useAppTheme } from '../../providers/ThemeProvider';
import { useProgression } from '../../providers/ProgressionProvider';
import { CountUp, DotBurst } from './Motion';

/** App-wide reward moment. Mounted once in the signed-in layout. */
export function RewardToast() {
  const { lastReward, clearReward } = useProgression();
  const { colors, radius } = useAppTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!lastReward) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [lastReward]);

  if (!lastReward) return null;

  const { xp, keeps, bonus, levelUp } = lastReward;
  const title = levelUp
    ? `Level ${levelUp} · ${levelTitle(levelUp)}`
    : bonus
      ? 'Momentum bonus'
      : 'Memory kept';

  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 8 }]}>
      <Animated.View
        key={lastReward.id}
        entering={SlideInUp.springify().damping(16).stiffness(200).reduceMotion(ReduceMotion.System)}
        exiting={FadeOutUp.duration(200).reduceMotion(ReduceMotion.System)}
      >
        <Pressable
          onPress={clearReward}
          accessibilityRole="alert"
          accessibilityLabel={`${title}${xp ? `, plus ${xp} XP` : ''}${keeps ? `, plus ${keeps} keeps` : ''}`}
          style={[
            styles.toast,
            {
              backgroundColor: levelUp ? colors.primary : colors.surfaceElevated,
              borderColor: levelUp ? colors.primary : colors.borderAccent,
              borderRadius: radius.full,
            },
          ]}
        >
          <View style={styles.iconWrap}>
            <DotBurst color={levelUp ? colors.onPrimary : colors.primary} size={levelUp ? 140 : 96} />
            <MaterialIcons
              name={levelUp ? 'military-tech' : bonus ? 'bolt' : 'auto-awesome'}
              size={20}
              color={levelUp ? colors.onPrimary : colors.primary}
            />
          </View>
          <Text style={[styles.title, { color: levelUp ? colors.onPrimary : colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          {xp ? (
            <View style={[styles.chip, { backgroundColor: levelUp ? 'rgba(255,255,255,0.18)' : colors.primaryContainer }]}>
              <Text style={[styles.chipText, { color: levelUp ? colors.onPrimary : colors.primary }]}>+</Text>
              <CountUp value={xp} duration={600} style={[styles.chipText, { color: levelUp ? colors.onPrimary : colors.primary }]} />
              <Text style={[styles.chipText, { color: levelUp ? colors.onPrimary : colors.primary }]}> XP</Text>
            </View>
          ) : null}
          {keeps ? (
            <Text style={[styles.keeps, { color: levelUp ? colors.onPrimary : colors.textSecondary }]}>+{keeps} keeps</Text>
          ) : null}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 12,
    paddingRight: 14,
    paddingVertical: 10,
    borderWidth: 1,
    maxWidth: 360,
  },
  iconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Roboto_600SemiBold',
    fontSize: 15,
    flexShrink: 1,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipText: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 13,
  },
  keeps: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 13,
  },
});
