import type {
  AppNotification,
  AppSettings,
  AskMessage,
  AskResponse,
  CaptureInput,
  CaptureResult,
  Device,
  HomeSummary,
  Memory,
  MemoryDetail,
  Observation,
  ProcessingJob,
  Project,
  ProjectDetail,
  SearchFilters,
  SearchResponse,
  TimelinePage,
  Topic,
  TopicDetail,
} from '../types';
import { SOURCE_TYPE_LABELS, getSourceForMemory, getStore } from './mock/store';
import { delay, isoDaysAgo } from './utils';

export { SOURCE_TYPE_LABELS };

function assertNotForcedError(): void {
  if (getStore().forceError) {
    throw new Error('Mock network error');
  }
}

function memoriesSorted(): Memory[] {
  return [...getStore().memories].sort(
    (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime(),
  );
}

function dateLabel(dateKey: string): string {
  const today = isoDaysAgo(0).slice(0, 10);
  const yesterday = isoDaysAgo(1).slice(0, 10);
  if (dateKey === today) return 'Today';
  if (dateKey === yesterday) return 'Yesterday';
  const d = new Date(`${dateKey}T12:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function snippetFrom(memory: Memory, query: string): string {
  const q = query.trim().toLowerCase();
  const hay = `${memory.title}. ${memory.summary}`;
  if (!q) return memory.summary.slice(0, 140);
  const idx = hay.toLowerCase().indexOf(q.split(/\s+/)[0] ?? q);
  if (idx < 0) return memory.summary.slice(0, 140);
  const start = Math.max(0, idx - 40);
  return `${start > 0 ? '…' : ''}${hay.slice(start, start + 140)}…`;
}

function scoreMemory(memory: Memory, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const title = memory.title.toLowerCase();
  const summary = memory.summary.toLowerCase();
  let score = 0;
  for (const token of q.split(/\s+/).filter(Boolean)) {
    if (title.includes(token)) score += 3;
    if (summary.includes(token)) score += 1;
  }
  if (title.includes(q)) score += 5;
  return score + (memory.favorite ? 0.5 : 0);
}

const KNOWN_ASK: {
  match: RegExp;
  answer: string;
  sourceIds: string[];
  followUps: string[];
  insufficient?: boolean;
}[] = [
  {
    match: /last tuesday|tuesday/i,
    answer:
      'You spent most of Tuesday working on the Kairos retrieval pipeline — architecture notes, backend planning, and privacy controls showed up together. Supporting memories below are from your library, not external citations.',
    sourceIds: ['mem-7', 'mem-9', 'mem-3'],
    followUps: [
      'What decisions did I make about NestJS modules?',
      'Show privacy-related memories',
      'What was I learning about RAG?',
    ],
  },
  {
    match: /rag|retrieval/i,
    answer:
      'You were studying RAG evaluation, vector search, and reranking. Your notes emphasize faithfulness, context precision, and using rerankers to lift top-k quality for personal memory ask flows.',
    sourceIds: ['mem-4', 'mem-5', 'mem-2', 'mem-11'],
    followUps: [
      'Compare embedding models I saved',
      'What metrics did I draft for Kairos ask?',
      'Show related memories to RAG Evaluation',
    ],
  },
  {
    match: /yesterday|working on/i,
    answer:
      'Yesterday you focused on Kairos API design — NestJS surfaces for observations, memories, search, and ask, with privacy export/delete treated as first-class endpoints.',
    sourceIds: ['mem-3', 'mem-9', 'mem-7'],
    followUps: [
      'Open Kairos API design',
      'What else is in the Kairos project?',
      'Any processing still running?',
    ],
  },
  {
    match: /machine learning|ml|transformer/i,
    answer:
      'Recent ML learning centered on transformer architectures, embedding model tradeoffs, and retrieval evaluation. Several sessions link college lecture material with Kairos product needs.',
    sourceIds: ['mem-1', 'mem-6', 'mem-8', 'mem-15'],
    followUps: [
      'Show my Learning ML project',
      'What did I save about embeddings?',
      'Open transformer research memory',
    ],
  },
  {
    match: /kairos/i,
    answer:
      'Across the last week, Kairos work spanned API design, the async capture pipeline, Expo navigation patterns, and privacy defaults. A weekly synthesis memory ties those threads together.',
    sourceIds: ['mem-16', 'mem-7', 'mem-3', 'mem-10'],
    followUps: [
      'Open the Kairos project',
      'What privacy controls did I sketch?',
      'Show architecture whiteboard',
    ],
  },
  {
    match: /last week|saved last week/i,
    answer:
      'Last week you saved OS coursework notes, a fitness recovery log, a reranking experiment plan, and a Kairos weekly synthesis. The densest cluster is still retrieval and product architecture.',
    sourceIds: ['mem-13', 'mem-14', 'mem-15', 'mem-16'],
    followUps: [
      'Filter to College topic',
      'Show Fitness memories',
      'What was I learning about RAG?',
    ],
  },
];

function buildAskMessage(query: string): AskMessage {
  const known = KNOWN_ASK.find((k) => k.match.test(query));
  const store = getStore();
  const now = new Date().toISOString();

  if (!known) {
    const ranked = memoriesSorted()
      .map((m) => ({ m, score: scoreMemory(m, query) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (ranked.length === 0) {
      return {
        id: `ask-${Date.now()}`,
        role: 'kairos',
        content:
          "I couldn't find enough supporting memories for a grounded answer. Try a more specific question, or capture related notes first.",
        createdAt: now,
        sources: [],
        followUps: [
          'What was I working on yesterday?',
          'Show me things related to Kairos',
          'What did I learn about machine learning?',
        ],
        insufficientEvidence: true,
      };
    }

    return {
      id: `ask-${Date.now()}`,
      role: 'kairos',
      content: `Based on memories in your library, here's what stands out for “${query.trim()}”. These are generated from your saved items — not external web citations.`,
      createdAt: now,
      sources: ranked.map(({ m }) => ({
        observationId: m.id,
        chunkId: `${m.id}-chunk`,
        memoryId: m.id,
        title: m.title,
        snippet: m.summary.slice(0, 110),
      })),
      followUps: [
        'Show related memories',
        'Open the top source',
        'What was I working on yesterday?',
      ],
    };
  }

  const sources = known.sourceIds
    .map((id) => store.memories.find((m) => m.id === id))
    .filter((m): m is Memory => Boolean(m))
    .map((m) => ({
      observationId: m.id,
      chunkId: `${m.id}-chunk`,
      memoryId: m.id,
      title: m.title,
      snippet: m.summary.slice(0, 110),
    }));

  return {
    id: `ask-${Date.now()}`,
    role: 'kairos',
    content: known.answer,
    createdAt: now,
    sources,
    followUps: known.followUps,
    insufficientEvidence: known.insufficient,
  };
}

export const memoriesService = {
  async list(): Promise<Memory[]> {
    await delay();
    assertNotForcedError();
    if (getStore().forceEmpty) return [];
    return memoriesSorted();
  },

  async get(id: string): Promise<MemoryDetail> {
    await delay(320);
    assertNotForcedError();
    const store = getStore();
    const memory = store.memories.find((m) => m.id === id);
    if (!memory) throw new Error('Memory not found');

    return {
      ...memory,
      topics: store.topics.filter((t) => memory.topicIds.includes(t.id)),
      projects: store.projects.filter((p) => memory.projectIds.includes(p.id)),
      entities: store.entities.filter((e) => memory.entityIds.includes(e.id)),
      relatedMemories: memory.relatedMemoryIds
        .map((rid) => store.memories.find((m) => m.id === rid))
        .filter((m): m is Memory => Boolean(m)),
      observations: store.observations.filter((o) => memory.observationIds.includes(o.id)),
      source: getSourceForMemory(memory.id),
    };
  },

  async getRelated(id: string): Promise<Memory[]> {
    await delay(300);
    assertNotForcedError();
    const detail = await this.get(id);
    return detail.relatedMemories;
  },

  async toggleFavorite(id: string): Promise<Memory> {
    await delay(250);
    const memory = getStore().memories.find((m) => m.id === id);
    if (!memory) throw new Error('Memory not found');
    memory.favorite = !memory.favorite;
    return { ...memory };
  },

  async remove(id: string): Promise<void> {
    await delay(350);
    const store = getStore();
    store.memories = store.memories.filter((m) => m.id !== id);
    store.observations = store.observations.map((o) => ({
      ...o,
      linkedMemoryIds: o.linkedMemoryIds.filter((mid) => mid !== id),
    }));
  },
};

export const timelineService = {
  async getPage(cursor: string | null = null, limit = 8): Promise<TimelinePage> {
    await delay(cursor ? 380 : 450);
    assertNotForcedError();
    if (getStore().forceEmpty) {
      return { groups: [], nextCursor: null, hasMore: false };
    }

    const all = memoriesSorted();
    const start = cursor ? all.findIndex((m) => m.id === cursor) + 1 : 0;
    const slice = all.slice(Math.max(0, start), Math.max(0, start) + limit);
    const map = new Map<string, Memory[]>();
    for (const memory of slice) {
      const key = memory.capturedAt.slice(0, 10);
      const bucket = map.get(key) ?? [];
      bucket.push(memory);
      map.set(key, bucket);
    }

    const groups = [...map.entries()].map(([dateKey, memories]) => ({
      dateKey,
      label: dateLabel(dateKey),
      memories,
    }));

    const last = slice[slice.length - 1];
    const nextIndex = start + slice.length;
    const hasMore = nextIndex < all.length;

    return {
      groups,
      nextCursor: hasMore && last ? last.id : null,
      hasMore,
    };
  },
};

export const searchService = {
  async search(query: string, filters: SearchFilters = {}): Promise<SearchResponse> {
    await delay(500 + Math.floor(Math.random() * 400));
    assertNotForcedError();
    const store = getStore();
    const q = query.trim();

    if (q) {
      store.recentSearches = [q, ...store.recentSearches.filter((s) => s !== q)].slice(0, 8);
    }

    let pool = memoriesSorted();
    if (filters.topicId) pool = pool.filter((m) => m.topicIds.includes(filters.topicId!));
    if (filters.projectId) pool = pool.filter((m) => m.projectIds.includes(filters.projectId!));
    if (filters.sourceType) pool = pool.filter((m) => m.sourceType === filters.sourceType);

    const results =
      q.length === 0
        ? []
        : pool
            .map((memory) => ({
              memory,
              snippet: snippetFrom(memory, q),
              score: scoreMemory(memory, q),
              matchedTopics: store.topics
                .filter((t) => memory.topicIds.includes(t.id))
                .map((t) => t.name),
            }))
            .filter((r) => r.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 20);

    return {
      query: q,
      results,
      total: results.length,
      recentSearches: [...store.recentSearches],
      suggestedSearches: [
        'What was I learning about RAG?',
        'Kairos API design',
        'transformer architectures',
        'vector databases',
        'privacy controls',
        'things related to Kairos',
      ],
    };
  },

  async suggestions(): Promise<{ recent: string[]; suggested: string[] }> {
    await delay(200);
    const res = await this.search('');
    return { recent: res.recentSearches, suggested: res.suggestedSearches };
  },
};

export const askService = {
  async ask(query: string, _conversationId?: string): Promise<AskResponse> {
    const latency = 500 + Math.floor(Math.random() * 700);
    await delay(latency);
    assertNotForcedError();

    const userMsg = {
      role: 'user' as const,
      content: query.trim(),
      createdAt: new Date().toISOString(),
    };
    getStore().askHistory.push(userMsg);

    const message = buildAskMessage(query);
    getStore().askHistory.push({
      role: 'kairos',
      content: message.content,
      createdAt: message.createdAt,
    });

    return { message };
  },

  async history(): Promise<AskMessage[]> {
    await delay(250);
    return getStore().askHistory.map((m, i) => ({
      id: `hist-${i}`,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    }));
  },
};

export const topicsService = {
  async list(): Promise<Topic[]> {
    await delay();
    assertNotForcedError();
    if (getStore().forceEmpty) return [];
    return [...getStore().topics].sort(
      (a, b) => new Date(b.recentActivityAt).getTime() - new Date(a.recentActivityAt).getTime(),
    );
  },

  async get(id: string): Promise<TopicDetail> {
    await delay(300);
    assertNotForcedError();
    const store = getStore();
    const topic = store.topics.find((t) => t.id === id);
    if (!topic) throw new Error('Topic not found');
    const memories = memoriesSorted().filter((m) => m.topicIds.includes(id));
    const relatedProjectIds = [
      ...new Set(memories.flatMap((m) => m.projectIds)),
    ];
    return { ...topic, memories, relatedProjectIds };
  },
};

export const projectsService = {
  async list(): Promise<Project[]> {
    await delay();
    assertNotForcedError();
    if (getStore().forceEmpty) return [];
    return [...getStore().projects].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  },

  async get(id: string): Promise<ProjectDetail> {
    await delay(320);
    assertNotForcedError();
    const store = getStore();
    const project = store.projects.find((p) => p.id === id);
    if (!project) throw new Error('Project not found');
    const memories = memoriesSorted().filter((m) => m.projectIds.includes(id));
    const topics = store.topics.filter((t) => project.topicIds.includes(t.id));
    const recentActivity = store.notifications
      .filter((n) => n.body.toLowerCase().includes(project.name.toLowerCase()) || n.href?.includes(id))
      .slice(0, 4);
    return { ...project, memories, topics, recentActivity };
  },
};

export const observationsService = {
  async get(id: string): Promise<Observation> {
    await delay(280);
    assertNotForcedError();
    const observation = getStore().observations.find((o) => o.id === id);
    if (!observation) throw new Error('Observation not found');
    return { ...observation };
  },

  async list(): Promise<Observation[]> {
    await delay();
    return [...getStore().observations].sort(
      (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime(),
    );
  },
};

export const captureService = {
  async capture(input: CaptureInput): Promise<CaptureResult> {
    await delay(400);
    assertNotForcedError();
    const store = getStore();
    const now = new Date().toISOString();
    const idSuffix = String(Date.now());
    const title =
      input.title?.trim() ||
      input.text?.trim()?.slice(0, 60) ||
      `Captured ${SOURCE_TYPE_LABELS[input.sourceType].toLowerCase()}`;

    const observation: Observation = {
      id: `obs-${idSuffix}`,
      title,
      sourceType: input.sourceType,
      capturedAt: now,
      status: 'PENDING',
      previewText: input.text?.trim() || input.url || `${SOURCE_TYPE_LABELS[input.sourceType]} capture`,
      linkedMemoryIds: [],
      sourceLabel: SOURCE_TYPE_LABELS[input.sourceType],
    };

    const job: ProcessingJob = {
      id: `job-${idSuffix}`,
      observationId: observation.id,
      title,
      sourceType: input.sourceType,
      stage: 'CAPTURED',
      startedAt: now,
      updatedAt: now,
      steps: [
        { id: 's1', label: 'Uploaded', status: 'queued' },
        { id: 's2', label: 'OCR', status: 'queued' },
        { id: 's3', label: 'Memory extraction', status: 'queued' },
        { id: 's4', label: 'Embedding', status: 'queued' },
      ],
    };

    store.observations.unshift(observation);
    store.jobs.unshift(job);

    return { observation, job };
  },

  async advanceJob(jobId: string): Promise<ProcessingJob> {
    await delay(550);
    const store = getStore();
    const job = store.jobs.find((j) => j.id === jobId);
    if (!job) throw new Error('Job not found');
    const observation = store.observations.find((o) => o.id === job.observationId);
    if (!observation) throw new Error('Observation not found');

    const pipeline: ProcessingJob['stage'][] = [
      'CAPTURED',
      'UPLOADING',
      'PROCESSING',
      'READY',
    ];
    const idx = pipeline.indexOf(job.stage);
    const next = pipeline[Math.min(idx + 1, pipeline.length - 1)]!;
    job.stage = next;
    job.updatedAt = new Date().toISOString();

    if (next === 'UPLOADING') {
      job.steps = job.steps.map((s) =>
        s.label === 'Uploaded' ? { ...s, status: 'running' } : s,
      );
      observation.status = 'PROCESSING';
    } else if (next === 'PROCESSING') {
      job.steps = job.steps.map((s) => {
        if (s.label === 'Uploaded') return { ...s, status: 'completed' };
        if (s.label === 'OCR') return { ...s, status: 'completed' };
        if (s.label === 'Memory extraction') return { ...s, status: 'running' };
        return s;
      });
      observation.status = 'PROCESSING';
      observation.extractedText =
        observation.extractedText ??
        `Extracted text from ${observation.sourceLabel.toLowerCase()}: ${observation.previewText}`;
    } else if (next === 'READY') {
      job.steps = job.steps.map((s) => ({ ...s, status: 'completed' }));
      observation.status = 'READY';
      observation.summary =
        observation.summary ??
        `Kairos created a memory from your ${observation.sourceLabel.toLowerCase()} capture.`;

      const memory: Memory = {
        id: `mem-${Date.now()}`,
        title: observation.title,
        summary: observation.summary,
        capturedAt: observation.capturedAt,
        createdAt: new Date().toISOString(),
        sourceType: observation.sourceType,
        topicIds: ['topic-projects', 'topic-personal'],
        projectIds: ['proj-kairos'],
        entityIds: [],
        relatedMemoryIds: store.memories.slice(0, 3).map((m) => m.id),
        observationIds: [observation.id],
        favorite: false,
        relevance: 0.8,
      };
      store.memories.unshift(memory);
      observation.linkedMemoryIds = [memory.id];
      job.resultMemoryId = memory.id;

      store.notifications.unshift({
        id: `ntf-${Date.now()}`,
        title: 'Memory created',
        body: `“${memory.title}” is ready.`,
        createdAt: new Date().toISOString(),
        read: false,
        href: `/(app)/memory/${memory.id}`,
      });

      for (const topic of store.topics) {
        topic.memoryCount = store.memories.filter((m) => m.topicIds.includes(topic.id)).length;
      }
      for (const project of store.projects) {
        project.memoryCount = store.memories.filter((m) => m.projectIds.includes(project.id)).length;
      }
    }

    return {
      ...job,
      steps: job.steps.map((s) => ({ ...s })),
    };
  },
};

export const processingService = {
  async listJobs(): Promise<ProcessingJob[]> {
    await delay();
    assertNotForcedError();
    return getStore().jobs.map((j) => ({
      ...j,
      steps: j.steps.map((s) => ({ ...s })),
    }));
  },

  async getJob(id: string): Promise<ProcessingJob> {
    await delay(250);
    const job = getStore().jobs.find((j) => j.id === id);
    if (!job) throw new Error('Job not found');
    return { ...job, steps: job.steps.map((s) => ({ ...s })) };
  },
};

export const notificationsService = {
  async list(): Promise<AppNotification[]> {
    await delay(300);
    assertNotForcedError();
    if (getStore().forceEmpty) return [];
    return [...getStore().notifications];
  },

  async markRead(id: string): Promise<void> {
    await delay(150);
    const n = getStore().notifications.find((x) => x.id === id);
    if (n) n.read = true;
  },
};

export const devicesService = {
  async list(): Promise<Device[]> {
    await delay(280);
    assertNotForcedError();
    return getStore().devices.map((d) => ({ ...d }));
  },
};

export const settingsService = {
  async get(): Promise<AppSettings> {
    await delay(220);
    return structuredClone(getStore().settings);
  },

  async update(patch: Partial<AppSettings>): Promise<AppSettings> {
    await delay(300);
    const store = getStore();
    store.settings = {
      ...store.settings,
      ...patch,
      ai: { ...store.settings.ai, ...(patch.ai ?? {}) },
      privacy: { ...store.settings.privacy, ...(patch.privacy ?? {}) },
      notifications: {
        ...store.settings.notifications,
        ...(patch.notifications ?? {}),
      },
    };
    return structuredClone(store.settings);
  },
};

export const dashboardService = {
  async getSummary(): Promise<HomeSummary> {
    await delay();
    assertNotForcedError();
    const store = getStore();
    if (store.forceEmpty) {
      return {
        greetingName: 'there',
        memoriesCreatedToday: 0,
        recentMemories: [],
        importantMemories: [],
        recentActivity: [],
        suggestedQuestions: [
          'What was I working on yesterday?',
          'What did I learn about machine learning?',
          'Show me things related to Kairos',
          'What did I save last week?',
        ],
        processingJobs: [],
        topics: [],
        projects: [],
      };
    }

    const today = isoDaysAgo(0).slice(0, 10);
    const all = memoriesSorted();
    const memoriesCreatedToday = all.filter((m) => m.capturedAt.startsWith(today)).length;

    return {
      greetingName: 'Udit',
      memoriesCreatedToday,
      recentMemories: all.slice(0, 5),
      importantMemories: all.filter((m) => m.favorite).slice(0, 4),
      recentActivity: store.notifications.slice(0, 4),
      suggestedQuestions: [
        'What was I working on yesterday?',
        'What did I learn about machine learning?',
        'Show me things related to Kairos',
        'What did I save last week?',
      ],
      processingJobs: store.jobs.filter((j) => j.stage !== 'READY').slice(0, 3),
      topics: store.topics.slice(0, 6),
      projects: store.projects.filter((p) => p.status === 'active'),
    };
  },
};

export const privacyService = {
  async exportData(): Promise<{ message: string }> {
    await delay(700);
    return {
      message:
        'Export prepared in the mock layer. A downloadable archive of memories and observations will be available when the privacy API is connected.',
    };
  },

  async requestDeletion(): Promise<{ message: string }> {
    await delay(700);
    getStore().deleted = true;
    return {
      message:
        'Deletion request recorded locally for this demo. Server-side erasure will be enforced when the backend privacy API is available.',
    };
  },

  async requestAccountDeletion(): Promise<{ message: string }> {
    await delay(800);
    return {
      message:
        'Account deletion request recorded in the mock layer. Clerk + backend account teardown will run when connected.',
    };
  },
};
