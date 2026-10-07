import { useUser } from '@clerk/expo';
import { MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ComponentProps } from 'react';
import Animated from 'react-native-reanimated';
import Recall from 'kairos-recall';

import { SoftPage } from '../../components/ui/SoftScreen';
import { itemEntering, PressScale } from '../../components/ui/Motion';
import { useAppTheme } from '../../providers/ThemeProvider';
import { useProgression } from '../../providers/ProgressionProvider';
import { ThemedText } from '../../components/ThemedText';
import { levelTitle } from '../../lib/engagement';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

type SettingsItem = {
  label: string;
  icon: IconName;
  onPress: () => void;
  meta?: string;
};

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

function SettingsGroup({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  const { colors, radius } = useAppTheme();

  return (
    <View style={styles.group}>
      {title ? (
        <ThemedText colorKey="text" style={styles.groupTitle}>
          {title}
        </ThemedText>
      ) : null}
      <View
        style={[
          styles.groupCard,
          {
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.border,
            borderRadius: radius.xl,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function SettingsRow({
  item,
  last,
  index,
}: {
  item: SettingsItem;
  last: boolean;
  index: number;
}) {
  const { colors, radius } = useAppTheme();

  return (
    <Animated.View entering={itemEntering(index)}>
      <PressScale
        onPress={() => {
          void Haptics.selectionAsync();
          item.onPress();
        }}
        accessibilityLabel={item.label}
        style={[
          styles.row,
          !last && {
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View
          style={[
            styles.rowIcon,
            { backgroundColor: colors.surfaceContainer, borderRadius: radius.full },
          ]}
        >
          <MaterialIcons name={item.icon} size={20} color={colors.textSecondary} />
        </View>
        <Text style={[styles.rowLabel, { color: colors.text }]} numberOfLines={1}>
          {item.label}
        </Text>
        {item.meta ? (
          <Text style={[styles.rowMeta, { color: colors.textMuted }]} numberOfLines={1}>
            {item.meta}
          </Text>
        ) : null}
        <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} />
      </PressScale>
    </Animated.View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user } = useUser();
  const { colors, isLight, toggleTheme, radius } = useAppTheme();

  const name =
    user?.fullName ||
    user?.firstName ||
    user?.primaryEmailAddress?.emailAddress?.split('@')[0] ||
    'Account';
  const email = user?.primaryEmailAddress?.emailAddress;
  const { progression } = useProgression();
  const level = progression?.level ?? 1;
  const streak = progression?.currentStreak ?? 0;

  const setLight = () => {
    if (!isLight) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      toggleTheme();
    }
  };

  const setDark = () => {
    if (isLight) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      toggleTheme();
    }
  };

  const memory: SettingsItem[] = [
    ...(Platform.OS === 'android' && Recall.isAvailable()
      ? [
          {
            label: 'Screen memory',
            icon: 'visibility' as const,
            meta: 'On-device',
            onPress: () => router.push('/(app)/screen-memory'),
          },
        ]
      : []),
    {
      label: 'Progress & leaderboard privacy',
      icon: 'emoji-events',
      onPress: () => router.push('/(app)/progress'),
    },
    {
      label: 'Notifications',
      icon: 'notifications-none',
      onPress: () => router.push('/(app)/notifications'),
    },
    {
      label: 'Devices',
      icon: 'phone-iphone',
      onPress: () => router.push('/(app)/devices'),
    },
  ];

  const privacy: SettingsItem[] = [
    {
      label: 'Privacy',
      icon: 'shield',
      onPress: () => router.push('/(app)/privacy'),
    },
    {
      label: 'Data',
      icon: 'storage',
      meta: 'Export & delete',
      onPress: () => router.push('/(app)/data'),
    },
  ];

  const about: SettingsItem[] = [
    {
      label: 'How it works',
      icon: 'auto-stories',
      onPress: () => router.push('/(app)/how-it-works'),
    },
    {
      label: 'About Kairos',
      icon: 'info-outline',
      meta: APP_VERSION,
      onPress: () => router.push('/(app)/about'),
    },
  ];

  return (
    <SoftPage>
      {/* Account Card */}
      <PressScale
        onPress={() => router.push('/(app)/(tabs)/profile')}
        accessibilityLabel="Account details"
      >
        <View
          style={[
            styles.account,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
              borderRadius: radius.xl,
            },
          ]}
        >
          {user?.imageUrl ? (
            <Image source={{ uri: user.imageUrl }} style={styles.avatar} />
          ) : (
            <View
              style={[
                styles.avatarFallback,
                { backgroundColor: colors.primaryContainer, borderRadius: radius.full },
              ]}
            >
              <Text style={[styles.avatarLetter, { color: colors.primary }]}>
                {name.slice(0, 1).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.accountCopy}>
            <Text style={[styles.accountName, { color: colors.text }]} numberOfLines={1}>
              {name}
            </Text>
            {email ? (
              <Text style={[styles.accountEmail, { color: colors.textSecondary }]} numberOfLines={1}>
                {email}
              </Text>
            ) : (
              <Text style={[styles.accountEmail, { color: colors.textSecondary }]}>
                Manage your account
              </Text>
            )}
            <View style={styles.accountBadges}>
              <View style={[styles.accountBadge, { backgroundColor: colors.primaryContainer }]}>
                <Text style={[styles.accountBadgeText, { color: colors.primary }]}>
                  Level {level} · {levelTitle(level)}
                </Text>
              </View>
              {streak > 0 ? (
                <View style={[styles.accountBadge, { backgroundColor: colors.surfaceContainer }]}>
                  <MaterialIcons name="local-fire-department" size={12} color={colors.textSecondary} />
                  <Text style={[styles.accountBadgeText, { color: colors.textSecondary }]}>
                    {streak}-day streak
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={colors.textMuted} />
        </View>
      </PressScale>

      {/* Appearance Group */}
      <SettingsGroup title="Appearance">
        <View style={styles.appearance}>
          <Text style={[styles.appearanceLabel, { color: colors.text }]}>Theme</Text>
          <View
            style={[
              styles.segment,
              { backgroundColor: colors.surfaceContainer, borderRadius: radius.full },
            ]}
          >
            <Pressable
              onPress={setLight}
              accessibilityRole="button"
              accessibilityState={{ selected: isLight }}
              accessibilityLabel="Light theme"
              style={[
                styles.segmentItem,
                { borderRadius: radius.full },
                isLight && {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                  borderWidth: 1,
                },
              ]}
            >
              <MaterialIcons
                name="light-mode"
                size={16}
                color={isLight ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  styles.segmentText,
                  {
                    color: isLight ? colors.primary : colors.textMuted,
                    fontWeight: isLight ? '700' : '500',
                  },
                ]}
              >
                Light
              </Text>
            </Pressable>
            <Pressable
              onPress={setDark}
              accessibilityRole="button"
              accessibilityState={{ selected: !isLight }}
              accessibilityLabel="Dark theme"
              style={[
                styles.segmentItem,
                { borderRadius: radius.full },
                !isLight && {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                  borderWidth: 1,
                },
              ]}
            >
              <MaterialIcons
                name="dark-mode"
                size={16}
                color={!isLight ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  styles.segmentText,
                  {
                    color: !isLight ? colors.primary : colors.textMuted,
                    fontWeight: !isLight ? '700' : '500',
                  },
                ]}
              >
                Dark
              </Text>
            </Pressable>
          </View>
        </View>
      </SettingsGroup>

      {/* Memory Group */}
      <SettingsGroup title="Memory & Rhythm">
        {memory.map((item, index) => (
          <SettingsRow
            key={item.label}
            item={item}
            index={index}
            last={index === memory.length - 1}
          />
        ))}
      </SettingsGroup>

      {/* Privacy Group */}
      <SettingsGroup title="Privacy & Data">
        {privacy.map((item, index) => (
          <SettingsRow
            key={item.label}
            item={item}
            index={index}
            last={index === privacy.length - 1}
          />
        ))}
      </SettingsGroup>

      {/* About Group */}
      <SettingsGroup title="Kairos">
        {about.map((item, index) => (
          <SettingsRow
            key={item.label}
            item={item}
            index={index}
            last={index === about.length - 1}
          />
        ))}
      </SettingsGroup>

      <Text style={[styles.footer, { color: colors.textMuted }]}>
        Kairos {APP_VERSION} · Personal Intelligence
      </Text>
    </SoftPage>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 8,
  },
  groupTitle: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 16,
    letterSpacing: -0.2,
    paddingHorizontal: 4,
  },
  groupCard: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarFallback: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 22,
  },
  accountCopy: {
    flex: 1,
    gap: 3,
  },
  accountName: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 19,
    letterSpacing: -0.2,
  },
  accountEmail: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 14,
  },
  accountBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  accountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  accountBadgeText: {
    fontFamily: 'Roboto_600SemiBold',
    fontSize: 11,
  },
  appearance: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 58,
  },
  appearanceLabel: {
    fontFamily: 'Roboto_600SemiBold',
    fontSize: 16,
  },
  segment: {
    flexDirection: 'row',
    padding: 3,
    gap: 3,
  },
  segmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  segmentText: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 58,
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    fontSize: 14,
    maxWidth: 140,
  },
  footer: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 13,
    textAlign: 'center',
    paddingTop: 12,
    paddingBottom: 24,
  },
});
