import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated from 'react-native-reanimated';

import { ThemedText } from '../ThemedText';
import { useAppTheme } from '../../providers/ThemeProvider';
import type {
  AskMessage,
  AskSource,
  Memory,
  ProcessingJob,
  ProcessingStep,
  SearchResult,
  SourceType,
} from '../../types';
import { SOURCE_TYPE_LABELS } from '../../services';
import { AURORA_TONES, AuroraTone, auroraToneColors } from '../../theme';
import { Badge } from './MetricCard';
import { messageEntering, PressScale } from './Motion';
import { SurfaceCard } from './SectionHeader';

export function TopicChip({
  label,
  onPress,
  selected,
  tone = 'purple',
}: {
  label: string;
  onPress?: () => void;
  selected?: boolean;
  tone?: AuroraTone;
}) {
  const { colors, spacing, radius } = useAppTheme();
  const palette = auroraToneColors(colors, tone);

  return (
    <Pressable
      onPress={
        onPress
          ? () => {
              void Haptics.selectionAsync();
              onPress();
            }
          : undefined
      }
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { selected: !!selected } : undefined}
      style={({ pressed }) => ({
        paddingHorizontal: spacing['3'] + 4,
        paddingVertical: spacing['2'],
        borderRadius: radius.full,
        borderWidth: 1.5,
        borderColor: selected ? palette.accent : colors.border,
        backgroundColor: selected ? palette.accent : colors.surfaceElevated,
        transform: [{ scale: pressed ? 0.95 : 1 }],
      })}
    >
      <ThemedText
        colorKey={selected ? 'inverseText' : 'text'}
        style={[
          styles.chipLabel,
          !selected && { color: colors.textSecondary },
        ]}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function toneForIndex(index: number): AuroraTone {
  return AURORA_TONES[index % AURORA_TONES.length]!;
}

const SOURCE_ICONS: Record<SourceType, keyof typeof MaterialIcons.glyphMap> = {
  note: 'edit-note',
  audio: 'mic',
  document: 'description',
  link: 'link',
  photo: 'image',
  screenshot: 'screenshot',
  conversation: 'chat',
  task: 'check-circle-outline',
};

export function SourceTypeLabel({ type }: { type: SourceType }) {
  const { colors } = useAppTheme();
  const icon = SOURCE_ICONS[type] ?? 'article';

  return (
    <View style={styles.sourceLabelRow}>
      <MaterialIcons name={icon} size={14} color={colors.primary} />
      <ThemedText colorKey="primary" style={styles.kicker}>
        {SOURCE_TYPE_LABELS[type]}
      </ThemedText>
    </View>
  );
}

type MemoryCardProps = {
  memory: Memory;
  onPress: () => void;
  topicNames?: string[];
};

export function MemoryCard({ memory, onPress, topicNames }: MemoryCardProps) {
  const { colors, spacing, radius } = useAppTheme();
  const time = new Date(memory.capturedAt).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <PressScale onPress={onPress} accessibilityLabel={`Memory: ${memory.title}`}>
      <SurfaceCard elevated style={styles.memoryCard}>
        <View style={[styles.rowBetween, { gap: spacing['2'] }]}>
          <SourceTypeLabel type={memory.sourceType} />
          {memory.favorite ? <Badge label="Saved" tone="accent" /> : null}
        </View>
        <ThemedText colorKey="text" style={styles.cardTitle}>
          {memory.title}
        </ThemedText>
        <ThemedText colorKey="textSecondary" style={styles.body} numberOfLines={3}>
          {memory.summary}
        </ThemedText>
        <View style={[styles.rowBetween, { marginTop: spacing['1'] }]}>
          <ThemedText colorKey="textMuted" style={styles.meta}>
            {time}
          </ThemedText>
          {topicNames && topicNames.length > 0 ? (
            <View style={styles.topicRow}>
              {topicNames.slice(0, 2).map((t) => (
                <View
                  key={t}
                  style={[
                    styles.tagBadge,
                    { backgroundColor: colors.primaryContainer, borderRadius: radius.full },
                  ]}
                >
                  <ThemedText colorKey="primary" style={styles.tagText}>
                    {t}
                  </ThemedText>
                </View>
              ))}
            </View>
          ) : null}
        </View>
        <View style={[styles.rail, { backgroundColor: colors.primary }]} />
      </SurfaceCard>
    </PressScale>
  );
}

type TimelineMemoryItemProps = {
  memory: Memory;
  onPress: () => void;
  isFirst?: boolean;
  isLast?: boolean;
};

export function TimelineMemoryItem({
  memory,
  onPress,
  isFirst,
  isLast,
}: TimelineMemoryItemProps) {
  const { colors, spacing, radius } = useAppTheme();
  const timeOnly = new Date(memory.capturedAt).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <PressScale
      onPress={onPress}
      accessibilityLabel={`${timeOnly}, ${memory.title}`}
    >
      <View style={[styles.timelineRow, { gap: spacing['3'] }]}>
        <View style={styles.spineCol}>
          <View
            style={[
              styles.spineLine,
              { backgroundColor: colors.border, opacity: isFirst ? 0 : 1 },
            ]}
          />
          <View
            style={[
              styles.spineDot,
              {
                borderColor: colors.primary,
                backgroundColor: colors.primaryContainer,
              },
            ]}
          />
          <View
            style={[
              styles.spineLine,
              {
                backgroundColor: colors.border,
                opacity: isLast ? 0 : 1,
                flex: 1,
              },
            ]}
          />
        </View>
        <View style={[styles.timelineBody, { paddingBottom: spacing['4'] }]}>
          <SurfaceCard style={{ borderRadius: radius.lg }}>
            <View style={styles.rowBetween}>
              <ThemedText colorKey="textMuted" style={styles.time}>
                {timeOnly}
              </ThemedText>
              <SourceTypeLabel type={memory.sourceType} />
            </View>
            <ThemedText colorKey="text" style={styles.cardTitle}>
              {memory.title}
            </ThemedText>
            <ThemedText colorKey="textSecondary" style={styles.body} numberOfLines={2}>
              {memory.summary}
            </ThemedText>
          </SurfaceCard>
        </View>
      </View>
    </PressScale>
  );
}

export function SearchResultCard({
  result,
  onPress,
}: {
  result: SearchResult;
  onPress: () => void;
}) {
  return (
    <PressScale onPress={onPress} accessibilityLabel={result.memory.title}>
      <SurfaceCard elevated>
        <SourceTypeLabel type={result.memory.sourceType} />
        <ThemedText colorKey="text" style={styles.cardTitle}>
          {result.memory.title}
        </ThemedText>
        <ThemedText colorKey="textSecondary" style={styles.body} numberOfLines={3}>
          {result.snippet}
        </ThemedText>
        {result.matchedTopics.length > 0 ? (
          <ThemedText colorKey="textMuted" style={styles.meta}>
            {result.matchedTopics.join(' · ')}
          </ThemedText>
        ) : null}
      </SurfaceCard>
    </PressScale>
  );
}

export function EvidenceCard({
  source,
  onPress,
}: {
  source: AskSource;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();

  return (
    <Animated.View entering={messageEntering()}>
      <PressScale onPress={onPress} accessibilityLabel={`Source ${source.title}`}>
        <SurfaceCard style={{ borderColor: colors.borderAccent }}>
          <View style={styles.sourceLabelRow}>
            <MaterialIcons name="auto-stories" size={14} color={colors.primary} />
            <ThemedText colorKey="primary" style={styles.kicker}>
              Supporting memory
            </ThemedText>
          </View>
          <ThemedText colorKey="text" style={styles.cardTitle}>
            {source.title}
          </ThemedText>
          <ThemedText colorKey="textSecondary" style={styles.body} numberOfLines={2}>
            {source.snippet}
          </ThemedText>
        </SurfaceCard>
      </PressScale>
    </Animated.View>
  );
}

export const AskBubble = React.memo(function AskBubble({
  message,
  animate = false,
  onLongPress,
}: {
  message: AskMessage;
  /** Animate only a message that just arrived. History should stay still. */
  animate?: boolean;
  onLongPress?: () => void;
}) {
  const { colors, spacing, radius } = useAppTheme();
  const isUser = message.role === 'user';
  const frameStyle = isUser
    ? {
        alignSelf: 'flex-end' as const,
        maxWidth: '85%' as const,
        backgroundColor: colors.buttonFill,
        borderBottomRightRadius: 6,
        borderRadius: radius.xl,
        paddingHorizontal: spacing['4'],
        paddingVertical: spacing['3'],
        shadowColor: colors.buttonBottom,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 2,
      }
    : {
        alignSelf: 'stretch' as const,
        backgroundColor: colors.surfaceElevated,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radius.xl,
        borderTopLeftRadius: 6,
        padding: spacing['4'],
        gap: spacing['2'],
        shadowColor: colors.shadow.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: colors.shadow.shadowOpacity,
        shadowRadius: 6,
        elevation: 2,
      };

  const enterOnMount = React.useRef(animate).current;
  const body = (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={320}
      disabled={!onLongPress}
      accessibilityHint={onLongPress ? 'Long press to share this message' : undefined}
    >
      <View style={frameStyle}>
        <ThemedText
          colorKey={isUser ? 'buttonText' : 'text'}
          style={[
            styles.body,
            isUser
              ? { color: colors.buttonText, fontSize: 16, lineHeight: 22, fontWeight: '500' }
              : { fontSize: 16, lineHeight: 24 },
          ]}
        >
          {message.content}
        </ThemedText>
      </View>
    </Pressable>
  );

  if (!enterOnMount) return body;
  return <Animated.View entering={messageEntering()}>{body}</Animated.View>;
});

function stepGlyph(status: ProcessingStep['status']): string {
  if (status === 'completed') return '✓';
  if (status === 'running') return '●';
  if (status === 'failed') return '!';
  return '○';
}

export function ProcessingIndicator({ job }: { job: ProcessingJob }) {
  const { colors, spacing } = useAppTheme();
  return (
    <SurfaceCard elevated>
      <View style={[styles.rowBetween, { marginBottom: spacing['2'] }]}>
        <ThemedText colorKey="text" style={styles.cardTitle}>
          {job.title}
        </ThemedText>
        <Badge label={job.stage} tone={job.stage === 'READY' ? 'success' : 'accent'} />
      </View>
      <SourceTypeLabel type={job.sourceType} />
      <View style={{ gap: spacing['2'], marginTop: spacing['2'] }}>
        {job.steps.map((step) => (
          <View key={step.id} style={styles.stepRow}>
            <ThemedText
              colorKey={
                step.status === 'completed'
                  ? 'success'
                  : step.status === 'running'
                    ? 'accent'
                    : 'textMuted'
              }
              style={styles.stepGlyph}
            >
              {stepGlyph(step.status)}
            </ThemedText>
            <ThemedText colorKey="textSecondary" style={styles.body}>
              {step.label}
            </ThemedText>
            <ThemedText colorKey="textMuted" style={styles.meta}>
              {step.status}
            </ThemedText>
          </View>
        ))}
      </View>
      <View style={[styles.rail, { backgroundColor: colors.accent }]} />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  chipLabel: {
    fontFamily: 'Roboto_600SemiBold',
    fontSize: 13,
    letterSpacing: 0.1,
  },
  sourceLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  kicker: {
    fontFamily: 'Roboto_600SemiBold',
    fontSize: 12,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  memoryCard: {
    position: 'relative',
  },
  cardTitle: {
    fontFamily: 'Roboto_600SemiBold',
    fontSize: 17,
    letterSpacing: -0.1,
    marginTop: 2,
  },
  body: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 14,
    lineHeight: 22,
  },
  meta: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 12,
  },
  topicRow: {
    flexDirection: 'row',
    gap: 6,
  },
  tagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagText: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 11,
  },
  time: {
    fontFamily: 'Roboto_600SemiBold',
    fontSize: 12,
    letterSpacing: 0.2,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rail: {
    position: 'absolute',
    left: 0,
    top: 14,
    bottom: 14,
    width: 3.5,
    borderRadius: 2,
  },
  timelineRow: {
    flexDirection: 'row',
  },
  spineCol: {
    width: 20,
    alignItems: 'center',
  },
  spineLine: {
    width: 2,
    flexGrow: 0,
    minHeight: 12,
  },
  spineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    marginVertical: 4,
  },
  timelineBody: {
    flex: 1,
    gap: 4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 28,
  },
  stepGlyph: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 14,
    width: 16,
    textAlign: 'center',
  },
});
