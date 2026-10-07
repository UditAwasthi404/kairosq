import { SOURCE_TYPE_LABELS } from '../../constants/source-labels';
import type {
  AppNotification,
  AppSettings,
  Device,
  Entity,
  Memory,
  Observation,
  ProcessingJob,
  Project,
  Source,
  Topic,
} from '../../types';
import { isoDaysAgo } from '../utils';

export { SOURCE_TYPE_LABELS };

type Store = {
  topics: Topic[];
  projects: Project[];
  entities: Entity[];
  sources: Source[];
  observations: Observation[];
  memories: Memory[];
  jobs: ProcessingJob[];
  notifications: AppNotification[];
  devices: Device[];
  settings: AppSettings;
  recentSearches: string[];
  askHistory: { role: 'user' | 'kairos'; content: string; createdAt: string }[];
  deleted: boolean;
  forceError: boolean;
  forceEmpty: boolean;
};

let store: Store | null = null;

function buildStore(): Store {
  const topics: Topic[] = [
    {
      id: 'topic-ai',
      name: 'AI',
      description: 'Models, agents, and applied machine intelligence.',
      memoryCount: 0,
      recentActivityAt: isoDaysAgo(0, 19, 42),
    },
    {
      id: 'topic-ml',
      name: 'Machine Learning',
      description: 'Training, evaluation, and retrieval systems.',
      memoryCount: 0,
      recentActivityAt: isoDaysAgo(0, 9, 42),
    },
    {
      id: 'topic-programming',
      name: 'Programming',
      description: 'Implementation notes, APIs, and architecture.',
      memoryCount: 0,
      recentActivityAt: isoDaysAgo(1, 18, 12),
    },
    {
      id: 'topic-research',
      name: 'Research',
      description: 'Papers, articles, and deep reading sessions.',
      memoryCount: 0,
      recentActivityAt: isoDaysAgo(2, 21, 5),
    },
    {
      id: 'topic-college',
      name: 'College',
      description: 'Coursework, lectures, and academic planning.',
      memoryCount: 0,
      recentActivityAt: isoDaysAgo(3, 14, 30),
    },
    {
      id: 'topic-projects',
      name: 'Projects',
      description: 'Active builds and product workstreams.',
      memoryCount: 0,
      recentActivityAt: isoDaysAgo(0, 8, 31),
    },
    {
      id: 'topic-fitness',
      name: 'Fitness',
      description: 'Training notes and recovery observations.',
      memoryCount: 0,
      recentActivityAt: isoDaysAgo(4, 7, 15),
    },
    {
      id: 'topic-personal',
      name: 'Personal',
      description: 'Life admin, ideas, and private notes.',
      memoryCount: 0,
      recentActivityAt: isoDaysAgo(5, 22, 10),
    },
  ];

  const projects: Project[] = [
    {
      id: 'proj-kairos',
      name: 'Kairos',
      description: 'Personal AI memory system — capture, retrieve, and ask.',
      memoryCount: 0,
      topicIds: ['topic-ai', 'topic-programming', 'topic-projects'],
      updatedAt: isoDaysAgo(0, 19, 42),
      status: 'active',
    },
    {
      id: 'proj-ml',
      name: 'Learning ML',
      description: 'Structured path through transformers, RAG, and evaluation.',
      memoryCount: 0,
      topicIds: ['topic-ml', 'topic-ai', 'topic-research'],
      updatedAt: isoDaysAgo(0, 9, 42),
      status: 'active',
    },
    {
      id: 'proj-college',
      name: 'College',
      description: 'Semester coursework and exam prep.',
      memoryCount: 0,
      topicIds: ['topic-college', 'topic-programming'],
      updatedAt: isoDaysAgo(3, 14, 30),
      status: 'active',
    },
    {
      id: 'proj-personal',
      name: 'Personal Projects',
      description: 'Side experiments and weekend builds.',
      memoryCount: 0,
      topicIds: ['topic-projects', 'topic-personal'],
      updatedAt: isoDaysAgo(6, 16, 45),
      status: 'paused',
    },
  ];

  const entities: Entity[] = [
    { id: 'ent-rag', name: 'RAG', type: 'concept' },
    { id: 'ent-transformers', name: 'Transformers', type: 'concept' },
    { id: 'ent-embeddings', name: 'Embeddings', type: 'concept' },
    { id: 'ent-nestjs', name: 'NestJS', type: 'tool' },
    { id: 'ent-expo', name: 'Expo', type: 'tool' },
    { id: 'ent-clerk', name: 'Clerk', type: 'tool' },
    { id: 'ent-pinecone', name: 'Vector databases', type: 'concept' },
    { id: 'ent-rerank', name: 'Reranking', type: 'concept' },
    { id: 'ent-udit', name: 'Udit', type: 'person' },
  ];

  const sources: Source[] = [
    {
      id: 'src-1',
      type: 'screenshot',
      label: 'Screenshot · Chrome',
      previewText: 'Article section on transformer attention and positional encodings.',
    },
    {
      id: 'src-2',
      type: 'link',
      label: 'Saved article',
      url: 'https://example.com/vector-databases',
      previewText: 'Overview of ANN indexes and hybrid search tradeoffs.',
    },
    {
      id: 'src-3',
      type: 'note',
      label: 'Quick note',
      previewText: 'API surface for memory retrieval and observation ingestion.',
    },
    {
      id: 'src-4',
      type: 'document',
      label: 'PDF · RAG Evaluation Notes',
      previewText: 'Metrics for faithfulness, context precision, and answer relevance.',
    },
    {
      id: 'src-5',
      type: 'conversation',
      label: 'Study session notes',
      previewText: 'Discussion of chunking strategies and embedding model choice.',
    },
    {
      id: 'src-6',
      type: 'audio',
      label: 'Voice memo',
      previewText: 'Ideas for Kairos privacy controls and retention defaults.',
    },
    {
      id: 'src-7',
      type: 'task',
      label: 'Task · Backend planning',
      previewText: 'Outline NestJS modules for memories, search, and ask.',
    },
    {
      id: 'src-8',
      type: 'photo',
      label: 'Whiteboard photo',
      previewText: 'Sketch of capture → OCR → memory extraction pipeline.',
    },
  ];

  type Seed = {
    id: string;
    title: string;
    summary: string;
    daysAgo: number;
    hour: number;
    minute: number;
    sourceType: Memory['sourceType'];
    topicIds: string[];
    projectIds: string[];
    entityIds: string[];
    relatedMemoryIds: string[];
    observationIds: string[];
    favorite?: boolean;
    sourceId: string;
    obsPreview: string;
    extracted: string;
  };

  const seeds: Seed[] = [
    {
      id: 'mem-1',
      title: 'Researching transformer architectures',
      summary:
        'Deep dive into encoder-decoder vs decoder-only designs, multi-head attention, and how positional encodings affect long-context retrieval.',
      daysAgo: 0,
      hour: 9,
      minute: 42,
      sourceType: 'screenshot',
      topicIds: ['topic-ai', 'topic-ml', 'topic-research'],
      projectIds: ['proj-ml'],
      entityIds: ['ent-transformers', 'ent-embeddings'],
      relatedMemoryIds: ['mem-2', 'mem-5', 'mem-8'],
      observationIds: ['obs-1'],
      favorite: true,
      sourceId: 'src-1',
      obsPreview: 'Screenshot of transformer architecture diagram and notes.',
      extracted:
        'Self-attention computes query-key-value projections… positional encodings… sparse attention variants for long sequences.',
    },
    {
      id: 'mem-2',
      title: 'Saved article about vector databases',
      summary:
        'Bookmarked comparison of HNSW, IVF, and hybrid keyword+vector search. Noted latency vs recall tradeoffs for personal memory retrieval.',
      daysAgo: 0,
      hour: 8,
      minute: 31,
      sourceType: 'link',
      topicIds: ['topic-ai', 'topic-programming', 'topic-projects'],
      projectIds: ['proj-kairos', 'proj-ml'],
      entityIds: ['ent-pinecone', 'ent-embeddings', 'ent-rag'],
      relatedMemoryIds: ['mem-1', 'mem-4', 'mem-6'],
      observationIds: ['obs-2'],
      sourceId: 'src-2',
      obsPreview: 'Article link on vector database indexing strategies.',
      extracted:
        'ANN indexes approximate nearest neighbors… hybrid search combines BM25 with dense embeddings… metadata filters essential for personal corpora.',
    },
    {
      id: 'mem-3',
      title: 'Worked on Kairos API design',
      summary:
        'Sketched NestJS modules for observations, memories, search, and ask. Decided on soft-delete and retention policies as first-class privacy features.',
      daysAgo: 1,
      hour: 18,
      minute: 12,
      sourceType: 'note',
      topicIds: ['topic-programming', 'topic-projects', 'topic-ai'],
      projectIds: ['proj-kairos'],
      entityIds: ['ent-nestjs', 'ent-clerk'],
      relatedMemoryIds: ['mem-7', 'mem-9', 'mem-2'],
      observationIds: ['obs-3'],
      favorite: true,
      sourceId: 'src-3',
      obsPreview: 'Notes on Kairos API boundaries and privacy endpoints.',
      extracted:
        'POST /observations · GET /memories · POST /ask · privacy export/delete · Clerk JWT on all protected routes.',
    },
    {
      id: 'mem-4',
      title: 'RAG Evaluation Notes',
      summary:
        'Compiled evaluation checklist: context precision, faithfulness, answer relevance, and latency budgets for mobile ask flows.',
      daysAgo: 1,
      hour: 21,
      minute: 5,
      sourceType: 'document',
      topicIds: ['topic-ml', 'topic-research', 'topic-ai'],
      projectIds: ['proj-ml', 'proj-kairos'],
      entityIds: ['ent-rag', 'ent-rerank'],
      relatedMemoryIds: ['mem-5', 'mem-6', 'mem-2'],
      observationIds: ['obs-4'],
      favorite: true,
      sourceId: 'src-4',
      obsPreview: 'PDF notes on RAG evaluation metrics.',
      extracted:
        'Faithfulness measures groundedness… context precision penalizes irrelevant retrieved chunks… reranking lifts top-k quality.',
    },
    {
      id: 'mem-5',
      title: 'Vector Search Research',
      summary:
        'Session notes on chunking strategies, embedding model selection, and when to apply cross-encoder reranking.',
      daysAgo: 2,
      hour: 16,
      minute: 40,
      sourceType: 'conversation',
      topicIds: ['topic-ml', 'topic-ai'],
      projectIds: ['proj-ml'],
      entityIds: ['ent-embeddings', 'ent-rerank', 'ent-rag'],
      relatedMemoryIds: ['mem-4', 'mem-6', 'mem-1'],
      observationIds: ['obs-5'],
      sourceId: 'src-5',
      obsPreview: 'Study conversation about retrieval quality.',
      extracted:
        'Prefer semantic chunking for notes… bge-small for on-device experiments… cross-encoder rerank on top 20 candidates.',
    },
    {
      id: 'mem-6',
      title: 'Embedding Models comparison',
      summary:
        'Compared open embedding models for short notes vs long articles. Marked tradeoffs between dimension size and mobile latency.',
      daysAgo: 2,
      hour: 11,
      minute: 18,
      sourceType: 'note',
      topicIds: ['topic-ml', 'topic-research'],
      projectIds: ['proj-ml'],
      entityIds: ['ent-embeddings'],
      relatedMemoryIds: ['mem-4', 'mem-5', 'mem-2'],
      observationIds: ['obs-6'],
      sourceId: 'src-3',
      obsPreview: 'Comparison table of embedding model options.',
      extracted:
        'Smaller dims faster on device… multilingual models needed later… normalize vectors before cosine similarity.',
    },
    {
      id: 'mem-7',
      title: 'Kairos AI Architecture',
      summary:
        'Whiteboard capture of the async pipeline: capture → upload → OCR/extract → memory write → embed → index.',
      daysAgo: 3,
      hour: 19,
      minute: 55,
      sourceType: 'photo',
      topicIds: ['topic-projects', 'topic-ai', 'topic-programming'],
      projectIds: ['proj-kairos'],
      entityIds: ['ent-expo', 'ent-nestjs', 'ent-rag'],
      relatedMemoryIds: ['mem-3', 'mem-9', 'mem-10'],
      observationIds: ['obs-7'],
      favorite: true,
      sourceId: 'src-8',
      obsPreview: 'Whiteboard photo of Kairos processing stages.',
      extracted:
        'Observation queue · extraction worker · memory graph · vector index · ask orchestrator with evidence cards.',
    },
    {
      id: 'mem-8',
      title: 'AI Learning Session',
      summary:
        'Reviewed attention visualizations and residual streams. Linked concepts back to retrieval grounding for Kairos answers.',
      daysAgo: 3,
      hour: 14,
      minute: 22,
      sourceType: 'screenshot',
      topicIds: ['topic-ai', 'topic-college'],
      projectIds: ['proj-ml', 'proj-college'],
      entityIds: ['ent-transformers'],
      relatedMemoryIds: ['mem-1', 'mem-5'],
      observationIds: ['obs-8'],
      sourceId: 'src-1',
      obsPreview: 'Lecture screenshot on attention maps.',
      extracted:
        'Attention heads specialize… residual stream accumulates features… grounding answers requires retrieved evidence.',
    },
    {
      id: 'mem-9',
      title: 'Backend Planning',
      summary:
        'Task breakdown for NestJS services: auth middleware, memory CRUD, search façade, and processing job status API.',
      daysAgo: 4,
      hour: 10,
      minute: 5,
      sourceType: 'task',
      topicIds: ['topic-programming', 'topic-projects'],
      projectIds: ['proj-kairos'],
      entityIds: ['ent-nestjs', 'ent-clerk'],
      relatedMemoryIds: ['mem-3', 'mem-7'],
      observationIds: ['obs-9'],
      sourceId: 'src-7',
      obsPreview: 'Task list for Kairos backend milestones.',
      extracted:
        'Auth guard · observations module · memories module · search module · jobs websocket later.',
    },
    {
      id: 'mem-10',
      title: 'Privacy controls sketch',
      summary:
        'Voice memo outlining retention defaults, raw observation deletion, and export packaging for personal data.',
      daysAgo: 4,
      hour: 20,
      minute: 30,
      sourceType: 'audio',
      topicIds: ['topic-personal', 'topic-projects', 'topic-ai'],
      projectIds: ['proj-kairos'],
      entityIds: ['ent-clerk'],
      relatedMemoryIds: ['mem-3', 'mem-7'],
      observationIds: ['obs-10'],
      sourceId: 'src-6',
      obsPreview: 'Voice memo about Kairos privacy defaults.',
      extracted:
        'Default retain 180 days… allow purge raw screenshots while keeping summaries… export as JSON + markdown.',
    },
    {
      id: 'mem-11',
      title: 'Retrieval Metrics draft',
      summary:
        'Drafted a small scorecard for Kairos ask quality: evidence coverage, user trust signals, and latency SLOs.',
      daysAgo: 5,
      hour: 15,
      minute: 12,
      sourceType: 'document',
      topicIds: ['topic-research', 'topic-ml', 'topic-projects'],
      projectIds: ['proj-kairos', 'proj-ml'],
      entityIds: ['ent-rag', 'ent-rerank'],
      relatedMemoryIds: ['mem-4', 'mem-5'],
      observationIds: ['obs-11'],
      sourceId: 'src-4',
      obsPreview: 'Document draft of retrieval quality scorecard.',
      extracted:
        'Evidence coverage % · user thumbs · p95 ask latency under 2s · insufficient-evidence rate tracked.',
    },
    {
      id: 'mem-12',
      title: 'Expo navigation patterns',
      summary:
        'Notes on Expo Router tabs, stack headers, and keeping mobile thumb-reach primary actions near the bottom.',
      daysAgo: 5,
      hour: 9,
      minute: 48,
      sourceType: 'note',
      topicIds: ['topic-programming', 'topic-projects'],
      projectIds: ['proj-kairos'],
      entityIds: ['ent-expo'],
      relatedMemoryIds: ['mem-3', 'mem-7'],
      observationIds: ['obs-12'],
      sourceId: 'src-3',
      obsPreview: 'Implementation notes for mobile navigation.',
      extracted:
        'File-based routes · tab icons without labels · stack for detail screens · safe area insets everywhere.',
    },
    {
      id: 'mem-13',
      title: 'College OS assignment notes',
      summary:
        'Lecture notes on process scheduling and memory virtualization — kept for midterm review.',
      daysAgo: 6,
      hour: 13,
      minute: 20,
      sourceType: 'document',
      topicIds: ['topic-college', 'topic-programming'],
      projectIds: ['proj-college'],
      entityIds: [],
      relatedMemoryIds: ['mem-8'],
      observationIds: ['obs-13'],
      sourceId: 'src-4',
      obsPreview: 'Course PDF highlights on OS concepts.',
      extracted:
        'Round-robin vs multilevel feedback… TLB and page tables… context switch cost.',
    },
    {
      id: 'mem-14',
      title: 'Morning run recovery notes',
      summary:
        'Logged pace, perceived effort, and a reminder to stretch hip flexors after desk-heavy AI workdays.',
      daysAgo: 6,
      hour: 7,
      minute: 15,
      sourceType: 'note',
      topicIds: ['topic-fitness', 'topic-personal'],
      projectIds: ['proj-personal'],
      entityIds: [],
      relatedMemoryIds: [],
      observationIds: ['obs-14'],
      sourceId: 'src-3',
      obsPreview: 'Short fitness note after morning run.',
      extracted: '5.2 km · easy pace · hip flexor stretch tonight.',
    },
    {
      id: 'mem-15',
      title: 'Reranking experiment plan',
      summary:
        'Outlined an A/B plan for bi-encoder vs cross-encoder rerank on personal notes corpus.',
      daysAgo: 7,
      hour: 17,
      minute: 40,
      sourceType: 'note',
      topicIds: ['topic-ml', 'topic-research'],
      projectIds: ['proj-ml'],
      entityIds: ['ent-rerank', 'ent-rag'],
      relatedMemoryIds: ['mem-4', 'mem-5', 'mem-11'],
      observationIds: ['obs-15'],
      sourceId: 'src-3',
      obsPreview: 'Experiment plan for retrieval reranking.',
      extracted:
        'Holdout 200 queries · measure nDCG@5 · track mobile latency impact of cross-encoder.',
    },
    {
      id: 'mem-16',
      title: 'Things related to Kairos from last week',
      summary:
        'Weekly synthesis: API design, architecture whiteboard, privacy memo, and Expo navigation notes all pointed at the same product spine.',
      daysAgo: 7,
      hour: 22,
      minute: 10,
      sourceType: 'conversation',
      topicIds: ['topic-projects', 'topic-ai'],
      projectIds: ['proj-kairos'],
      entityIds: ['ent-nestjs', 'ent-expo'],
      relatedMemoryIds: ['mem-3', 'mem-7', 'mem-10', 'mem-12'],
      observationIds: ['obs-16'],
      favorite: true,
      sourceId: 'src-5',
      obsPreview: 'Weekly reflection linking Kairos workstreams.',
      extracted:
        'Capture pipeline clarity improved… privacy as a product feature… mobile ask UX still the flagship.',
    },
  ];

  const memories: Memory[] = seeds.map((s) => {
    const capturedAt = isoDaysAgo(s.daysAgo, s.hour, s.minute);
    return {
      id: s.id,
      title: s.title,
      summary: s.summary,
      capturedAt,
      createdAt: capturedAt,
      sourceType: s.sourceType,
      topicIds: s.topicIds,
      projectIds: s.projectIds,
      entityIds: s.entityIds,
      relatedMemoryIds: s.relatedMemoryIds,
      observationIds: s.observationIds,
      favorite: Boolean(s.favorite),
      relevance: 0.72 + (s.id.charCodeAt(4) % 20) / 100,
    };
  });

  const observations: Observation[] = seeds.map((s, index) => {
    const status: Observation['status'] =
      index === 0 ? 'PROCESSING' : index === 14 ? 'PENDING' : 'READY';
    return {
      id: s.observationIds[0]!,
      title: s.title,
      sourceType: s.sourceType,
      capturedAt: isoDaysAgo(s.daysAgo, s.hour, s.minute),
      status,
      previewText: s.obsPreview,
      extractedText: status === 'READY' || status === 'PROCESSING' ? s.extracted : undefined,
      summary: status === 'READY' ? s.summary : undefined,
      linkedMemoryIds: status === 'READY' ? [s.id] : [],
      sourceLabel: SOURCE_TYPE_LABELS[s.sourceType],
    };
  });

  // Attach source ids onto a side map via observation titles — sources already listed
  void sources;

  const jobs: ProcessingJob[] = [
    {
      id: 'job-1',
      observationId: 'obs-1',
      title: 'Researching transformer architectures',
      sourceType: 'screenshot',
      stage: 'PROCESSING',
      startedAt: isoDaysAgo(0, 9, 42),
      updatedAt: isoDaysAgo(0, 9, 44),
      steps: [
        { id: 's1', label: 'Uploaded', status: 'completed' },
        { id: 's2', label: 'OCR', status: 'completed' },
        { id: 's3', label: 'Memory extraction', status: 'running' },
        { id: 's4', label: 'Embedding', status: 'queued' },
      ],
    },
    {
      id: 'job-2',
      observationId: 'obs-15',
      title: 'Reranking experiment plan',
      sourceType: 'note',
      stage: 'UPLOADING',
      startedAt: isoDaysAgo(0, 8, 10),
      updatedAt: isoDaysAgo(0, 8, 11),
      steps: [
        { id: 's1', label: 'Uploaded', status: 'running' },
        { id: 's2', label: 'OCR', status: 'queued' },
        { id: 's3', label: 'Memory extraction', status: 'queued' },
        { id: 's4', label: 'Embedding', status: 'queued' },
      ],
    },
    {
      id: 'job-3',
      observationId: 'obs-14',
      title: 'Morning run recovery notes',
      sourceType: 'note',
      stage: 'READY',
      startedAt: isoDaysAgo(6, 7, 15),
      updatedAt: isoDaysAgo(6, 7, 16),
      resultMemoryId: 'mem-14',
      steps: [
        { id: 's1', label: 'Uploaded', status: 'completed' },
        { id: 's2', label: 'OCR', status: 'completed' },
        { id: 's3', label: 'Memory extraction', status: 'completed' },
        { id: 's4', label: 'Embedding', status: 'completed' },
      ],
    },
  ];

  const notifications: AppNotification[] = [
    {
      id: 'ntf-1',
      title: '3 new memories created',
      body: 'Transformer research, vector databases, and a Kairos API note landed today.',
      createdAt: isoDaysAgo(0, 9, 50),
      read: false,
      href: '/(app)/timeline',
    },
    {
      id: 'ntf-2',
      title: 'Kairos project update',
      body: 'Your Kairos project now has 8 related memories across architecture and privacy.',
      createdAt: isoDaysAgo(0, 8, 40),
      read: false,
      href: '/(app)/projects/proj-kairos',
    },
    {
      id: 'ntf-3',
      title: 'Processing completed',
      body: 'Morning run recovery notes is ready to browse.',
      createdAt: isoDaysAgo(6, 7, 16),
      read: true,
      href: '/(app)/memory/mem-14',
    },
    {
      id: 'ntf-4',
      title: 'Suggested question',
      body: 'Ask Kairos: What was I learning about RAG?',
      createdAt: isoDaysAgo(1, 12, 0),
      read: true,
      href: '/(app)/(tabs)/ask',
    },
  ];

  const devices: Device[] = [
    {
      id: 'dev-1',
      name: 'Pixel / current phone',
      platform: 'android',
      isCurrent: true,
      lastSyncAt: isoDaysAgo(0, 9, 45),
      captureEnabled: true,
      connectionStatus: 'connected',
    },
    {
      id: 'dev-2',
      name: 'iPad (reading)',
      platform: 'ios',
      isCurrent: false,
      lastSyncAt: isoDaysAgo(1, 21, 10),
      captureEnabled: true,
      connectionStatus: 'idle',
    },
    {
      id: 'dev-3',
      name: 'Laptop browser',
      platform: 'web',
      isCurrent: false,
      lastSyncAt: isoDaysAgo(3, 18, 0),
      captureEnabled: false,
      connectionStatus: 'offline',
    },
  ];

  const settings: AppSettings = {
    ai: {
      autoCapture: true,
      suggestRelated: true,
      allowBackgroundProcessing: true,
      retainRawObservations: true,
    },
    privacy: {
      storeScreenshots: true,
      storeAudioTranscripts: true,
      shareAnonymousTelemetry: false,
      retentionDays: 180,
    },
    notifications: {
      memoryCreated: true,
      processingComplete: true,
      weeklyDigest: false,
    },
    appearance: 'system',
  };

  // Recount topic/project memory counts
  for (const topic of topics) {
    topic.memoryCount = memories.filter((m) => m.topicIds.includes(topic.id)).length;
  }
  for (const project of projects) {
    project.memoryCount = memories.filter((m) => m.projectIds.includes(project.id)).length;
  }

  return {
    topics,
    projects,
    entities,
    sources,
    observations,
    memories,
    jobs,
    notifications,
    devices,
    settings,
    recentSearches: [
      'What was I learning about RAG?',
      'Kairos API design',
      'vector databases',
      'things related to Kairos',
    ],
    askHistory: [],
    deleted: false,
    forceError: false,
    forceEmpty: false,
  };
}

export function getStore(): Store {
  if (!store) store = buildStore();
  return store;
}

export function resetStore(): void {
  store = buildStore();
}

export function getSourceForMemory(memoryId: string): Source {
  const s = getStore();
  const memory = s.memories.find((m) => m.id === memoryId);
  const observation = memory
    ? s.observations.find((o) => memory.observationIds.includes(o.id))
    : undefined;
  const byType = s.sources.find((src) => src.type === (memory?.sourceType ?? 'note'));
  return (
    byType ?? {
      id: 'src-fallback',
      type: observation?.sourceType ?? 'note',
      label: observation?.sourceLabel ?? 'Note',
      previewText: observation?.previewText,
    }
  );
}
