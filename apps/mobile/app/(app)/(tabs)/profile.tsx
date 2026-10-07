import { useAuth, useUser } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';

import { ThemeToggleButton } from '../../../components/ThemeToggleButton';
import { SurfaceCard } from '../../../components/ui/SectionHeader';
import { TabScreenSwipe } from '../../../components/TabScreenSwipe';
import { SoftLinkList, SoftPage, SoftRow } from '../../../components/ui/SoftScreen';
import { ThemedButton } from '../../../components/ui/ThemedButton';
import { ThemedText } from '../../../components/ThemedText';
import { clearCaptureQueue, listPendingCaptures } from '../../../lib/captureQueue';
import { pauseCaptureQueue } from '../../../lib/capture';
import { clearCache } from '../../../lib/persistentCache';
import {
  profileSyncCopy,
  subscribeCaptureSync,
} from '../../../lib/syncStatus';
import { useOnboarding } from '../../../providers/OnboardingProvider';
import { useAppTheme } from '../../../providers/ThemeProvider';
import { useProgression } from '../../../providers/ProgressionProvider';
import { useSubscription } from '../../../providers/SubscriptionProvider';
import { CountUp, PressScale } from '../../../components/ui/Motion';
import { readQueryCache } from '../../../hooks/useAsync';
import type { DashboardSummary } from '../../../lib/api';
import { levelTitle, nextMilestone } from '../../../lib/engagement';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Recall from 'kairos-recall';

function LevelBar({ progress, color, track }: { progress: number; color: string; track: string }) {
  const width = useSharedValue(0);
  useEffect(() => {
    width.value = withDelay(250, withTiming(Math.max(0.02, Math.min(1, progress)), { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [progress, width]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));
  return (
    <View style={[styles.levelTrack, { backgroundColor: track }]}>
      <Animated.View style={[styles.levelFill, { backgroundColor: color }, fillStyle]} />
    </View>
  );
}

export default function ProfileScreen() {
  const { user } = useUser();
  const { signOut, userId } = useAuth();
  const { resetOnboarding } = useOnboarding();
  const { colors, themeProgress, toggleTheme, radius } = useAppTheme();
  const subscription = useSubscription();
  const { progression } = useProgression();
  const router = useRouter();
  const [memoryCount, setMemoryCount] = useState(() => readQueryCache<DashboardSummary>('dashboard')?.totalCount ?? null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [syncCopy, setSyncCopy] = useState(() => profileSyncCopy(0));

  const refreshQueue = useCallback(() => {
    if (!userId) return;
    void listPendingCaptures(userId)
      .then((items) => setSyncCopy(profileSyncCopy(items.length)))
      .catch(() => setSyncCopy(profileSyncCopy(0)));
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      refreshQueue();
      setMemoryCount(readQueryCache<DashboardSummary>('dashboard')?.totalCount ?? null);
      return subscribeCaptureSync(refreshQueue);
    }, [refreshQueue]),
  );

  const level = progression?.level ?? 1;
  const streak = progression?.currentStreak ?? 0;
  const milestone = nextMilestone(streak);

  const name = user?.fullName || user?.firstName || 'Kairos User';
  const email = user?.primaryEmailAddress?.emailAddress;

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await Recall.stop().catch(() => undefined);
      await Recall.clearLocalData().catch(() => undefined);
      await Recall.setAuthToken(null).catch(() => undefined);
      if (userId) {
        await pauseCaptureQueue(userId);
        await clearCaptureQueue(userId);
      }
      await clearCache();
      await signOut();
      await resetOnboarding();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <TabScreenSwipe>
      <SoftPage tabBar safeTop>
        {/* Profile Card Header */}
        <SurfaceCard style={styles.profileHeaderCard}>
          <View style={styles.header}>
            {user?.imageUrl ? (
              <Image source={{ uri: user.imageUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: colors.primaryContainer, borderRadius: radius.full }]}>
                <ThemedText colorKey="primary" style={styles.avatarLetter}>
                  {name.slice(0, 1).toUpperCase()}
                </ThemedText>
              </View>
            )}
            <View style={styles.headerText}>
              <ThemedText colorKey="text" style={styles.name} numberOfLines={1}>
                {name}
              </ThemedText>
              {email ? (
                <ThemedText colorKey="textMuted" style={styles.email} numberOfLines={1}>
                  {email}
                </ThemedText>
              ) : null}
            </View>
            <ThemeToggleButton themeProgress={themeProgress} onToggle={toggleTheme} />
          </View>

          <PressScale
            onPress={() => router.push('/(app)/progress')}
            accessibilityLabel={`Level ${level}, ${levelTitle(level)}. ${streak} day streak. View progress`}
            style={[styles.statsStrip, { borderTopColor: colors.borderSubtle }]}
          >
            <View style={styles.statItem}>
              <View style={[styles.statIconBadge, { backgroundColor: colors.primaryContainer }]}>
                <Feather name="zap" size={14} color={colors.primary} />
              </View>
              <CountUp value={streak} style={[styles.statValue, { color: colors.text }]} />
              <ThemedText colorKey="textMuted" style={styles.statLabel}>Day streak</ThemedText>
            </View>

            <View style={[styles.statDivider, { backgroundColor: colors.borderSubtle }]} />

            <View style={styles.statItem}>
              <View style={[styles.statIconBadge, { backgroundColor: colors.primaryContainer }]}>
                <Feather name="award" size={14} color={colors.primary} />
              </View>
              <ThemedText colorKey="text" style={styles.statValue}>Level {level}</ThemedText>
              <ThemedText colorKey="textMuted" style={styles.statLabel}>{levelTitle(level)}</ThemedText>
            </View>

            <View style={[styles.statDivider, { backgroundColor: colors.borderSubtle }]} />

            <View style={styles.statItem}>
              <View style={[styles.statIconBadge, { backgroundColor: colors.surfaceContainer }]}>
                <Feather name="layers" size={14} color={colors.textSecondary} />
              </View>
              {memoryCount != null ? (
                <CountUp value={memoryCount} style={[styles.statValue, { color: colors.text }]} />
              ) : (
                <ThemedText colorKey="text" style={styles.statValue}>–</ThemedText>
              )}
              <ThemedText colorKey="textMuted" style={styles.statLabel}>Memories</ThemedText>
            </View>
          </PressScale>

          {progression ? (
            <View style={styles.levelBlock}>
              <LevelBar progress={progression.progress} color={colors.primary} track={colors.surfaceContainer} />
              <View style={styles.levelMeta}>
                <ThemedText colorKey="textMuted" style={styles.levelMetaText}>
                  {Math.round(progression.progress * 100)}% to level {level + 1}
                </ThemedText>
                <ThemedText colorKey="textMuted" style={styles.levelMetaText}>
                  {milestone - streak} {milestone - streak === 1 ? 'day' : 'days'} to {milestone}-day mark
                </ThemedText>
              </View>
            </View>
          ) : null}
        </SurfaceCard>

        {/* Subscription section */}
        <View style={styles.sectionWrap}>
          <ThemedText colorKey="textMuted" style={styles.sectionLabel}>
            Subscription
          </ThemedText>
          <SoftRow
            label="Kairos Pro"
            icon="star"
            meta={
              subscription.isLoading
                ? 'Loading'
                : Platform.OS !== 'android' || !Recall.isAvailable()
                  ? 'Screen memory is Android only'
                  : subscription.isPro
                    ? 'Active'
                    : 'Unlock Screen memory'
            }
            onPress={
              Platform.OS === 'android' && Recall.isAvailable() && !subscription.isPro
                ? () => router.push('/(app)/screen-memory')
                : undefined
            }
          />
          {subscription.isPro ? (
            <SoftRow
              label="Manage Subscription"
              icon="external-link"
              onPress={() => void subscription.manageSubscriptions()}
            />
          ) : null}
        </View>

        {/* Sync Status Card */}
        <SurfaceCard style={styles.syncCard}>
          <View style={styles.syncHeader}>
            <View style={[styles.syncIconWrap, { backgroundColor: colors.primaryContainer, borderRadius: radius.full }]}>
              <Feather name="cloud" size={18} color={colors.primary} />
            </View>
            <View style={styles.syncTextWrap}>
              <ThemedText colorKey="textMuted" style={styles.syncKicker}>
                Offline Captures
              </ThemedText>
              <ThemedText colorKey="text" style={styles.syncTitle}>
                {syncCopy.title}
              </ThemedText>
            </View>
          </View>
          <ThemedText colorKey="textSecondary" style={styles.syncDetail}>
            {syncCopy.detail}
          </ThemedText>
        </SurfaceCard>

        {/* Account & App Links */}
        <View style={styles.sectionWrap}>
          <ThemedText colorKey="textMuted" style={styles.sectionLabel}>
            Experience & Preferences
          </ThemedText>
          <SoftLinkList
            items={[
              { label: 'Progress & Streaks', icon: 'award', onPress: () => router.push('/(app)/progress') },
              { label: 'Insights & Patterns', icon: 'bar-chart-2', onPress: () => router.push('/(app)/insights') },
              ...(Platform.OS === 'android' && Recall.isAvailable()
                ? [
                    {
                      label: 'Screen memory',
                      icon: 'eye' as const,
                      onPress: () => router.push('/(app)/screen-memory'),
                    },
                  ]
                : []),
              { label: 'Connected Devices', icon: 'smartphone', onPress: () => router.push('/(app)/devices') },
              { label: 'Privacy & Data', icon: 'shield', onPress: () => router.push('/(app)/privacy') },
              { label: 'Settings', icon: 'settings', onPress: () => router.push('/(app)/settings') },
              {
                label: 'How it works',
                icon: 'book-open',
                onPress: () => router.push('/(app)/how-it-works'),
              },
              { label: 'About Kairos', icon: 'info', onPress: () => router.push('/(app)/about') },
            ]}
          />
        </View>

        {/* Sign Out Button */}
        <ThemedButton
          variant="secondary"
          size="lg"
          disabled={isSigningOut}
          label={isSigningOut ? 'Signing out…' : 'Sign Out'}
          onPress={() => void handleSignOut()}
          style={styles.signOut}
        />
      </SoftPage>
    </TabScreenSwipe>
  );
}

const styles = StyleSheet.create({
  profileHeaderCard: {
    padding: 16,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  avatarFallback: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 22,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 20,
    letterSpacing: -0.2,
  },
  email: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 13,
  },
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    paddingTop: 12,
  },
  statItem: {
    alignItems: 'center',
    gap: 2,
  },
  statIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statValue: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 16,
  },
  statLabel: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 11,
  },
  statDivider: {
    width: 1,
    height: 36,
    opacity: 0.6,
  },
  levelBlock: {
    gap: 8,
  },
  levelTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  levelFill: {
    height: '100%',
    borderRadius: 3,
  },
  levelMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  levelMetaText: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 12,
  },
  sectionWrap: {
    gap: 8,
  },
  sectionLabel: {
    fontFamily: 'Roboto_600SemiBold',
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
  },
  syncCard: {
    padding: 16,
    gap: 10,
  },
  syncHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  syncIconWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncTextWrap: {
    flex: 1,
  },
  syncKicker: {
    fontFamily: 'Roboto_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  syncTitle: {
    fontFamily: 'Roboto_600SemiBold',
    fontSize: 15,
  },
  syncDetail: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 13,
    lineHeight: 18,
  },
  signOut: {
    marginTop: 8,
  },
});
