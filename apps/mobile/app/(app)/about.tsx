import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '../../components/ThemedText';
import { Breathe } from '../../components/ui/Motion';
import { SurfaceCard } from '../../components/ui/SectionHeader';
import { SoftPage } from '../../components/ui/SoftScreen';
import { ThemedButton } from '../../components/ui/ThemedButton';
import { useAppTheme } from '../../providers/ThemeProvider';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

export default function AboutScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();

  return (
    <SoftPage>
      <SurfaceCard style={styles.heroCard}>
        <Breathe amount={0.05} period={3600}>
          <View style={[styles.orb, { backgroundColor: colors.primaryContainer }]}>
            <ThemedText colorKey="primary" style={styles.orbGlyph}>K</ThemedText>
          </View>
        </Breathe>
        <ThemedText colorKey="text" style={styles.brand}>Kairos</ThemedText>
        <ThemedText colorKey="textMuted" style={styles.meta}>Personal memory intelligence</ThemedText>
        <ThemedText colorKey="textSecondary" style={styles.body}>
          Capture a thought. Kairos keeps it, finds it later, and answers from
          what you actually saved — building a living record of everything you've
          learned and done.
        </ThemedText>
        <View style={[styles.versionBadge, { backgroundColor: colors.surfaceContainer }]}>
          <ThemedText colorKey="textSecondary" style={styles.versionText}>v{APP_VERSION}</ThemedText>
        </View>
      </SurfaceCard>

      <ThemedButton
        label="How it works"
        variant="primary"
        size="lg"
        onPress={() => router.push('/(app)/how-it-works')}
      />
    </SoftPage>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    padding: 28,
    alignItems: 'center',
    gap: 10,
  },
  orb: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  orbGlyph: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 32,
  },
  brand: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 26,
    letterSpacing: -0.3,
  },
  meta: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 14,
  },
  body: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 4,
  },
  versionBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 4,
  },
  versionText: {
    fontFamily: 'Roboto_600SemiBold',
    fontSize: 12,
  },
});
