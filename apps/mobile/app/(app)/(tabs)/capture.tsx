import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '../../../components/ThemedText';
import { useAppTheme } from '../../../providers/ThemeProvider';
import { useSubscription } from '../../../providers/SubscriptionProvider';
import Recall from 'kairos-recall';
import Animated from 'react-native-reanimated';
import { PressScale, itemEntering } from '../../../components/ui/Motion';
import { dailyReflection } from '../../../lib/engagement';
import { tabHref } from '../../../lib/lastRoute';

const OPTIONS = [
  {
    label: 'Text Note',
    icon: 'edit-note' as const,
    href: '/(app)/quick-capture?mode=note',
    description: 'Jot down a quick thought or observation',
    tint: 'blue' as const,
  },
  {
    label: 'Voice Memo',
    icon: 'mic-none' as const,
    href: '/(app)/voice-capture',
    description: 'Speak freely and let Kairos transcribe',
    tint: 'teal' as const,
  },
  {
    label: 'Photo or File',
    icon: 'attach-file' as const,
    href: '/(app)/capture-file',
    description: 'Upload images, PDFs, or documents',
    tint: 'blue' as const,
  },
  {
    label: 'Web Link',
    icon: 'link' as const,
    href: '/(app)/quick-capture?mode=link',
    description: 'Save articles, videos, or URLs',
    tint: 'amber' as const,
  },
];

export default function CaptureTab() {
  const router = useRouter();
  const { colors, radius } = useAppTheme();
  const insets = useSafeAreaInsets();
  const subscription = useSubscription();

  const close = () => router.navigate(tabHref() as '/(app)/(tabs)');
  const reflection = dailyReflection();

  return (
    <Modal transparent animationType="slide" visible onRequestClose={close}>
      <Pressable
        style={[styles.backdrop, { backgroundColor: colors.scrim }]}
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel="Close capture options"
      >
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surfaceElevated,
              paddingBottom: Math.max(insets.bottom, 16) + 16,
            },
          ]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <View style={styles.sheetHeader}>
            <View
              style={[
                styles.badge,
                { backgroundColor: colors.primaryContainer, borderRadius: 999 },
              ]}
            >
              <MaterialIcons name="add" size={14} color={colors.primary} />
              <Text style={[styles.badgeText, { color: colors.primary }]}>
                NEW CAPTURE
              </Text>
            </View>
            <ThemedText colorKey="text" style={styles.title}>
              What do you want Kairos to remember?
            </ThemedText>
            <ThemedText colorKey="textSecondary" style={styles.subtitle}>
              Choose a format and Kairos will extract meaning automatically.
            </ThemedText>
          </View>

          <Animated.View entering={itemEntering(0)}>
            <PressScale
              onPress={() => router.push({ pathname: '/(app)/quick-capture', params: { prompt: reflection.prompt } })}
              accessibilityLabel={`Answer today's reflection: ${reflection.prompt}`}
            >
              <View
                style={[
                  styles.reflectionRow,
                  { backgroundColor: colors.primaryContainer, borderColor: colors.borderAccent, borderRadius: radius.lg },
                ]}
              >
                <MaterialIcons name="wb-twilight" size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.reflectionKicker, { color: colors.primary }]}>TODAY’S REFLECTION</Text>
                  <ThemedText colorKey="text" style={styles.reflectionText} numberOfLines={2}>
                    {reflection.prompt}
                  </ThemedText>
                </View>
                <MaterialIcons name="arrow-forward" size={18} color={colors.primary} />
              </View>
            </PressScale>
          </Animated.View>

          <View style={styles.optionsGrid}>
            {OPTIONS.map((option, index) => {
              const tintColor =
                option.tint === 'teal'
                  ? colors.accentTeal
                  : option.tint === 'amber'
                    ? colors.accentYellow
                    : colors.accentMorningBlue;
              const tintWash =
                option.tint === 'teal'
                  ? colors.tintTeal
                  : option.tint === 'amber'
                    ? colors.tintYellow
                    : colors.tertiaryContainer;
              return (
              <Animated.View key={option.label} entering={itemEntering(index + 1)}>
              <PressScale
                onPress={() => router.push(option.href as never)}
                accessibilityLabel={option.label}
              >
                <View
                  style={[
                    styles.optionCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderRadius: radius.lg,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.iconWrap,
                      {
                        backgroundColor: tintWash,
                        borderRadius: radius.md,
                      },
                    ]}
                  >
                    <MaterialIcons name={option.icon} size={24} color={tintColor} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <ThemedText colorKey="text" style={styles.optionTitle}>
                      {option.label}
                    </ThemedText>
                    <ThemedText colorKey="textSecondary" style={styles.optionDesc}>
                      {option.description}
                    </ThemedText>
                  </View>
                  <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} />
                </View>
              </PressScale>
              </Animated.View>
              );
            })}

            {Platform.OS === 'android' && Recall.isAvailable() && subscription.isPro ? (
              <PressScale
                onPress={() => router.push('/(app)/screen-memory')}
                accessibilityLabel="Open Screen memory"
              >
                <View
                  style={[
                    styles.optionCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderRadius: radius.xl,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.iconWrap,
                      {
                        backgroundColor: colors.primaryContainer,
                        borderRadius: radius.full,
                      },
                    ]}
                  >
                    <MaterialIcons name="visibility" size={24} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <ThemedText colorKey="text" style={styles.optionTitle}>
                      Screen Memory
                    </ThemedText>
                    <ThemedText colorKey="textSecondary" style={styles.optionDesc}>
                      Passive on-device screen recall
                    </ThemedText>
                  </View>
                  <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} />
                </View>
              </PressScale>
            ) : null}
          </View>

          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Cancel capture"
            style={styles.cancelBtn}
          >
            <ThemedText colorKey="textSecondary" style={styles.cancel}>
              Cancel
            </ThemedText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 14,
  },
  handle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 6,
  },
  sheetHeader: {
    gap: 4,
    marginBottom: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginBottom: 2,
  },
  badgeText: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 10,
    letterSpacing: 0.8,
  },
  title: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  optionsGrid: {
    gap: 10,
  },
  reflectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
  },
  reflectionKicker: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 10,
    letterSpacing: 0.8,
  },
  reflectionText: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 15,
    lineHeight: 20,
    marginTop: 2,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderWidth: 1,
    gap: 14,
  },
  iconWrap: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: {
    fontFamily: 'Roboto_600SemiBold',
    fontSize: 16,
  },
  optionDesc: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 13,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancel: {
    fontFamily: 'Roboto_600SemiBold',
    fontSize: 15,
  },
});
