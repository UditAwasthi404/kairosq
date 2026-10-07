import { useAuth } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { itemEntering, PressScale } from '../../components/ui/Motion';

import { SoftPage } from '../../components/ui/SoftScreen';
import { GlassPanel } from '../../components/ui/Glass';
import {
  EmptyState,
  FadeInContent,
  LoadingSkeleton,
  SoftRefreshBar,
} from '../../components/ui/EmptyState';
import { TopicChip } from '../../components/ui/MemoryCards';
import { ThemedButton } from '../../components/ui/ThemedButton';
import { ThemedInput } from '../../components/ui/ThemedInput';
import { ThemedText } from '../../components/ThemedText';
import {
  ApiError,
  fetchProjects,
  fetchTopics,
  semanticSearch,
  type ApiProjectSummary,
  type ApiSemanticSearchResponse,
  type CaptureSource,
  type ApiTopicSummary,
} from '../../lib/api';
import { inferSearchHints } from '../../lib/searchHints';
import {
  SEARCH_DATE_OPTIONS,
  SEARCH_SOURCE_OPTIONS,
  dateRangeForPreset,
  searchDateLabel,
  searchSourceLabel,
  type SearchDatePreset,
} from '../../lib/searchFilters';
import { InsightCard as SuggestionCard } from '../../components/ui/system/InsightCard';
import { useAppTheme } from '../../providers/ThemeProvider';

const EXAMPLE_QUERIES = ['last week', 'ideas I had', 'books', 'meetings yesterday'];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export default function SearchScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { getToken } = useAuth();
  const params = useLocalSearchParams<{
    topicId?: string;
    topicName?: string;
    entityId?: string;
    entityName?: string;
    projectId?: string;
    projectName?: string;
  }>();

  const [query, setQuery] = useState('');
  const [topics, setTopics] = useState<ApiTopicSummary[]>([]);
  const [projects, setProjects] = useState<ApiProjectSummary[]>([]);
  const [projectId, setProjectId] = useState<string | undefined>(
    typeof params.projectId === 'string' ? params.projectId : undefined,
  );
  const [topicId, setTopicId] = useState<string | undefined>(
    typeof params.topicId === 'string' ? params.topicId : undefined,
  );
  const [entityId, setEntityId] = useState<string | undefined>(
    typeof params.entityId === 'string' ? params.entityId : undefined,
  );
  const [source, setSource] = useState<CaptureSource | undefined>();
  const [datePreset, setDatePreset] = useState<SearchDatePreset | undefined>();
  const [openPanel, setOpenPanel] = useState<'source' | 'date' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiSemanticSearchResponse | null>(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const [topicData, projectData] = await Promise.all([
          fetchTopics({ token, limit: 20 }),
          fetchProjects({ token, limit: 20 }),
        ]);
        setTopics(topicData.items);
        setProjects(projectData.items);
      } catch {
        /* optional */
      }
    })();
  }, [getToken]);

  const runSearch = async (q: string = query) => {
    const trimmed = q.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const token = await getToken();
      if (!token) throw new ApiError('Sign in required.', 401);
      const hints = inferSearchHints(trimmed);
      const dates = datePreset ? dateRangeForPreset(datePreset) : undefined;
      const response = await semanticSearch({
        token,
        query: hints.query,
        limit: 10,
        filters: {
          projectId,
          topicId,
          entityId,
          from: dates?.from ?? hints.from,
          to: dates?.to ?? hints.to,
          source: source ?? hints.source,
        },
      });
      const labels = [
        ...hints.labels,
        source ? searchSourceLabel(source) : null,
        datePreset ? searchDateLabel(datePreset) : null,
      ].filter(Boolean);
      setResult({
        ...response,
        query: labels.join(' · ') || response.query,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FadeInContent>
      <SoftPage>
        <View style={styles.searchRow}>
          <View style={styles.inputWrap}>
            <ThemedInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search memories..."
              accessibilityLabel="Search"
              returnKeyType="search"
              onSubmitEditing={() => void runSearch()}
            />
          </View>
          <Pressable
            disabled={loading || query.trim().length === 0}
            onPress={() => void runSearch()}
            style={({ pressed }) => [
              styles.searchBtn,
              {
                backgroundColor: colors.buttonFill,
                opacity: loading || !query.trim() ? 0.4 : pressed ? 0.85 : 1,
              },
            ]}
            accessibilityLabel="Search"
          >
            <Feather name="search" size={18} color={colors.buttonText} />
          </Pressable>
        </View>

        {!searched ? (
          <SuggestionCard message="Search notes, topics, and projects Kairos already remembers." />
        ) : null}

        {!searched ? (
          <View style={styles.examples}>
            {EXAMPLE_QUERIES.map((example) => (
              <TopicChip
                key={example}
                label={example}
                onPress={() => {
                  setQuery(example);
                  void runSearch(example);
                }}
              />
            ))}
          </View>
        ) : null}

        <View style={styles.filterLaunch}>
          <TopicChip
            label={source ? searchSourceLabel(source) : 'Source'}
            selected={!!source || openPanel === 'source'}
            onPress={() =>
              setOpenPanel((current) => (current === 'source' ? null : 'source'))
            }
          />
          <TopicChip
            label={datePreset ? searchDateLabel(datePreset) : 'Date'}
            selected={!!datePreset || openPanel === 'date'}
            onPress={() =>
              setOpenPanel((current) => (current === 'date' ? null : 'date'))
            }
          />
        </View>

        {openPanel === 'source' ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {SEARCH_SOURCE_OPTIONS.map((option) => (
              <TopicChip
                key={option.value}
                label={option.label}
                selected={source === option.value}
                onPress={() => {
                  setSource((current) =>
                    current === option.value ? undefined : option.value,
                  );
                }}
              />
            ))}
          </ScrollView>
        ) : null}

        {openPanel === 'date' ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {SEARCH_DATE_OPTIONS.map((option) => (
              <TopicChip
                key={option.value}
                label={option.label}
                selected={datePreset === option.value}
                onPress={() => {
                  setDatePreset((current) =>
                    current === option.value ? undefined : option.value,
                  );
                }}
              />
            ))}
          </ScrollView>
        ) : null}

        {source || datePreset ? (
          <View style={styles.activeRow}>
            {source ? (
              <Pressable
                onPress={() => setSource(undefined)}
                style={[styles.activeChip, { backgroundColor: colors.accentGlow }]}
                accessibilityLabel={`Clear ${searchSourceLabel(source)}`}
              >
                <ThemedText colorKey="accent" style={styles.activeChipText}>
                  {searchSourceLabel(source)}
                </ThemedText>
                <Feather name="x" size={12} color={colors.accent} />
              </Pressable>
            ) : null}
            {datePreset ? (
              <Pressable
                onPress={() => setDatePreset(undefined)}
                style={[styles.activeChip, { backgroundColor: colors.accentGlow }]}
                accessibilityLabel={`Clear ${searchDateLabel(datePreset)}`}
              >
                <ThemedText colorKey="accent" style={styles.activeChipText}>
                  {searchDateLabel(datePreset)}
                </ThemedText>
                <Feather name="x" size={12} color={colors.accent} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <TopicChip
            label="All"
            selected={!projectId && !topicId && !entityId}
            onPress={() => {
              setProjectId(undefined);
              setTopicId(undefined);
              setEntityId(undefined);
            }}
          />
          {projects.map((project) => (
            <TopicChip
              key={project.id}
              label={project.name}
              selected={projectId === project.id}
              onPress={() => {
                setProjectId(project.id);
                setTopicId(undefined);
                setEntityId(undefined);
              }}
            />
          ))}
          {topics.map((topic) => (
            <TopicChip
              key={topic.id}
              label={topic.name}
              selected={topicId === topic.id}
              onPress={() => {
                setTopicId(topic.id);
                setProjectId(undefined);
                setEntityId(undefined);
              }}
            />
          ))}
        </ScrollView>

        <SoftRefreshBar active={loading && !!result} />
        {loading && !result ? <LoadingSkeleton rows={4} label="Searching your memories" /> : null}

        {error ? (
          <GlassPanel>
            <ThemedText colorKey="error" style={styles.error}>
              {error}
            </ThemedText>
            <ThemedButton label="Retry" variant="outline" onPress={() => void runSearch()} />
          </GlassPanel>
        ) : null}

        {searched && !loading && result && result.results.length === 0 ? (
          <EmptyState
            icon="search-off"
            title="Nothing matched that memory"
            message="Try fewer words, or let Kairos answer from everything you have saved."
            actionLabel="Ask Kairos instead"
            onAction={() => router.push({ pathname: '/(app)/(tabs)/ask', params: { q: query.trim() } })}
          />
        ) : null}

        {result && result.results.length > 0 ? (
          <View style={{ opacity: loading ? 0.72 : 1, gap: 12 }}>
            <ThemedText colorKey="textMuted" style={styles.count}>
              {result.results.length} {result.results.length === 1 ? 'match' : 'matches'}
            </ThemedText>
            {result.results.map((item, index) => (
              <Animated.View key={item.chunkId} entering={itemEntering(index)}>
              <PressScale
                onPress={() => {
                  void Haptics.selectionAsync();
                  router.push({
                    pathname: '/(app)/observation/[id]',
                    params: {
                      id: item.observationId,
                      highlight: item.content.slice(0, 240),
                    },
                  });
                }}
                accessibilityLabel={item.observation.filename}
              >
                <GlassPanel padded={false} contentStyle={styles.result}>
                  <ThemedText colorKey="textMuted" style={styles.meta}>
                    Matched · {formatDate(item.observation.capturedAt)}
                    {result.query ? ` · ${result.query}` : ''}
                  </ThemedText>
                  <ThemedText colorKey="text" style={styles.title} numberOfLines={1}>
                    {item.observation.filename}
                  </ThemedText>
                  <ThemedText colorKey="textMuted" style={styles.snippet} numberOfLines={3}>
                    {item.content}
                  </ThemedText>
                </GlassPanel>
              </PressScale>
              </Animated.View>
            ))}
          </View>
        ) : null}
      </SoftPage>
    </FadeInContent>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputWrap: { flex: 1 },
  searchBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterLaunch: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chips: { gap: 8, paddingVertical: 2 },
  activeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  activeChipText: { fontFamily: 'Roboto_500Medium', fontSize: 12 },
  result: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  meta: { fontFamily: 'Roboto_400Regular', fontSize: 11 },
  title: { fontFamily: 'Roboto_500Medium', fontSize: 15 },
  snippet: { fontFamily: 'Roboto_400Regular', fontSize: 13, lineHeight: 18, marginTop: 4 },
  error: { fontFamily: 'Roboto_400Regular', fontSize: 13 },
  count: { fontFamily: 'Roboto_500Medium', fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase' },
  examples: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
