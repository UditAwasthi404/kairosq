import { useAuth } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Breathe, PressScale } from '../../components/ui/Motion';
import { SoftPage } from '../../components/ui/SoftScreen';
import { GlassPanel } from '../../components/ui/Glass';
import {
  EmptyState,
  ErrorState,
  FadeInContent,
  LoadingSkeleton,
} from '../../components/ui/EmptyState';
import { ThemedText } from '../../components/ThemedText';
import {
  fetchObservations,
  isProcessingObservationStatus,
  observationStageLabel,
  type ApiObservation,
} from '../../lib/api';
import { useAppTheme } from '../../providers/ThemeProvider';

type ActivityItem = {
  id: string;
  title: string;
  body: string;
  href: string;
  tone: 'accent' | 'success' | 'neutral';
};

function toActivity(observations: ApiObservation[]): ActivityItem[] {
  return observations
    .filter(
      (o) =>
        isProcessingObservationStatus(o.status) ||
        o.status === 'FAILED' ||
        o.status === 'COMPLETED',
    )
    .slice(0, 20)
    .map((o) => {
      const failed = o.status === 'FAILED';
      const ready = o.status === 'COMPLETED';
      return {
        id: o.id,
        title: o.filename,
        body: observationStageLabel(o),
        href: `/(app)/observation/${o.id}`,
        tone: ready ? 'success' : failed ? 'accent' : 'neutral',
      };
    });
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { getToken } = useAuth();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasDataRef = useRef(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const token = await getToken();
      if (!token) throw new Error('Sign in required');
      const observations = await fetchObservations(token);
      setItems(toActivity(observations));
      hasDataRef.current = true;
    } catch {
      setError('Unable to load');
    }
  }, [getToken]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        if (!hasDataRef.current) setLoading(true);
        await load();
        if (!cancelled) setLoading(false);
      })();
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  if (loading && items.length === 0) return <LoadingSkeleton rows={6} label="Checking for updates" />;
  if (error && items.length === 0) {
    return <ErrorState title="Unable to load" onRetry={() => void load()} />;
  }
  if (items.length === 0) {
    return (
      <SoftPage>
        <EmptyState
          icon="notifications-none"
          title="All clear"
          message="Updates about your captures will show up here."
          actionLabel="Capture something"
          onAction={() => router.push('/(app)/quick-capture')}
        />
      </SoftPage>
    );
  }

  return (
    <FadeInContent>
      <SoftPage>
        {items.map((item) => (
          <PressScale
            key={item.id}
            onPress={() => {
              void Haptics.selectionAsync();
              router.push(item.href as `/${string}`);
            }}
            accessibilityLabel={`${item.title}, ${item.body}`}
          >
            <GlassPanel padded={false} contentStyle={styles.row}>
              <Breathe active={item.tone === 'neutral'} amount={0.35} period={1400}>
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        item.tone === 'success'
                          ? colors.success
                          : item.tone === 'accent'
                            ? colors.error
                            : colors.textMuted,
                    },
                  ]}
                />
              </Breathe>
              <View style={styles.copy}>
                <ThemedText colorKey="text" style={styles.title} numberOfLines={1}>
                  {item.title}
                </ThemedText>
                <ThemedText colorKey="textMuted" style={styles.meta} numberOfLines={1}>
                  {item.body}
                </ThemedText>
              </View>
              <Feather name="chevron-right" size={18} color={colors.textMuted} />
            </GlassPanel>
          </PressScale>
        ))}
      </SoftPage>
    </FadeInContent>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  copy: { flex: 1, gap: 2 },
  title: { fontFamily: 'Roboto_500Medium', fontSize: 15 },
  meta: { fontFamily: 'Roboto_400Regular', fontSize: 12 },
});
