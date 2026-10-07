import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressScale } from '../../../components/ui/Motion';
import { useReducedMotion } from '../../../hooks/useReducedMotion';

import { ThemedText } from '../../../components/ThemedText';
import { FadeInContent } from '../../../components/ui/EmptyState';
import { FeatureIllustration } from '../../../components/ui/FeatureIllustration';
import { GlassPanel } from '../../../components/ui/Glass';
import { SoftPage, SoftTitle } from '../../../components/ui/SoftScreen';
import {
  HOW_IT_WORKS_FEATURES,
  HOW_IT_WORKS_GROUPS,
} from '../../../lib/howItWorks';
import { useAppTheme } from '../../../providers/ThemeProvider';

const FLOW = ['Capture', 'Remember', 'Ask'] as const;

export default function HowItWorksScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const timer = setInterval(() => setStep((current) => (current + 1) % FLOW.length), 1400);
    return () => clearInterval(timer);
  }, [reduced]);

  return (
    <FadeInContent>
      <SoftPage>
        <SoftTitle>How it works</SoftTitle>
        <ThemedText colorKey="textMuted" style={styles.lead}>
          Capture something once. Kairos keeps it, finds it, and answers from it.
        </ThemedText>

        <GlassPanel>
          <View style={styles.flow}>
            {FLOW.map((label, index) => {
              const lit = reduced || index === step;
              return (
              <View key={label} style={styles.flowItem}>
                <View
                  style={[
                    styles.flowDot,
                    { backgroundColor: lit ? colors.accent : colors.textMuted },
                    lit && !reduced && styles.flowDotLit,
                  ]}
                />
                <ThemedText colorKey={lit ? 'text' : 'textMuted'} style={styles.flowLabel}>
                  {label}
                </ThemedText>
                {index < 2 ? (
                  <Feather name="arrow-right" size={14} color={colors.textMuted} />
                ) : null}
              </View>
              );
            })}
          </View>
          <ThemedText colorKey="textSecondary" style={styles.flowCopy}>
            Saved, then processing, then ready. Offline notes wait on this device.
          </ThemedText>
        </GlassPanel>

        {HOW_IT_WORKS_GROUPS.map((group) => (
          <View key={group.id} style={styles.group}>
            <ThemedText colorKey="textMuted" style={styles.kicker}>
              {group.title}
            </ThemedText>
            <ThemedText colorKey="textSecondary" style={styles.groupLead}>
              {group.lead}
            </ThemedText>
            {HOW_IT_WORKS_FEATURES.filter((feature) => feature.group === group.id).map(
              (feature) => (
                <PressScale
                  key={feature.id}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    router.push(`/(app)/how-it-works/${feature.id}`);
                  }}
                  accessibilityLabel={feature.title}
                >
                  <GlassPanel padded={false} contentStyle={styles.card}>
                    <FeatureIllustration id={feature.id} />
                    <View style={styles.copy}>
                      <ThemedText colorKey="text" style={styles.title}>
                        {feature.title}
                      </ThemedText>
                      <ThemedText colorKey="textMuted" style={styles.summary} numberOfLines={2}>
                        {feature.summary}
                      </ThemedText>
                    </View>
                    <Feather name="chevron-right" size={16} color={colors.textMuted} />
                  </GlassPanel>
                </PressScale>
              ),
            )}
          </View>
        ))}
      </SoftPage>
    </FadeInContent>
  );
}

const styles = StyleSheet.create({
  lead: { fontFamily: 'Roboto_400Regular', fontSize: 15, lineHeight: 22 },
  flow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  flowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  flowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  flowDotLit: { transform: [{ scale: 1.6 }] },
  flowLabel: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 13,
  },
  flowCopy: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 13,
    lineHeight: 19,
  },
  group: { gap: 10 },
  kicker: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  groupLead: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 2,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  copy: { flex: 1, gap: 4 },
  title: { fontFamily: 'Roboto_500Medium', fontSize: 16 },
  summary: { fontFamily: 'Roboto_400Regular', fontSize: 13, lineHeight: 18 },
});
