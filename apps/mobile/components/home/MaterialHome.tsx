import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme } from '../../providers/ThemeProvider';
import type { ApiObservation } from '../../lib/api';
import { itemEntering, popEntering, PressScale } from '../ui/Motion';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

export function HomeSearchBar({ onPress }: { onPress: () => void }) {
  const { colors } = useAppTheme();

  return (
    <Animated.View entering={itemEntering(0)}>
      <PressScale
        onPress={onPress}
        accessibilityRole="search"
        accessibilityLabel="Search your memories"
        style={[
          styles.search,
          {
            backgroundColor: colors.inputFill,
          },
        ]}
      >
        <MaterialIcons name="search" size={22} color={colors.textSecondary} />
        <Text style={[styles.searchText, { color: colors.inputPlaceholder }]}>
          Search your memories
        </Text>
      </PressScale>
    </Animated.View>
  );
}

export function AssistChip({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();

  return (
    <PressScale
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      accessibilityLabel={label}
      style={[
        styles.chip,
        {
          backgroundColor: colors.secondaryContainer,
        },
      ]}
    >
      <MaterialIcons name={icon} size={18} color={colors.primary} />
      <Text style={[styles.chipLabel, { color: colors.text }]}>{label}</Text>
    </PressScale>
  );
}

export function TodayCard({
  count,
  caption,
  onPress,
}: {
  count: number;
  caption: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const pop = useSharedValue(1);

  useEffect(() => {
    pop.value = 1.06;
    pop.value = withTiming(1, { duration: 220 });
  }, [count, pop]);

  const valueStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
  }));

  return (
    <Animated.View entering={itemEntering(1)}>
      <PressScale
        onPress={onPress}
        accessibilityLabel="Today"
        style={[styles.today, { backgroundColor: colors.surfaceElevated }]}
      >
        <View style={styles.todayCopy}>
          <Text style={[styles.todayKicker, { color: colors.textSecondary }]}>Today</Text>
          <Animated.Text style={[styles.todayValue, { color: colors.text }, valueStyle]}>
            {count}
          </Animated.Text>
          <Text style={[styles.todayCaption, { color: colors.textSecondary }]}>{caption}</Text>
        </View>
        <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} />
      </PressScale>
    </Animated.View>
  );
}

export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button" accessibilityLabel={action}>
          <Text style={[styles.sectionAction, { color: colors.primary }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function memoryMeta(type: ApiObservation['type'], colors: ReturnType<typeof useAppTheme>['colors']) {
  switch (type) {
    case 'IMAGE':
      return { icon: 'image' as const, color: colors.primary, tint: colors.tintFrost };
    case 'AUDIO':
      return { icon: 'mic' as const, color: colors.accentRose, tint: colors.tintCoral };
    case 'TEXT':
      return { icon: 'notes' as const, color: colors.accentGreen, tint: colors.tintGreen };
    default:
      return { icon: 'insert-drive-file' as const, color: colors.accentOrange, tint: colors.tintOrange };
  }
}

export function MemoryTile({
  observation,
  photo,
  width,
  onPress,
  index = 0,
}: {
  observation: ApiObservation;
  photo?: ImageSourcePropType;
  width: number;
  onPress: () => void;
  index?: number;
}) {
  const { colors } = useAppTheme();
  const meta = memoryMeta(observation.type, colors);
  const date = new Date(observation.processedAt || observation.updatedAt).toLocaleDateString();

  return (
    <Animated.View entering={itemEntering(index + 2)}>
      <PressScale
        onPress={onPress}
        accessibilityLabel={observation.filename}
        style={[styles.tile, { width, backgroundColor: colors.surfaceElevated }]}
      >
        {photo ? (
          <Image source={photo} style={styles.tilePhoto} />
        ) : (
          <View style={[styles.tileFallback, { backgroundColor: meta.tint }]}>
            <MaterialIcons name={meta.icon} size={28} color={meta.color} />
          </View>
        )}
        <View style={styles.tileCopy}>
          <Text style={[styles.tileTitle, { color: colors.text }]} numberOfLines={1}>
            {observation.filename}
          </Text>
          <Text style={[styles.tileMeta, { color: colors.textMuted }]} numberOfLines={1}>
            {date}
          </Text>
        </View>
      </PressScale>
    </Animated.View>
  );
}

export function ShortcutRow({
  icon,
  label,
  meta,
  onPress,
}: {
  icon: IconName;
  label: string;
  meta?: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();

  return (
    <PressScale onPress={onPress} accessibilityLabel={label} style={styles.shortcut}>
      <View style={[styles.shortcutIcon, { backgroundColor: colors.secondaryContainer }]}>
        <MaterialIcons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.shortcutCopy}>
        <Text style={[styles.shortcutLabel, { color: colors.text }]}>{label}</Text>
        {meta ? (
          <Text style={[styles.shortcutMeta, { color: colors.textMuted }]} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} />
    </PressScale>
  );
}

export function TopicChip({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useAppTheme();

  return (
    <PressScale
      onPress={onPress}
      accessibilityLabel={label}
      style={[styles.topic, { backgroundColor: colors.surfaceContainerLow }]}
    >
      <Text style={[styles.topicLabel, { color: colors.text }]} numberOfLines={1}>
        {label}
      </Text>
    </PressScale>
  );
}

export function HomeFab({ onPress, bottom }: { onPress: () => void; bottom: number }) {
  const { colors } = useAppTheme();

  return (
    <Animated.View entering={popEntering()} style={[styles.fab, { bottom }]} pointerEvents="box-none">
      <PressScale
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onPress();
        }}
        accessibilityLabel="Capture"
        style={[
          styles.fabInner,
          {
            backgroundColor: colors.primary,
            ...colors.shadowElevated,
          },
        ]}
      >
        <MaterialIcons name="add" size={28} color={colors.onPrimary} />
      </PressScale>
    </Animated.View>
  );
}

export function SyncBanner({ text }: { text: string }) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.banner, { backgroundColor: colors.secondaryContainer }]}>
      <MaterialIcons name="cloud-queue" size={18} color={colors.primary} />
      <Text style={[styles.bannerText, { color: colors.onSecondaryContainer }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    height: 36,
    borderRadius: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchText: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 17,
    letterSpacing: -0.41,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  chipLabel: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 15,
    letterSpacing: -0.24,
  },
  today: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  todayCopy: {
    flex: 1,
    gap: 2,
  },
  todayKicker: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 12,
    letterSpacing: 0.4,
  },
  todayValue: {
    fontFamily: 'Roboto_600SemiBold',
    fontSize: 34,
    lineHeight: 41,
    letterSpacing: 0.4,
  },
  todayCaption: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 14,
    marginTop: 2,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 4,
  },
  sectionTitle: {
    fontFamily: 'Roboto_600SemiBold',
    fontSize: 20,
    letterSpacing: 0.38,
  },
  sectionAction: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 17,
    letterSpacing: -0.41,
  },
  tile: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  tilePhoto: {
    width: '100%',
    height: 112,
  },
  tileFallback: {
    width: '100%',
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileCopy: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  tileTitle: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 13,
  },
  tileMeta: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 12,
  },
  shortcut: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: 56,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  shortcutIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutCopy: {
    flex: 1,
    gap: 1,
  },
  shortcutLabel: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 16,
  },
  shortcutMeta: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 13,
  },
  topic: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  topicLabel: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 13,
    maxWidth: 160,
  },
  fab: {
    position: 'absolute',
    right: 16,
  },
  fabInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bannerText: {
    flex: 1,
    fontFamily: 'Roboto_400Regular',
    fontSize: 13,
  },
});
