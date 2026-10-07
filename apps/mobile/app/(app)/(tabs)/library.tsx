import { useAuth } from '@clerk/expo';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOutUp, ReduceMotion } from 'react-native-reanimated';

import { ThemedText } from '../../../components/ThemedText';
import { EmptyState, ErrorState, LoadingSkeleton } from '../../../components/ui/EmptyState';
import { FLOATING_TAB_BAR_CONTENT } from '../../../components/FloatingTabBar';
import {
  addObservationsToProjectBulk,
  deleteObservation,
  fetchEntities,
  fetchObservationsPage,
  fetchProjects,
  fetchTopics,
  reprocessObservation,
  semanticSearch,
  type ApiEntitySummary,
  type ApiObservation,
  type ApiProjectSummary,
  type ApiSemanticSearchResult,
  type ApiTopicSummary,
  type CaptureSource,
} from '../../../lib/api';
import {
  buildSemanticFilters,
  dateRangeForPreset,
  removeLibraryFilter,
  toggleLibraryScopeFilter,
  SEARCH_DATE_OPTIONS,
  SEARCH_SOURCE_OPTIONS,
  type LibraryFilters,
} from '../../../lib/searchFilters';
import { useAppTheme } from '../../../providers/ThemeProvider';
import { readQueryCache, writeQueryCache } from '../../../hooks/useAsync';
import { isStale } from '../../../lib/freshness';
import { isNetworkError, onReconnect } from '../../../lib/network';
import { PressScale, itemEntering } from '../../../components/ui/Motion';
import { invalidateObservationCaches } from '../../../lib/persistentCache';

const CACHE = {
  timeline: 'library:timeline',
  topics: 'library:topics',
  entities: 'library:entities',
  projects: 'library:projects',
} as const;
const FOCUS_REFRESH_MS = 30_000;
const FILTER_DEBOUNCE_MS = 400;

function withoutExtractedText(observation: ApiObservation): ApiObservation {
  return { ...observation, extractedText: null };
}

type ViewKind = 'Timeline' | 'Topics' | 'People & Things' | 'Projects';
const VIEWS: ViewKind[] = ['Timeline', 'Topics', 'People & Things', 'Projects'];
const TYPES = ['DOCUMENT', 'PDF', 'IMAGE', 'TEXT', 'AUDIO'] as const;
const ENTITY_ICONS: Record<ApiEntitySummary['type'], keyof typeof MaterialIcons.glyphMap> = {
  PERSON: 'person',
  ORGANIZATION: 'business',
  TECHNOLOGY: 'memory',
  PRODUCT: 'inventory-2',
  LOCATION: 'place',
  CONCEPT: 'lightbulb-outline',
};

const MEM_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  TEXT: 'edit-note',
  DOCUMENT: 'description',
  PDF: 'picture-as-pdf',
  IMAGE: 'image',
  AUDIO: 'mic',
};

export default function LibraryScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const { colors, radius, typography } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<ViewKind>('Timeline');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<LibraryFilters>({});
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterChoices, setFilterChoices] = useState<Array<{ id: string; name: string; type: 'topic' | 'entity' | 'project' }>>([]);
  const [searchResults, setSearchResults] = useState<ApiSemanticSearchResult[] | null>(null);
  const [items, setItems] = useState<ApiObservation[]>(() => readQueryCache<ApiObservation[]>(CACHE.timeline) ?? []);
  const [topics, setTopics] = useState<ApiTopicSummary[]>(() => readQueryCache<ApiTopicSummary[]>(CACHE.topics) ?? []);
  const [entities, setEntities] = useState<ApiEntitySummary[]>(() => readQueryCache<ApiEntitySummary[]>(CACHE.entities) ?? []);
  const [projects, setProjects] = useState<ApiProjectSummary[]>(() => readQueryCache<ApiProjectSummary[]>(CACHE.projects) ?? []);
  const [cursor, setCursor] = useState<string | null>(null);
  const cursorRef = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [projectPicker, setProjectPicker] = useState(false);
  const filtersKey = JSON.stringify(filters);
  const [appliedFiltersKey, setAppliedFiltersKey] = useState(filtersKey);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const lastLoadRef = useRef<{ key: string; at: number } | null>(null);
  const hasFilters = appliedFiltersKey !== '{}';

  useEffect(() => {
    const timer = setTimeout(() => setAppliedFiltersKey(filtersKey), FILTER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filtersKey]);

  const load = useCallback(async (append = false) => {
    lastLoadRef.current = { key: `${view}:${appliedFiltersKey}`, at: Date.now() };
    setBusy(true);
    setError(false);
    const hasCopy = () =>
      view === 'Timeline'
        ? readQueryCache(CACHE.timeline) != null && !hasFilters
        : view === 'Topics'
          ? readQueryCache(CACHE.topics) != null
          : view === 'People & Things'
            ? readQueryCache(CACHE.entities) != null
            : readQueryCache(CACHE.projects) != null;
    try {
      const token = await getToken();
      if (!token) return;
      if (view === 'Timeline') {
        const { observationType, ...queryFilters } = filtersRef.current;
        const pageCursor = append ? cursorRef.current : null;
        if (append && !pageCursor) return;
        const page = await fetchObservationsPage(token, {
          ...queryFilters,
          limit: 20,
          ...(pageCursor ? { cursor: pageCursor } : {}),
        });
        const pageItems = (
          observationType ? page.items.filter((item) => item.type === observationType) : page.items
        ).map(withoutExtractedText);
        setItems((old) => (append ? [...old, ...pageItems] : pageItems));
        cursorRef.current = page.nextCursor;
        setCursor(page.nextCursor);
        if (!append && !hasFilters) writeQueryCache(CACHE.timeline, pageItems);
      } else if (view === 'Topics') {
        const rows = (await fetchTopics({ token, limit: 40 })).items;
        setTopics(rows);
        writeQueryCache(CACHE.topics, rows);
      } else if (view === 'People & Things') {
        const rows = (await fetchEntities({ token, limit: 80 })).items;
        setEntities(rows);
        writeQueryCache(CACHE.entities, rows);
      } else {
        const rows = (await fetchProjects({ token, limit: 40 })).items;
        setProjects(rows);
        writeQueryCache(CACHE.projects, rows);
      }
    } catch {
      if (append || !hasCopy()) setError(!append);
    } finally {
      setBusy(false);
    }
  }, [getToken, view, appliedFiltersKey, hasFilters]);

  useFocusEffect(
    useCallback(() => {
      const last = lastLoadRef.current;
      const key = `${view}:${appliedFiltersKey}`;
      if (!last || last.key !== key || isStale(last.at, FOCUS_REFRESH_MS)) void load();
    }, [load, view, appliedFiltersKey]),
  );

  useEffect(() => onReconnect(() => void load()), [load]);

  useEffect(() => {
    void getToken().then(async (token) => {
      if (!token) return;
      try {
        const rows = (await fetchProjects({ token, limit: 40 })).items;
        setProjects(rows);
        writeQueryCache(CACHE.projects, rows);
      } catch {
        /* Optional */
      }
    });
  }, [getToken]);

  const runSearch = async () => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    try {
      const token = await getToken();
      if (!token) return;
      const result = await semanticSearch({
        token,
        query: query.trim(),
        filters: buildSemanticFilters(filters),
      });
      setSearchResults(result.results);
    } catch (cause) {
      Alert.alert(
        'Search unavailable',
        isNetworkError(cause)
          ? 'Search needs a connection. Your saved memories are still listed below.'
          : 'Please try again.',
      );
    }
  };

  const askCurrent = () =>
    router.push({
      pathname: '/(app)/(tabs)/ask',
      params: {
        scopeType: 'filters',
        scopeName: 'Current filters',
        filterScope: JSON.stringify(buildSemanticFilters(filters)),
      },
    });

  const toggleScopeFilter = (choice: { id: string; name: string; type: 'topic' | 'entity' | 'project' }) =>
    setFilters((old) => toggleLibraryScopeFilter(old, choice));

  const openFilters = async () => {
    setFilterOpen(true);
    try {
      const token = await getToken();
      if (!token) return;
      const [topicRows, entityRows, projectRows] = await Promise.all([
        fetchTopics({ token, limit: 40 }),
        fetchEntities({ token, limit: 80 }),
        fetchProjects({ token, limit: 40 }),
      ]);
      setFilterChoices([
        ...topicRows.items.map((item) => ({ id: item.id, name: item.name, type: 'topic' as const })),
        ...entityRows.items.map((item) => ({ id: item.id, name: item.name, type: 'entity' as const })),
        ...projectRows.items.map((item) => ({ id: item.id, name: item.name, type: 'project' as const })),
      ]);
      setProjects(projectRows.items);
    } catch {
      setFilterChoices([]);
    }
  };

  const toggle = (id: string, entering = false) => {
    void (entering
      ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      : Haptics.selectionAsync());
    setSelected((old) => (old.includes(id) ? old.filter((item) => item !== id) : [...old, id]));
  };

  const bulkDelete = () =>
    Alert.alert('Delete memories?', `Delete ${selected.length} selected memories?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await getToken();
            if (!token) return;
            await Promise.all(selected.map((id) => deleteObservation(token, id)));
            invalidateObservationCaches(selected);
            setSelected([]);
            void load();
          } catch {
            setError(true);
          }
        },
      },
    ]);

  const bulkReprocess = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      await Promise.all(selected.map((id) => reprocessObservation(token, id)));
      setSelected([]);
      void load();
    } catch {
      setError(true);
    }
  };

  const addToProject = async (projectId: string) => {
    try {
      const token = await getToken();
      if (!token) return;
      await addObservationsToProjectBulk({ token, projectId, observationIds: selected });
      setSelected([]);
      setProjectPicker(false);
    } catch {
      Alert.alert('Could not add memories', 'Please try again.');
    }
  };

  const memoryRow = (item: ApiObservation | ApiSemanticSearchResult, index: number) => {
    const isSearch = 'chunkId' in item;
    const id = isSearch ? item.observationId : item.id;
    const title = isSearch ? item.observation.filename : item.filename;
    const memType = isSearch ? 'DOCUMENT' : item.type;
    const iconName = MEM_ICONS[memType] ?? 'description';

    return (
      <Animated.View key={`${id}-${isSearch ? item.chunkId : ''}`} entering={itemEntering(index)}>
      <Pressable
        onPress={() =>
          selected.length
            ? toggle(id)
            : router.push({
                pathname: '/(app)/observation/[id]',
                params: { id, ...(isSearch ? { chunkId: item.chunkId, snippet: item.content } : {}) },
              })
        }
        onLongPress={() => toggle(id, selected.length === 0)}
        accessibilityRole="button"
        accessibilityLabel={`${selected.includes(id) ? 'Deselect' : 'Open'} ${title}`}
        style={({ pressed }) => [
          styles.rowCard,
          {
            backgroundColor: selected.includes(id) ? colors.primaryContainer : colors.surfaceElevated,
            borderColor: selected.includes(id) ? colors.primary : colors.border,
            borderRadius: radius.lg,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
      >
        {selected.length > 0 ? (
          <MaterialIcons
            name={selected.includes(id) ? 'check-circle' : 'radio-button-unchecked'}
            size={22}
            color={selected.includes(id) ? colors.primary : colors.textMuted}
          />
        ) : (
          <View style={[styles.itemIconWrap, { backgroundColor: colors.primaryContainer, borderRadius: radius.full }]}>
            <MaterialIcons name={iconName} size={18} color={colors.primary} />
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText colorKey="text" style={styles.rowTitle} numberOfLines={1}>
            {title}
          </ThemedText>
          <ThemedText colorKey="textSecondary" numberOfLines={2} style={styles.rowSummary}>
            {isSearch ? item.content : item.summary || item.sourceLabel || item.status}
          </ThemedText>
        </View>
        <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
      </Pressable>
      </Animated.View>
    );
  };

  const currentCount =
    view === 'Timeline'
      ? (searchResults ?? items).length
      : view === 'Topics'
        ? topics.length
        : view === 'Projects'
          ? projects.length
          : entities.length;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
      {/* Search Input Bar */}
      <View
        style={[
          styles.searchBar,
          {
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.border,
            borderRadius: radius.full,
          },
        ]}
      >
        <MaterialIcons name="search" size={22} color={colors.primary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => void runSearch()}
          placeholder="Search your memories, topics, thoughts…"
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          style={[styles.input, { color: colors.text }]}
          accessibilityLabel="Search your memories"
        />
        {query ? (
          <Pressable onPress={() => { setQuery(''); setSearchResults(null); }} hitSlop={8}>
            <MaterialIcons name="close" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => void openFilters()}
          accessibilityRole="button"
          accessibilityLabel="Open search filters"
          style={[styles.filterBtn, { backgroundColor: hasFilters ? colors.primaryContainer : 'transparent', borderRadius: radius.full }]}
        >
          <MaterialIcons name="tune" size={20} color={hasFilters ? colors.primary : colors.text} />
        </Pressable>
      </View>

      {/* Applied filter chips */}
      {Object.entries(filters)
        .filter(([key]) => key !== 'to' && !(key === 'topic' && filters.topicId) && !(key === 'entity' && filters.entityId))
        .map(([key, value]) =>
          value ? (
            <Pressable
              key={key}
              onPress={() => setFilters((old) => removeLibraryFilter(old, key as keyof LibraryFilters))}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${key} filter`}
              style={[styles.filterChip, { borderColor: colors.borderAccent, backgroundColor: colors.primaryContainer, borderRadius: radius.full }]}
            >
              <ThemedText colorKey="primary" style={{ fontSize: 12, fontWeight: '600' }}>
                {key === 'source'
                  ? SEARCH_SOURCE_OPTIONS.find((source) => source.value === value)?.label || value
                  : key === 'from' && filters.to
                    ? 'Custom date range'
                    : filterChoices.find((item) => item.id === value)?.name || value}
              </ThemedText>
              <MaterialIcons name="close" size={14} color={colors.primary} />
            </Pressable>
          ) : null,
        )}

      {/* View Kind Segments */}
      <View style={styles.segments}>
        {VIEWS.map((label) => (
          <Pressable
            key={label}
            onPress={() => {
              if (view !== label) void Haptics.selectionAsync();
              setView(label);
              setSearchResults(null);
              setSelected([]);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: view === label }}
            accessibilityLabel={label}
            style={[
              styles.segment,
              {
                borderRadius: radius.full,
                backgroundColor: view === label ? colors.primary : colors.surfaceElevated,
                borderColor: view === label ? colors.primary : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                {
                  color: view === label ? colors.onPrimary : colors.textSecondary,
                  fontFamily: view === label ? 'Roboto_700Bold' : 'Roboto_500Medium',
                },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Ask about current filter banner */}
      {view === 'Timeline' || searchResults ? (
        <PressScale onPress={askCurrent} accessibilityLabel="Ask about current search and filters">
          <View
            style={[
              styles.askBanner,
              {
                backgroundColor: colors.primaryContainer,
                borderColor: colors.borderAccent,
                borderRadius: radius.lg,
              },
            ]}
          >
            <View style={styles.askBannerContent}>
              <MaterialIcons name="auto-awesome" size={18} color={colors.primary} />
              <ThemedText colorKey="primary" style={styles.askBannerText}>
                Ask Kairos about these memories
              </ThemedText>
            </View>
            <MaterialIcons name="arrow-forward" size={18} color={colors.primary} />
          </View>
        </PressScale>
      ) : null}

      {/* Bulk actions header */}
      {selected.length ? (
        <Animated.View
          entering={FadeInDown.springify().damping(16).reduceMotion(ReduceMotion.System)}
          exiting={FadeOutUp.duration(160).reduceMotion(ReduceMotion.System)}
          style={[
            styles.actions,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.borderAccent,
              borderRadius: radius.lg,
            },
          ]}
        >
          <ThemedText colorKey="text" style={{ fontWeight: '700' }}>
            {selected.length} selected
          </ThemedText>
          <Pressable onPress={() => setProjectPicker(true)} accessibilityRole="button" accessibilityLabel="Add selected memories to a project">
            <ThemedText colorKey="primary" style={{ fontWeight: '600' }}>
              Project
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => void bulkReprocess()} accessibilityRole="button" accessibilityLabel="Reprocess selected memories">
            <ThemedText colorKey="primary" style={{ fontWeight: '600' }}>
              Reprocess
            </ThemedText>
          </Pressable>
          <Pressable onPress={bulkDelete} accessibilityRole="button" accessibilityLabel="Delete selected memories">
            <ThemedText colorKey="error" style={{ fontWeight: '600' }}>
              Delete
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => setSelected([])} accessibilityRole="button" accessibilityLabel="Clear selection" hitSlop={8}>
            <MaterialIcons name="close" size={18} color={colors.textMuted} />
          </Pressable>
        </Animated.View>
      ) : null}

      {/* Content area */}
      {error ? (
        <ErrorState title="Library unavailable" onRetry={() => void load()} />
      ) : busy && currentCount === 0 ? (
        <LoadingSkeleton rows={6} label="Kairos is organizing your knowledge space…" />
      ) : view === 'Timeline' ? (
        <FlatList<ApiObservation | ApiSemanticSearchResult>
          data={searchResults ?? items}
          keyExtractor={(item, index) => ('chunkId' in item ? `${item.chunkId}-${index}` : item.id)}
          renderItem={({ item, index }) => memoryRow(item, index)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + FLOATING_TAB_BAR_CONTENT + 24, gap: 8 }}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={7}
          updateCellsBatchingPeriod={50}
          onEndReached={() => {
            if (!searchResults && cursor) void load(true);
          }}
          onEndReachedThreshold={0.6}
          ListHeaderComponent={
            items.length > 0 && !searchResults && !hasFilters ? (
              <ThemedText colorKey="textMuted" style={styles.countLine}>
                {items.length}
                {cursor ? '+' : ''} {items.length === 1 ? 'memory' : 'memories'} kept
              </ThemedText>
            ) : null
          }
          ListEmptyComponent={
            searchResults || hasFilters ? (
              <EmptyState
                icon="search-off"
                title="Nothing matches yet"
                message="Try fewer words, or ask Kairos in plain language."
                actionLabel="Ask Kairos"
                onAction={() =>
                  router.push({ pathname: '/(app)/(tabs)/ask', params: query.trim() ? { q: query.trim() } : {} })
                }
              />
            ) : (
              <EmptyState
                icon="auto-stories"
                title="Your library starts here"
                message="Every note, link, and voice memo you save lands here, connected by topic and time."
                actionLabel="Capture something"
                onAction={() => router.push('/(app)/quick-capture')}
              />
            )
          }
        />
      ) : (
        <FlatList<ApiTopicSummary | ApiProjectSummary | ApiEntitySummary>
          data={
            view === 'Topics'
              ? topics
              : view === 'Projects'
                ? projects
                : [...entities].sort((a, b) => a.type.localeCompare(b.type))
          }
          keyExtractor={(item) => item.id}
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={7}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + FLOATING_TAB_BAR_CONTENT + 24, gap: 8 }}
          ListEmptyComponent={
            <EmptyState
              icon={view === 'Topics' ? 'sell' : view === 'Projects' ? 'folder-open' : 'hub'}
              title={view === 'Projects' ? 'No projects yet' : `No ${view.toLowerCase()} yet`}
              message={
                view === 'Projects'
                  ? 'Group related memories into a project to ask about them together.'
                  : 'Kairos finds these on its own as you capture more.'
              }
              actionLabel={view === 'Projects' ? 'New project' : 'Capture something'}
              onAction={() => router.push(view === 'Projects' ? '/(app)/projects/new' : '/(app)/quick-capture')}
            />
          }
          renderItem={({ item, index }) => {
            const title = item.name;
            const meta = 'observationCount' in item ? `${item.observationCount} memories` : '';
            const route =
              view === 'Topics'
                ? `/(app)/topics/${item.id}`
                : view === 'Projects'
                  ? `/(app)/projects/${item.id}`
                  : `/(app)/entities/${item.id}`;
            const scopeType = view === 'Topics' ? 'topic' : view === 'Projects' ? 'project' : 'entity';
            const iconName =
              view === 'Topics'
                ? 'tag'
                : view === 'Projects'
                  ? 'folder'
                  : 'type' in item
                    ? ENTITY_ICONS[item.type]
                    : 'category';

            return (
              <Animated.View entering={itemEntering(index)}>
              <PressScale onPress={() => router.push(route as never)} accessibilityLabel={`Open ${title}`}>
                <View
                  style={[
                    styles.rowCard,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.border,
                      borderRadius: radius.lg,
                    },
                  ]}
                >
                  <View style={[styles.itemIconWrap, { backgroundColor: colors.primaryContainer, borderRadius: radius.full }]}>
                    <MaterialIcons name={iconName} size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <ThemedText colorKey="text" style={styles.rowTitle}>
                      {title}
                    </ThemedText>
                    <ThemedText colorKey="textSecondary" style={styles.rowSummary}>
                      {meta}
                      {'type' in item ? ` · ${item.type.toLowerCase()}` : ''}
                    </ThemedText>
                  </View>
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: '/(app)/(tabs)/ask',
                        params: { scopeType, scopeId: item.id, scopeName: title },
                      })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Ask about ${title}`}
                    style={[styles.askIconBtn, { backgroundColor: colors.surfaceContainer, borderRadius: radius.full }]}
                  >
                    <MaterialIcons name="chat-bubble-outline" size={16} color={colors.primary} />
                  </Pressable>
                </View>
              </PressScale>
              </Animated.View>
            );
          }}
        />
      )}

      {/* Filter Modal */}
      <Modal visible={filterOpen} transparent animationType="slide" onRequestClose={() => setFilterOpen(false)}>
        <Pressable
          onPress={(event) => {
            if (event.target === event.currentTarget) setFilterOpen(false);
          }}
          style={[styles.scrim, { backgroundColor: colors.scrim }]}
        >
          <View style={[styles.sheet, { backgroundColor: colors.surfaceElevated }]}>
            <ThemedText colorKey="text" style={styles.sheetTitle}>
              Filter Memories
            </ThemedText>
            <ThemedText colorKey="textSecondary" style={{ fontWeight: '600' }}>
              Format
            </ThemedText>
            <View style={styles.wrap}>
              {TYPES.map((type) => (
                <Pressable
                  key={type}
                  onPress={() =>
                    setFilters((old) => ({
                      ...old,
                      observationType: old.observationType === type ? undefined : type,
                    }))
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Filter by ${type}`}
                  style={[
                    styles.filterChip,
                    {
                      borderColor: filters.observationType === type ? colors.primary : colors.border,
                      backgroundColor: filters.observationType === type ? colors.primaryContainer : colors.surface,
                      borderRadius: radius.full,
                    },
                  ]}
                >
                  <ThemedText colorKey={filters.observationType === type ? 'primary' : 'text'}>
                    {type}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
            <ThemedText colorKey="textSecondary" style={{ fontWeight: '600' }}>
              Source
            </ThemedText>
            <View style={styles.wrap}>
              {SEARCH_SOURCE_OPTIONS.map((source) => (
                <Pressable
                  key={source.value}
                  onPress={() =>
                    setFilters((old) => ({
                      ...old,
                      source: old.source === source.value ? undefined : (source.value as CaptureSource),
                    }))
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Filter by ${source.label}`}
                  style={[
                    styles.filterChip,
                    {
                      borderColor: filters.source === source.value ? colors.primary : colors.border,
                      backgroundColor: filters.source === source.value ? colors.primaryContainer : colors.surface,
                      borderRadius: radius.full,
                    },
                  ]}
                >
                  <ThemedText colorKey={filters.source === source.value ? 'primary' : 'text'}>
                    {source.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
            <ThemedText colorKey="textSecondary" style={{ fontWeight: '600' }}>
              Timeframe
            </ThemedText>
            <View style={styles.wrap}>
              {SEARCH_DATE_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => setFilters((old) => ({ ...old, ...dateRangeForPreset(option.value) }))}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter by ${option.label}`}
                  style={[styles.filterChip, { borderColor: colors.border, borderRadius: radius.full }]}
                >
                  <ThemedText colorKey="text">{option.label}</ThemedText>
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={() => {
                setFilters({});
                setFilterOpen(false);
              }}
              accessibilityRole="button"
              accessibilityLabel="Clear all filters"
            >
              <ThemedText colorKey="textSecondary" style={styles.done}>
                Clear filters
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => {
                setFilterOpen(false);
                setAppliedFiltersKey(filtersKey);
              }}
              accessibilityRole="button"
              accessibilityLabel="Apply filters"
            >
              <ThemedText colorKey="primary" style={[styles.done, { fontWeight: '700' }]}>
                Apply filters
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Project Picker Modal */}
      <Modal visible={projectPicker} transparent animationType="slide" onRequestClose={() => setProjectPicker(false)}>
        <Pressable style={[styles.scrim, { backgroundColor: colors.scrim }]} onPress={() => setProjectPicker(false)}>
          <View style={[styles.sheet, { backgroundColor: colors.surfaceElevated }]}>
            <ThemedText colorKey="text" style={styles.sheetTitle}>
              Add to project
            </ThemedText>
            {projects.map((project) => (
              <Pressable
                key={project.id}
                onPress={() => void addToProject(project.id)}
                accessibilityRole="button"
                accessibilityLabel={`Add selected memories to ${project.name}`}
                style={[styles.projectOption, { borderColor: colors.border }]}
              >
                <ThemedText colorKey="text" style={{ fontSize: 16, fontWeight: '500' }}>
                  {project.name}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  searchBar: {
    marginHorizontal: 16,
    minHeight: 48,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    fontFamily: 'Roboto_400Regular',
    fontSize: 15,
  },
  filterBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 6,
    marginLeft: 16,
  },
  segments: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  segment: {
    flex: 1,
    minHeight: 36,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  segmentText: {
    fontSize: 11,
    textAlign: 'center',
  },
  askBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  askBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  askBannerText: {
    fontFamily: 'Roboto_600SemiBold',
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderWidth: 1,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    gap: 12,
  },
  itemIconWrap: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontFamily: 'Roboto_600SemiBold',
    fontSize: 15,
  },
  rowSummary: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 13,
    lineHeight: 18,
  },
  askIconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countLine: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    gap: 10,
    maxHeight: '85%',
  },
  sheetTitle: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 20,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  done: {
    textAlign: 'center',
    padding: 12,
    fontSize: 15,
  },
  projectOption: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
