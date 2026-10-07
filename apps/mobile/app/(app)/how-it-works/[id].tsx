import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { ThemedText } from '../../../components/ThemedText';
import { ErrorState, FadeInContent } from '../../../components/ui/EmptyState';
import { FeatureIllustration } from '../../../components/ui/FeatureIllustration';
import { GlassPanel } from '../../../components/ui/Glass';
import { itemEntering } from '../../../components/ui/Motion';
import { SoftPage, SoftTitle } from '../../../components/ui/SoftScreen';
import { ThemedButton } from '../../../components/ui/ThemedButton';
import { howItWorksFeature } from '../../../lib/howItWorks';

export default function HowItWorksFeatureScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const feature = howItWorksFeature(String(id));

  if (!feature) {
    return (
      <ErrorState
        title="Not found"
        onRetry={() => router.replace('/(app)/how-it-works')}
      />
    );
  }

  return (
    <FadeInContent>
      <SoftPage>
        <FeatureIllustration id={feature.id} size="hero" />
        <SoftTitle>{feature.title}</SoftTitle>
        <ThemedText colorKey="textSecondary" style={styles.body}>
          {feature.body}
        </ThemedText>

        <GlassPanel>
          <ThemedText colorKey="textMuted" style={styles.kicker}>
            How to use it
          </ThemedText>
          <View style={styles.steps}>
            {feature.steps.map((step, index) => (
              <Animated.View key={step} entering={itemEntering(index + 2)} style={styles.step}>
                <ThemedText colorKey="accent" style={styles.stepIndex}>
                  {String(index + 1).padStart(2, '0')}
                </ThemedText>
                <ThemedText colorKey="text" style={styles.stepText}>
                  {step}
                </ThemedText>
              </Animated.View>
            ))}
          </View>
        </GlassPanel>

        {feature.tryHref && feature.tryLabel ? (
          <ThemedButton
            label={feature.tryLabel}
            onPress={() => router.push(feature.tryHref as `/${string}`)}
          />
        ) : null}
      </SoftPage>
    </FadeInContent>
  );
}

const styles = StyleSheet.create({
  body: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 15,
    lineHeight: 23,
  },
  kicker: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  steps: { gap: 14 },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepIndex: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 12,
    letterSpacing: 0.6,
    marginTop: 2,
  },
  stepText: {
    flex: 1,
    fontFamily: 'Roboto_400Regular',
    fontSize: 14,
    lineHeight: 21,
  },
});
