import { useAuth } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '../../components/ThemedText';
import {
  EmptyState,
  ErrorState,
  FadeInContent,
  LoadingSkeleton,
  SoftRefreshBar,
} from '../../components/ui/EmptyState';
import { GlassPanel } from '../../components/ui/Glass';
import { InsightCard } from '../../components/ui/InsightCard';
import { CountUp, PressScale } from '../../components/ui/Motion';
import { SoftPage, SoftTitle } from '../../components/ui/SoftScreen';
import { useAsync } from '../../hooks/useAsync';
import { fetchDailyBrief } from '../../lib/api';
import { dailyReflection, greetingFor } from '../../lib/engagement';
import { useAppTheme } from '../../providers/ThemeProvider';

export default function DailyBriefScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { getToken } = useAuth();
  const { data, error, loading, refreshing, reload } = useAsync(async () => {
    const token = await getToken();
    if (!token) throw new Error('Sign in required');
    return fetchDailyBrief(token);
  }, [getToken], { cacheKey: 'brief' });

  const reflection = dailyReflection();
  const go = (href: Parameters<typeof router.push>[0]) => {
    void Haptics.selectionAsync();
    router.push(href);
  };

  if (loading && !data) return <LoadingSkeleton rows={7} label="Preparing your brief" />;
  if (error && !data) {
    return <ErrorState title="Unable to load" onRetry={reload} />;
  }
  if (!data || data.empty) {
    return (
      <SoftPage>
        <EmptyState
          icon="wb-sunny"
          title="Your first brief arrives tomorrow"
          message="Save something today and Kairos will have a short recap waiting for you."
          actionLabel="Capture something"
          onAction={() => router.push('/(app)/quick-capture')}
        />
      </SoftPage>
    );
  }

  const maxTopic = Math.max(1, ...data.attentionTopics.map((topic) => topic.observationCount));

  return (
    <FadeInContent>
      <SoftRefreshBar active={refreshing} />
      <SoftPage>
        <View style={styles.header}>
          <ThemedText colorKey="primary" style={styles.eyebrow}>
            {greetingFor()}
          </ThemedText>
          <SoftTitle>{data.title}</SoftTitle>
        </View>

        <GlassPanel>
          <View style={styles.statRow}>
            <View style={styles.statBlock}>
              <CountUp value={data.yesterdayCount} style={[styles.statValue, { color: colors.text }]} />
              <ThemedText colorKey="textMuted" style={styles.statLabel}>yesterday</ThemedText>
            </View>
            <View style={[styles.statBlock, styles.statDivider, { borderLeftColor: colors.border }]}>
              <CountUp value={data.weekCount} style={[styles.statValue, { color: colors.text }]} />
              <ThemedText colorKey="textMuted" style={styles.statLabel}>this week</ThemedText>
            </View>
          </View>
          <ThemedText colorKey="textSecondary" style={styles.meta}>
            {data.yesterdayCount === 0
              ? 'A quiet day. Today is a clean page.'
              : `Yesterday you kept ${data.yesterdayCount} ${data.yesterdayCount === 1 ? 'memory' : 'memories'}. Nice work.`}
          </ThemedText>
        </GlassPanel>

        {data.attentionTopics.length > 0 ? (
          <GlassPanel>
            <ThemedText colorKey="textMuted" style={styles.kicker}>
              Where your attention went
            </ThemedText>
            <View style={styles.topicWrap}>
              {data.attentionTopics.map((topic) => {
                const lead = topic.observationCount === maxTopic;
                return (
                  <PressScale
                    key={topic.id}
                    onPress={() => go(`/(app)/topics/${topic.id}`)}
                    accessibilityLabel={`${topic.name}, ${topic.observationCount} memories`}
                  >
                    <View
                      style={[
                        styles.topic,
                        lead
                          ? { backgroundColor: colors.primaryContainer, borderColor: colors.primaryContainer }
                          : { borderColor: colors.glassBorder },
                      ]}
                    >
                      <ThemedText colorKey={lead ? 'primary' : 'text'} style={styles.topicLabel}>
                        {topic.name}
                      </ThemedText>
                      <ThemedText colorKey={lead ? 'primary' : 'textMuted'} style={styles.topicCount}>
                        {topic.observationCount}
                      </ThemedText>
                    </View>
                  </PressScale>
                );
              })}
            </View>
          </GlassPanel>
        ) : null}

        <InsightCard insight={data.noticed} onExplore={() => go('/(app)/insight')} />

        {data.revisit ? (
          <PressScale
            onPress={() =>
              go(
                data.revisit?.observationId
                  ? `/(app)/observation/${data.revisit.observationId}`
                  : '/(app)/predictions',
              )
            }
            accessibilityLabel={`Worth revisiting: ${data.revisit.title}`}
          >
            <GlassPanel>
              <View style={styles.revisitHead}>
                <Feather name="rotate-ccw" size={14} color={colors.textSecondary} />
                <ThemedText colorKey="textMuted" style={styles.kickerInline}>
                  Worth revisiting
                </ThemedText>
              </View>
              <ThemedText colorKey="text" style={styles.revisitTitle}>
                {data.revisit.title}
              </ThemedText>
              <ThemedText colorKey="textMuted" style={styles.meta}>
                {data.revisit.body}
              </ThemedText>
            </GlassPanel>
          </PressScale>
        ) : null}

        <PressScale
          onPress={() => go({ pathname: '/(app)/quick-capture', params: { prompt: reflection.prompt } })}
          accessibilityLabel={`Start today's reflection: ${reflection.prompt}`}
        >
          <View style={[styles.reflection, { backgroundColor: colors.primary }]}>
            <ThemedText colorKey="onPrimary" style={styles.reflectionKicker}>
              Start your day
            </ThemedText>
            <ThemedText colorKey="onPrimary" style={styles.reflectionText}>
              {reflection.prompt}
            </ThemedText>
            <Feather name="arrow-right" size={18} color={colors.onPrimary} style={styles.reflectionArrow} />
          </View>
        </PressScale>
      </SoftPage>
    </FadeInContent>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4 },
  eyebrow: { fontFamily: 'Roboto_600SemiBold', fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase' },
  statRow: { flexDirection: 'row' },
  statBlock: { gap: 2, paddingRight: 20 },
  statDivider: { borderLeftWidth: StyleSheet.hairlineWidth, paddingLeft: 20 },
  statValue: { fontFamily: 'Roboto_700Bold', fontSize: 32, letterSpacing: -0.6 },
  statLabel: { fontFamily: 'Roboto_500Medium', fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' },
  meta: { fontFamily: 'Roboto_400Regular', fontSize: 14, lineHeight: 20, marginTop: 6 },
  kicker: { fontFamily: 'Roboto_500Medium', fontSize: 13, marginBottom: 8 },
  kickerInline: { fontFamily: 'Roboto_500Medium', fontSize: 13 },
  topicWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  topic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  topicLabel: { fontFamily: 'Roboto_500Medium', fontSize: 13 },
  topicCount: { fontFamily: 'Roboto_600SemiBold', fontSize: 12 },
  revisitHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  revisitTitle: { fontFamily: 'Roboto_600SemiBold', fontSize: 16, lineHeight: 22 },
  reflection: { borderRadius: 22, padding: 18, gap: 6 },
  reflectionKicker: { fontFamily: 'Roboto_600SemiBold', fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', opacity: 0.85 },
  reflectionText: { fontFamily: 'Roboto_500Medium', fontSize: 17, lineHeight: 24, paddingRight: 28 },
  reflectionArrow: { position: 'absolute', right: 18, bottom: 18 },
});
