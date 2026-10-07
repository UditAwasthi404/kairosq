import React from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '../ThemedText';
import {
  formatObservationReadyTime,
  isProcessingObservationStatus,
  observationStageLabel,
  type ApiObservation,
} from '../../lib/api';
import { useAppTheme } from '../../providers/ThemeProvider';
import { SurfaceCard } from './SectionHeader';
import { Badge } from './MetricCard';

type Props = {
  observation: ApiObservation;
  onPress: () => void;
  onRetry?: () => void;
  retrying?: boolean;
};

export function ObservationStatusCard({
  observation,
  onPress,
  onRetry,
  retrying,
}: Props) {
  const { colors, radius } = useAppTheme();
  const processing = isProcessingObservationStatus(observation.status);
  const failed = observation.status === 'FAILED';
  const ready = observation.status === 'COMPLETED';

  const meta = retrying
    ? 'Retrying…'
    : ready
      ? formatObservationReadyTime(observation.processedAt || observation.updatedAt)
      : failed
        ? 'Failed to process'
        : observationStageLabel(observation);

  const iconName: keyof typeof MaterialIcons.glyphMap = ready
    ? 'check'
    : failed
      ? 'error-outline'
      : 'sync';

  const iconBg = ready
    ? colors.tintGreen
    : failed
      ? colors.errorSurface
      : colors.primaryContainer;

  const iconColor = ready
    ? colors.success
    : failed
      ? colors.error
      : colors.primary;

  return (
    <Pressable
      onPress={failed && onRetry ? onRetry : onPress}
      accessibilityRole="button"
      accessibilityLabel={observation.filename}
      style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1, marginVertical: 3 }]}
    >
      <SurfaceCard elevated style={styles.card}>
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: iconBg, borderRadius: radius.full },
          ]}
        >
          <MaterialIcons name={iconName} size={20} color={iconColor} />
        </View>
        <View style={styles.copy}>
          <ThemedText colorKey="text" style={styles.title} numberOfLines={1}>
            {observation.filename}
          </ThemedText>
          <ThemedText colorKey="textSecondary" style={styles.meta} numberOfLines={1}>
            {observation.sourceLabel ? `${observation.sourceLabel} · ${meta}` : meta}
          </ThemedText>
        </View>
        {failed ? (
          <Badge label="RETRY" tone="warning" />
        ) : processing ? (
          <Badge label="IN PROGRESS" tone="accent" />
        ) : (
          <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
        )}
      </SurfaceCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 2 },
  title: {
    fontFamily: 'Roboto_600SemiBold',
    fontSize: 15,
  },
  meta: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 13,
  },
});
