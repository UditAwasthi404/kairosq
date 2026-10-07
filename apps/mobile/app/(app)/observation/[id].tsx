import { useAuth } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '../../../components/ThemedText';
import { ErrorState, FadeInContent, LoadingSkeleton } from '../../../components/ui/EmptyState';
import { Badge } from '../../../components/ui/MetricCard';
import { GlassPanel } from '../../../components/ui/Glass';
import { Breathe } from '../../../components/ui/Motion';
import { SoftLinkList, SoftPage, SoftTitle } from '../../../components/ui/SoftScreen';
import { ThemedButton } from '../../../components/ui/ThemedButton';
import { ThemedInput } from '../../../components/ui/ThemedInput';
import { SOURCE_TYPE_LABELS } from '../../../constants/source-labels';
import {
  ApiError,
  deleteObservation,
  fetchObservation,
  formatObservationReadyTime,
  isProcessingObservationStatus,
  isTerminalObservationStatus,
  observationFileUri,
  observationStageLabel,
  observationStatusHeadline,
  reprocessObservation,
  updateObservation,
  type ApiObservation,
} from '../../../lib/api';
import { captureSourceLabel } from '../../../lib/capture';
import {
  invalidateObservationCaches,
  removeCache,
} from '../../../lib/persistentCache';
import { readQueryCache, writeQueryCache } from '../../../hooks/useAsync';
import { useAppTheme } from '../../../providers/ThemeProvider';
import type { Observation, ProcessingStatus, SourceType } from '../../../types';

const POLL_MS = 2000;

function mapApiObservation(api: ApiObservation): Observation {
  const sourceType = mapType(api.type);
  const analysisNote =
    typeof api.sourceMetadata?.analysisNote === 'string'
      ? api.sourceMetadata.analysisNote
      : null;
  return {
    id: api.id,
    title: api.filename,
    sourceType,
    capturedAt: api.capturedAt,
    status: api.status as ProcessingStatus,
    previewText:
      api.summary?.slice(0, 180) ||
      api.extractedText?.slice(0, 180) ||
      `${api.type} · ${api.mimeType}`,
    extractedText: api.extractedText ?? undefined,
    summary: api.summary ?? undefined,
    linkedMemoryIds: [],
    sourceLabel:
      api.sourceLabel ||
      captureSourceLabel(
        api.source ||
          (typeof api.sourceMetadata?.source === 'string'
            ? api.sourceMetadata.source
            : undefined),
      ),
    topics: api.topics.map((t) => ({ id: t.id, name: t.name })),
    entities: api.entities.map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
    })),
    projects: (api.projects ?? []).map((p) => ({ id: p.id, name: p.name })),
    metadata: api.metadata,
    processingError: api.processingError,
    analysisNote,
  };
}

function mapType(type: ApiObservation['type']): SourceType {
  switch (type) {
    case 'PDF':
    case 'DOCUMENT':
      return 'document';
    case 'IMAGE':
      return 'photo';
    case 'TEXT':
      return 'note';
    case 'AUDIO':
      return 'audio';
    default:
      return 'document';
  }
}

function statusTone(
  status: ProcessingStatus,
): 'success' | 'accent' | 'neutral' {
  if (status === 'COMPLETED') return 'success';
  if (status === 'FAILED') return 'accent';
  return 'neutral';
}

function extractedTextMessage(
  data: Observation,
  apiObs: ApiObservation | null,
): string {
  if (data.status !== 'COMPLETED') {
    if (data.status === 'FAILED') return 'Unavailable';
    if (data.status === 'PENDING' || data.status === 'EXTRACTING') return 'Pending';
    return 'Processing memory…';
  }
  if (data.extractedText) return data.extractedText;

  const processingNote =
    typeof apiObs?.sourceMetadata?.processingNote === 'string'
      ? apiObs.sourceMetadata.processingNote.trim()
      : '';
  if (processingNote) return processingNote;

  if (data.sourceType === 'photo' || data.sourceType === 'screenshot') {
    return 'No text yet';
  }
  return 'None';
}

function summaryText(
  data: Observation,
  ready: boolean,
  processing: boolean,
  failed: boolean,
  stage: string,
): string {
  if (ready) {
    if (data.summary) return data.summary;
    if (data.analysisNote) return data.analysisNote;
    return 'None';
  }
  if (processing) return stage;
  if (failed) return 'Unavailable';
  return 'Pending';
}

export default function ObservationDetailScreen() {
  const { id, highlight, chunkId } = useLocalSearchParams<{
    id: string;
    highlight?: string;
    chunkId?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { getToken } = useAuth();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cacheKey = `observation:${String(id)}`;
  const [cached] = useState(() => readQueryCache<ApiObservation>(cacheKey));
  const loadedIdRef = useRef<string | null>(cached ? String(id) : null);
  const [data, setData] = useState<Observation | null>(() => (cached ? mapApiObservation(cached) : null));
  const [apiObs, setApiObs] = useState<ApiObservation | null>(cached);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!cached);
  const [retrying, setRetrying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftText, setDraftText] = useState('');
  const [fileToken, setFileToken] = useState<string | null>(null);
  const matchedSnippet =
    typeof highlight === 'string' && highlight.trim().length > 0
      ? highlight.trim()
      : Array.isArray(highlight) && typeof highlight[0] === 'string'
        ? highlight[0].trim()
        : null;

  const load = useCallback(async () => {
    const observationId = String(id);
    const token = await getToken();
    if (!token) {
      setError('Sign in required');
      setData(null);
      setApiObs(null);
      loadedIdRef.current = null;
      return;
    }
    setFileToken(token);

    try {
      const api = await fetchObservation(token, observationId);
      setApiObs(api);
      setData(mapApiObservation(api));
      writeQueryCache(`observation:${observationId}`, api);
      setError(null);
      loadedIdRef.current = observationId;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        removeCache(`observation:${observationId}`);
        setError('Not found');
      } else if (loadedIdRef.current === observationId) {
        // Keep the saved copy on screen while offline or on a transient failure.
        return;
      } else if (err instanceof ApiError && err.status === 401) {
        setError('Session expired');
      } else {
        setError('Unable to load');
      }
      setData(null);
      setApiObs(null);
      loadedIdRef.current = null;
    }
  }, [getToken, id]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const soft = loadedIdRef.current === String(id);
        if (!soft) setLoading(true);
        await load();
        if (!cancelled) setLoading(false);
      })();

      return () => {
        cancelled = true;
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      };
    }, [load, id]),
  );

  useEffect(() => {
    if (
      !data ||
      isTerminalObservationStatus(data.status as ApiObservation['status'])
    ) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    if (pollRef.current) return;

    pollRef.current = setInterval(() => {
      void (async () => {
        const token = await getToken();
        if (!token) return;
        try {
          const api = await fetchObservation(token, String(id));
          setApiObs(api);
          setData(mapApiObservation(api));
          writeQueryCache(cacheKey, api);
        } catch {
          // Keep last known state while polling.
        }
      })();
    }, POLL_MS);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [data, getToken, id, cacheKey]);

  const onRetry = async () => {
    try {
      setRetrying(true);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const token = await getToken();
      if (!token) return;
      const api = await reprocessObservation(token, String(id));
      setApiObs(api);
      setData(mapApiObservation(api));
    } catch {
      setError('Retry failed');
    } finally {
      setRetrying(false);
    }
  };

  const beginEdit = () => {
    if (!data) return;
    setDraftTitle(data.title);
    setDraftText(data.extractedText || apiObs?.extractedText || '');
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const onSaveEdit = async () => {
    if (!data) return;
    const previous = { data, apiObs };
    const nextTitle = draftTitle.trim() || data.title;
    const nextText = draftText;
    setData({
      ...data,
      title: nextTitle,
      extractedText: nextText,
      previewText: nextText.slice(0, 180) || data.previewText,
    });
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) throw new ApiError('Sign in required.', 401);
      const updated = await updateObservation(token, String(id), {
        title: nextTitle,
        content: nextText,
      });
      setApiObs(updated);
      setData(mapApiObservation(updated));
      writeQueryCache(cacheKey, updated);
      setEditing(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setData(previous.data);
      setApiObs(previous.apiObs);
      Alert.alert(
        'Could not save',
        err instanceof ApiError ? err.message : 'Your memory was not changed.',
      );
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Delete?',
      data?.title ?? 'Observation',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                setDeleting(true);
                const token = await getToken();
                if (!token) throw new ApiError('Sign in required.', 401);
                await deleteObservation(token, String(id));
                invalidateObservationCaches([String(id)]);
                router.replace('/(app)/timeline');
              } catch (err) {
                Alert.alert(
                  'Unable to delete',
                  err instanceof ApiError ? err.message : 'Try again.',
                );
              } finally {
                setDeleting(false);
              }
            })();
          },
        },
      ],
    );
  };

  if (loading && !data) return <LoadingSkeleton rows={8} />;
  if ((error && !data) || !data) {
    return (
      <ErrorState
        title="Unable to load"
        onRetry={() => void load()}
      />
    );
  }

  const captured = new Date(data.capturedAt).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const ready = data.status === 'COMPLETED';
  const failed = data.status === 'FAILED';
  const processing = isProcessingObservationStatus(
    data.status as ApiObservation['status'],
  );
  const stage =
    apiObs != null
      ? observationStageLabel(apiObs)
      : observationStageLabel({
          status: data.status as ApiObservation['status'],
        });
  const headline = observationStatusHeadline(
    data.status as ApiObservation['status'],
  );

  const statusDetail = [
    stage,
    ready && apiObs
      ? formatObservationReadyTime(apiObs.processedAt || apiObs.updatedAt)
      : null,
    failed && data.processingError ? data.processingError : null,
  ]
    .filter(Boolean)
    .join('\n');

  const sourceMeta = [
    data.metadata?.mimeType ?? '',
    data.metadata?.fileSizeBytes
      ? `${Math.round(data.metadata.fileSizeBytes / 1024)} KB`
      : '',
    ready && data.metadata?.chunkCount != null ? `${data.metadata.chunkCount} chunks` : '',
    ready && data.metadata?.wordCount != null ? `${data.metadata.wordCount} words` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const showImage = apiObs?.type === 'IMAGE' && fileToken;

  const topicCount = data.topics?.length ?? 0;
  const entityCount = data.entities?.length ?? 0;
  const connections = ready
    ? [
        topicCount ? `${topicCount} ${topicCount === 1 ? 'topic' : 'topics'}` : '',
        entityCount ? `${entityCount} ${entityCount === 1 ? 'entity' : 'entities'}` : '',
      ].filter(Boolean).join(' and ')
    : '';

  const stickyActions: Array<{ icon: React.ComponentProps<typeof Feather>['name']; label: string; a11y: string; onPress: () => void }> = [
    {
      icon: 'message-circle',
      label: 'Ask',
      a11y: 'Ask about this memory',
      onPress: () => router.push({ pathname: '/(app)/(tabs)/ask', params: { scopeType: 'observation', scopeId: String(id), scopeName: data.title } }),
    },
    {
      icon: 'folder-plus',
      label: 'Project',
      a11y: 'Add this memory to a project',
      onPress: () => router.push({ pathname: '/(app)/observation/projects', params: { id: String(id) } }),
    },
    {
      icon: editing ? 'x' : 'edit-3',
      label: editing ? 'Cancel' : 'Edit',
      a11y: editing ? 'Cancel editing memory' : 'Edit memory',
      onPress: editing ? cancelEdit : beginEdit,
    },
    {
      icon: 'more-horizontal',
      label: 'More',
      a11y: 'More memory actions',
      onPress: () => Alert.alert('More actions', undefined, [
        { text: 'Reprocess', onPress: () => void onRetry() },
        { text: 'Delete', style: 'destructive', onPress: () => void onDelete() },
        { text: 'Cancel', style: 'cancel' },
      ]),
    },
  ];

  return (
    <FadeInContent>
      <SoftPage tabBar>
        <View style={styles.titleBlock}>
          <Breathe active={processing} amount={0.05} period={1600} style={styles.badgeWrap}>
            <Badge label={headline} tone={statusTone(data.status)} />
          </Breathe>
          {editing ? (
            <ThemedInput
              value={draftTitle}
              onChangeText={setDraftTitle}
              placeholder="Title"
              accessibilityLabel="Memory title"
            />
          ) : (
            <SoftTitle>{data.title}</SoftTitle>
          )}
          <ThemedText colorKey="textMuted" style={styles.meta}>
            {SOURCE_TYPE_LABELS[data.sourceType]} · {captured}
          </ThemedText>
          {connections ? (
            <View style={styles.connections}>
              <Feather name="share-2" size={12} color={colors.primary} />
              <ThemedText colorKey="textSecondary" style={styles.meta}>
                Linked to {connections}
              </ThemedText>
            </View>
          ) : null}
        </View>

        {showImage ? (
          <GlassPanel padded={false}>
            <Image
              source={{
                uri: observationFileUri(String(id)),
                headers: { Authorization: `Bearer ${fileToken}` },
              }}
              style={styles.preview}
              resizeMode="cover"
              accessibilityLabel="Shared image"
            />
          </GlassPanel>
        ) : null}

        {matchedSnippet ? (
          <GlassPanel>
            <ThemedText colorKey="textMuted" style={styles.kicker}>
              {typeof chunkId === 'string' && chunkId ? `Citation excerpt · ${chunkId.slice(0, 8)}` : 'Citation excerpt'}
            </ThemedText>
            <ThemedText colorKey="textSecondary" style={styles.body}>
              {matchedSnippet}
            </ThemedText>
          </GlassPanel>
        ) : null}

        <GlassPanel>
          <ThemedText colorKey="textMuted" style={styles.kicker}>
            Status
          </ThemedText>
          {statusDetail ? (
            <ThemedText colorKey="textSecondary" style={styles.body}>
              {statusDetail}
            </ThemedText>
          ) : null}
          {failed ? (
            <ThemedButton
              label={retrying ? 'Retrying…' : 'Retry'}
              onPress={() => void onRetry()}
              disabled={retrying}
              style={styles.inlineBtn}
            />
          ) : null}
        </GlassPanel>

        <GlassPanel>
          <ThemedText colorKey="textMuted" style={styles.kicker}>
            Summary
          </ThemedText>
          <ThemedText colorKey="textSecondary" style={styles.body}>
            {summaryText(data, ready, processing, failed, stage)}
          </ThemedText>
        </GlassPanel>

        <GlassPanel>
          <ThemedText colorKey="textMuted" style={styles.kicker}>
            Topics
          </ThemedText>
          {ready && data.topics && data.topics.length > 0 ? (
            <View style={styles.chipRow}>
              {data.topics.map((topic) => (
                <Pressable
                  key={topic.id}
                  onPress={() => router.push(`/(app)/topics/${topic.id}`)}
                  style={[styles.chip, { borderColor: colors.glassBorder }]}
                >
                  <ThemedText colorKey="text" style={styles.chipText}>
                    {topic.name}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          ) : (
            <ThemedText colorKey="textMuted" style={styles.placeholder}>
              {processing ? '…' : 'None yet'}
            </ThemedText>
          )}
        </GlassPanel>

        <GlassPanel>
          <ThemedText colorKey="textMuted" style={styles.kicker}>
            Entities
          </ThemedText>
          {ready && data.entities && data.entities.length > 0 ? (
            <View style={styles.chipRow}>
              {data.entities.map((entity) => (
                <Pressable
                  key={entity.id}
                  onPress={() => router.push(`/(app)/entities/${entity.id}`)}
                  style={[styles.chip, { borderColor: colors.glassBorder }]}
                >
                  <ThemedText colorKey="text" style={styles.chipText}>
                    {entity.name}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          ) : (
            <ThemedText colorKey="textMuted" style={styles.placeholder}>
              {processing ? '…' : 'None yet'}
            </ThemedText>
          )}
        </GlassPanel>

        <GlassPanel>
          <ThemedText colorKey="textMuted" style={styles.kicker}>
            Projects
          </ThemedText>
          {data.projects && data.projects.length > 0 ? (
            <View style={styles.chipRow}>
              {data.projects.map((project) => (
                <Pressable
                  key={project.id}
                  onPress={() => router.push(`/(app)/projects/${project.id}`)}
                  style={[styles.chip, { borderColor: colors.glassBorder }]}
                >
                  <ThemedText colorKey="text" style={styles.chipText}>
                    {project.name}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          ) : (
            <ThemedText colorKey="textMuted" style={styles.placeholder}>
              None yet
            </ThemedText>
          )}
        </GlassPanel>

        <SoftLinkList
          items={[
            {
              label: editing ? 'Cancel edit' : 'Edit this memory',
              icon: editing ? 'x' : 'edit-3',
              onPress: editing ? cancelEdit : beginEdit,
            },
            {
              label: 'Ask about this memory',
              icon: 'message-circle',
              onPress: () =>
                router.push({
                  pathname: '/(app)/(tabs)/ask',
                  params: {
                    scopeType: 'observation',
                    scopeId: String(id),
                    scopeName: data.title,
                    q: `What did I say in this memory?`,
                  },
                }),
            },
            {
              label: 'Related memories',
              icon: 'git-merge',
              onPress: () => router.push(`/(app)/related/${String(id)}`),
            },
            {
              label: 'Add to project',
              icon: 'folder-plus',
              onPress: () =>
                router.push({
                  pathname: '/(app)/observation/projects',
                  params: { id: String(id) },
                }),
            },
          ]}
        />

        <GlassPanel>
          <ThemedText colorKey="textMuted" style={styles.kicker}>
            Source
          </ThemedText>
          <ThemedText colorKey="text" style={styles.sourceTitle} numberOfLines={2}>
            {data.sourceLabel}
          </ThemedText>
          {sourceMeta ? (
            <ThemedText colorKey="textMuted" style={styles.meta}>
              {sourceMeta}
            </ThemedText>
          ) : null}
        </GlassPanel>

        <GlassPanel>
          <ThemedText colorKey="textMuted" style={styles.kicker}>
            Text
          </ThemedText>
          {editing ? (
            <ThemedInput
              value={draftText}
              onChangeText={setDraftText}
              placeholder="What should this memory say?"
              accessibilityLabel="Memory text"
              multiline
              style={styles.editBody}
            />
          ) : (
            <ThemedText colorKey="textSecondary" style={styles.body}>
              {(() => {
                const extracted = extractedTextMessage(data, apiObs);
                if (!matchedSnippet) return extracted;
                const index = extracted.toLocaleLowerCase().indexOf(matchedSnippet.toLocaleLowerCase());
                if (index < 0) return extracted;
                return <>{extracted.slice(0, index)}<Text style={[styles.highlight, { backgroundColor: colors.primaryContainer, color: colors.text }]}>{extracted.slice(index, index + matchedSnippet.length)}</Text>{extracted.slice(index + matchedSnippet.length)}</>;
              })()}
            </ThemedText>
          )}
        </GlassPanel>

        {editing ? (
          <ThemedButton
            label={saving ? 'Saving…' : 'Save memory'}
            disabled={saving || deleting}
            onPress={() => void onSaveEdit()}
          />
        ) : (
          <ThemedButton
            label={deleting ? 'Deleting…' : 'Delete'}
            variant="outline"
            disabled={deleting || retrying || saving}
            onPress={onDelete}
          />
        )}
      </SoftPage>
      <View style={[styles.stickyActions, { backgroundColor: colors.surfaceElevated, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
        {stickyActions.map((action) => (
          <Pressable
            key={action.label}
            onPress={() => {
              void Haptics.selectionAsync();
              action.onPress();
            }}
            accessibilityRole="button"
            accessibilityLabel={action.a11y}
            style={({ pressed }) => [
              styles.stickyButton,
              pressed && { backgroundColor: colors.surfaceContainer, transform: [{ scale: 0.94 }] },
            ]}
          >
            <Feather name={action.icon} size={18} color={colors.text} />
            <ThemedText colorKey="textSecondary" style={styles.stickyLabel}>{action.label}</ThemedText>
          </Pressable>
        ))}
      </View>
    </FadeInContent>
  );
}

const styles = StyleSheet.create({
  titleBlock: { gap: 8 },
  meta: { fontFamily: 'Roboto_400Regular', fontSize: 12 },
  kicker: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  body: { fontFamily: 'Roboto_400Regular', fontSize: 14, lineHeight: 21 },
  highlight: { fontFamily: 'Roboto_500Medium', textDecorationLine: 'underline' },
  badgeWrap: { alignSelf: 'flex-start' },
  connections: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stickyActions: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingTop: 8, paddingHorizontal: 8, borderTopWidth: StyleSheet.hairlineWidth },
  stickyButton: { minWidth: 64, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  stickyLabel: { fontFamily: 'Roboto_500Medium', fontSize: 11 },
  placeholder: { fontFamily: 'Roboto_400Regular', fontSize: 13 },
  sourceTitle: { fontFamily: 'Roboto_500Medium', fontSize: 15 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: { fontFamily: 'Roboto_500Medium', fontSize: 12 },
  inlineBtn: { marginTop: 8 },
  preview: { width: '100%', height: 220, borderRadius: 20 },
  editBody: { minHeight: 140, textAlignVertical: 'top' },
});
